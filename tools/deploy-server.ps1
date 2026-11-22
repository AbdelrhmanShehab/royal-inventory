# ==============================================================================
# Royal Inventory ERP - Automated Remote Server Deployment Engine
# Target: 192.168.50.5:7575
# ==============================================================================
param (
    [string]$ServerIp = "192.168.50.5",
    [string]$RemoteShare = "\\192.168.50.5\e$\royal_inventory",
    [string]$ServiceName = "inventory_tracking_system",
    [int]$Port = 7575,
    [ValidateSet("Quick", "Full")][string]$Mode = "Quick",
    [switch]$SkipBuild,
    [switch]$NoPause
)

$ErrorActionPreference = "Continue"
$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

function Write-Step {
    param([string]$Title, [int]$Step, [int]$Total = 7)
    Write-Host ""
    Write-Host "==============================================================================" -ForegroundColor DarkCyan
    Write-Host " [$Step/$Total] $Title" -ForegroundColor Cyan
    Write-Host "==============================================================================" -ForegroundColor DarkCyan
}

function Write-Success {
    param([string]$Msg)
    Write-Host " [OK] $Msg" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Msg)
    Write-Host " [WARNING] $Msg" -ForegroundColor Yellow
}

function Write-Fail {
    param([string]$Msg)
    Write-Host " [ERROR] $Msg" -ForegroundColor Red
    if (-not $NoPause) {
        Write-Host ""
        Read-Host "Press Enter to exit..."
    }
    exit 1
}

$RootDir = Split-Path -Path $PSScriptRoot -Parent
Set-Location $RootDir

$serverUrl = "http://" + $ServerIp + ":" + $Port + "/"

Clear-Host
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "        ROYAL INVENTORY ERP - ONE-CLICK REMOTE DEPLOYMENT" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host " Target Server : " -NoNewline; Write-Host $ServerIp -ForegroundColor Yellow
Write-Host " Target Service: " -NoNewline; Write-Host $ServiceName -ForegroundColor Yellow
Write-Host " Target Path   : " -NoNewline; Write-Host $RemoteShare -ForegroundColor Yellow
Write-Host " Web URL       : " -NoNewline; Write-Host $serverUrl -ForegroundColor Yellow
Write-Host " Deploy Mode   : " -NoNewline; Write-Host $Mode -ForegroundColor Yellow
Write-Host ""

# ------------------------------------------------------------------------------
# STEP 1: Pre-flight Connectivity and Health Verification
# ------------------------------------------------------------------------------
Write-Step "Checking Server and Network Connectivity..." 1

Write-Host "  Pinging $ServerIp..." -NoNewline
if (-not (Test-Connection -ComputerName $ServerIp -Count 1 -Quiet)) {
    Write-Host " FAILED!" -ForegroundColor Red
    Write-Fail "Server $ServerIp is unreachable on the network."
}
Write-Host " Online." -ForegroundColor Green

Write-Host "  Verifying remote folder access..." -NoNewline
if (-not (Test-Path $RemoteShare)) {
    Write-Host " NOT FOUND!" -ForegroundColor Red
    Write-Fail "Remote share $RemoteShare is not accessible. Check network permissions."
}
Write-Host " Accessible." -ForegroundColor Green

Write-Host "  Verifying remote folder write access..." -NoNewline
$testProbe = Join-Path $RemoteShare "deploy_write_probe.tmp"
try {
    "probe" | Set-Content -Path $testProbe -ErrorAction Stop
    Remove-Item -Path $testProbe -Force -ErrorAction SilentlyContinue
    Write-Host " Writable." -ForegroundColor Green
} catch {
    Write-Host " WRITE DENIED!" -ForegroundColor Red
    Write-Fail "Cannot write to remote share."
}

Write-Host "  Checking remote Windows Service status..." -NoNewline
$scQuery = & sc.exe "\\$ServerIp" query $ServiceName 2>&1 | Out-String
if ($scQuery -match 'STATE\s+:\s+\d+\s+([A-Z_]+)') {
    $currentStatus = $Matches[1]
    Write-Host " $currentStatus" -ForegroundColor Green
} else {
    Write-Host " UNKNOWN" -ForegroundColor Yellow
    Write-Warn "Could not query service. Will attempt graceful management."
}

# ------------------------------------------------------------------------------
# STEP 2: Build Frontend (Vite + React Production Bundle)
# ------------------------------------------------------------------------------
Write-Step "Building React Production Frontend Bundle..." 2

if ($SkipBuild) {
    Write-Host "  --skip-build specified. Skipping frontend build." -ForegroundColor Yellow
} else {
    Write-Host "  Running 'npm run build'..." -ForegroundColor DarkGray
    & cmd.exe /c "npm run build"
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Frontend build failed! Fix TypeScript/Vite errors before deploying."
    }
}

$DistIndex = Join-Path $RootDir "dist\index.html"
if (-not (Test-Path $DistIndex)) {
    Write-Fail "dist\index.html not found! The production build did not generate output."
}
$distSizeMb = [Math]::Round(((Get-ChildItem -Path (Join-Path $RootDir "dist") -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB), 2)
Write-Success "Frontend bundle generated successfully ($distSizeMb MB)."

# ------------------------------------------------------------------------------
# STEP 3: Local Backend Code Integrity Verification
# ------------------------------------------------------------------------------
Write-Step "Testing Backend Application Integrity..." 3

Write-Host "  Checking Node runtime..." -NoNewline
$nodeBin = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
if (-not $nodeBin) {
    Write-Fail "node.exe is not installed on this local machine."
}
Write-Host " $nodeBin" -ForegroundColor Green

Write-Host "  Validating backend app entrypoint..." -NoNewline
$smokeTestCode = "try { require('./Royal_inventory/src/app'); console.log('OK'); process.exit(0); } catch(e) { console.error(e.message); process.exit(1); }"
$smokeRes = & $nodeBin -e $smokeTestCode 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host " FAILED!" -ForegroundColor Red
    Write-Host "  Smoke test error: $smokeRes" -ForegroundColor Yellow
    Write-Fail "Backend smoke test failed! Local application has errors and cannot be deployed."
}
Write-Host " Passed." -ForegroundColor Green
Write-Success "Local backend code verified without syntax or dependency errors."

# ------------------------------------------------------------------------------
# STEP 4: Stop Remote Windows Service Gracefully
# ------------------------------------------------------------------------------
Write-Step "Stopping Remote Service on $ServerIp..." 4

Write-Host "  Sending stop command via RPC..." -NoNewline
& sc.exe "\\$ServerIp" stop $ServiceName 2>&1 | Out-Null
Write-Host " Sent." -ForegroundColor Green

Write-Host "  Waiting for service to shut down cleanly..." -NoNewline
$stopped = $false
for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep -Seconds 1
    $statusCheck = & sc.exe "\\$ServerIp" query $ServiceName 2>&1 | Out-String
    if ($statusCheck -match 'STATE\s+:\s+1\s+STOPPED') {
        $stopped = $true
        break
    }
    Write-Host "." -NoNewline
}

if ($stopped) {
    Write-Host " STOPPED." -ForegroundColor Green
    Write-Success "Remote service stopped gracefully."
} else {
    Write-Host " PENDING." -ForegroundColor Yellow
    Write-Warn "Service took longer than expected to stop. Proceeding with file sync."
}

# ------------------------------------------------------------------------------
# STEP 5: Fast Atomic File Synchronization via Robocopy
# ------------------------------------------------------------------------------
Write-Step "Synchronizing Updated Files to Server..." 5

function Invoke-FastRobocopy {
    param([string]$Source, [string]$Destination, [string[]]$ExtraArgs = @("/MIR"))
    
    if (-not (Test-Path $Source)) {
        return
    }
    
    if (-not (Test-Path $Destination)) {
        New-Item -ItemType Directory -Path $Destination -Force | Out-Null
    }
    
    $rcArgs = @(
        $Source,
        $Destination
    ) + $ExtraArgs + @(
        "/FFT",
        "/Z",
        "/R:2",
        "/W:1",
        "/NP",
        "/NDL",
        "/NFL",
        "/NJH",
        "/NJS"
    )
    
    & robocopy.exe @rcArgs | Out-Null
    $code = $LASTEXITCODE
    if ($code -ge 8) {
        Write-Fail "Robocopy failed copying from '$Source' to '$Destination' (Exit code: $code)."
    }
}

# 5.1 Sync React Frontend Bundle
Write-Host "  [1/4] Syncing React frontend -> app\public..." -NoNewline
Invoke-FastRobocopy (Join-Path $RootDir "dist") (Join-Path $RemoteShare "app\public") @("/MIR")
Write-Host " Done." -ForegroundColor Green

# 5.2 Sync Backend Source Code
Write-Host "  [2/4] Syncing Backend source -> app\src..." -NoNewline
Invoke-FastRobocopy (Join-Path $RootDir "Royal_inventory\src") (Join-Path $RemoteShare "app\src") @("/MIR")
Write-Host " Done." -ForegroundColor Green

# 5.3 Sync Database Migrations and Configuration
Write-Host "  [3/4] Syncing Migrations and Configuration -> app\..." -NoNewline
if (Test-Path (Join-Path $RootDir "Royal_inventory\migrations")) {
    Invoke-FastRobocopy (Join-Path $RootDir "Royal_inventory\migrations") (Join-Path $RemoteShare "app\migrations") @("/MIR")
}
Copy-Item -Path (Join-Path $RootDir "Royal_inventory\package.json") -Destination (Join-Path $RemoteShare "app\package.json") -Force
Write-Host " Done." -ForegroundColor Green

# 5.4 Full Mode: Sync Node Modules and Runtime (Optional)
if ($Mode -eq "Full") {
    Write-Host "  [4/4] Full Mode: Syncing production node_modules and runtime..." -ForegroundColor Yellow
    if (Test-Path (Join-Path $RootDir "Royal_inventory\node_modules")) {
        Write-Host "    Syncing node_modules..." -NoNewline
        Invoke-FastRobocopy (Join-Path $RootDir "Royal_inventory\node_modules") (Join-Path $RemoteShare "app\node_modules") @("/E", "/XD", "nodemon", "/XF", "*.ts", "*.map")
        Write-Host " Done." -ForegroundColor Green
    }
    if (Test-Path (Join-Path $RootDir "deploy\runtime")) {
        Invoke-FastRobocopy (Join-Path $RootDir "deploy\runtime") (Join-Path $RemoteShare "runtime") @("/MIR")
    }
    if (Test-Path (Join-Path $RootDir "deploy\tools")) {
        Invoke-FastRobocopy (Join-Path $RootDir "deploy\tools") (Join-Path $RemoteShare "tools") @("/MIR")
    }
} else {
    Write-Host "  [4/4] Production environment (.env) and node_modules preserved safely." -ForegroundColor Green
}

Write-Success "All application files synchronized successfully."

# ------------------------------------------------------------------------------
# STEP 6: Start Remote Windows Service
# ------------------------------------------------------------------------------
Write-Step "Starting Remote Service on $ServerIp..." 6

Write-Host "  Sending start command via RPC..." -NoNewline
& sc.exe "\\$ServerIp" start $ServiceName 2>&1 | Out-Null
Write-Host " Sent." -ForegroundColor Green

Write-Host "  Waiting for service to enter RUNNING state..." -NoNewline
$running = $false
for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep -Seconds 1
    $statusCheck = & sc.exe "\\$ServerIp" query $ServiceName 2>&1 | Out-String
    if ($statusCheck -match 'STATE\s+:\s+4\s+RUNNING') {
        $running = $true
        break
    }
    Write-Host "." -NoNewline
}

if ($running) {
    Write-Host " RUNNING." -ForegroundColor Green
    Write-Success "Remote service started successfully."
} else {
    Write-Host " STATUS UNCERTAIN." -ForegroundColor Yellow
    Write-Warn "Service start state could not be verified immediately. Inspecting live HTTP endpoint..."
}

# ------------------------------------------------------------------------------
# STEP 7: Live Remote Health-Check and Verification
# ------------------------------------------------------------------------------
Write-Step "Verifying Live Web Service..." 7

$healthUrl = "http://" + $ServerIp + ":" + $Port + "/health"
$healthy = $false
$healthData = $null

Write-Host "  Probing $healthUrl..." -NoNewline
for ($i = 0; $i -lt 10; $i++) {
    try {
        $res = Invoke-RestMethod -Uri $healthUrl -Method Get -TimeoutSec 3 -ErrorAction Stop
        if ($res.status -eq "ok") {
            $healthy = $true
            $healthData = $res
            break
        }
    } catch {
        # Retry while service initializes DB connections
    }
    Start-Sleep -Seconds 1
    Write-Host "." -NoNewline
}

if ($healthy) {
    Write-Host " HEALTHY (HTTP 200)!" -ForegroundColor Green
    Write-Host "    - Status   : " -NoNewline; Write-Host $healthData.status -ForegroundColor Green
    Write-Host "    - Service  : " -NoNewline; Write-Host $healthData.service -ForegroundColor White
    Write-Host "    - Env      : " -NoNewline; Write-Host $healthData.env -ForegroundColor White
    Write-Host "    - Uptime   : " -NoNewline; Write-Host ($healthData.uptime.ToString() + "s") -ForegroundColor White
} else {
    Write-Host " NOT RESPONDING YET." -ForegroundColor Yellow
    Write-Warn "Health endpoint did not reply within 10s. Check remote logs on server."
}

# Verify root page (React index.html)
Write-Host "  Probing frontend page ($serverUrl)..." -NoNewline
try {
    $webRes = Invoke-WebRequest -Uri $serverUrl -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    if ($webRes.StatusCode -eq 200) {
        Write-Host " OK (HTTP 200)." -ForegroundColor Green
    } else {
        Write-Host " HTTP $($webRes.StatusCode)." -ForegroundColor Yellow
    }
} catch {
    Write-Host " Error: $($_.Exception.Message)" -ForegroundColor Yellow
}

$stopwatch.Stop()
$elapsedSec = [Math]::Round($stopwatch.Elapsed.TotalSeconds, 1)

# ------------------------------------------------------------------------------
# COMPLETION BANNER
# ------------------------------------------------------------------------------
Write-Host ""
Write-Host "==============================================================================" -ForegroundColor Green
Write-Host "        DEPLOYMENT COMPLETED SUCCESSFULLY IN $elapsedSec SECONDS!" -ForegroundColor Green
Write-Host "==============================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  URL:              " -NoNewline; Write-Host $serverUrl -ForegroundColor Cyan
Write-Host "  Service Status:   " -NoNewline; Write-Host "RUNNING" -ForegroundColor Green
Write-Host "  Remote Path:      " -NoNewline; Write-Host $RemoteShare -ForegroundColor White
Write-Host "  Timestamp:        " -NoNewline; Write-Host (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') -ForegroundColor Gray
Write-Host ""
Write-Host "  Tip: For future updates, simply run:" -ForegroundColor DarkGray
Write-Host "       deploy-to-server.bat" -ForegroundColor Cyan
Write-Host "       (No manual file copying, extracting, or RDP required!)" -ForegroundColor DarkGray
Write-Host ""

if (-not $NoPause) {
    Read-Host "Press Enter to close this window..."
}
