// ═══════════════════════════════════════════════════════════════════════════
// PRENOTA ROUTES — Conferma / Rifiuto prenotazione online via email
// ═══════════════════════════════════════════════════════════════════════════
const express  = require('express');
const jwt      = require('jsonwebtoken');
const supabase = require('../services/supabase');
const { inviaSmsConferma } = require('../services/sms');
const { creaEvento } = require('../services/googleCalendar');
const { getIO } = require('../socket');

const router = express.Router();

// ─── Pagina HTML di risposta ─────────────────────────────────────────────
function htmlPage(title, icon, body, color) {
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Agenda Studio</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
         background:#f1f5f9;display:flex;align-items:center;justify-content:center;
         min-height:100vh;padding:20px}
    .card{background:#fff;border-radius:16px;padding:40px 32px;text-align:center;
          max-width:460px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,.12)}
    .icon{font-size:56px;margin-bottom:16px;line-height:1}
    h1{font-size:22px;color:${color};margin-bottom:14px;font-weight:700}
    p{color:#475569;font-size:15px;line-height:1.7}
    strong{color:#1e293b}
    .btn{display:inline-block;margin-top:24px;padding:11px 24px;background:#586570;
         color:#fff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${title}</h1>
    <p>${body}</p>
    <a class="btn" href="/">Apri agenda</a>
  </div>
</body>
</html>`;
}

function fmtData(iso) {
  return new Date(iso).toLocaleDateString('it-IT', {
    weekday:'long', day:'2-digit', month:'long', year:'numeric',
    timeZone:'Europe/Rome'
  });
}
function fmtOra(iso) {
  return new Date(iso).toLocaleTimeString('it-IT', {
    hour:'2-digit', minute:'2-digit', timeZone:'Europe/Rome'
  });
}

// ─── GET /api/prenota/conferma/:token ─────────────────────────────────────
router.get('/conferma/:token', async (req, res) => {
  let payload;
  try {
    payload = jwt.verify(req.params.token, process.env.JWT_SECRET);
  } catch {
    return res.status(400).send(htmlPage(
      'Link non valido', '❌',
      'Il link è scaduto o non è valido.<br>Gestisci l\'appuntamento direttamente dall\'agenda.',
      '#ef4444'
    ));
  }

  const { data: app } = await supabase
    .from('appuntamenti')
    .select('*, pazienti(*), tipi_prestazione(*)')
    .eq('id', payload.id)
    .single();

  if (!app) {
    return res.status(404).send(htmlPage(
      'Non trovato', '❓',
      'L\'appuntamento non esiste o è già stato eliminato.',
      '#f59e0b'
    ));
  }

  if (app.stato !== 'in_attesa') {
    const descr = app.stato === 'prenotato' ? 'già confermato ✅'
                : app.stato === 'annullato' ? 'già annullato ❌'
                : `in stato "${app.stato}"`;
    return res.send(htmlPage(
      'Già gestito', 'ℹ️',
      `Questo appuntamento è ${descr}.`,
      '#3b82f6'
    ));
  }

  const { error: updErr } = await supabase
    .from('appuntamenti')
    .update({ stato: 'prenotato', updated_at: new Date().toISOString() })
    .eq('id', app.id);

  if (updErr) {
    return res.status(500).send(htmlPage(
      'Errore', '⚠️',
      'Errore durante la conferma. Apri l\'agenda e aggiorna manualmente.',
      '#ef4444'
    ));
  }

  // Notifica real-time all'agenda
  try { getIO().emit('appuntamento:aggiornato', { ...app, stato: 'prenotato' }); } catch {}

  // SMS di conferma al paziente
  inviaSmsConferma(app).catch(e => console.error('[SMS] Conferma prenotazione online:', e.message));

  // Google Calendar — crea evento (come per le prenotazioni dall'agenda).
  // Le prenotazioni dal sito arrivano in_attesa: l'evento su Google va scritto
  // SOLO ora che il medico ha confermato (stato → prenotato).
  creaEvento(app).catch(e => console.error('[GCal] Crea evento (conferma online):', e.message));

  const paz  = app.pazienti;
  const nome = paz ? `${paz.cognome} ${paz.nome}` : '—';
  const esame = app.tipi_prestazione?.nome || '—';

  res.send(htmlPage(
    'Appuntamento confermato', '✅',
    `<strong>${nome}</strong><br>${esame}<br>${fmtData(app.data_ora_inizio)} alle ore <strong>${fmtOra(app.data_ora_inizio)}</strong><br><br>SMS di conferma inviato al paziente.`,
    '#16a34a'
  ));
});

// ─── GET /api/prenota/rifiuta/:token ──────────────────────────────────────
router.get('/rifiuta/:token', async (req, res) => {
  let payload;
  try {
    payload = jwt.verify(req.params.token, process.env.JWT_SECRET);
  } catch {
    return res.status(400).send(htmlPage(
      'Link non valido', '❌',
      'Il link è scaduto o non è valido.',
      '#ef4444'
    ));
  }

  const { data: app } = await supabase
    .from('appuntamenti')
    .select('*, pazienti(*), tipi_prestazione(*)')
    .eq('id', payload.id)
    .single();

  if (!app) {
    return res.status(404).send(htmlPage(
      'Non trovato', '❓',
      'L\'appuntamento non esiste o è già stato eliminato.',
      '#f59e0b'
    ));
  }

  if (app.stato !== 'in_attesa') {
    const descr = app.stato === 'prenotato' ? 'già confermato ✅'
                : app.stato === 'annullato' ? 'già annullato ❌'
                : `in stato "${app.stato}"`;
    return res.send(htmlPage(
      'Già gestito', 'ℹ️',
      `Questo appuntamento è ${descr}.`,
      '#3b82f6'
    ));
  }

  const { error: updErr } = await supabase
    .from('appuntamenti')
    .update({
      stato:           'annullato',
      worklist_status: 'not_needed',
      updated_at:      new Date().toISOString()
    })
    .eq('id', app.id);

  if (updErr) {
    return res.status(500).send(htmlPage(
      'Errore', '⚠️',
      'Errore durante il rifiuto. Apri l\'agenda e aggiorna manualmente.',
      '#ef4444'
    ));
  }

  try { getIO().emit('appuntamento:annullato', { id: app.id }); } catch {}

  // NESSUN SMS al paziente — il medico chiama manualmente se necessario

  const paz  = app.pazienti;
  const nome = paz ? `${paz.cognome} ${paz.nome}` : '—';

  res.send(htmlPage(
    'Prenotazione rifiutata', '❌',
    `La prenotazione di <strong>${nome}</strong> è stata rifiutata.<br><br>Nessun SMS inviato al paziente.<br>Chiamare manualmente se necessario.`,
    '#ef4444'
  ));
});

module.exports = router;
