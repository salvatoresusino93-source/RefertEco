require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
// v20260527b
const express = require('express');
const http    = require('http');
const cors    = require('cors');
const path    = require('path');

const jwt = require('jsonwebtoken');
const { initSocket, getIO } = require('./socket');
const { avviaReminder, inviaPromemoriDomani, inviaRichiesteRecensione } = require('./services/reminder');
const supabase = require('./services/supabase');
const { costruisciEventoWebhook } = require('./services/stripe');
const { creaEvento } = require('./services/googleCalendar');
const { notificaPrenotazionePagata, notificaPrenotazioneOnline, inviaRicevutaPagamento } = require('./services/email');
const { normalizzaNumero, inviaPromemoria } = require('./services/sms');
const { whatsappConfigurato, inviaTemplate, registraNumero, inviaWhatsappPromemoria } = require('./services/whatsapp');
const authRoutes         = require('./routes/auth');
const pazientiRoutes     = require('./routes/pazienti');
const appuntamentiRoutes = require('./routes/appuntamenti');
const prestazioniRoutes  = require('./routes/prestazioni');
const syncRoutes         = require('./routes/sync');
const blocchiRoutes           = require('./routes/blocchi');
const gbpRoutes               = require('./routes/gbp');
const publicRoutes            = require('./routes/public');
const prenotaRoutes           = require('./routes/prenota');
const indisponibilitaRoutes   = require('./routes/indisponibilita');
const fattureRoutes           = require('./routes/fatture');
const sistemaTSRoutes         = require('./routes/sistemaTS');
const presenzaRoutes          = require('./routes/presenza');

const app    = express();
const server = http.createServer(app);

// ─── Middleware ───────────────────────────────────────────────────────────
app.use(cors());

// ─── Sottodominio conferma.studiosusino.it ────────────────────────────────
// Questo dominio serve SOLO le pagine di conferma presenza paziente (/p/...).
// Se qualcuno apre la radice o un altro percorso, lo mandiamo al sito vetrina
// così non viene esposto il login dell'agenda su quel sottodominio.
app.use((req, res, next) => {
  if (req.hostname === 'conferma.studiosusino.it' && !req.path.startsWith('/p/') && req.path !== '/p') {
    return res.redirect(302, 'https://studiosusino.it');
  }
  next();
});

// ─── Sottodominio prenota.studiosusino.it ─────────────────────────────────
// Stessa applicazione, stesso database, stessa agenda: cambia solo l'indirizzo
// che vede il paziente. Serve a non mandarlo su un URL tecnico tipo
// "referteco-production.up.railway.app", che fa scappare la gente.
//
// Su questo sottodominio lasciamo passare SOLO ciò che serve a prenotare:
//   /prenota            la pagina di prenotazione
//   /privacy            l'informativa, linkata dal modulo
//   /api/public/*       esami, disponibilità, invio prenotazione, webhook Stripe
//   /api/prenota/*      conferma/rifiuto dal link nell'email al medico
//   /api/health         controllo che il servizio sia vivo
//   file statici        css, js, immagini, icone
// Tutto il resto (login e API dell'agenda) viene mandato al sito vetrina: il
// gestionale non deve essere raggiungibile da un indirizzo pubblicizzato ai
// pazienti.
const PRENOTA_HOST = 'prenota.studiosusino.it';
const PRENOTA_CONSENTITI = [
  /^\/prenota\/?$/,
  /^\/privacy\/?$/,
  /^\/api\/public(\/|$)/,
  /^\/api\/prenota(\/|$)/,
  /^\/api\/health$/,
  /^\/(css|js|images|icons)\//,
  /^\/(favicon\.svg|manifest\.json)$/,
];

app.use((req, res, next) => {
  if (req.hostname !== PRENOTA_HOST) return next();

  // La radice porta direttamente al modulo di prenotazione
  if (req.path === '/') return res.redirect(302, '/prenota');

  if (PRENOTA_CONSENTITI.some(r => r.test(req.path))) {
    // Il modulo di prenotazione non deve comparire su Google come pagina a sé:
    // la pagina "vetrina" indicizzata resta studiosusino.it/prenota.html
    res.set('X-Robots-Tag', 'noindex, follow');
    return next();
  }

  return res.redirect(302, 'https://studiosusino.it');
});

// ─── Webhook Stripe (pagamento visita) ────────────────────────────────────
// DEVE stare PRIMA di express.json(): la verifica della firma richiede il
// body grezzo.
//  • checkout.session.completed → visita pagata: conferma l'appuntamento
//    (stato 'prenotato'), evento Google Calendar, notifica al medico e
//    ricevuta via email al paziente. Nessun SMS (vedi nota sotto). Conferma
//    automatica, nessuna approvazione necessaria.
//  • checkout.session.expired   → pagamento abbandonato: l'appuntamento resta
//    "in attesa" e si invia comunque al medico l'email con conferma/rifiuto
//    (fallback "paga in studio"), così la notifica arriva sempre.

async function recuperaAppuntamento(appId) {
  const { data } = await supabase
    .from('appuntamenti')
    .select('*, pazienti(*), tipi_prestazione(*)')
    .eq('id', appId)
    .single();
  return data || null;
}

async function confermaPagamentoOnline(session) {
  const appId = session.metadata?.appuntamento_id;
  const pi    = session.payment_intent;
  if (!appId) return;

  const app = await recuperaAppuntamento(appId);
  if (!app) return;
  if (app.stato !== 'in_attesa' || app.pagamento_stato === 'pagato') return; // idempotenza

  const { error } = await supabase
    .from('appuntamenti')
    .update({
      stato:                 'prenotato',
      pagamento_stato:       'pagato',
      stripe_payment_intent: pi || app.stripe_payment_intent,
      updated_at:            new Date().toISOString(),
    })
    .eq('id', appId);
  if (error) {
    console.error('[Stripe] Conferma appuntamento (webhook) fallita:', error.message);
    return;
  }

  const confermato = {
    ...app,
    stato:                 'prenotato',
    pagamento_stato:       'pagato',
    stripe_payment_intent: pi || app.stripe_payment_intent,
  };
  try { getIO().emit('appuntamento:aggiornato', confermato); } catch {}
  // Nessun SMS per i pagamenti online: il paziente riceve già conferma e
  // ricevuta via email, quindi l'SMS (a pagamento) sarebbe ridondante.
  // L'SMS resta solo per il flusso "paga in studio" (vedi routes/prenota.js).
  creaEvento(app).catch(e => console.error('[GCal] Crea evento (pagamento online):', e.message));
  notificaPrenotazionePagata(confermato).catch(e => console.error('[email] Notifica pagata:', e.message));
  // Ricevuta di pagamento (non fiscale) al paziente, copia al medico in BCC.
  inviaRicevutaPagamento(confermato, app.importo_pagato_cent).catch(e => console.error('[email] Ricevuta pagamento:', e.message));
}

async function fallbackPagaInStudio(session) {
  const appId = session.metadata?.appuntamento_id;
  if (!appId) return;

  const app = await recuperaAppuntamento(appId);
  if (!app) return;
  if (app.stato !== 'in_attesa' || app.pagamento_stato === 'pagato') return; // già gestito/pagato

  const token = jwt.sign({ id: app.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
  notificaPrenotazioneOnline(app, token).catch(e =>
    console.error('[email] Notifica fallback (pagamento scaduto):', e.message)
  );
}

app.post('/api/public/stripe-webhook', express.raw({ type: '*/*' }), async (req, res) => {
  let event;
  try {
    event = costruisciEventoWebhook(req.body, req.headers['stripe-signature']);
  } catch (e) {
    console.error('[Stripe] Verifica webhook fallita:', e.message);
    return res.status(400).send(`Webhook Error: ${e.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      await confermaPagamentoOnline(event.data.object);
    } else if (event.type === 'checkout.session.expired') {
      await fallbackPagaInStudio(event.data.object);
    }
  } catch (e) {
    console.error('[Stripe] Gestione evento webhook fallita:', e.message);
  }

  res.json({ received: true });
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ─── Frontend statico ────────────────────────────────────────────────────
// frontend/ è dentro agenda-backend/ sia in locale che su Railway
const FRONTEND_PATH = path.resolve(__dirname, '..', 'frontend');
app.use(express.static(FRONTEND_PATH));

// ─── API Routes ───────────────────────────────────────────────────────────
app.use('/api/auth',          authRoutes);
app.use('/api/pazienti',      pazientiRoutes);
app.use('/api/appuntamenti',  appuntamentiRoutes);
app.use('/api/prestazioni',   prestazioniRoutes);
app.use('/api/sync',          syncRoutes);
app.use('/api/blocchi',       blocchiRoutes);
app.use('/api/gbp',           gbpRoutes);
app.use('/api/public',            publicRoutes);         // no auth — prenotazione online
app.use('/api/prenota',           prenotaRoutes);        // no auth — conferma/rifiuto via email
app.use('/api/indisponibilita',   indisponibilitaRoutes);
app.use('/api/fatture',           fattureRoutes);
app.use('/api/sistema-ts',        sistemaTSRoutes);
app.use('/p',                     presenzaRoutes);        // no auth — conferma presenza paziente via SMS

// ─── Health check ────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'agenda-backend', ts: new Date().toISOString() });
});

// ─── Test email notifica ─────────────────────────────────────────────────
// Usa il mittente configurato (EMAIL_FROM) e permette di indicare il
// destinatario nel body: { "to": "indirizzo@esempio.it" }. Così si può
// verificare l'invio reale verso un indirizzo qualsiasi (non solo l'owner),
// cosa possibile solo dopo aver verificato il dominio su Resend.
app.post('/api/test-email', async (req, res) => {
  const key = process.env.RESEND_API_KEY;
  if (!key) return res.status(500).json({ error: 'RESEND_API_KEY non impostata su Railway' });
  const mittente    = process.env.EMAIL_FROM || 'Agenda Studio <onboarding@resend.dev>';
  const destinatario = (req.body && req.body.to) || 'salvatore.susino93@gmail.com';
  try {
    const { Resend } = require('resend');
    const resend = new Resend(key);
    const r = await resend.emails.send({
      from: mittente,
      to: destinatario,
      subject: 'Test da Railway — RefertEco',
      html: '<p>Email di test dal server Railway. Funziona!</p>',
    });
    res.json({ ok: true, id: r.id, from: mittente, to: destinatario });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Test invio SMS diretto — manda un SMS a un numero specifico ─────────
// POST /api/test-sms  { "numero": "333XXXXXXX" }
// Utile per verificare che le credenziali SMS Hosting funzionino
app.post('/api/test-sms', async (req, res) => {
  const apiKey    = process.env.SMSHOSTING_API_KEY;
  const apiSecret = process.env.SMSHOSTING_API_SECRET;

  if (!apiKey || !apiSecret) {
    return res.status(500).json({ error: 'SMSHOSTING_API_KEY o SMSHOSTING_API_SECRET mancanti su Railway' });
  }

  const raw = (req.body.numero || '').toString().replace(/[\s\-\.]/g, '');
  if (!raw) return res.status(400).json({ error: 'Campo "numero" obbligatorio nel body' });

  // Normalizza in formato E.164 (+39XXXXXXXXXX)
  let numero = raw;
  if      (raw.startsWith('+39'))  numero = raw;
  else if (raw.startsWith('0039')) numero = '+39' + raw.slice(4);
  else if (raw.startsWith('3'))    numero = '+39' + raw;
  else if (raw.startsWith('0'))    numero = '+39' + raw;

  const auth   = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
  // NOTA: 'from' rimosso — i mittenti alfanumerici non registrati vengono rimpiazzati
  // da #RANDOMNUM# e filtrati dagli operatori italiani. Senza 'from', SMS Hosting usa
  // il numero fisso 394390009000, già registrato, con consegna più affidabile.
  const params = new URLSearchParams({
    to:     numero,
    text:   `Test SMS Agenda Studio [${new Date().toLocaleTimeString('it-IT', {timeZone:'Europe/Rome'})}]. Funziona?`,
    isTest: 'false',
  });

  try {
    const r = await fetch('https://api.smshosting.it/rest/api/sms/send', {
      method:  'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type':  'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    const json = await r.json().catch(() => ({}));
    // Restituiamo tutto: status HTTP, body completo, e i parametri inviati
    res.json({
      http_status: r.status,
      http_ok:     r.ok,
      risposta_smshosting: json,
      parametri_inviati: { numero, from: '(nessuno — usa numero fisso SMS Hosting)', apiKey_prefix: apiKey.slice(0, 6) + '...' }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Test SMS promemoria diretto — un SOLO invio, mai il batch ───────────
// POST /api/test-promemoria
// Verifica con un invio SMS reale (stessa funzione usata dal cron delle
// 08:00) che il fix del 30/8 sul testo troppo lungo (link troncato a metà,
// "Link non valido" — vedi commit b137eea) funzioni davvero end-to-end.
//
// Vincoli di sicurezza, per costruzione (non a runtime):
//   - Il numero è FISSO nel codice, non letto dal body: non può mandare
//     l'SMS a nessun altro che al Dott. Susino, qualunque cosa arrivi
//     nella richiesta.
//   - NON chiama la funzione batch (inviaPromemoriDomani): zero rischio di
//     anticipare o duplicare il promemoria dei pazienti reali di domani.
//   - Usa un token di conferma GIÀ esistente (quello dell'appuntamento di
//     test del Dott. Susino): urlConferma() lo trova già valorizzato e
//     salta la scrittura sul database — questa route non scrive MAI su
//     Supabase, quindi non tocca promemoria_inviato_at né alcun altro
//     campo, né dell'appuntamento di test né tantomeno dei pazienti reali.
app.post('/api/test-promemoria', async (req, res) => {
  const NUMERO_DOTTORE = '+393513746102';
  const appFinto = {
    id: '14456eca-9616-4173-824c-d0625c6eec14', // appuntamento di test, solo per riferimento nei log
    conferma_token: 'h3DRquo',                   // token reale già esistente — nessuna scrittura DB
    data_ora_inizio: new Date(Date.now() + 26 * 3600 * 1000).toISOString(), // "domani" per il testo del messaggio
    pazienti: { telefono: NUMERO_DOTTORE },
  };

  try {
    const r = await inviaPromemoria(appFinto);
    console.log(`[Test Promemoria] Inviato a ${r.numero} — ${r.testo.length} caratteri:\n  "${r.testo}"`);
    res.json({ ok: true, numero: r.numero, lunghezza: r.testo.length, testo: r.testo });
  } catch (e) {
    console.error('[Test Promemoria] Errore:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── Test fix "token conferma sovrascritto" — prova end-to-end reale ─────
// POST /api/test-token-fix
// Riproduce ESATTAMENTE il caso segnalato: stesso appuntamento passato
// prima a inviaPromemoria (SMS) poi a inviaWhatsappPromemoria (WhatsApp),
// come fa il cron delle 08:00 (services/reminder.js). Prova che il token
// spedito nell'SMS sia lo STESSO che risulta salvato su Supabase dopo
// entrambi gli invii — non un secondo token generato dalla chiamata
// WhatsApp che sovrascrive quello già spedito (vedi commit 635ba92).
//
// Vincoli di sicurezza, per costruzione (non a runtime):
//   - Il numero è FISSO nel codice (numero del Dott. Susino): non può
//     mandare a nessun altro, qualunque cosa arrivi nella richiesta.
//   - Non chiama MAI la funzione batch (inviaPromemoriDomani): zero
//     rischio sui promemoria reali di domani.
//   - Tocca il campo conferma_token SOLO sull'appuntamento di test
//     dedicato (lo stesso già usato da /api/test-promemoria) — nessun
//     altro campo, nessun altro appuntamento, nessun paziente reale.
app.post('/api/test-token-fix', async (req, res) => {
  const NUMERO_DOTTORE = '+393513746102';
  const APP_TEST_ID = '14456eca-9616-4173-824c-d0625c6eec14';

  try {
    // 1) Azzera il token sull'appuntamento di test, per obbligare urlConferma()
    //    a generarne uno nuovo (come succede a un vero promemoria non ancora
    //    inviato) — scrittura mirata solo su questa riga di test.
    const { error: errReset } = await supabase
      .from('appuntamenti')
      .update({ conferma_token: null })
      .eq('id', APP_TEST_ID);
    if (errReset) throw new Error(`Reset token fallito: ${errReset.message}`);

    // 2) Stesso oggetto passato prima all'SMS poi al WhatsApp, esattamente
    //    come nel cron reale (services/reminder.js righe 108-117).
    const appFinto = {
      id: APP_TEST_ID,
      conferma_token: null,
      data_ora_inizio: new Date(Date.now() + 26 * 3600 * 1000).toISOString(),
      pazienti: { telefono: NUMERO_DOTTORE },
    };

    const rSms = await inviaPromemoria(appFinto);
    const tokenDopoSms = appFinto.conferma_token; // deve essere valorizzato dal fix

    let whatsappEsito = 'saltato (non configurato)';
    if (whatsappConfigurato()) {
      await inviaWhatsappPromemoria(appFinto);
      whatsappEsito = 'inviato';
    }
    const tokenDopoWhatsapp = appFinto.conferma_token; // deve restare identico

    // 3) Rilettura indipendente dal DB: cosa risulta REALMENTE salvato ora.
    const { data: rigaDb, error: errLettura } = await supabase
      .from('appuntamenti')
      .select('conferma_token')
      .eq('id', APP_TEST_ID)
      .single();
    if (errLettura) throw new Error(`Rilettura DB fallita: ${errLettura.message}`);

    const tokenSuDb = rigaDb.conferma_token;
    const corrispondono = tokenDopoSms === tokenSuDb && tokenDopoWhatsapp === tokenSuDb;

    console.log(
      `[Test Token Fix] token SMS="${tokenDopoSms}" token dopo WhatsApp="${tokenDopoWhatsapp}" ` +
      `token su DB="${tokenSuDb}" → ${corrispondono ? 'COINCIDONO ✅' : 'NON COINCIDONO ❌'}`
    );

    res.json({
      ok: corrispondono,
      token_inviato_sms: tokenDopoSms,
      token_dopo_whatsapp: tokenDopoWhatsapp,
      token_su_db: tokenSuDb,
      corrispondono,
      whatsapp: whatsappEsito,
      testo_sms: rSms.testo,
      link_provalo: `${process.env.APP_URL || 'https://conferma.studiosusino.it'}/p/${tokenSuDb}`,
    });
  } catch (e) {
    console.error('[Test Token Fix] Errore:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── Test invio WhatsApp diretto — manda il promemoria a un numero ───────
// POST /api/test-whatsapp  { "numero": "333XXXXXXX" }
// Utile per verificare che WHATSAPP_PHONE_NUMBER_ID/WHATSAPP_ACCESS_TOKEN
// funzionino e che il template "promemoria_appuntamento" (l'unico creato e
// approvato su Meta, ago 2026 — vedi services/whatsapp.js) sia attivo.
// Manda dati finti (nessun appuntamento reale coinvolto).
app.post('/api/test-whatsapp', async (req, res) => {
  if (!whatsappConfigurato()) {
    return res.status(500).json({ error: 'WHATSAPP_PHONE_NUMBER_ID o WHATSAPP_ACCESS_TOKEN mancanti su Railway' });
  }

  const numero = normalizzaNumero(req.body.numero);
  if (!numero) return res.status(400).json({ error: 'Campo "numero" mancante o non valido nel body' });

  const nomeTemplate = process.env.WHATSAPP_TEMPLATE_PROMEMORIA || 'promemoria_appuntamento';

  try {
    const r = await inviaTemplate(numero, nomeTemplate, [
      'oggi (messaggio di test)',
      'https://referteco-production.up.railway.app/prenota',
    ]);
    res.json({ ok: true, numero, template: nomeTemplate, risposta_meta: r });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Attiva un numero WhatsApp appena aggiunto su Meta ────────────────────
// POST /api/whatsapp/registra-numero  { "pin": "123456" }
// Da chiamare UNA VOLTA per numero, dopo averlo verificato su WhatsApp
// Manager: senza questa chiamata il numero resta "Non in linea" e non può
// mandare messaggi (non esiste un pulsante equivalente sul sito di Meta
// per i numeri Cloud API). Il PIN è a scelta libera (6 cifre) — va tenuto a
// mente ma non serve mai nell'uso normale del sistema.
app.post('/api/whatsapp/registra-numero', async (req, res) => {
  if (!whatsappConfigurato()) {
    return res.status(500).json({ error: 'WHATSAPP_PHONE_NUMBER_ID o WHATSAPP_ACCESS_TOKEN mancanti su Railway' });
  }
  try {
    const r = await registraNumero(req.body.pin);
    res.json({ ok: true, risposta_meta: r });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Test promemoria SMS (appuntamenti di domani) ─────────────────────────
app.post('/api/reminder/test', async (req, res) => {
  try {
    const result = await inviaPromemoriDomani();
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Test invito recensione (esami refertati ieri) ────────────────────────
// Serve a provarlo subito senza aspettare le 11:00. Chiamarlo più volte non
// genera doppioni: ogni appuntamento viene marcato appena l'SMS parte.
app.post('/api/recensione/test', async (req, res) => {
  try {
    const result = await inviaRichiesteRecensione();
    res.json(result || { ok: true, nota: 'SMS_RECENSIONE non attivo: nessun invio.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Pagina prenotazione online (URL pulito: /prenota) ───────────────────
app.get('/prenota', (req, res) => {
  res.sendFile(path.join(FRONTEND_PATH, 'prenota.html'));
});

// ─── Informativa privacy GDPR (URL pulito: /privacy) ─────────────────────
app.get('/privacy', (req, res) => {
  res.sendFile(path.join(FRONTEND_PATH, 'privacy.html'));
});

// ─── Fallback SPA ────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(FRONTEND_PATH, 'index.html'));
});

// ─── Error handler ────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Errore]', err);
  res.status(500).json({ error: 'Errore interno del server' });
});

// ─── Socket.io ────────────────────────────────────────────────────────────
initSocket(server);

// ─── SMS Reminder cron job ────────────────────────────────────────────────
avviaReminder();

// ─── Avvio ────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════════╗`);
  console.log(`║  Agenda Backend — http://localhost:${PORT}  ║`);
  console.log(`╚══════════════════════════════════════════╝\n`);
});

// ─── One-shot: riscrive i regularHours su Google Business Profile ─────────
// Si attiva solo impostando GBP_SET_REGULAR_HOURS_ONCE=true su Railway.
// Va rimossa subito dopo l'uso: serve a riallineare gli orari fissi una volta,
// non a riscriverli a ogni riavvio.
if (process.env.GBP_SET_REGULAR_HOURS_ONCE === 'true') {
  const { impostaOrariBase } = require('./services/googleBusiness');
  impostaOrariBase()
    .then(() => console.log('[GBP] one-shot: regularHours impostati (lun-ven 9:00-12:30 e 15:00-19:00)'))
    .catch(e => console.error('[GBP] one-shot regularHours fallito:', e.message));
}

module.exports = { app, server };
