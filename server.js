const express = require('express');
const path = require('path');
const fs = require('fs');
const { exec, spawn } = require('child_process');
const os = require('os');
const multer = require('multer');
const db = require('./database');
const config = require('./config');

const app = express();
app.use(express.json({ limit: '50mb' }));

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
      // Natural sort: il numero nel nome file rispecchia l'ordine di acquisizione
      // (es. _1.dcm, _2.dcm, ..., _10.dcm → ordine numerico corretto)
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
  });
});

app.post('/api/config', (req, res) => {
  const { dataDir } = req.body;
  const existing = config.load();
  const toSave = { ...existing };
  if (dataDir !== undefined) toSave.dataDir = dataDir || null;
  config.save(toSave);
  res.json({ ok: true });
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
const WORKLIST_DIR = 'K:\\OrthancWorklists';

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
    // Usa /studies?expand per ottenere tutti gli studi con i tag in una sola chiamata
    const r = await orthancFetch('/studies?expand');
    if (!r.ok) return res.status(503).json({ error: 'Orthanc: ' + r.status });
    const tutti = await r.json();
    const studi = tutti.map(s => {
      try {
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
        const nInstances = parseInt(s.Statistics?.CountInstances || s.Instances?.length || 0, 10);
        return {
          id: s.ID, patientName, patientId: pt.PatientID || '', birthDate, studyDate,
          description: st.StudyDescription || st.RequestedProcedureDescription || '',
          modality: st.ModalitiesInStudy || '',
          nInstances,
          stabile: s.IsStable,
          rawDate: rawDate || '00000000',
        };
      } catch { return null; }
    }).filter(Boolean);
    // Ordina per data esame, più recente prima
    studi.sort((a, b) => b.rawDate.localeCompare(a.rawDate));
    // Rimuove rawDate dall'output (era solo per ordinare)
    studi.forEach(s => delete s.rawDate);
    res.json(studi);
  } catch (e) {
    res.status(503).json({ error: 'Orthanc non raggiungibile. Verificare che il servizio sia attivo.' });
  }
});

// Calcola una chiave cronologica (timestamp) confrontabile dai tag DICOM di un'istanza.
// Usa, in ordine di preferenza: AcquisitionDateTime, ContentDate+Time, AcquisitionDate+Time,
// InstanceCreationDate+Time. Restituisce stringa di 20 cifre (YYYYMMDD + HHMMSS + frazione) o ''.
function _timestampDaTag(tags) {
  const digits = v => (v || '').replace(/\D/g, '');
  const fmtTime = v => { const d = digits(v); return d ? (d.slice(0, 6).padEnd(6, '0') + d.slice(6).padEnd(6, '0')) : ''; };
  const acqDT = digits(tags.AcquisitionDateTime);
  if (acqDT.length >= 8) return (acqDT.slice(0, 8) + acqDT.slice(8).padEnd(12, '0')).slice(0, 20).padEnd(20, '0');
  const date = digits(tags.ContentDate) || digits(tags.AcquisitionDate) || digits(tags.InstanceCreationDate);
  const time = fmtTime(tags.ContentTime) || fmtTime(tags.AcquisitionTime) || fmtTime(tags.InstanceCreationTime);
  if (time) return ((date.length === 8 ? date : '00000000') + time).padEnd(20, '0');
  return '';
}

// Ordina una lista di instanceId per ordine cronologico di acquisizione reale.
// Interroga i tag completi di ogni istanza (su localhost è veloce). Fallback: SeriesNumber + InstanceNumber.
async function _ordinaIstanzeCronologico(instanceIds) {
  const conChiave = await Promise.all(instanceIds.map(async (id, origIdx) => {
    let key = '', series = 0, inst = 0;
    try {
      const tags = await (await orthancFetch('/instances/' + id + '/tags?simplify')).json();
      key = _timestampDaTag(tags);
      series = parseInt(tags.SeriesNumber || '0', 10) || 0;
      inst = parseInt(tags.InstanceNumber || '0', 10) || 0;
    } catch {}
    return { id, key, series, inst, origIdx };
  }));
  conChiave.sort((a, b) => {
    if (a.key && b.key && a.key !== b.key) return a.key < b.key ? -1 : 1;
    if (a.key && !b.key) return -1;
    if (!a.key && b.key) return 1;
    if (a.series !== b.series) return a.series - b.series;
    if (a.inst !== b.inst) return a.inst - b.inst;
    return a.origIdx - b.origIdx;
  });
  return conChiave.map(x => x.id);
}

app.post('/api/orthanc/importa/:studyId', async (req, res) => {
  const { refertoId } = req.body;
  if (!refertoId) return res.status(400).json({ error: 'refertoId mancante' });
  try {
    const study = await (await orthancFetch('/studies/' + req.params.studyId)).json();
    // Orthanc a livello Study espone "Series", non "Instances": le istanze vanno
    // prese da /studies/{id}/instances (altrimenti l'import scaricherebbe 0 immagini)
    const instArr = await (await orthancFetch('/studies/' + req.params.studyId + '/instances')).json();
    // Importa SOLO le immagini fisse: salta i video/cine (NumberOfFrames > 1).
    // I video restano su Orthanc e si consultano con MicroDicom.
    let videoSaltati = 0;
    const instanceIdsFiltrati = (instArr || []).filter(inst => {
      const nf = parseInt((inst.MainDicomTags && inst.MainDicomTags.NumberOfFrames) || '1', 10);
      if (nf > 1) { videoSaltati++; return false; }
      return true;
    }).map(x => x.ID);
    if (instanceIdsFiltrati.length === 0) return res.json({ importati: 0, files: [], paziente: {}, videoSaltati });

    // Ordina cronologicamente PRIMA di salvare: così orthanc_0001.dcm = prima immagine acquisita.
    // Tutto il resto (carosello, griglia, PDF) usa l'ordine dei file → ordine corretto ovunque.
    const instanceIds = await _ordinaIstanzeCronologico(instanceIdsFiltrati);

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
      videoSaltati,
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

// Importa le istanze di un accession number NON ancora viste — per real-time
// GET /api/orthanc/istanze-nuove?accession=XXX&viste=id1,id2,...
// Restituisce [{id, nFrames}] — solo le nuove (non video), da importare singolarmente
app.get('/api/orthanc/istanze-nuove', async (req, res) => {
  const { accession, viste } = req.query;
  if (!accession) return res.json([]);
  const giàViste = new Set((viste || '').split(',').filter(Boolean));
  try {
    // Cerca lo studio per accession number
    const found = await (await orthancFetch('/tools/find', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Level: 'Study', Query: { AccessionNumber: accession } }),
    })).json();
    if (!found || !found.length) return res.json([]);
    const studyId = found[0];

    // Lista istanze dello studio
    const instArr = await (await orthancFetch('/studies/' + studyId + '/instances')).json();
    const nuove = (instArr || [])
      .filter(inst => {
        if (giàViste.has(inst.ID)) return false;
        const nf = parseInt((inst.MainDicomTags && inst.MainDicomTags.NumberOfFrames) || '1', 10);
        return nf <= 1; // salta video/cine
      })
      .map(inst => ({ id: inst.ID }));
    res.json(nuove);
  } catch (e) {
    res.json([]);
  }
});

// Scarica una singola istanza DICOM da Orthanc nel referto
// POST /api/orthanc/importa-istanza/:instanceId  { refertoId }
app.post('/api/orthanc/importa-istanza/:instanceId', async (req, res) => {
  const { refertoId } = req.body;
  if (!refertoId) return res.status(400).json({ error: 'refertoId mancante' });
  try {
    const r = await orthancFetch('/instances/' + req.params.instanceId + '/file');
    if (!r.ok) return res.status(404).json({ error: 'Istanza non trovata in Orthanc' });
    const dir = getImgDir(refertoId);
    fs.mkdirSync(dir, { recursive: true });
    // Numero progressivo basato sui file già presenti
    const existing = fs.readdirSync(dir).filter(f => f.endsWith('.dcm')).length;
    const fname = 'orthanc_' + String(existing + 1).padStart(4, '0') + '.dcm';
    fs.writeFileSync(path.join(dir, fname), Buffer.from(await r.arrayBuffer()));
    res.json({ ok: true, file: fname });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── WORKLIST DICOM (paziente arrivato → ecografo) ────────────
// Crea una voce di worklist DICOM che il Samsung V5 vedrà al prossimo
// "DICOM Worklist Query". Usa /tools/create-dicom di Orthanc per generare il file
// DICOM con i tag corretti, poi lo salva in K:\OrthancWorklists.
app.post('/api/worklist/crea', async (req, res) => {
  const {
    paziente_cognome,
    paziente_nome,
    paziente_data_nascita,
    accession_number,
    tipo_esame,
    data_ora_inizio,
  } = req.body;

  if (!paziente_cognome || !paziente_nome || !accession_number) {
    return res.status(400).json({ error: 'Mancano campi: cognome, nome, accession_number' });
  }

  const patientName = `${paziente_cognome.toUpperCase()}^${paziente_nome}`;
  const patientId   = String(accession_number); // riusa accession come PatientID per ora
  const dob         = (paziente_data_nascita || '').replace(/-/g, '');
  const startDate   = data_ora_inizio
    ? new Date(data_ora_inizio).toISOString().slice(0, 10).replace(/-/g, '')
    : new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const startTime   = data_ora_inizio
    ? new Date(data_ora_inizio).toTimeString().slice(0, 8).replace(/:/g, '')
    : '090000';

  try {
    // RequestedProcedureDescription e ScheduledProcedureStepDescription
    // vengono inviati vuoti per non triggerare nessun protocollo EzExam+
    // sul Samsung V5 (il Samsung legge questi campi per attivare preset automatici).
    const tags = {
      PatientName:               patientName,
      PatientID:                 patientId,
      PatientBirthDate:          dob,
      AccessionNumber:           accession_number,
      RequestedProcedureID:      accession_number,
      RequestedProcedureDescription: '',
      ScheduledProcedureStepSequence: [{
        ScheduledStationAETitle:           'MEDISON',
        ScheduledProcedureStepStartDate:   startDate,
        ScheduledProcedureStepStartTime:   startTime,
        Modality:                          'US',
        ScheduledPerformingPhysicianName:  'SUSINO^SALVATORE',
        ScheduledProcedureStepDescription: '',
        ScheduledProcedureStepID:          accession_number,
      }],
    };

    const orthancRes = await orthancFetch('/tools/create-dicom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ Tags: tags }),
    });

    if (!orthancRes.ok) {
      const err = await orthancRes.text();
      return res.status(500).json({ error: 'Orthanc create-dicom fallito: ' + err });
    }

    // L'istanza è stata creata; per la worklist serve il FILE DICOM raw
    // Lo recupero e lo salvo come .wl nella cartella worklist
    const json = await orthancRes.json();
    const instanceId = json.ID;
    const fileRes = await orthancFetch('/instances/' + instanceId + '/file');
    if (!fileRes.ok) {
      return res.status(500).json({ error: 'Impossibile recuperare il file DICOM' });
    }
    const buf = Buffer.from(await fileRes.arrayBuffer());

    fs.mkdirSync(WORKLIST_DIR, { recursive: true });
    const wlFile = path.join(WORKLIST_DIR, accession_number + '.wl');
    fs.writeFileSync(wlFile, buf);

    // Rimuovi l'istanza temporanea da Orthanc (era solo per generare il file)
    await orthancFetch('/instances/' + instanceId, { method: 'DELETE' }).catch(() => {});

    res.json({ ok: true, accession_number, file: wlFile });
  } catch (e) {
    console.error('[worklist crea]', e);
    res.status(500).json({ error: e.message });
  }
});

// Cerca studi Orthanc per AccessionNumber — restituisce [{id, stabile, nImmagini}]
app.get('/api/orthanc/cerca-accession', async (req, res) => {
  const n = req.query.n;
  if (!n) return res.status(400).json({ error: 'Manca parametro n (accession number)' });
  try {
    const r = await orthancFetch('/tools/find', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        Level: 'Study',
        Query: { AccessionNumber: n },
      }),
    });
    if (!r.ok) return res.json([]);
    const ids = await r.json() || [];
    // Per ogni studio aggiunge info stabilità (IsStable = Orthanc ha ricevuto tutto)
    const studi = await Promise.all(ids.map(async id => {
      try {
        const s = await (await orthancFetch('/studies/' + id)).json();
        // Conteggio istanze da /statistics (a livello Study non c'è "Instances")
        let nImmagini = 0;
        try {
          const st = await (await orthancFetch('/studies/' + id + '/statistics')).json();
          nImmagini = parseInt(st.CountInstances || 0, 10);
        } catch {}
        return { id, stabile: s.IsStable === true, nImmagini };
      } catch { return { id, stabile: false, nImmagini: 0 }; }
    }));
    res.json(studi);
  } catch (e) {
    res.json([]);
  }
});

// Lista worklist attive
app.get('/api/worklist', (req, res) => {
  try {
    if (!fs.existsSync(WORKLIST_DIR)) return res.json([]);
    const files = fs.readdirSync(WORKLIST_DIR).filter(f => f.endsWith('.wl'));
    res.json(files.map(f => ({
      accession_number: f.replace(/\.wl$/, ''),
      file: f,
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Rimuovi una worklist (es. quando esame completato o annullato)
app.delete('/api/worklist/:accession', (req, res) => {
  try {
    const file = path.join(WORKLIST_DIR, req.params.accession + '.wl');
    if (fs.existsSync(file)) fs.unlinkSync(file);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── ORTHANC ARCHIVIA REFERTO ─────────────────────────────────
// Invia le immagini del referto a Orthanc con i dati del paziente
app.post('/api/orthanc/archivia/:refertoId', async (req, res) => {
  const { refertoId } = req.params;
  try {
    // Leggi dati referto dal database
    const referti = db.getReferti();
    const referto = referti.find(r => String(r.id) === String(refertoId));
    if (!referto) return res.status(404).json({ error: 'Referto non trovato' });

    const imgDir = getImgDir(refertoId);
    if (!fs.existsSync(imgDir)) return res.json({ archiviati: 0, msg: 'Nessuna immagine da archiviare' });

    const files = fs.readdirSync(imgDir).filter(f =>
      /\.(dcm|DCM|jpg|jpeg|png|JPG|PNG)$/i.test(f)
    );
    if (files.length === 0) return res.json({ archiviati: 0, msg: 'Nessuna immagine da archiviare' });

    // Dati paziente per i tag DICOM
    const patientName = `${(referto.cognome || '').toUpperCase()}^${referto.nome || ''}`;
    const patientDob  = (referto.nascita || '').replace(/-/g, '');  // YYYYMMDD
    const studyDate   = (referto.data    || '').replace(/-/g, '');
    const studyDesc   = referto.tipo || 'Ecografia';
    const studyUID    = `2.25.${refertoId}`;

    let archiviati = 0;
    const errori = [];

    for (const fname of files) {
      const fpath = path.join(imgDir, fname);
      const isDicom = /\.dcm$/i.test(fname);

      try {
        let dicomBuffer;

        if (isDicom) {
          // File DICOM: invia direttamente aggiornando solo i tag paziente
          dicomBuffer = fs.readFileSync(fpath);
        } else {
          // JPEG/PNG: crea DICOM Secondary Capture minimale
          const imgData = fs.readFileSync(fpath);
          const base64  = imgData.toString('base64');

          // Usa l'API /tools/create-dicom di Orthanc per creare DICOM da immagine
          const createRes = await orthancFetch('/tools/create-dicom', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              Tags: {
                PatientName:      patientName,
                PatientID:        String(refertoId),
                PatientBirthDate: patientDob,
                StudyDate:        studyDate,
                StudyDescription: studyDesc,
                StudyInstanceUID: studyUID,
                Modality:         'OT',
                SOPClassUID:      '1.2.840.10008.5.1.4.1.1.7', // Secondary Capture
              },
              Content: `data:image/${isDicom ? 'dcm' : fname.match(/\.(\w+)$/)?.[1] || 'jpeg'};base64,${base64}`,
            }),
          });

          if (!createRes.ok) {
            errori.push(`${fname}: create-dicom fallito (${createRes.status})`);
            continue;
          }
          archiviati++;
          continue; // create-dicom salva direttamente in Orthanc, non serve upload separato
        }

        // Upload DICOM direttamente
        const uploadRes = await orthancFetch('/instances', {
          method: 'POST',
          headers: { 'Content-Type': 'application/dicom' },
          body: dicomBuffer,
        });

        if (uploadRes.ok) {
          archiviati++;
        } else {
          errori.push(`${fname}: upload fallito (${uploadRes.status})`);
        }
      } catch (e) {
        errori.push(`${fname}: ${e.message}`);
      }
    }

    res.json({ ok: true, archiviati, totale: files.length, errori });
  } catch (e) {
    console.error('[orthanc archivia]', e);
    res.status(500).json({ error: e.message });
  }
});

// ── FIRMA DIGITALE (OpenAPI.com + Namirial) ──────────────────

function trovaChrome() {
  const exe = 'chrome.exe';
  const pf   = process.env['PROGRAMFILES']      || 'C:\\Program Files';
  const pf86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
  const loc  = process.env['LOCALAPPDATA']       || '';
  const candidates = [
    path.join(pf,   'Google\\Chrome\\Application', exe),
    path.join(pf86, 'Google\\Chrome\\Application', exe),
    path.join(loc,  'Google\\Chrome\\Application', exe),
  ];
  return candidates.find(p => { try { return fs.existsSync(p); } catch { return false; } }) || null;
}

async function htmlToPdf(htmlContent, outputPath) {
  const chromePath = trovaChrome();
  if (!chromePath) throw new Error('Chrome non trovato. Installa Google Chrome.');
  const tmpHtml = path.join(os.tmpdir(), 'referteco_' + Date.now() + '.html');
  fs.writeFileSync(tmpHtml, htmlContent, 'utf8');
  await new Promise((resolve, reject) => {
    const htmlUrl = 'file:///' + tmpHtml.replace(/\\/g, '/');
    const proc = spawn(chromePath, [
      '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-extensions',
      `--print-to-pdf=${outputPath}`, '--no-pdf-header-footer', htmlUrl,
    ]);
    const timer = setTimeout(() => { proc.kill(); reject(new Error('Chrome timeout')); }, 30000);
    proc.on('close', code => {
      clearTimeout(timer);
      try { fs.unlinkSync(tmpHtml); } catch {}
      if (fs.existsSync(outputPath)) resolve();
      else reject(new Error('Chrome non ha generato il PDF (code ' + code + ')'));
    });
  });
}

function stampaPdf(pdfPath) {
  return new Promise(resolve => {
    // Usa il visualizzatore PDF predefinito di Windows in modalità stampa
    exec(`powershell -Command "Start-Process -FilePath '${pdfPath}' -Verb Print"`, () => resolve());
  });
}

// Base URL del servizio firma: sandbox (gratis, per provare) o produzione (firma vera).
// Si commuta dall'interruttore in Impostazioni → Firma Digitale.
function firmaBaseUrl(cfg) {
  return cfg.firmaTest
    ? 'https://test.esignature.openapi.com'
    : 'https://esignature.openapi.com';
}

// Genera un token OAuth OpenAPI.com per le chiamate eSignature.
// Il flow corretto: Basic(email:apikey) → POST oauth.openapi.it/token → Bearer token.
// Gli scope devono usare il dominio .com (test.esignature.openapi.com o esignature.openapi.com).
async function openapiOAuthToken(cfg) {
  const EMAIL = 'salvatore.susino93@gmail.com';
  const isTest = cfg.firmaTest !== false;
  const oauthUrl = isTest ? 'https://test.oauth.openapi.it/token' : 'https://oauth.openapi.it/token';
  const esignDomain = isTest ? 'test.esignature.openapi.com' : 'esignature.openapi.com';
  const scopes = [
    `POST:${esignDomain}/EU-QES_automatic`,
    `GET:${esignDomain}/signatures`,
  ];
  const basic = 'Basic ' + Buffer.from(EMAIL + ':' + cfg.openapiKey).toString('base64');
  const r = await fetch(oauthUrl, {
    method: 'POST',
    headers: { 'Authorization': basic, 'Content-Type': 'application/json' },
    body: JSON.stringify({ scopes }),
  });
  const data = await r.json();
  if (!r.ok || !data.token) throw new Error('Impossibile ottenere token OAuth OpenAPI.com: ' + JSON.stringify(data).slice(0, 200));
  return data.token;
}

// Log compatto delle risposte API (per rifinire i nomi dei campi durante i test in sandbox)
function logFirma(tag, obj) {
  try {
    const s = typeof obj === 'string' ? obj : JSON.stringify(obj);
    console.log('[firma] ' + tag + ': ' + s.slice(0, 1200));
  } catch { console.log('[firma] ' + tag + ': <non serializzabile>'); }
}

app.get('/api/firma/config', (req, res) => {
  const cfg = config.load();
  res.json({
    namirialUsername: cfg.namirialUsername || '',
    hasKey:  !!cfg.openapiKey,
    hasPin:  !!cfg.namirialPin,
    firmaTest: cfg.firmaTest !== false, // default: TEST (sandbox) finché non si passa in produzione
    configurato: !!(cfg.openapiKey && cfg.namirialUsername && cfg.namirialPin),
  });
});

app.post('/api/firma/config', (req, res) => {
  const { openapiKey, namirialUsername, namirialPin, firmaTest } = req.body;
  const cfg = config.load();
  if (openapiKey)       cfg.openapiKey       = openapiKey;
  if (namirialUsername) cfg.namirialUsername  = namirialUsername;
  if (namirialPin)      cfg.namirialPin       = namirialPin;
  if (typeof firmaTest === 'boolean') cfg.firmaTest = firmaTest;
  config.save(cfg);
  res.json({ ok: true });
});

// Firma automatica (senza OTP) + stampa.
// Flusso: HTML → PDF → POST /EU-QES_automatic → attende fine firma → scarica PDF firmato → salva → stampa.
app.post('/api/firma-e-stampa', async (req, res) => {
  const { html, refertoId } = req.body;
  if (!html) return res.status(400).json({ error: 'html richiesto' });

  const cfg = config.load();
  if (!cfg.openapiKey || !cfg.namirialUsername || !cfg.namirialPin) {
    return res.status(400).json({ error: 'Credenziali firma non configurate. Vai in Impostazioni → Firma Digitale.' });
  }

  const base = firmaBaseUrl(cfg);
  const pdfPath = path.join(os.tmpdir(), 'referteco_unsigned_' + Date.now() + '.pdf');
  try {
    // 1. Genera token OAuth (API key → token Bearer per eSignature)
    const oauthToken = await openapiOAuthToken(cfg);
    const auth = { 'Authorization': `Bearer ${oauthToken}`, 'Content-Type': 'application/json' };

    // 2bis. HTML → PDF con Chrome headless
    await htmlToPdf(html, pdfPath);
    const pdfBase64 = fs.readFileSync(pdfPath).toString('base64');

    // 3. Avvia la firma automatica (PAdES, nessun OTP) — firma grafica soppressa
    const safeName = (refertoId || Date.now()).toString().replace(/[^a-zA-Z0-9_-]/g, '_');
    const sigResp = await fetch(`${base}/EU-QES_automatic`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        inputDocuments: [{ sourceType: 'base64', payload: pdfBase64 }],
        certificateUsername: cfg.namirialUsername,
        certificatePassword: cfg.namirialPin,
        signatureType: 'pades',
        title: 'Referto ' + safeName,
        options: { signerImage: { imageVisible: false } },
      }),
    });
    const sigText = await sigResp.text();
    logFirma('EU-QES_automatic ' + sigResp.status, sigText);
    if (sigResp.status === 401) throw new Error('Token OpenAPI.com non valido o scaduto. Genera un nuovo token in console.openapi.com → Authentication e aggiornalo in Impostazioni → Firma Digitale.');
    if (!sigResp.ok) throw new Error(`OpenAPI.com errore ${sigResp.status}: ${sigText.slice(0, 300)}`);
    const sigData = JSON.parse(sigText);
    const sigId = sigData?.data?.id || sigData?.id;
    if (!sigId) throw new Error('Risposta firma senza id pratica. Controllare il log [firma].');

    // 4. Attende il completamento (gestisce sia firma sincrona sia asincrona)
    let signedB64 = sigData?.data?.signedDocument || sigData?.signedDocument || null;
    if (!signedB64) {
      const statiFatti = ['DONE', 'COMPLETED', 'SIGNED', 'done', 'completed', 'signed'];
      for (let i = 0; i < 20 && !signedB64; i++) {
        await new Promise(r => setTimeout(r, 1500));
        // 3a. scarica direttamente il documento firmato
        const dl = await fetch(`${base}/signatures/${sigId}/signedDocument`, { headers: auth });
        if (dl.ok) {
          const ct = dl.headers.get('content-type') || '';
          if (ct.includes('application/json')) {
            const j = await dl.json();
            signedB64 = j?.data?.signedDocument || j?.data?.payload || j?.signedDocument || null;
          } else {
            // risposta binaria = PDF firmato
            const buf = Buffer.from(await dl.arrayBuffer());
            if (buf.length > 500) { signedB64 = buf.toString('base64'); }
          }
          if (signedB64) break;
        }
        // 3b. altrimenti controlla lo stato della pratica e continua ad attendere
        const st = await fetch(`${base}/signatures/${sigId}`, { headers: auth });
        if (st.ok) {
          const sd = await st.json();
          const stato = sd?.data?.state || sd?.state || '';
          logFirma('stato pratica', stato);
          if (sd?.data?.error || /ERROR|FAIL/i.test(stato)) {
            throw new Error('Firma fallita: ' + (sd?.data?.message || stato));
          }
        }
      }
    }
    if (!signedB64) throw new Error('Timeout: PDF firmato non disponibile. Controllare il log [firma].');

    // 5. Salva PDF firmato
    const signedBuffer = Buffer.from(signedB64, 'base64');
    const firmaDir = path.join(config.getDataDir(), 'firmati');
    fs.mkdirSync(firmaDir, { recursive: true });
    const today = new Date().toISOString().slice(0, 10);
    const signedPath = path.join(firmaDir, `referto_${safeName}_${today}_firmato.pdf`);
    fs.writeFileSync(signedPath, signedBuffer);

    // 6. Stampa automaticamente (best-effort, non blocca se il viewer non supporta Print verb)
    stampaPdf(signedPath).catch(() => {});

    // 7. Restituisce anche il PDF firmato come base64 per il download browser
    res.json({ ok: true, file: signedPath, test: !!cfg.firmaTest, pdfBase64: signedB64 });
  } catch (e) {
    console.error('[firma-e-stampa]', e.message);
    res.status(500).json({ error: e.message });
  } finally {
    try { if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath); } catch {}
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
