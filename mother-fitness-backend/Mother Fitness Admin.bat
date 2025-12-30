@echo off
TITLE Mother Fitness Admin - Starting Services
echo ==================================================
echo   MOTHER FITNESS GYM MANAGEMENT SYSTEM
echo ==================================================
echo.

:: Check for node_modules
if not exist "node_modules\" (
    echo [INFO] First time setup: Installing dependencies...
    call npm install
)

:: Clear stale node processes on port 5000 (standard port)
echo [INFO] Searching for active server on port 5000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr LISTENING ^| findstr :5000') do (
    echo [INFO] Found process %%a on port 5000. Terminating...
    taskkill /f /pid %%a >nul 2>&1
)

:: Aggressive cleanup: Kill all node and electron orphans
echo [INFO] Performing deep cleanup of background node/electron processes...
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im electron.exe >nul 2>&1

:: Wait for system to release port
echo [INFO] Waiting for system to release port...
timeout /t 3 /nobreak >nul

:: Start the application
echo [INFO] Starting Application UI and Local Server...
echo [INFO] Please keep this window minimized while using the app.
echo.
npm run electron:dev

pause
