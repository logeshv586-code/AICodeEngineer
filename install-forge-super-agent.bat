@echo off
setlocal EnableExtensions

title Forge AI - Full Super Agent Installer
pushd "%~dp0"

set "FORGE_INTEGRATIONS_HOME=%USERPROFILE%\.forge\integrations"
set "FORGE_DATA_HOME=%USERPROFILE%\.forge-ai-editor"

echo.
echo ============================================================
echo   Forge AI - Full Super Agent local source installer
echo ============================================================
echo   Source destination: %FORGE_INTEGRATIONS_HOME%
echo   Forge data:         %FORGE_DATA_HOME%
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js is required and was not found in PATH.
  popd
  exit /b 1
)

where git >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Git is required and was not found in PATH.
  popd
  exit /b 1
)

set "SETUP_FLAG="
if /I "%~1"=="setup" set "SETUP_FLAG=--setup"
if /I "%~1"=="--setup" set "SETUP_FLAG=--setup"

echo [forge] Downloading all pinned open-source integration source trees...
call node "%~dp0scripts\forge-super-agent-bootstrap.mjs" --full --browser %SETUP_FLAG%
if errorlevel 1 (
  echo.
  echo [ERROR] Forge Super Agent installation failed.
  echo Run this file again after fixing the error above.
  popd
  exit /b 1
)

echo.
echo [forge] Running strict integration self-test...
call node "%~dp0scripts\forge-super-agent-self-test.mjs" --require-all
if errorlevel 1 (
  echo.
  echo [ERROR] Source download completed, but the strict self-test failed.
  echo Run: node scripts\forge-integrations.mjs doctor
  popd
  exit /b 1
)

echo.
echo ============================================================
echo   Forge Super Agent installation complete.
echo ============================================================
echo   All source trees are under:
echo   %FORGE_INTEGRATIONS_HOME%
echo.
echo   Pull/update Forge normally with Git. The integration sources stay
echo   local and pinned independently so they do not bloat this repository.
echo.
echo   Restart Forge AI using run-forge-ide.bat.
echo.

popd
endlocal
