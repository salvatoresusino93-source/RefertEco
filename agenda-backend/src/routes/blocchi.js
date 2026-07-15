// ═══════════════════════════════════════════════════════════════════════════
// ROUTE /api/blocchi — gestione blocchi agenda (festività, impegni, manuale)
// ═══════════════════════════════════════════════════════════════════════════

const express  = require('express');
const supabase = require('../services/supabase');
const { requireAuth } = require('../middleware/auth');
const { leggiEventiPersonali, getCreds } = require('../services/googleCalendar');
const { leggiImpegniIcal, icalConfigurato } = require('../services/icalCalendar');

const router = express.Router();
router.use(requireAuth);

// ─── Helper fuso orario Roma (copiato da public.js) ───────────────────────
function getRomeOffsetMs(dateStr) {
  const [yyyy, mm, dd] = dateStr.split('-').map(Number);
  const probe = new Date(Date.UTC(yyyy, mm - 1, dd, 12, 0, 0));
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Rome',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  }).formatToParts(probe);
  const get = t => { const p = parts.find(x => x.type === t); return p ? parseInt(p.value) : 0; };
  let h = get('hour'); if (h === 24) h = 0;
  const romeAsUtc = Date.UTC(get('year'), get('month') - 1, get('day'), h, get('minute'), get('second'));
  return romeAsUtc - probe.getTime();
}

function makeRomeDateTime(dateStr, totalMinutes) {
  const [yyyy, mm, dd] = dateStr.split('-').map(Number);
  const hours = Math.floor(totalMinutes / 60);
  const mins  = totalMinutes % 60;
  const offsetMs = getRomeOffsetMs(dateStr);
  return new Date(Date.UTC(yyyy, mm - 1, dd, hours, mins, 0) - offsetMs);
}

// ─── Leggi impegni personali GCal → formato blocchi_agenda ───────────────
async function impegniGoogleCalendar(from, to) {
  if (getCreds()) {
    try {
      const eventi = await leggiEventiPersonali(from, to) || [];
      return eventi
        .filter(ev => ev.transparency !== 'transparent' && ev.status !== 'cancelled')
        .map(ev => {
          // Non mostrare mai il titolo reale dell'evento Google Calendar (privacy):
          // sul calendario dello studio appare solo "Indisponibile".
          if (ev.start?.dateTime && ev.end?.dateTime) {
            return {
              id:              `gcal_${ev.id}`,
              data_ora_inizio: ev.start.dateTime,
              data_ora_fine:   ev.end.dateTime,
              motivo:          'Indisponibile',
              tipo:            'gcal',
              tutto_il_giorno: false,
            };
          } else if (ev.start?.date && ev.end?.date) {
            return {
              id:              `gcal_${ev.id}`,
              data_ora_inizio: makeRomeDateTime(ev.start.date, 0).toISOString(),
              data_ora_fine:   makeRomeDateTime(ev.end.date,   0).toISOString(),
              motivo:          'Indisponibile',
              tipo:            'gcal',
              tutto_il_giorno: true,
            };
          }
          return null;
        })
        .filter(Boolean);
    } catch (e) {
      console.error('[blocchi] GCal lettura fallita:', e.message);
      return [];
    }
  }

  if (icalConfigurato()) {
    try {
      const intervalli = await leggiImpegniIcal(from, to) || [];
      return intervalli.map(b => ({
        id:              `ical_${b.data_ora_inizio}`,
        data_ora_inizio: b.data_ora_inizio,
        data_ora_fine:   b.data_ora_fine,
        motivo:          'Indisponibile',
        tipo:            'gcal',
        tutto_il_giorno: false,
      }));
    } catch (e) {
      console.error('[blocchi] iCal lettura fallita:', e.message);
      return [];
    }
  }

  return [];
}

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

  // Merge con impegni personali del medico da Google Calendar / iCal
  const gcal = from && to ? await impegniGoogleCalendar(from, to) : [];

  // I blocchi tipo='google_calendar' salvati nel DB (cron 06:00) duplicano gli
  // eventi letti in diretta → se la lettura live è attiva vanno esclusi, altrimenti
  // sull'agenda compaiono due scritte sovrapposte. In ogni caso il motivo non deve
  // mai rivelare il titolo dell'evento privato: sempre e solo "Indisponibile".
  const liveAttivo = gcal.length > 0 || getCreds() || icalConfigurato();
  const blocchiDb = (data || [])
    .filter(b => !(liveAttivo && b.tipo === 'google_calendar'))
    .map(b => b.tipo === 'google_calendar' ? { ...b, motivo: 'Indisponibile' } : b);

  res.json([...blocchiDb, ...gcal]);
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
