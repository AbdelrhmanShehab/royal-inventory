@echo off
setlocal EnableDelayedExpansion

set "NO_PAUSE="
if "%~1"=="--no-pause" set NO_PAUSE=1
if "%~2"=="--no-pause" set NO_PAUSE=1

title Inventory Tracking System - Production Packager

echo ================================================================
echo   Inventory Tracking System - Deployment Packager (update.bat)
echo   Production Release Builder
echo ================================================================
echo.

cd /d "%~dp0"

:: -------------------------------------------------------------------
:: Check execution context:
:: If run from an already-deployed folder (where app\src\server.js exists
:: but root package.json does not exist):
:: -------------------------------------------------------------------
if not exist "package.json" (
    if exist "app\src\server.js" (
        echo [INFO] Detected execution inside deployment directory on target machine.
        echo [INFO] Restarting Windows Service "inventory_tracking_system"...
        if exist "tools\nssm.exe" (
            tools\nssm.exe restart inventory_tracking_system
            ping 127.0.0.1 -n 4 >nul
            tools\nssm.exe status inventory_tracking_system
        ) else (
            net stop inventory_tracking_system >nul 2>&1
            net start inventory_tracking_system >nul 2>&1
        )
        echo.
        echo Service update complete.
        if not defined NO_PAUSE pause
        exit /b 0
    )
)

:: -------------------------------------------------------------------
:: Development packaging workflow
:: -------------------------------------------------------------------

:: 1. Validate prerequisites
echo [1/10] Validating development prerequisites...

where node.exe >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] node.exe was not found in PATH on this development machine.
    if not defined NO_PAUSE pause
    exit /b 1
)

where npm.cmd >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm was not found in PATH on this development machine.
    if not defined NO_PAUSE pause
    exit /b 1
)

if not exist "tools\bin\nssm.exe" (
    echo [INFO] tools\bin\nssm.exe not found. Downloading NSSM 64-bit...
    powershell -ExecutionPolicy Bypass -File tools\acquire_nssm.ps1
    if not exist "tools\bin\nssm.exe" (
        echo [ERROR] Failed to acquire tools\bin\nssm.exe.
        if not defined NO_PAUSE pause
        exit /b 1
    )
)

:: Locate node.exe binary path
set NODE_BIN=
for /f "delims=" %%I in ('where node.exe 2^>nul') do (
    if not defined NODE_BIN set NODE_BIN=%%I
)
if not defined NODE_BIN (
    if exist "C:\Program Files\nodejs\node.exe" (
        set NODE_BIN=C:\Program Files\nodejs\node.exe
    ) else (
        echo [ERROR] Could not determine absolute path to node.exe.
        if not defined NO_PAUSE pause
        exit /b 1
    )
)
echo [OK] Using Node runtime: "%NODE_BIN%"

:: 2. Stop service on dev machine if currently running
echo [2/10] Checking if service or deploy processes are running...
sc.exe query inventory_tracking_system >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] Stopping running inventory_tracking_system service...
    tools\bin\nssm.exe stop inventory_tracking_system >nul 2>&1
    ping 127.0.0.1 -n 3 >nul
)
sc.exe query AQSA-ERP >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] Stopping old AQSA-ERP service...
    tools\bin\nssm.exe stop AQSA-ERP >nul 2>&1
    ping 127.0.0.1 -n 2 >nul
)
powershell -NoProfile -Command "Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.ExecutablePath -like '*\deploy\runtime\node.exe*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" >nul 2>&1

:: 3. Backup previous deployment configuration if present
set BACKUP_ENV=%TEMP%\aqsa_deploy_env_%RANDOM%.tmp
if exist "deploy\app\.env" (
    echo [INFO] Preserving existing deploy\app\.env configuration...
    copy /y "deploy\app\.env" "%BACKUP_ENV%" >nul
)

:: 4. Build React Frontend for Production
echo [3/10] Building React frontend bundle (Vite + React)...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] React build failed!
    if not defined NO_PAUSE pause
    exit /b 1
)

if not exist "dist\index.html" (
    echo [ERROR] dist\index.html was not generated!
    if not defined NO_PAUSE pause
    exit /b 1
)
echo [OK] React production bundle generated successfully.

:: 5. Prepare clean deployment directory structure
echo [4/10] Initializing clean deploy/ directory...
if exist "deploy\" (
    rmdir /s /q "deploy" >nul 2>&1
    if exist "deploy\" (
        echo [WARNING] Some files in deploy\ were locked. Attempting force removal...
        powershell -NoProfile -Command "Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.ExecutablePath -like '*\deploy\*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" >nul 2>&1
        ping 127.0.0.1 -n 3 >nul
        rmdir /s /q "deploy" >nul 2>&1
    )
)

mkdir "deploy\runtime" >nul 2>&1
mkdir "deploy\tools" >nul 2>&1
mkdir "deploy\data\logs" >nul 2>&1
mkdir "deploy\app\src" >nul 2>&1
mkdir "deploy\app\public" >nul 2>&1
mkdir "deploy\app\migrations" >nul 2>&1
mkdir "deploy\app\scripts" >nul 2>&1

:: 6. Package portable Node.js runtime and NSSM
echo [5/10] Packaging portable Node.js runtime and service supervisor...
copy /y "%NODE_BIN%" "deploy\runtime\node.exe" >nul
if not exist "deploy\runtime\node.exe" (
    echo [ERROR] Failed to copy node.exe to deploy\runtime\
    if not defined NO_PAUSE pause
    exit /b 1
)

copy /y "tools\bin\nssm.exe" "deploy\tools\nssm.exe" >nul
if not exist "deploy\tools\nssm.exe" (
    echo [ERROR] Failed to copy nssm.exe to deploy\tools\
    if not defined NO_PAUSE pause
    exit /b 1
)

:: 7. Package React frontend static files
echo [6/10] Copying React production assets into deploy\app\public...
robocopy "dist" "deploy\app\public" /E /NFL /NDL /NJH /NJS /nc /ns /np >nul
if %errorlevel% geq 8 (
    echo [ERROR] Robocopy failed copying frontend assets.
    if not defined NO_PAUSE pause
    exit /b 1
)

:: 8. Package Backend Application Files
echo [7/10] Packaging backend application code...
robocopy "Royal_inventory\src" "deploy\app\src" /E /NFL /NDL /NJH /NJS /nc /ns /np >nul
if %errorlevel% geq 8 (
    echo [ERROR] Robocopy failed copying backend source.
    if not defined NO_PAUSE pause
    exit /b 1
)

robocopy "Royal_inventory\migrations" "deploy\app\migrations" /E /NFL /NDL /NJH /NJS /nc /ns /np >nul
robocopy "Royal_inventory\scripts" "deploy\app\scripts" /E /NFL /NDL /NJH /NJS /nc /ns /np >nul
copy /y "Royal_inventory\package.json" "deploy\app\package.json" >nul

:: 9. Package Production Dependencies
echo [8/10] Packaging production dependencies...
if not exist "Royal_inventory\node_modules\" (
    echo [INFO] Royal_inventory\node_modules not found. Installing production dependencies...
    cd Royal_inventory
    call npm install --omit=dev
    cd ..
)

echo Copying runtime node_modules (excluding development packages)...
robocopy "Royal_inventory\node_modules" "deploy\app\node_modules" /E /XD nodemon /XF *.ts *.map /NFL /NDL /NJH /NJS /nc /ns /np >nul

:: Clean any nodemon bin references
if exist "deploy\app\node_modules\.bin\nodemon*" (
    del /f /q "deploy\app\node_modules\.bin\nodemon*" >nul 2>&1
)

:: 10. Configure Environment and Service Scripts
echo [9/10] Configuring environment and deployment scripts...

:: Generate .env.example template
(
echo PORT=7575
echo NODE_ENV=production
echo APP_NAME=inventory_tracking_system
echo API_PREFIX=/api/v1
echo JWT_ACCESS_SECRET=royal_inventory_access_secret_key_32bytes_long_min_ok!
echo JWT_REFRESH_SECRET=royal_inventory_refresh_secret_key_32bytes_long_min_ok!
echo ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
echo.
echo # Database Connections
echo SYSTEM_DB_SERVER=192.168.50.5
echo SYSTEM_DB_PORT=1433
echo SYSTEM_DB_NAME=InventoryOps
echo SYSTEM_DB_USER=sa
echo SYSTEM_DB_PASSWORD=comsys@123
echo SYSTEM_DB_ENCRYPT=false
echo SYSTEM_DB_TRUST_CERT=true
echo OPS_SCHEMA=ops
echo.
echo COMSYS_DB_SERVER=192.168.50.1
echo COMSYS_DB_PORT=1433
echo COMSYS_DB_NAME=FHtlPTrain
echo COMSYS_DB_USER=sa
echo COMSYS_DB_PASSWORD=123
echo COMSYS_DB_ENCRYPT=false
echo COMSYS_DB_TRUST_CERT=true
echo.
echo ZK_DB_SERVER=192.168.50.1
echo ZK_DB_PORT=1433
echo ZK_DB_NAME=FHtlPTrain
echo ZK_DB_USER=sa
echo ZK_DB_PASSWORD=123
echo ZK_DB_ENCRYPT=false
echo ZK_DB_TRUST_CERT=true
echo.
echo # Production Runtime Paths
echo CORS_ORIGIN=*
echo RATE_LIMIT_WINDOW_MS=900000
echo RATE_LIMIT_MAX_REQUESTS=10000
echo AUTH_RATE_LIMIT_MAX=500
echo LOG_DIR=../data/logs
echo CLIENT_BUILD_PATH=./public
) > "deploy\app\.env.example"

:: Restore backed up .env if existed, otherwise use template
if exist "%BACKUP_ENV%" (
    echo [INFO] Restoring previous deploy\app\.env configuration...
    copy /y "%BACKUP_ENV%" "deploy\app\.env" >nul
    del /f /q "%BACKUP_ENV%" >nul 2>&1
) else if exist "Royal_inventory\.env" (
    echo [INFO] Initializing deploy\app\.env from Royal_inventory\.env...
    copy /y "Royal_inventory\.env" "deploy\app\.env" >nul
    :: Ensure LOG_DIR and CLIENT_BUILD_PATH are set for portable deployment
    findstr /i "^LOG_DIR=" "deploy\app\.env" >nul || echo LOG_DIR=../data/logs>> "deploy\app\.env"
    findstr /i "^CLIENT_BUILD_PATH=" "deploy\app\.env" >nul || echo CLIENT_BUILD_PATH=./public>> "deploy\app\.env"
) else (
    copy /y "deploy\app\.env.example" "deploy\app\.env" >nul
)

:: Copy service scripts into deploy/
copy /y "install-service.bat" "deploy\install-service.bat" >nul
copy /y "uninstall-service.bat" "deploy\uninstall-service.bat" >nul
copy /y "update.bat" "deploy\update.bat" >nul
if exist "DEPLOYMENT.md" copy /y "DEPLOYMENT.md" "deploy\DEPLOYMENT.md" >nul

:: Create empty .gitkeep in logs directory
echo. > "deploy\data\logs\.gitkeep"

:: 11. Run Smoke Test using packaged runtime
echo [10/11] Performing standalone smoke test with packaged runtime...
pushd "deploy\app"
"..\runtime\node.exe" -e "const app = require('./src/app'); console.log('SMOKE_TEST_PASSED'); process.exit(0);" >nul 2>&1
set SMOKE_ERR=%errorlevel%
popd
if %SMOKE_ERR% neq 0 (
    echo [ERROR] Smoke test failed! The packaged application could not load cleanly.
    if not defined NO_PAUSE pause
    exit /b 1
)
echo [OK] Deployment smoke test passed successfully!

:: 12. Create deploy.zip for ultra-fast network transfer
echo [11/11] Generating portable deploy.zip for fast network transfer...
powershell -NoProfile -Command "if (Test-Path 'deploy.zip') { Remove-Item 'deploy.zip' -Force }; Compress-Archive -Path 'deploy\*' -DestinationPath 'deploy.zip' -Force"
if exist "deploy.zip" (
    echo [OK] deploy.zip created successfully.
)

echo.
echo ================================================================
echo   DEPLOYMENT PACKAGE GENERATED SUCCESSFULLY!
echo ================================================================
echo.
echo   Folder:  %CD%\deploy
echo   Zip:     %CD%\deploy.zip (~42 MB)
echo.
echo   FAST TRANSFER TIP:
echo     Copy "deploy.zip" to the server (takes ~5 seconds over network).
echo     Extract it on the server, open the folder, and run:
echo     install-service.bat (as Administrator)
echo.
echo   Access:
echo     http://localhost:7575/
echo     http://<SERVER_IP>:7575/
echo     (Note: Unified production port is 7575, NOT 5173).
echo.
echo ================================================================
echo.
if not defined NO_PAUSE pause
exit /b 0
