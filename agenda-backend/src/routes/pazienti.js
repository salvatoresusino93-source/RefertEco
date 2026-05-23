const express  = require('express');
const supabase  = require('../services/supabase');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// ─── GET /api/pazienti?q=testo&limit=50&offset=0 ─────────────────────────
router.get('/', async (req, res) => {
  const { q, limit = 50, offset = 0 } = req.query;

  let query = supabase
    .from('pazienti')
    .select('*', { count: 'exact' })
    .order('cognome')
    .order('nome')
    .range(Number(offset), Number(offset) + Number(limit) - 1);

  if (q && q.trim()) {
    const term = q.trim();
    query = query.or(
      `cognome.ilike.%${term}%,nome.ilike.%${term}%,codice_fiscale.ilike.%${term}%,telefono.ilike.%${term}%`
    );
  }

  const { data, error, count } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ data, count, limit: Number(limit), offset: Number(offset) });
});

// ─── POST /api/pazienti ───────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { cognome, nome, data_nascita, sesso, codice_fiscale, telefono, email, note } = req.body;

  if (!cognome?.trim() || !nome?.trim()) {
    return res.status(400).json({ error: 'Cognome e nome sono obbligatori' });
  }
  if (!telefono?.trim()) {
    return res.status(400).json({ error: 'Il numero di telefono è obbligatorio' });
  }

  const { data, error } = await supabase
    .from('pazienti')
    .insert({
      cognome:        cognome.trim().toUpperCase(),
      nome:           nome.trim(),
      data_nascita:   data_nascita || null,
      sesso:          sesso || null,
      codice_fiscale: codice_fiscale?.toUpperCase().trim() || null,
      telefono:       telefono?.trim() || null,
      email:          email?.trim().toLowerCase() || null,
      note:           note || null
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Paziente già esistente (codice fiscale duplicato)' });
    return res.status(500).json({ error: error.message });
  }

  res.status(201).json(data);
});

// ─── GET /api/pazienti/:id ───────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('pazienti')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error || !data) return res.status(404).json({ error: 'Paziente non trovato' });
  res.json(data);
});

// ─── PUT /api/pazienti/:id ───────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const { cognome, nome, data_nascita, sesso, codice_fiscale, telefono, email, note } = req.body;

  const updates = {};
  if (cognome   !== undefined) updates.cognome        = cognome.trim().toUpperCase();
  if (nome      !== undefined) updates.nome           = nome.trim();
  if (data_nascita !== undefined) updates.data_nascita = data_nascita || null;
  if (sesso     !== undefined) updates.sesso          = sesso || null;
  if (codice_fiscale !== undefined) updates.codice_fiscale = codice_fiscale?.toUpperCase().trim() || null;
  if (telefono  !== undefined) updates.telefono       = telefono?.trim() || null;
  if (email     !== undefined) updates.email          = email?.trim().toLowerCase() || null;
  if (note      !== undefined) updates.note           = note || null;
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('pazienti')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ─── GET /api/pazienti/:id/appuntamenti ──────────────────────────────────
router.get('/:id/appuntamenti', async (req, res) => {
  const { data, error } = await supabase
    .from('appuntamenti')
    .select('*, tipi_prestazione(*)')
    .eq('paziente_id', req.params.id)
    .neq('stato', 'annullato')
    .order('data_ora_inizio', { ascending: false })
    .limit(50);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
