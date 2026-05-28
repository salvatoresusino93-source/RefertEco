// ═══════════════════════════════════════════════════════════════════════════
// ROUTE /api/blocchi — gestione blocchi agenda (festività, impegni, manuale)
// ═══════════════════════════════════════════════════════════════════════════

const express  = require('express');
const supabase = require('../services/supabase');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// ─── GET /api/blocchi?from=ISO&to=ISO ─────────────────────────────────────
router.get('/', async (req, res) => {
  const { from, to } = req.query;

  let query = supabase
    .from('blocchi_agenda')
    .select('*')
    .order('data_ora_inizio');

  if (from) query = query.gte('data_ora_inizio', from);
  if (to)   query = query.lte('data_ora_fine',   to);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// ─── POST /api/blocchi — crea blocco manuale ──────────────────────────────
router.post('/', async (req, res) => {
  const { data_ora_inizio, data_ora_fine, motivo, tutto_il_giorno } = req.body;

  if (!data_ora_inizio || !data_ora_fine) {
    return res.status(400).json({ error: 'data_ora_inizio e data_ora_fine obbligatori' });
  }

  const { data, error } = await supabase
    .from('blocchi_agenda')
    .insert({
      data_ora_inizio,
      data_ora_fine,
      motivo:          motivo || 'Blocco',
      tipo:            'manuale',
      tutto_il_giorno: tutto_il_giorno || false,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// ─── DELETE /api/blocchi/:id — rimuovi blocco (solo manuali) ─────────────
router.delete('/:id', async (req, res) => {
  // Protezione: non si possono eliminare le festività automatiche
  const { data: blocco } = await supabase
    .from('blocchi_agenda')
    .select('tipo')
    .eq('id', req.params.id)
    .single();

  if (blocco?.tipo === 'festivo') {
    return res.status(403).json({ error: 'Le festività automatiche non possono essere eliminate' });
  }

  const { error } = await supabase
    .from('blocchi_agenda')
    .delete()
    .eq('id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

module.exports = router;
