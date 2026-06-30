/**
 * CENTRALINA WORKLIST — programma autonomo per il server sempre acceso (HP .166)
 * ---------------------------------------------------------------------------
 * Fa SOLO una cosa: tenere allineata la Lista di Lavoro dell'ecografo con
 * l'Agenda online.
 *
 *   - Paziente messo "arrivato" in Agenda  ->  il suo nome compare sull'ecografo
 *   - Paziente "refertato"/cancellato/non più arrivato  ->  il nome SPARISCE da solo
 *
 * NON usa Chrome, NON usa la stampante, NON tocca i referti.
 * Gira accanto a Orthanc sul mini-PC HP, sempre acceso.
 *
 * Avvio:  node.exe centralina-worklist.js
 * Richiede: Node 18+ (per fetch integrato) e Orthanc in ascolto su :8042.
 *
 * FIX 2026-06-30:
 *  - getPazientiArrivati() restituisce NULL (non []) se Agenda è irraggiungibile.
 *    Così il giro() non cancella i .wl esistenti in caso di outage internet.
 *  - Cancellazione istanza temporanea Orthanc: fino a 6 tentativi (ogni 500ms).
 *  - Controllo existsSync prima di creare: non ricrea .wl già presenti.
 */

const fs   = require('fs');
const path = require('path');

// ── CONFIGURAZIONE ───────────────────────────────────────────
const AGENDA_API_URL = 'https://referteco-production.up.railway.app/api';
const AGENDA_TOKEN   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjRlMzliY2YxLTRjZTctNDdiNy1iMzk2LTgyNmU4MTE1NTI0OSIsInVzZXJuYW1lIjoibWVkaWNvIiwicnVvbG8iOiJtZWRpY28iLCJpYXQiOjE3Nzk1NDMzMDAsImV4cCI6MjA5NTExOTMwMH0.siqAwgLKT7pN9zaGNnP6kcne-3lhEaQBIY30Z0X8ji0';

const ORTHANC_BASE = 'http://localhost:8042';
const WORKLIST_DIR = 'K:\\OrthancWorklists';   // stessa cartella che legge Orthanc

const STATION_AET     = 'MEDISON';             // AE dell'ecografo Samsung
const MEDICO_NAME     = 'SUSINO^SALVATORE';
const INTERVALLO_MS   = 15000;                 // controlla ogni 15 secondi

// ── UTILITY ──────────────────────────────────────────────────
const LOGFILE = path.join(__dirname, 'centralina.log');
function log(...a) {
  const line = new Date().toISOString().slice(0, 19).replace('T', ' ') + '  ' + a.join(' ');
  console.log(line);
  try { fs.appendFileSync(LOGFILE, line + '\r\n'); } catch {}
}

function orthancFetch(p, opts) { return fetch(ORTHANC_BASE + p, opts); }

// Prende dall'Agenda gli appuntamenti recenti e tiene solo gli "arrivato".
// IMPORTANTE: restituisce NULL (non []) se Agenda non è raggiungibile —
// così giro() non cancella i .wl esistenti durante un outage internet.
async function getPazientiArrivati() {
  const from = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const to   = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString();
  const url  = `${AGENDA_API_URL}/appuntamenti?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  let r;
  try {
    r = await fetch(url, { headers: { 'Authorization': `Bearer ${AGENDA_TOKEN}` } });
  } catch (e) {
    log('Agenda non raggiungibile (rete):', e.message);
    return null;   // <-- null, non [], per non cancellare i .wl
  }
  if (!r.ok) {
    log('Agenda non raggiungibile (HTTP ' + r.status + ')');
    return null;   // <-- null, non []
  }
  const lista = await r.json();
  return (lista || []).filter(a => a.stato === 'arrivato');
}

// Crea il file .wl per un appuntamento, usando Orthanc per generare il DICOM.
// L'istanza temporanea viene cancellata subito (fino a 6 tentativi).
async function creaWorklistFile(app) {
  const acc      = app.accession_number;
  const paz      = app.pazienti || {};
  const cognome  = (paz.cognome || '').toUpperCase();
  const nome     = paz.nome || '';
  const dob      = (paz.data_nascita || '').replace(/-/g, '');
  const start    = app.data_ora_inizio ? new Date(app.data_ora_inizio) : new Date();
  const startDate = start.toISOString().slice(0, 10).replace(/-/g, '');
  const startTime = start.toTimeString().slice(0, 8).replace(/:/g, '');

  const tags = {
    PatientName:      `${cognome}^${nome}`,
    PatientID:        String(acc),
    PatientBirthDate: dob,
    AccessionNumber:  acc,
    RequestedProcedureID: acc,
    RequestedProcedureDescription: '',
    ScheduledProcedureStepSequence: [{
      ScheduledStationAETitle:          STATION_AET,
      ScheduledProcedureStepStartDate:  startDate,
      ScheduledProcedureStepStartTime:  startTime,
      Modality:                         'US',
      ScheduledPerformingPhysicianName: MEDICO_NAME,
      ScheduledProcedureStepDescription: '',
      ScheduledProcedureStepID:         acc,
    }],
  };

  const res = await orthancFetch('/tools/create-dicom', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ Tags: tags }),
  });
  if (!res.ok) throw new Error('create-dicom fallito: ' + await res.text());

  const json       = await res.json();
  const instanceId = json.ID;
  const fileRes    = await orthancFetch('/instances/' + instanceId + '/file');
  if (!fileRes.ok) throw new Error('recupero file DICOM fallito');
  const buf = Buffer.from(await fileRes.arrayBuffer());

  fs.mkdirSync(WORKLIST_DIR, { recursive: true });
  fs.writeFileSync(path.join(WORKLIST_DIR, acc + '.wl'), buf);

  // Rimuove l'istanza temporanea da Orthanc (serviva solo per generare il file).
  // Fino a 6 tentativi con 500ms di pausa: a volte Orthanc è lento a indicizzare.
  let deleted = false;
  for (let i = 0; i < 6; i++) {
    try {
      const dr = await orthancFetch('/instances/' + instanceId, { method: 'DELETE' });
      if (dr.ok) { deleted = true; break; }
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  if (!deleted) log('! Attenzione: istanza temporanea', instanceId, 'non cancellata da Orthanc (non bloccante)');
}

// Giro principale: allinea i .wl con gli "arrivato"
async function giro() {
  let arrivati;
  try { arrivati = await getPazientiArrivati(); }
  catch (e) { log('Errore lettura Agenda:', e.message); return; }

  if (arrivati === null) return;   // Agenda non raggiungibile: non tocco nulla

  const accArrivati = new Set(arrivati.map(a => a.accession_number).filter(Boolean));

  // 1) CREA i .wl mancanti per i pazienti arrivati
  for (const app of arrivati) {
    const acc = app.accession_number;
    if (!acc) continue;
    const wlFile = path.join(WORKLIST_DIR, acc + '.wl');
    if (fs.existsSync(wlFile)) continue;       // già presente: non ricreare
    try {
      await creaWorklistFile(app);
      log('+ Aggiunto all\'ecografo:', acc, (app.pazienti?.cognome || ''));
    } catch (e) {
      log('! Errore creazione', acc, '-', e.message);
    }
  }

  // 2) CANCELLA i .wl di chi NON è più "arrivato" (refertato, cancellato, ecc.)
  try {
    const files = fs.readdirSync(WORKLIST_DIR).filter(f => f.endsWith('.wl'));
    for (const f of files) {
      const acc = f.replace(/\.wl$/, '');
      if (!accArrivati.has(acc)) {
        try {
          fs.unlinkSync(path.join(WORKLIST_DIR, f));
          log('- Rimosso dall\'ecografo:', acc);
        } catch (e) { log('! Errore rimozione', acc, '-', e.message); }
      }
    }
  } catch (e) { /* cartella non ancora esistente: ignora */ }
}

// ── AVVIO ────────────────────────────────────────────────────
log('Centralina worklist avviata. Controllo ogni', INTERVALLO_MS / 1000, 'secondi.');
log('Orthanc:', ORTHANC_BASE, '| Cartella worklist:', WORKLIST_DIR);
giro();                          // primo giro subito
setInterval(giro, INTERVALLO_MS);
