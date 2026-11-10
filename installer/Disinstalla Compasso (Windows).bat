@echo off
chcp 65001 >nul
setlocal
title Compasso - disinstallazione
set "UPIA=%CommonProgramFiles%\Adobe\Adobe Desktop Common\RemoteComponents\UPI\UnifiedPluginInstallerAgent\UnifiedPluginInstallerAgent.exe"
echo.
if not exist "%UPIA%" goto :noupia
"%UPIA%" /remove "Compasso"
echo.
echo   Fatto. Riavvia Illustrator.
echo.
pause
exit /b 0

:noupia
echo   Non trovo l'installatore di Adobe: disinstalla Compasso da ZXP Installer.
echo.
pause
exit /b 1
