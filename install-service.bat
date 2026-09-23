@echo off
setlocal EnableDelayedExpansion

title Inventory Tracking System - Service Installer

echo ================================================================
echo   Inventory Tracking System - Windows Service Installer
echo   Production Service Setup
echo ================================================================
echo.

:: 1. Ensure running from the directory of this batch file
cd /d "%~dp0"

:: 2. Check for Administrator Privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Administrator privileges are required to install Windows Services.
    echo.
    echo Please right-click "install-service.bat" and select:
    echo    "Run as administrator"
    echo.
    echo Press any key to exit...
    pause >nul
    exit /b 1
)

:: 3. Validate deployment directory structure and required files
echo [1/6] Validating deployment files...

if not exist "runtime\node.exe" (
    echo [ERROR] Missing portable Node.js runtime: runtime\node.exe
    echo The deployment folder appears incomplete.
    echo.
    echo Press any key to exit...
    pause >nul
    exit /b 1
)

if not exist "tools\nssm.exe" (
    echo [ERROR] Missing service manager: tools\nssm.exe
    echo The deployment folder appears incomplete.
    echo.
    echo Press any key to exit...
    pause >nul
    exit /b 1
)

if not exist "app\src\server.js" (
    echo [ERROR] Missing application entry point: app\src\server.js
    echo Please ensure the "app" folder is present.
    echo.
    echo Press any key to exit...
    pause >nul
    exit /b 1
)

:: Ensure data\logs directory exists
if not exist "data\logs" (
    mkdir "data\logs" >nul 2>&1
)

:: Ensure app\.env exists
if not exist "app\.env" (
    if exist "app\.env.example" (
        echo [INFO] app\.env not found. Creating from app\.env.example...
        copy /y "app\.env.example" "app\.env" >nul
        echo [WARNING] Default configuration copied to app\.env.
    ) else if exist ".env.example" (
        copy /y ".env.example" "app\.env" >nul
    )
)

:: Extract PORT from app\.env if present, default to 7575
set APP_PORT=7575
if exist "app\.env" (
    for /f "tokens=1,2 delims==" %%A in ('findstr /i "^PORT=" app\.env 2^>nul') do (
        set APP_PORT=%%B
    )
)

set SERVICE_NAME=inventory_tracking_system
set OLD_SERVICE_NAME=AQSA-ERP
set NSSM="%~dp0tools\nssm.exe"
set NODE_EXE="%~dp0runtime\node.exe"
set APP_DIR=%~dp0app
set STDOUT_LOG="%~dp0data\logs\service-stdout.log"
set STDERR_LOG="%~dp0data\logs\service-stderr.log"

:: 4. Clean up old service name if it was previously registered
sc.exe query %OLD_SERVICE_NAME% >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] Detected old service "%OLD_SERVICE_NAME%". Removing it cleanly...
    %NSSM% stop %OLD_SERVICE_NAME% >nul 2>&1
    ping 127.0.0.1 -n 2 >nul
    %NSSM% remove %OLD_SERVICE_NAME% confirm >nul 2>&1
)

:: 5. Check if target service already exists
echo [2/6] Checking service status...
sc.exe query %SERVICE_NAME% >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] Service "%SERVICE_NAME%" already exists. Stopping for reconfiguration...
    %NSSM% stop %SERVICE_NAME% >nul 2>&1
    ping 127.0.0.1 -n 3 >nul
) else (
    echo [INFO] Registering Windows Service "%SERVICE_NAME%"...
    %NSSM% install %SERVICE_NAME% %NODE_EXE% "src\server.js"
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to register service "%SERVICE_NAME%".
        echo.
        echo Press any key to exit...
        pause >nul
        exit /b 1
    )
)

:: 6. Configure service parameters
echo [3/6] Configuring service parameters...
%NSSM% set %SERVICE_NAME% Application %NODE_EXE% >nul
%NSSM% set %SERVICE_NAME% AppParameters "src\server.js" >nul
%NSSM% set %SERVICE_NAME% AppDirectory "%APP_DIR%" >nul
%NSSM% set %SERVICE_NAME% DisplayName "Inventory Tracking System" >nul
%NSSM% set %SERVICE_NAME% Description "Inventory Tracking System & Laundry Production Service" >nul
%NSSM% set %SERVICE_NAME% Start SERVICE_AUTO_START >nul
%NSSM% set %SERVICE_NAME% AppStdout %STDOUT_LOG% >nul
%NSSM% set %SERVICE_NAME% AppStderr %STDERR_LOG% >nul
%NSSM% set %SERVICE_NAME% AppStdoutCreationDisposition 4 >nul
%NSSM% set %SERVICE_NAME% AppStderrCreationDisposition 4 >nul
%NSSM% set %SERVICE_NAME% AppRotateFiles 1 >nul
%NSSM% set %SERVICE_NAME% AppRotateOnline 1 >nul
%NSSM% set %SERVICE_NAME% AppRotateSeconds 86400 >nul
%NSSM% set %SERVICE_NAME% AppRotateBytes 10485760 >nul
%NSSM% set %SERVICE_NAME% AppRestartDelay 5000 >nul
%NSSM% set %SERVICE_NAME% AppThrottle 1500 >nul
%NSSM% set %SERVICE_NAME% AppEnvironmentExtra "NODE_ENV=production" >nul

:: 7. Configure Windows Firewall
echo [4/6] Configuring Windows Firewall for port %APP_PORT%...
netsh advfirewall firewall show rule name="Inventory-Tracking-Port-%APP_PORT%" >nul 2>&1
if %errorlevel% neq 0 (
    netsh advfirewall firewall add rule name="Inventory-Tracking-Port-%APP_PORT%" dir=in action=allow protocol=TCP localport=%APP_PORT% >nul 2>&1
    echo [INFO] Inbound firewall rule added for port %APP_PORT%.
) else (
    echo [INFO] Firewall rule for port %APP_PORT% is active.
)

:: 8. Start Service
echo [5/6] Starting service "%SERVICE_NAME%"...
%NSSM% start %SERVICE_NAME% >nul 2>&1

:: 9. Verify Service
echo [6/6] Verifying service state...
ping 127.0.0.1 -n 4 >nul

set SERVICE_STATUS=UNKNOWN
for /f "tokens=*" %%S in ('%NSSM% status %SERVICE_NAME% 2^>nul') do (
    set SERVICE_STATUS=%%S
)

echo.
echo ================================================================
if /i "!SERVICE_STATUS!"=="SERVICE_RUNNING" (
    echo [SUCCESS] Service "%SERVICE_NAME%" is RUNNING!
    echo.
    echo   Local Access:    http://localhost:%APP_PORT%/
    echo   Network Access:  http://^<SERVER_IP^>:%APP_PORT%/
    echo.
    echo   IMPORTANT: The application runs on PORT %APP_PORT% (NOT 5173).
    echo              Node.js serves BOTH the React Frontend and Backend API
    echo              on port %APP_PORT%.
    echo.
    echo   Service Name:    %SERVICE_NAME%
    echo   Display Name:    Inventory Tracking System
    echo   Startup Type:    Automatic (starts on Windows boot)
    echo   Crash Recovery:  Automatic restart enabled (5s delay)
    echo   Service Logs:    %~dp0data\logs\
    echo ================================================================
) else (
    echo [WARNING] Service status is currently: !SERVICE_STATUS!
    echo.
    echo If the service is still starting up, wait a few moments and re-check.
    echo If it failed to start, inspect the startup logs:
    echo   - %~dp0data\logs\service-stderr.log
    echo   - %~dp0data\logs\service-stdout.log
    echo   - %~dp0data\logs\error-*.log
    echo ================================================================
)
echo.
echo Press any key to close this window...
pause >nul
exit /b 0
