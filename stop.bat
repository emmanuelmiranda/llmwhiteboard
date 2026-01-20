@echo off
echo ============================================
echo   LLM Whiteboard - Stopping Services
echo ============================================
echo.

docker-compose down

echo.
echo [OK] All services stopped.
echo.
echo To also remove data volumes, run:
echo   docker-compose down -v
echo.
