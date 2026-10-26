@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Installer Node.js 22 eller nyere fra https://nodejs.org og start denne fil igen.
  pause
  exit /b 1
)
node server.js
pause
