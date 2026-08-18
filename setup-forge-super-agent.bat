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
where powershell >nul 2>&1 || goto :missing_powershell

echo [2/6] Preparing Windows native toolchain and installing dependencies...
rem This wrapper detects VS 2022 or VS 2026, releases repo-scoped native locks,
rem and runs npm ci in the same process as the selected node-gyp configuration.
rem VS 2026 automatically uses Forge's pinned node-gyp 12.4.0 compatibility toolchain.
call powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\forge-windows-native-preflight.ps1" -RepoRoot "%CD%" -InstallDependencies
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
call node scripts\forge-react-service-export-contract.mjs
if errorlevel 1 goto :failed
call node scripts\forge-model-provider-contract-test.mjs
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
echo Windows native modules: compatible VS 2022/VS 2026 toolchain verified.
echo React service bridge: every named hook import has a real export.
echo Provider/model routing: registry, transport and connection-test coverage verified.
echo.
echo Agent Lightning source is present, but GPU/RL training remains deferred.
echo.
echo PowerShell commands:
echo   .\run-forge-ide.bat
echo   .\smoke-forge-windows.bat
echo Command Prompt commands:
echo   run-forge-ide.bat
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

:missing_powershell
echo ERROR: Windows PowerShell is not available on PATH.
goto :failed

:failed
echo.
echo Forge Super Agent setup failed. Review the first failing command above.
echo If native preflight fails, open Visual Studio Installer and ensure Desktop development with C++
echo plus the x64/x86 MSVC tools and a Windows 10/11 SDK are installed in VS 2022 or VS 2026.
echo If you are starting setup from PowerShell, run: .\setup-forge-super-agent.bat
popd
exit /b 1
