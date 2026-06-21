@echo off
setlocal

set "ROOT_DIR=%~dp0"
set "SERVER_DIR=%ROOT_DIR%server"
set "FRONTEND_DIR=%ROOT_DIR%frontend"

if not exist "%SERVER_DIR%" (
  echo Missing server directory: %SERVER_DIR%
  exit /b 1
)

if not exist "%FRONTEND_DIR%" (
  echo Missing frontend directory: %FRONTEND_DIR%
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo Required command not found: npm
  exit /b 1
)

echo Starting backend dev server...
start "Leadgen Backend" cmd /k "cd /d "%SERVER_DIR%" && npm run dev"

echo Starting frontend dev server...
start "Leadgen Frontend" cmd /k "cd /d "%FRONTEND_DIR%" && npm run dev"

echo Both development servers were launched in separate windows.
