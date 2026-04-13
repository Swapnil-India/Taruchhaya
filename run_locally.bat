@echo off
setlocal
cd /d "%~dp0"

echo ===================================================
echo   Taruchhaya Inventory System - One Click Launcher
echo ===================================================
echo.

:: Check for Node.js (Industry Standard)
where node >nul 2>nul
if %errorlevel% equ 0 (
    echo [STATUS] Using Node.js server...
    echo Starting on http://localhost:3000...
    start "" "http://localhost:3000"
    npx -y serve -l 3000 .
    exit /b
)

:: Check for Python (Built-in Alternative)
where python >nul 2>nul
if %errorlevel% equ 0 (
    echo [STATUS] Node.js not found, using Python fallback...
    echo Starting on http://localhost:3000...
    start "" "http://localhost:3000"
    python -m http.server 3000
    exit /b
)

echo [ERROR] No server tools detected!
echo.
echo To run this app (and allow Google Drive cloud sync), you need one of these installed:
echo 1. Node.js (Highly Recommended) - Download at https://nodejs.org/
echo 2. Python - Download at https://www.python.org/
echo.
echo After installing one, please restart this launcher.
echo.
pause
