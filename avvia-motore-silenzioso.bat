@echo off
rem ============================================================
rem  RefertEco - avvio SILENZIOSO del motore (server)
rem  Usa SEMPRE la cartella aggiornata sul Desktop.
rem  Lanciato in automatico all'accensione del PC.
rem ============================================================
setlocal
set SRC=%USERPROFILE%\Desktop\RefertEco
set INST=%LOCALAPPDATA%\RefertEco

rem --- Scarica eventuali aggiornamenti da GitHub (se fallisce, usa la versione locale) ---
git -C "%SRC%" pull --quiet 2>nul

rem --- Libera la porta 3000 da eventuali resti di sessioni precedenti ---
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 " ^| findstr "LISTENING"') do (
  taskkill /PID %%a /F >nul 2>&1
)

rem --- Avvia il motore (versione aggiornata del Desktop) ---
set NODE_PATH=%INST%\node_modules
cd /d "%SRC%"
"%INST%\node.exe" server.js
