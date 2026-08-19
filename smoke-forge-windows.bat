@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Forge Windows Release Smoke

pushd "%~dp0"

echo.
echo ============================================================
echo   Forge - Windows Release Smoke
echo ============================================================
echo Repository: %CD%
echo.

where node >nul 2>&1
if errorlevel 1 goto :missing_node

set "FORGE_NODE="
for /f "delims=" %%P in ('node scripts\forge-node20-runtime.mjs ensure') do set "FORGE_NODE=%%P"
if not defined FORGE_NODE (
    echo [forge-smoke] Could not resolve the pinned Forge Node runtime.
    goto :failed
)
if not exist "!FORGE_NODE!" (
    echo [forge-smoke] Pinned Forge Node runtime is missing: !FORGE_NODE!
    goto :failed
)
for %%I in ("!FORGE_NODE!") do set "FORGE_NODE_HOME=%%~dpI"
set "FORGE_NPM_CLI=!FORGE_NODE_HOME!node_modules\npm\bin\npm-cli.js"
if not exist "!FORGE_NPM_CLI!" (
    echo [forge-smoke] Pinned Forge npm CLI is missing: !FORGE_NPM_CLI!
    goto :failed
)
set "PATH=!FORGE_NODE_HOME!;!PATH!"
for /f "delims=" %%V in ('"!FORGE_NODE!" --version') do set "FORGE_NODE_VERSION=%%V"
echo [forge-smoke] Runtime locked to !FORGE_NODE_VERSION!.

if not exist "node_modules" (
    echo [forge-smoke] Dependencies are not installed.
    echo [forge-smoke] PowerShell: .\setup-forge-super-agent.bat
    echo [forge-smoke] Command Prompt: setup-forge-super-agent.bat
    goto :failed
)

echo [1/4] Running Forge contracts and skill validation...
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

echo [2/4] Compiling core and building the Forge React UI with pinned Node...
"!FORGE_NODE!" "!FORGE_NPM_CLI!" run compile
if errorlevel 1 goto :failed
"!FORGE_NODE!" "!FORGE_NPM_CLI!" run buildreact
if errorlevel 1 goto :failed

echo [3/4] Verifying runtime, integrations, and Super Agent state...
"!FORGE_NODE!" scripts\forge-runtime-guard.mjs
if errorlevel 1 goto :failed
"!FORGE_NODE!" scripts\forge-integrations.mjs verify active
if errorlevel 1 goto :failed
"!FORGE_NODE!" scripts\forge-integrations.mjs doctor
if errorlevel 1 goto :failed
"!FORGE_NODE!" scripts\forge-super-agent-self-test.mjs
if errorlevel 1 goto :failed

set "FORGE_ELECTRON=%~dp0node_modules\electron\dist\electron.exe"
if not exist "%FORGE_ELECTRON%" (
    echo [forge-smoke] Electron runtime is missing: %FORGE_ELECTRON%
    goto :failed
)
for /f "usebackq delims=" %%V in (`"%FORGE_ELECTRON%" --version`) do set "FORGE_ELECTRON_VERSION=%%V"
if not defined FORGE_ELECTRON_VERSION (
    echo [forge-smoke] Electron runtime did not return a version.
    goto :failed
)
echo [forge-smoke] Electron runtime: %FORGE_ELECTRON_VERSION%

echo [4/4] Automated preflight passed. Launching Forge for the final desktop smoke...
echo.
echo ============================================================
echo   FINAL MANUAL RELEASE CHECKLIST
echo ============================================================
echo   1. Confirm a Chat model is selected. Use Test API for the provider/model you want to run.
echo   2. Send a normal coding task and confirm a response/run starts.
echo   3. Attach a file and an image; confirm both remain staged and are used.
echo   4. Start a task, press Stop, and confirm the active run aborts.
echo   5. Run /browser and confirm the Playwright browser path responds.
echo   6. Run /work and confirm Work Mode responds without a dead command.
echo   7. Run /design and confirm the design workflow responds.
echo   8. Confirm the Forge icon/identity is correct in the window and Windows taskbar.
echo.
echo Pinned Node runtime/native setup semantics were checked automatically.
echo React service import/export parity was checked automatically before the build.
echo Provider/model registry, transport, and Test API UI wiring were checked automatically.
echo Live API success still depends on valid credentials, endpoint access, and the selected model being available from that provider.
echo Keep this terminal open while you perform the checklist.
echo.

call run-forge-ide.bat
if errorlevel 1 goto :failed

echo [forge-smoke] Forge was launched. Complete the eight checks above for release sign-off.
popd
exit /b 0

:missing_node
echo [forge-smoke] A bootstrap Node.js runtime is not available on PATH.
echo [forge-smoke] Run .\setup-forge-super-agent.bat from PowerShell first.
goto :failed

:failed
echo.
echo ============================================================
echo   Forge Windows release smoke FAILED.
echo ============================================================
echo Fix the first failing check above and run .\smoke-forge-windows.bat again from PowerShell.
popd
exit /b 1
