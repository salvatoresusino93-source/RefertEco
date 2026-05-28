const express  = require('express');
const supabase  = require('../services/supabase');
const { requireAuth } = require('../middleware/auth');
const { getIO } = require('../socket');

const router = express.Router();
router.use(requireAuth);

// Fasce orarie fisse (ora locale Italia)
const FASCE = {
  mattina:    { startH: 8,  endH: 14 },
  pomeriggio: { startH: 14, endH: 20 },
  giornata:   { startH: 8,  endH: 20 },
};

// ─── GET /api/indisponibilita?from=YYYY-MM-DD&to=YYYY-MM-DD ──────────────────
router.get('/', async (req, res) => {
  const { from, to } = req.query;

  let query = supabase
    .from('indisponibilita')
    .select('*, utenti:created_by(nome_display)')
    .order('data')
    .order('created_at');

  if (from) query = query.gte('data', from);
  if (to)   query = query.lte('data', to);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ─── POST /api/indisponibilita ────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { data: dataStr, tipo, motivo } = req.body;

  if (!dataStr || !tipo) {
    return res.status(400).json({ error: 'data e tipo sono obbligatori' });
  }
  if (!FASCE[tipo]) {
    return res.status(400).json({ error: 'tipo non valido (mattina / pomeriggio / giornata)' });
  }

  // Controlla conflitti: stesso tipo, o 'giornata' esistente, o aggiunta 'giornata' con blocchi esistenti
  const { data: esistenti } = await supabase
    .from('indisponibilita')
    .select('id, tipo')
    .eq('data', dataStr);

  if (esistenti && esistenti.length > 0) {
    const conflitto = esistenti.some(e =>
      e.tipo === 'giornata' || tipo === 'giornata' || e.tipo === tipo
    );
    if (conflitto) {
      return res.status(409).json({ error: 'Esiste già un blocco per questa fascia oraria' });
    }
  }

  const { data, error } = await supabase
    .from('indisponibilita')
    .insert({
      data:       dataStr,
      tipo,
      motivo:     motivo?.trim() || null,
      created_by: req.user.id
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  try { getIO().emit('indisponibilita:creata', data); } catch {}

  res.status(201).json(data);
});

// ─── DELETE /api/indisponibilita/:id ─────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  // Verifica che esista prima di cancellare
  const { data: existing } = await supabase
    .from('indisponibilita')
    .select('id')
    .eq('id', req.params.id)
    .maybeSingle();

  if (!existing) return res.status(404).json({ error: 'Blocco non trovato' });

  const { error } = await supabase
    .from('indisponibilita')
    .delete()
    .eq('id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });

  try { getIO().emit('indisponibilita:rimossa', { id: req.params.id }); } catch {}

  res.json({ ok: true });
});

module.exports = router;
