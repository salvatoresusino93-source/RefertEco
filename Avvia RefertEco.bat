@echo off
setlocal

set SRC=%USERPROFILE%\Desktop\RefertEco
set INST=%LOCALAPPDATA%\RefertEco

echo.
echo   Aggiornamento da GitHub...
git -C "%SRC%" pull --quiet 2>nul
if errorlevel 1 echo   [Avviso] git pull fallito - avvio con versione locale
echo.
echo   RefertEco in avvio...
echo   Attendi qualche secondo...
echo.

echo   Pulizia processi precedenti...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 " ^| findstr "LISTENING"') do (
  taskkill /PID %%a /F >nul 2>&1
)
timeout /t 1 /nobreak >nul

set NODE_PATH=%INST%\node_modules
cd /d "%SRC%"
start /b "%INST%\node.exe" server.js > "%TEMP%\referteco.log" 2>&1

set TRIES=0
:wait
set /a TRIES+=1
if %TRIES% gtr 30 goto open
powershell -NoProfile -Command "try{(New-Object Net.Sockets.TcpClient).Connect('127.0.0.1',3000);exit 0}catch{exit 1}" >nul 2>&1
if errorlevel 1 (
  timeout /t 1 /nobreak >nul
  goto wait
)

:open
echo   Apro il browser...
start "" "http://localhost:3000"
echo.
echo   RefertEco e' attivo nel browser.
echo   Tieni questa finestra aperta mentre usi il programma.
echo   Per uscire: chiudi questa finestra.
echo.
:keepalive
timeout /t 5 /nobreak >nul
powershell -NoProfile -Command "try{(New-Object Net.Sockets.TcpClient).Connect('127.0.0.1',3000);exit 0}catch{exit 1}" >nul 2>&1
if not errorlevel 1 goto keepalive
echo   Server fermato. Premi un tasto per chiudere.
pause >nul
