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
  try {
    if (!fs.existsSync(dir)) return res.json([]);
    const files = fs.readdirSync(dir).filter(f => !f.startsWith('.')).sort();
    const r = db.get().referti.find(x => x.id === req.params.id);
    const hasCustomOrder = r && Array.isArray(r.immaginiOrdine) && r.immaginiOrdine.length > 0;
    if (hasCustomOrder) {
      const idx = new Map(r.immaginiOrdine.map((f, i) => [f, i]));
      files.sort((a, b) => {
        const ia = idx.has(a) ? idx.get(a) : Infinity;
        const ib = idx.has(b) ? idx.get(b) : Infinity;
        return ia !== ib ? ia - ib : a.localeCompare(b, undefined, { numeric: true });
      });
    } else {
      files.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    }
    res.setHeader('X-Custom-Order', hasCustomOrder ? 'true' : 'false');
    return res.json(files);
  } catch (e) {
    console.error('[immagini list] errore lettura ' + dir + ':', e.message);
    return res.status(500).json({ error: 'Impossibile leggere cartella immagini', dir: dir, dettaglio: e.message });
  }
});

app.post('/api/referti/:id/immagini/ordine', (req, res) => {
  const { ordine } = req.body;
  if (!Array.isArray(ordine)) return res.status(400).json({ error: 'ordine deve essere un array' });
  const state = db.get();
  const r = state.referti.find(x => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'Non trovato' });
  r.immaginiOrdine = ordine;
  db.persist();
  res.json({ ok: true });
});

app.post('/api/referti/:id/immagini', upload.array('files', 2000), (req, res) => {
  const dest = getImgDir(req.params.id);
  const isOnDrive = /drive|cloudstorage/i.test(dest);
  console.log('[upload] referto=' + req.params.id + ' destinazione=' + dest +
    ' (' + (isOnDrive ? 'GOOGLE DRIVE' : 'locale') + ') file_ricevuti=' + req.files.length);
  if (req.files.length > 0) {
    console.log('[upload] primo file: ' + req.files[0].filename + ' (' + req.files[0].size + ' B)');
    console.log('[upload] ultimo file: ' + req.files[req.files.length - 1].filename);
  }
  res.json({
    importate: req.files.length,
    files: req.files.map(f => f.filename),
    dest: dest,
    syncedToDrive: isOnDrive
  });
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
  const wasDeleted = state.referti.length < before;
  if (wasDeleted) db.persist();

  // Cancella anche la cartella immagini associata (su Google Drive o locale)
  let immaginiEliminate = 0;
  const imgDir = getImgDir(req.params.id);
  if (fs.existsSync(imgDir)) {
    try {
      // Conta i file prima della cancellazione per logging
      try { immaginiEliminate = fs.readdirSync(imgDir).filter(f => !f.startsWith('.')).length; } catch(e) {}
      fs.rmSync(imgDir, { recursive: true, force: true });
      const isOnDrive = /drive|cloudstorage/i.test(imgDir);
      console.log('[delete] referto=' + req.params.id + ' cartella eliminata=' + imgDir +
        ' (' + (isOnDrive ? 'GOOGLE DRIVE' : 'locale') + ') file_rimossi=' + immaginiEliminate);
    } catch (e) {
      console.error('[delete] errore rimozione ' + imgDir + ':', e.message);
      return res.status(500).json({
        ok: false,
        recordEliminato: wasDeleted,
        error: 'Record eliminato ma cartella immagini non rimossa: ' + e.message,
        cartella: imgDir
      });
    }
  } else {
    console.log('[delete] referto=' + req.params.id + ' (nessuna cartella immagini)');
  }

  res.json({ ok: true, recordEliminato: wasDeleted, immaginiEliminate: immaginiEliminate });
});

// Pulisce le cartelle immagini orfane (cartelle senza referto corrispondente nel DB)
app.post('/api/referti/pulisci-orfane', (req, res) => {
  const imgRoot = path.join(config.getDataDir(), 'immagini');
  if (!fs.existsSync(imgRoot)) return res.json({ orfane: 0, eliminate: [], spazioMB: 0 });

  const idsValidi = new Set(db.get().referti.map(r => r.id));
  const eliminate = [];
  let spazioByte = 0;
  let errori = [];

  try {
    const cartelle = fs.readdirSync(imgRoot, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    for (const id of cartelle) {
      if (idsValidi.has(id)) continue; // referto esistente, salta
      const dir = path.join(imgRoot, id);
      try {
        // Calcola size
        const sub = fs.readdirSync(dir);
        for (const f of sub) {
          try { spazioByte += fs.statSync(path.join(dir, f)).size; } catch(e) {}
        }
        fs.rmSync(dir, { recursive: true, force: true });
        eliminate.push(id);
        console.log('[pulisci-orfane] rimossa ' + dir);
      } catch (e) {
        errori.push({ id, err: e.message });
      }
    }
  } catch (e) {
    return res.status(500).json({ error: 'Errore scansione: ' + e.message });
  }

  res.json({
    orfane: eliminate.length,
    eliminate: eliminate,
    spazioMB: Math.round(spazioByte / 1024 / 1024 * 10) / 10,
    errori: errori
  });
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
const AGENDA_API_URL = 'https://referteco-production.up.railway.app/api';
const AGENDA_TOKEN   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjRlMzliY2YxLTRjZTctNDdiNy1iMzk2LTgyNmU4MTE1NTI0OSIsInVzZXJuYW1lIjoibWVkaWNvIiwicnVvbG8iOiJtZWRpY28iLCJpYXQiOjE3Nzk1NDMzMDAsImV4cCI6MjA5NTExOTMwMH0.siqAwgLKT7pN9zaGNnP6kcne-3lhEaQBIY30Z0X8ji0';

app.get('/api/agenda/pazienti-attesa', async (req, res) => {
  try {
    const from = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const to   = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const r = await fetch(
      `${AGENDA_API_URL}/appuntamenti?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      { headers: { 'Authorization': `Bearer ${AGENDA_TOKEN}` } }
    );
    if (!r.ok) return res.json([]);
    const lista = await r.json();
    res.json(lista.filter(a => a.stato === 'arrivato'));
  } catch (e) { res.json([]); }
});

app.post('/api/agenda/marca-refertato/:id', async (req, res) => {
  try {
    await fetch(`${AGENDA_API_URL}/appuntamenti/${req.params.id}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${AGENDA_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ stato: 'refertato' })
    });
    res.json({ ok: true });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

// ── ORTHANC PROXY ────────────────────────────────────────────

const ORTHANC_BASE = 'http://localhost:8042';

async function orthancFetch(path, opts) {
  return fetch(ORTHANC_BASE + path, opts);
}

app.get('/api/orthanc/status', async (req, res) => {
  try {
    const r = await orthancFetch('/system');
    if (!r.ok) return res.json({ online: false });
    const data = await r.json();
    res.json({ online: true, version: data.Version, aet: data.DicomAet });
  } catch { res.json({ online: false }); }
});

app.get('/api/orthanc/studi', async (req, res) => {
  try {
    const r = await orthancFetch('/studies');
    if (!r.ok) return res.status(503).json({ error: 'Orthanc: ' + r.status });
    const ids = await r.json();
    const recent = ids.slice(-40).reverse();
    const studi = (await Promise.all(recent.map(async id => {
      try {
        const s = await (await orthancFetch('/studies/' + id)).json();
        const pt = s.PatientMainDicomTags || {};
        const st = s.MainDicomTags || {};
        const rawName = (pt.PatientName || '').trim();
        const nameParts = rawName.split('^').map(x => x.trim()).filter(Boolean);
        const patientName = nameParts.slice(0, 2).join(' ');
        const rawBirth = (pt.PatientBirthDate || '').replace(/\D/g, '');
        const birthDate = rawBirth.length === 8
          ? rawBirth.slice(6) + '/' + rawBirth.slice(4, 6) + '/' + rawBirth.slice(0, 4) : '';
        const rawDate = (st.StudyDate || '').replace(/\D/g, '');
        const studyDate = rawDate.length === 8
          ? rawDate.slice(6) + '/' + rawDate.slice(4, 6) + '/' + rawDate.slice(0, 4) : '';
        return {
          id, patientName, patientId: pt.PatientID || '', birthDate, studyDate,
          description: st.StudyDescription || st.RequestedProcedureDescription || '',
          modality: st.ModalitiesInStudy || '',
          nInstances: (s.Instances || []).length,
          stabile: s.IsStable,
        };
      } catch { return null; }
    }))).filter(Boolean);
    res.json(studi);
  } catch (e) {
    res.status(503).json({ error: 'Orthanc non raggiungibile. Verificare che il servizio sia attivo.' });
  }
});

app.post('/api/orthanc/importa/:studyId', async (req, res) => {
  const { refertoId } = req.body;
  if (!refertoId) return res.status(400).json({ error: 'refertoId mancante' });
  try {
    const study = await (await orthancFetch('/studies/' + req.params.studyId)).json();
    const instanceIds = study.Instances || [];
    if (instanceIds.length === 0) return res.json({ importati: 0, files: [], paziente: {} });

    const dir = getImgDir(refertoId);
    fs.mkdirSync(dir, { recursive: true });

    const saved = [];
    for (let i = 0; i < instanceIds.length; i++) {
      try {
        const r = await orthancFetch('/instances/' + instanceIds[i] + '/file');
        if (!r.ok) continue;
        const fname = 'orthanc_' + String(i + 1).padStart(4, '0') + '.dcm';
        fs.writeFileSync(path.join(dir, fname), Buffer.from(await r.arrayBuffer()));
        saved.push(fname);
      } catch (e) {
        console.error('[orthanc] istanza ' + instanceIds[i] + ':', e.message);
      }
    }

    const pt = study.PatientMainDicomTags || {};
    const st = study.MainDicomTags || {};
    const rawName = (pt.PatientName || '').split('^').map(x => x.trim()).filter(Boolean);
    const rawDate = (st.StudyDate || '').replace(/\D/g, '');
    res.json({
      importati: saved.length,
      files: saved,
      paziente: {
        cognome: rawName[0] || '',
        nome: rawName[1] || '',
        nascita: pt.PatientBirthDate
          ? pt.PatientBirthDate.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') : '',
        tipo: st.StudyDescription || st.RequestedProcedureDescription || '',
        data: rawDate.length === 8
          ? rawDate.slice(0, 4) + '-' + rawDate.slice(4, 6) + '-' + rawDate.slice(6) : '',
      }
    });
  } catch (e) {
    console.error('[orthanc importa]', e);
    res.status(500).json({ error: 'Errore importazione: ' + e.message });
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
