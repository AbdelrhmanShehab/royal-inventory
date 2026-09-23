@echo off
echo ========================================================
echo   Royal Inventory ERP - Offline Server Deployment
echo   Server Target: 192.168.50.5 (Offline / Air-Gapped)
echo ========================================================
echo.

cd /d "%~dp0"

echo Step 1: Building Production Frontend bundle...
call npm run build

echo.
echo Step 2: Stopping existing background Node processes...
taskkill /FI "WINDOWTITLE eq Royal Backend*" /F /T >nul 2>&1
taskkill /FI "WINDOWTITLE eq Royal Frontend*" /F /T >nul 2>&1

echo.
echo Step 3: Starting Backend Server (Port 7575)...
set PORT=7575
start "Royal Backend" /min cmd /c "set PORT=7575 && cd /d %~dp0Royal_inventory && node src/server.js"

echo.
echo Step 4: Starting Frontend Server (Port 5173)...
start "Royal Frontend" /min node node_modules/vite/bin/vite.js preview --host 0.0.0.0 --port 5173

echo.
echo ========================================================
echo   DEPLOYMENT COMPLETED SUCCESSFULLY! (OFFLINE MODE)
echo   Frontend Access: http://192.168.50.5:5173
echo   Backend API:      http://192.168.50.5:7575/api/v1
echo ========================================================
echo.
pause
