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

// Converte "HH:MM" in minuti dalla mezzanotte
function toMinuti(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + (m || 0);
}

// Intervallo [inizioMin, fineMin) di un blocco esistente
function intervalloDi(b) {
  if (b.tipo === 'personalizzata') {
    return { inizio: toMinuti(b.ora_inizio), fine: toMinuti(b.ora_fine) };
  }
  const f = FASCE[b.tipo];
  return { inizio: f.startH * 60, fine: f.endH * 60 };
}

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
  const { data: dataStr, tipo, motivo, ora_inizio, ora_fine } = req.body;

  if (!dataStr || !tipo) {
    return res.status(400).json({ error: 'data e tipo sono obbligatori' });
  }
  if (!FASCE[tipo] && tipo !== 'personalizzata') {
    return res.status(400).json({ error: 'tipo non valido (mattina / pomeriggio / giornata / personalizzata)' });
  }

  let nuovoIntervallo;
  if (tipo === 'personalizzata') {
    if (!ora_inizio || !ora_fine) {
      return res.status(400).json({ error: 'ora_inizio e ora_fine sono obbligatorie per una fascia personalizzata' });
    }
    const inizio = toMinuti(ora_inizio);
    const fine   = toMinuti(ora_fine);
    if (!(inizio < fine)) {
      return res.status(400).json({ error: 'L\'orario di fine deve essere successivo all\'orario di inizio' });
    }
    nuovoIntervallo = { inizio, fine };
  } else {
    const f = FASCE[tipo];
    nuovoIntervallo = { inizio: f.startH * 60, fine: f.endH * 60 };
  }

  // Controlla sovrapposizioni con blocchi esistenti nello stesso giorno
  const { data: esistenti } = await supabase
    .from('indisponibilita')
    .select('id, tipo, ora_inizio, ora_fine')
    .eq('data', dataStr);

  if (esistenti && esistenti.length > 0) {
    const sovrapposto = esistenti.some(e => {
      const es = intervalloDi(e);
      return nuovoIntervallo.inizio < es.fine && nuovoIntervallo.fine > es.inizio;
    });
    if (sovrapposto) {
      return res.status(409).json({ error: 'Esiste già un blocco che si sovrappone a questa fascia oraria' });
    }
  }

  const { data, error } = await supabase
    .from('indisponibilita')
    .insert({
      data:       dataStr,
      tipo,
      motivo:     motivo?.trim() || null,
      ora_inizio: tipo === 'personalizzata' ? ora_inizio : null,
      ora_fine:   tipo === 'personalizzata' ? ora_fine   : null,
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
