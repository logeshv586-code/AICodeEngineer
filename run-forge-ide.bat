@echo off
title Launching Forge Platform IDE...
set VSCODE_DEV=1
set VSCODE_CLI=1
set ELECTRON_ENABLE_LOGGING=1
set NODE_ENV=development
pushd "%~dp0"
rem Validate and self-repair all core, Forge, and React runtime artifacts before launch.
call node "%~dp0scripts\forge-runtime-guard.mjs"
if errorlevel 1 (
    echo [forge-guard] Build validation failed. Electron will not be launched.
    popd
    exit /b 1
)
start "" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0." %*
popd
