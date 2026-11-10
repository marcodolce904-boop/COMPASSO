@echo off
chcp 65001 >nul
setlocal
title Compasso - installazione

rem Installa Compasso.zxp con l'installatore ufficiale di Adobe (UPIA, incluso in Creative Cloud).
set "ZXP=%~dp0Compasso.zxp"
set "UPIA=%CommonProgramFiles%\Adobe\Adobe Desktop Common\RemoteComponents\UPI\UnifiedPluginInstallerAgent\UnifiedPluginInstallerAgent.exe"

echo.
echo   COMPASSO per Adobe Illustrator
echo   ------------------------------
echo.
if not exist "%ZXP%" (
  echo   Non trovo "Compasso.zxp" accanto a questo file.
  echo   Estrai TUTTO lo ZIP in una cartella, poi riprova.
  echo.
  pause
  exit /b 1
)
if not exist "%UPIA%" (
  echo   Non trovo l'installatore di Adobe Creative Cloud.
  echo   Installa Compasso.zxp con "ZXP Installer" (gratuito): https://aescripts.com/learn/zxp-installer/
  echo   e trascina Compasso.zxp nella sua finestra.
  echo.
  pause
  exit /b 1
)
echo   Chiudi Illustrator, poi premi un tasto per installare.
pause >nul
"%UPIA%" /install "%ZXP%"
if errorlevel 1 (
  echo.
  echo   L'installazione non e' riuscita. Prova con "ZXP Installer" (vedi LEGGIMI.txt).
  pause
  exit /b 1
)
echo.
echo   FATTO!  Apri Illustrator e scegli:  Finestra ^> Estensioni ^> Compasso
echo.
pause
