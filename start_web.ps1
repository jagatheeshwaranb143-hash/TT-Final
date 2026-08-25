# Start SmartSchedule Next.js Web Dashboard
Write-Host "=========================================" -ForegroundColor Green
Write-Host "Starting SmartSchedule Web Dashboard..." -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green

$webDir = Join-Path $PSScriptRoot "smartschedule\web"
Set-Location $webDir

npm run dev
