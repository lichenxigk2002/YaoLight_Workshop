@echo off
setlocal
chcp 65001 >nul
title Start Services

echo ========================================
echo   Start Backend, Frontend, Admin
echo ========================================
echo.

netstat -ano | findstr :8080 | findstr LISTENING >nul
if %errorlevel% == 0 (
    echo [1/3] Backend on 8080
    echo       Warning: port 8080 is already in use.
) else (
    echo [1/3] Starting backend on 8080...
    start "Backend" cmd /k "cd /d %~dp0Low_code_Backend && go run cmd/server/main.go"
    timeout /t 2 /nobreak >nul
    echo       Backend started.
)

echo.

netstat -ano | findstr :3000 | findstr LISTENING >nul
if %errorlevel% == 0 (
    echo [2/3] Frontend on 3000
    echo       Warning: port 3000 is already in use.
) else (
    echo [2/3] Starting frontend on 3000...
    start "Frontend" cmd /k "cd /d %~dp0Low_code_Frontend && npm run dev"
    timeout /t 2 /nobreak >nul
    echo       Frontend started.
)

echo.

netstat -ano | findstr :3200 | findstr LISTENING >nul
if %errorlevel% == 0 (
    echo [3/3] Admin on 3200
    echo       Warning: port 3200 is already in use.
) else (
    echo [3/3] Starting admin on 3200...
    start "Admin" cmd /k "cd /d %~dp0Admin_Frontend && npm run dev"
    timeout /t 2 /nobreak >nul
    echo       Admin started.
)

echo.
echo ========================================
echo   All services processed
echo ========================================
echo.
echo Backend : http://localhost:8080
echo Frontend: http://localhost:3000
echo Admin   : http://localhost:3200/admin/
echo.
echo Use stop-services.bat to stop windows if needed.
echo.
pause
