#!/bin/bash
set -e

NODE_VER="20.19.0"

echo ""
echo "  RefertEco — Build distributivi"
echo "  ================================"
echo "  Node.js LTS v${NODE_VER}"
echo ""

rm -rf dist
mkdir -p dist/bin

# ── ICONA APP ────────────────────────────────────────────────────
echo "  [0/3] Genero icona..."
python3 make_icon.py
echo ""

# ── SCARICA BINARI NODE.JS ───────────────────────────────────────
echo "  [1/3] Scarico Node.js per Mac Apple Silicon..."
curl -# -L "https://nodejs.org/dist/v${NODE_VER}/node-v${NODE_VER}-darwin-arm64.tar.gz" \
  | tar -xz -C dist/bin --strip-components=2 "node-v${NODE_VER}-darwin-arm64/bin/node"
mv dist/bin/node dist/bin/node-arm64
chmod +x dist/bin/node-arm64
echo "        ✓"

echo "  [2/3] Scarico Node.js per Mac Intel..."
curl -# -L "https://nodejs.org/dist/v${NODE_VER}/node-v${NODE_VER}-darwin-x64.tar.gz" \
  | tar -xz -C dist/bin --strip-components=2 "node-v${NODE_VER}-darwin-x64/bin/node"
mv dist/bin/node dist/bin/node-x64
chmod +x dist/bin/node-x64
echo "        ✓"

echo "  [3/3] Scarico Node.js per Windows..."
curl -# -L "https://nodejs.org/dist/v${NODE_VER}/node-v${NODE_VER}-win-x64.zip" -o dist/bin/node-win.zip
unzip -q -j dist/bin/node-win.zip "node-v${NODE_VER}-win-x64/node.exe" -d dist/bin/
mv dist/bin/node.exe dist/bin/node-win.exe
rm dist/bin/node-win.zip
echo "        ✓"

echo ""
echo "  Creo i pacchetti..."

# ── COPIA FILE APP IN UNA CARTELLA RISORSE ───────────────────────
pack_resources() {
  local DIR=$1
  mkdir -p "$DIR"
  cp server.js database.js config.js package.json "$DIR/"
  cp -r public "$DIR/"
  mkdir -p "$DIR/immagini"
  mkdir -p "$DIR/node_modules"
  cp -r node_modules/express \
        node_modules/accepts \
        node_modules/array-flatten \
        node_modules/body-parser \
        node_modules/bytes \
        node_modules/call-bind-apply-helpers \
        node_modules/call-bound \
        node_modules/content-disposition \
        node_modules/content-type \
        node_modules/cookie \
        node_modules/cookie-signature \
        node_modules/debug \
        node_modules/depd \
        node_modules/destroy \
        node_modules/dunder-proto \
        node_modules/ee-first \
        node_modules/encodeurl \
        node_modules/escape-html \
        node_modules/etag \
        node_modules/finalhandler \
        node_modules/forwarded \
        node_modules/fresh \
        node_modules/function-bind \
        node_modules/get-intrinsic \
        node_modules/get-proto \
        node_modules/gopd \
        node_modules/has-symbols \
        node_modules/hasown \
        node_modules/http-errors \
        node_modules/iconv-lite \
        node_modules/inherits \
        node_modules/ipaddr.js \
        node_modules/math-intrinsics \
        node_modules/media-typer \
        node_modules/merge-descriptors \
        node_modules/methods \
        node_modules/mime \
        node_modules/mime-db \
        node_modules/mime-types \
        node_modules/ms \
        node_modules/negotiator \
        node_modules/on-finished \
        node_modules/parseurl \
        node_modules/path-to-regexp \
        node_modules/proxy-addr \
        node_modules/qs \
        node_modules/range-parser \
        node_modules/raw-body \
        node_modules/router \
        node_modules/safe-buffer \
        node_modules/safer-buffer \
        node_modules/send \
        node_modules/serve-static \
        node_modules/setprototypeof \
        node_modules/side-channel \
        node_modules/side-channel-list \
        node_modules/side-channel-map \
        node_modules/side-channel-weakmap \
        node_modules/statuses \
        node_modules/toidentifier \
        node_modules/type-is \
        node_modules/unpipe \
        node_modules/utils-merge \
        node_modules/vary \
        node_modules/multer \
        node_modules/busboy \
        node_modules/streamsearch \
        node_modules/append-field \
        node_modules/concat-stream \
        node_modules/buffer-from \
        node_modules/string_decoder \
        node_modules/typedarray \
        node_modules/util-deprecate \
        node_modules/es-errors \
        node_modules/es-define-property \
        node_modules/es-object-atoms \
        node_modules/object-inspect \
        "$DIR/node_modules/" 2>/dev/null || true
}

# ── CREA .APP BUNDLE PER MAC (via osacompile) ────────────────────
make_mac_app() {
  local APP=$1
  local NODE_BIN=$2

  cat > /tmp/referteco_launcher.applescript << 'APPLESCRIPT'
on run
  try
    do shell script "/usr/sbin/lsof -ti tcp:3000 2>/dev/null | xargs /bin/kill -9 2>/dev/null"
    delay 0.5
  end try

  set resPath to POSIX path of (path to me) & "Contents/Resources/"
  set nodeBin to resPath & "node"
  set serverJs to resPath & "server.js"

  do shell script "/usr/bin/nohup " & quoted form of nodeBin & " " & quoted form of serverJs & " > /tmp/referteco.log 2>&1 &"

  set serverReady to false
  repeat 40 times
    try
      do shell script "/usr/bin/nc -z -w1 127.0.0.1 3000 2>/dev/null"
      set serverReady to true
      exit repeat
    end try
    delay 0.5
  end repeat

  open location "http://localhost:3000"
end run

on reopen
  open location "http://localhost:3000"
end reopen
APPLESCRIPT

  rm -rf "$APP"
  osacompile -o "$APP" /tmp/referteco_launcher.applescript

  local RES="$APP/Contents/Resources"

  /usr/libexec/PlistBuddy -c "Set :CFBundleName RefertEco"                        "$APP/Contents/Info.plist"
  /usr/libexec/PlistBuddy -c "Set :CFBundleIconFile RefertEco"                    "$APP/Contents/Info.plist"
  /usr/libexec/PlistBuddy -c "Add :CFBundleIdentifier string it.susino.referteco" "$APP/Contents/Info.plist"
  /usr/libexec/PlistBuddy -c "Add :LSUIElement bool true"                         "$APP/Contents/Info.plist"

  pack_resources "$RES"
  cp "$NODE_BIN" "$RES/node"
  chmod +x "$RES/node"
  cp RefertEco.icns "$RES/"
}

# ── SCRIPT INSTALLAZIONE MAC ──────────────────────────────────────
make_mac_installer() {
  local DIR=$1
  cat > "$DIR/Installa RefertEco.command" << 'INSTALLER'
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_SRC="$SCRIPT_DIR/RefertEco.app"
APP_DEST="/Applications/RefertEco.app"

echo ""
echo "  RefertEco — Installazione"
echo "  =========================="
echo ""

echo "  Copio RefertEco in Applicazioni..."
rm -rf "$APP_DEST"
cp -r "$APP_SRC" "$APP_DEST"
echo "  ✓ App installata in /Applications/"
echo ""

echo "  Creo collegamento sul Desktop..."
osascript << 'APPLESCRIPT'
tell application "Finder"
  set appAlias to POSIX file "/Applications/RefertEco.app" as alias
  set desktopFolder to path to desktop
  make new alias file at desktopFolder to appAlias
  set name of result to "RefertEco"
end tell
APPLESCRIPT

echo "  ✓ Collegamento creato sul Desktop"
echo ""
echo "  ════════════════════════════════════════════"
echo "  Installazione completata!"
echo ""
echo "  Ora puoi aprire RefertEco dal collegamento"
echo "  sul Desktop oppure da Applicazioni."
echo ""
echo "  NOTA: alla prima apertura macOS potrebbe"
echo "  chiedere conferma. Clicca «Apri»."
echo "  ════════════════════════════════════════════"
echo ""
read -n 1 -s -r -p "  Premi un tasto per chiudere..."
echo ""
INSTALLER
  chmod +x "$DIR/Installa RefertEco.command"
}

# ── PACCHETTO MAC APPLE SILICON ──────────────────────────────────
OUTDIR="dist/RefertEco-Mac-M1"
mkdir -p "$OUTDIR"
make_mac_app "$OUTDIR/RefertEco.app" "dist/bin/node-arm64"
make_mac_installer "$OUTDIR"

cat > "$OUTDIR/LEGGIMI.txt" << 'EOF'
RefertEco — Gestionale referti ecografici
==========================================

INSTALLAZIONE RAPIDA:
  Doppio clic su "Installa RefertEco.command"
  Verrà installata in Applicazioni e apparirà
  un collegamento sul Desktop.

AVVIO:
  Doppio clic su "RefertEco" sul Desktop
  (oppure da Applicazioni)
  Il browser si aprirà automaticamente.

PRIMA APERTURA (sicurezza Mac):
  Se compare "non puoi aprire l'applicazione":
  1. Tasto destro → "Apri"
  2. Clicca "Apri"
  (solo la prima volta)

I TUOI DATI:
  I referti sono salvati in:
  ~/.referteco/referteco_data.json
  Fanne backup regolare con il pulsante "Backup".

TRASFERIMENTO SU ALTRO MAC:
  Copia anche ~/.referteco/referteco_data.json
  nella stessa posizione sul nuovo computer.
  Oppure usa Google Drive dalle Impostazioni.
EOF

cd dist
COPYFILE_DISABLE=1 zip -r RefertEco-Mac-M1.zip RefertEco-Mac-M1/ -x "*.DS_Store" -x "*/__MACOSX/*"
cd ..
echo "        ✓ RefertEco-Mac-M1.zip"

# ── PACCHETTO MAC INTEL ──────────────────────────────────────────
OUTDIR="dist/RefertEco-Mac-Intel"
rm -rf "$OUTDIR"
cp -r "dist/RefertEco-Mac-M1" "$OUTDIR"
cp "dist/bin/node-x64" "$OUTDIR/RefertEco.app/Contents/Resources/node"
chmod +x "$OUTDIR/RefertEco.app/Contents/Resources/node"
make_mac_installer "$OUTDIR"

cd dist
COPYFILE_DISABLE=1 zip -r RefertEco-Mac-Intel.zip RefertEco-Mac-Intel/ -x "*.DS_Store" -x "*/__MACOSX/*"
cd ..
echo "        ✓ RefertEco-Mac-Intel.zip"

# ── PACCHETTO WINDOWS ────────────────────────────────────────────
OUTDIR="dist/RefertEco-Windows"
pack_resources "$OUTDIR"
cp dist/bin/node-win.exe "$OUTDIR/node.exe"

cat > "$OUTDIR/Avvia RefertEco.bat" << 'EOF'
@echo off
cd /d "%~dp0"
echo.
echo   RefertEco in avvio...
echo   Attendi qualche secondo...
echo.

start /b node.exe server.js > "%TEMP%\referteco.log" 2>&1

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
EOF

cat > "$OUTDIR/Installa RefertEco.bat" << 'EOF'
@echo off
setlocal
set SCRIPT_DIR=%~dp0
set DEST_DIR=%USERPROFILE%\AppData\Local\RefertEco
set DESKTOP=%USERPROFILE%\Desktop

echo.
echo   RefertEco - Installazione
echo   ==========================
echo.

echo   Copio i file in %DEST_DIR%...
if exist "%DEST_DIR%" rd /s /q "%DEST_DIR%"
xcopy /e /i /q "%SCRIPT_DIR%." "%DEST_DIR%"

echo   Creo collegamento sul Desktop...
powershell -NoProfile -Command ^
  "$ws = New-Object -ComObject WScript.Shell;" ^
  "$sc = $ws.CreateShortcut('%DESKTOP%\RefertEco.lnk');" ^
  "$sc.TargetPath = '%DEST_DIR%\Avvia RefertEco.bat';" ^
  "$sc.WorkingDirectory = '%DEST_DIR%';" ^
  "$sc.Description = 'RefertEco - Gestionale referti ecografici';" ^
  "$sc.Save()"

echo.
echo   Installazione completata!
echo   Trovi RefertEco sul Desktop.
echo.
pause
EOF

cat > "$OUTDIR/LEGGIMI.txt" << 'EOF'
RefertEco — Gestionale referti ecografici
==========================================

INSTALLAZIONE RAPIDA:
  Doppio clic su "Installa RefertEco.bat"
  Verrà copiato in AppData e apparirà
  un collegamento sul Desktop.

AVVIO:
  Doppio clic su "RefertEco" sul Desktop
  Il browser si aprirà automaticamente.

PRIMA APERTURA (sicurezza Windows):
  Se Windows Defender avvisa "app sconosciuta":
  Clicca "Ulteriori informazioni" → "Esegui comunque"

I TUOI DATI:
  I referti sono salvati in:
  C:\Users\<utente>\.referteco\referteco_data.json
  Fanne backup regolare con il pulsante "Backup".
EOF

cd dist
zip -r RefertEco-Windows.zip RefertEco-Windows/
cd ..
echo "        ✓ RefertEco-Windows.zip"

# ── RIEPILOGO ────────────────────────────────────────────────────
echo ""
echo "  ════════════════════════════════════════════"
echo "  ✓  Build completato!"
echo "  ════════════════════════════════════════════"
echo ""
echo "  dist/RefertEco-Mac-M1.zip      Mac Apple Silicon (M1/M2/M3/M4)"
echo "  dist/RefertEco-Mac-Intel.zip   Mac Intel"
echo "  dist/RefertEco-Windows.zip     Windows 64-bit"
echo ""
echo "  Non sai che Mac hai?"
echo "  → Menù Apple → Info su questo Mac"
echo "    'Apple M...' → usa M1 | 'Intel' → usa Intel"
echo ""
ls -lh dist/*.zip
echo ""
