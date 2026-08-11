@echo off
setlocal
set "FORGE_CRAWL_PORT=11235"
set "FORGE_CRAWL_CONTAINER=forge-crawl4ai"

docker version >nul 2>&1
if errorlevel 1 (
	echo Docker Desktop must be running before starting Crawl4AI.
	exit /b 1
)

docker ps --filter "name=%FORGE_CRAWL_CONTAINER%" --filter "status=running" --format "{{.Names}}" | findstr /x /c:"%FORGE_CRAWL_CONTAINER%" >nul
if not errorlevel 1 (
	echo Crawl4AI is already available at http://127.0.0.1:%FORGE_CRAWL_PORT%
	exit /b 0
)

echo Starting Crawl4AI at http://127.0.0.1:%FORGE_CRAWL_PORT% ...
docker run -d --rm --name "%FORGE_CRAWL_CONTAINER%" --shm-size=1g -p 127.0.0.1:%FORGE_CRAWL_PORT%:11235 unclecode/crawl4ai:latest
if errorlevel 1 exit /b 1

echo Crawl4AI is starting. Use Scrape Page in the Forge Browser once the service is ready.
