@echo off
chcp 65001 >nul
set PORT=5173

:: Check if port is in use
netstat -an | findstr ":%PORT% " | findstr "LISTENING" >nul
if %errorlevel%==0 (
    echo [INFO] サーバーは既に起動しています (Port %PORT% is busy).
    echo このウィンドウは3秒後に閉じます...
    timeout /t 3 >nul
    exit /b
)

echo [START] サーバーを起動します...
cd /d "%~dp0\JWCADTategu.Web"
npm run dev
pause
