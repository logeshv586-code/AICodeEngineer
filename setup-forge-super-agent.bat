@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Forge Super Agent Setup

pushd "%~dp0"
set "FORGE_INTEGRATIONS_HOME=%USERPROFILE%\.forge\integrations"
set "FORGE_WORK_HOME=%USERPROFILE%\.forge\work"

echo.
echo ============================================================
echo   Forge Super Agent - Local Setup
echo ============================================================
echo Repository: %CD%
echo Integrations: %FORGE_INTEGRATIONS_HOME%
echo.

echo [1/6] Checking required commands...
where node >nul 2>&1 || goto :missing_node
where npm >nul 2>&1 || goto :missing_npm
where git >nul 2>&1 || goto :missing_git

echo [2/6] Installing deterministic Forge dependencies with npm ci...
rem Setup is an explicit repair/install command, so always reconcile node_modules
rem to package-lock.json instead of trusting a possibly stale or partial directory.
call npm ci
if errorlevel 1 goto :failed

echo [3/6] Cloning pinned open-source integrations, setting up supported dependencies, and installing Chromium...
rem --full clones SkillOpt, Understand Anything, Agent Lightning, Open Design and AionUi.
rem --browser installs the Chromium runtime used by Forge's Playwright browser agent.
rem Agent Lightning's GPU/RL stack is intentionally NOT installed; its source is only pinned locally for the later training phase.
call node scripts\forge-super-agent-bootstrap.mjs --full --setup --browser
if errorlevel 1 goto :failed

echo [4/6] Running fast local contract tests...
call node scripts\forge-brand-contract-test.mjs
if errorlevel 1 goto :failed
call node scripts\forge-ui-contract-test.mjs
if errorlevel 1 goto :failed
call node scripts\forge-work-self-test.mjs
if errorlevel 1 goto :failed
call node scripts\manage-skills.mjs validate
if errorlevel 1 goto :failed

echo [5/6] Building Forge...
call npm run compile
if errorlevel 1 goto :failed
call npm run buildreact
if errorlevel 1 goto :failed

echo [6/6] Verifying runtime and Super Agent integration state...
call node scripts\forge-runtime-guard.mjs
if errorlevel 1 goto :failed
call node scripts\forge-integrations.mjs verify active
if errorlevel 1 goto :failed
call node scripts\forge-integrations.mjs doctor
if errorlevel 1 goto :failed
call node scripts\forge-super-agent-self-test.mjs
if errorlevel 1 goto :failed

echo.
echo ============================================================
echo   Forge Super Agent setup completed successfully.
echo ============================================================
echo Local source integrations are under:
echo   %FORGE_INTEGRATIONS_HOME%
echo Browser runtime: Playwright Chromium installed for Forge browser tasks.
echo.
echo Agent Lightning source is present, but GPU/RL training remains deferred.
echo Start Forge with:
echo   run-forge-ide.bat
echo Final release smoke with:
echo   smoke-forge-windows.bat

echo.
popd
exit /b 0

:missing_node
echo ERROR: Node.js is not available on PATH.
goto :failed

:missing_npm
echo ERROR: npm is not available on PATH.
goto :failed

:missing_git
echo ERROR: Git is not available on PATH.
goto :failed

:failed
echo.
echo Forge Super Agent setup failed. Review the command output above.
popd
exit /b 1
