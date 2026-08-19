@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Forge Super Agent Setup

pushd "%~dp0"
set "FORGE_INTEGRATIONS_HOME=%USERPROFILE%\.forge\integrations"
set "FORGE_WORK_HOME=%USERPROFILE%\.forge\work"
set "FORGE_OPTIONAL_WARNINGS=0"

echo.
echo ============================================================
echo   Forge Super Agent - Local Setup
echo ============================================================
echo Repository: %CD%
echo Integrations: %FORGE_INTEGRATIONS_HOME%
echo.

echo [1/7] Checking required commands...
where node >nul 2>&1 || goto :missing_node
where git >nul 2>&1 || goto :missing_git
where powershell >nul 2>&1 || goto :missing_powershell

echo [2/7] Ensuring Visual Studio Spectre-mitigated libraries...
rem The upstream Code-OSS/Void native projects require Spectre runtime libraries.
rem If they are missing, this helper uses the installed Visual Studio setup.exe
rem modify flow and requests UAC elevation to add the supported components.
call powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\forge-windows-spectre-ensure.ps1" -RepoRoot "%CD%"
if errorlevel 1 goto :failed

echo [3/7] Preparing pinned Node runtime, Windows native toolchain, and dependencies...
rem This wrapper resolves the checksummed Node version from .nvmrc, detects VS 2022
rem or VS 2026, releases repo-scoped locks, serializes native lifecycle scripts,
rem and runs npm ci inside the compatible runtime/toolchain.
call powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\forge-windows-native-preflight.ps1" -RepoRoot "%CD%" -InstallDependencies
if errorlevel 1 goto :failed

rem Resolve the same checksummed Node runtime for every remaining setup stage.
set "FORGE_NODE="
for /f "delims=" %%P in ('node scripts\forge-node20-runtime.mjs ensure') do set "FORGE_NODE=%%P"
if not defined FORGE_NODE (
    echo ERROR: Could not resolve the pinned Forge Node runtime after native setup.
    goto :failed
)
if not exist "!FORGE_NODE!" (
    echo ERROR: Pinned Forge Node runtime does not exist: !FORGE_NODE!
    goto :failed
)
for %%I in ("!FORGE_NODE!") do set "FORGE_NODE_HOME=%%~dpI"
set "FORGE_NPM_CLI=!FORGE_NODE_HOME!node_modules\npm\bin\npm-cli.js"
if not exist "!FORGE_NPM_CLI!" (
    echo ERROR: Pinned Forge npm CLI does not exist: !FORGE_NPM_CLI!
    goto :failed
)
set "PATH=!FORGE_NODE_HOME!;!PATH!"
for /f "delims=" %%V in ('"!FORGE_NODE!" --version') do set "FORGE_NODE_VERSION=%%V"
echo [forge-setup] Runtime locked to !FORGE_NODE_VERSION!: !FORGE_NODE!

echo [4/7] Running core Forge contract tests...
"!FORGE_NODE!" scripts\forge-brand-contract-test.mjs
if errorlevel 1 goto :failed
"!FORGE_NODE!" scripts\forge-ui-contract-test.mjs
if errorlevel 1 goto :failed
"!FORGE_NODE!" scripts\forge-native-setup-contract.mjs
if errorlevel 1 goto :failed
"!FORGE_NODE!" scripts\forge-react-service-export-contract.mjs
if errorlevel 1 goto :failed
"!FORGE_NODE!" scripts\forge-model-provider-contract-test.mjs
if errorlevel 1 goto :failed
"!FORGE_NODE!" scripts\forge-work-self-test.mjs
if errorlevel 1 goto :failed
"!FORGE_NODE!" scripts\manage-skills.mjs validate
if errorlevel 1 goto :failed

echo [5/7] Building Forge core IDE with pinned Node...
"!FORGE_NODE!" "!FORGE_NPM_CLI!" run compile
if errorlevel 1 goto :failed
"!FORGE_NODE!" "!FORGE_NPM_CLI!" run buildreact
if errorlevel 1 goto :failed

echo [6/7] Installing optional browser runtime and pinned Super Agent integrations...
rem The IDE core is already built at this point. Browser and external integrations
rem extend Forge, but a third-party setup problem must not make the editor unusable.
"!FORGE_NODE!" "!FORGE_NPM_CLI!" exec playwright install chromium
if errorlevel 1 (
    echo [forge-setup] WARNING: Playwright Chromium install failed. Built-in IDE remains usable; browser-agent features may be unavailable.
    set "FORGE_OPTIONAL_WARNINGS=1"
)

rem --full clones SkillOpt, Understand Anything, Agent Lightning, Open Design and AionUi.
rem Agent Lightning's GPU/RL stack is intentionally NOT installed; its source is only pinned locally for the later training phase.
"!FORGE_NODE!" scripts\forge-super-agent-bootstrap.mjs --full --setup
if errorlevel 1 (
    echo [forge-setup] WARNING: One or more optional Super Agent integrations could not finish setup.
    echo [forge-setup] WARNING: Forge core will still be validated and can launch. Re-run setup later to finish integrations.
    set "FORGE_OPTIONAL_WARNINGS=1"
)

echo [7/7] Verifying Forge core runtime and reporting integration state...
"!FORGE_NODE!" scripts\forge-runtime-guard.mjs
if errorlevel 1 goto :failed
"!FORGE_NODE!" scripts\forge-integrations.mjs verify active
if errorlevel 1 (
    echo [forge-setup] WARNING: Active integrations are not fully ready. Core Forge remains launchable.
    set "FORGE_OPTIONAL_WARNINGS=1"
)
"!FORGE_NODE!" scripts\forge-integrations.mjs doctor
if errorlevel 1 (
    echo [forge-setup] WARNING: Integration doctor could not complete.
    set "FORGE_OPTIONAL_WARNINGS=1"
)
"!FORGE_NODE!" scripts\forge-super-agent-self-test.mjs
if errorlevel 1 (
    echo [forge-setup] WARNING: Super Agent integration self-test is not fully green. Core Forge remains launchable.
    set "FORGE_OPTIONAL_WARNINGS=1"
)

echo.
echo ============================================================
echo   Forge core IDE setup completed successfully.
echo ============================================================
echo Local source integrations are under:
echo   %FORGE_INTEGRATIONS_HOME%
echo Forge setup/runtime Node: !FORGE_NODE_VERSION! from the checksummed .nvmrc runtime.
echo Windows native modules: compatible VS 2022/VS 2026 toolchain plus Spectre libraries verified.
echo Native lifecycle scripts: serialized to avoid shared node-addon-api GYP races.
echo React service bridge: every named hook import has a real export.
echo Provider/model routing: registry, transport and connection-test coverage verified.
echo.
if "!FORGE_OPTIONAL_WARNINGS!"=="1" (
    echo Optional integration warnings were detected.
    echo Forge itself is built and may be opened now; affected browser/Super Agent features can be repaired by rerunning setup later.
) else (
    echo Playwright and supported Super Agent integrations verified successfully.
)
echo Agent Lightning source may be present, but GPU/RL training remains deferred.
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
echo ERROR: A bootstrap Node.js runtime is not available on PATH.
echo Forge only uses it to fetch/verify the pinned Node version from .nvmrc.
goto :failed

:missing_git
echo ERROR: Git is not available on PATH.
goto :failed

:missing_powershell
echo ERROR: Windows PowerShell is not available on PATH.
goto :failed

:failed
echo.
echo Forge core setup failed. Review the first failing core command above.
echo If Spectre setup fails, approve the Windows UAC prompt or install the three x64/x86 Spectre components
echo from Visual Studio Installer -> Modify -> Individual components, then rerun setup.
echo If native preflight fails, ensure Visual Studio Desktop development with C++
echo plus the x64/x86 MSVC tools and a Windows 10/11 SDK are installed in VS 2022 or VS 2026.
echo If you are starting setup from PowerShell, run: .\setup-forge-super-agent.bat
popd
exit /b 1