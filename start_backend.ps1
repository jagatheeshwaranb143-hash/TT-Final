# Start SmartSchedule FastAPI Backend Server
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Starting SmartSchedule Backend Server..." -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

$backendDir = Join-Path $PSScriptRoot "smartschedule\backend"
$smartscheduleDir = Join-Path $PSScriptRoot "smartschedule"
Set-Location $backendDir

$env:PYTHONPATH = "$backendDir;$smartscheduleDir"
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
