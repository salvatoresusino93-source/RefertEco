@echo off
chcp 65001 >nul
title Aggiornamento RefertEco

echo.
echo  ╔══════════════════════════════════════════════════╗
echo  ║         Aggiornamento RefertEco                  ║
echo  ║  Studio del Dr. Susino — Sistema Referti         ║
echo  ╚══════════════════════════════════════════════════╝
echo.

:: Verifica che lo script sia nella cartella giusta
if not exist "server.js" (
    echo  [ERRORE] Esegui questo script dalla cartella di RefertEco.
    echo  Fai doppio clic su AGGIORNA.bat dall'interno della cartella.
    pause
    exit /b 1
)

:: Verifica che la cartella aggiornamenti esista
if not exist "aggiornamenti\server.js" (
    echo  [ERRORE] Cartella "aggiornamenti" non trovata o incompleta.
    echo  Assicurati che la cartella aggiornamenti sia presente.
    pause
    exit /b 1
)

echo  Questo script aggiornera' i file di RefertEco con le nuove funzioni:
echo.
echo   - Integrazione Agenda: stato appuntamento aggiornato a "Refertato"
echo     automaticamente dopo il salvataggio del referto
echo   - Pazienti in attesa: lista live dall'Agenda in RefertEco
echo   - Correzione AI referti migliorata
echo   - Altre correzioni e miglioramenti
echo.
echo  ATTENZIONE: Verranno creati backup dei file attuali prima
echo  di sostituirli. I backup si trovano nella cartella "backup_YYYYMMDD".
echo.

set /p CONFERMA= Vuoi procedere con l'aggiornamento? (S/N):
if /i "%CONFERMA%" neq "S" (
    echo  Aggiornamento annullato.
    pause
    exit /b 0
)

:: Crea cartella backup con data
for /f "tokens=2 delims==" %%i in ('wmic os get localdatetime /value') do set DT=%%i
set BACKUP_DIR=backup_%DT:~0,8%_%DT:~8,6%

echo.
echo  Creazione backup in: %BACKUP_DIR%
mkdir "%BACKUP_DIR%" >nul 2>&1
mkdir "%BACKUP_DIR%\public" >nul 2>&1

:: Backup file correnti
if exist "server.js"        copy "server.js"        "%BACKUP_DIR%\server.js"        >nul
if exist "public\app.js"    copy "public\app.js"    "%BACKUP_DIR%\public\app.js"    >nul
if exist "public\style.css" copy "public\style.css" "%BACKUP_DIR%\public\style.css" >nul

echo  [OK] Backup completato.

:: ── Aggiorna server.js ────────────────────────────────────────────────────
echo.
echo  Aggiornamento server.js...
copy /Y "aggiornamenti\server.js" "server.js" >nul
echo  [OK] server.js aggiornato.

:: ── Gestione public\app.js ───────────────────────────────────────────────
echo.
echo  ╔══════════════════════════════════════════════════╗
echo  ║  ATTENZIONE — public\app.js                      ║
echo  ╠══════════════════════════════════════════════════╣
echo  ║  Questo file potrebbe contenere modifiche        ║
echo  ║  personalizzate (es. miglioramenti stampa).      ║
echo  ║                                                  ║
echo  ║  Opzioni disponibili:                            ║
echo  ║   [1] Sostituisci con la versione nuova          ║
echo  ║       (perderai le modifiche locali)             ║
echo  ║   [2] Copia il file nuovo come app.NUOVO.js      ║
echo  ║       (potrai integrare manualmente dopo)        ║
echo  ╚══════════════════════════════════════════════════╝
echo.
set /p SCELTA_APP= Scegli [1] o [2]:

if "%SCELTA_APP%"=="1" (
    copy /Y "aggiornamenti\public\app.js" "public\app.js" >nul
    echo  [OK] public\app.js sostituito con la versione nuova.
) else (
    copy /Y "aggiornamenti\public\app.js" "public\app.NUOVO.js" >nul
    echo  [OK] Versione nuova salvata come: public\app.NUOVO.js
    echo      Aprila con un editor e integra le modifiche manualmente.
)

:: ── Aggiorna public\style.css ─────────────────────────────────────────────
echo.
echo  Aggiornamento public\style.css...
copy /Y "aggiornamenti\public\style.css" "public\style.css" >nul
echo  [OK] public\style.css aggiornato.

:: ── Fine ──────────────────────────────────────────────────────────────────
echo.
echo  ╔══════════════════════════════════════════════════╗
echo  ║  Aggiornamento completato con successo!          ║
echo  ╠══════════════════════════════════════════════════╣
echo  ║  I file originali sono in: %BACKUP_DIR%
echo  ║                                                  ║
echo  ║  Riavvia RefertEco per applicare le modifiche.   ║
echo  ╚══════════════════════════════════════════════════╝
echo.

set /p RIAVVIA= Vuoi avviare RefertEco adesso? (S/N):
if /i "%RIAVVIA%"=="S" (
    start "" "Avvia RefertEco.bat"
)

pause
