@echo off
setlocal EnableDelayedExpansion

title Royal Inventory ERP - Automated Server Deployment (192.168.50.5:7575)

cd /d "%~dp0"

set "DEPLOY_MODE=Quick"
set "SKIP_BUILD="
set "NO_PAUSE="

:parse_args
if "%~1"=="" goto run_deploy
if /i "%~1"=="--full" set "DEPLOY_MODE=Full"
if /i "%~1"=="--skip-build" set "SKIP_BUILD=1"
if /i "%~1"=="--no-pause" set "NO_PAUSE=1"
shift
goto parse_args

:run_deploy
set PS_ARGS=-ExecutionPolicy Bypass -NoProfile -File "%~dp0tools\deploy-server.ps1" -Mode %DEPLOY_MODE%
if defined SKIP_BUILD set PS_ARGS=%PS_ARGS% -SkipBuild
if defined NO_PAUSE set PS_ARGS=%PS_ARGS% -NoPause

powershell %PS_ARGS%

exit /b %ERRORLEVEL%

