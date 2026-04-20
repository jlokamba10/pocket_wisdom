@echo off
setlocal

set MAX_RETRIES=24
set RETRY_WAIT_SECONDS=5

cd /d "%~dp0infra\docker"
if errorlevel 1 (
  echo Could not find infra\docker folder.
  pause
  exit /b 1
)

echo Starting PocketWisdom containers...
docker compose up --build -d
if errorlevel 1 goto :error

echo.
echo Preparing demo database (this may take a few minutes on first run)...
set attempt=1

:migrate
docker compose exec admin alembic -c /app/alembic.ini upgrade head
if not errorlevel 1 goto :seed

if %attempt% GEQ %MAX_RETRIES% goto :error
echo Waiting for services to be ready... ^(attempt %attempt% of %MAX_RETRIES%^)
timeout /t %RETRY_WAIT_SECONDS% >nul
set /a attempt+=1
goto :migrate

:seed
set attempt=1

:seed_retry
docker compose exec admin python -m app.seed
if not errorlevel 1 goto :ready

if %attempt% GEQ %MAX_RETRIES% goto :error
echo Finishing setup... ^(attempt %attempt% of %MAX_RETRIES%^)
timeout /t %RETRY_WAIT_SECONDS% >nul
set /a attempt+=1
goto :seed_retry

:ready
echo.
echo PocketWisdom is ready.
echo.
echo Open these in your browser:
echo UI: http://localhost:5173
echo Grafana: http://localhost:3000

echo.
echo Login details for the app UI:
echo Email: sysadmin@pocketwisdom.local
echo Password: Admin123!

echo.
echo To stop everything later, double-click stop-feedback.bat
pause
exit /b 0

:error
echo.
echo Something failed while starting the system.
echo Please make sure Docker Desktop is running, then try again.
pause
exit /b 1
