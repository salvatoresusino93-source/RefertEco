require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
// v20260526b
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

// ─── Test invio SMS manuale (solo in sviluppo o da admin) ────────────────
app.post('/api/reminder/test', async (req, res) => {
  try {
    const result = await inviaPromemoriDomani();
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
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
