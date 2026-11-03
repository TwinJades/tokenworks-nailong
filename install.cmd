@echo off
chcp 65001 >nul
node "%~dp0scripts\install.mjs" %*
if errorlevel 1 echo Installation failed. Please see the error above.
if "%~1"=="" pause
