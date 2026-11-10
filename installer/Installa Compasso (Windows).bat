@echo off
chcp 65001 >nul
setlocal
title Compasso - installazione
rem Installa Compasso.zxp con l'installatore ufficiale di Adobe UPIA, incluso in Creative Cloud.
rem Nota: niente blocchi "if ( ... )" con testo tra parentesi, che rompono il parser di cmd.

set "ZXP=%~dp0Compasso.zxp"
set "UPIA=%CommonProgramFiles%\Adobe\Adobe Desktop Common\RemoteComponents\UPI\UnifiedPluginInstallerAgent\UnifiedPluginInstallerAgent.exe"
set "LOG=%TEMP%\compasso-install.log"

echo.
echo   COMPASSO per Adobe Illustrator
echo   ------------------------------
echo.
if not exist "%ZXP%" goto :nozxp
if not exist "%UPIA%" goto :noupia

echo   Chiudi Illustrator, poi premi un tasto per installare.
pause >nul
echo   Installo con l'installatore di Adobe...
"%UPIA%" /install "%ZXP%" > "%LOG%" 2>&1
type "%LOG%"
echo.

call :check
if "%FOUND%"=="1" goto :ok
echo   ATTENZIONE: l'installatore non ha installato Compasso.
echo   Dettagli salvati in: %LOG%
echo   Prova con ZXP Installer, gratuito: https://aescripts.com/learn/zxp-installer/
echo   Oppure esegui "Diagnostica Compasso - Windows.bat" e manda il risultato.
echo.
pause
exit /b 1

:ok
echo   FATTO! Compasso e' installato in:
echo   %FOUND_AT%
echo.
echo   Apri Illustrator e cerca Compasso in:
echo     Finestra ^> Estensioni ^> Compasso
echo   oppure, nelle versioni recenti:
echo     Finestra ^> Estensioni ^(legacy^) ^> Compasso
echo.
pause
exit /b 0

:check
set "FOUND=0"
set "FOUND_AT="
for %%D in ("%APPDATA%\Adobe\CEP\extensions" "%CommonProgramFiles(x86)%\Adobe\CEP\extensions" "%CommonProgramFiles%\Adobe\CEP\extensions") do (
  if exist "%%~D\com.marcodolce.compasso\CSXS\manifest.xml" (
    set "FOUND=1"
    set "FOUND_AT=%%~D\com.marcodolce.compasso"
  )
)
exit /b 0

:nozxp
echo   Non trovo "Compasso.zxp" accanto a questo file.
echo   Estrai TUTTO lo ZIP in una cartella, poi riprova.
echo.
pause
exit /b 1

:noupia
echo   Non trovo l'installatore di Adobe Creative Cloud.
echo   Installa Compasso.zxp con ZXP Installer, gratuito:
echo   https://aescripts.com/learn/zxp-installer/
echo   e trascina Compasso.zxp nella sua finestra.
echo.
pause
exit /b 1
