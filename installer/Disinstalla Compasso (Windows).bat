@echo off
chcp 65001 >nul
title Compasso - disinstallazione
set "UPIA=%CommonProgramFiles%\Adobe\Adobe Desktop Common\RemoteComponents\UPI\UnifiedPluginInstallerAgent\UnifiedPluginInstallerAgent.exe"
echo.
if not exist "%UPIA%" (
  echo   Non trovo l'installatore di Adobe: disinstalla Compasso da "ZXP Installer".
  pause
  exit /b 1
)
"%UPIA%" /remove "Compasso"
echo.
echo   Fatto. Riavvia Illustrator.
echo.
pause
