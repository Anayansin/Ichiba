@echo off
setlocal
title Ichiba - arranque local
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0herramientas\arrancar-ichiba.ps1"
if errorlevel 1 (
  echo.
  echo No se pudo completar el arranque. Revisa los mensajes de arriba.
  pause
)
endlocal
