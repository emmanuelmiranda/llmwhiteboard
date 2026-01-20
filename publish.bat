@echo off
setlocal enabledelayedexpansion

echo ============================================
echo   LLM Whiteboard - Publish to GHCR
echo ============================================
echo.

:: Configuration - Update these for your repository
set GITHUB_OWNER=your-github-username
set REPO_NAME=llmwhiteboard
set REGISTRY=ghcr.io

:: Get version from argument or use 'latest'
set VERSION=%1
if "%VERSION%"=="" set VERSION=latest

:: Get component from argument
set COMPONENT=%2

:: Show help if no arguments
if "%COMPONENT%"=="" (
    echo Usage: publish.bat [version] [component]
    echo.
    echo Components:
    echo   frontend  - Build and push the Next.js frontend
    echo   backend   - Build and push the ASP.NET Core backend
    echo   all       - Build and push all components
    echo.
    echo Examples:
    echo   publish.bat latest all        - Push all with 'latest' tag
    echo   publish.bat v1.0.0 frontend   - Push frontend with 'v1.0.0' tag
    echo   publish.bat v1.0.0 backend    - Push backend with 'v1.0.0' tag
    echo   publish.bat v1.0.0 all        - Push all with 'v1.0.0' tag
    echo.
    echo Before running, update GITHUB_OWNER in this script and login:
    echo   echo YOUR_PAT ^| docker login ghcr.io -u YOUR_USERNAME --password-stdin
    echo.
    exit /b 0
)

:: Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running. Please start Docker Desktop and try again.
    exit /b 1
)

:: Check if logged into GHCR
docker pull ghcr.io/%GITHUB_OWNER%/test-auth 2>nul
echo.

echo [INFO] Publishing version: %VERSION%
echo [INFO] Registry: %REGISTRY%/%GITHUB_OWNER%
echo.

:: Publish Frontend
if "%COMPONENT%"=="frontend" goto :publish_frontend
if "%COMPONENT%"=="all" goto :publish_frontend
goto :check_backend

:publish_frontend
echo ============================================
echo   Building Frontend...
echo ============================================
set FRONTEND_IMAGE=%REGISTRY%/%GITHUB_OWNER%/%REPO_NAME%-frontend

docker build -t %FRONTEND_IMAGE%:%VERSION% -t %FRONTEND_IMAGE%:latest .

if errorlevel 1 (
    echo [ERROR] Frontend build failed.
    exit /b 1
)

echo [INFO] Pushing %FRONTEND_IMAGE%:%VERSION%...
docker push %FRONTEND_IMAGE%:%VERSION%

if "%VERSION%" neq "latest" (
    echo [INFO] Pushing %FRONTEND_IMAGE%:latest...
    docker push %FRONTEND_IMAGE%:latest
)

echo [OK] Frontend published successfully!
echo.

:check_backend
if "%COMPONENT%"=="backend" goto :publish_backend
if "%COMPONENT%"=="all" goto :publish_backend
goto :done

:publish_backend
echo ============================================
echo   Building Backend...
echo ============================================
set BACKEND_IMAGE=%REGISTRY%/%GITHUB_OWNER%/%REPO_NAME%-backend

docker build -t %BACKEND_IMAGE%:%VERSION% -t %BACKEND_IMAGE%:latest ./backend/LlmWhiteboard.Api

if errorlevel 1 (
    echo [ERROR] Backend build failed.
    exit /b 1
)

echo [INFO] Pushing %BACKEND_IMAGE%:%VERSION%...
docker push %BACKEND_IMAGE%:%VERSION%

if "%VERSION%" neq "latest" (
    echo [INFO] Pushing %BACKEND_IMAGE%:latest...
    docker push %BACKEND_IMAGE%:latest
)

echo [OK] Backend published successfully!
echo.

:done
echo ============================================
echo   Publish Complete!
echo ============================================
echo.
echo Images published to:
if "%COMPONENT%"=="frontend" echo   %REGISTRY%/%GITHUB_OWNER%/%REPO_NAME%-frontend:%VERSION%
if "%COMPONENT%"=="backend" echo   %REGISTRY%/%GITHUB_OWNER%/%REPO_NAME%-backend:%VERSION%
if "%COMPONENT%"=="all" (
    echo   %REGISTRY%/%GITHUB_OWNER%/%REPO_NAME%-frontend:%VERSION%
    echo   %REGISTRY%/%GITHUB_OWNER%/%REPO_NAME%-backend:%VERSION%
)
echo.
echo To deploy on another machine, use docker-compose.ghcr.yml:
echo   1. Copy docker-compose.ghcr.yml and .env.example to target machine
echo   2. Update .env with your settings
echo   3. Run: docker-compose -f docker-compose.ghcr.yml up -d
echo.
