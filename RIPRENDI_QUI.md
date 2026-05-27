# RIPRENDI QUI — Stato del progetto RefertEco

> **Per il prossimo Claude che apre questa repo**: leggi questo file COMPLETO prima di
> fare qualsiasi modifica. Contiene il contesto delle conversazioni precedenti, le
> decisioni prese, e i prossimi passi.

Ultimo aggiornamento: **2026-05-27**, sessione pomeriggio/sera (GBP + festività + GCal + SMS).

---

## 1. CHI È L'UTENTE

**Dott. Salvatore Susino**, medico radiologo. Usa RefertEco nel suo ambulatorio
privato per scrivere referti ecografici, importare immagini DICOM, esportare PDF.
Ha anche un modulo **Agenda** (sistema prenotazioni) separato.

Profilo:
- **Non programmatore** — non sa leggere codice, ma capisce bene le spiegazioni a parole
- Preferisce **soluzioni semplici e a un click**
- Lavora su **Windows 11** (PC principale), ha anche un MacBook e un secondo PC Windows (workstation in studio)
- Vuole **sincronizzazione automatica** tra PC tramite Google Drive

Linee guida:
- Italiano, tono colloquiale ma chiaro
- Spiega errori con cause e soluzioni, non stack trace
- Conferma sempre prima di operazioni distruttive

---

## 2. ARCHITETTURA DEL PROGETTO

Ci sono **due applicazioni distinte** e **due macchine**:

### A) RefertEco (referti ecografici)
- **Backend**: Node.js + Express, porta 3000
- **Database**: file JSON (`referteco_data.json`) — su Google Drive o `K:\RefertEco Dati Pazienti` (workstation)
- **Frontend**: HTML + CSS + JS vanilla in `public/`
- **Gira**: in locale su ogni PC (AppData + bat di avvio)
- Serve anche come proxy per l'agenda: `/api/agenda/pazienti-attesa` e `/api/agenda/marca-refertato/:id`

### B) Agenda Studio (prenotazioni)
- **Backend**: Node.js + Express — `agenda-backend/`
- **Database**: Supabase (PostgreSQL cloud)
- **Frontend**: HTML + CSS + JS vanilla — `agenda-backend/frontend/`
  *(⚠️ sorgente in `agenda-frontend/`, COPIA per Railway in `agenda-backend/frontend/` — modificare ENTRAMBI)*
- **Gira**: su Railway (cloud) → https://referteco-production.up.railway.app/
- **SMS**: SMS Hosting (smshosting.it)
- **Email**: Resend (resend.com)
- **Socket.io**: aggiornamento real-time

### Struttura cartelle

```
Desktop\RefertEco\                            ← SORGENTE (questo PC)
├── server.js, config.js, database.js, ...   ← RefertEco
├── public/                                   ← frontend RefertEco
├── agenda-backend/
│   ├── src/app.js                            ← entry point Railway
│   ├── src/routes/, src/services/
│   ├── frontend/                             ← ⚠️ COPIA per Railway
│   └── .env                                  ← credenziali (non in git)
├── agenda-frontend/                          ← sorgente frontend agenda
└── railway.json

AppData\Local\RefertEco\                      ← INSTALLAZIONE ATTIVA (questo PC)
G:\Il mio Drive\RefertEco Dati Pazienti\     ← dati pazienti (Google Drive)
G:\Il mio Drive\Installer RefertEco\         ← installer ZIP + RIPRENDI_QUI
~\.referteco\config.json                      ← config locale (non in git)
```

### Workstation in studio (PC separato)
```
K:\OrthancStorage\                            ← immagini DICOM da ecografo
K:\OrthancWorklists\                          ← file .wl per DICOM Worklist
K:\RefertEco Dati Pazienti\                  ← DB referti (invece di Google Drive)
C:\Program Files\Orthanc Server\             ← Orthanc 1.12.11 come servizio Windows
  └── Configuration\orthanc.json + worklists.json
```

### Repository GitHub
- URL: **https://github.com/salvatoresusino93-source/RefertEco**
- Branch: `main`
- Auto-deploy Railway attivo su push a `main`
- Root Directory Railway: `/agenda-backend`

---

## 3. FIX SESSIONE 2026-05-27 POMERIGGIO/SERA — Google Calendar + Festività + GBP

### Festività italiane in agenda (blocco prenotazioni)
- Nuovo file: `agenda-backend/src/services/festivita.js`
  - Calcola tutte le festività italiane inclusa Pasqua (algoritmo Anonymous Gregoriano)
  - `popolaFestivita(anno)`: inserisce festività in `blocchi_agenda` (tipo='festivo'), skip se già presenti
  - Avviata a ogni boot del server + cron 1 gennaio 09:00 per anno nuovo
- Nuova tabella Supabase: `blocchi_agenda` (id, data_ora_inizio, data_ora_fine, motivo, tipo, tutto_il_giorno)
  - tipo: 'festivo' | 'manuale' | 'google_calendar'
- Nuove route `agenda-backend/src/routes/blocchi.js`: GET/POST/DELETE /api/blocchi
- Frontend: giorni festivi mostrati in rosso, slot bloccati, click mostra alert invece del modal

### Google Calendar sync
- Nuovo servizio: `agenda-backend/src/services/googleCalendar.js`
  - Service Account JWT auth (RS256 + jsonwebtoken) — NO googleapis package
  - `creaEvento(appuntamento)`: crea evento con `extendedProperties.private.agendaStudioId`
  - `eliminaEventoByAgendaId(id)`: cerca e cancella evento per ID (senza colonna DB)
  - `leggiEventiPersonali(da, a)`: legge eventi NON creati da Agenda Studio
  - `aggiornaEvento(googleEventId, app)`: aggiorna evento esistente (PATCH)
- `appuntamenti.js`: crea evento GCal su POST, elimina su DELETE
- `reminder.js`: cron 06:00 → `sincronizzaBlocchiGoogleCalendar()` importa impegni personali
  come blocchi tipo='google_calendar' per i prossimi 30 giorni
- Variabili Railway: `GOOGLE_PRIVATE_KEY` (JSON completo service account), `GOOGLE_CLIENT_EMAIL`,
  `GOOGLE_CALENDAR_ID` (=salvatoresusino.md@gmail.com)
- Service account: `agenda-calendar@agendastudio-497611.iam.gserviceaccount.com`

### Google Business Profile — orari automatici
- Nuovo servizio: `agenda-backend/src/services/googleBusiness.js`
  - Orari base: Martedì + Venerdì 9:00-13:00 e 15:00-19:00
  - `impostaOrariBase()`: setta regularHours su GBP (da chiamare una tantum)
  - `aggiornaOreSettimana()`: calcola specialHours per i prossimi 30 giorni
    - Festivi (blocchi_agenda tipo='festivo') → mostra chiuso
    - Impegni personali GCal su Mar/Ven → riduce orari (es. impegno 10-12 → aperto 9-10 e 12-13)
    - Giorni normali → nessun override (regularHours già corretto)
  - OAuth2 refresh token flow per account `salvatoresusino.md@gmail.com`
- Nuove route: `agenda-backend/src/routes/gbp.js`
  - GET /api/gbp/setup — pagina HTML per autorizzazione OAuth una tantum
  - GET /api/gbp/callback — riceve code, mostra refresh token
  - POST /api/gbp/set-regular-hours — imposta orari base GBP
  - POST /api/gbp/aggiorna-orari — trigger manuale aggiornamento
  - GET /api/gbp/status — verifica configurazione
- Cron domenica 20:00 Europe/Rome → aggiorna specialHours GBP
- Variabili Railway GBP (già impostate):
  ```
  GOOGLE_OAUTH_CLIENT_ID     = <da Railway dashboard>
  GOOGLE_OAUTH_CLIENT_SECRET = <da Railway dashboard>
  GOOGLE_OAUTH_REFRESH_TOKEN = <da Railway dashboard>
  GOOGLE_OAUTH_REDIRECT_URI  = https://referteco-production.up.railway.app/api/gbp/callback
  GBP_LOCATION_NAME          = (opzionale, si scopre automaticamente)
  ```

### ⚠️ PENDING — API access GBP in attesa di approvazione Google
- La `mybusinessaccountmanagement.googleapis.com` ha quota=0 di default (richiede allowlist)
- **Richiesta inviata il 2026-05-27** — Case ID: **1-7862000040720**
- Tempo stimato: 7-10 giorni lavorativi
- Quando arriva l'email di approvazione da Google:
  1. Eseguire: `railway run node scripts/setup-gbp-hours.js`
     (il file è già scritto, lo ricreo se serve)
  2. Oppure chiamare POST `/api/gbp/set-regular-hours` e poi `/api/gbp/aggiorna-orari`
- Prima di quel momento, tutto il resto funziona (SMS, Calendar, festività)

### Fix SMS delivery (sessione stessa)
- `sms.js`: rimosso parametro `from` — SMS Hosting usa numero fisso 394390009000
- `appuntamenti.js`: aggiunto import e chiamata `inviaSmsConferma` su POST (era mancante)
- Testo SMS: "presso lo Studio" (non "il Studio")
- Testato su WindTre (351 374 6102) ✓ — Spusu non compatibile (MVNO)

---

## 4. FIX SESSIONE 2026-05-27 (questo PC — agenda iOS)

### Fix pulsante Salva non raggiungibile su iPhone
- **Problema**: su iOS Safari il modal dell'agenda sale dal basso (bottom sheet).
  Quando si tocca un campo e appare la tastiera, la tastiera copre il footer col pulsante Salva.
  `position:fixed` rimane ancorato alla layout viewport, non alla visual viewport.
- **Fix**: Visual Viewport API — al resize del viewport (apertura tastiera) aggiorniamo
  `top` e `height` dell'overlay così copre solo la zona visibile sopra la tastiera.
  CSS `[data-vv]`: il modal usa `%` invece di `vh`.
- File: `agenda-frontend/js/app.js` (e copia in `agenda-backend/frontend/js/app.js`)
  + `agenda-frontend/css/style.css` + `agenda-backend/frontend/css/style.css`

---

## 5. FIX SESSIONE 2026-05-26 MATTINA (questo PC — agenda)

### Merge Mac → Windows
- Il branch locale era indietro di 23 commit (fast-forward pulito)

### Slot prenotazione: 20 min → 30 min
- `agenda-frontend/js/app.js` → `const SLOT_MIN = 30`
- Database Supabase: tutti i 68 tipi di esame aggiornati a `durata_minuti = 30`

### Data di nascita obbligatoria
- Validazione frontend (alert) + backend (HTTP 400)

### Duplicato telefono: solo avviso, salva comunque
- Prima: `confirm()` confuso (OK=usa-esistente, Annulla=crea-nuovo)
- Ora: `alert()` informativo → salvataggio automatico con `forza_creazione:true`

### Fix build Railway
- Frontend copiato in `agenda-backend/frontend/` (incluso nel build context)
- `railway.json`: `npm install --production` e `node src/app.js` (senza prefisso)

---

## 6. FIX SESSIONE 2026-05-26 POMERIGGIO/SERA (workstation in studio)

> ⚠️ Queste modifiche sono state fatte sulla **workstation in studio** (PC separato).
> Alcuni di questi fix potrebbero non essere ancora in sync con questo PC.

### Notifiche email (Agenda → Medico)
- Email su nuovo appuntamento (verde) e annullamento (rossa) via **Resend**
- File: `agenda-backend/src/services/email.js`
- Variabile Railway: `RESEND_API_KEY = re_hGzWNiTr_...` (non committare mai)
- Endpoint debug: `POST /api/test-email`
- Fix orario: `timeZone: 'Europe/Rome'` (non più UTC)

### SMS al paziente (SMS Hosting)
- Promemoria serale (cron 19:00) per appuntamenti del giorno dopo
- Promemoria 1 ora prima (cron ogni minuto)
- Caso edge: prenotazione dopo le 19:00 per domani → SMS immediato
- Annullamento → SMS al paziente
- File: `agenda-backend/src/services/sms.js`
- Variabili Railway: `SMSHOSTING_API_KEY`, `SMSHOSTING_API_SECRET`, `STUDIO_NOME`
- **`SMS_SENDER` NON viene più usato** (vedi fix sotto)

### Fix SMS delivery — 2026-05-27 sera
- **Problema**: SMS non arrivavano nonostante `smsInserted:1` nell'API response.
  Causa: il campo `from` con mittente alfanumerico ("Dr Susino") non è registrato su SMS Hosting
  → viene rimpiazzato da `#RANDOMNUM#` → gli operatori italiani (TIM, Vodafone, WindTre, Iliad)
  filtrano/bloccano questi SMS come spam.
- **Fix**: rimosso il parametro `from` dalla chiamata API in `sms.js` e `/api/test-sms`.
  Senza `from`, SMS Hosting usa il proprio numero fisso `394390009000`, già registrato
  presso gli operatori, con consegna molto più affidabile.
- Gli SMS appaiono ora sul cellulare come mittente `+39 439 000 9000` (SMS Hosting).
- **Se in futuro si vuole un mittente personalizzato** (es. "StudioSus"):
  contattare SMS Hosting support e richiedere la registrazione del nome mittente.
  Nomi alphanumerici in Italia richiedono approvazione AGCOM. Max 11 caratteri, solo lettere/numeri.

### Orthanc su workstation
- Server Linux originale (192.168.1.77) irraggiungibile (btrfs corrotto)
- Installato **Orthanc 1.12.11** sulla workstation come servizio Windows
- Storage: `K:\OrthancStorage` — AET: `ORTHANC`, HTTP: 8042, DICOM: 4242
- Plugin worklists 0.9.2 attivo (`K:\OrthancWorklists`)
- Ecografo Samsung Medison V5: configurare DICOM Store/Worklist → 192.168.1.17:4242

### Workflow DICOM Worklist (da completare)
```
Segretaria "Arrivato" in Agenda → RefertEco genera .wl → Ecografo legge Worklist
→ Immagini arrivano con AccessionNumber → Auto-import nel referto in corso
```
Endpoint aggiunti:
- `POST /api/worklist/crea` — crea voce worklist
- `GET /api/worklist` — lista attive
- `DELETE /api/worklist/:accession` — rimuove
- `GET /api/orthanc/cerca-accession?n=...` — query studi per accession

### Fix UI RefertEco (workstation)
- **Pulsanti modal archivio in alto**: Elimina/Chiudi/Modifica spostati sopra `.m-body` con `position:sticky;top:0`
- **Form referto espandibile**: rimosso `max-width:820px`, pulsante ◀/▶ collassa viewer
- **F8 dettatura**: premi F8 sul form nuovo referto per avviare/fermare microfono

### Pulizia repository
- Rimossi: `referteco_data.json`, `config.json`, `node_modules/`, file obsoleti
- `.gitignore` aggiornato — progetto da 66 MB → 2 MB

---

## 7. FIX SESSIONE 2026-05-19 (questo PC)

- Bug DICOM JPEG Lossless: decoder + fallback manuale
- Import cartelle DICOM con sottocartelle (drag-and-drop ricorsivo)
- Bug "Caricamento..." eterno: `apiGet` propaga errori
- Sincronizzazione Google Drive a 1-click
- Eliminazione referto pulisce anche immagini

---

## 8. CONFIGURAZIONE CORRENTE

### Variabili Railway (non committare — valori reali su Railway dashboard o su .env locale)
```
SUPABASE_URL                = <da Railway dashboard>
SUPABASE_SERVICE_KEY        = <da Railway dashboard>
JWT_SECRET                  = <da Railway dashboard>
RESEND_API_KEY              = <da Railway dashboard>
SMSHOSTING_API_KEY          = <da Railway dashboard>
SMSHOSTING_API_SECRET       = <da Railway dashboard>
SMS_SENDER                  = (non più usato — mittente fisso 394390009000)
STUDIO_NOME                 = Studio Dr. Susino
STUDIO_TELEFONO             = 339-4028454
# Google Calendar (service account agendastudio-497611)
GOOGLE_PRIVATE_KEY          = <JSON completo service account>
GOOGLE_CLIENT_EMAIL         = agenda-calendar@agendastudio-497611.iam.gserviceaccount.com
GOOGLE_CALENDAR_ID          = salvatoresusino.md@gmail.com
# Google Business Profile (OAuth2 — account salvatoresusino.md@gmail.com)
GOOGLE_OAUTH_CLIENT_ID      = <da Railway dashboard — formato: XXXXXXXXX.apps.googleusercontent.com>
GOOGLE_OAUTH_CLIENT_SECRET  = <da Railway dashboard — formato: GOCSPX-XXXXXXXXXX>
GOOGLE_OAUTH_REFRESH_TOKEN  = <da Railway dashboard — formato: 1//XXXXXXXXXX>
GOOGLE_OAUTH_REDIRECT_URI   = https://referteco-production.up.railway.app/api/gbp/callback
GBP_LOCATION_NAME           = (opzionale — si scopre auto alla prima chiamata)
```

### File locali (non committare)
- `~/.referteco/config.json` — `dataDir` + `anthropicApiKey`
- `agenda-backend/.env` — tutte le credenziali Railway

---

## 9. COSE DA NON FARE / TRAPPOLE NOTE

1. **Frontend Agenda in due posti**: sorgente `agenda-frontend/`, copia `agenda-backend/frontend/`.
   Modificare SEMPRE entrambi insieme.

2. **PowerShell encoding**: `Set-Content`/`Out-File` aggiungono BOM UTF-8. Usa `[System.IO.File]::WriteAllText`.

3. **Non modificare** `referteco_data.json` o `immagini/` direttamente (dati reali).

4. **RefertEco gira da AppData**, non da Desktop. Propagare le modifiche anche lì.

5. **Cache browser**: aggiornare il cache-buster `?v=YYYYMMDD` dopo modifiche a JS/CSS.

6. **Force push solo se richiesto esplicitamente**.

7. **`.env` e `config.json` non vanno mai in git**.

8. **git fileMode**: su Windows, i file `.sh` appaiono sempre "modificati" per i permessi Unix.
   Già configurato `core.fileMode = false` in questo repo.

---

## 10. ⚠️ ATTENZIONE — WORKSTATION IN STUDIO: NON SOVRASCRIVERE LE SUE MODIFICHE

La workstation in studio ha modifiche proprie (formattazione stampa, UI fix, Orthanc, worklist)
che non esistono completamente su questo PC e viceversa.

**NON fare mai:**
- `git pull` + sovrascrittura cieca dei file locali
- Copia di interi file da questa repo sopra i file della workstation

**Come fare correttamente:**
1. `git diff HEAD` e `git status` — vedi cosa c'è di diverso
2. Porta solo le modifiche specifiche usando `git merge` o merge manuale riga per riga
3. Verifica che stampa e funzioni personalizzate funzionino ancora dopo ogni merge

---

## 11. COME RIPRENDERE (su qualsiasi PC)

```bash
git clone https://github.com/salvatoresusino93-source/RefertEco.git
cd RefertEco && npm install
cd agenda-backend && npm install && cd ..
```

Crea `agenda-backend/.env` con le credenziali (recupera da Google Drive o dall'altro PC).

**Primo messaggio a Claude**: "Leggi `RIPRENDI_QUI.md` prima di iniziare."

---

## 12. CONTATTO

Repository: https://github.com/salvatoresusino93-source/RefertEco
