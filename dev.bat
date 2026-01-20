@echo off
setlocal enabledelayedexpansion

echo ============================================
echo   LLM Whiteboard - Development Mode
echo ============================================
echo.

:: Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running. Please start Docker Desktop and try again.
    exit /b 1
)

:: Start only the database
echo [INFO] Starting PostgreSQL database...
docker-compose up -d postgres

if errorlevel 1 (
    echo [ERROR] Failed to start database.
    exit /b 1
)

echo.
echo ============================================
echo   Database Started!
echo ============================================
echo.
echo PostgreSQL is running on localhost:22432
echo.
echo Connection string:
echo   Host=localhost;Port=22432;Database=llmwhiteboard;Username=llmwhiteboard;Password=llmwhiteboard
echo.
echo Now start the backend and frontend manually:
echo.
echo   Backend (Terminal 1):
echo     cd backend\LlmWhiteboard.Api
echo     dotnet run
echo.
echo   Frontend (Terminal 2):
echo     npm install
echo     npm run dev
echo.
