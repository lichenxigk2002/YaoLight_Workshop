@echo off
chcp 65001 >nul
title 启动服务
echo ========================================
echo         启动前后端服务
echo ========================================
echo.


REM 检查端口是否被占用
netstat -ano | findstr :8080 | findstr LISTENING >nul
if %errorlevel% == 0 (
    echo [1/2] 后端服务（端口8080）
    echo     警告: 端口8080已被占用，后端服务可能已在运行
) else (
    echo [1/2] 启动后端服务（端口8080）...
    start "后端服务" cmd /k "cd /d %~dp0Low_code_Backend && go run cmd/server/main.go"
    timeout /t 2 /nobreak >nul
    echo     后端服务已启动
)

echo.

netstat -ano | findstr :3000 | findstr LISTENING >nul
if %errorlevel% == 0 (
    echo [2/2] 前端服务（端口3000）
    echo     警告: 端口3000已被占用，前端服务可能已在运行
) else (
    echo [2/2] 启动前端服务（端口3000）...
    start "前端服务" cmd /k "cd /d %~dp0Low_code_Frontend && npm run dev"
    timeout /t 2 /nobreak >nul
    echo     前端服务已启动
)

echo.
echo ========================================
echo         服务启动完成！
echo ========================================
echo.
echo 后端: http://localhost:8080
echo 前端: http://localhost:3000
echo.
echo 提示: 关闭服务请运行 stop-services.bat
echo.
pause
