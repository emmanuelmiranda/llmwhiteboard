@echo off
setlocal enabledelayedexpansion

echo ============================================
echo   LLM Whiteboard - Deploy to Remote Machine
echo ============================================
echo.

:: Configuration - Update these for your deployment
set GITHUB_OWNER=your-github-username
set REMOTE_USER=your-ssh-user
set REMOTE_HOST=your-remote-host
set REMOTE_PATH=/opt/llmwhiteboard
set VERSION=%1

if "%VERSION%"=="" set VERSION=latest

echo This script helps deploy LLM Whiteboard to a remote machine via SSH.
echo.
echo Prerequisites on the remote machine:
echo   - Docker and Docker Compose installed
echo   - SSH access configured
echo   - GHCR authentication configured
echo.
echo Current configuration:
echo   Remote: %REMOTE_USER%@%REMOTE_HOST%:%REMOTE_PATH%
echo   Version: %VERSION%
echo   GitHub Owner: %GITHUB_OWNER%
echo.
echo Press Ctrl+C to cancel or any key to continue...
pause >nul

echo.
echo [1/4] Creating remote directory...
ssh %REMOTE_USER%@%REMOTE_HOST% "mkdir -p %REMOTE_PATH%"

echo.
echo [2/4] Copying deployment files...
scp docker-compose.ghcr.yml %REMOTE_USER%@%REMOTE_HOST%:%REMOTE_PATH%/docker-compose.yml
scp .env.production.example %REMOTE_USER%@%REMOTE_HOST%:%REMOTE_PATH%/.env.example

echo.
echo [3/4] Updating docker-compose.yml with correct GitHub owner...
ssh %REMOTE_USER%@%REMOTE_HOST% "cd %REMOTE_PATH% && sed -i 's/your-github-username/%GITHUB_OWNER%/g' docker-compose.yml"

echo.
echo ============================================
echo   Files Deployed!
echo ============================================
echo.
echo Next steps on the remote machine (%REMOTE_HOST%):
echo.
echo   1. SSH into the machine:
echo      ssh %REMOTE_USER%@%REMOTE_HOST%
echo.
echo   2. Navigate to the deployment directory:
echo      cd %REMOTE_PATH%
echo.
echo   3. Configure environment:
echo      cp .env.example .env
echo      nano .env  # Edit with your settings
echo.
echo   4. Login to GitHub Container Registry:
echo      echo YOUR_GITHUB_PAT ^| docker login ghcr.io -u %GITHUB_OWNER% --password-stdin
echo.
echo   5. Pull and start the containers:
echo      docker-compose pull
echo      docker-compose up -d
echo.
echo   6. View logs:
echo      docker-compose logs -f
echo.
