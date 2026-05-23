const express  = require('express');
const supabase  = require('../services/supabase');
const { requireAuth, requireMedico } = require('../middleware/auth');

const router = express.Router();

// Stato sync in memoria (aggiornato dal sync-service)
let syncState = {
  last_attempt:  null,
  last_success:  null,
  last_error:    null,
  pending_count: 0,
  orthanc_online: false
};

// ─── POST /api/sync/report ───────────────────────────────────────────────
// Chiamato internamente dal sync-service per aggiornare lo stato
router.post('/report', (req, res) => {
  // Accetta solo da localhost
  const ip = req.ip || req.connection?.remoteAddress || '';
  if (!ip.includes('127.0.0.1') && !ip.includes('::1')) {
    return res.status(403).json({ error: 'Accesso solo da localhost' });
  }
  Object.assign(syncState, req.body, { last_attempt: new Date().toISOString() });
  res.json({ ok: true });
});

// ─── GET /api/sync/status ────────────────────────────────────────────────
router.get('/status', requireAuth, async (req, res) => {
  // Conta i pending su Supabase
  const { count } = await supabase
    .from('appuntamenti')
    .select('*', { count: 'exact', head: true })
    .eq('worklist_status', 'pending')
    .gte('data_ora_inizio', new Date().toISOString());

  const lastAttemptMs = syncState.last_attempt
    ? Date.now() - new Date(syncState.last_attempt).getTime()
    : null;

  res.json({
    ...syncState,
    pending_count:  count || 0,
    service_online: lastAttemptMs !== null && lastAttemptMs < 3 * 60 * 1000
  });
});

// ─── POST /api/sync/trigger — solo medico ────────────────────────────────
router.post('/trigger', requireAuth, requireMedico, (req, res) => {
  // Il sync-service fa polling: al prossimo ciclo (max 90s) processerà la coda.
  // In futuro si può implementare un segnale via file/socket IPC.
  res.json({
    ok: true,
    message: 'Il sync-service processerà la coda al prossimo ciclo (entro 90 secondi)'
  });
});

module.exports = router;
