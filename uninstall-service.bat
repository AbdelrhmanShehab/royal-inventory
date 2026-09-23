@echo off
setlocal EnableDelayedExpansion

title Inventory Tracking System - Service Uninstaller

echo ================================================================
echo   Inventory Tracking System - Service Uninstaller
echo   Clean Service Removal
echo ================================================================
echo.

cd /d "%~dp0"

:: Check Administrator Privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Administrator privileges are required to remove Windows Services.
    echo.
    echo Please right-click "uninstall-service.bat" and select:
    echo    "Run as administrator"
    echo.
    echo Press any key to exit...
    pause >nul
    exit /b 1
)

set SERVICE_NAME=inventory_tracking_system
set OLD_SERVICE_NAME=AQSA-ERP
set NSSM="%~dp0tools\nssm.exe"

echo [1/2] Stopping and removing services...

:: Remove inventory_tracking_system
sc.exe query %SERVICE_NAME% >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] Stopping service "%SERVICE_NAME%"...
    if exist %NSSM% (
        %NSSM% stop %SERVICE_NAME% >nul 2>&1
        ping 127.0.0.1 -n 2 >nul
        %NSSM% remove %SERVICE_NAME% confirm >nul 2>&1
    ) else (
        sc.exe stop %SERVICE_NAME% >nul 2>&1
        ping 127.0.0.1 -n 2 >nul
        sc.exe delete %SERVICE_NAME% >nul 2>&1
    )
    echo [OK] Removed "%SERVICE_NAME%".
) else (
    echo [INFO] Service "%SERVICE_NAME%" is not installed.
)

:: Clean up old service name if present
sc.exe query %OLD_SERVICE_NAME% >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] Stopping old service "%OLD_SERVICE_NAME%"...
    if exist %NSSM% (
        %NSSM% stop %OLD_SERVICE_NAME% >nul 2>&1
        ping 127.0.0.1 -n 2 >nul
        %NSSM% remove %OLD_SERVICE_NAME% confirm >nul 2>&1
    ) else (
        sc.exe stop %OLD_SERVICE_NAME% >nul 2>&1
        ping 127.0.0.1 -n 2 >nul
        sc.exe delete %OLD_SERVICE_NAME% >nul 2>&1
    )
    echo [OK] Removed "%OLD_SERVICE_NAME%".
)

echo [2/2] Cleaning up firewall rules...
netsh advfirewall firewall delete rule name="Inventory-Tracking-Port-7575" >nul 2>&1

echo.
echo ================================================================
echo [SUCCESS] Service removal completed.
echo Application files, database, and logs have been preserved.
echo ================================================================
echo.
echo Press any key to close this window...
pause >nul
exit /b 0
