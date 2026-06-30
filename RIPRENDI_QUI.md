# RIPRENDI QUI — Stato del progetto RefertEco

> **Prima regola**: leggi questo file COMPLETO prima di fare qualsiasi cosa.
> Contiene tutto il contesto, le decisioni prese, i bug già risolti, e i prossimi passi.
> Aggiornalo alla fine di ogni sessione importante.

Ultimo aggiornamento: **2026-06-30**

---

## 1. CHI È L'UTENTE

**Dott. Salvatore Susino** — medico radiologo, ambulatorio privato.
- Email: salvatore.susino93@gmail.com
- Non programmatore — spiega tutto in italiano, a parole semplici, MAI stack trace
- Preferisce soluzioni semplici, a un click
- Conferma sempre prima di operazioni distruttive o irreversibili

---

## 2. ARCHITETTURA — TRE PC IN STUDIO

### Acer (IP 192.168.1.17 — PC principale studio)

**Fa:** RefertEco gestionale — refertare, firmare, stampare.

| Cosa | Dove |
|------|------|
| Sorgente codice | `C:\Users\Luciano Susino\Desktop\RefertEco\` (repo git, aggiornato) |
| Dati pazienti | `C:\RefertEco Dati Pazienti\` |
| Node.js + moduli | `C:\Users\Luciano Susino\AppData\Local\RefertEco\` |
| Motore (server.js) | avviato da `watchdog-motore.vbs` (auto-restart) |
| Avvio automatico | Startup utente → `watchdog-motore.vbs` → avvia `Desktop\RefertEco\server.js` |
| Browser | `apri-referteco.vbs` aspetta TCP 3000 poi apre `http://localhost:3000` |
| Stampante | Epson ET-2860 (impostata su Alta qualità) |
| Firma | Namirial (username = Codice dispositivo, non la mail) |

**NON ha** il disco K: — K: è sull'HP. Orthanc è sull'HP.

### HP (IP 192.168.1.166 — mini-PC sempre acceso)

**Fa:** Archivio DICOM Orthanc + Centralina Worklist.

| Cosa | Dove |
|------|------|
| Orthanc | gira come SYSTEM, HTTP :8042, DICOM :4242 |
| Centralina worklist | `C:\Users\User\Desktop\RefertEco\centralina-worklist.js` |
| Guardiano centralina | `guardiano-centralina-SYSTEM.vbs` (Scheduled Task SYSTEM, AtStartup) |
| Disco K: | UnionSine (fisico), `K:\OrthancStorage`, `K:\OrthancWorklists` |
| Accesso da Acer | SOLO via HTTP Orthanc :8042 (SMB bloccato — Errore 5) |
| Accesso remoto | RDP (mstsc 192.168.1.166) per manutenzione |

### Linux ex-server (ora spento/abbandonato)
Il vecchio server Linux con IP .77 è stato dismesso a giugno 2025. Ignorare qualsiasi riferimento a quell'IP.

---

## 3. ORTHANC — SERVER DICOM (HP .166)

⚠️ **CAMBIATO**: Orthanc NON è più sull'Acer — è sull'HP .166

### Accesso
- HTTP admin: `http://192.168.1.166:8042` (admin:admin00)
- DICOM: porta 4242, AET: ORTHANC
- Da Acer: `http://192.168.1.166:8042`

### Configurazione HP (file `C:\Program Files\Orthanc Server\Configuration\orthanc.json`)
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

### Note importanti
- Orthanc gira come SYSTEM (non come servizio utente) → parte al boot senza login
- K: su HP è disco fisico accessibile anche da SYSTEM
- MicroDicom registrato solo in RAM Orthanc (non in orthanc.json) → se reinstalli Orthanc:
  ```
  PUT http://192.168.1.166:8042/modalities/MICRODICOM
  {"AET":"MICRODICOM","Host":"127.0.0.1","Port":11112,"Manufacturer":"Generic"}
  ```
- Se riesci con MicroDicom: Query → click paziente → click serie → Download

---

## 4. CENTRALINA WORKLIST (HP .166)

La centralina è il programma che legge l'Agenda online e aggiorna la Lista Lavoro sull'ecografo.

### Come funziona
```
Agenda "arrivato" → centralina crea K:\OrthancWorklists\{accession}.wl
                  → Orthanc lo serve all'ecografo via C-FIND
                  → Medico preme QUERY sull'ecografo → vede il paziente
Agenda "refertato" → centralina elimina il .wl → sparisce dalla Lista
```

### Avvio automatico (SYSTEM, senza login)
- Scheduled Task **"RefertEco Centralina Worklist"** (AtStartup, SYSTEM, RunLevel Highest)
- Esegue: `wscript.exe "C:\Users\User\Desktop\RefertEco\guardiano-centralina-SYSTEM.vbs"`
- Il VBS ha percorsi HARDCODED (non %LOCALAPPDATA% che sotto SYSTEM punta al profilo sbagliato)
- Log: `C:\Users\User\Desktop\RefertEco\guardiano-SYSTEM.log`
- Log centralina: `C:\Users\User\Desktop\RefertEco\centralina.log`

### Trappola ecografo Samsung Medison
L'ecografo NON aggiorna la lista in automatico. Dopo aver messo "arrivato", bisogna premere **QUERY** (o "Cerca") sull'ecografo per vedere il paziente.

### Se la centralina non funziona
1. Connettersi in RDP all'HP (mstsc 192.168.1.166)
2. Aprire `C:\Users\User\Desktop\RefertEco\guardiano-SYSTEM.log` e `centralina.log`
3. Se la Scheduled Task non è attiva: rieseguire `setup-task-centralina-HP.ps1` come admin

---

## 5. ECOGRAFO SAMSUNG MEDISON V5

### Configurazione DICOM (Configurazione → Connettività → DICOM)
- Nome stazione: MEDISON, N. porta: 1005, AE Title: MEDISON
- **ARCHIVIO**: Pseudonimo ORTHANC, AE Title ORTHANC, Host **192.168.1.166**, porta 4242
- **LISTA LAVORO**: Pseudonimo ORTHANC-WL, AE Title ORTHANC, Host **192.168.1.166**, porta 4242

### Tasti utente (Configurazione → Personalizzare → Tasto utente)
- **P1** = 2D → Immagine → ☑ Arch. + ☑ Invia → DICOM (Orthanc)
- **P2** = 2D → Cine (video) → ☑ Arch. + ☑ Invia → DICOM (Orthanc)

### Workflow completo
```
1. Segreteria segna "Arrivato" in Agenda
        ↓ centralina HP genera K:\OrthancWorklists\{accession}.wl entro 15 secondi
2. Medico preme QUERY sull'ecografo → seleziona paziente dalla LISTA LAVORO
3. Esame: P1 = immagine fissa → Orthanc → RefertEco entro 5s (automatico)
          P2 = video/cine → solo Orthanc → analizzare con MicroDicom
4. Scrivi referto in RefertEco e salva
5. Firma digitale (Namirial): username = Codice dispositivo (NON la mail)
6. Stampa/PDF
```

---

## 6. REFERTECO — FUNZIONALITÀ E BUG RISOLTI

### Endpoint server.js principali
```
GET  /api/referti                         ← lista referti
POST /api/referti                         ← salva referto
PUT  /api/referti/:id                     ← modifica referto
DELETE /api/referti/:id                   ← elimina referto + immagini

GET  /api/referti/:id/immagini            ← lista file immagini (ordine per AcquisitionDateTime)
POST /api/referti/:id/immagini            ← upload immagini
POST /api/referti/:id/immagini/ordine     ← salva ordine personalizzato
DELETE /api/referti/:id/immagini/:fname   ← elimina singola immagine

GET  /api/orthanc/status                  ← Orthanc online?
GET  /api/orthanc/studi                   ← ultimi 40 studi
POST /api/orthanc/importa/:studyId        ← importa studio (salta cine NumberOfFrames>1)
GET  /api/orthanc/cerca-accession?n=XXX  ← trova studio per AccessionNumber
GET  /api/orthanc/istanze-nuove           ← istanze nuove non ancora importate
POST /api/orthanc/importa-istanza/:id    ← importa singola istanza nel referto
POST /api/orthanc/archivia/:refertoId    ← invia immagini referto → Orthanc

GET  /api/worklist                        ← lista file .wl attivi
POST /api/worklist/crea                   ← crea file .wl (skipped se K: non presente su questo PC)
DELETE /api/worklist/:accession           ← rimuove file .wl

GET  /api/agenda/pazienti-attesa          ← proxy verso Agenda Railway
POST /api/agenda/marca-refertato/:id      ← proxy verso Agenda Railway

POST /api/quit                            ← spegne il server
```

### Bug risolti — NON riaprire

1. **Import Orthanc scaricava 0 immagini** (2026-05-29): usare `/studies/{id}/instances` non `study.Instances`.
2. **Pannello Orthanc mostrava "0 immagini"** (2026-05-29): usare `/studies/{id}/statistics → CountInstances`.
3. **Cine incluse in stampa/PDF** (2026-05-29): filtro `NumberOfFrames > 1` → salta cine.
4. **Ordine immagini non cronologico** (2026-05-29): ordinamento per `AcquisitionDateTime` tag DICOM.
5. **Doppioni pazienti in Orthanc** (2026-06-30, CAUSA RADICE):
   - `creaWorklistFile()` chiamava `/tools/create-dicom` PRIMA di verificare se K: esiste
   - Se K: assente (come su Acer), il finto studio rimaneva in Orthanc per sempre
   - **Fix**: blocco anti-doppioni all'inizio di `creaWorklistFile()` — controlla se K:\ esiste, se no ritorna `{skipped:true}` senza toccare Orthanc
   - `pollWorklistAuto` anche disattivato (righe 749-750 commentate)
6. **Caricamento immagini sbagliato** (2026-06-28): sceglie lo studio con più istanze (evita studi fake con 0 immagini).
7. **Dati su K: vs C:** (2026-06-28): dati pazienti ora in `C:\RefertEco Dati Pazienti` su Acer (K: è sull'HP).

### Logica anti-doppioni (server.js ~riga 627)
```javascript
// Su questo PC (Acer) K: non esiste → esci SUBITO senza toccare Orthanc
const wlRoot = path.parse(WORKLIST_DIR).root;
if (!fs.existsSync(wlRoot)) {
  return { ok: false, skipped: true, reason: 'Worklist gestita dalla centralina HP' };
}
```
**Non rimuovere questo blocco.** L'Acer non deve mai creare file .wl — lo fa SOLO la centralina HP.

---

## 7. AGENDA STUDIO (Railway — https://referteco-production.up.railway.app)

### Funzionalità attive
- Login/auth JWT (medico + segreteria)
- Calendario settimanale + vista mobile giornaliera (swipe) + scroll orizzontale trackpad
- CRUD appuntamenti con verifica sovrapposizione e blocchi agenda
- CRUD pazienti
- Tipi prestazione con durata 30 min
- Socket.io aggiornamento real-time
- **Notifiche email** (Resend): nuovo appuntamento (verde), annullamento (rosso), prenotazione online (ambra)
- **SMS** (SMS Hosting, 394390009000): conferma, promemoria 19:00 e 1h prima
- **Festività italiane** auto-popolate
- **Google Calendar sync** + **Google Business Profile** orari
- **Prenotazione online** (/prenota): 4 step, solo Mart/Ven 9-13 e 15-19
- **Privacy GDPR** (/privacy)
- **Domenica e sabato sempre cliccabili** (header arancio-rosso; medico bypassa blocchi GCal) — commit 8c6ad88

### ⚠️ Frontend in DUE posti — modificare SEMPRE entrambi
- `agenda-frontend/` ← SORGENTE
- `agenda-backend/frontend/` ← COPIA per Railway

---

## 8. VARIABILI RAILWAY (mai committare valori reali)

Le variabili sono nel Railway dashboard. Categorie:
- Supabase: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `JWT_SECRET`
- Email: `RESEND_API_KEY`
- SMS: `SMSHOSTING_API_KEY`, `SMSHOSTING_API_SECRET`
- Google Calendar: `GOOGLE_PRIVATE_KEY`, `GOOGLE_CLIENT_EMAIL`, `GOOGLE_CALENDAR_ID`
- Google Business Profile: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REFRESH_TOKEN`
- Info studio: `STUDIO_NOME`, `STUDIO_TELEFONO`

---

## 9. FILE LOCALI (mai in git)
- `C:\Users\Luciano Susino\AppData\Local\RefertEco\config.json` → `{ "dataDir": "C:\\RefertEco Dati Pazienti" }`
- `agenda-backend\.env` → credenziali Railway
- `C:\RefertEco Dati Pazienti\referteco_data.json` → database referti reali
- `C:\RefertEco Dati Pazienti\immagini\` → immagini DICOM dei pazienti
- `G:\Il mio Drive\RefertEco Dati Pazienti\` → copia Google Drive (sync manuale)

---

## 10. COSE IN SOSPESO ⚠️

1. **API GBP in attesa approvazione Google**
   - Case ID: **1-7862000040720** (inviata 2026-05-27)
   - Quando arriva email: POST `/api/gbp/set-regular-hours` + `/api/gbp/aggiorna-orari`

2. **(Futuro) Accesso remoto immagini Orthanc con password** — da casa via HP

3. **Adware "Garanzia Reparo" + AnyDesk** in All Users Startup dell'HP
   - Appaiono come popup all'avvio — non urgente ma da rimuovere

---

## 11. TRAPPOLE NOTE 🚫

1. **Frontend Agenda in DUE posti**: modificare SEMPRE `agenda-frontend/` E `agenda-backend/frontend/`
2. **SMB verso HP bloccato** (Errore 5): operazioni remote solo via RDP o Orthanc HTTP :8042
3. **Percorsi SYSTEM sull'HP**: il guardiano VBS usa percorsi HARDCODED `C:\Users\User\...` (non variabili d'ambiente)
4. **K: è sull'HP**, non sull'Acer. L'Acer non ha K: → il BLOCCO anti-doppioni in creaWorklistFile lo gestisce.
5. **Ecografo non aggiorna in automatico** → premere QUERY dopo "arrivato"
6. **Firma Namirial**: username = Codice dispositivo (non la mail!)
7. **pollWorklistAuto DISATTIVATO** in server.js Acer → NON riattivare
8. **Non toccare** `referteco_data.json` o `immagini/` direttamente (dati pazienti reali)
9. **Cache browser**: aggiornare `?v=YYYYMMDD` in index.html dopo modifiche a app.js/style.css
10. **`.env` e `config.json`** non vanno mai in git
11. **Le cine/video NON entrano in RefertEco**: solo immagini fisse (NumberOfFrames=1)
12. **fetch failed Orthanc HP→Railway**: ricorrente (internet HP a tratti) — non bloccante, la logica worklist locale funziona lo stesso
13. **Guardiano Acer** (`watchdog-motore.vbs`): usa %USERPROFILE%/%LOCALAPPDATA% (OK perché gira come utente, non SYSTEM)

---

## 12. COME RIPRENDERE

### Su questa workstation Acer (studio)
Il motore parte da solo all'accensione (watchdog-motore.vbs in Startup). Aprire Chrome su `http://localhost:3000`.

Se il motore non parte: doppio clic su `Desktop\RefertEco\watchdog-motore.vbs`.

### Su un altro PC
```bash
git clone https://github.com/salvatoresusino93-source/RefertEco.git
cd RefertEco && npm install
```
Poi puntare `ORTHANC_BASE` a `http://192.168.1.166:8042` in server.js (già impostato).

### Primo messaggio a Claude (nuova sessione)
```
"Leggi RIPRENDI_QUI.md e poi dimmi cosa vuoi fare."
```
oppure semplicemente:
```
"Recupera tutto"
```

---

## 13. SITO VETRINA studio-susino-web

| | |
|--|--|
| GitHub | https://github.com/salvatoresusino93-source/studio-susino-web |
| Live | https://salvatoresusino93-source.github.io/studio-susino-web/ |
| Prenotazione | https://referteco-production.up.railway.app/prenota |

---

## 14. CONTATTI E LINK UTILI
- **GitHub RefertEco**: https://github.com/salvatoresusino93-source/RefertEco
- **Agenda produzione**: https://referteco-production.up.railway.app/
- **Railway**: https://railway.app/
- **Supabase**: https://app.supabase.com/
- **Orthanc HP**: http://192.168.1.166:8042 (admin/admin00)
- **RDP HP**: mstsc → 192.168.1.166
