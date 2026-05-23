const express = require('express');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const multer = require('multer');
const db = require('./database');
const config = require('./config');

const app = express();
app.use(express.json());

// In modalità pkg i file statici stanno accanto all'eseguibile
const PUBLIC_DIR = process.pkg
  ? path.join(path.dirname(process.execPath), 'public')
  : path.join(__dirname, 'public');

app.use(express.static(PUBLIC_DIR));

// ── IMMAGINI ─────────────────────────────────────────────────

function getImgDir(refertoId) {
  return path.join(config.getDataDir(), 'immagini', refertoId);
}

const imgStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = getImgDir(req.params.id);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, base + ext);
  },
});
const upload = multer({ storage: imgStorage, limits: { fileSize: 100 * 1024 * 1024 } });

app.get('/api/referti/:id/immagini', (req, res) => {
  const dir = getImgDir(req.params.id);
  if (!fs.existsSync(dir)) return res.json([]);
  res.json(fs.readdirSync(dir).filter(f => !f.startsWith('.')).sort());
});

app.post('/api/referti/:id/immagini', upload.array('files', 50), (req, res) => {
  res.json({ importate: req.files.length, files: req.files.map(f => f.filename) });
});

app.delete('/api/referti/:id/immagini/:filename', (req, res) => {
  const file = path.join(getImgDir(req.params.id), path.basename(req.params.filename));
  try { if (fs.existsSync(file)) fs.unlinkSync(file); } catch (e) {}
  res.json({ ok: true });
});

app.get('/immagini/:id/:filename', (req, res) => {
  const file = path.join(getImgDir(req.params.id), path.basename(req.params.filename));
  if (!fs.existsSync(file)) return res.status(404).end();
  res.sendFile(path.resolve(file));
});

// ── REFERTI ──────────────────────────────────────────────────

app.get('/api/referti/export', (req, res) => {
  const { referti } = db.get();
  res.setHeader('Content-Disposition', `attachment; filename="referteco_backup_${new Date().toISOString().split('T')[0]}.json"`);
  res.json([...referti].sort((a, b) => b.data.localeCompare(a.data)));
});

app.get('/api/referti', (req, res) => {
  const { search, tipo, anno } = req.query;
  let result = [...db.get().referti];
  if (search) {
    const s = search.toLowerCase();
    result = result.filter(r =>
      r.cognome.toLowerCase().includes(s) || r.nome.toLowerCase().includes(s)
    );
  }
  if (tipo) result = result.filter(r => r.tipo === tipo);
  if (anno) result = result.filter(r => r.data.startsWith(anno));
  result.sort((a, b) => b.data.localeCompare(a.data));
  res.json(result);
});

app.get('/api/referti/:id', (req, res) => {
  const r = db.get().referti.find(x => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'Non trovato' });
  res.json(r);
});

app.put('/api/referti/:id', (req, res) => {
  const state = db.get();
  const r = state.referti.find(x => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'Non trovato' });
  const { cognome, nome, nascita, tipo, data, referto } = req.body;
  if (!cognome || !nome || !tipo || !data) {
    return res.status(400).json({ error: 'Campi obbligatori mancanti' });
  }
  r.cognome = cognome;
  r.nome = nome;
  r.nascita = nascita || null;
  r.tipo = tipo;
  r.data = data;
  r.referto = referto || null;
  db.persist();
  res.json(r);
});

app.post('/api/referti', (req, res) => {
  const { id, cognome, nome, nascita, tipo, data, referto, creato } = req.body;
  if (!cognome || !nome || !tipo || !data) {
    return res.status(400).json({ error: 'Campi obbligatori mancanti' });
  }
  const record = {
    id: id || Date.now().toString(),
    cognome, nome,
    nascita: nascita || null,
    tipo, data,
    referto: referto || null,
    creato: creato || new Date().toISOString(),
  };
  const state = db.get();
  if (state.referti.find(x => x.id === record.id)) {
    return res.status(409).json({ error: 'ID già esistente' });
  }
  state.referti.push(record);
  db.persist();
  res.status(201).json({ id: record.id });
});

app.delete('/api/referti/:id', (req, res) => {
  const state = db.get();
  const before = state.referti.length;
  state.referti = state.referti.filter(x => x.id !== req.params.id);
  if (state.referti.length < before) db.persist();
  res.json({ ok: true });
});

app.post('/api/referti/import', (req, res) => {
  const data = req.body;
  if (!Array.isArray(data)) return res.status(400).json({ error: 'Formato non valido' });
  const state = db.get();
  const esistenti = new Set(state.referti.map(x => x.id));
  let importati = 0;
  for (const r of data) {
    if (!esistenti.has(r.id)) {
      state.referti.push(r);
      importati++;
    }
  }
  if (importati > 0) db.persist();
  res.json({ importati });
});

// ── PREDEFINITI ──────────────────────────────────────────────

app.get('/api/predefiniti', (req, res) => {
  const list = [...db.get().predefiniti].sort((a, b) => a.ordine - b.ordine || a.id - b.id);
  res.json(list);
});

app.post('/api/predefiniti', (req, res) => {
  const { titolo, testo } = req.body;
  if (!titolo || !testo) return res.status(400).json({ error: 'Titolo e testo obbligatori' });
  const state = db.get();
  const maxOrdine = state.predefiniti.reduce((m, p) => Math.max(m, p.ordine), 0);
  const nuovoId = state.nextPredefId++;
  const p = { id: nuovoId, titolo, testo, ordine: maxOrdine + 1 };
  state.predefiniti.push(p);
  db.persist();
  res.status(201).json(p);
});

app.put('/api/predefiniti/:id', (req, res) => {
  const state = db.get();
  const id = Number(req.params.id);
  const p = state.predefiniti.find(x => x.id === id);
  if (!p) return res.status(404).json({ error: 'Non trovato' });
  const { titolo, testo, categoria } = req.body;
  if (!titolo || !testo) return res.status(400).json({ error: 'Titolo e testo obbligatori' });
  p.titolo = titolo;
  p.testo = testo;
  if (categoria !== undefined) p.categoria = categoria;
  db.persist();
  res.json(p);
});

app.delete('/api/predefiniti/:id', (req, res) => {
  const state = db.get();
  const id = Number(req.params.id);
  const before = state.predefiniti.length;
  state.predefiniti = state.predefiniti.filter(x => x.id !== id);
  if (state.predefiniti.length < before) db.persist();
  res.json({ ok: true });
});

// ── CONFIGURAZIONE ───────────────────────────────────────────

app.get('/api/config', (req, res) => {
  const cfg = config.load();
  res.json({
    dataDir: cfg.dataDir || null,
    currentDir: config.getDataDir(),
    dbFile: db.DB_FILE,
    detectedGoogleDrive: config.detectGoogleDrive(),
    hasApiKey: !!cfg.anthropicApiKey,
  });
});

app.post('/api/config', (req, res) => {
  const { dataDir, anthropicApiKey } = req.body;
  const existing = config.load();
  const toSave = { ...existing };
  if (dataDir !== undefined) toSave.dataDir = dataDir || null;
  if (anthropicApiKey) toSave.anthropicApiKey = anthropicApiKey;
  config.save(toSave);
  res.json({ ok: true });
});

// ── AI CORREZIONE REFERTO ────────────────────────────────────

const AI_SYSTEM = `Sei un assistente medico specializzato in refertazione ecografica italiana. Ricevi il testo grezzo di un referto dettato vocalmente e devi correggerlo e formattarlo.

Regole:
- Usa sempre la forma impersonale italiana: "si documenta", "si rileva", "si osserva", "non si evidenziano", "non si rilevano", "si apprezza", ecc.
- Correggi artefatti vocali e incomprensioni del riconoscimento vocale mantenendo fedelmente il senso clinico
- Non aggiungere né rimuovere contenuto clinico: correggi solo la forma, non la sostanza
- Segnala parole ambigue o incomprensibili con [??]
- Correggi punteggiatura, grammatica e terminologia medica italiana
- Restituisci solo il testo corretto, senza spiegazioni, commenti o prefazioni aggiuntive`;

app.post('/api/ai/correggi', async (req, res) => {
  const { testo } = req.body;
  if (!testo || !testo.trim()) return res.status(400).json({ error: 'Testo mancante' });
  const cfg = config.load();
  if (!cfg.anthropicApiKey) {
    return res.status(400).json({ error: 'Chiave API Anthropic non configurata. Vai in Impostazioni e inserisci la tua chiave API.' });
  }
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': cfg.anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 4096,
        system: AI_SYSTEM,
        messages: [{ role: 'user', content: testo.trim() }],
      }),
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const msg = errData?.error?.message || ('Errore ' + response.status);
      console.error('Anthropic API error:', response.status, msg);
      if (response.status === 401) return res.status(401).json({ error: 'Chiave API non valida. Controlla la chiave in Impostazioni.' });
      if (response.status === 429) return res.status(429).json({ error: 'Limite richieste Anthropic raggiunto. Riprova tra qualche secondo.' });
      return res.status(502).json({ error: 'Errore API Anthropic (' + response.status + '): ' + msg });
    }
    const data = await response.json();
    const testoCorretto = data.content?.[0]?.text;
    if (!testoCorretto) return res.status(502).json({ error: 'Risposta Anthropic non valida' });
    res.json({ testo: testoCorretto });
  } catch (e) {
    console.error('AI correction error:', e);
    res.status(500).json({ error: 'Errore di connessione al servizio AI' });
  }
});

// ── INTEGRAZIONE AGENDA ──────────────────────────────────────
// Token di servizio a lunga durata per comunicazione RefertEco → Agenda
const AGENDA_API_URL = 'https://referteco-production.up.railway.app/api';
const AGENDA_TOKEN   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjRlMzliY2YxLTRjZTctNDdiNy1iMzk2LTgyNmU4MTE1NTI0OSIsInVzZXJuYW1lIjoibWVkaWNvIiwicnVvbG8iOiJtZWRpY28iLCJpYXQiOjE3Nzk1NDMzMDAsImV4cCI6MjA5NTExOTMwMH0.siqAwgLKT7pN9zaGNnP6kcne-3lhEaQBIY30Z0X8ji0';

// Pazienti con stato "arrivato" oggi
app.get('/api/agenda/pazienti-attesa', async (req, res) => {
  try {
    const r = await fetch(`${AGENDA_API_URL}/appuntamenti/oggi`, {
      headers: { 'Authorization': `Bearer ${AGENDA_TOKEN}` }
    });
    if (!r.ok) return res.json([]);
    const lista = await r.json();
    res.json(lista.filter(a => a.stato === 'arrivato'));
  } catch (e) {
    res.json([]);
  }
});

// Segna un appuntamento come "refertato"
app.post('/api/agenda/marca-refertato/:id', async (req, res) => {
  try {
    await fetch(`${AGENDA_API_URL}/appuntamenti/${req.params.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${AGENDA_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ stato: 'refertato' })
    });
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// ── QUIT ─────────────────────────────────────────────────────

app.post('/api/quit', (req, res) => {
  res.json({ ok: true });
  setTimeout(() => process.exit(0), 200);
});

// ── AVVIO ────────────────────────────────────────────────────

const PORT = 3000;
app.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════╗');
  console.log('  ║   RefertEco — Gestionale referti ║');
  console.log('  ╚══════════════════════════════════╝');
  console.log('');
  console.log(`  → http://localhost:${PORT}`);
  console.log('');
  console.log('  Tieni questa finestra aperta mentre usi il programma.');
  console.log('  Per uscire: chiudi questa finestra.');
  console.log('');
});
