# Helper script to acquire NSSM 64-bit binary for Windows Service management
param (
    [string]$TargetDir = "$PSScriptRoot\bin"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $TargetDir)) {
    New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
}

$NssmExe = Join-Path $TargetDir "nssm.exe"

if (Test-Path $NssmExe) {
    Write-Host "✅ NSSM binary already present at: $NssmExe"
    exit 0
}

Write-Host "Downloading NSSM (Non-Sucking Service Manager)..."
$ZipUrl = "https://nssm.cc/release/nssm-2.24.zip"
$TempZip = Join-Path $env:TEMP "nssm-2.24.zip"
$TempExtract = Join-Path $env:TEMP "nssm-extract-$([System.Guid]::NewGuid().ToString())"

try {
    # Download zip using curl.exe or Invoke-WebRequest
    if (Get-Command curl.exe -ErrorAction SilentlyContinue) {
        curl.exe -L -s -o $TempZip $ZipUrl
    } else {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $ZipUrl -OutFile $TempZip -UseBasicParsing
    }

    if (-not (Test-Path $TempZip)) {
        throw "Failed to download $ZipUrl"
    }

    Write-Host "Extracting 64-bit nssm.exe..."
    Expand-Archive -Path $TempZip -DestinationPath $TempExtract -Force

    $FoundExe = Get-ChildItem -Path $TempExtract -Recurse -Filter "nssm.exe" | Where-Object { $_.FullName -like "*win64*" } | Select-Object -First 1

    if (-not $FoundExe) {
        # Fallback to any nssm.exe found in archive
        $FoundExe = Get-ChildItem -Path $TempExtract -Recurse -Filter "nssm.exe" | Select-Object -First 1
    }

    if (-not $FoundExe) {
        throw "Could not find nssm.exe inside downloaded archive."
    }

    Copy-Item -Path $FoundExe.FullName -Destination $NssmExe -Force
    Write-Host "✅ NSSM 64-bit successfully installed to: $NssmExe"

} finally {
    if (Test-Path $TempZip) { Remove-Item $TempZip -Force -ErrorAction SilentlyContinue }
    if (Test-Path $TempExtract) { Remove-Item $TempExtract -Recurse -Force -ErrorAction SilentlyContinue }
}
