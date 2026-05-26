# RIPRENDI QUI — Stato del progetto RefertEco

> **Per il prossimo Claude che apre questa repo**: leggi questo file COMPLETO prima di
> fare qualsiasi modifica. Contiene il contesto delle conversazioni precedenti, le
> decisioni prese, e i prossimi passi.

Ultimo aggiornamento: **2026-05-26**, sessione pomeriggio/sera (notifiche email+SMS,
SMS Hosting, pulsanti modal in alto, form referto espandibile, F8 dettatura, pulizia repo).

---

## 1. CHI È L'UTENTE

**Dott. Salvatore Susino**, medico radiologo. Usa RefertEco nel suo ambulatorio
privato per scrivere referti ecografici, importare immagini DICOM, esportare PDF.
Ha anche un modulo **Agenda** (sistema prenotazioni) separato.

Profilo:
- **Non programmatore** — non sa leggere codice, ma capisce bene le spiegazioni a parole
- Preferisce **soluzioni semplici e a un click**
- Vuole sapere *cosa* fai e *perché*, non *come* lo fai tecnicamente
- Lavora su **Windows 11** (PC studio), ha anche un MacBook e un secondo PC Windows (workstation)
- Vuole **sincronizzazione automatica** tra PC tramite Google Drive

Linee guida per parlare con lui:
- Italiano, tono colloquiale ma chiaro
- Spiega gli errori con cause e soluzioni, non con stack trace
- Conferma sempre prima di operazioni distruttive (cancellazioni, force push, ecc.)

---

## 2. ARCHITETTURA DEL PROGETTO

Ci sono **due applicazioni distinte**:

### A) RefertEco (referti ecografici)
- **Backend**: Node.js + Express, porta 3000
- **Database**: file JSON (`referteco_data.json`) su Google Drive
- **Frontend**: HTML + CSS + JS vanilla in `public/`
- **Gira**: in locale su ogni PC (AppData + bat di avvio)
- Serve anche come proxy per l'agenda: chiama `https://referteco-production.up.railway.app/api/...`

### B) Agenda Studio (prenotazioni)
- **Backend**: Node.js + Express — `agenda-backend/`
- **Database**: Supabase (PostgreSQL cloud)
- **Frontend**: HTML + CSS + JS vanilla — `agenda-backend/frontend/`
  *(attenzione: i file sorgente stanno in `agenda-frontend/` ma vengono copiati
  dentro `agenda-backend/frontend/` per Railway — vedi sezione 5)*
- **Gira**: su Railway (cloud) → https://referteco-production.up.railway.app/
- **SMS**: Twilio per promemoria appuntamenti
- **Socket.io**: aggiornamento in tempo reale tra più client

### Struttura cartelle sul PC dello sviluppatore

```
C:\Users\sunis\Desktop\RefertEco\            ← SORGENTE (per modifiche)
├── server.js, config.js, database.js, ...   ← RefertEco
├── public/                                   ← frontend RefertEco
├── agenda-backend/                           ← backend Agenda
│   ├── src/app.js                            ← entry point (node src/app.js)
│   ├── src/routes/                           ← API routes
│   ├── src/services/supabase.js              ← client Supabase
│   ├── frontend/                             ← ⚠️ COPIA del frontend per Railway
│   │   ├── index.html
│   │   ├── js/app.js, js/api.js
│   │   └── css/style.css
│   ├── .env                                  ← credenziali Railway/Supabase/Twilio
│   └── package.json
├── agenda-frontend/                          ← frontend Agenda SORGENTE (modificare qui)
│   ├── index.html
│   ├── js/app.js, js/api.js
│   └── css/style.css
├── railway.json                              ← config deploy Railway
└── .git/

C:\Users\sunis\AppData\Local\RefertEco\      ← INSTALLAZIONE ATTIVA RefertEco
G:\Il mio Drive\RefertEco Dati Pazienti\     ← DATI PAZIENTI (Google Drive)
G:\Il mio Drive\Installer RefertEco\         ← INSTALLER ZIP
C:\Users\sunis\.referteco\config.json        ← config locale (dataDir + apiKey)
```

### Repository GitHub
- URL: **https://github.com/salvatoresusino93-source/RefertEco**
- Branch: `main`
- Auto-deploy Railway attivo sul branch `main`
- Root Directory Railway: `/agenda-backend`

---

## 3. FUNZIONALITÀ E FIX — SESSIONE 2026-05-26

### Merge Mac → Windows
- Il branch locale era indietro di 23 commit rispetto al Mac (fast-forward pulito)
- Fatto `git pull` — nessun conflitto

### Slot prenotazione: 20 min → 30 min
File modificati:
- `agenda-frontend/js/app.js` → `const SLOT_MIN = 30`
- `agenda-frontend/index.html` → `step="1800"`, `value="30"` sul campo durata
- **Database Supabase**: migration eseguita via script Node.js → tutti i 68 tipi di esame
  impostati a `durata_minuti = 30` nella tabella `tipi_prestazione`

### Data di nascita obbligatoria nella creazione paziente
- `agenda-frontend/index.html` → `<label>Data di nascita *</label>` + `required`
- `agenda-frontend/js/app.js` → validazione client: alert se campo vuoto
- `agenda-backend/src/routes/pazienti.js` → validazione server:
  `if (!data_nascita) return res.status(400).json({ error: '...' })`

### Duplicato numero di telefono: solo avviso, non blocco
- **Prima**: compariva un `confirm()` con `[OK] = usa paziente esistente` e
  `[Annulla] = crea nuovo paziente` → contro-intuitivo, l'utente si confondeva
- **Ora**: compare un `alert()` con "il numero X è già usato dal paziente Y —
  il nuovo paziente verrà salvato ugualmente", poi il salvataggio avviene in automatico
- Il duplicato **nome + data di nascita** mantiene il `confirm()` (lì è quasi certamente
  la stessa persona → ha senso chiedere)
- File: `agenda-frontend/js/app.js` (e copia in `agenda-backend/frontend/js/app.js`)

### Fix build Railway (⚠️ critico per capire la struttura)
**Problema**: Railway usava `Root Directory = /agenda-backend`, quindi la build context
era solo la cartella `agenda-backend/`. I comandi `cd agenda-backend && npm install`
fallivano perché dentro `agenda-backend/` non esiste un'altra cartella `agenda-backend/`.

**Soluzione applicata**:
1. Il frontend (`agenda-frontend/`) è stato **copiato** dentro `agenda-backend/frontend/`
2. `agenda-backend/src/app.js` usa ora `path.resolve(__dirname, '..', 'frontend')`
3. `railway.json` usa ora `npm install --production` e `node src/app.js` (senza prefisso)

**Regola da ricordare**: quando modifichi il frontend dell'agenda, devi aggiornare
**entrambi** i file:
- `agenda-frontend/js/app.js` ← sorgente
- `agenda-backend/frontend/js/app.js` ← copia per Railway (stesso contenuto)

---

## 4. FUNZIONALITÀ E FIX — SESSIONE 2026-05-19

### Bug DICOM JPEG Lossless
- Fix: decoder `jpeg-lossless-decoder.min.js` + fallback manuale item delimiter

### Import cartelle DICOM con sottocartelle
- Drag-and-drop ricorsivo, rilevamento via magic byte `DICM`, upload batched a 30 file

### Bug "Caricamento..." eterno sui referti vecchi
- `apiGet` ora propaga errori, `loadImmagini` mostra messaggio + pulsante "Riprova"

### Sincronizzazione Google Drive a 1-click
- `detectGoogleDrive()` cerca "RefertEco Dati Pazienti" e "RefertEco" come fallback

### Eliminazione referto pulisce anche immagini
- `fs.rmSync(dir, { recursive:true })` + endpoint `/api/referti/pulisci-orfane`

---

## 5. CONFIGURAZIONE CORRENTE

### `.referteco/config.json` (locale, mai committare)
```json
{
  "dataDir": "G:\\Il mio Drive\\RefertEco Dati Pazienti",
  "anthropicApiKey": "sk-ant-api03-..."
}
```
**⚠️ IMPORTANTE**: la chiave API Anthropic è qui. **Mai loggarla, mai stamparla,
mai committarla**. Il `.gitignore` la esclude.

### `agenda-backend/.env` (locale, mai committare)
Contiene: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `TWILIO_*`, `JWT_SECRET`, `PORT`

### Railway
- Progetto: `referteco`
- Servizio: `agenda-backend`
- URL produzione: https://referteco-production.up.railway.app/
- Root Directory: `/agenda-backend`
- Auto-deploy: **attivo** su push a `main`
- Build: `npm install --production`
- Start: `node src/app.js`

### Google Drive
- Cartella dati: `G:\Il mio Drive\RefertEco Dati Pazienti\`
- Cartella installer: `G:\Il mio Drive\Installer RefertEco\`

---

## 6. COSE DA NON FARE / TRAPPOLE NOTE

1. **Frontend Agenda in due posti**: sorgente in `agenda-frontend/`, copia per Railway in
   `agenda-backend/frontend/`. Quando modifichi `agenda-frontend/js/app.js` o altri file,
   devi fare la stessa modifica in `agenda-backend/frontend/` — altrimenti Railway
   distribuisce la versione vecchia.

2. **PowerShell `Set-Content` / `Out-File` con `-Encoding utf8`** aggiungono BOM UTF-8.
   Usa sempre `[System.IO.File]::WriteAllText($path, $text, $utf8NoBom)`.

3. **Non modificare** `referteco_data.json` o la cartella `immagini/` direttamente.
   Sono i dati reali dei pazienti.

4. **RefertEco gira da AppData**, non da Desktop. Modifiche al Desktop non hanno effetto
   immediato — devi propagare in AppData.

5. **Cache browser**: dopo modifiche a JS/CSS, aggiorna il cache-buster (`?v=YYYYMMDD`)
   in tutti gli `index.html` pertinenti.

6. **Force push solo se richiesto esplicitamente**. Ci sono commit da più PC.

7. **`agenda-backend/.env` e `~/.referteco/config.json` non vanno mai in git**.
   Entrambi sono in `.gitignore`. Se li vedi staged, fermati.

---

## 7. SESSIONE 2026-05-26 — WORKSTATION IN STUDIO

### Orthanc su Windows (nuovo)
- Il server Linux originale (192.168.1.77) era irraggiungibile (btrfs corrotto, no monitor/tastiera)
- Installato **Orthanc 1.12.11** direttamente su questa workstation (`C:\Program Files\Orthanc Server`)
- Storage DICOM: `F:\OrthancStorage`
- AET: `ORTHANC`, HTTP: 8042, DICOM: 4242
- Gira come servizio Windows (avvio automatico)
- Config: `C:\Program Files\Orthanc Server\Configuration\orthanc.json`
- Ecografo Samsung Medison V5 da configurare: IP .50, inviare a 192.168.1.17:4242 AET ORTHANC

### Integrazione Orthanc → RefertEco
- Pulsante 🏥 nel viewer "Nuovo Referto" apre pannello studi recenti
- `GET /api/orthanc/studi` → lista studi da Orthanc
- `POST /api/orthanc/importa/:studyId` → scarica DICOM nella cartella temp del referto
- Auto-fill nome/nascita/data/tipo dal DICOM

### Integrazione Agenda → RefertEco (questa workstation)
- Pannello verde "Pazienti in attesa" in cima al form (da Agenda Railway)
- Click "Avvia referto →" pre-compila tutti i campi
- Al salvataggio referto → segna appuntamento come "refertato" su Agenda
- Proxy in server.js: `/api/agenda/pazienti-attesa` e `/api/agenda/marca-refertato/:id`

### Notifica email su nuovo appuntamento
- Servizio: **Resend** (`resend` npm package)
- File: `agenda-backend/src/services/email.js`
- Trigger: POST `/api/appuntamenti` → `notificaNuovoAppuntamento(data)`
- Destinatario: `salvatore.susino93@gmail.com`
- Mittente: `onboarding@resend.dev` (free tier Resend)
- Variabile Railway: `RESEND_API_KEY` = `re_hGzWNiTr_...` (non committare)
- ⚠️ La chiave NON è nel .env committato — solo su Railway Variables

### Roadmap Orthanc (da fare quando ecografo configurato)
- Matching automatico paziente: cerca studi Orthanc di oggi con nome = paziente nel form
- Import automatico senza selezione manuale

## 9b. SESSIONE 2026-05-26 — POMERIGGIO/SERA

### Notifiche email (Agenda → Medico)
- Email su **nuovo appuntamento**: verde, oggetto `📅 Nome — Esame — Data ore Ora`
- Email su **annullamento**: rossa, oggetto `❌ ANNULLATO: ...`
- Fix orario: tutte le email usano `timeZone: 'Europe/Rome'` (non più UTC)
- Servizio: **Resend** — file `agenda-backend/src/services/email.js`
- Variabile Railway: `RESEND_API_KEY`
- Endpoint debug: `POST /api/test-email`

### SMS al paziente (SMS Hosting)
- **Promemoria serale**: cron ogni giorno alle 19:00 → SMS per appuntamenti del giorno dopo
- **Promemoria 1 ora prima**: cron ogni minuto controlla appuntamenti tra 59–61 minuti
- **Caso edge**: se prenotazione dopo le 19:00 per domani → SMS immediato
- **Annullamento**: SMS al paziente quando appuntamento viene cancellato
- Servizio: **SMS Hosting** (smshosting.it) — file `agenda-backend/src/services/sms.js`
- Variabili Railway: `SMSHOSTING_API_KEY`, `SMSHOSTING_API_SECRET`, `SMS_SENDER`, `STUDIO_NOME`
- Credenziali SMS Hosting nel pannello: Sviluppatori → Gestione sicurezza API

### Fix UI RefertEco
- **Pulsanti modal archivio in alto**: Elimina/Chiudi/Modifica/Solo referto/Referto+img
  spostati da `.m-ft` in fondo a sopra `.m-body`, con `position:sticky;top:0`
- **Form referto espandibile**: rimosso `max-width:820px` da `.nuovo-form .form-card`,
  MIN_VIEWER ridotto da 180px a 60px, pulsante ◀/▶ per collassare viewer immagini
- **F8 per dettatura**: premi F8 sul form nuovo referto per avviare/fermare il microfono

### Pulizia repository
- Rimossi da git: `referteco_data.json`, `config.json` (dati locali)
- Eliminati: `node_modules/` (root+agenda), `RefertEco_prototipo.html`, `RefertEco.icns`,
  `make_icon.py`, `BRIEFING_ClaudeCode.md`
- `.gitignore` aggiornato con tutte le esclusioni corrette
- Progetto da 66 MB → 2 MB

### Railway — variabili attuali (oltre a quelle precedenti)
```
RESEND_API_KEY         = re_hGzWNiTr_...        (non committare)
SMSHOSTING_API_KEY     = SMSHNJ6I5RWQUJ2CMFJKU  (non committare)
SMSHOSTING_API_SECRET  = KUC3IOCRIMN2328R61Z0XOQ4DWGUD0UG (non committare)
SMS_SENDER             = StudioSusin
STUDIO_NOME            = Studio Dr. Susino
```

---

## 8. PROGETTO IN SOSPESO: INTEGRAZIONE ORTHANC

L'utente ha un sistema Orthanc (PACS) configurato da un ingegnere ora irreperibile.
Non funziona da tempo. Da affrontare quando si lavora sulla workstation in studio.

Workflow originale (presunto):
1. Ecografo → DICOM via rete Ethernet → Orthanc
2. Orthanc → inoltra a PC di lavoro

Stato: PC server Orthanc non localizzato, rete diversa rispetto al PC attuale.

Roadmap:
1. Identificare il PC Orthanc
2. Diagnosticare (`http://IP:8042`)
3. Integrare con RefertEco via cartella `inbox` su Google Drive

Alternativa: DICOM Storage SCP diretto con `dcmjs-dimse` (~30-35 ore sviluppo).

---

## 8. ⚠️ ATTENZIONE — WORKSTATION IN STUDIO: NON SOVRASCRIVERE LE SUE MODIFICHE

La workstation in studio ha già delle **migliorie proprie** che NON esistono in questa repo.
In particolare: **formattazione di stampa** e altre personalizzazioni fatte direttamente su quel PC.

**Quando porti gli aggiornamenti di questa sessione sulla workstation, NON fare mai:**
- `git pull` + sovrascrittura cieca dei file locali
- Copia e incolla di interi file da questa repo sopra i file della workstation
- Nessuna operazione che cancelli o rimpiazzi le modifiche già presenti lì

**Come si fa correttamente:**
1. Prima di tutto, **guarda cosa c'è di diverso** sulla workstation:
   ```bash
   git diff HEAD
   git status
   ```
2. Porta solo le modifiche specifiche di questa sessione (slot 30 min, DOB, duplicato telefono)
   usando `git merge` o applicando manualmente le sole righe cambiate
3. Se un file è diverso su entrambi i lati, **fai un merge manuale** riga per riga —
   non scegliere "la versione mia" o "la versione loro" in blocco
4. Dopo ogni integrazione, **verifica che la stampa e le altre funzioni personalizzate
   funzionino ancora** prima di considerare il lavoro fatto

**In sintesi**: la workstation è una versione parallela con miglioramenti propri.
Gli aggiornamenti vanno *integrati*, non *sovrascritti*.

---

## 9. COME RIPRENDERE SUL NUOVO PC (WORKSTATION IN STUDIO)

Se la repo non è ancora clonata:
```bash
git clone https://github.com/salvatoresusino93-source/RefertEco.git
cd RefertEco
npm install
cd agenda-backend && npm install && cd ..
```

Poi crea il file `agenda-backend/.env` con le credenziali Supabase/Twilio/JWT
(recuperale da Google Drive o dal PC di questo sviluppatore).

**Come PRIMO messaggio a Claude** scrivi:
> Leggi `RIPRENDI_QUI.md` prima di iniziare. Poi dimmi in 5 righe cosa è stato fatto
> e cosa resta da fare.

---

## 10. CONTATTO

Repository: https://github.com/salvatoresusino93-source/RefertEco
