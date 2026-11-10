@echo off
chcp 65001 >nul
setlocal
title Compasso - diagnostica
rem Solo lettura: non modifica nulla. Salva un report sul Desktop da mandare allo sviluppatore.
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
echo --- Estensioni CEP dell'utente ---
dir /b "%APPDATA%\Adobe\CEP\extensions" 2>nul
echo.
echo --- File di Compasso ---
dir /b "%APPDATA%\Adobe\CEP\extensions\com.marcodolce.compasso" 2>nul
echo.
echo --- Manifest di Compasso ---
if exist "%APPDATA%\Adobe\CEP\extensions\com.marcodolce.compasso\CSXS\manifest.xml" type "%APPDATA%\Adobe\CEP\extensions\com.marcodolce.compasso\CSXS\manifest.xml"
echo.
echo --- Versioni CEP registrate ---
reg query "HKCU\Software\Adobe" 2>nul | findstr /i "CSXS"
echo.
echo --- Log CEP recenti ---
dir /b /o-d "%TEMP%\CEP*.log" 2>nul
exit /b 0
