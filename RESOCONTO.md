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

### B. MioDottore — rimozione residuo
- ⏳ Il booking è stato disattivato lato MioDottore, ma su Google **residua ancora**
  il modulo "Prenota un appuntamento" di MioDottore. È ritardo di cache di Google
  (può volerci giorni/settimane). Per accelerare: verificare in incognito, usare
  "Suggerisci una modifica", e/o contattare l'assistenza Google Business chiedendo
  la rimozione del fornitore di prenotazione di terze parti.
- Nota: il pulsante blu "Prenota" col calendario su Google è riservato ai partner
  "Prenota con Google" (MioDottore, Doctolib). Il form proprio RefertEco resta come
  link "Appuntamenti", NON come pulsante blu.

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
