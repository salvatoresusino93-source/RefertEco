// ═══════════════════════════════════════════════════════════════════════════
// ROUTE /api/sistema-ts — Gestione invio dati a Sistema TS (MEF 730)
// ═══════════════════════════════════════════════════════════════════════════

const express  = require('express');
const router   = express.Router();
const supabase = require('../services/supabase');
const { sistemaTS } = require('../services/sistemaTS');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// ─── GET /api/sistema-ts/prestazioni ────────────────────────────────────────
// Lista appuntamenti fatturabili (anno corrente, con CF paziente)
router.get('/prestazioni', async (req, res) => {
  try {
    const anno = req.query.anno || new Date().getFullYear();
    const { data, error } = await supabase
      .from('appuntamenti')
      .select('id, data_ora_inizio, stato, pagamento_stato, importo_pagato_cent, numero_fattura, invia_sistema_ts, pazienti(nome, cognome, codice_fiscale), tipi_prestazione(nome)')
      .neq('stato', 'annullato')
      .gte('data_ora_inizio', `${anno}-01-01`)
      .lte('data_ora_inizio', `${anno}-12-31`)
      .order('data_ora_inizio', { ascending: false });

    if (error) throw error;

    // Filtra solo quelli con CF paziente
    const filtrati = (data || []).filter(a => a.pazienti?.codice_fiscale);
    res.json(filtrati);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── PATCH /api/sistema-ts/prestazioni/:id ───────────────────────────────────
// Aggiorna flag invia_sistema_ts e/o importo su un appuntamento
router.patch('/prestazioni/:id', async (req, res) => {
  try {
    const { invia_sistema_ts, importo_pagato_cent } = req.body;
    const updates = {};
    if (invia_sistema_ts !== undefined) updates.invia_sistema_ts = invia_sistema_ts;
    if (importo_pagato_cent !== undefined) updates.importo_pagato_cent = importo_pagato_cent;

    const { data, error } = await supabase
      .from('appuntamenti')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/sistema-ts/invia ──────────────────────────────────────────────
// Invia le prestazioni selezionate al MEF
// Body: { ids: [uuid, ...], simulazione: bool }
router.post('/invia', async (req, res) => {
  try {
    const { ids, simulazione } = req.body;
    if (!ids || !ids.length) return res.status(400).json({ error: 'Nessun appuntamento selezionato' });

    // Carica appuntamenti con dati paziente
    const { data: apps, error } = await supabase
      .from('appuntamenti')
      .select('id, data_ora_inizio, pagamento_stato, importo_pagato_cent, numero_fattura, pazienti(codice_fiscale, nome, cognome)')
      .in('id', ids)
      .neq('stato', 'annullato');

    if (error) throw error;

    // Prepara struttura dati per Sistema TS
    const prestazioni = apps.map(a => ({
      id:                  a.id,
      codice_fiscale:      a.pazienti?.codice_fiscale,
      data_fattura:        a.data_ora_inizio,
      data_pagamento:      a.data_ora_inizio,
      importo_euro:        ((a.importo_pagato_cent || 8000) / 100).toFixed(2),
      pagamento_tracciato: a.pagamento_stato === 'pagato',
      numero_fattura:      a.numero_fattura || null,
      flag_operazione:     'I',
    })).filter(p => p.codice_fiscale);

    if (!prestazioni.length) {
      return res.status(400).json({ error: 'Nessuna prestazione con codice fiscale valido' });
    }

    // Invia (o simula)
    const risultato = simulazione
      ? await sistemaTS.simula(prestazioni)
      : await sistemaTS.invia(prestazioni);

    // Marca gli appuntamenti come inviati
    if (risultato.ok && !simulazione) {
      await supabase
        .from('appuntamenti')
        .update({ invia_sistema_ts: true })
        .in('id', ids);
    }

    res.json(risultato);
  } catch (e) {
    console.error('[SistemaTS] Errore invio:', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
