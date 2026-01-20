@echo off
setlocal enabledelayedexpansion

echo ============================================
echo   LLM Whiteboard - Setup Script
echo ============================================
echo.

:: Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running. Please start Docker Desktop and try again.
    exit /b 1
)

:: Check if .env file exists
if not exist ".env" (
    echo [INFO] Creating .env file from .env.example...
    copy .env.example .env >nul

    :: Generate a random JWT key
    echo [INFO] Generating JWT secret key...
    for /f "delims=" %%i in ('powershell -Command "[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))"') do set JWT_KEY=%%i

    :: Update the .env file with the generated key
    powershell -Command "(Get-Content .env) -replace 'your-secret-key-at-least-32-characters-long-change-in-production', '!JWT_KEY!' | Set-Content .env"

    echo [INFO] JWT key generated and saved to .env
)

echo.
echo [INFO] Starting all services...
echo.

:: Build and start containers
docker-compose up -d --build

if errorlevel 1 (
    echo.
    echo [ERROR] Failed to start services. Check the error messages above.
    exit /b 1
)

echo.
echo ============================================
echo   Setup Complete!
echo ============================================
echo.
echo Services are starting up. This may take a moment...
echo.
echo   Frontend:  http://localhost:22000
echo   Backend:   http://localhost:22001
echo   Swagger:   http://localhost:22001/swagger
echo   Database:  localhost:22432
echo.
echo To view logs:     docker-compose logs -f
echo To stop:          docker-compose down
echo To reset DB:      docker-compose down -v
echo.

:: Wait for services to be ready
echo [INFO] Waiting for services to be healthy...
timeout /t 10 /nobreak >nul

:: Check if backend is responding
curl -s -o nul -w "%%{http_code}" http://localhost:22001/swagger/index.html | findstr "200" >nul
if errorlevel 1 (
    echo [WARN] Backend may still be starting. Check logs with: docker-compose logs -f backend
) else (
    echo [OK] Backend is ready!
)

echo.
echo Happy coding!
