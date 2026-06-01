// ═══════════════════════════════════════════════════════════════════════════
// PRESENZA ROUTES — Conferma/disdetta presenza del PAZIENTE via link SMS
// Path corto /p/:code (token breve) per tenere l'SMS leggero.
// ═══════════════════════════════════════════════════════════════════════════
const express  = require('express');
const supabase = require('../services/supabase');
const { getIO } = require('../socket');
const { notificaAppuntamentoAnnullato } = require('../services/email');

const router = express.Router();

const SITO = process.env.STUDIO_SITO || 'studiosusino.it';
const STUDIO = process.env.STUDIO_NOME || 'Studio Medico';

// ─── Pagina HTML ──────────────────────────────────────────────────────────
function page(title, icon, body, color, mostraBottoni, code) {
  const bottoni = mostraBottoni
    ? `<div class="actions">
         <a class="btn btn-ok"  href="/p/${code}/si">✅ CONFERMO</a>
         <a class="btn btn-no"  href="/p/${code}/no">❌ NON POSSO VENIRE</a>
       </div>`
    : `<a class="btn-site" href="https://${SITO}">Vai al sito dello studio</a>`;

  return `<!DOCTYPE html>
<html lang="it"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} — ${STUDIO}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
       background:#f1f5f9;display:flex;align-items:center;justify-content:center;
       min-height:100vh;padding:20px}
  .card{background:#fff;border-radius:16px;padding:36px 28px;text-align:center;
        max-width:440px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,.12)}
  .icon{font-size:52px;margin-bottom:14px;line-height:1}
  h1{font-size:21px;color:${color};margin-bottom:12px;font-weight:700}
  p{color:#475569;font-size:15px;line-height:1.7}
  strong{color:#1e293b}
  .actions{display:flex;flex-direction:column;gap:12px;margin-top:26px}
  .btn{display:block;padding:15px;border-radius:10px;text-decoration:none;
       font-size:16px;font-weight:700}
  .btn-ok{background:#16a34a;color:#fff}
  .btn-no{background:#fff;color:#dc2626;border:2px solid #dc2626}
  .btn-site{display:inline-block;margin-top:24px;padding:11px 22px;background:#586570;
            color:#fff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600}
</style></head>
<body><div class="card">
  <div class="icon">${icon}</div>
  <h1>${title}</h1>
  <p>${body}</p>
  ${bottoni}
</div></body></html>`;
}

function fmtData(iso) {
  return new Date(iso).toLocaleDateString('it-IT', {
    weekday:'long', day:'numeric', month:'long', timeZone:'Europe/Rome'
  });
}
function fmtOra(iso) {
  return new Date(iso).toLocaleTimeString('it-IT', {
    hour:'2-digit', minute:'2-digit', timeZone:'Europe/Rome'
  });
}

async function trovaApp(code) {
  const { data } = await supabase
    .from('appuntamenti')
    .select('*, pazienti(*), tipi_prestazione(*)')
    .eq('conferma_token', code)
    .single();
  return data || null;
}

// ─── GET /p/:code — mostra dettaglio + pulsanti ──────────────────────────
router.get('/:code', async (req, res) => {
  const app = await trovaApp(req.params.code);
  if (!app) {
    return res.status(404).send(page('Link non valido', '❓',
      'Questo link non è valido o è scaduto. Per assistenza contatta lo studio.',
      '#f59e0b', false));
  }

  if (app.stato === 'annullato') {
    return res.send(page('Appuntamento annullato', 'ℹ️',
      'Questo appuntamento risulta già annullato.', '#3b82f6', false));
  }

  const esame = app.tipi_prestazione?.nome || 'visita';
  const nome  = app.pazienti ? `${app.pazienti.nome} ${app.pazienti.cognome}` : '';

  // Se ha già confermato, ricordaglielo (ma lasciagli cambiare idea)
  const giaConf = app.conferma_paziente === 'confermato'
    ? '<br><br><em>(presenza già confermata — puoi modificare qui sotto)</em>' : '';

  res.send(page('Conferma il tuo appuntamento', '📅',
    `${nome ? '<strong>'+nome+'</strong><br>' : ''}${esame}<br>` +
    `<strong>${fmtData(app.data_ora_inizio)}</strong> alle ore <strong>${fmtOra(app.data_ora_inizio)}</strong>${giaConf}`,
    '#0ea5e9', true, req.params.code));
});

// ─── GET /p/:code/si — il paziente conferma la presenza ──────────────────
router.get('/:code/si', async (req, res) => {
  const app = await trovaApp(req.params.code);
  if (!app)              return res.status(404).send(page('Link non valido','❓','Link non valido o scaduto.','#f59e0b',false));
  if (app.stato === 'annullato') return res.send(page('Annullato','ℹ️','Questo appuntamento è già annullato.','#3b82f6',false));

  await supabase.from('appuntamenti')
    .update({ conferma_paziente: 'confermato', updated_at: new Date().toISOString() })
    .eq('id', app.id);

  try { getIO().emit('appuntamento:aggiornato', { ...app, conferma_paziente: 'confermato' }); } catch {}

  res.send(page('Presenza confermata', '✅',
    'Grazie! La tua presenza è stata confermata. Ti aspettiamo.',
    '#16a34a', false));
});

// ─── GET /p/:code/no — il paziente disdice ───────────────────────────────
router.get('/:code/no', async (req, res) => {
  const app = await trovaApp(req.params.code);
  if (!app)              return res.status(404).send(page('Link non valido','❓','Link non valido o scaduto.','#f59e0b',false));
  if (app.stato === 'annullato') return res.send(page('Già annullato','ℹ️','Questo appuntamento risulta già annullato.','#3b82f6',false));

  await supabase.from('appuntamenti')
    .update({
      stato: 'annullato',
      worklist_status: 'not_needed',
      conferma_paziente: 'disdetto',
      updated_at: new Date().toISOString(),
    })
    .eq('id', app.id);

  try { getIO().emit('appuntamento:annullato', { id: app.id }); } catch {}
  // Avvisa il medico via email così può richiamare/riempire lo slot
  notificaAppuntamentoAnnullato({ ...app, stato: 'annullato' })
    .catch(e => console.error('[email] Notifica disdetta paziente:', e.message));

  res.send(page('Appuntamento disdetto', '❌',
    'Abbiamo registrato la tua disdetta. Per riprenotare visita il nostro sito o chiama lo studio. Grazie per averci avvisato.',
    '#dc2626', false));
});

module.exports = router;
