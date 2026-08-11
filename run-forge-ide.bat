@echo off
title Launching Forge Platform IDE...
set VSCODE_DEV=1
set VSCODE_CLI=1
set ELECTRON_ENABLE_LOGGING=1
set NODE_ENV=development

rem Automatically start the Crawl4AI local server via Docker
echo [forge] Starting Crawl4AI background service...
docker start crawl4ai >nul 2>&1 || docker run -d -p 11235:11235 --name crawl4ai unclecode/crawl4ai:all-in-one >nul 2>&1

pushd "%~dp0"
rem Validate and self-repair all core, Forge, and React runtime artifacts before launch.
call node "%~dp0scripts\forge-runtime-guard.mjs"
if errorlevel 1 (
    echo [forge-guard] Build validation failed. Electron will not be launched.
    popd
    exit /b 1
)
rem When launched without a path, open this project as the workspace so the
rem agent receives a real workspace root and can create files in it.
if "%~1"=="" (
    start "" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0." "%~dp0"
) else (
    start "" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0." %*
)
popd
