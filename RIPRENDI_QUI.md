# RIPRENDI QUI — Stato del progetto RefertEco

> **Prima regola**: leggi questo file COMPLETO prima di fare qualsiasi cosa.
> Contiene tutto il contesto, le decisioni prese, i bug già risolti, e i prossimi passi.
> Aggiornalo alla fine di ogni sessione importante.

Ultimo aggiornamento: **2026-05-29** (sito vetrina, prenotazione online, esami e preparazione)

---

## 1. CHI È L'UTENTE

**Dott. Salvatore Susino** — medico radiologo, ambulatorio privato.
- Email: salvatore.susino93@gmail.com
- Usa RefertEco per scrivere referti ecografici, importare immagini DICOM, esportare PDF
- Ha anche un modulo **Agenda** (prenotazioni pazienti) separato

**Profilo tecnico:**
- Non programmatore — spiega tutto in italiano, a parole semplici, MAI stack trace
- Preferisce soluzioni semplici, a un click
- Conferma sempre prima di operazioni distruttive o irreversibili
- Windows 11 (PC principale/portatile), MacBook, workstation Windows in studio (IP 192.168.1.17)
- Sincronizzazione dati tramite Google Drive

---

## 2. ARCHITETTURA — DUE APP DISTINTE

### A) RefertEco (referti ecografici)
- **Stack**: Node.js + Express, porta 3000
- **Database**: file JSON (`referteco_data.json`) — in `K:\RefertEco Dati Pazienti\` sulla workstation
- **Frontend**: HTML + CSS + JS vanilla in `public/`
- **Avvio**: `Avvia RefertEco.bat` in `AppData\Local\RefertEco\` — apre automaticamente il browser
- **Config locale**: `~\.referteco\config.json` → `{ "dataDir": "K:\\RefertEco Dati Pazienti", "anthropicApiKey": "sk-ant-..." }`
- Serve come proxy per l'agenda: `/api/agenda/pazienti-attesa` e `/api/agenda/marca-refertato/:id`
- Integrato con Orthanc per DICOM

### B) Agenda Studio (prenotazioni)
- **Stack**: Node.js + Express — `agenda-backend/src/app.js`, porta 3001
- **Database**: Supabase (PostgreSQL cloud)
- **Frontend**: HTML + CSS + JS vanilla
  - ⚠️ SORGENTE in `agenda-frontend/` — modificare QUI
  - ⚠️ COPIA per Railway in `agenda-backend/frontend/` — copiare sempre anche QUI
- **URL produzione**: https://referteco-production.up.railway.app/
- **SMS**: SMS Hosting (smshosting.it) — numero fisso 394390009000 (campo `from` rimosso)
- **Email**: Resend (resend.com) → salvatore.susino93@gmail.com
- **Socket.io**: aggiornamento real-time multi-dispositivo
- **Google Calendar**: service account `agenda-calendar@agendastudio-497611.iam.gserviceaccount.com`
- **Google Business Profile**: OAuth2 account `salvatoresusino.md@gmail.com`

### Struttura cartelle (workstation in studio)
```
C:\Users\Luciano Susino\Desktop\RefertEco\   ← SORGENTE (modificare qui)
├── server.js                                 ← backend RefertEco
├── config.js, database.js                   ← config e DB
├── public/                                   ← frontend RefertEco (index.html, app.js, style.css)
├── agenda-backend/
│   ├── src/app.js                            ← entry point Railway
│   ├── src/routes/                           ← appuntamenti, pazienti, public, prenota, blocchi, gbp, auth, prestazioni, sync
│   ├── src/services/                         ← email, sms, googleCalendar, googleBusiness, festivita, reminder, supabase
│   ├── frontend/                             ← ⚠️ COPIA per Railway
│   └── .env                                  ← credenziali (MAI in git)
├── agenda-frontend/                          ← ⚠️ SORGENTE frontend agenda
└── railway.json

AppData\Local\RefertEco\                      ← INSTALLAZIONE ATTIVA workstation
  ├── server.js (copia da Desktop)
  ├── public/ (copia da Desktop)
  ├── node_modules/
  ├── Avvia RefertEco.bat
  └── node.exe

K:\RefertEco Dati Pazienti\                  ← dati pazienti reali (MAI toccare direttamente)
  ├── referteco_data.json                     ← database referti
  └── immagini\{refertoId}\*.dcm             ← immagini DICOM per referto

K:\OrthancStorage\                            ← archivio DICOM Orthanc
K:\OrthancWorklists\                          ← file .wl per DICOM Worklist (generati da RefertEco)

G:\Il mio Drive\RefertEco Dati Pazienti\     ← dati pazienti su Google Drive (laptop/altri PC)
G:\Il mio Drive\Installer RefertEco\         ← QUESTA cartella (RIPRENDI_QUI + CLAUDE.md)
```

### Repository GitHub
- URL: https://github.com/salvatoresusino93-source/RefertEco
- Branch: `main` — auto-deploy Railway su ogni push
- Root Directory Railway: `/agenda-backend`
- `core.fileMode = false` già configurato (file .sh su Windows sembrano sempre modificati)

---

## 3. ORTHANC — SERVER DICOM (workstation in studio)

### Configurazione Orthanc
- **Versione**: 1.12.11, gira come **servizio Windows**
- **HTTP**: http://localhost:8042 (admin: admin/admin00)
- **DICOM**: porta 4242, AET: ORTHANC
- **Storage**: `K:\OrthancStorage`
- **Worklist plugin**: attivo → legge file .wl da `K:\OrthancWorklists`
- **Config file**: `C:\Program Files\Orthanc Server\Configuration\orthanc.json`

```json
{
  "Name": "ORTHANC",
  "StorageDirectory": "K:\\OrthancStorage",
  "IndexDirectory": "K:\\OrthancStorage",
  "HttpPort": 8042,
  "DicomPort": 4242,
  "DicomAet": "ORTHANC",
  "DicomCheckCalledAet": false,
  "DicomAlwaysAllowStore": true,
  "DicomAlwaysAllowEcho": true,
  "DicomAlwaysAllowFind": true,
  "DicomAlwaysAllowFindWorklist": true,
  "DicomCheckModalityHost": false,
  "RemoteAccessAllowed": true,
  "DicomModalities": { "MEDISON": ["MEDISON", "192.168.1.50", 1005] },
  "Plugins": ["C:\\Program Files\\Orthanc Server\\Plugins\\OrthancWorklists.dll"]
}
```

⚠️ `C:\Program Files\Orthanc Server\` richiede **admin** per modificare i file.
Per modifiche alla config senza admin → usare la REST API di Orthanc (es. `PUT /modalities/XXX`).

### MicroDicom collegato a Orthanc
- **Scopo**: visualizzare e analizzare i video/cine (che RefertEco non riproduce)
- **Configurazione in MicroDicom**: Address `192.168.1.17`, Port `4242`, AE Title `ORTHANC`, Protocollo **C-MOVE**
- **MicroDicom registrato in Orthanc** via REST API (in memoria, non nel file):
  ```
  PUT http://localhost:8042/modalities/MICRODICOM
  {"AET":"MICRODICOM","Host":"127.0.0.1","Port":11112,"Manufacturer":"Generic"}
  ```
  ⚠️ Se Orthanc viene reinstallato/riavviato a freddo, rieseguire il comando sopra.
- Per usarlo: Search → click paziente → click serie → Download

---

## 4. ECOGRAFO SAMSUNG MEDISON V5

### Configurazione DICOM (Configurazione → Connettività → DICOM)
- Nome stazione: MEDISON, N. porta: 1005, AE Title: MEDISON
- **ARCHIVIO**: Pseudonimo ORTHANC, AE Title ORTHANC, Host 192.168.1.17, porta 4242
- **LISTA LAVORO**: Pseudonimo ORTHANC-WL, AE Title ORTHANC, Host 192.168.1.17, porta 4242

### Tasti utente (Configurazione → Personalizzare → Tasto utente)
- **P1** = Arch./Invia/Stampa → 2D = **Immagine** → ☑ Arch. + ☑ Invia → DICOM (Orthanc)
- **P2** = Arch./Invia/Stampa → 2D = **Cine** (video) → ☑ Arch. + ☑ Invia → DICOM (Orthanc)
- P1 invia immediatamente ogni immagine fissa a Orthanc
- P2 invia il video/cine a Orthanc (NON entra in RefertEco, solo per MicroDicom)

### Memorizzazione cine (Configurazione → Imaging → Preimposta)
- Tipo cine: Prospettiva (o Retrospettiva — preferibile)
- Lunghezza cine: 2 sec (consigliato 3 sec)

### Workflow completo (funzionante al 2026-05-29)
```
1. Segreteria segna "Arrivato" in Agenda
        ↓ RefertEco genera automaticamente K:\OrthancWorklists\{accession}.wl
2. Medico seleziona paziente dalla LISTA LAVORO sull'ecografo (NON inserire a mano!)
        ↓ Il paziente ha l'AccessionNumber corretto collegato all'agenda
3. Esame: P1 = immagine fissa → Orthanc → RefertEco entro 5 sec (automatico)
          P2 = video/cine → solo Orthanc → analizzare con MicroDicom
4. RefertEco watch ogni 5s → nuove immagini compaiono nel viewer da sole
5. Scrivi referto e salva
        ↓ Stampa e PDF escludono automaticamente i video (solo immagini fisse)
```

---

## 5. REFERTECO — FUNZIONALITÀ E BUG RISOLTI

### Funzionalità attive
- CRUD referti con database JSON
- Viewer immagini DICOM + JPEG con ordine cronologico (per mtime file)
- Riordino manuale drag-and-drop (sovrascrive ordine cronologico)
- Export PDF referto con immagini (tema colore selezionabile)
- Stampa immagini (layout 4/6/8 per pagina)
- Import immagini da Orthanc (manuale dal pannello + automatico real-time)
- Dettatura vocale F8 (avvia/ferma microfono sul form referto)
- Proxy verso Agenda: pazienti in attesa + marca refertato
- Sincronizzazione Google Drive a 1-click
- Correzione AI del testo referto (richiede anthropicApiKey in config.json)

### Endpoint server.js principali
```
GET  /api/referti                         ← lista referti
POST /api/referti                         ← salva referto (usa _tempRefertoId come id)
PUT  /api/referti/:id                     ← modifica referto
DELETE /api/referti/:id                   ← elimina referto + immagini

GET  /api/referti/:id/immagini            ← lista file immagini (ordine cronologico mtime)
POST /api/referti/:id/immagini            ← upload immagini
POST /api/referti/:id/immagini/ordine     ← salva ordine personalizzato
DELETE /api/referti/:id/immagini/:fname   ← elimina singola immagine

GET  /api/orthanc/status                  ← Orthanc online?
GET  /api/orthanc/studi                   ← ultimi 40 studi (nInstances da /statistics)
POST /api/orthanc/importa/:studyId        ← importa studio completo (salta video NumberOfFrames>1)
GET  /api/orthanc/cerca-accession?n=XXX  ← trova studio per AccessionNumber → [{id, stabile, nImmagini}]
GET  /api/orthanc/istanze-nuove?accession=XXX&viste=id1,id2  ← istanze nuove non ancora importate
POST /api/orthanc/importa-istanza/:id    ← importa singola istanza nel referto
POST /api/orthanc/archivia/:refertoId    ← invia immagini referto → Orthanc

GET  /api/worklist                        ← lista file .wl attivi
POST /api/worklist/crea                   ← crea file .wl per ecografo
DELETE /api/worklist/:accession           ← rimuove file .wl

GET  /api/agenda/pazienti-attesa          ← proxy verso Agenda Railway
POST /api/agenda/marca-refertato/:id      ← proxy verso Agenda Railway

POST /api/quit                            ← spegne il server
```

### Bug risolti (NON riaprire questi problemi)
1. **Import Orthanc scaricava 0 immagini** (bug critico, risolto 2026-05-29):
   `study.Instances` non esiste a livello Study in Orthanc. Fix: usare `/studies/{id}/instances`.

2. **Pannello Orthanc mostrava "0 immagini"** per tutti i pazienti (risolto 2026-05-29):
   Stesso errore in `/api/orthanc/studi`. Fix: usare `/studies/{id}/statistics` → `CountInstances`.

3. **Cine non escluse da stampa/PDF** (risolto 2026-05-29):
   Le cine DICOM (video, NumberOfFrames>1) venivano incluse nella stampa stampando centinaia di fotogrammi.
   Fix: in `stampaImmagini`, `stampaImmaginiArchivio`, `esportaPDF` → parse DICOM → salta se `NumberOfFrames > 1`.
   Funzione helper: `_isDicomCine(ds)` → legge tag `x00280008`.

4. **Ordine immagini non cronologico** (risolto 2026-05-29):
   I file DICOM hanno nomi casuali. Fix: ordinamento per `fs.statSync(filepath).mtime` invece che per nome.
   L'ordine manuale personalizzato (drag-and-drop) sovrascrive quello cronologico.

5. **ricaricaViewer non aggiornava il viewer** (risolto 2026-05-29):
   `importaDaOrthanc` passava `res.files` (array di stringhe) a `ricaricaViewer(nuoviFile)` che
   cercava `f.name` su ogni stringa → TypeError silenzioso → viewer bloccato su "caricamento".
   Fix: passare `[]` → ricaricaViewer rilegge tutto dal server.

6. **DICOM JPEG Lossless non decodificato** (risolto 2026-05-19): decoder + fallback manuale.

7. **Bug "Caricamento..." eterno** (risolto 2026-05-19): `apiGet` non propagava gli errori.

### Logica _tempRefertoId (importante)
```
_tempRefertoId = null inizialmente
↓
Quando si carica un'immagine (upload drag-drop) → _tempRefertoId = Date.now().toString()
Quando si fa import da Orthanc → _tempRefertoId = Date.now().toString() (se null)
↓
Al salvataggio (salvaReferto) → usa _tempRefertoId come id del referto nel DB
→ la cartella immagini K:\RefertEco Dati Pazienti\immagini\{_tempRefertoId}\ è già al posto giusto
↓
Dopo il salvataggio → _tempRefertoId = null, viewer svuotato
```

### Import real-time Orthanc (logica)
```javascript
// In frontend app.js — si attiva quando si clicca "Avvia referto →"
_accessionAttivo = app.accession_number  // es. "20260529-0003"
_avviaWatchOrthanc(accession)  // setInterval 5000ms

// Ogni 5 secondi:
// 1. GET /api/orthanc/istanze-nuove?accession=...&viste=id1,id2,...
// 2. Per ogni istanza nuova:
//    POST /api/orthanc/importa-istanza/:id  { refertoId: _tempRefertoId }
// 3. Se importate > 0 → ricaricaViewer([]) + toast
// Il server filtra automaticamente le cine (NumberOfFrames > 1)
```

---

## 6. AGENDA STUDIO — FUNZIONALITÀ

### Funzionalità attive
- Login/auth JWT (medico + segreteria, tabella `utenti` su Supabase)
- Calendario settimanale con navigazione settimana + vista mobile giornaliera (swipe)
- CRUD appuntamenti con verifica sovrapposizione e blocchi agenda
- CRUD pazienti (ricerca per cognome/nome/CF/telefono)
- Tipi prestazione (esami) con durata 30 min
- Socket.io: aggiornamento real-time quando qualcuno crea/modifica appuntamenti
- **Notifiche email** (Resend):
  - Nuovo appuntamento → email verde al medico
  - Annullamento → email rossa al medico
  - Prenotazione online → email ambra al medico con pulsanti ✅ Conferma / ❌ Rifiuta
- **SMS** (SMS Hosting, numero fisso 394390009000):
  - Conferma prenotazione (immediato)
  - Promemoria serale 19:00 per appuntamenti domani
  - Promemoria 1 ora prima (cron ogni minuto)
  - SMS immediato se prenotato dopo le 19:00 per domani
- **Festività italiane**: auto-popolate in `blocchi_agenda` a ogni avvio e cron 1 gennaio
- **Google Calendar sync**:
  - Crea evento su nuovo appuntamento, elimina su cancellazione
  - Cron 06:00 → importa impegni personali come blocchi tipo='google_calendar'
- **Google Business Profile**: orari automatici (cron domenica 20:00)
- **Prenotazione online** (`/prenota`): mobile-first, 4 step
  - Step 1: scegli esame, Step 2: scegli data/orario, Step 3: dati + consenso GDPR, Step 4: conferma
  - Solo Martedì e Venerdì, 9-13 e 15-19
  - Stato `in_attesa` blocca slot, medico approva via email
  - Conferma → `stato='prenotato'` + SMS paziente
  - Rifiuta → `stato='annullato'` (medico chiama manualmente)
- **Privacy GDPR** (`/privacy`): informativa art.13, dati sanitari ex art.9

### Tabelle Supabase principali
- `utenti` — medico + segreteria (bcrypt password, ruolo: medico/segreteria)
- `pazienti` — anagrafica pazienti
- `tipi_prestazione` — esami (nome, durata_minuti=30, attivo, codice_dicom)
- `appuntamenti` — accession_number, stato (prenotato/arrivato/in_corso/refertato/annullato/in_attesa), worklist_status
- `blocchi_agenda` — festività (tipo='festivo'), impegni GCal (tipo='google_calendar'), manuali

### Stato appuntamento `in_attesa` (prenotazione online)
- Colore in calendario: ambra chiaro con bordo sinistro giallo tratteggiato
- Modal modifica: banner giallo con spiegazione + pulsante "Prenotato" per conferma manuale
- Print view: badge ambra

---

## 7. VARIABILI RAILWAY (mai committare valori reali)

```
SUPABASE_URL                = <da Railway dashboard>
SUPABASE_SERVICE_KEY        = <da Railway dashboard>
JWT_SECRET                  = <da Railway dashboard>
RESEND_API_KEY              = <da Railway dashboard>
SMSHOSTING_API_KEY          = <da Railway dashboard>
SMSHOSTING_API_SECRET       = <da Railway dashboard>
STUDIO_NOME                 = Studio Dr. Susino
STUDIO_TELEFONO             = 339-4028454
# Google Calendar (service account agendastudio-497611)
GOOGLE_PRIVATE_KEY          = <JSON completo service account>
GOOGLE_CLIENT_EMAIL         = agenda-calendar@agendastudio-497611.iam.gserviceaccount.com
GOOGLE_CALENDAR_ID          = salvatoresusino.md@gmail.com
# Google Business Profile (OAuth2)
GOOGLE_OAUTH_CLIENT_ID      = <da Railway dashboard>
GOOGLE_OAUTH_CLIENT_SECRET  = <da Railway dashboard>
GOOGLE_OAUTH_REFRESH_TOKEN  = <da Railway dashboard>
GOOGLE_OAUTH_REDIRECT_URI   = https://referteco-production.up.railway.app/api/gbp/callback
GBP_LOCATION_NAME           = (opzionale — si scopre auto)
```

---

## 8. FILE LOCALI (mai in git)
- `~\.referteco\config.json` → `{ "dataDir": "K:\\RefertEco Dati Pazienti", "anthropicApiKey": "sk-ant-..." }`
- `agenda-backend\.env` → tutte le credenziali Railway
- `K:\RefertEco Dati Pazienti\referteco_data.json` → database referti reali
- `K:\RefertEco Dati Pazienti\immagini\` → immagini DICOM dei pazienti

---

## 9. COSE IN SOSPESO ⚠️

1. ~~**Rimozione MioDottore da GBP**~~ ✅ **Fatto** (verificato 2026-05-31): su Google compare solo RefertEco sotto Appuntamenti.

2. **API GBP in attesa approvazione Google**:
   Case ID: **1-7862000040720** (inviata 2026-05-27, 7-10 gg lavorativi).
   Quando arriva email: POST `/api/gbp/set-regular-hours` + `/api/gbp/aggiorna-orari`.

3. **MicroDicom registrato in Orthanc solo in memoria**:
   La registrazione (`PUT /modalities/MICRODICOM`) è stata fatta via REST API e sopravvive ai
   riavvii del servizio Orthanc, MA non è nel file `orthanc.json`. Se Orthanc viene reinstallato:
   ```
   curl -X PUT http://localhost:8042/modalities/MICRODICOM -H "Content-Type: application/json" -d "{\"AET\":\"MICRODICOM\",\"Host\":\"127.0.0.1\",\"Port\":11112}"
   ```

4. **Workflow DICOM Worklist end-to-end** — funzionante ma da testare in produzione con pazienti reali.

---

## 10. TRAPPOLE NOTE 🚫

1. **Frontend Agenda in DUE posti**: modificare SEMPRE sia `agenda-frontend/` che `agenda-backend/frontend/`.
2. **PowerShell encoding**: usare `[System.IO.File]::WriteAllText` (non Set-Content/Out-File → aggiunge BOM UTF-8).
3. **Non toccare** `referteco_data.json` o `immagini/` direttamente (dati pazienti reali).
4. **RefertEco gira da AppData**, non da Desktop → dopo ogni modifica copiare i file in `AppData\Local\RefertEco\`.
5. **Cache browser**: aggiornare `?v=YYYYMMDD` nel tag script di `index.html` dopo modifiche a `app.js` o `style.css`.
6. **`C:\Program Files\Orthanc Server\`** richiede admin per modifiche → usare REST API di Orthanc dove possibile.
7. **`.env` e `config.json`** non vanno MAI in git.
8. **git fileMode**: già configurato `core.fileMode = false` (file .sh sembrano sempre modificati su Windows).
9. **Workstation in studio e portatile**: non sovrascrivere mai i file dell'uno con quelli dell'altro senza un git merge.
10. **API key Anthropic in config.json**: non loggarla mai, non metterla in git.
11. **Le cine/video NON devono entrare in RefertEco**: solo immagini fisse (NumberOfFrames=1). I video restano su Orthanc per MicroDicom.
12. **`_tempRefertoId`**: non ha il prefisso "temp-" quando viene usato per importare (è un timestamp numerico). Viene usato sia come cartella immagini che come id nel DB al salvataggio.

---

## 11. COME RIPRENDERE SU QUALSIASI PC

### Su questa workstation (studio)
```
1. Doppio clic su "Avvia RefertEco.bat" in AppData\Local\RefertEco\
   (il browser si apre automaticamente su localhost:3000)
2. Per l'Agenda: aprire browser su https://referteco-production.up.railway.app/
3. Orthanc: già attivo come servizio Windows (verifica su http://localhost:8042)
```

### Su un altro PC (portatile, Mac, ecc.)
```bash
git clone https://github.com/salvatoresusino93-source/RefertEco.git
cd RefertEco && npm install
cd agenda-backend && npm install && cd ..
# Crea ~/.referteco/config.json con dataDir puntante a Google Drive
# Crea agenda-backend/.env con le credenziali (recupera da Railway dashboard)
node server.js  # RefertEco su localhost:3000
# Agenda: già su Railway, non serve avviarla
```

### Primo messaggio a Claude su un nuovo PC
```
"Leggi RIPRENDI_QUI.md e poi dimmi cosa vuoi fare."
```
oppure semplicemente:
```
"Recupera tutto"
```
Claude leggerà CLAUDE.md (in questa cartella Google Drive) → poi RIPRENDI_QUI.md → avrà tutto il contesto.

---

## 12. SITO VETRINA studio-susino-web (2026-05-29)

Progetto separato ma collegato all’Agenda.

| | |
|--|--|
| GitHub | https://github.com/salvatoresusino93-source/studio-susino-web |
| Locale Mac | `~/Projects/studio-susino-web` |
| Google Drive | `Il mio Drive/studio-susino-web` |
| Live | https://salvatoresusino93-source.github.io/studio-susino-web/ |
| Dominio futuro | studiosusino.it (DNS Aruba da attivare) |

**Prenotazione online:** https://referteco-production.up.railway.app/prenota

### Modifiche recenti sessione
- **24 esami** prenotabili (sync `scripts/sync_tipi.js`): ripristinati **Ecografia renale**, **Doppler aorta addominale**, **Doppler arterie renali**, **Anca neonatale** — esclusa **Ecografia prostatica transrettale**
- Slot fissi **30 min** (`agenda-backend/src/routes/public.js` → `SLOT_MINUTI = 30`)
- **Preparazione** digiuno + vescica piena: solo in `/prenota` (`preparazione-esami.js`), non sul sito vetrina
- Sito: no martedì/venerdì, no fasce 9–13 / 15–19 — solo «su appuntamento»
- Prenota: esami raggruppati per categoria; banner preparazione dopo scelta esame

### Supabase — se mancano esami in prenota
```bash
cd agenda-backend && NODE_PATH=./node_modules node ../scripts/sync_tipi.js
```
Oppure SQL in `supabase/slot_30_minuti.sql`, `fix_duplicati_esami.sql`.

---

## 13. CONTATTI E LINK UTILI
- **GitHub RefertEco**: https://github.com/salvatoresusino93-source/RefertEco
- **GitHub sito**: https://github.com/salvatoresusino93-source/studio-susino-web
- **Agenda produzione**: https://referteco-production.up.railway.app/
- **Railway dashboard**: https://railway.app/
- **Supabase**: https://app.supabase.com/
- **Resend**: https://resend.com/
- **SMS Hosting**: https://www.smshosting.it/
- **Orthanc locale**: http://localhost:8042 (admin/admin00)
- **MicroDicom**: già installato sulla workstation
