# RIPRENDI QUI — Stato del progetto RefertEco

> **Per il prossimo Claude che apre questa repo**: leggi questo file COMPLETO prima di
> fare qualsiasi modifica. Contiene il contesto delle conversazioni precedenti, le
> decisioni prese, e i prossimi passi.

Ultimo aggiornamento: **2026-05-19**, dopo la sessione di refactor e fix di Salvatore.

---

## 1. CHI È L'UTENTE

**Dott. Salvatore Susino**, medico radiologo. Usa RefertEco nel suo ambulatorio
privato per scrivere referti ecografici, importare immagini DICOM, esportare PDF.

Profilo:
- **Non programmatore** — non sa leggere codice, ma capisce bene le spiegazioni a parole
- Preferisce **soluzioni semplici e a un click**
- Vuole sapere *cosa* fai e *perché*, non *come* lo fai tecnicamente
- Lavora su **Windows 11** principalmente, ma installerà anche su Mac e su un altro PC Windows
- Vuole **sincronizzazione automatica** tra PC tramite Google Drive

Linee guida per parlare con lui:
- Italiano, tono colloquiale ma chiaro
- Spiega gli errori con cause e soluzioni, non con stack trace
- Conferma sempre prima di operazioni distruttive (cancellazioni, force push, ecc.)

---

## 2. ARCHITETTURA DEL PROGETTO

### Stack
- **Backend**: Node.js + Express
- **Database**: file JSON (`referteco_data.json`) — non SQLite nonostante il BRIEFING originale
- **Frontend**: HTML + CSS + JS vanilla
- **Porta**: 3000

### Struttura cartelle sul PC dello sviluppatore (questo)

```
C:\Users\sunis\Desktop\RefertEco\            ← SORGENTE (per modifiche)
├── server.js, config.js, database.js, ...
├── public/                                   ← frontend
├── dist/RefertEco-Windows/RefertEco-Windows\ ← installer pronto Windows
├── dist/RefertEco-Mac-Intel/                 ← installer Mac Intel
├── dist/RefertEco-Mac-M1/                    ← installer Mac Silicon
├── dist/RefertEco-Windows.zip                ← installer pronto da distribuire
└── .git/                                     ← repository git (remote = GitHub)

C:\Users\sunis\AppData\Local\RefertEco\      ← INSTALLAZIONE ATTIVA (in esecuzione)
└── (copia del contenuto di dist\RefertEco-Windows\RefertEco-Windows\)

G:\Il mio Drive\RefertEco Dati Pazienti\     ← DATI PAZIENTI (Google Drive)
├── referteco_data.json                       ← DB
└── immagini\<refertoId>\*.dcm                ← immagini DICOM

G:\Il mio Drive\Installer RefertEco\         ← INSTALLER ZIP (per altri PC)
└── RefertEco-Windows.zip

C:\Users\sunis\.referteco\config.json        ← config locale (dataDir + apiKey)
```

### Repository GitHub
- URL: **https://github.com/salvatoresusino93-source/RefertEco**
- Branch: `main`
- Identità git: `Salvatore Susino <salvatore.susino93@gmail.com>`
- `.gitignore` esclude: `node_modules/`, `dist/`, `referteco.db`, `referteco_data.json`,
  `config.json`, `immagini/`, ecc. (vedi file)

### Workflow di rilascio
Quando si fa una modifica:
1. Modifica in `AppData\Local\RefertEco\` (funziona subito riavviando il server)
2. Propaga in `Desktop\RefertEco\` (sorgente) e `Desktop\RefertEco\dist\...` (installer)
3. Aggiorna cache-buster nei 3 `index.html` (`?v=YYYYMMDDx`)
4. `git add -A && git commit && git push`
5. **Solo se l'utente lo chiede esplicitamente**: ricostruisci lo ZIP in `dist/` e
   copialo su `G:\Il mio Drive\Installer RefertEco\RefertEco-Windows.zip`

---

## 3. FUNZIONALITÀ E FIX FATTI IN QUESTA SESSIONE (19/05/2026)

### Bug DICOM JPEG Lossless
- Problema: MRI/CT non visualizzati ("pixel bianchi e neri")
- Causa: il codice trattava il JPEG Lossless come JPEG normale; il browser non sa decodificarlo
- Causa secondaria: dicom-parser non popolava `el.items` per alcuni file → cadeva su path raw
- Fix: aggiunto `jpeg-lossless-decoder.min.js` in `public/lib/`, funzioni
  `_jpegIsBaseline()` + `_renderJpegLossless()`, fallback con scansione manuale degli
  item delimiter (`FE FF 00 E0`) quando dicom-parser non popola `el.items`

### Import cartelle con sottocartelle
- Drag-and-drop di intere cartelle DICOM (recursivo via `webkitGetAsEntry`)
- Pulsante 📂 con `webkitdirectory` per selezione folder
- Rilevamento DICOM via magic byte `DICM` all'offset 128 (per file senza estensione .dcm)
- Nomi file univoci basati sul path (es. `Series1__IM00001.dcm`) per evitare collisioni
- Upload batched a 30 file alla volta
- **Applicato sia alla refertazione che all'archivio** (entrambi i flussi avevano funzioni separate, ora unificate)

### Bug "Caricamento..." eterno sui referti vecchi
- `apiGet` non gestiva errori → promise rejected silenziosa
- Fix: `apiGet` ora propaga errori, `loadImmagini` mostra messaggio + pulsante "Riprova"

### Sincronizzazione Google Drive a 1-click
- `detectGoogleDrive()` ora cerca **"RefertEco Dati Pazienti"** (default) e "RefertEco" (fallback)
- Supporta "Il mio Drive" (italiano) e "My Drive" (inglese)
- Supporta lettere drive G-K (Mirror Drive su Windows)
- UI Impostazioni: box verde con percorso rilevato + pulsante "⚡ Usa questa cartella (1 click)"
- Bug correlato fixato: `config.js` ora rimuove BOM UTF-8 in `load()` (PowerShell aggiungeva BOM rompendo JSON.parse)

### Eliminazione referto pulisce anche immagini
- Prima: DELETE rimuoveva solo il record DB, lasciando cartelle orfane su Drive
- Fix: `fs.rmSync(dir, { recursive:true })` dopo cancellazione record
- Endpoint `POST /api/referti/pulisci-orfane` per cleanup cartelle pre-esistenti
- Pulsante "🧹 Cerca e cancella cartelle orfane" in Impostazioni > Manutenzione

### Altro
- Icona RefertEco (file `.ico` multi-risoluzione 16/24/32/48/64/128/256 px)
- Favicon nel browser (`favicon.ico`, `favicon-32.png`, `icon-192.png`)
- `Installa.bat` aggiornato per applicare l'icona al collegamento Desktop
- Server limite upload alzato a 2000 file (era 50, faceva fallire serie DICOM grandi)
- Cache busting nei `<script>` per evitare problemi di cache browser

---

## 4. CONFIGURAZIONE CORRENTE

### `~/.referteco/config.json`
```json
{
  "dataDir": "G:\\Il mio Drive\\RefertEco Dati Pazienti",
  "anthropicApiKey": "sk-ant-api03-..."
}
```

**⚠️ Importante**: la chiave API Anthropic è in questo file. **Mai loggarla, mai stamparla,
mai committarla**. Il `.gitignore` esclude `config.json`. Se vedi che sta uscendo nei
log o nelle risposte, avvisa l'utente di rigenerarla.

### Google Drive
- Cartella dati: `G:\Il mio Drive\RefertEco Dati Pazienti\`
- Cartella installer: `G:\Il mio Drive\Installer RefertEco\`
- Sull'altro PC (Mac/Win) si chiamerà con percorso diverso ma stesso nome cartella
- Modalità richiesta: **Mirror file** (no Stream — il file deve essere fisicamente in locale)

---

## 5. COSE DA NON FARE / TRAPPOLE NOTE

1. **PowerShell `Set-Content` o `Out-File` con `-Encoding utf8`** aggiungono BOM UTF-8.
   Questo rompe `JSON.parse` di Node e mojibake i caratteri Unicode in HTML.
   Usa sempre `[System.IO.File]::WriteAllText($path, $text, $utf8NoBom)` dove
   `$utf8NoBom = New-Object System.Text.UTF8Encoding $false`.

2. **Non modificare** il file `referteco_data.json` o la cartella `immagini/`
   direttamente dal codice. È il database dell'utente, ha referti VERI.

3. **L'app gira sempre** da `C:\Users\sunis\AppData\Local\RefertEco\` (NON dal Desktop).
   Quindi modificare solo i file in `Desktop\` non ha effetto immediato. Devi propagare
   anche in `AppData\` per testare. Vedi sezione 2 → Workflow di rilascio.

4. **Cache browser**: dopo modifiche a `app.js`, il browser carica la versione vecchia.
   Aggiorna il cache-buster (`?v=YYYYMMDDx`) in tutti gli `index.html`.

5. **Force push solo se richiesto esplicitamente**. Il branch `main` può contenere
   commit di altri PC dell'utente (ha un MacBook). Verifica sempre prima.

6. **NON fare modifiche durante un upload in corso** o quando l'utente sta usando
   l'app — può causare disconnessione del browser e perdita di lavoro.

---

## 6. PROGETTO IN SOSPESO: INTEGRAZIONE ORTHANC

L'utente ha un sistema Orthanc esistente (PACS) configurato da un ingegnere ora
irreperibile. **Non funziona da un po' di tempo**.

Workflow originale (presunto):
1. Ecografo invia DICOM via rete Ethernet al server Orthanc
2. Orthanc riceve e (probabilmente) inoltra le immagini a un altro PC/server locale
3. Da lì le immagini dovrebbero arrivare al PC di lavoro

Stato attuale:
- L'utente **non sa dove sia fisicamente il PC server Orthanc**
- Ha solo una scheda tecnica cartacea dell'ingegnere
- Il PC di lavoro su cui dovrà operare è **SU UNA RETE DIVERSA** da quello attuale

Roadmap futura (quando arriverà sull'altro PC):
1. **Identificare** il PC server Orthanc (potrebbe essere lo stesso o un altro)
2. **Diagnosticare** perché non funziona (servizio fermato, IP cambiato, firewall, disco pieno?)
3. **Verificare** la web UI di Orthanc (`http://IP:8042` di default)
4. **Riparare** o ricostruire la configurazione
5. **Integrare** con RefertEco: cartella `inbox` su Google Drive dove Orthanc deposita
   i nuovi DICOM, e RefertEco mostra una sezione "Immagini in arrivo da ecografo"
   con matching automatico paziente↔referto basato su `PatientName + StudyDate`

Alternativa proposta (se Orthanc è irrecuperabile):
- Implementare DICOM Storage SCP **direttamente dentro RefertEco** usando
  la libreria Node.js [`dcmjs-dimse`](https://github.com/PantelisGeorgiadis/dcmjs-dimse)
- Roadmap ~30-35 ore di sviluppo

---

## 7. COME RIPRENDERE LA SESSIONE SUL NUOVO PC

Sul nuovo PC, dopo aver clonato la repo:

```bash
git clone https://github.com/salvatoresusino93-source/RefertEco.git
cd RefertEco
npm install
```

Poi apri Claude Code in quella cartella e **come PRIMO messaggio scrivi**:

> Leggi `RIPRENDI_QUI.md` e `BRIEFING_ClaudeCode.md` prima di iniziare.
> Poi conferma in 5 righe cosa è già stato fatto e cosa resta da fare.

In questo modo il nuovo Claude:
1. Sa chi sei
2. Sa cosa è stato fatto
3. Sa cosa devi ancora fare (Orthanc)
4. Sa evitare le trappole note (cache, BOM, force push, ecc.)

---

## 8. CONTATTO

Repository: https://github.com/salvatoresusino93-source/RefertEco
Issue tracker: nessuno (si parla direttamente in chat con Claude)
