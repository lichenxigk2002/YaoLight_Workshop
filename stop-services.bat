@echo off
chcp 65001 >nul
title 停止服务
cls
echo ========================================
echo         停止前后端服务
echo ========================================
echo.

echo [1/2] 停止后端服务（端口8080）...
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr :8080 ^| findstr LISTENING') do (
    echo     找到进程，PID: %%a
    taskkill /F /PID %%a >nul 2>&1
    echo     后端服务已停止
    goto :frontend
)
echo     未找到运行中的后端服务

:frontend
echo.
echo [2/2] 停止前端服务（端口3000）...
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr :3000 ^| findstr LISTENING') do (
    echo     找到进程，PID: %%a
    taskkill /F /PID %%a >nul 2>&1
    echo     前端服务已停止
    goto :end
)
echo     未找到运行中的前端服务

:end
echo.
echo ========================================
echo         所有服务已停止！
echo ========================================
echo.
pause
