@echo off
echo ======================================
echo    Pokezam Bot Load Testing Suite
echo ======================================
echo.
echo Available test configurations:
echo.
echo [1] Light Load    - 10 users, 3 minutes
echo [2] Medium Load   - 20 users, 5 minutes  
echo [3] Heavy Load    - 30 users, 5 minutes
echo [4] Stress Test   - 50 users, 10 minutes
echo [5] Custom Test   - Specify your own parameters
echo.
set /p choice="Select test configuration (1-5): "

if "%choice%"=="1" (
    echo Running Light Load Test...
    node scripts\loadTest.js 10 light 3
) else if "%choice%"=="2" (
    echo Running Medium Load Test...
    node scripts\loadTest.js 20 medium 5
) else if "%choice%"=="3" (
    echo Running Heavy Load Test...
    node scripts\loadTest.js 30 heavy 5
) else if "%choice%"=="4" (
    echo Running Stress Test...
    node scripts\loadTest.js 50 extreme 10
) else if "%choice%"=="5" (
    set /p users="Number of users (1-100): "
    set /p intensity="Intensity (light/medium/heavy/extreme): "
    set /p duration="Duration in minutes: "
    echo Running Custom Test...
    node scripts\loadTest.js %users% %intensity% %duration%
) else (
    echo Invalid choice. Running default test...
    node scripts\loadTest.js 20 medium 5
)

echo.
echo Load test completed!
pause