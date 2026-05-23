#!/bin/bash
# Sincronizza RefertEco su Google Drive
# Uso: ./gdrive-sync.sh

GDRIVE=~/Library/CloudStorage/GoogleDrive-salvatore.susino93@gmail.com/"Il mio Drive"
SRC="$(dirname "$0")"
DEST="$GDRIVE/RefertEco"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║   Sync RefertEco → Google Drive      ║"
echo "╚══════════════════════════════════════╝"
echo ""
echo "Destinazione: $DEST"
echo ""

rsync -a --delete --progress \
  --exclude='.git/' \
  --exclude='node_modules/' \
  --exclude='agenda-backend/node_modules/' \
  --exclude='dist/RefertEco-Mac-M1/' \
  --exclude='dist/RefertEco-Mac-Intel/' \
  --exclude='*.log' \
  --exclude='.DS_Store' \
  "$SRC/" "$DEST/"

echo ""
echo "✅ Sincronizzazione completata!"
echo "   Dimensione: $(du -sh "$DEST" | cut -f1)"
echo ""
