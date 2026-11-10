@echo off
chcp 65001 >nul
setlocal
title Compasso - diagnostica
rem Solo lettura: non modifica nulla. Copia il testo che appare e mandalo allo sviluppatore.
set "OUT=%USERPROFILE%\Desktop\compasso-diagnostica.txt"
call :report > "%OUT%" 2>&1
type "%OUT%"
echo.
echo   Report salvato sul Desktop: compasso-diagnostica.txt
echo.
pause
exit /b 0

:report
echo === Compasso - diagnostica ===
echo Data: %DATE% %TIME%
ver
echo.
echo --- Illustrator installati ---
dir /b "%ProgramFiles%\Adobe" 2>nul | findstr /i "Illustrator"
echo.
echo --- Cartelle delle estensioni CEP ---
for %%D in ("%APPDATA%\Adobe\CEP\extensions" "%CommonProgramFiles(x86)%\Adobe\CEP\extensions" "%CommonProgramFiles%\Adobe\CEP\extensions") do (
  echo [%%~D]
  dir /b "%%~D" 2>nul
)
echo.
echo --- Manifest di Compasso ---
for %%D in ("%APPDATA%\Adobe\CEP\extensions" "%CommonProgramFiles(x86)%\Adobe\CEP\extensions" "%CommonProgramFiles%\Adobe\CEP\extensions") do (
  if exist "%%~D\com.marcodolce.compasso\CSXS\manifest.xml" type "%%~D\com.marcodolce.compasso\CSXS\manifest.xml"
)
echo.
echo --- Versioni CEP registrate ---
reg query "HKCU\Software\Adobe" 2>nul | findstr /i "CSXS"
echo.
echo --- Estensioni secondo l'installatore di Adobe ---
set "UPIA=%CommonProgramFiles%\Adobe\Adobe Desktop Common\RemoteComponents\UPI\UnifiedPluginInstallerAgent\UnifiedPluginInstallerAgent.exe"
if exist "%UPIA%" "%UPIA%" /list all
if not exist "%UPIA%" echo UPIA non trovato
echo.
echo --- Log di installazione ---
if exist "%TEMP%\compasso-install.log" type "%TEMP%\compasso-install.log"
echo.
echo --- Log CEP recenti ---
dir /b /o-d "%TEMP%\CEP*.log" 2>nul
exit /b 0
