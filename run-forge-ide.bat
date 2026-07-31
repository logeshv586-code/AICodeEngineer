@echo off
title Launching Forge Platform IDE...
set VSCODE_DEV=1
set VSCODE_CLI=1
set ELECTRON_ENABLE_LOGGING=1
set NODE_ENV=development
pushd "%~dp0"
start "" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0." %*
popd
