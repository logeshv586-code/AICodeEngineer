@echo off
title Launching Forge Platform IDE...
set VSCODE_DEV=1
set VSCODE_CLI=1
set ELECTRON_ENABLE_LOGGING=1
set NODE_ENV=development
pushd "%~dp0"
rem The core compiler clears out/, so the React bundles must be rebuilt after it.
if not exist "%~dp0out\vs\workbench\workbench.desktop.main.js" call npm.cmd run compile
call npm.cmd run buildreact
start "" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0." %*
popd
