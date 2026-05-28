const express  = require('express');
const supabase  = require('../services/supabase');
const { requireAuth, requireMedico } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// ─── GET /api/prestazioni ─────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('tipi_prestazione')
    .select('*')
    .eq('attivo', true)
    .order('nome');

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ─── GET /api/prestazioni/tutte (incluse disattive) — solo medico ─────────
router.get('/tutte', requireMedico, async (req, res) => {
  const { data, error } = await supabase
    .from('tipi_prestazione')
    .select('*')
    .order('nome');

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ─── POST /api/prestazioni — solo medico ─────────────────────────────────
router.post('/', requireMedico, async (req, res) => {
  const { nome, durata_minuti, codice_dicom } = req.body;
  if (!nome?.trim()) {
    return res.status(400).json({ error: 'Nome prestazione obbligatorio' });
  }

  const { data, error } = await supabase
    .from('tipi_prestazione')
    .insert({
      nome:          nome.trim(),
      durata_minuti: Number(durata_minuti) || 30,
      codice_dicom:  codice_dicom?.trim() || null,
      attivo:        true
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// ─── PUT /api/prestazioni/:id — solo medico ───────────────────────────────
router.put('/:id', requireMedico, async (req, res) => {
  const { nome, durata_minuti, codice_dicom, attivo } = req.body;
  const updates = {};
  if (nome          !== undefined) updates.nome          = nome.trim();
  if (durata_minuti !== undefined) updates.durata_minuti = Number(durata_minuti);
  if (codice_dicom  !== undefined) updates.codice_dicom  = codice_dicom?.trim() || null;
  if (attivo        !== undefined) updates.attivo        = Boolean(attivo);

  const { data, error } = await supabase
    .from('tipi_prestazione')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
