# RESOCONTO — Studio Ecografico Dr. Salvatore Susino
_Ultimo aggiornamento: 31 maggio 2026_

Documento di stato del progetto digitale dello studio: sito web, sistema di
prenotazione (RefertEco), Google Business Profile, integrazioni.

---

## 1. ASSET E DOVE SONO

| Cosa | Dove |
|---|---|
| Sito web (statico) | Repo `salvatoresusino93-source/studio-susino-web` — locale `~/Projects/studio-susino-web` |
| Dominio sito | **https://studiosusino.it** (GitHub Pages, HTTPS attivo) |
| Sistema prenotazione (backend+agenda) | Repo `salvatoresusino93-source/RefertEco` — locale `~/Desktop/RefertEco` (codice in `agenda-backend/`) |
| Hosting backend | Railway — progetto `beautiful-surprise` / servizio `RefertEco` |
| URL backend | https://referteco-production.up.railway.app |
| Form prenotazione online | https://referteco-production.up.railway.app/prenota |
| Database | Supabase |
| Account Google del medico | salvatoresusino.md@gmail.com (Calendar) |
| Account Google Cloud | progetto ID `agendastudio-497611`, numero `685809157167` |

**Contatti pubblicati:** fisso `0932 954441` (tel:+390932954441), mobile
`351 374 6102` (tel:+393513746102, WhatsApp wa.me/393513746102).
Indirizzo: Via dell'Arno 34, 97016 Pozzallo (RG), presso Arcobaleno Dentisti.

---

## 2. SITO WEB — cosa è stato fatto
- ✅ **HTTPS attivo** su studiosusino.it (certificato Let's Encrypt, "Enforce HTTPS"
  attivo, redirect http→https). Era bloccato (certificato non emesso): risolto
  rimuovendo e re-inserendo il dominio via API GitHub Pages.
- ✅ **Pulsante WhatsApp fisso** su tutte le pagine (numero 351 374 6102).
- ✅ Il **numero scritto** serve per CHIAMARE (tel:); WhatsApp solo dal pulsante.
- ✅ **Pulsante "Lascia una recensione su Google"** nella pagina Contatti →
  link `https://g.page/r/CQUbXzXQvvzqEBM/review` (apre direttamente la recensione).
- ✅ Nome uniforme "Studio Ecografico Dr. Salvatore Susino".
- Cache busting: CSS/JS con `?v=...`.

## 3. PRENOTAZIONI / AGENDA (RefertEco) — cosa è stato fatto
- ✅ **Giorni prenotabili: Lunedì–Venerdì** (prima solo Mar/Ven).
- ✅ **Fasce orarie: mattino 09:00–12:30, pomeriggio 15:00–19:00**, slot da 30 min.
- ✅ Uno slot **sparisce dal sito** se occupato da: appuntamento in agenda
  (telefono/segreteria/di persona), prenotazione online, impegno Google Calendar,
  blocco di fascia oraria, festività. Lettura in **tempo reale** + doppio controllo
  anti doppia-prenotazione.
- ✅ **Prenotazioni dal sito → scritte su Google Calendar** al momento della
  CONFERMA via email del medico (prima non avveniva: bug risolto).
- ✅ **Prenotazioni da agenda → scritte su Google Calendar** automaticamente.

## 4. INTEGRAZIONE GOOGLE CALENDAR — cosa è stato fatto
Regole concordate:
- **Ecografie**: gestite SOLO dall'agenda; compaiono in automatico su Google
  Calendar (titolo "🏥 …", verde) e NON sono modificabili/inseribili da Google.
- **Impegni personali**: li scrive il medico su Google Calendar; bloccano gli
  slot ma i dettagli privati NON sono visibili in agenda (etichetta generica).

Stato:
- ✅ Lettura impegni dal Google Calendar in tempo reale → blocca il sito subito.
- ✅ Sincronizzazione ogni 30 min → blocchi visibili in agenda.
- ✅ Nell'agenda gli impegni a orario mostrano blocco arancione "Non prenotabile";
  gli impegni "tutto il giorno" mostrano giornata chiusa (rosso).
- ✅ **Evento "tutto il giorno" = giorno chiuso su tutte le fasce** (verificato).
- ✅ **Bug risolto**: un evento all-day che copre più giorni ora blocca TUTTI i
  giorni coperti in agenda (prima solo il primo).
- ⚠️ **IMPORTANTE per l'uso**: su Google Calendar inserire sempre un **"Evento"**
  (non "Attività"/"Promemoria", che vengono ignorati) e tenerlo su **"Occupato"**
  (non "Disponibile").

## 5. GOOGLE BUSINESS PROFILE — cosa è stato fatto
- ✅ **Logo nuovo** ad alta risoluzione (testo vettoriale, niente sgranatura):
  file `~/Projects/studio-susino-web/images/logo-google.png`. Caricato dal medico,
  visibile nel logo (l'avatar/cerchietto si allinea con i tempi di Google).
- ✅ **Orari base aggiornati** a Lun–Ven 09:00–12:30 / 15:00–19:00 (nel codice).
- ✅ **Aggiornamento automatico orari ogni 30 min** in base agli impegni del
  medico (calcolo CORRETTO e verificato: all-day → CHIUSO, impegni parziali →
  orari ridotti, festività → chiuso). Salta la scrittura se nulla cambia.
- ✅ **Link prenotazione** collegato: sulla scheda Google compare
  "Appuntamenti: referteco-production.up.railway.app" → porta al form con gli esami.

## 6. ESTETICA AGENDA
- ✅ Rimosso lo stetoscopio 🩺 dalle date.
- ✅ Sfondo dei giorni feriali bianco (tolto l'azzurrino e il testo blu).
- ✅ Restano evidenziati solo "oggi" (crema) e i giorni chiusi (rosso).

---

## 7. COSA MANCA / IN SOSPESO

### A. In attesa di Google (azione del medico = solo aspettare email)
- ⏳ **Quota Google Business Profile API**: inviato il modulo di richiesta accesso
  (progetto `agendastudio-497611`). Finché Google non approva la quota (ora = 0),
  l'aggiornamento automatico degli orari sulla scheda Google **non viene scritto**
  (il calcolo è già pronto e corretto). Quando arriva l'email di approvazione:
  - leggere `GBP_LOCATION_NAME` dai log `[GBP]` e salvarlo su Railway (ottimizz.);
  - verificare che gli orari sulla scheda si aggiornino (es. 5 giugno = chiuso).

### B. MioDottore — rimozione ✅ (2026-05-31)
- ✅ Su Google Business compare **solo RefertEco** sotto Appuntamenti (verificato dal medico).
- Nota: il pulsante blu "Prenota con Google" resta riservato ai partner (Doctolib, ecc.).
  RefertEco appare come link "Appuntamenti" — normale e corretto.

### C. Coerenza nomi/numeri (da valutare)
- ⏳ In giro compaiono ancora: "Centro Ecografico" (Facebook), MioDottore, e un
  numero vecchio **339 4028454**. Da uniformare a "Studio Ecografico" + numeri
  corretti quando si vuole.

### D. Avatar/cerchietto Google
- ⏳ Il logo è caricato; il cerchietto accanto al nome si aggiorna con i tempi di
  Google (ore/giorni). Non è cliccabile/modificabile direttamente: normale.

### E. Decisione strategica (no azione tecnica)
- ❔ **CUP Solidale / portali a pagamento**: valutare se iscriversi (come fa il
  concorrente Centro Moncada). È un portale privato a pagamento/commissione per il
  medico, stessa logica di MioDottore. Consigliato: prima consolidare il canale
  diretto (già completo), poi eventualmente valutare.

---

## 8. NOTE TECNICHE UTILI
- Deploy backend: push su `main` di RefertEco → Railway ridistribuisce da solo.
- Deploy sito: push su `main` di studio-susino-web → GitHub Pages (1–2 min).
- Variabili Railway rilevanti: `GOOGLE_PRIVATE_KEY`/`GOOGLE_CLIENT_EMAIL`/
  `GOOGLE_CALENDAR_ID` (service account, scrittura/lettura Calendar — funziona),
  `GOOGLE_OAUTH_REFRESH_TOKEN` (Google Business — presente), `GBP_LOCATION_NAME`
  (da impostare dopo l'approvazione quota).
- Log Railway: `railway logs` dalla cartella `~/Desktop/RefertEco/agenda-backend`.

---

## 9. SEO DEL SITO (aggiornato 31 maggio 2026)
- ✅ **SEO tecnica di base** già presente: robots.txt, sitemap.xml, JSON-LD MedicalBusiness sulla home.
- ✅ **Open Graph + Twitter Card** aggiunti a tutte le pagine (anteprime corrette su WhatsApp/Facebook).
- ✅ **Home JSON-LD arricchito**: coordinate geo (36.7299582, 14.8483942), orari Lun–Ven 09:00–12:30 / 15:00–19:00, hasMap, sameAs (profilo Google).
- ✅ **Sitemap** con date `lastmod`.
- ✅ **Google Search Console**: sitemap inviata e letta (Success, 7+ pagine). Home **indicizzata** ("URL is on Google", HTTPS ok).
- ✅ **5 pagine-esame dedicate** (SEO locale, esami più richiesti):
  - ecografia-tiroide.html, ecografia-addome.html, ecocolordoppler-carotidi.html,
    ecocolordoppler-arti-inferiori.html, ecografia-muscolo-scheletrica.html
  - Ognuna: contenuto + FAQ + dati strutturati (BreadcrumbList + MedicalTest + FAQPage),
    link interni, CTA, voce in sitemap, e link da ecografie.html ("Approfondimenti").
  - ✅ **Illustrazione anatomica** nell'hero (in alto a destra), immagini OpenStax CC BY 3.0
    (file images/esame-*.jpg) con credito. Esclusi gli esami non offerti/non prenotabili
    online (seno, ginecologiche, ostetriche).
- Da fare (medico): in Search Console "Controllo URL" → "Richiedi indicizzazione" una volta per
  ognuna delle 5 pagine (FATTO dal medico). Non ripetere: una volta basta.
- Prossimi passi SEO possibili: altre pagine-esame solo se diventano richieste; mantenere
  NAP coerente (nome/indirizzo/telefono) ovunque; recensioni Google.

## 10. FACEBOOK / SOCIAL (impostato 31 maggio 2026)
- Scelta: **niente SMS/WhatsApp invasivi**; presenza social leggera e automatizzata.
- ✅ **Routine mensile automatica** (cloud, gira l'1 di ogni mese ~09:00): genera 8 post
  educativi stile "una domanda che mi fanno spesso" (prima persona), conformi alla
  pubblicità sanitaria, e li salva su Google Drive. Gestione:
  https://claude.ai/code/routines/trig_013M8DHP7EU1bZFt3nh2ShEM
- ✅ Su Drive: documenti "Facebook — Post pronti Studio Ecografico Susino" (blocco iniziale +
  stile Domande) pronti da programmare in Meta Business Suite.
- Pubblicazione scelta: **programmazione nativa** in Meta Business Suite (no API). Il medico
  copia/incolla e programma; collega Instagram per pubblicare su entrambi.
- Da fare (medico): rinominare la pagina Facebook da "Centro Ecografico" a "Studio Ecografico
  Dr. Salvatore Susino"; aggiungere ogni tanto qualche FOTO VERA dello studio.

## 11. ALTRE COSE FATTE/IN CORSO (31 maggio 2026)
- ✅ **HTTPS** del sito attivato (Let's Encrypt + Enforce HTTPS + redirect http→https).
- ✅ **Pulsante recensioni** Google nella pagina Contatti (g.page/r/CQUbXzXQvvzqEBM/review).
- ✅ **Link prenotazione su Google**: "Appuntamenti: referteco-production.up.railway.app".
- ✅ **MioDottore rimosso da Google** (2026-05-31): solo RefertEco sotto Appuntamenti.
- ⏳ **Quota Google Business API**: in attesa di approvazione (vedi sezione 7-A).
- ℹ️ **CUP Solidale**: portale privato a pagamento per il medico (come MioDottore); il
  concorrente locale è il Centro Moncada. Per ora si resta sul canale diretto.

---

## 12. PAGAMENTI ONLINE — STRIPE (completato)
- ✅ **Stripe LIVE attivo**: carta di credito + Google Pay. Webhook verificato, DB aggiornato.
- ✅ **Colonne Supabase** aggiunte: `pagamento_stato`, `stripe_session_id`, `stripe_payment_intent`, `importo_pagato_cent`.
- ✅ **Importo**: 80,00 € (variabile Railway `IMPORTO_PAGAMENTO_CENT=8000`).
- ✅ **Doppia ricevuta**: il sistema invia email di conferma + Stripe invia ricevuta ufficiale
  (abilitare in Dashboard Stripe → Impostazioni → Email clienti → Ricevute).
- ✅ **Prefisso internazionale** nel form prenotazione: bandiera Italia (+39) con selettore
  paese. CF validato (16 caratteri + regex formato italiano).
- File coinvolti: `src/services/stripe.js`, `src/app.js` (webhook raw body), `frontend/js/prenota.js`.
- ⚠️ La variabile `STRIPE_SECRET_KEY` su Railway deve essere `sk_live_...` (non sk_test).
  Webhook secret = `whsec_AATthV...` (già impostato).

---

## 13. SISTEMA TS / 730 PRECOMPILATA — ✅ FUNZIONANTE (testato su ambiente MEF)
### Cosa fa
Invia le spese sanitarie dei pazienti al MEF (Sistema Tessera Sanitaria)
per la dichiarazione precompilata 730.

⚠️ OBBLIGO: l'invio al Sistema TS dipende dall'essere un erogatore di prestazioni
sanitarie iscritto all'albo, NON dal regime fiscale. Quindi anche un medico in
regime FORFETTARIO è verosimilmente tenuto a trasmettere al TS. (Correzione: in
una versione precedente era scritto erroneamente che il forfettario non fosse
obbligato.) DA CONFERMARE col commercialista — è materia di compliance fiscale,
non una certezza tecnica.

### Stato: TEST SUPERATO — Esito 000, protocollo assegnato dal MEF
Il 2026-06-01 l'invio di test ha ricevuto **Esito 000** ("file in attesa di
elaborazione") con protocollo `26060100293737808`. Tutta la catena funziona end-to-end.

### Componenti tecnici (tutti verificati)
- ✅ **Cifratura RSA**: `crypto.publicEncrypt` con `RSA_PKCS1_PADDING` e certificato
  `src/certs/SanitelCF.cer` (RSA-1024, valido fino a gen 2027). NON AES.
- ✅ **MTOM/SOAP**: envelope multipart/related con XOP Include, operazione
  `inviaFileMtom`, ZIP allegato come base64 (`cid:...@sistemats`).
- ✅ **ZIP in memoria**: costruito a mano con `zlib.deflateRaw` + header ZIP + CRC32
  (Node non ha ZIP nativo).
- ✅ **Autenticazione**: HTTP Basic Auth (username + password), DISTINTA dal pincode
  (il pincode cifra i dati, le credenziali autenticano la chiamata).
- ✅ **Blocco proprietario**: richiede `codiceRegione` + `codiceAsl` + `codiceSSA`
  (ricavati dal codice ufficio formato `regione-asl-ssa`) + `cfProprietario` cifrato.
- ✅ **CF proprietario** = soggetto autenticato (devono coincidere).
- ✅ **TLS**: l'endpoint di TEST usa CA privata Sogei non pubblica → `rejectUnauthorized:
  false` SOLO in test. In produzione (catena Sectigo pubblica) la verifica resta attiva.
- ✅ **tipoSpesa**: `SR`. **IVA**: `naturaIVA N2` (esente). **tipoDocumento**: `F` (fattura).
- ✅ **UI**: voce "📋 Sistema TS / 730" nel menu hamburger; archivio prestazioni
  (solo non-annullati con CF) con checkbox per selezionare e importo modificabile.
  File: `frontend/index.html`, `frontend/js/app.js`, route `src/routes/sistemaTS.js`.

### Credenziali di TEST (valori pubblici fissi del kit MEF, hardcoded in test mode)
Repo di riferimento: github.com/BigNerd95/STSClient
```
username:       A9AZOS61
password:       Salve123
pincode:        5485370458
cfProprietario: PROVAX00X00X000Y
partita IVA:    98765432104
codice ufficio: 604-120-010011  (regione=604, asl=120, ssa=010011)
```
In `sistemaTS.js`: se `SISTEMA_TS_TEST=true` usa questi valori e l'endpoint
`invioSS730pTest.sanita.finanze.it`; altrimenti usa le variabili reali e `invioss730p`.

### Variabili Railway (produzione reale)
`SISTEMA_TS_CF_EROGATORE`, `SISTEMA_TS_PIVA`, `SISTEMA_TS_CODICE_UFFICIO`,
`SISTEMA_TS_PINCODE`, `SISTEMA_TS_USERNAME`, `SISTEMA_TS_PASSWORD`.
Il `SISTEMA_TS_CODICE_UFFICIO` reale DEVE essere nel formato `regione-asl-ssa`.

### Database
Colonna `appuntamenti.invia_sistema_ts` BOOLEAN DEFAULT false
(true = già inviato al TS). Importo da `importo_pagato_cent`.

### Per passare alla PRODUZIONE reale
1. Verificare che tutte le 6 variabili Railway reali siano corrette
   (incluso `SISTEMA_TS_CODICE_UFFICIO` nel formato con trattini).
2. Impostare `SISTEMA_TS_TEST=false` su Railway.
3. Confermare con il commercialista tipoSpesa (SR) e naturaIVA (N2).
4. Il `numDocumento` nell'XML = numero fattura digitato a mano nell'appuntamento
   (vedi sezione 14 — integrazione Aruba abbandonata per costi, si usa campo manuale).

---

## 14. FATTURAZIONE ELETTRONICA ARUBA (da integrare)
### Perché serve
Il numero della fattura elettronica emessa su Aruba deve alimentare il Sistema TS
(campo `numDocumento` nell'XML MEF). Altrimenti il numero documento non è coerente.

### Stato tecnico
- ✅ **API Aruba FE documentate**: REST, autenticazione OAuth-like (grant_type=password).
  - Auth: `POST https://auth.fatturazioneelettronica.aruba.it/auth/signin`
  - Token: dura 30 min, poi refresh.
  - Demo: `demoauth.fatturazioneelettronica.aruba.it`
- ⚠️ **Requisito piano**: le API Web Services richiedono piano **Premium** (non base).

### Prossimo passo (bloccato — aspetta il medico)
1. Verificare se il piano Aruba FE è Premium o base (login su fatturazioneelettronica.aruba.it).
2. Se Premium: inserire username+password Aruba FE su Railway come
   `ARUBA_FE_USERNAME` e `ARUBA_FE_PASSWORD` (MAI in chat).
3. Poi costruire il modulo `src/services/arubaFE.js` che:
   - Autentica e ottiene access_token
   - Crea FatturaPA XML (con dati paziente, importo, data)
   - Invia a SDI tramite Aruba
   - Ritorna il `numDocumento` → passa a Sistema TS

### Credenziali da inserire su Railway (quando si è pronti)
- `ARUBA_FE_USERNAME` — username account Aruba FE
- `ARUBA_FE_PASSWORD` — password account Aruba FE
- (Mai scriverle in chat o in file di codice)
