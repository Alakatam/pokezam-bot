Write-Host "======================================" -ForegroundColor Green
Write-Host "    Pokezam Bot Load Testing Suite" -ForegroundColor Green  
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host "Available test configurations:" -ForegroundColor Yellow
Write-Host ""
Write-Host "[1] Light Load    - 10 users, 3 minutes" -ForegroundColor Cyan
Write-Host "[2] Medium Load   - 20 users, 5 minutes" -ForegroundColor Cyan
Write-Host "[3] Heavy Load    - 30 users, 5 minutes" -ForegroundColor Cyan
Write-Host "[4] Stress Test   - 50 users, 10 minutes" -ForegroundColor Cyan
Write-Host "[5] Custom Test   - Specify your own parameters" -ForegroundColor Cyan
Write-Host ""

$choice = Read-Host "Select test configuration (1-5)"

switch ($choice) {
    "1" {
        Write-Host "Running Light Load Test..." -ForegroundColor Green
        node scripts\loadTest.js 10 light 3
    }
    "2" {
        Write-Host "Running Medium Load Test..." -ForegroundColor Green
        node scripts\loadTest.js 20 medium 5
    }
    "3" {
        Write-Host "Running Heavy Load Test..." -ForegroundColor Green
        node scripts\loadTest.js 30 heavy 5
    }
    "4" {
        Write-Host "Running Stress Test..." -ForegroundColor Red
        node scripts\loadTest.js 50 extreme 10
    }
    "5" {
        $users = Read-Host "Number of users (1-100)"
        $intensity = Read-Host "Intensity (light/medium/heavy/extreme)"
        $duration = Read-Host "Duration in minutes"
        Write-Host "Running Custom Test..." -ForegroundColor Green
        node scripts\loadTest.js $users $intensity $duration
    }
    default {
        Write-Host "Invalid choice. Running default test..." -ForegroundColor Yellow
        node scripts\loadTest.js 20 medium 5
    }
}

Write-Host ""
Write-Host "Load test completed!" -ForegroundColor Green
Read-Host "Press Enter to exit"