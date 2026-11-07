@echo off
setlocal
cd /d "%~dp0"
title Dual Agent Studio - EXE Builder

echo ==============================================
echo   Dual Agent Studio - Windows EXE Builder
echo ==============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found. Install Node.js 26.13 or later.
  pause
  exit /b 1
)

node -e "const v=process.versions.node.split('.').map(Number);if(v[0]<25||(v[0]===25&&v[1]<5)){console.error('Node.js 25.5+ is required for --build-sea. Current: '+process.versions.node);process.exit(1)}"
if errorlevel 1 (
  echo.
  echo [ERROR] Your Node.js version is too old for the built-in EXE builder.
  pause
  exit /b 1
)

if not exist dist mkdir dist

echo [1/2] Building the standalone Windows executable...
node --build-sea sea-config.json
if errorlevel 1 (
  echo.
  echo [ERROR] Build failed. Review the messages above.
  pause
  exit /b 1
)

echo.
echo [2/2] Build complete.
echo Output: %CD%\dist\DualAgentStudio.exe
echo.
echo Double-click the EXE to start the local server and open the browser UI.
echo The EXE still requires Codex CLI and DeepSeek Harness CLI to be installed.
echo.
pause
