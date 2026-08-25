# Start SmartSchedule — Full Stack (Backend + Web Frontend)
Write-Host "=========================================" -ForegroundColor Yellow
Write-Host "Starting SmartSchedule Full Stack..." -ForegroundColor Yellow
Write-Host "  Backend:  http://127.0.0.1:8000" -ForegroundColor Cyan
Write-Host "  API Docs: http://127.0.0.1:8000/api/docs" -ForegroundColor Cyan
Write-Host "  Web App:  http://localhost:3000" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Yellow

$root = $PSScriptRoot

Start-Process powershell -ArgumentList "-NoExit", "-File", "$root\start_backend.ps1"
Start-Process powershell -ArgumentList "-NoExit", "-File", "$root\start_web.ps1"

Write-Host "`nBoth servers are launching in separate windows!" -ForegroundColor Green
Write-Host "Open http://localhost:3000/login to access the dashboard." -ForegroundColor White
Write-Host "Demo Admin: admin@smartschedule.dev / admin123`n" -ForegroundColor White
