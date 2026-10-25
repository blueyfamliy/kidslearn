# KidsLearn - PowerShell one-line installer
# Usage:  irm https://raw.githubusercontent.com/blueyfamliy/kidslearn/main/install.ps1 | iex

$ErrorActionPreference = 'Stop'

Write-Host ""
Write-Host "  ========================================" -ForegroundColor Cyan
Write-Host "   KidsLearn - Installer" -ForegroundColor Cyan
Write-Host "  ========================================" -ForegroundColor Cyan
Write-Host ""

$repo = "blueyfamliy/kidslearn"
$dest = Join-Path $env:TEMP "KidsLearn-Setup.exe"

Write-Host "[1/2] Finding the latest version..." -ForegroundColor Yellow
try {
    $rel = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/latest" -UseBasicParsing
    $asset = $rel.assets | Where-Object { $_.name -like '*.exe' } | Select-Object -First 1
    if (-not $asset) { throw "No .exe asset found in the latest release." }
    $url = $asset.browser_download_url
} catch {
    Write-Host "[X] Could not find the latest release: $_" -ForegroundColor Red
    return
}

Write-Host "      Downloading $($asset.name) (~98 MB)..." -ForegroundColor Yellow
Write-Host "      from: $url" -ForegroundColor DarkGray
try {
    # Show progress while downloading
    $ProgressPreference = 'Continue'
    Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing
} catch {
    Write-Host "[X] Download failed: $_" -ForegroundColor Red
    Write-Host "    Check your internet connection and try again." -ForegroundColor Red
    return
}

$sizeMB = [math]::Round((Get-Item $dest).Length / 1MB, 1)
Write-Host "      Downloaded $sizeMB MB OK" -ForegroundColor Green
Write-Host ""

Write-Host "[2/2] Launching installer..." -ForegroundColor Yellow
Write-Host "      (If Windows shows a SmartScreen warning, click 'More info' -> 'Run anyway')" -ForegroundColor DarkGray
Start-Process -FilePath $dest

Write-Host ""
Write-Host "  ========================================" -ForegroundColor Green
Write-Host "   Installer started!" -ForegroundColor Green
Write-Host "   Follow the on-screen steps to finish." -ForegroundColor Green
Write-Host "  ========================================" -ForegroundColor Green
Write-Host ""
