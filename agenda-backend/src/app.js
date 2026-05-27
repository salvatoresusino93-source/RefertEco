require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
// v20260527b
const express = require('express');
const http    = require('http');
const cors    = require('cors');
const path    = require('path');

const { initSocket } = require('./socket');
const { avviaReminder, inviaPromemoriDomani } = require('./services/reminder');
const authRoutes         = require('./routes/auth');
const pazientiRoutes     = require('./routes/pazienti');
const appuntamentiRoutes = require('./routes/appuntamenti');
const prestazioniRoutes  = require('./routes/prestazioni');
const syncRoutes         = require('./routes/sync');
const blocchiRoutes      = require('./routes/blocchi');
const gbpRoutes          = require('./routes/gbp');
const publicRoutes       = require('./routes/public');
const prenotaRoutes      = require('./routes/prenota');

const app    = express();
const server = http.createServer(app);

// ─── Middleware ───────────────────────────────────────────────────────────
app.use(cors());
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
app.use('/api/public',        publicRoutes);  // no auth — prenotazione online
app.use('/api/prenota',       prenotaRoutes); // no auth — conferma/rifiuto via email

// ─── Health check ────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'agenda-backend', ts: new Date().toISOString() });
});

// ─── Test email notifica ─────────────────────────────────────────────────
app.post('/api/test-email', async (req, res) => {
  const key = process.env.RESEND_API_KEY;
  if (!key) return res.status(500).json({ error: 'RESEND_API_KEY non impostata su Railway' });
  try {
    const { Resend } = require('resend');
    const resend = new Resend(key);
    const r = await resend.emails.send({
      from: 'Agenda Studio <onboarding@resend.dev>',
      to: 'salvatore.susino93@gmail.com',
      subject: 'Test da Railway — RefertEco',
      html: '<p>Email di test dal server Railway. Funziona!</p>',
    });
    res.json({ ok: true, id: r.id });
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

// ─── Test promemoria SMS (appuntamenti di domani) ─────────────────────────
app.post('/api/reminder/test', async (req, res) => {
  try {
    const result = await inviaPromemoriDomani();
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Pagina prenotazione online (URL pulito: /prenota) ───────────────────
app.get('/prenota', (req, res) => {
  res.sendFile(path.join(FRONTEND_PATH, 'prenota.html'));
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

module.exports = { app, server };
