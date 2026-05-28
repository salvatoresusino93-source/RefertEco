const express  = require('express');
const supabase  = require('../services/supabase');
const { requireAuth, requireMedico } = require('../middleware/auth');
const { getIO }  = require('../socket');
const { notificaNuovoAppuntamento, notificaAppuntamentoAnnullato } = require('../services/email');
const { inviaPromemoria, inviaSmsConferma, inviaSmsAnnullamento } = require('../services/sms');
const { creaEvento, eliminaEventoByAgendaId } = require('../services/googleCalendar');

const router = express.Router();
router.use(requireAuth);

// ─── Helper: genera Accession Number YYYYMMDD-NNNN ───────────────────────
async function generaAccessionNumber() {
  const oggi = new Date();
  const dataStr = oggi.toISOString().slice(0, 10).replace(/-/g, ''); // es. "20260523"

  const { count, error } = await supabase
    .from('appuntamenti')
    .select('*', { count: 'exact', head: true })
    .like('accession_number', `${dataStr}-%`);

  const n = (error ? 0 : (count || 0)) + 1;
  return `${dataStr}-${String(n).padStart(4, '0')}`;
}

// ─── GET /api/appuntamenti?from=ISO&to=ISO ───────────────────────────────
router.get('/', async (req, res) => {
  const { from, to } = req.query;

  let query = supabase
    .from('appuntamenti')
    .select('*, pazienti(*), tipi_prestazione(*), utenti:created_by(nome_display)')
    .neq('stato', 'annullato')
    .order('data_ora_inizio');

  if (from) query = query.gte('data_ora_inizio', from);
  if (to)   query = query.lte('data_ora_inizio', to);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ─── GET /api/appuntamenti/oggi ──────────────────────────────────────────
// ATTENZIONE: questa route deve stare PRIMA di /:id
router.get('/oggi', async (req, res) => {
  const inizio = new Date(); inizio.setHours(0, 0, 0, 0);
  const fine   = new Date(); fine.setHours(23, 59, 59, 999);

  const { data, error } = await supabase
    .from('appuntamenti')
    .select('*, pazienti(*), tipi_prestazione(*)')
    .neq('stato', 'annullato')
    .gte('data_ora_inizio', inizio.toISOString())
    .lte('data_ora_inizio', fine.toISOString())
    .order('data_ora_inizio');

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ─── POST /api/appuntamenti ───────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { paziente_id, tipo_id, data_ora_inizio, data_ora_fine, note_segreteria, invia_sms_promemoria } = req.body;

  if (!paziente_id || !tipo_id || !data_ora_inizio || !data_ora_fine) {
    return res.status(400).json({
      error: 'Campi obbligatori mancanti: paziente_id, tipo_id, data_ora_inizio, data_ora_fine'
    });
  }

  // Verifica sovrapposizione oraria
  const { data: sovrapposti } = await supabase
    .from('appuntamenti')
    .select('id, data_ora_inizio, data_ora_fine')
    .neq('stato', 'annullato')
    .lt('data_ora_inizio', data_ora_fine)
    .gt('data_ora_fine', data_ora_inizio);

  if (sovrapposti && sovrapposti.length > 0) {
    return res.status(409).json({
      error: 'Slot già occupato: c\'è un appuntamento sovrapposto',
      conflitti: sovrapposti
    });
  }

  // Verifica blocchi agenda (festività, impegni, manuali)
  const { data: blocchi } = await supabase
    .from('blocchi_agenda')
    .select('id, motivo, tipo')
    .lt('data_ora_inizio', data_ora_fine)
    .gt('data_ora_fine',   data_ora_inizio);

  if (blocchi && blocchi.length > 0) {
    const b = blocchi[0];
    return res.status(409).json({
      error: `Impossibile prenotare: "${b.motivo}" — il centro è chiuso`,
      tipo: 'blocco',
      motivo: b.motivo,
    });
  }

  // Verifica indisponibilità per fascia (mattina/pomeriggio/giornata)
  const italyDate  = new Date(data_ora_inizio).toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' });
  const italyStart = new Date(data_ora_inizio).toLocaleTimeString('en-GB', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' });
  const italyEnd   = new Date(data_ora_fine).toLocaleTimeString('en-GB',   { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' });

  const { data: fasce } = await supabase
    .from('indisponibilita')
    .select('tipo, motivo')
    .eq('data', italyDate);

  if (fasce && fasce.length > 0) {
    const FASCE_ORARIE = {
      mattina:    { start: '08:00', end: '14:00' },
      pomeriggio: { start: '14:00', end: '20:00' },
      giornata:   { start: '08:00', end: '20:00' },
    };
    for (const f of fasce) {
      const range = FASCE_ORARIE[f.tipo];
      if (!range) continue;
      if (italyStart < range.end && italyEnd > range.start) {
        const motivo = f.motivo ? ` — ${f.motivo}` : '';
        return res.status(409).json({
          error: `Fascia oraria non disponibile (${f.tipo}${motivo})`,
          tipo:  'indisponibilita'
        });
      }
    }
  }

  const accession_number = await generaAccessionNumber();

  const { data, error } = await supabase
    .from('appuntamenti')
    .insert({
      paziente_id,
      tipo_id,
      data_ora_inizio,
      data_ora_fine,
      note_segreteria: note_segreteria || null,
      invia_sms_promemoria: invia_sms_promemoria !== false, // default true
      accession_number,
      created_by: req.user.id,
      stato: 'prenotato',
      worklist_status: 'pending'
    })
    .select('*, pazienti(*), tipi_prestazione(*)')
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // Notifica tutti i client connessi via Socket.io
  try { getIO().emit('appuntamento:nuovo', data); } catch (e) {}

  // Notifica email al medico
  notificaNuovoAppuntamento(data).catch(() => {});

  // SMS conferma prenotazione al paziente (immediato)
  inviaSmsConferma(data).catch(e => console.error('[SMS] Conferma prenotazione:', e.message));

  // Google Calendar — crea evento (ID appuntamento salvato in extendedProperties)
  creaEvento(data).catch(e => console.error('[GCal] Crea evento:', e.message));

  // SMS promemoria immediato se l'appuntamento è domani e siamo già oltre le 19:00
  // (il cron serale è già passato e non lo manderebbe più)
  try {
    const adesso = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Rome' }));
    const domani = new Date(adesso);
    domani.setDate(domani.getDate() + 1);

    const appData = new Date(new Date(data_ora_inizio).toLocaleString('en-US', { timeZone: 'Europe/Rome' }));
    const eDopoMezzogiorno = adesso.getHours() >= 19;
    const eDomani = appData.getFullYear() === domani.getFullYear() &&
                    appData.getMonth()     === domani.getMonth()    &&
                    appData.getDate()      === domani.getDate();

    if (eDomani && eDopoMezzogiorno) {
      inviaPromemoria(data).catch(e => console.error('[SMS] Promemoria immediato:', e.message));
    }
  } catch (e) {
    console.error('[SMS] Controllo promemoria immediato:', e.message);
  }

  res.status(201).json(data);
});

// ─── GET /api/appuntamenti/:id ────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('appuntamenti')
    .select('*, pazienti(*), tipi_prestazione(*)')
    .eq('id', req.params.id)
    .single();

  if (error || !data) return res.status(404).json({ error: 'Appuntamento non trovato' });
  res.json(data);
});

// ─── PUT /api/appuntamenti/:id ────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const campiConsentiti = [
    'paziente_id', 'tipo_id', 'data_ora_inizio', 'data_ora_fine',
    'stato', 'note_segreteria', 'note_medico', 'worklist_status',
    'invia_sms_promemoria'
  ];

  const updates = {};
  for (const k of campiConsentiti) {
    if (req.body[k] !== undefined) updates[k] = req.body[k];
  }

  // Solo il medico può modificare le note del medico
  if ('note_medico' in updates && req.user.ruolo !== 'medico') {
    delete updates.note_medico;
  }

  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('appuntamenti')
    .update(updates)
    .eq('id', req.params.id)
    .select('*, pazienti(*), tipi_prestazione(*)')
    .single();

  if (error) return res.status(500).json({ error: error.message });

  try { getIO().emit('appuntamento:aggiornato', data); } catch (e) {}

  res.json(data);
});

// ─── DELETE /api/appuntamenti/:id — soft delete (stato = annullato) ───────
router.delete('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('appuntamenti')
    .update({
      stato: 'annullato',
      worklist_status: 'not_needed',
      updated_at: new Date().toISOString()
    })
    .eq('id', req.params.id)
    .select('*, pazienti(*), tipi_prestazione(*)')
    .single();

  if (error) return res.status(500).json({ error: error.message });

  try { getIO().emit('appuntamento:annullato', { id: req.params.id }); } catch (e) {}

  // Notifica email al medico
  notificaAppuntamentoAnnullato(data).catch(() => {});

  // SMS di annullamento al paziente — disabilitato su richiesta
  // inviaSmsAnnullamento(data).catch(e => console.error('[SMS] Annullamento:', e.message));

  // Google Calendar — elimina evento (cerca per ID appuntamento)
  eliminaEventoByAgendaId(req.params.id)
    .catch(e => console.error('[GCal] Elimina evento:', e.message));

  res.json({ ok: true, data });
});

module.exports = router;
