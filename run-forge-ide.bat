@echo off
setlocal EnableExtensions
title Launching Forge Platform IDE...
set VSCODE_DEV=1
set VSCODE_CLI=1
set ELECTRON_ENABLE_LOGGING=1
set NODE_ENV=development

pushd "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
    echo [forge] Node.js is not available on PATH.
    echo [forge] Install the repository Node.js version, then run setup-forge-super-agent.bat.
    popd
    exit /b 1
)

rem Crawl4AI is an optional local crawl accelerator. Forge browser tasks use
rem the Playwright Chromium runtime installed by setup-forge-super-agent.bat,
rem so Docker must never be a hard startup dependency.
where docker >nul 2>&1
if errorlevel 1 (
    echo [forge] Docker not found - optional Crawl4AI service skipped.
) else (
    echo [forge] Starting optional Crawl4AI background service...
    docker start crawl4ai >nul 2>&1
    if errorlevel 1 (
        docker run -d -p 11235:11235 --name crawl4ai unclecode/crawl4ai:all-in-one >nul 2>&1
        if errorlevel 1 echo [forge] Crawl4AI could not start. Continuing with the built-in Playwright browser runtime.
    )
)

rem Keep the native Forge Super Agent MCP registered. This is local-only and
rem does not install heavyweight third-party integrations on every launch.
call node "%~dp0scripts\forge-integrations.mjs" bootstrap-mcp
if errorlevel 1 (
    echo [forge-super-agent] MCP bootstrap failed. Continuing with built-in tools only.
)

rem Start the lightweight local Work Mode scheduler. It de-duplicates itself
rem with a PID file and queues prompt/approval workflows under %%USERPROFILE%%\.forge\work.
start "Forge Work Scheduler" /B node "%~dp0scripts\forge-work-daemon.mjs" >nul 2>&1

rem Verify the integrations active in this phase. Agent Lightning is deferred
rem until the later GPU/RL training phase and is not required for normal startup.
call node "%~dp0scripts\forge-integrations.mjs" verify active >nul 2>&1
if errorlevel 1 (
    echo [forge-super-agent] Active integrations are not fully installed.
    echo [forge-super-agent] Run setup-forge-super-agent.bat once to install them under %%USERPROFILE%%\.forge\integrations.
)

rem Validate and self-repair all core, Forge, React, skill, and Super Agent runtime artifacts before launch.
call node "%~dp0scripts\forge-runtime-guard.mjs"
if errorlevel 1 (
    echo [forge-guard] Build validation failed. Electron will not be launched.
    popd
    exit /b 1
)

set "FORGE_ELECTRON=%~dp0node_modules\electron\dist\electron.exe"
if not exist "%FORGE_ELECTRON%" (
    echo [forge] Electron runtime is missing: %FORGE_ELECTRON%
    echo [forge] Run setup-forge-super-agent.bat to restore dependencies and validate the build.
    popd
    exit /b 1
)

rem When launched without a path, open this project as the workspace so the
rem agent receives a real workspace root and can create files in it.
if "%~1"=="" (
    start "" "%FORGE_ELECTRON%" "%~dp0." "%~dp0"
) else (
    start "" "%FORGE_ELECTRON%" "%~dp0." %*
)

popd
exit /b 0
