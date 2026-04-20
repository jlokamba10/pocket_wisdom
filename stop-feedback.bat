@echo off
setlocal

cd /d "%~dp0infra\docker"
if errorlevel 1 (
  echo Could not find infra\docker folder.
  pause
  exit /b 1
)

echo Stopping PocketWisdom containers...
docker compose down
if errorlevel 1 (
  echo Something failed while stopping containers.
  pause
  exit /b 1
)

echo.
echo PocketWisdom is stopped.
pause
exit /b 0
