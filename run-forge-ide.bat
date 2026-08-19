@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Launching Forge Platform IDE...
set VSCODE_DEV=1
set VSCODE_CLI=1
set ELECTRON_ENABLE_LOGGING=1
set NODE_ENV=development

pushd "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
    echo [forge] A bootstrap Node.js runtime is not available on PATH.
    echo [forge] Run setup-forge-super-agent.bat from Command Prompt, or .\setup-forge-super-agent.bat from PowerShell.
    popd
    exit /b 1
)

set "FORGE_NODE="
for /f "delims=" %%P in ('node scripts\forge-node20-runtime.mjs ensure') do set "FORGE_NODE=%%P"
if not defined FORGE_NODE (
    echo [forge] Could not resolve the pinned Forge Node runtime.
    echo [forge] Repair with .\setup-forge-super-agent.bat from PowerShell.
    popd
    exit /b 1
)
if not exist "!FORGE_NODE!" (
    echo [forge] Pinned Forge Node runtime is missing: !FORGE_NODE!
    popd
    exit /b 1
)
for %%I in ("!FORGE_NODE!") do set "FORGE_NODE_HOME=%%~dpI"
set "PATH=!FORGE_NODE_HOME!;!PATH!"
for /f "delims=" %%V in ('"!FORGE_NODE!" --version') do set "FORGE_NODE_VERSION=%%V"
echo [forge] Runtime locked to !FORGE_NODE_VERSION!.

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
"!FORGE_NODE!" "%~dp0scripts\forge-integrations.mjs" bootstrap-mcp
if errorlevel 1 (
    echo [forge-super-agent] MCP bootstrap failed. Continuing with built-in tools only.
)

rem Start the lightweight local Work Mode scheduler. It de-duplicates itself
rem with a PID file and queues prompt/approval workflows under %%USERPROFILE%%\.forge\work.
start "Forge Work Scheduler" /B "!FORGE_NODE!" "%~dp0scripts\forge-work-daemon.mjs" >nul 2>&1

rem Verify the integrations active in this phase. Agent Lightning is deferred
rem until the later GPU/RL training phase and is not required for normal startup.
"!FORGE_NODE!" "%~dp0scripts\forge-integrations.mjs" verify active >nul 2>&1
if errorlevel 1 (
    echo [forge-super-agent] Active integrations are not fully installed.
    echo [forge-super-agent] Run setup-forge-super-agent.bat from Command Prompt, or .\setup-forge-super-agent.bat from PowerShell.
    echo [forge-super-agent] Integrations install under %%USERPROFILE%%\.forge\integrations.
)

rem Validate and self-repair all core, Forge, React, skill, and Super Agent runtime artifacts before launch.
"!FORGE_NODE!" "%~dp0scripts\forge-runtime-guard.mjs"
if errorlevel 1 (
    echo [forge-guard] Build validation failed. Electron will not be launched.
    echo [forge-guard] From PowerShell, repair with: .\setup-forge-super-agent.bat
    popd
    exit /b 1
)

set "FORGE_ELECTRON=%~dp0node_modules\electron\dist\electron.exe"
if not exist "%FORGE_ELECTRON%" (
    echo [forge] Electron runtime is missing: %FORGE_ELECTRON%
    echo [forge] Run setup-forge-super-agent.bat from Command Prompt, or .\setup-forge-super-agent.bat from PowerShell.
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
