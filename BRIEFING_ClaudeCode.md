# BRIEFING PER CLAUDE CODE — Progetto RefertEco
# Leggimi prima di fare qualsiasi cosa

---

## CHI SEI E COSA DEVI FARE

Sei Claude Code e stai lavorando per il **Dott. Salvatore Susino**, medico radiologo,
che vuole una web app locale per gestire i referti ecografici del suo ambulatorio privato.

Esiste già un prototipo funzionante come file HTML singolo (vedi `RefertEco_prototipo.html`
nella stessa cartella). Il tuo compito è convertirlo in una vera app Node.js che giri
su `http://localhost:3000`, mantenendo tutto quello che già funziona e aggiungendo
le migliorie elencate più avanti.

---

## STACK TECNICO DA USARE

- **Backend**: Node.js + Express
- **Database**: SQLite (via pacchetto `better-sqlite3`)
- **Frontend**: HTML + CSS + JavaScript vanilla (no framework)
- **PDF**: generazione via finestra di stampa browser (come nel prototipo, nessuna libreria server-side)
- **Porta**: 3000
- **Avvio**: `node server.js` oppure `npm start`

NON usare React, Vue, TypeScript, Prisma, Sequelize o altri framework pesanti.
La semplicità è un requisito esplicito.

---

## STRUTTURA FILE DA CREARE

```
RefertEco/
├── server.js          ← server Express + API REST
├── package.json       ← dipendenze (express, better-sqlite3)
├── database.js        ← inizializzazione e query SQLite
├── public/
│   ├── index.html     ← interfaccia utente (basata sul prototipo)
│   ├── style.css      ← CSS separato
│   └── app.js         ← JavaScript frontend
└── README.md          ← istruzioni avvio (2 righe)
```

---

## DESIGN VISIVO — MANTIENI ESATTAMENTE QUESTO

Il prototipo ha un design preciso che va replicato fedelmente:

**Font**: DM Serif Display (titoli), DM Sans (testo), DM Mono (codici/date)
**Palette colori**:
- bg: #f4f1ec (sfondo pagina, caldo)
- surface: #faf8f5 (card)
- surface2: #edeae4 (sezioni secondarie)
- border: #d4cfc7
- text: #1a1714
- text-muted: #6b6560
- accent: #2d5016 (verde scuro — colore principale)
- accent-light: #e8f0df
- accent-mid: #4a7c2a
- red: #8b1a1a / red-light: #f5e8e8
- mic: #c0392b / mic-light: #fdecea

**Layout**: sidebar scura a sinistra (240px) + area principale a destra
**Sidebar**: logo "RefertEco", sottotitolo "Gestionale referti ecografici", nav con 2 voci,
footer con contatore referti archiviati

---

## DATI DEL MEDICO (per intestazione PDF)

```javascript
const MEDICO = {
  nome:     'Dott. Salvatore Susino',
  titolo:   'Medico Chirurgo — Specialista in Radiodiagnostica',
  studio:   'Ambulatorio di Ecografia Clinica',
  indirizzo:'Via dell\'Arno, n° 34 — Pozzallo (RG)',
  email:    'salvatoresusino.md@gmail.com',
  cell:     '339-4028454',
  ordine:   'O.M. RG 3071',
  cf:       'CF: SSNSVT93M14H163N',
};
```

---

## FUNZIONALITÀ — MANTIENI TUTTO QUELLO CHE GIÀ ESISTE

### 1. NUOVO REFERTO (form)

**Dati paziente:**
- Cognome * (required)
- Nome * (required)
- Data di nascita

**Esame:**
- Tipo di esame * — menu a tendina con optgroup per categoria (lista completa sotto)
  + opzione "✏ Scrivi dicitura personalizzata…" che mostra un campo di testo libero
- Data esame * (default = oggi)

**Referto:**
- Tasto "📋 Predefiniti personali" — apre pannello con predefiniti salvati
- Template rapidi (pillole cliccabili) che cambiano in base al tipo esame selezionato
- Textarea grande con bottone microfono 🎤 (Web Speech API, lingua it-IT)

**Bottoni:** Salva referto | Reset

### 2. ARCHIVIO REFERTI

- Tabella con colonne: Paziente, Data esame, Tipo esame, Età, Azioni
- Ricerca testuale per nome/cognome (live)
- Filtro per tipo esame
- Filtro per anno
- Ordinamento per colonna (clic sull'intestazione)
- Contatori (totale archivio / filtrati)
- Bottone "Visualizza" → apre modal con dettaglio completo
- Modal con: info paziente, testo referto, bottoni Elimina / Chiudi / Esporta PDF
- Bottone "⬇ Backup" → scarica JSON con tutti i referti
- Bottone "⬆ Ripristina" → importa JSON

### 3. PREDEFINITI PERSONALI

- Pannello apribile/chiudibile nella sezione referto
- Lista predefiniti con: [titolo — clic per inserire] [× per eliminare]
- Clic su predefinito → appende il testo nella textarea (non sostituisce)
- Form per aggiungere nuovi predefiniti (titolo + testo)
- Predefiniti di fabbrica (vedi elenco più avanti)
- Salvati nel database SQLite (tabella `predefiniti`)

### 4. EXPORT PDF

Apertura finestra di stampa del browser con layout professionale:

**Intestazione** (due colonne):
- Sinistra: nome medico (grande, verde), titolo, studio, indirizzo
- Destra: email, cellulare, ordine, CF
- Separatore: barra verde (#2d5016) sotto intestazione

**Box paziente** (sfondo verde chiaro, bordo sinistro verde):
- Nome paziente grande | Data esame + N° referto a destra
- Data di nascita e età calcolata

**Corpo referto:**
- Titolo esame centrato in maiuscoletto verde
- Sezione "REFERTO" con testo giustificato

**Firma:**
- In basso a DESTRA
- Solo la scritta "Il Medico Radiologo" (nessun nome, nessuna linea — firma digitale)

**Footer:** studio e indirizzo | data generazione documento

Font PDF: Lora (titoli) + Source Sans 3 (corpo)

---

## LISTA COMPLETA TIPI ESAME (menu a tendina con optgroup)

```
ADDOME:
- Ecografia addome superiore
- Ecografia addome inferiore
- Ecografia addome completo
- Ecografia epatica
- Ecografia epato-biliare
- Ecografia colecisti e vie biliari
- Ecografia pancreatica
- Ecografia splenica
- Ecografia delle anse intestinali
- Ecografia della parete addominale
- Eco-CEUS epatica (con mdc)

APPARATO URINARIO:
- Ecografia apparato urinario
- Ecografia renale
- Ecografia vescicale
- Ecografia vescico-prostatica sovrapubica
- Ecografia prostatica transrettale
- Ecografia surrenalica

COLLO E TIROIDE:
- Ecografia tiroide
- Ecografia tiroide e paratiroidi
- Ecografia del collo
- Ecografia linfonodale laterocervicale
- Ecografia ghiandole salivari
- Ecografia parotide

APPARATO GENITALE FEMMINILE / OSTETRICA:
- Ecografia ginecologica sovrapubica
- Ecografia ginecologica transvaginale
- Ecografia pelvica
- Ecografia ostetrica I trimestre
- Ecografia ostetrica morfologica (II trimestre)
- Ecografia ostetrica di accrescimento (III trimestre)
- Ecografia ostetrica con translucenza nucale
- Ecocardiografia fetale

APPARATO GENITALE MASCHILE:
- Ecografia scrotale
- Ecografia testicolare
- Ecocolordoppler scrotale

MAMMELLA:
- Ecografia mammaria monolaterale
- Ecografia mammaria bilaterale
- Ecografia mammaria bilaterale con studio ascellare

MUSCOLO-SCHELETRICA E PARTI MOLLI:
- Ecografia muscolo-scheletrica
- Ecografia muscolo-tendinea
- Ecografia parti molli
- Ecografia spalla
- Ecografia gomito
- Ecografia polso e mano
- Ecografia anca
- Ecografia ginocchio
- Ecografia caviglia e piede
- Ecografia anca neonatale
- Ecografia inguinale
- Ecografia cute e sottocute

VASCOLARE / DOPPLER:
- Ecocolordoppler TSA (tronchi sovraortici)
- Ecocolordoppler aorta addominale
- Ecocolordoppler arterioso arti inferiori
- Ecocolordoppler venoso arti inferiori
- Ecocolordoppler arterioso arti superiori
- Ecocolordoppler venoso arti superiori
- Ecocolordoppler arterie renali
- Ecocolordoppler circolo portale
- Ecocolordoppler penieno
- Ecocolordoppler transcranico
- Ecocolordoppler vasi mesenterici

TORACE E ALTRO:
- Ecografia torace e pleura
- Ecografia polmonare (LUS)
- Ecografia linfonodi
- Ecografia oculare
- Ecografia al letto (POCUS)
- Ecografia intraoperatoria
- Ecografia interventistica (guida biopsia/drenaggio)

+ opzione finale: ✏ Scrivi dicitura personalizzata…
```

---

## TEMPLATE RAPIDI PER TIPO ESAME

Quando l'utente seleziona un tipo esame appaiono delle pillole cliccabili che inseriscono
testi predefiniti nella textarea. Ecco i template per tipo:

### Ecografia addome superiore
- **Negativo**: "Fegato di dimensioni nella norma, ecostruttura omogenea, regolare profilo superficiale. Non si rilevano lesioni focali. Colecisti normodistesa, pareti sottili, contenuto anecogeno, non calcolosi. Vie biliari intra- ed extraepatiche non dilatate. Pancreas visualizzato nei suoi segmenti, di aspetto ecografico nella norma. Milza di dimensioni e struttura nella norma. Non versamento libero addominale."
- **Steatosi lieve**: "Fegato di dimensioni nella norma con incremento dell'ecogenicità parenchimale, compatibile con quadro di steatosi epatica di grado lieve. Non si rilevano lesioni focali. Colecisti normodistesa, pareti sottili, non calcolosi. Vie biliari non dilatate. Pancreas nella norma. Milza nella norma."
- **Steatosi moderata**: "Fegato di dimensioni nella norma con marcato incremento dell'ecogenicità parenchimale e riduzione dell'attenuazione del fascio ultrasonoro, compatibile con steatosi epatica di grado moderato-severo. Non si rilevano lesioni focali. Colecisti normodistesa, non calcolosi. Vie biliari non dilatate. Pancreas nella norma. Milza nella norma."
- **Calcolosi colecisti**: "Fegato di dimensioni nella norma, ecostruttura omogenea. Non si rilevano lesioni focali. Colecisti normodistesa con presenza di formazione iperecogena di ___ mm con cono d'ombra posteriore, riferibile a calcolo. Pareti colecistiche di spessore nella norma. Vie biliari intra- ed extraepatiche non dilatate. Pancreas nella norma. Milza nella norma."
- **Cisti epatica**: "Fegato di dimensioni nella norma. Si documenta formazione anecogena a margini netti di ___ mm in sede ___, di tipo cistico semplice, priva di setti interni e componente solida. Colecisti nella norma. Vie biliari non dilatate. Pancreas nella norma. Milza nella norma."

### Ecografia addome completo
- **Negativo**: "Fegato di dimensioni nella norma, ecostruttura omogenea, non lesioni focali. Colecisti normodistesa, non calcolosi. Vie biliari non dilatate. Pancreas nella norma. Milza nella norma.\nRene destro di dimensioni nella norma, regolare differenziazione cortico-midollare, assenza di idronefrosi e litiasi. Rene sinistro di dimensioni nella norma, regolare differenziazione cortico-midollare, assenza di idronefrosi e litiasi.\nVescica in idoneo riempimento, pareti regolari, contenuto anecogeno. Residuo post-minzionale nella norma.\nNon versamento libero in cavità peritoneale."

### Ecografia apparato urinario
- **Negativo**: "Rene destro di dimensioni nella norma (___ mm), regolare morfologia e differenziazione cortico-midollare, assenza di idronefrosi e immagini di tipo litiasico.\nRene sinistro di dimensioni nella norma (___ mm), regolare morfologia e differenziazione cortico-midollare, assenza di idronefrosi e immagini di tipo litiasico.\nVescica in idoneo riempimento, pareti regolari, contenuto anecogeno, non immagini intraluminali. Residuo post-minzionale nella norma (___ ml)."
- **Calcolosi renale**: "Rene destro: si documenta formazione iperecogena con cono d'ombra posteriore di ___ mm in sede ___, riferibile a litiasi. Assenza di idronefrosi.\nRene sinistro: nella norma per dimensioni e morfologia, regolare differenziazione cortico-midollare, assenza di idronefrosi.\nVescica nella norma."
- **Idronefrosi**: "Rene ___: si documenta dilatazione del sistema pielo-caliceale di grado ___ (lieve/moderato/severo), con pelvi renale di ___ mm. Non si rilevano immagini di tipo litiasico nel tratto ureterale visualizzabile.\nRene ___: nella norma.\nVescica nella norma."

### Ecografia tiroide
- **Negativo**: "Tiroide di dimensioni nella norma, ecostruttura omogenea, ecogenicità conservata. Lobo destro: ___ × ___ × ___ mm. Lobo sinistro: ___ × ___ × ___ mm. Istmo: ___ mm.\nNon si rilevano formazioni nodulari. Non linfoadenomegalie laterocervicali rilevabili."
- **Nodulo tiroideo**: "Tiroide di dimensioni nella norma. Si documenta formazione nodulare ___ (ipo/iso/iperecogena), a margini ___, di ___ × ___ mm, in sede ___ del lobo ___. Pattern vascolare ___. Classificazione EU-TIRADS ___.\nNon ulteriori noduli rilevabili. Non linfoadenomegalie laterocervicali rilevabili."
- **Tiroidite**: "Tiroide di volume ___ (aumentato/ridotto), ecostruttura disomogenea con aree ipoecogene diffuse, compatibile con quadro di tiroidite cronica. Lobo destro: ___ × ___ × ___ mm. Lobo sinistro: ___ × ___ × ___ mm.\nNon si rilevano formazioni nodulari di rilievo. Non linfoadenomegalie laterocervicali rilevabili."

### Ecografia parti molli
- **Negativo**: "In sede ___, a livello ___, i piani muscolo-aponeurotici appaiono nella norma, senza evidenza di raccolte, lesioni focali o alterazioni strutturali di rilievo. Il tessuto adiposo sottocutaneo è omogeneo."
- **Cisti**: "In sede ___ si documenta formazione anecogena a margini netti di ___ × ___ mm, con parete sottile, priva di componente solida interna, di tipo cistico semplice."
- **Raccolta**: "In sede ___ si documenta raccolta ___ (anecogena/ipoecogena/complessa) di ___ × ___ mm, a margini ___. Non si documentano segni di vascolarizzazione interna al color Doppler."
- **Lipoma**: "In sede ___ si documenta formazione iperecogena omogenea a margini netti di ___ × ___ mm, in sede sottocutanea, compatibile con lipoma. Non si documentano segni di vascolarizzazione interna al color Doppler."

### Ecocolordoppler (generico)
- **TSA negativo**: "Asse carotideo destro: arteria carotide comune, biforcazione, arteria carotide interna ed esterna pervie, con normale profilo di flusso. IMT nella norma (___ mm). Non placche aterosclerotiche.\nAsse carotideo sinistro: arteria carotide comune, biforcazione, arteria carotide interna ed esterna pervie, con normale profilo di flusso. IMT nella norma (___ mm). Non placche aterosclerotiche.\nArterie vertebrali bilateralmente pervie, flusso anterogrado."
- **Placca carotidea**: "Asse carotideo ___: presenza di placca aterosclerotica ___ (ipo/iso/iperecogena, omogenea/disomogenea) in sede ___ di ___ mm, con stenosi stimabile ___ (< 50% / 50-70% / > 70%). Flusso conservato/alterato a valle."
- **Arti inf. negativo**: "Asse iliaco-femorale-popliteo-tibiale bilateralmente pervio, comprimibile, senza evidenza di trombosi endoluminale. Flusso trifasico conservato nei segmenti esplorati. Non varici di rilievo."

### Ecografia muscolo-scheletrica
- **Spalla negativa**: "Cuffia dei rotatori integra. Tendine del sopraspinato di aspetto nella norma, non soluzioni di continuo, non calcificazioni. Tendine del sottospinato nella norma. Tendine del capo lungo del bicipite normodecorrente nel solco bicipitale. Non versamento in borsa subacromio-deltoidea. Articolazione gleno-omerale nella norma."
- **Ginocchio negativo**: "Tendine quadricipitale e tendine rotuleo integri, nella norma per ecostruttura e spessore. Legamenti collaterali nella norma. Non versamento articolare di rilievo. Non cisti di Baker. Cartilagine femorale nella norma nei settori esplorati."
- **Tendinopatia**: "A livello del tendine ___ si documenta alterazione ecostrutturale con aree ipoecogene e incremento del calibro tendineo (___ mm), compatibile con quadro di tendinopatia. Al color Doppler si documenta/non si documenta ipervascolarizzazione intratendinea."
- **Lesione muscolare**: "A livello del muscolo ___ si documenta alterazione ecostrutturale con area ___ (ipoecogena/anecogena/disomogenea) di ___ × ___ mm, compatibile con lesione di grado ___ (stiramento/parziale/completa). Non ematoma organizzato."

---

## PREDEFINITI DI FABBRICA (tabella `predefiniti` nel database)

```javascript
[
  { titolo: 'Esame negativo (generico)', testo: "L'esame ecografico non evidenzia alterazioni di rilievo a carico delle strutture esaminate." },
  { titolo: 'Non versamento libero', testo: 'Non si evidenzia versamento libero in cavità.' },
  { titolo: 'Linfonodi reattivi', testo: 'In sede si documentano alcune formazioni linfonodali di aspetto reattivo, con morfologia conservata e ilo iperecogeno riconoscibile, di dimensioni massime ___ mm.' },
  { titolo: 'Cisti semplice (generica)', testo: 'Si documenta formazione anecogena a margini netti di ___ mm, a contenuto omogeneo, priva di setti interni e componente solida, di tipo cistico semplice.' },
  { titolo: 'Formazione solida (generica)', testo: 'Si documenta formazione ___ (ipo/iso/iperecogena), a margini ___, di ___ × ___ mm, in sede ___. Al color Doppler si documenta/non si documenta vascolarizzazione interna. Si consiglia correlazione clinica e approfondimento diagnostico.' },
  { titolo: 'Esame limitato da gas', testo: "L'esame risulta parzialmente limitato dalla presenza di abbondante meteorismo intestinale." },
  { titolo: 'Controllo ecografico consigliato', testo: 'Si consiglia controllo ecografico a distanza di ___ mesi.' },
]
```

---

## API REST DA IMPLEMENTARE NEL SERVER

```
GET    /api/referti              → lista tutti i referti (con filtri opzionali: ?search=&tipo=&anno=)
GET    /api/referti/:id          → singolo referto
POST   /api/referti              → crea nuovo referto
DELETE /api/referti/:id          → elimina referto
GET    /api/referti/export       → scarica tutti i referti come JSON
POST   /api/referti/import       → importa referti da JSON

GET    /api/predefiniti          → lista predefiniti
POST   /api/predefiniti          → crea predefinito
DELETE /api/predefiniti/:id      → elimina predefinito
```

---

## SCHEMA DATABASE SQLite

```sql
CREATE TABLE referti (
  id          TEXT PRIMARY KEY,
  cognome     TEXT NOT NULL,
  nome        TEXT NOT NULL,
  nascita     TEXT,
  tipo        TEXT NOT NULL,
  data        TEXT NOT NULL,
  referto     TEXT,
  creato      TEXT NOT NULL
);

CREATE TABLE predefiniti (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  titolo  TEXT NOT NULL,
  testo   TEXT NOT NULL,
  ordine  INTEGER DEFAULT 0
);
```

---

## CALCOLO ETÀ

Implementare una funzione che, dati `dataNascita` e `dataEsame`, calcola l'età in modo
intelligente:
- Se età < 2 anni: mostra i mesi (es. "8 mesi")
- Se età ≥ 2 anni: mostra gli anni (es. "45 anni")
- Se mancano i dati: mostra "—"

---

## DETTATURA VOCALE (Web Speech API)

- Lingua: it-IT
- Modalità: continuous + interimResults
- Il testo già presente nella textarea deve essere preservato
- La dettatura APPENDE al testo esistente, non lo sostituisce
- Bottone 🎤 in alto a destra nella textarea
- Quando attivo: bottone rosso pulsante + barra rossa con testo "Dettatura in corso…"
- IMPORTANTE: il server gira su http://localhost quindi Chrome memorizzerà il permesso
  microfono in modo permanente — non servono workaround speciali

---

## COMPORTAMENTI UX DA REPLICARE

- Toast di notifica (in basso a destra, 2.8 secondi): verde per successo, rosso per errore
- Confirm dialog personalizzato prima di eliminare (non usare window.confirm nativo)
- Modal animato per visualizzare il dettaglio del referto
- Reset del form dopo salvataggio (con data odierna preimpostata)
- Sidebar con contatore referti aggiornato in tempo reale
- Ricerca nell'archivio in tempo reale (senza premere invio)
- Ordinamento tabella per colonna con freccia direzionale
- Bottone tipo esame personalizzato: compare solo se si seleziona "Scrivi dicitura personalizzata"

---

## COSA NON DEVE ESSERCI

- Nessun login / autenticazione (app locale, uso personale)
- Nessuna connessione a servizi cloud
- Nessun DICOM o gestione immagini (fuori scope)
- Nessuna firma digitale integrata (viene fatta esternamente con ArubaSign)

---

## AVVIO RAPIDO (da mettere nel README)

```bash
# Prima volta
npm install

# Ogni volta
npm start
# → apri Chrome su http://localhost:3000
```

---

## ISTRUZIONI OPERATIVE PER CLAUDE CODE

1. Leggi questo intero documento prima di scrivere una riga di codice
2. Crea prima `package.json` e installa le dipendenze
3. Crea `database.js` con schema e seed dei predefiniti di fabbrica
4. Crea `server.js` con tutte le API REST
5. Crea `public/index.html`, `public/style.css`, `public/app.js` replicando
   fedelmente il design del prototipo
6. Testa che il server parta correttamente con `npm start`
7. Verifica che tutte le operazioni CRUD funzionino
8. Verifica che l'export PDF apra la finestra di stampa con il layout corretto

Se hai dubbi su qualcosa, consulta il file `RefertEco_prototipo.html` che contiene
il codice di riferimento già funzionante.
