@echo off
setlocal EnableExtensions
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
where npm >nul 2>&1
if errorlevel 1 goto :missing_npm

if not exist "node_modules" (
    echo [forge-smoke] Dependencies are not installed.
    echo [forge-smoke] Run setup-forge-super-agent.bat first.
    goto :failed
)

echo [1/4] Running Forge contracts and skill validation...
call node scripts\forge-brand-contract-test.mjs
if errorlevel 1 goto :failed
call node scripts\forge-ui-contract-test.mjs
if errorlevel 1 goto :failed
call node scripts\forge-work-self-test.mjs
if errorlevel 1 goto :failed
call node scripts\manage-skills.mjs validate
if errorlevel 1 goto :failed

echo [2/4] Compiling core and building the Forge React UI...
call npm run compile
if errorlevel 1 goto :failed
call npm run buildreact
if errorlevel 1 goto :failed

echo [3/4] Verifying runtime, integrations, and Super Agent state...
call node scripts\forge-runtime-guard.mjs
if errorlevel 1 goto :failed
call node scripts\forge-integrations.mjs verify active
if errorlevel 1 goto :failed
call node scripts\forge-integrations.mjs doctor
if errorlevel 1 goto :failed
call node scripts\forge-super-agent-self-test.mjs
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
echo   1. Confirm a Chat model is selected.
echo   2. Send a normal coding task and confirm a response/run starts.
echo   3. Attach a file and an image; confirm both remain staged and are used.
echo   4. Start a task, press Stop, and confirm the active run aborts.
echo   5. Run /browser and confirm the Playwright browser path responds.
echo   6. Run /work and confirm Work Mode responds without a dead command.
echo   7. Run /design and confirm the design workflow responds.
echo   8. Confirm the Forge icon/identity is correct in the window and Windows taskbar.
echo.
echo Keep this terminal open while you perform the checklist.
echo.

call run-forge-ide.bat
if errorlevel 1 goto :failed

echo [forge-smoke] Forge was launched. Complete the eight checks above for release sign-off.
popd
exit /b 0

:missing_node
echo [forge-smoke] Node.js is not available on PATH.
echo [forge-smoke] Install the repository Node.js version, then run setup-forge-super-agent.bat.
goto :failed

:missing_npm
echo [forge-smoke] npm is not available on PATH.
echo [forge-smoke] Install the repository Node.js version, then run setup-forge-super-agent.bat.
goto :failed

:failed
echo.
echo ============================================================
echo   Forge Windows release smoke FAILED.
echo ============================================================
echo Fix the first failing check above and run smoke-forge-windows.bat again.
popd
exit /b 1
