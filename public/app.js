// ── DATI MEDICO ──────────────────────────────────────────────
const MEDICO = {
  nome:     'Dott. Salvatore Susino',
  titolo:   'Medico Chirurgo — Specialista in Radiodiagnostica',
  studio:   'Ambulatorio di Ecografia Clinica',
  indirizzo:"Via dell'Arno, n° 34 — Pozzallo (RG)",
  email:    'salvatoresusino.md@gmail.com',
  cell:     '339-4028454',
  ordine:   'O.M. RG 3071',
  cf:       'CF: SSNSVT93M14H163N',
};

// ── TEMA PDF ──────────────────────────────────────────────────
const PDF_THEMES = {
  verde:    { accent:'#2d5016', mid:'#4a7c2a', light:'#f5f8f2', line:'#c8dcc0' },
  nero:     { accent:'#111111', mid:'#333333', light:'#f2f2f2', line:'#cccccc' },
  blu:      { accent:'#1a3a6b', mid:'#2c5f8a', light:'#eef3f8', line:'#b8cfe0' },
  bordeaux: { accent:'#7a1a1a', mid:'#9e2a2a', light:'#f8efef', line:'#e0c0c0' },
};

function selezionaTema(nome) {
  localStorage.setItem('pdf_tema', nome);
  document.querySelectorAll('.tema-swatch').forEach(el => {
    el.classList.toggle('active', el.dataset.tema === nome);
  });
  toast('Tema PDF salvato', 'ok');
}

function loadTema() {
  const t = localStorage.getItem('pdf_tema') || 'verde';
  document.querySelectorAll('.tema-swatch').forEach(el => {
    el.classList.toggle('active', el.dataset.tema === t);
  });
}

// ── STATO ────────────────────────────────────────────────────
let referti = [];
let sortField = 'data', sortDir = -1;

// ── UTILITÀ TESTO ─────────────────────────────────────────────
function capitalizeWords(str) {
  if (!str) return str;
  return str.trim().replace(/\b\w/g, l => l.toUpperCase());
}

function processaVoce(testo) {
  if (!testo) return testo;
  let r = testo
    .replace(/\ba capo\b/gi, '\n')
    .replace(/\bdue punti\b/gi, ':')
    .replace(/\bpunto e virgola\b/gi, ';')
    .replace(/\bpunto esclamativo\b/gi, '!')
    .replace(/\bpunto interrogativo\b/gi, '?')
    .replace(/\bpunto\b/gi, '.')
    .replace(/\bvirgola\b/gi, ',')
    .replace(/ +([.,!?:;])/g, '$1');
  // capitalizza la lettera subito dopo un punto/!/? (stesso chunk)
  r = r.replace(/([.!?]\s+)(\w)/g, (_, p, l) => p + l.toUpperCase());
  // capitalizza la lettera subito dopo un a capo (stesso chunk)
  r = r.replace(/\n(\w)/g, (_, l) => '\n' + l.toUpperCase());
  return r;
}

// ── DATE ─────────────────────────────────────────────────────
function oggi() { return new Date().toISOString().split('T')[0]; }
function fmt(d) { if (!d) return '—'; const [y,m,g] = d.split('-'); return g+'/'+m+'/'+y; }

function etaLabel(n, e) {
  if (!n || !e) return '—';
  const nd = new Date(n), ed = new Date(e);
  let a = ed.getFullYear() - nd.getFullYear();
  if (ed.getMonth() < nd.getMonth() || (ed.getMonth() === nd.getMonth() && ed.getDate() < nd.getDate())) a--;
  if (a < 2) {
    let m = (ed.getMonth() - nd.getMonth()) + (ed.getFullYear() - nd.getFullYear()) * 12;
    if (ed.getDate() < nd.getDate()) m--;
    return m <= 0 ? '< 1 mese' : m + ' mesi';
  }
  return a + ' anni';
}

function initTopbar() {
  document.getElementById('topbar-date').textContent =
    new Date().toLocaleDateString('it-IT', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
}

// ── API ───────────────────────────────────────────────────────
async function apiGet(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) {
      const errBody = await r.text().catch(() => '');
      console.error('[apiGet] HTTP ' + r.status + ' su ' + url + ' → ' + errBody);
      const err = new Error('HTTP ' + r.status);
      err.status = r.status;
      err.body = errBody;
      throw err;
    }
    return await r.json();
  } catch(e) {
    console.error('[apiGet] errore fetch ' + url, e);
    throw e;
  }
}
async function apiPost(url, body) {
  const r = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
  return r.json();
}
async function apiDelete(url) {
  const r = await fetch(url, { method:'DELETE' }); return r.json();
}

// ── CARICA REFERTI ────────────────────────────────────────────
async function loadReferti() {
  referti = await apiGet('/api/referti');
  updateCount();
}

function updateCount() {
  document.getElementById('sb-count').textContent = referti.length + ' referti archiviati';
}

// ── NAVIGAZIONE ───────────────────────────────────────────────
const TITOLI = { nuovo: 'Nuovo referto', archivio: 'Archivio referti', impostazioni: 'Impostazioni' };

function showView(n) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('view-' + n).classList.add('active');
  document.getElementById('nav-' + n).classList.add('active');
  document.getElementById('topbar-title').textContent = TITOLI[n] || n;
  if (n === 'archivio') { populateAnni(); renderArchivio(); }
  if (n === 'impostazioni') { loadConfig(); loadTema(); }
}

// ── TIPO ESAME ────────────────────────────────────────────────
function onTipoSelChange() {
  const v = document.getElementById('f-tipo-sel').value;
  const cust = document.getElementById('tipo-custom');
  if (v === '__custom__') {
    cust.style.display = 'block';
    document.getElementById('f-tipo-custom').focus();
  } else {
    cust.style.display = 'none';
  }
  onTipoChange();
}

function getTipoAttivo() {
  const sel = document.getElementById('f-tipo-sel').value;
  if (sel === '__custom__') return document.getElementById('f-tipo-custom').value.trim();
  return sel;
}

function onTipoCustomInput() { onTipoChange(); }

// ── TEMPLATES ─────────────────────────────────────────────────
const TEMPLATES = {
  'Ecografia addome superiore': [
    { lbl:'Negativo', txt:"Fegato di dimensioni nella norma, ecostruttura omogenea, regolare profilo superficiale. Non si rilevano lesioni focali. Colecisti normodistesa, pareti sottili, contenuto anecogeno, non calcolosi. Vie biliari intra- ed extraepatiche non dilatate. Pancreas visualizzato nei suoi segmenti, di aspetto ecografico nella norma. Milza di dimensioni e struttura nella norma. Non versamento libero addominale." },
    { lbl:'Steatosi lieve', txt:"Fegato di dimensioni nella norma con incremento dell'ecogenicità parenchimale, compatibile con quadro di steatosi epatica di grado lieve. Non si rilevano lesioni focali. Colecisti normodistesa, pareti sottili, non calcolosi. Vie biliari non dilatate. Pancreas nella norma. Milza nella norma." },
    { lbl:'Steatosi moderata', txt:"Fegato di dimensioni nella norma con marcato incremento dell'ecogenicità parenchimale e riduzione dell'attenuazione del fascio ultrasonoro, compatibile con steatosi epatica di grado moderato-severo. Non si rilevano lesioni focali. Colecisti normodistesa, non calcolosi. Vie biliari non dilatate. Pancreas nella norma. Milza nella norma." },
    { lbl:'Calcolosi colecisti', txt:"Fegato di dimensioni nella norma, ecostruttura omogenea. Non si rilevano lesioni focali. Colecisti normodistesa con presenza di formazione iperecogena di ___ mm con cono d'ombra posteriore, riferibile a calcolo. Pareti colecistiche di spessore nella norma. Vie biliari intra- ed extraepatiche non dilatate. Pancreas nella norma. Milza nella norma." },
    { lbl:'Cisti epatica', txt:'Fegato di dimensioni nella norma. Si documenta formazione anecogena a margini netti di ___ mm in sede ___, di tipo cistico semplice, priva di setti interni e componente solida. Colecisti nella norma. Vie biliari non dilatate. Pancreas nella norma. Milza nella norma.' },
  ],
  'Ecografia addome completo': [
    { lbl:'Negativo', txt:'Fegato di dimensioni nella norma, ecostruttura omogenea, non lesioni focali. Colecisti normodistesa, non calcolosi. Vie biliari non dilatate. Pancreas nella norma. Milza nella norma.\nRene destro di dimensioni nella norma, regolare differenziazione cortico-midollare, assenza di idronefrosi e litiasi. Rene sinistro di dimensioni nella norma, regolare differenziazione cortico-midollare, assenza di idronefrosi e litiasi.\nVescica in idoneo riempimento, pareti regolari, contenuto anecogeno. Residuo post-minzionale nella norma.\nNon versamento libero in cavità peritoneale.' },
  ],
  'Ecografia apparato urinario': [
    { lbl:'Negativo', txt:'Rene destro di dimensioni nella norma (___ mm), regolare morfologia e differenziazione cortico-midollare, assenza di idronefrosi e immagini di tipo litiasico.\nRene sinistro di dimensioni nella norma (___ mm), regolare morfologia e differenziazione cortico-midollare, assenza di idronefrosi e immagini di tipo litiasico.\nVescica in idoneo riempimento, pareti regolari, contenuto anecogeno, non immagini intraluminali. Residuo post-minzionale nella norma (___ ml).' },
    { lbl:'Calcolosi renale', txt:"Rene destro: si documenta formazione iperecogena con cono d'ombra posteriore di ___ mm in sede ___, riferibile a litiasi. Assenza di idronefrosi.\nRene sinistro: nella norma per dimensioni e morfologia, regolare differenziazione cortico-midollare, assenza di idronefrosi.\nVescica nella norma." },
    { lbl:'Idronefrosi', txt:'Rene ___: si documenta dilatazione del sistema pielo-caliceale di grado ___ (lieve/moderato/severo), con pelvi renale di ___ mm. Non si rilevano immagini di tipo litiasico nel tratto ureterale visualizzabile.\nRene ___: nella norma.\nVescica nella norma.' },
  ],
  'Ecografia tiroide': [
    { lbl:'Negativo', txt:'Tiroide di dimensioni nella norma, ecostruttura omogenea, ecogenicità conservata. Lobo destro: ___ × ___ × ___ mm. Lobo sinistro: ___ × ___ × ___ mm. Istmo: ___ mm.\nNon si rilevano formazioni nodulari. Non linfoadenomegalie laterocervicali rilevabili.' },
    { lbl:'Nodulo tiroideo', txt:'Tiroide di dimensioni nella norma. Si documenta formazione nodulare ___ (ipo/iso/iperecogena), a margini ___, di ___ × ___ mm, in sede ___ del lobo ___. Pattern vascolare ___. Classificazione EU-TIRADS ___.\nNon ulteriori noduli rilevabili. Non linfoadenomegalie laterocervicali rilevabili.' },
    { lbl:'Tiroidite', txt:'Tiroide di volume ___ (aumentato/ridotto), ecostruttura disomogenea con aree ipoecogene diffuse, compatibile con quadro di tiroidite cronica. Lobo destro: ___ × ___ × ___ mm. Lobo sinistro: ___ × ___ × ___ mm.\nNon si rilevano formazioni nodulari di rilievo. Non linfoadenomegalie laterocervicali rilevabili.' },
  ],
  'Ecografia parti molli': [
    { lbl:'Negativo', txt:'In sede ___, a livello ___, i piani muscolo-aponeurotici appaiono nella norma, senza evidenza di raccolte, lesioni focali o alterazioni strutturali di rilievo. Il tessuto adiposo sottocutaneo è omogeneo.' },
    { lbl:'Cisti', txt:'In sede ___ si documenta formazione anecogena a margini netti di ___ × ___ mm, con parete sottile, priva di componente solida interna, di tipo cistico semplice.' },
    { lbl:'Raccolta', txt:'In sede ___ si documenta raccolta ___ (anecogena/ipoecogena/complessa) di ___ × ___ mm, a margini ___. Non si documentano segni di vascolarizzazione interna al color Doppler.' },
    { lbl:'Lipoma', txt:'In sede ___ si documenta formazione iperecogena omogenea a margini netti di ___ × ___ mm, in sede sottocutanea, compatibile con lipoma. Non si documentano segni di vascolarizzazione interna al color Doppler.' },
  ],
  'Ecocolordoppler TSA (tronchi sovraortici)': [
    { lbl:'TSA negativo', txt:'Asse carotideo destro: arteria carotide comune, biforcazione, arteria carotide interna ed esterna pervie, con normale profilo di flusso. IMT nella norma (___ mm). Non placche aterosclerotiche.\nAsse carotideo sinistro: arteria carotide comune, biforcazione, arteria carotide interna ed esterna pervie, con normale profilo di flusso. IMT nella norma (___ mm). Non placche aterosclerotiche.\nArterie vertebrali bilateralmente pervie, flusso anterogrado.' },
    { lbl:'Placca carotidea', txt:'Asse carotideo ___: presenza di placca aterosclerotica ___ (ipo/iso/iperecogena, omogenea/disomogenea) in sede ___ di ___ mm, con stenosi stimabile ___ (< 50% / 50-70% / > 70%). Flusso conservato/alterato a valle.\nAsse carotideo ___: nella norma.' },
  ],
  'Ecocolordoppler venoso arti inferiori': [
    { lbl:'Negativo', txt:'Asse iliaco-femorale-popliteo-tibiale bilateralmente pervio, comprimibile, senza evidenza di trombosi endoluminale. Flusso trifasico conservato nei segmenti esplorati. Non varici di rilievo.' },
    { lbl:'TVP', txt:'A livello ___ si documenta trombosi venosa del/la ___. Il vaso risulta non comprimibile, con assenza di flusso al color Doppler. I segmenti a monte e a valle appaiono pervii.' },
  ],
  'Ecografia muscolo-scheletrica': [
    { lbl:'Spalla negativa', txt:"Cuffia dei rotatori integra. Tendine del sopraspinato di aspetto nella norma, non soluzioni di continuo, non calcificazioni. Tendine del sottospinato nella norma. Tendine del capo lungo del bicipite normodecorrente nel solco bicipitale. Non versamento in borsa subacromio-deltoidea. Articolazione gleno-omerale nella norma." },
    { lbl:'Ginocchio negativo', txt:"Tendine quadricipitale e tendine rotuleo integri, nella norma per ecostruttura e spessore. Legamenti collaterali nella norma. Non versamento articolare di rilievo. Non cisti di Baker. Cartilagine femorale nella norma nei settori esplorati." },
    { lbl:'Tendinopatia', txt:'A livello del tendine ___ si documenta alterazione ecostrutturale con aree ipoecogene e incremento del calibro tendineo (___ mm), compatibile con quadro di tendinopatia. Al color Doppler si documenta/non si documenta ipervascolarizzazione intratendinea.' },
    { lbl:'Lesione muscolare', txt:'A livello del muscolo ___ si documenta alterazione ecostrutturale con area ___ (ipoecogena/anecogena/disomogenea) di ___ × ___ mm, compatibile con lesione di grado ___ (stiramento/parziale/completa). Non ematoma organizzato.' },
  ],
  'Ecografia spalla': [
    { lbl:'Spalla negativa', txt:"Cuffia dei rotatori integra. Tendine del sopraspinato di aspetto nella norma, non soluzioni di continuo, non calcificazioni. Tendine del sottospinato nella norma. Tendine del capo lungo del bicipite normodecorrente nel solco bicipitale. Non versamento in borsa subacromio-deltoidea. Articolazione gleno-omerale nella norma." },
    { lbl:'Tendinopatia', txt:'A livello del tendine ___ si documenta alterazione ecostrutturale con aree ipoecogene e incremento del calibro tendineo (___ mm), compatibile con quadro di tendinopatia.' },
  ],
  'Ecografia ginocchio': [
    { lbl:'Negativo', txt:"Tendine quadricipitale e tendine rotuleo integri, nella norma per ecostruttura e spessore. Legamenti collaterali nella norma. Non versamento articolare di rilievo. Non cisti di Baker. Cartilagine femorale nella norma nei settori esplorati." },
  ],
};

function onTipoChange() {
  const tipo = getTipoAttivo();
  const bar = document.getElementById('tpl-bar');
  bar.innerHTML = '';
  (TEMPLATES[tipo] || []).forEach(t => {
    const b = document.createElement('button');
    b.className = 'tpl-btn';
    b.textContent = t.lbl;
    b.onclick = () => { document.getElementById('f-referto').value = t.txt; };
    bar.appendChild(b);
  });
}

// ── SALVA REFERTO ─────────────────────────────────────────────
async function salvaReferto() {
  const cognome = capitalizeWords(document.getElementById('f-cognome').value);
  const nome = capitalizeWords(document.getElementById('f-nome').value);
  const tipo = getTipoAttivo();
  const data = document.getElementById('f-data').value;
  if (!cognome || !nome) { toast('Inserire cognome e nome', 'err'); return; }
  if (!tipo) { toast('Selezionare o digitare il tipo di esame', 'err'); return; }
  if (!data) { toast("Inserire la data dell'esame", 'err'); return; }
  const r = {
    id: _tempRefertoId || Date.now().toString(),
    cognome, nome,
    nascita: document.getElementById('f-nascita').value || null,
    tipo, data,
    referto: document.getElementById('f-referto').value.trim() || null,
    creato: new Date().toISOString(),
  };
  const res = await apiPost('/api/referti', r);
  if (res.error) { toast('Errore: ' + res.error, 'err'); return; }
  // Le immagini sono già sul server con _tempRefertoId, ora associato all'id salvato
  _viewerFiles = []; _viewerIndex = 0; _tempRefertoId = null;
  toast('Referto salvato', 'ok');
  await loadReferti();
  resetForm();
}

function resetForm() {
  ['f-cognome','f-nome','f-nascita','f-referto','f-tipo-custom'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('f-tipo-sel').value = '';
  document.getElementById('f-data').value = oggi();
  document.getElementById('tpl-bar').innerHTML = '';
  document.getElementById('tipo-custom').style.display = 'none';
  stopAllDictation();
  svuotaViewer();
  _testoOriginaleAI = null;
  document.getElementById('ai-corr-btn').style.display = '';
  document.getElementById('ai-annulla-btn').style.display = 'none';
  document.getElementById('ai-spinner').style.display = 'none';
}

// ── VIEWER IMMAGINI (creazione referto) ──────────────────────
let _viewerFiles   = [];   // { filename, displayUrl, pixelSpacing:{row,col}|null }
let _viewerIndex   = 0;
let _tempRefertoId = null;

// ── ZOOM / PAN ────────────────────────────────────────────────
let _zoomLevel  = 1;
let _panX       = 0;
let _panY       = 0;
let _isPanning  = false;
let _panStart   = null;   // { mx, my, px, py }

function clampPan() {
  if (_zoomLevel <= 1) { _panX = 0; _panY = 0; return; }
  const canvas = document.getElementById('viewer-canvas');
  const img    = document.getElementById('viewer-img');
  if (!canvas || !img || !img.naturalWidth) return;
  const cw = canvas.width, ch = canvas.height;
  const s  = Math.min(cw / img.naturalWidth, ch / img.naturalHeight);
  const hw = img.naturalWidth  * s * _zoomLevel / 2;
  const hh = img.naturalHeight * s * _zoomLevel / 2;
  _panX = Math.max(-hw, Math.min(hw, _panX));
  _panY = Math.max(-hh, Math.min(hh, _panY));
}

function applyZoom() {
  const img    = document.getElementById('viewer-img');
  const canvas = document.getElementById('viewer-canvas');
  const lbl    = document.getElementById('viewer-zoom-lbl');
  if (!img) return;
  clampPan();
  img.style.transform       = _zoomLevel === 1 ? '' : `translate(${_panX}px,${_panY}px) scale(${_zoomLevel})`;
  img.style.transformOrigin = 'center center';
  if (lbl) lbl.textContent  = _zoomLevel === 1 ? '1×' : _zoomLevel.toFixed(1) + '×';
  if (canvas) {
    canvas.classList.toggle('measure-active', _measureMode);
    canvas.classList.toggle('pan-mode', _zoomLevel > 1 && !_measureMode);
  }
  redrawCanvas();
}

function resetZoom() {
  _zoomLevel = 1; _panX = 0; _panY = 0;
  applyZoom();
}

// Zoom di un fattore, centrato sul punto canvas (cx,cy) — default: centro
function zoomBy(factor, cx, cy) {
  const canvas = document.getElementById('viewer-canvas');
  const img    = document.getElementById('viewer-img');
  const newZ   = Math.max(1, Math.min(10, _zoomLevel * factor));
  if (newZ === _zoomLevel) return;
  if (canvas && img && img.naturalWidth) {
    const cw = canvas.width, ch = canvas.height;
    if (cx === undefined) cx = cw / 2;
    if (cy === undefined) cy = ch / 2;
    // Mantieni fisso il punto sotto il cursore
    const s  = Math.min(cw / img.naturalWidth, ch / img.naturalHeight);
    const sz = s * _zoomLevel;
    // Coordinate immagine sotto il cursore (con zoom attuale)
    const ix = (cx - _panX - (cw - img.naturalWidth  * sz) / 2) / sz;
    const iy = (cy - _panY - (ch - img.naturalHeight * sz) / 2) / sz;
    _zoomLevel = newZ;
    const szNew = s * newZ;
    _panX = cx - ix * szNew - (cw - img.naturalWidth  * szNew) / 2;
    _panY = cy - iy * szNew - (ch - img.naturalHeight * szNew) / 2;
  } else {
    _zoomLevel = newZ;
  }
  if (_zoomLevel === 1) { _panX = 0; _panY = 0; }
  applyZoom();
}

function onViewerDblClick(e) {
  if (_viewerFiles.length === 0) return;
  const wrap = document.getElementById('viewer-img-wrap');
  const rect = wrap.getBoundingClientRect();
  if (_zoomLevel === 1) zoomBy(2.5, e.clientX - rect.left, e.clientY - rect.top);
  else resetZoom();
}

// ── STRUMENTO MISURA ─────────────────────────────────────────
let _measureMode      = false;
let _measurements     = [];   // { x1,y1,x2,y2 } in coordinate pixel dell'immagine
let _measurePoint1    = null; // primo punto (image coords)
let _measureMouse     = null; // posizione mouse live (image coords)
let _hoveredMeasIdx   = -1;   // indice misura sotto il cursore (-1 = nessuna)
let _hoveredEndpoint  = null; // { measIdx, ep:0|1 } endpoint sotto il cursore
let _dragMeas         = null; // { measIdx, ep:0|1 } endpoint in trascinamento

async function caricaImmaginiViewer(e) {
  await processaFilesViewer(Array.from(e.target.files));
  e.target.value = '';
}

function _nomeFileUnivoco(file, estensione) {
  const rel = file.webkitRelativePath || file._fullPath || file.name;
  const parts = rel.split(/[\/\\]/).filter(Boolean);
  let base = file.name;
  if (estensione) {
    const cleanName = file.name.replace(/\.[^.]+$/, '') || ('dicom_' + Date.now());
    base = cleanName + estensione;
  }
  if (parts.length > 1) {
    const dirParts = parts.slice(0, -1).map(p => p.replace(/[^a-zA-Z0-9._-]/g, '_'));
    return dirParts.join('__') + '__' + base;
  }
  return base;
}

async function _isFileDicom(file) {
  try {
    if (file.size < 132) return false;
    const slice = file.slice(128, 132);
    const buf = await slice.arrayBuffer();
    const v = new Uint8Array(buf);
    return v[0] === 0x44 && v[1] === 0x49 && v[2] === 0x43 && v[3] === 0x4D;
  } catch(e) { return false; }
}

async function processaFilesViewer(files) {
  const noti = [];
  const daControllare = [];
  for (const f of files) {
    if (/\.(jpe?g|png|dcm|dicom)$/i.test(f.name)) {
      const ext = /\.dicom$/i.test(f.name) ? '.dcm' : null;
      const nuovoNome = _nomeFileUnivoco(f, ext);
      if (nuovoNome !== f.name || ext) {
        noti.push(new File([f], nuovoNome, { type: f.type }));
      } else {
        noti.push(f);
      }
    } else {
      daControllare.push(f);
    }
  }
  const dicomDetected = await Promise.all(daControllare.map(async f => {
    const ok = await _isFileDicom(f);
    if (!ok) return null;
    const nuovoNome = _nomeFileUnivoco(f, '.dcm');
    return new File([f], nuovoNome, { type: 'application/dicom' });
  }));
  const supportati = noti.concat(dicomDetected.filter(Boolean));

  console.log('[Import] File ricevuti: ' + files.length + ', noti per estensione: ' + noti.length + ', DICOM rilevati: ' + dicomDetected.filter(Boolean).length);

  if (!supportati.length) {
    toast('Nessun file immagine/DICOM valido trovato', 'err');
    return;
  }
  if (!_tempRefertoId) _tempRefertoId = Date.now().toString();

  document.getElementById('viewer-empty').style.display   = 'none';
  document.getElementById('viewer-display').style.display = 'none';
  document.getElementById('viewer-loading').style.display = 'flex';

  const BATCH = 30;
  let importatiOk = 0;
  for (let i = 0; i < supportati.length; i += BATCH) {
    const slice = supportati.slice(i, i + BATCH);
    const formData = new FormData();
    slice.forEach(f => formData.append('files', f));
    try {
      const resp = await fetch('/api/referti/' + _tempRefertoId + '/immagini', { method:'POST', body:formData });
      if (!resp.ok) { console.error('[Import] Batch ' + (i / BATCH + 1) + ' fallito: HTTP ' + resp.status); }
      else {
        const j = await resp.json().catch(() => ({}));
        importatiOk += (j.importate || slice.length);
        console.log('[Import] Batch ' + (i / BATCH + 1) + ': ' + (j.importate || slice.length) + ' file caricati');
      }
    } catch(e) { console.error('[Import] Errore batch ' + (i / BATCH + 1), e); }
  }
  console.log('[Import] Totale caricati: ' + importatiOk + '/' + supportati.length);
  if (importatiOk === 0) toast('Errore caricamento immagini', 'err');

  await ricaricaViewer(supportati);
}

async function ricaricaViewer(nuoviFile) {
  const filenames = await apiGet('/api/referti/' + _tempRefertoId + '/immagini');

  // Genera displayUrl solo per i file nuovi, riusa oggetti già caricati
  const mapEsistenti = {};
  _viewerFiles.forEach(f => { mapEsistenti[f.filename] = f; });

  const nuoviNomi = new Set((nuoviFile || []).map(f => f.name.replace(/[^a-zA-Z0-9._-]/g, '_')));

  _viewerFiles = [];
  for (const fname of filenames) {
    if (mapEsistenti[fname] && !nuoviNomi.has(fname)) {
      _viewerFiles.push(mapEsistenti[fname]); // già oggetto completo
    } else {
      const url = '/immagini/' + _tempRefertoId + '/' + encodeURIComponent(fname);
      const isDcm = /\.dcm$/i.test(fname);
      if (isDcm) {
        const { dataUrl, pixelSpacing } = await dicomLoadFull(url);
        _viewerFiles.push({ filename: fname, displayUrl: dataUrl || url, pixelSpacing });
      } else {
        const displayUrl = await imgToDataUrl(url);
        _viewerFiles.push({ filename: fname, displayUrl: displayUrl || url, pixelSpacing: null });
      }
    }
  }
  _viewerIndex = Math.min(_viewerIndex, Math.max(0, _viewerFiles.length - 1));
  document.getElementById('viewer-loading').style.display = 'none';
  renderViewer();
}

function renderViewer() {
  const empty   = document.getElementById('viewer-empty');
  const display = document.getElementById('viewer-display');
  if (_viewerFiles.length === 0) {
    empty.style.display   = 'flex';
    display.style.display = 'none';
    _measurements = []; _measurePoint1 = null; _measureMouse = null; _hoveredMeasIdx = -1; _hoveredEndpoint = null; _dragMeas = null; _isPanning = false; _panStart = null;
    clearCanvasNow();
    updateMeasureUI();
    return;
  }
  empty.style.display   = 'none';
  display.style.display = 'flex';
  // Azzera misure al cambio immagine
  _measurements = []; _measurePoint1 = null; _measureMouse = null; _hoveredMeasIdx = -1; _hoveredEndpoint = null; _dragMeas = null; _isPanning = false; _panStart = null;
  const img = document.getElementById('viewer-img');
  img.onload = () => { syncCanvasSize(); };
  img.src = _viewerFiles[_viewerIndex].displayUrl;
  document.getElementById('viewer-counter').textContent =
    (_viewerIndex + 1) + ' / ' + _viewerFiles.length;
  updateMeasureUI();
  updateCalibrationBadge();
}

function viewerNav(dir) {
  if (_viewerFiles.length === 0) return;
  _viewerIndex = (_viewerIndex + dir + _viewerFiles.length) % _viewerFiles.length;
  _zoomLevel = 1; _panX = 0; _panY = 0; // reset zoom al cambio immagine
  renderViewer();
}

function viewerScroll(e) {
  if (_viewerFiles.length === 0) return;
  e.preventDefault();
  // Scroll sopra l'area immagine → zoom centrato sul cursore
  if (e.target.closest && e.target.closest('#viewer-display')) {
    const wrap = document.getElementById('viewer-img-wrap');
    const rect = wrap.getBoundingClientRect();
    zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - rect.left, e.clientY - rect.top);
  } else {
    viewerNav(e.deltaY > 0 ? 1 : -1);
  }
}

function viewerDragOver(e) {
  e.preventDefault();
  document.getElementById('nuovo-viewer').classList.add('drag-over');
}
function viewerDragLeave() {
  document.getElementById('nuovo-viewer').classList.remove('drag-over');
}
// Legge ricorsivamente file da una FileSystemEntry (file o directory)
async function leggiEntry(entry) {
  if (entry.isFile) {
    return new Promise(resolve => entry.file(f => {
      try { Object.defineProperty(f, '_fullPath', { value: entry.fullPath, writable: false }); } catch(e) {}
      resolve([f]);
    }, err => { console.warn('[Import] errore file', entry.fullPath, err); resolve([]); }));
  }
  if (entry.isDirectory) {
    console.log('[Import] Entro in directory:', entry.fullPath);
    const reader = entry.createReader();
    const tutteLeEntries = [];
    await new Promise(resolve => {
      const leggiLotto = () => {
        reader.readEntries(lotto => {
          if (!lotto.length) { resolve(); return; }
          tutteLeEntries.push(...lotto);
          leggiLotto();
        }, err => { console.warn('[Import] errore directory', entry.fullPath, err); resolve(); });
      };
      leggiLotto();
    });
    console.log('[Import] Directory', entry.fullPath, 'contiene', tutteLeEntries.length, 'voci');
    const nested = await Promise.all(tutteLeEntries.map(leggiEntry));
    return nested.flat();
  }
  return [];
}

async function viewerDrop(e) {
  e.preventDefault();
  document.getElementById('nuovo-viewer').classList.remove('drag-over');

  let files = [];
  if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
    // Usa l'API FileSystem per leggere anche le cartelle trascinate
    const entries = Array.from(e.dataTransfer.items)
      .filter(item => item.kind === 'file')
      .map(item => item.webkitGetAsEntry())
      .filter(Boolean);
    const nested = await Promise.all(entries.map(leggiEntry));
    files = nested.flat();
  } else {
    files = Array.from(e.dataTransfer.files);
  }

  await processaFilesViewer(files);
}

async function eliminaImgViewer() {
  if (!_tempRefertoId || _viewerFiles.length === 0) return;
  const f = _viewerFiles[_viewerIndex];
  await apiDelete('/api/referti/' + _tempRefertoId + '/immagini/' + encodeURIComponent(f.filename));
  _viewerFiles.splice(_viewerIndex, 1);
  _viewerIndex = Math.min(_viewerIndex, Math.max(0, _viewerFiles.length - 1));
  renderViewer();
}

async function svuotaViewer() {
  if (_tempRefertoId && _viewerFiles.length > 0) {
    for (const f of _viewerFiles) {
      apiDelete('/api/referti/' + _tempRefertoId + '/immagini/' + encodeURIComponent(f.filename)).catch(()=>{});
    }
  }
  _viewerFiles  = [];
  _viewerIndex  = 0;
  _tempRefertoId = null;
  renderViewer();
}

// ── AI CORREZIONE REFERTO ─────────────────────────────────────
let _testoOriginaleAI = null;

async function correggiAI() {
  const ta = document.getElementById('f-referto');
  const testo = ta.value.trim();
  if (!testo) { toast('Inserire il testo del referto prima di correggere', 'err'); return; }
  _testoOriginaleAI = ta.value;
  const btn = document.getElementById('ai-corr-btn');
  const spinner = document.getElementById('ai-spinner');
  const annullaBtn = document.getElementById('ai-annulla-btn');
  btn.style.display = 'none';
  spinner.style.display = 'flex';
  try {
    const res = await fetch('/api/ai/correggi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testo }),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      toast('Errore: ' + (data.error || 'Risposta non valida'), 'err');
      btn.style.display = '';
      spinner.style.display = 'none';
      _testoOriginaleAI = null;
      return;
    }
    ta.value = data.testo;
    spinner.style.display = 'none';
    annullaBtn.style.display = '';
    toast('Referto corretto con AI', 'ok');
  } catch (e) {
    toast('Errore di connessione al servizio AI', 'err');
    btn.style.display = '';
    spinner.style.display = 'none';
    _testoOriginaleAI = null;
  }
}

function annullaCorrezioneAI() {
  if (_testoOriginaleAI === null) return;
  document.getElementById('f-referto').value = _testoOriginaleAI;
  _testoOriginaleAI = null;
  document.getElementById('ai-corr-btn').style.display = '';
  document.getElementById('ai-annulla-btn').style.display = 'none';
  toast('Testo originale ripristinato', 'ok');
}

// ── PREDEFINITI ───────────────────────────────────────────────
let predefiniti = [];

async function loadPredef() {
  predefiniti = await apiGet('/api/predefiniti');
}

function togglePanelPredef() {
  const p = document.getElementById('panel-predef');
  p.style.display = p.style.display === 'none' ? 'block' : 'none';
  if (p.style.display === 'block') renderPredef();
}

function renderPredef() {
  const list = document.getElementById('predef-list');
  if (predefiniti.length === 0) {
    list.innerHTML = '<div class="predef-empty">Nessun predefinito. Aggiungine uno qui sotto.</div>';
    return;
  }
  const groups = {};
  for (const p of predefiniti) {
    const cat = p.categoria || 'Generici';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(p);
  }
  list.innerHTML = Object.entries(groups).map(([cat, items]) => `
    <div class="predef-cat">
      <div class="predef-cat-hdr" onclick="toggleCat(this)">
        <span class="predef-cat-arrow">▼</span>
        <span>${esc(cat)}</span>
        <span class="predef-cat-count">${items.length}</span>
      </div>
      <div class="predef-cat-body">
        ${items.map(p => `
          <div class="predef-item" id="predef-item-${p.id}">
            <button class="predef-use" onclick="usaPredef(${p.id})" title="${esc(p.testo)}">${esc(p.titolo)}</button>
            <button class="predef-edit" onclick="editPredef(${p.id})" title="Modifica">✎</button>
            <button class="predef-del" onclick="eliminaPredef(${p.id})" title="Elimina">×</button>
          </div>`).join('')}
      </div>
    </div>`).join('');
}

function toggleCat(hdr) {
  const body = hdr.nextElementSibling;
  const arrow = hdr.querySelector('.predef-cat-arrow');
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  arrow.textContent = open ? '▶' : '▼';
}

function editPredef(id) {
  document.querySelectorAll('.predef-edit-form').forEach(el => el.remove());
  document.querySelectorAll('.predef-item.editing').forEach(el => el.classList.remove('editing'));
  const p = predefiniti.find(x => x.id === id);
  if (!p) return;
  const item = document.getElementById('predef-item-' + id);
  if (!item) return;
  item.classList.add('editing');
  const cats = [...new Set(predefiniti.map(x => x.categoria || 'Generici'))].sort();
  const form = document.createElement('div');
  form.className = 'predef-edit-form';
  form.innerHTML = `
    <select id="edit-cat-${id}">
      ${cats.map(c => `<option value="${esc(c)}"${(p.categoria||'Generici')===c?' selected':''}>${esc(c)}</option>`).join('')}
    </select>
    <input type="text" id="edit-tit-${id}" value="${esc(p.titolo)}" placeholder="Titolo">
    <textarea id="edit-txt-${id}" style="min-height:80px;font-size:12.5px;">${esc(p.testo)}</textarea>
    <div class="predef-edit-btns">
      <button class="btn btn-primary btn-sm" onclick="aggiornaPredef(${id})">Salva</button>
      <button class="btn btn-secondary btn-sm" onclick="annullaEditPredef(${id})">Annulla</button>
    </div>`;
  item.insertAdjacentElement('afterend', form);
}

async function aggiornaPredef(id) {
  const titolo = document.getElementById('edit-tit-' + id).value.trim();
  const testo = document.getElementById('edit-txt-' + id).value.trim();
  const categoria = document.getElementById('edit-cat-' + id).value;
  if (!titolo || !testo) { toast('Titolo e testo obbligatori', 'err'); return; }
  const res = await fetch('/api/predefiniti/' + id, {
    method: 'PUT',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ titolo, testo, categoria })
  });
  if (!res.ok) { toast('Errore nel salvataggio', 'err'); return; }
  await loadPredef();
  renderPredef();
  toast('Predefinito aggiornato', 'ok');
}

function annullaEditPredef(id) {
  document.querySelectorAll('.predef-edit-form').forEach(el => el.remove());
  const item = document.getElementById('predef-item-' + id);
  if (item) item.classList.remove('editing');
}

function usaPredef(id) {
  const p = predefiniti.find(x => x.id === id);
  if (!p) return;
  const ta = document.getElementById('f-referto');
  const cur = ta.value.trim();
  ta.value = cur ? cur + '\n' + p.testo : p.testo;
  ta.focus();
}

async function eliminaPredef(id) {
  await apiDelete('/api/predefiniti/' + id);
  await loadPredef();
  renderPredef();
}

async function salvaPredef() {
  const titolo = document.getElementById('predef-titolo').value.trim();
  const testo = document.getElementById('predef-testo').value.trim();
  const categoria = document.getElementById('predef-cat-sel').value || 'Generici';
  if (!titolo || !testo) { toast('Inserire titolo e testo del predefinito', 'err'); return; }
  const res = await apiPost('/api/predefiniti', { titolo, testo, categoria });
  if (res.error) { toast('Errore: ' + res.error, 'err'); return; }
  await loadPredef();
  renderPredef();
  document.getElementById('predef-titolo').value = '';
  document.getElementById('predef-testo').value = '';
  toast('Predefinito aggiunto', 'ok');
}

// ── DETTATURA VOCALE ──────────────────────────────────────────
let recognitions = {};
let micPermesso = false;

async function richiediPermessoMic() {
  if (micPermesso) return true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(t => t.stop());
    micPermesso = true;
    return true;
  } catch(e) {
    toast('Microfono non autorizzato — controlla le impostazioni Chrome', 'err');
    return false;
  }
}

async function toggleDictation(taId, btnId, barId) {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    toast('Dettatura non supportata: usa Chrome', 'err'); return;
  }
  if (recognitions[taId]) { recognitions[taId].stop(); return; }
  const ok = await richiediPermessoMic();
  if (!ok) return;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const r = new SR();
  r.lang = 'it-IT'; r.continuous = true; r.interimResults = true;
  recognitions[taId] = r;
  const ta = document.getElementById(taId);
  const btn = document.getElementById(btnId);
  const bar = document.getElementById(barId);
  btn.classList.add('rec');
  bar.classList.add('show');
  let baseText = ta.value;
  if (baseText && !baseText.endsWith(' ') && !baseText.endsWith('\n')) baseText += ' ';
  r.onresult = e => {
    let interim = '', final = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) final += e.results[i][0].transcript;
      else interim += e.results[i][0].transcript;
    }
    if (final) {
      let elaborato = processaVoce(final.trim());
      // rimuovi spazio prima di punteggiatura
      if (baseText.endsWith(' ') && /^[.,!?:;]/.test(elaborato)) {
        baseText = baseText.trimEnd();
      }
      // capitalizza primo carattere se: inizio testo, o preceduto da . ! ? \n
      if (elaborato) {
        const prec = baseText.trimEnd();
        if (prec === '' || /[.!?\n]$/.test(prec)) {
          elaborato = elaborato.charAt(0).toUpperCase() + elaborato.slice(1);
        }
      }
      baseText += elaborato;
      if (!baseText.endsWith('\n')) baseText += ' ';
    }
    ta.value = baseText + interim;
  };
  r.onerror = e => {
    stopDictation(taId, btnId, barId);
    if (e.error === 'not-allowed') { micPermesso = false; toast('Microfono non autorizzato', 'err'); }
  };
  r.onend = () => { stopDictation(taId, btnId, barId); };
  r.start();
}

function stopDictation(taId, btnId, barId) {
  if (recognitions[taId]) { try { recognitions[taId].stop(); } catch(e) {} delete recognitions[taId]; }
  const btn = document.getElementById(btnId);
  const bar = document.getElementById(barId);
  if (btn) btn.classList.remove('rec');
  if (bar) bar.classList.remove('show');
}

function stopAllDictation() {
  Object.keys(recognitions).forEach(k => { try { recognitions[k].stop(); } catch(e) {} delete recognitions[k]; });
  document.querySelectorAll('.mic-btn').forEach(b => b.classList.remove('rec'));
  document.querySelectorAll('.dict-bar').forEach(b => b.classList.remove('show'));
}

// ── ARCHIVIO ──────────────────────────────────────────────────
function populateAnni() {
  const anni = [...new Set(referti.map(r => r.data.split('-')[0]))].sort((a,b) => b - a);
  const sel = document.getElementById('s-anno');
  const cur = sel.value;
  sel.innerHTML = '<option value="">Tutti gli anni</option>';
  anni.forEach(a => {
    const o = document.createElement('option');
    o.value = a; o.textContent = a;
    if (a === cur) o.selected = true;
    sel.appendChild(o);
  });
}

function filtrati() {
  const txt = document.getElementById('s-text').value.toLowerCase();
  const tipo = document.getElementById('s-tipo').value;
  const anno = document.getElementById('s-anno').value;
  return referti.filter(r => {
    const paz = (r.cognome + ' ' + r.nome).toLowerCase();
    if (txt && !paz.includes(txt)) return false;
    if (tipo && r.tipo !== tipo) return false;
    if (anno && !r.data.startsWith(anno)) return false;
    return true;
  }).sort((a, b) => {
    let va = '', vb = '';
    if (sortField === 'cognome') { va = a.cognome + a.nome; vb = b.cognome + b.nome; }
    else if (sortField === 'nascita') { va = a.nascita || ''; vb = b.nascita || ''; }
    else { va = a.data || ''; vb = b.data || ''; }
    return va < vb ? sortDir : va > vb ? -sortDir : 0;
  });
}

function bc(tipo) {
  const tl = tipo.toLowerCase();
  if (tl.includes('urinario') || tl.includes('renale') || tl.includes('vescic')) return 'b-uri';
  if (tl.includes('tiroide') || tl.includes('collo') || tl.includes('parotide') || tl.includes('salivari')) return 'b-tir';
  if (tl.includes('muscolo') || tl.includes('scheletrica') || tl.includes('spalla') || tl.includes('ginocchio') || tl.includes('tendine') || tl.includes('anca') || tl.includes('gomito') || tl.includes('polso') || tl.includes('caviglia')) return 'b-msk';
  if (tl.includes('doppler') || tl.includes('color')) return 'b-dop';
  if (tl.includes('parti molli') || tl.includes('cute') || tl.includes('sottocute')) return 'b-mol';
  if (tl.includes('addome') || tl.includes('epatica') || tl.includes('epato') || tl.includes('colecisti') || tl.includes('pancrea') || tl.includes('splenica')) return 'b-add';
  return 'b-gen';
}

function renderArchivio() {
  const arr = filtrati();
  const tbody = document.getElementById('arch-tbody');
  const empty = document.getElementById('empty-state');
  document.getElementById('stats-row').innerHTML =
    '<div class="stat-pill">Totale archivio: <strong>' + referti.length + '</strong></div>' +
    '<div class="stat-pill">Filtrati: <strong>' + arr.length + '</strong></div>';
  if (arr.length === 0) { tbody.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  tbody.innerHTML = arr.map(r => `
    <tr>
      <td><strong>${esc(r.cognome)}</strong> ${esc(r.nome)}</td>
      <td style="font-family:'DM Mono',monospace;font-size:12px">${fmt(r.data)}</td>
      <td><span class="badge ${bc(r.tipo)}">${esc(r.tipo)}</span></td>
      <td style="font-family:'DM Mono',monospace;font-size:12px;color:var(--text-muted)">${etaLabel(r.nascita, r.data)}</td>
      <td><div class="td-act">
        <button class="btn btn-secondary btn-sm" onclick="openModal('${r.id}')">Visualizza</button>
      </div></td>
    </tr>`).join('');
}

function sortBy(f) {
  if (sortField === f) sortDir *= -1; else { sortField = f; sortDir = -1; }
  renderArchivio();
}

// ── MODAL ─────────────────────────────────────────────────────
let _modalRefertoId = null;

function openModal(id) {
  const r = referti.find(x => x.id === id); if (!r) return;
  _modalRefertoId = id;
  document.getElementById('m-title').textContent = r.cognome + ' ' + r.nome;
  document.getElementById('m-meta').textContent = r.tipo + ' · ' + fmt(r.data);
  document.getElementById('m-info').innerHTML =
    '<div class="ii"><label>Data esame</label><span>' + fmt(r.data) + '</span></div>' +
    '<div class="ii"><label>Data di nascita</label><span>' + (fmt(r.nascita) || '—') + '</span></div>' +
    '<div class="ii"><label>Età</label><span>' + etaLabel(r.nascita, r.data) + '</span></div>';
  document.getElementById('m-referto').textContent = r.referto || '—';
  document.getElementById('m-del').onclick = () => confermaElimina(id);
  document.getElementById('m-pdf').onclick = () => esportaPDF(id);
  document.getElementById('modal-ov').classList.add('open');
  loadImmagini(id);
}
function closeModal() {
  annullaModificaReferto();
  document.getElementById('modal-ov').classList.remove('open');
  document.getElementById('m-img-grid').innerHTML = '';
  _modalRefertoId = null;
}

function apriModificaReferto() {
  const r = referti.find(x => x.id === _modalRefertoId);
  if (!r) return;
  document.getElementById('m-view-section').style.display = 'none';
  const editSec = document.getElementById('m-edit-section');
  editSec.innerHTML = `
    <div class="m-edit-form">
      <div class="form-row c3" style="margin-bottom:12px">
        <div class="fg"><label>Cognome *</label><input type="text" id="me-cognome" value="${esc(r.cognome)}"></div>
        <div class="fg"><label>Nome *</label><input type="text" id="me-nome" value="${esc(r.nome)}"></div>
        <div class="fg"><label>Data di nascita</label><input type="date" id="me-nascita" value="${r.nascita||''}"></div>
      </div>
      <div class="form-row c2" style="margin-bottom:12px">
        <div class="fg"><label>Tipo di esame *</label><input type="text" id="me-tipo" value="${esc(r.tipo)}"></div>
        <div class="fg"><label>Data esame *</label><input type="date" id="me-data" value="${r.data}"></div>
      </div>
      <div class="fg">
        <label>Referto</label>
        <textarea id="me-referto" style="min-height:220px;font-size:13.5px;line-height:1.7">${esc(r.referto||'')}</textarea>
      </div>
    </div>`;
  editSec.style.display = 'block';
  document.getElementById('m-btn-modifica').style.display = 'none';
  document.getElementById('m-pdf').style.display = 'none';
  document.getElementById('m-del').style.display = 'none';
  document.getElementById('m-btn-salva-mod').style.display = '';
  document.getElementById('m-btn-annulla-mod').style.display = '';
}

function annullaModificaReferto() {
  document.getElementById('m-view-section').style.display = '';
  document.getElementById('m-edit-section').style.display = 'none';
  document.getElementById('m-edit-section').innerHTML = '';
  document.getElementById('m-btn-modifica').style.display = '';
  document.getElementById('m-pdf').style.display = '';
  document.getElementById('m-del').style.display = '';
  document.getElementById('m-btn-salva-mod').style.display = 'none';
  document.getElementById('m-btn-annulla-mod').style.display = 'none';
}

async function salvaModificaReferto() {
  const id = _modalRefertoId;
  const cognome = capitalizeWords(document.getElementById('me-cognome').value);
  const nome = capitalizeWords(document.getElementById('me-nome').value);
  const tipo = document.getElementById('me-tipo').value.trim();
  const data = document.getElementById('me-data').value;
  const nascita = document.getElementById('me-nascita').value || null;
  const referto = document.getElementById('me-referto').value.trim() || null;
  if (!cognome || !nome) { toast('Inserire cognome e nome', 'err'); return; }
  if (!tipo) { toast('Inserire il tipo di esame', 'err'); return; }
  if (!data) { toast("Inserire la data dell'esame", 'err'); return; }
  const res = await fetch('/api/referti/' + id, {
    method: 'PUT',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ cognome, nome, nascita, tipo, data, referto })
  });
  if (!res.ok) { toast('Errore nel salvataggio', 'err'); return; }
  await loadReferti();
  annullaModificaReferto();
  openModal(id);
  populateAnni(); renderArchivio();
  toast('Referto aggiornato', 'ok');
}
function closeModalOv(e) { if (e.target === document.getElementById('modal-ov')) closeModal(); }

// ── IMMAGINI ──────────────────────────────────────────────────

async function loadImmagini(refertoId) {
  const grid = document.getElementById('m-img-grid');
  grid.innerHTML = '<div class="img-loading">Caricamento…</div>';
  try {
    const files = await apiGet('/api/referti/' + refertoId + '/immagini');
    if (!Array.isArray(files)) {
      grid.innerHTML = '<div class="img-empty" style="color:#dc2626">Risposta server non valida</div>';
      return;
    }
    renderImmagini(refertoId, files);
  } catch(e) {
    console.error('[loadImmagini] errore per referto ' + refertoId, e);
    const msg = e.status === 404 ? 'Cartella immagini non trovata'
              : e.status ? ('Errore server HTTP ' + e.status)
              : 'Impossibile leggere immagini (server non risponde o cartella inaccessibile)';
    grid.innerHTML = '<div class="img-empty" style="color:#dc2626">' +
      '⚠️ ' + msg + '<br><small style="opacity:.7">Referto ID: ' + refertoId + '</small>' +
      '<br><button onclick="loadImmagini(\'' + refertoId + '\')" style="margin-top:8px;padding:4px 10px;cursor:pointer">Riprova</button>' +
      '</div>';
  }
}

function renderImmagini(refertoId, files) {
  const grid = document.getElementById('m-img-grid');
  if (!files.length) {
    grid.innerHTML = '<div class="img-empty">Nessuna immagine allegata</div>';
    return;
  }
  grid.innerHTML = files.map((f, i) => {
    const url = '/immagini/' + refertoId + '/' + encodeURIComponent(f);
    const isDcm = /\.dcm$/i.test(f);
    return `<div class="img-thumb" id="thumb-${i}">
      ${isDcm
        ? `<div class="dcm-hold" data-url="${url}" data-i="${i}"><div class="dcm-ico">DICOM</div><div class="dcm-name">${esc(f)}</div></div>`
        : `<img src="${url}" alt="${esc(f)}" onclick="apriImmagine('${url}')" loading="lazy">`
      }
      <button class="img-del" onclick="eliminaImmagine('${esc(refertoId)}','${esc(f)}')" title="Elimina">×</button>
    </div>`;
  }).join('');

  // Rendering asincrono dei DICOM
  grid.querySelectorAll('.dcm-hold').forEach(el => {
    renderDicomThumb(el.dataset.url, el);
  });
}

async function renderDicomThumb(url, placeholder) {
  try {
    const resp = await fetch(url);
    const buf = await resp.arrayBuffer();
    const ds = dicomParser.parseDicom(new Uint8Array(buf));
    const dataUrl = await dicomDsToDataUrl(ds, buf);
    if (dataUrl) {
      const img = document.createElement('img');
      img.src = dataUrl;
      img.alt = 'DICOM';
      img.onclick = () => apriImmagine(dataUrl);
      placeholder.replaceWith(img);
    }
  } catch (e) {
    // Lascia il placeholder DICOM com'è
  }
}

function apriImmagine(url) {
  window.open(url, '_blank');
}

async function eliminaImmagine(refertoId, filename) {
  await apiDelete('/api/referti/' + refertoId + '/immagini/' + encodeURIComponent(filename));
  await loadImmagini(refertoId);
  toast('Immagine eliminata', 'ok');
}

async function estraiNomeDicom(file) {
  try {
    const buf = await file.arrayBuffer();
    const ds = dicomParser.parseDicom(new Uint8Array(buf));
    return ds.string('x00100010') || null;
  } catch (e) { return null; }
}

async function importaImmagini(event) {
  const files = Array.from(event.target.files);
  if (!files.length || !_modalRefertoId) return;

  const r = referti.find(x => x.id === _modalRefertoId);
  if (!r) return;

  // Controllo nome per i file DICOM
  const dicomFiles = files.filter(f => /\.dcm$/i.test(f.name));
  for (const file of dicomFiles) {
    const nomeDicom = await estraiNomeDicom(file);
    if (nomeDicom) {
      // I DICOM usano formato COGNOME^NOME o varianti
      const normalizzato = nomeDicom.replace(/\^/g, ' ').trim().toLowerCase();
      const cognomeRef = r.cognome.toLowerCase();
      const nomeRef = r.nome.toLowerCase();
      const corrisponde = normalizzato.includes(cognomeRef) || normalizzato.includes(nomeRef);
      if (!corrisponde) {
        const ok = confirm(
          `⚠ Attenzione — nome paziente non corrisponde!\n\n` +
          `File DICOM: "${nomeDicom.replace(/\^/g, ' ')}"\n` +
          `Referto: "${r.cognome} ${r.nome}"\n\n` +
          `Importare comunque?`
        );
        if (!ok) { event.target.value = ''; return; }
        break;
      }
    }
  }

  const formData = new FormData();
  files.forEach(f => formData.append('files', f));

  try {
    toast('Caricamento in corso…', '');
    const resp = await fetch('/api/referti/' + _modalRefertoId + '/immagini', {
      method: 'POST', body: formData,
    });
    const res = await resp.json();
    await loadImmagini(_modalRefertoId);
    toast('Importate ' + res.importate + ' immagini', 'ok');
  } catch (e) {
    toast('Errore durante il caricamento', 'err');
  }
  event.target.value = '';
}

// Converte URL immagine in data URL (per stampa offline)
async function imgToDataUrl(url) {
  try {
    const resp = await fetch(url);
    const blob = await resp.blob();
    return await new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch (e) { return null; }
}

// Controlla se un buffer JPEG è decodificabile nativamente dal browser.
// Scansiona i marker dopo FF D8: SOF0/1/2 = ok, SOF3+ = JPEG Lossless (non supportato dal browser).
function _jpegIsBaseline(d) {
  let i = 2;
  while (i + 3 < d.length) {
    if (d[i] !== 0xFF) break;
    const m = d[i + 1];
    if (m === 0xC0 || m === 0xC1 || m === 0xC2) return true;  // Baseline / Progressive → ok
    if (m === 0xC3 || (m >= 0xC5 && m <= 0xC7)) return false; // JPEG Lossless → no
    if (m === 0xD9) break; // EOI
    const segLen = (d[i + 2] << 8) | d[i + 3];
    i += 2 + segLen;
  }
  return true;
}

// Decodifica un frame JPEG Lossless usando jpeg-lossless-decoder-js e lo rende su canvas.
function _renderJpegLossless(d, rows, cols, bpp, spp, photometric) {
  try {
    const decoder = new jpeg.lossless.Decoder();
    const ab = d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength);
    const numBytes = Math.ceil(bpp / 8);
    const output = decoder.decode(ab, 0, d.byteLength, numBytes); // Uint8Array o Uint16Array
    const n = rows * cols;
    const cv = document.createElement('canvas');
    cv.width = cols; cv.height = rows;
    const imgData = cv.getContext('2d').createImageData(cols, rows);
    const invert = photometric === 'MONOCHROME1';
    if (spp === 1) {
      let mn = Infinity, mx = -Infinity;
      for (let i = 0; i < n; i++) { if (output[i] < mn) mn = output[i]; if (output[i] > mx) mx = output[i]; }
      const rng = mx - mn || 1;
      for (let i = 0; i < n; i++) {
        let v = Math.round((output[i] - mn) / rng * 255);
        if (invert) v = 255 - v;
        imgData.data[i*4] = imgData.data[i*4+1] = imgData.data[i*4+2] = v;
        imgData.data[i*4+3] = 255;
      }
    } else {
      for (let i = 0; i < n; i++) {
        imgData.data[i*4]   = output[i*spp];
        imgData.data[i*4+1] = output[i*spp + 1];
        imgData.data[i*4+2] = output[i*spp + 2];
        imgData.data[i*4+3] = 255;
      }
    }
    cv.getContext('2d').putImageData(imgData, 0, 0);
    return cv.toDataURL('image/jpeg', 0.85);
  } catch(e) { console.error('JPEG Lossless decode error:', e); return null; }
}

// Converte pixel data DICOM (già parsato) in data URL
async function dicomDsToDataUrl(ds, buf) {
  try {
    const el = ds.elements.x7fe00010;
    if (!el) return null;

    const rows = ds.uint16('x00280010') || 0;
    const cols = ds.uint16('x00280011') || 0;
    const bpp  = ds.uint16('x00280100') || 8;
    const spp  = ds.uint16('x00280002') || 1;
    let photometric = 'MONOCHROME2';
    try { photometric = (ds.string('x00280004') || 'MONOCHROME2').trim().toUpperCase(); } catch(e) {}

    // Pixel data encapsulati (JPEG / PNG / JPEG-Lossless compressi)
    if (el.items && el.items.length) {
      for (const item of el.items) {
        if (item.length < 4) continue;
        const d = new Uint8Array(buf, item.dataOffset, item.length);

        // PNG
        if (d[0] === 0x89 && d[1] === 0x50 && d[2] === 0x4E && d[3] === 0x47) {
          const blob = new Blob([d], { type: 'image/png' });
          return await new Promise(r => { const rd = new FileReader(); rd.onload = () => r(rd.result); rd.readAsDataURL(blob); });
        }

        // JPEG (baseline o lossless)
        if (d[0] === 0xFF && d[1] === 0xD8) {
          if (_jpegIsBaseline(d)) {
            const blob = new Blob([d], { type: 'image/jpeg' });
            return await new Promise(r => { const rd = new FileReader(); rd.onload = () => r(rd.result); rd.readAsDataURL(blob); });
          }
          if (rows && cols && typeof jpeg !== 'undefined' && jpeg.lossless) {
            const url = _renderJpegLossless(d, rows, cols, bpp, spp, photometric);
            if (url) return url;
          }
        }
      }
      return null; // dati encapsulati: se nessun item decodificato, non cadere nel path raw
    }

    const off = el.dataOffset, len = el.length;

    // Rileva encapsulamento: lunghezza undefined OPPURE i primi 4 byte sono un item delimiter (FE FF 00 E0)
    const view8probe = new Uint8Array(buf, off, Math.min(4, buf.byteLength - off));
    const startsWithItem = view8probe.length >= 4 && view8probe[0] === 0xFE && view8probe[1] === 0xFF && view8probe[2] === 0x00 && view8probe[3] === 0xE0;
    const isEncapsulated = len === 0xFFFFFFFF || len === 4294967295 || startsWithItem;

    if (isEncapsulated) {
      const view8 = new Uint8Array(buf);
      let pos = off;
      const limit = Math.min(buf.byteLength - 8, off + 10 * 1024 * 1024);
      while (pos < limit) {
        if (view8[pos] === 0xFE && view8[pos+1] === 0xFF && view8[pos+2] === 0x00 && view8[pos+3] === 0xE0) {
          const itemLen = view8[pos+4] | (view8[pos+5] << 8) | (view8[pos+6] << 16) | (view8[pos+7] << 24);
          const frameOff = pos + 8;
          if (itemLen > 4 && frameOff + itemLen <= buf.byteLength) {
            const d = new Uint8Array(buf, frameOff, itemLen);
            if (d[0] === 0xFF && d[1] === 0xD8) {
              if (_jpegIsBaseline(d)) {
                const blob = new Blob([d], { type: 'image/jpeg' });
                return await new Promise(r => { const rd = new FileReader(); rd.onload = () => r(rd.result); rd.readAsDataURL(blob); });
              }
              if (rows && cols && typeof jpeg !== 'undefined' && jpeg.lossless) {
                const url = _renderJpegLossless(d, rows, cols, bpp, spp, photometric);
                if (url) return url;
              }
            }
          }
          if (itemLen === 0) { pos += 8; continue; }
          pos += 8 + Math.max(0, itemLen);
        } else if (view8[pos] === 0xFE && view8[pos+1] === 0xFF && view8[pos+2] === 0xDD && view8[pos+3] === 0xE0) {
          break;
        } else {
          pos++;
        }
      }
      return null;
    }

    if (len <= 2) return null;

    // JPEG grezzo nel pixel data (non encapsulato)
    const hdr = new Uint8Array(buf, off, Math.min(4, len));
    if (hdr[0] === 0xFF && hdr[1] === 0xD8) {
      const d = new Uint8Array(buf, off, len);
      if (_jpegIsBaseline(d)) {
        const blob = new Blob([d], { type: 'image/jpeg' });
        return await new Promise(r => { const rd = new FileReader(); rd.onload = () => r(rd.result); rd.readAsDataURL(blob); });
      }
      if (rows && cols && typeof jpeg !== 'undefined' && jpeg.lossless) {
        const url = _renderJpegLossless(d, rows, cols, bpp, spp, photometric);
        if (url) return url;
      }
    }

    // Pixel data non compressi (raw)
    if (!rows || !cols) return null;
    const planarConfig = ds.uint16('x00280006') || 0;
    const n = rows * cols;
    const cv = document.createElement('canvas');
    cv.width = cols; cv.height = rows;
    const ctx = cv.getContext('2d');
    const imgData = ctx.createImageData(cols, rows);

    if (spp === 1) {
      const px = bpp === 16
        ? new Uint16Array(buf.slice(off, off + n * 2))
        : new Uint8Array(buf, off, n);
      let mn = Infinity, mx = -Infinity;
      for (let i = 0; i < n; i++) { if (px[i] < mn) mn = px[i]; if (px[i] > mx) mx = px[i]; }
      const rng = mx - mn || 1;
      const invert = photometric === 'MONOCHROME1';
      for (let i = 0; i < n; i++) {
        let v = Math.round((px[i] - mn) / rng * 255);
        if (invert) v = 255 - v;
        imgData.data[i*4] = imgData.data[i*4+1] = imgData.data[i*4+2] = v;
        imgData.data[i*4+3] = 255;
      }
    } else if (spp === 3) {
      const px = new Uint8Array(buf, off, n * 3);
      const isYbr = photometric.startsWith('YBR');
      for (let i = 0; i < n; i++) {
        let r, g, b;
        if (planarConfig === 0) {
          r = px[i*3]; g = px[i*3+1]; b = px[i*3+2];
        } else {
          r = px[i]; g = px[i + n]; b = px[i + n*2];
        }
        if (isYbr) {
          const Y = r, Cb = g, Cr = b;
          r = Math.max(0, Math.min(255, Math.round(Y + 1.402   * (Cr - 128))));
          g = Math.max(0, Math.min(255, Math.round(Y - 0.34414 * (Cb - 128) - 0.71414 * (Cr - 128))));
          b = Math.max(0, Math.min(255, Math.round(Y + 1.772   * (Cb - 128))));
        }
        imgData.data[i*4]   = r;
        imgData.data[i*4+1] = g;
        imgData.data[i*4+2] = b;
        imgData.data[i*4+3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);
    return cv.toDataURL('image/jpeg', 0.85);
  } catch(e) { console.error('dicomDsToDataUrl:', e); }
  return null;
}

// Estrae PixelSpacing da un dataset DICOM già parsato.
// Legge ogni tag con più metodi (floatString + string+split) per massima compatibilità.
function extractDicomPixelSpacing(ds) {

  // Helper: prova a leggere una coppia di valori DS (row, col) da un tag
  function readPair(dataset, tag) {
    // Metodo 1: floatString con indice (più robusto per multi-value DS)
    try {
      const v0 = dataset.floatString(tag, 0);
      const v1 = dataset.floatString(tag, 1);
      if (v0 > 0 && v1 > 0) return { row: v0, col: v1 };
      // Se c'è solo un valore (pixel quadrati) usa quello per entrambi
      if (v0 > 0) return { row: v0, col: v0 };
    } catch(e) {}
    // Metodo 2: stringa grezza con split su \ (backslash DICOM)
    try {
      const s = dataset.string(tag);
      if (s) {
        const p = s.trim().split('\\');
        const r = parseFloat(p[0]), c = parseFloat(p[p.length > 1 ? 1 : 0]);
        if (r > 0 && c > 0) return { row: r, col: c };
      }
    } catch(e) {}
    return null;
  }

  // 1. SequenceOfUltrasoundRegions (0018,6011) — specifico per ecografia
  //    PhysicalDeltaX/Y sono in cm/pixel → converti in mm
  try {
    const seq = ds.elements['x00186011'];
    if (seq && seq.items && seq.items.length > 0) {
      const sub = seq.items[0].dataSet;
      if (sub) {
        for (const [tx, ty] of [['x0018602c','x0018602e']]) {
          // double
          try { const dx=sub.double(tx), dy=sub.double(ty); if(dx>0&&dy>0) return {row:dy*10,col:dx*10}; } catch(e){}
          // float
          try { const dx=sub.float(tx),  dy=sub.float(ty);  if(dx>0&&dy>0) return {row:dy*10,col:dx*10}; } catch(e){}
          // floatString
          try { const dx=sub.floatString(tx,0), dy=sub.floatString(ty,0); if(dx>0&&dy>0) return {row:dy*10,col:dx*10}; } catch(e){}
        }
      }
    }
  } catch(e) {}

  // 2. PixelSpacing (0028,0030) — CT, MRI, molti ecografi
  const ps = readPair(ds, 'x00280030');
  if (ps) { console.log('[DICOM cal] PixelSpacing:', ps); return ps; }

  // 3. ImagerPixelSpacing (0018,1164) — radiologia digitale (CR/DR)
  const ips = readPair(ds, 'x00181164');
  if (ips) { console.log('[DICOM cal] ImagerPixelSpacing:', ips); return ips; }

  // 4. NominalScannedPixelSpacing (0018,2010) — scanner planari
  const nsp = readPair(ds, 'x00182010');
  if (nsp) { console.log('[DICOM cal] NominalScannedPixelSpacing:', nsp); return nsp; }

  // Nessun tag trovato — log per diagnostica
  console.warn('[DICOM cal] Nessun tag di calibrazione trovato. Tag presenti:', Object.keys(ds.elements).join(', '));
  return null;
}

// Carica DICOM, estrae dataUrl + PixelSpacing in un solo fetch
async function dicomLoadFull(url) {
  try {
    const resp = await fetch(url);
    const buf  = await resp.arrayBuffer();
    const ds   = dicomParser.parseDicom(new Uint8Array(buf));
    const pixelSpacing = extractDicomPixelSpacing(ds);
    const dataUrl = await dicomDsToDataUrl(ds, buf);
    return { dataUrl, pixelSpacing };
  } catch(e) { return { dataUrl: null, pixelSpacing: null }; }
}

// Wrapper retrocompatibile (usato per PDF export)
async function dicomToDataUrl(url) {
  const { dataUrl } = await dicomLoadFull(url);
  return dataUrl;
}

// ── MISURAZIONI ───────────────────────────────────────────────

function syncCanvasSize() {
  const wrap   = document.getElementById('viewer-img-wrap');
  const canvas = document.getElementById('viewer-canvas');
  if (!wrap || !canvas) return;
  const r = wrap.getBoundingClientRect();
  canvas.width  = Math.round(r.width);
  canvas.height = Math.round(r.height);
  redrawCanvas();
}

function clearCanvasNow() {
  const canvas = document.getElementById('viewer-canvas');
  if (!canvas) return;
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
}

// Converte coordinate canvas → pixel immagine (con zoom/pan)
function canvasToImg(cx, cy) {
  const canvas = document.getElementById('viewer-canvas');
  const img    = document.getElementById('viewer-img');
  if (!img || !img.naturalWidth || !img.naturalHeight) return null;
  const cw = canvas.width, ch = canvas.height;
  const nw = img.naturalWidth, nh = img.naturalHeight;
  const sz = Math.min(cw / nw, ch / nh) * _zoomLevel;
  return {
    x: (cx - _panX - (cw - nw * sz) / 2) / sz,
    y: (cy - _panY - (ch - nh * sz) / 2) / sz,
  };
}

// Converte pixel immagine → coordinate canvas (con zoom/pan)
function imgToCanvas(ix, iy) {
  const canvas = document.getElementById('viewer-canvas');
  const img    = document.getElementById('viewer-img');
  if (!img || !img.naturalWidth || !img.naturalHeight) return null;
  const cw = canvas.width, ch = canvas.height;
  const nw = img.naturalWidth, nh = img.naturalHeight;
  const sz = Math.min(cw / nw, ch / nh) * _zoomLevel;
  return {
    x: ix * sz + (cw - nw * sz) / 2 + _panX,
    y: iy * sz + (ch - nh * sz) / 2 + _panY,
  };
}

function computeDist(x1, y1, x2, y2) {
  const f  = _viewerFiles[_viewerIndex];
  const ps = f ? f.pixelSpacing : null;
  const dx = x2 - x1, dy = y2 - y1;
  if (ps) {
    const mm = Math.sqrt((dx * ps.col) ** 2 + (dy * ps.row) ** 2);
    return mm.toFixed(1) + ' mm';
  }
  const px = Math.sqrt(dx * dx + dy * dy);
  return px.toFixed(0) + ' px ⚠';
}

function updateCalibrationBadge() {
  const f  = _viewerFiles[_viewerIndex];
  const ps = f ? f.pixelSpacing : null;
  let badge = document.getElementById('viewer-cal-badge');
  if (!badge) return;
  if (_viewerFiles.length === 0) { badge.style.display = 'none'; return; }
  if (ps) {
    badge.textContent = `cal: ${ps.col.toFixed(3)}×${ps.row.toFixed(3)} mm/px`;
    badge.className = 'viewer-cal-badge cal-ok';
  } else {
    badge.textContent = 'no calibrazione';
    badge.className = 'viewer-cal-badge cal-no';
  }
  badge.style.display = '';
}

function _roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r, y); ctx.lineTo(x+w-r, y);
  ctx.quadraticCurveTo(x+w, y, x+w, y+r);
  ctx.lineTo(x+w, y+h-r);
  ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
  ctx.lineTo(x+r, y+h);
  ctx.quadraticCurveTo(x, y+h, x, y+h-r);
  ctx.lineTo(x, y+r);
  ctx.quadraticCurveTo(x, y, x+r, y);
  ctx.closePath();
}

// Distanza punto → segmento (coordinate canvas)
function _distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx-ax, dy = by-ay, lenSq = dx*dx+dy*dy;
  if (lenSq === 0) return Math.hypot(px-ax, py-ay);
  const t = Math.max(0, Math.min(1, ((px-ax)*dx+(py-ay)*dy)/lenSq));
  return Math.hypot(px-(ax+t*dx), py-(ay+t*dy));
}

// Ritorna {measIdx, ep:0|1} se il cursore è vicino a un endpoint, altrimenti null
function findNearestEndpoint(cx, cy) {
  let best = null, bestD = 11;
  for (let i = 0; i < _measurements.length; i++) {
    const m = _measurements[i];
    const p1 = imgToCanvas(m.x1, m.y1), p2 = imgToCanvas(m.x2, m.y2);
    if (!p1 || !p2) continue;
    const d1 = Math.hypot(cx-p1.x, cy-p1.y);
    const d2 = Math.hypot(cx-p2.x, cy-p2.y);
    if (d1 < bestD) { best = { measIdx: i, ep: 0 }; bestD = d1; }
    if (d2 < bestD) { best = { measIdx: i, ep: 1 }; bestD = d2; }
  }
  return best;
}

// Ritorna indice della misura sotto il cursore (esclusi endpoint), o -1
function findNearestMeasurement(cx, cy) {
  let best = -1, bestD = 12;
  for (let i = 0; i < _measurements.length; i++) {
    const m = _measurements[i];
    const p1 = imgToCanvas(m.x1, m.y1), p2 = imgToCanvas(m.x2, m.y2);
    if (!p1 || !p2) continue;
    const dl = _distToSegment(cx, cy, p1.x, p1.y, p2.x, p2.y);
    if (dl < bestD) { best = i; bestD = dl; }
    const mlx = (p1.x+p2.x)/2, mly = (p1.y+p2.y)/2 - 14;
    const dm = Math.hypot(cx-mlx, cy-mly);
    if (dm < 20 && dm < bestD) { best = i; bestD = dm; }
  }
  return best;
}

// dashed=preview, hoveredLine=rosso+✕, highlightEp=0|1|-1 (endpoint bianco+glow)
function drawMeasLine(ctx, cx1, cy1, cx2, cy2, label, dashed, hoveredLine, highlightEp) {
  ctx.save();
  const col = hoveredLine ? '#ff6060' : '#ffdd00';
  ctx.shadowColor = 'rgba(0,0,0,0.85)';
  ctx.shadowBlur  = 4;
  ctx.strokeStyle = col;
  ctx.lineWidth   = hoveredLine ? 2.2 : 1.8;
  ctx.setLineDash(dashed ? [6, 4] : []);
  ctx.beginPath(); ctx.moveTo(cx1, cy1); ctx.lineTo(cx2, cy2); ctx.stroke();
  ctx.setLineDash([]);

  // Endpoint dots
  const pts = [[cx1,cy1],[cx2,cy2]];
  for (let ep = 0; ep < 2; ep++) {
    const [px, py] = pts[ep];
    const isHL = highlightEp === ep;
    const r = isHL ? 7 : (hoveredLine ? 5 : 4);
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI*2);
    ctx.fillStyle = isHL ? '#ffffff' : col; ctx.fill();
    ctx.strokeStyle = isHL ? col : 'rgba(0,0,0,0.6)';
    ctx.lineWidth = isHL ? 2 : 1; ctx.stroke();
    if (isHL) {
      // Alone esterno
      ctx.beginPath(); ctx.arc(px, py, r+4, 0, Math.PI*2);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 3; ctx.stroke();
    }
  }

  // Label
  ctx.shadowBlur = 0;
  const mx = (cx1+cx2)/2, my = (cy1+cy2)/2 - 14;
  const fullLabel = hoveredLine ? label + '  ✕' : label;
  ctx.font = 'bold 12px "DM Mono", monospace';
  const tw = ctx.measureText(fullLabel).width;
  const pad = 5, rh = 18;
  _roundRect(ctx, mx - tw/2 - pad, my - 10, tw + pad*2, rh, 4);
  ctx.fillStyle = hoveredLine ? 'rgba(180,30,30,0.52)' : 'rgba(0,0,0,0.35)'; ctx.fill();
  ctx.fillStyle = hoveredLine ? '#ffaaaa' : '#ffdd00';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(fullLabel, mx, my - 1);
  ctx.restore();
}

function redrawCanvas() {
  const canvas = document.getElementById('viewer-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < _measurements.length; i++) {
    const m = _measurements[i];
    const p1 = imgToCanvas(m.x1, m.y1), p2 = imgToCanvas(m.x2, m.y2);
    if (!p1 || !p2) continue;
    const isLinHov = (i === _hoveredMeasIdx) && !_hoveredEndpoint;
    const hlEp = (_hoveredEndpoint && _hoveredEndpoint.measIdx === i)
      ? _hoveredEndpoint.ep
      : (_dragMeas && _dragMeas.measIdx === i ? _dragMeas.ep : -1);
    drawMeasLine(ctx, p1.x, p1.y, p2.x, p2.y,
      computeDist(m.x1,m.y1,m.x2,m.y2), false, isLinHov, hlEp);
  }

  if (_measureMode && _measurePoint1 && _measureMouse) {
    const p1 = imgToCanvas(_measurePoint1.x, _measurePoint1.y);
    const p2 = imgToCanvas(_measureMouse.x,  _measureMouse.y);
    if (p1 && p2) drawMeasLine(ctx, p1.x, p1.y, p2.x, p2.y,
      computeDist(_measurePoint1.x,_measurePoint1.y,_measureMouse.x,_measureMouse.y),
      true, false, -1);
  }
}

function _setCursor(canvas, c) { canvas.style.cursor = c; }

function onCanvasMouseDown(e) {
  e.preventDefault();
  const rect = e.target.getBoundingClientRect();
  const cx = e.clientX - rect.left, cy = e.clientY - rect.top;

  // Pan mode: zoom > 1 e non in misura
  if (_zoomLevel > 1 && !_measureMode) {
    _isPanning = true;
    _panStart  = { mx: e.clientX, my: e.clientY, px: _panX, py: _panY };
    e.target.classList.add('panning');
    return;
  }

  if (!_measureMode) return;

  if (!_measurePoint1) {
    // Priorità 1: trascina endpoint
    const ep = findNearestEndpoint(cx, cy);
    if (ep) { _dragMeas = ep; _hoveredEndpoint = null; return; }

    // Priorità 2: elimina misura (click su linea/label)
    const idx = findNearestMeasurement(cx, cy);
    if (idx >= 0) {
      _measurements.splice(idx, 1);
      _hoveredMeasIdx = -1; _hoveredEndpoint = null;
      redrawCanvas(); updateMeasureUI(); return;
    }
  }

  // Priorità 3: piazza punto misura
  const ic = canvasToImg(cx, cy);
  if (!ic) return;
  if (!_measurePoint1) {
    _measurePoint1 = ic; redrawCanvas();
  } else {
    _measurements.push({ x1: _measurePoint1.x, y1: _measurePoint1.y, x2: ic.x, y2: ic.y });
    _measurePoint1 = null; _measureMouse = null;
    redrawCanvas(); updateMeasureUI();
  }
}

function onCanvasMouseMove(e) {
  const canvas = e.target;
  const rect   = canvas.getBoundingClientRect();
  const cx = e.clientX - rect.left, cy = e.clientY - rect.top;

  // Pan in corso
  if (_isPanning) {
    _panX = _panStart.px + (e.clientX - _panStart.mx);
    _panY = _panStart.py + (e.clientY - _panStart.my);
    applyZoom();
    return;
  }

  if (!_measureMode) return;
  const rect2 = canvas.getBoundingClientRect(); void rect2; // già calcolato

  // Drag endpoint in corso
  if (_dragMeas) {
    const ic = canvasToImg(cx, cy);
    if (ic) {
      const m = _measurements[_dragMeas.measIdx];
      if (m) {
        if (_dragMeas.ep === 0) { m.x1 = ic.x; m.y1 = ic.y; }
        else                    { m.x2 = ic.x; m.y2 = ic.y; }
        redrawCanvas();
      }
    }
    return;
  }

  // Stiamo piazzando il punto 2
  if (_measurePoint1) {
    const ic = canvasToImg(cx, cy);
    _measureMouse = ic || _measureMouse;
    redrawCanvas(); return;
  }

  // Hover: endpoint ha priorità su linea
  const ep = findNearestEndpoint(cx, cy);
  if (ep) {
    const prev = _hoveredEndpoint;
    _hoveredEndpoint = ep; _hoveredMeasIdx = -1;
    _setCursor(canvas, 'move');
    if (!prev || prev.measIdx !== ep.measIdx || prev.ep !== ep.ep) redrawCanvas();
    return;
  }
  _hoveredEndpoint = null;

  const prevIdx = _hoveredMeasIdx;
  _hoveredMeasIdx = findNearestMeasurement(cx, cy);
  _setCursor(canvas, _hoveredMeasIdx >= 0 ? 'pointer' : 'crosshair');
  if (prevIdx !== _hoveredMeasIdx) redrawCanvas();
}

function onCanvasMouseUp(e) {
  if (_isPanning) {
    _isPanning = false; _panStart = null;
    if (e && e.target) e.target.classList.remove('panning');
    document.getElementById('viewer-canvas')?.classList.remove('panning');
    return;
  }
  if (_dragMeas) { _dragMeas = null; updateMeasureUI(); }
}

function onCanvasLeave() {
  if (!_measureMode) return;
  if (!_dragMeas) {
    const changed = _hoveredMeasIdx >= 0 || _hoveredEndpoint;
    _hoveredMeasIdx = -1; _hoveredEndpoint = null;
    if (changed) redrawCanvas();
  }
  if (_measurePoint1 && !_measureMouse) return;
  if (_measurePoint1) { _measureMouse = null; redrawCanvas(); }
}

function toggleMeasureMode() {
  _measureMode = !_measureMode;
  _measurePoint1 = null; _measureMouse = null;
  applyZoom(); // aggiorna classi canvas (measure-active / pan-mode)
  updateMeasureUI();
}

function clearMeasurements() {
  _measurements = []; _measurePoint1 = null; _measureMouse = null; _hoveredMeasIdx = -1; _hoveredEndpoint = null; _dragMeas = null; _isPanning = false; _panStart = null;
  clearCanvasNow();
  updateMeasureUI();
}

function updateMeasureUI() {
  const btn  = document.getElementById('viewer-measure-btn');
  const clr  = document.getElementById('viewer-measure-clr');
  const hint = document.getElementById('viewer-hint');
  if (btn)  btn.classList.toggle('active', _measureMode);
  if (clr)  clr.style.display = _measurements.length > 0 ? '' : 'none';
  if (hint) {
    if (_measureMode && _measurePoint1)   hint.textContent = '📏 Clicca punto 2';
    else if (_measureMode && _measurements.length > 0) hint.textContent = '📏 Nuova misura o clicca su una linea per eliminarla';
    else if (_measureMode)                hint.textContent = '📏 Clicca punto 1';
    else                                  hint.textContent = '↕ scorri per cambiare';
  }
}

function initMeasureTool() {
  const canvas = document.getElementById('viewer-canvas');
  if (!canvas) return;
  canvas.addEventListener('mousedown',  onCanvasMouseDown);
  canvas.addEventListener('mousemove',  onCanvasMouseMove);
  canvas.addEventListener('mouseup',    onCanvasMouseUp);
  canvas.addEventListener('mouseleave', onCanvasLeave);
  document.addEventListener('mouseup',  onCanvasMouseUp); // ferma drag anche fuori canvas
  // Ridimensiona canvas quando il pannello cambia dimensione
  const wrap = document.getElementById('viewer-img-wrap');
  if (wrap && window.ResizeObserver) {
    new ResizeObserver(() => syncCanvasSize()).observe(wrap);
  }
}

// ── ELIMINA ───────────────────────────────────────────────────
function confermaElimina(id) {
  const r = referti.find(x => x.id === id); if (!r) return;
  document.getElementById('conf-msg').textContent =
    'Stai per eliminare il referto di ' + r.cognome + ' ' + r.nome + ' del ' + fmt(r.data) + '. Questa azione è irreversibile.';
  document.getElementById('conf-ok').onclick = async () => {
    await apiDelete('/api/referti/' + id);
    await loadReferti();
    closeConfirm(); closeModal();
    populateAnni(); renderArchivio();
    toast('Referto eliminato', 'ok');
  };
  document.getElementById('conf-ov').classList.add('open');
}
function closeConfirm() { document.getElementById('conf-ov').classList.remove('open'); }

// ── EXPORT PDF ────────────────────────────────────────────────
async function esportaPDF(id) {
  const r = referti.find(x => x.id === id); if (!r) return;

  // Carica immagini e convertile in data URL per stampa offline
  const imgFiles = await apiGet('/api/referti/' + id + '/immagini');
  const imgDataUrls = [];
  for (const f of imgFiles) {
    const url = '/immagini/' + id + '/' + encodeURIComponent(f);
    const isDcm = /\.dcm$/i.test(f);
    const dataUrl = isDcm ? await dicomToDataUrl(url) : await imgToDataUrl(url);
    if (dataUrl) imgDataUrls.push(dataUrl);
  }

  // Pagine immagini (2×3 per pagina)
  let paginaImmagini = '';
  for (let p = 0; p * 6 < imgDataUrls.length; p++) {
    const batch = imgDataUrls.slice(p * 6, p * 6 + 6);
    paginaImmagini += `
    <div class="img-page">
      <div class="img-hdr">${esc(r.cognome)} ${esc(r.nome)} — ${esc(r.tipo)} — ${fmt(r.data)}</div>
      <div class="img-grid-print">
        ${batch.map(src => `<div class="img-cell"><img src="${src}"></div>`).join('')}
      </div>
    </div>`;
  }
  const dataStampa = new Date().toLocaleDateString('it-IT', { day:'2-digit', month:'2-digit', year:'numeric' });
  const etaStr = etaLabel(r.nascita, r.data);
  const T = PDF_THEMES[localStorage.getItem('pdf_tema') || 'verde'];
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html>
<html lang="it"><head><meta charset="UTF-8">
<title>Referto — ${esc(r.cognome)} ${esc(r.nome)}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400&family=Source+Sans+3:wght@300;400;600&display=swap');
@page{margin:0;}
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Source Sans 3',sans-serif;font-size:11pt;color:#1c1c1c;background:white;}
.page{max-width:800px;margin:0 auto;padding:36px 48px 44px;min-height:100vh;display:flex;flex-direction:column;box-sizing:border-box;}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:16px;border-bottom:3px solid ${T.accent};margin-bottom:0;}
.hdr-nome{font-family:'Lora',serif;font-size:17pt;font-weight:600;color:${T.accent};letter-spacing:-0.01em;}
.hdr-titolo{font-size:9.5pt;color:#555;margin-top:2px;font-weight:300;letter-spacing:0.01em;}
.hdr-studio{font-size:10pt;color:#222;margin-top:6px;font-weight:600;}
.hdr-indirizzo{font-size:9pt;color:#555;margin-top:1px;}
.hdr-right{text-align:right;font-size:8.5pt;color:#555;line-height:1.7;}
.hdr-bar{background:${T.accent};height:2px;margin-bottom:20px;}
.paz-box{display:flex;justify-content:space-between;align-items:flex-start;background:${T.light};border-left:4px solid ${T.accent};padding:13px 16px;margin-bottom:22px;border-radius:0 4px 4px 0;}
.paz-nome{font-family:'Lora',serif;font-size:14pt;font-weight:600;color:#111;}
.paz-sub{font-size:9pt;color:#666;margin-top:2px;}
.paz-right{text-align:right;font-size:9pt;color:#555;line-height:1.8;}
.paz-right strong{color:#333;}
.esame-title{font-family:'Lora',serif;font-size:13.5pt;font-weight:600;color:${T.accent};text-align:center;margin-bottom:22px;letter-spacing:0.01em;text-transform:uppercase;}
.sec{font-size:8pt;text-transform:uppercase;letter-spacing:0.12em;color:${T.mid};font-weight:700;margin:18px 0 7px;display:flex;align-items:center;gap:8px;}
.sec::after{content:'';flex:1;height:1px;background:${T.line};}
.body-text{font-size:12.5pt;line-height:1.6;color:#111;white-space:pre-wrap;text-align:justify;}
.firma-wrap{margin-top:auto;padding-top:40px;display:flex;justify-content:flex-end;}
.firma-lbl{font-size:10pt;color:#444;font-family:'Lora',serif;text-align:center;}
.doc-footer{margin-top:32px;padding-top:10px;border-top:1px solid #ddd;display:flex;justify-content:space-between;font-size:7.5pt;color:#999;}
@media print{.page{padding:20px 30px;}body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
.img-page{page-break-before:always;padding:14px 20px;height:100vh;box-sizing:border-box;display:flex;flex-direction:column;}
.img-hdr{font-size:8pt;color:#888;margin-bottom:8px;border-bottom:1px solid #ddd;padding-bottom:5px;flex-shrink:0;}
.img-grid-print{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:repeat(3,1fr);gap:8px;flex:1;min-height:0;}
.img-cell{border:1px solid #ddd;padding:4px;background:#fff;display:flex;align-items:center;justify-content:center;min-height:0;overflow:hidden;}
.img-cell img{width:100%;height:100%;object-fit:contain;display:block;}
</style></head><body>
<div class="page">
  <div class="hdr">
    <div>
      <div class="hdr-nome">${esc(MEDICO.nome)}</div>
      <div class="hdr-titolo">${esc(MEDICO.titolo)}</div>
      <div class="hdr-studio">${esc(MEDICO.studio)}</div>
      <div class="hdr-indirizzo">${esc(MEDICO.indirizzo)}</div>
    </div>
    <div class="hdr-right">
      <div>✉ ${esc(MEDICO.email)}</div>
      <div>✆ ${esc(MEDICO.cell)}</div>
      <div style="margin-top:6px">${esc(MEDICO.ordine)}</div>
      <div>${esc(MEDICO.cf)}</div>
    </div>
  </div>
  <div class="hdr-bar"></div>
  <div class="paz-box">
    <div>
      <div class="paz-nome">${esc(r.cognome)} ${esc(r.nome)}</div>
      <div class="paz-sub">${r.nascita ? 'nato/a il ' + fmt(r.nascita) + (etaStr && etaStr !== '—' ? ' — ' + etaStr : '') : ''}</div>
    </div>
    <div class="paz-right">
      <div>Data esame: <strong>${fmt(r.data)}</strong></div>
    </div>
  </div>
  <div class="esame-title">${esc(r.tipo)}</div>
  <div class="sec">Referto</div>
  <div class="body-text">${esc(r.referto || '—')}</div>
  <div class="firma-wrap">
    <div class="firma-lbl">Il Medico Radiologo</div>
  </div>
  <div class="doc-footer">
    <span>${esc(MEDICO.studio)} — ${esc(MEDICO.indirizzo)}</span>
    <span>Documento generato il ${dataStampa}</span>
  </div>
</div>
${paginaImmagini}
<script>window.onload=()=>window.print();<\/script>
</body></html>`);
  win.document.close();
}

// ── BACKUP ────────────────────────────────────────────────────
async function esportaArchivio() {
  if (referti.length === 0) { toast('Nessun referto da esportare', 'err'); return; }
  const resp = await fetch('/api/referti/export');
  const blob = await resp.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'referteco_backup_' + oggi() + '.json';
  a.click();
  toast('Backup esportato', 'ok');
}

async function importaArchivio(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = async ev => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!Array.isArray(data)) throw new Error();
      const res = await apiPost('/api/referti/import', data);
      await loadReferti();
      populateAnni(); renderArchivio();
      toast('Importati ' + res.importati + ' referti', 'ok');
    } catch { toast('File non valido', 'err'); }
  };
  reader.readAsText(file);
  e.target.value = '';
}

// ── UTILITY ───────────────────────────────────────────────────
function esc(s) {
  if (!s) return '';
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

let toastTimer;
function toast(msg, type) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.className = 'toast show ' + (type || '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast'; }, 2800);
}

// ── IMPOSTAZIONI ─────────────────────────────────────────────
let _configData = {};

async function loadConfig() {
  _configData = await apiGet('/api/config');
  renderConfig();
}

function renderConfig() {
  const { dataDir, currentDir, detectedGoogleDrive, hasApiKey } = _configData;
  const isGdrive = !!dataDir;

  document.getElementById('r-locale').checked = !isGdrive;
  document.getElementById('r-gdrive').checked = isGdrive;
  document.getElementById('path-locale-display').textContent = currentDir + '/referteco_data.json';
  document.getElementById('config-status').textContent = '';

  const curDisplay = document.getElementById('current-datadir-display');
  if (curDisplay) curDisplay.textContent = currentDir;

  const autoBox = document.getElementById('gdrive-auto-box');
  const manualBox = document.getElementById('gdrive-manual-box');
  const autoPath = document.getElementById('gdrive-detected-path');
  if (detectedGoogleDrive) {
    if (autoBox)  autoBox.style.display = 'block';
    if (manualBox) manualBox.style.display = 'none';
    if (autoPath) autoPath.textContent = detectedGoogleDrive;
  } else {
    if (autoBox)  autoBox.style.display = 'none';
    if (manualBox) manualBox.style.display = 'block';
  }

  const pathInput = document.getElementById('gdrive-path');
  if (pathInput) {
    if (isGdrive) pathInput.value = dataDir;
    else if (detectedGoogleDrive && !pathInput.value) pathInput.value = detectedGoogleDrive;
  }

  const keyStatus = document.getElementById('ai-key-status');
  if (keyStatus) {
    keyStatus.textContent = hasApiKey ? '✓ Chiave API Anthropic configurata' : 'Nessuna chiave inserita — funzione AI non disponibile';
    keyStatus.style.color = hasApiKey ? 'var(--accent-mid)' : 'var(--text-muted)';
  }
}

function onModalitaChange() {}

async function usaGoogleDrive() {
  const detected = _configData.detectedGoogleDrive;
  if (!detected) {
    toast('Google Drive non rilevato. Installa Google Drive per Desktop o inserisci il percorso manualmente.', 'err');
    return;
  }
  document.getElementById('r-gdrive').checked = true;
  const pathInput = document.getElementById('gdrive-path');
  if (pathInput) pathInput.value = detected;
  try {
    const res = await apiPost('/api/config', { dataDir: detected });
    if (res.error) { toast('Errore: ' + res.error, 'err'); return; }
    toast('✓ Google Drive attivato! Riavvia il programma per applicare.', 'ok');
    document.getElementById('config-status').textContent = '✓ Salvato — riavvia per applicare';
    await loadConfig();
  } catch(e) {
    toast('Errore salvataggio: ' + e.message, 'err');
  }
}

function rilevaDrive() {
  const detected = _configData.detectedGoogleDrive;
  if (detected) {
    document.getElementById('gdrive-path').value = detected;
    document.getElementById('r-gdrive').checked = true;
    toast('Google Drive rilevato: ' + detected, 'ok');
  } else {
    toast('Google Drive non trovato. Inserisci il percorso manualmente.', 'err');
  }
}

async function salvaConfig() {
  const modalita = document.querySelector('input[name="modalita"]:checked').value;
  const dataDir = modalita === 'gdrive' ? document.getElementById('gdrive-path').value.trim() : null;

  if (modalita === 'gdrive' && !dataDir) {
    toast('Inserisci il percorso della cartella Google Drive', 'err');
    return;
  }

  const body = { dataDir: dataDir || null };
  const apiKeyEl = document.getElementById('anthropic-api-key');
  if (apiKeyEl && apiKeyEl.value.trim()) body.anthropicApiKey = apiKeyEl.value.trim();

  const res = await apiPost('/api/config', body);
  if (res.error) { toast('Errore: ' + res.error, 'err'); return; }

  if (apiKeyEl) apiKeyEl.value = '';
  document.getElementById('config-status').textContent = '✓ Salvato';
  toast('Impostazioni salvate', 'ok');
  _configData.dataDir = dataDir;
  await loadConfig();
}

// ── QUIT ──────────────────────────────────────────────────────
async function quitApp() {
  if (!confirm('Vuoi chiudere RefertEco?\nIl server verrà spento e il browser si chiuderà.')) return;
  try { await fetch('/api/quit', { method: 'POST' }); } catch(e) {}
  window.close();
}

// ── RESIZER FORM / VIEWER ─────────────────────────────────────
function initResizer() {
  const resizer = document.getElementById('nuovo-resizer');
  const viewer  = document.getElementById('nuovo-viewer');
  const DEFAULT_W = 360;
  const MIN_VIEWER = 180;
  const MIN_FORM   = 300;

  // Ripristina larghezza salvata
  const saved = parseInt(localStorage.getItem('viewer_panel_w'), 10);
  if (saved && saved >= MIN_VIEWER) {
    viewer.style.width     = saved + 'px';
    viewer.style.flexBasis = saved + 'px';
  }

  let dragging = false, startX = 0, startW = 0;

  resizer.addEventListener('mousedown', e => {
    dragging = true;
    startX = e.clientX;
    startW = viewer.getBoundingClientRect().width;
    resizer.classList.add('dragging');
    document.body.style.cursor    = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const dx   = startX - e.clientX;           // muovi sx → viewer cresce
    const layout = resizer.closest('.nuovo-layout');
    const maxViewer = layout.getBoundingClientRect().width - MIN_FORM - 12;
    const newW = Math.max(MIN_VIEWER, Math.min(startW + dx, maxViewer));
    viewer.style.width     = newW + 'px';
    viewer.style.flexBasis = newW + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    resizer.classList.remove('dragging');
    document.body.style.cursor    = '';
    document.body.style.userSelect = '';
    localStorage.setItem('viewer_panel_w', Math.round(viewer.getBoundingClientRect().width));
  });

  // Doppio clic → reset dimensioni di default
  resizer.addEventListener('dblclick', () => {
    viewer.style.width     = DEFAULT_W + 'px';
    viewer.style.flexBasis = DEFAULT_W + 'px';
    localStorage.setItem('viewer_panel_w', DEFAULT_W);
  });
}

// ── INIT ──────────────────────────────────────────────────────
async function init() {
  initTopbar();
  document.getElementById('f-data').value = oggi();
  await loadReferti();
  await loadPredef();
  loadTema();
  initResizer();
  initMeasureTool();
  document.addEventListener('keydown', e => {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    const inNuovo = document.getElementById('view-nuovo').classList.contains('active');
    if (!inNuovo) return;
    // ESC: annulla misura corrente o esci dalla modalità
    if (e.key === 'Escape') {
      if (_measureMode) {
        if (_measurePoint1) { _measurePoint1 = null; _measureMouse = null; redrawCanvas(); updateMeasureUI(); }
        else { toggleMeasureMode(); }
        e.preventDefault();
      }
      return;
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); viewerNav(1); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); viewerNav(-1); }
  });
}

init();
