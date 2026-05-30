// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API — Prenotazione online (no auth)
// ═══════════════════════════════════════════════════════════════════════════
const express  = require('express');
const jwt      = require('jsonwebtoken');
const supabase = require('../services/supabase');
const { notificaPrenotazioneOnline } = require('../services/email');
const { leggiEventiPersonali, getCreds } = require('../services/googleCalendar');
const { leggiImpegniIcal, icalConfigurato } = require('../services/icalCalendar');

const router = express.Router();

// Griglia agenda unificata: tutti gli slot da 30 minuti
const SLOT_MINUTI = 30;

// ─── Helper: offset Roma in ms rispetto a UTC ────────────────────────────
// Positive = Roma è avanti di UTC (es. +7200000 per CEST +02:00)
function getRomeOffsetMs(dateStr) {
  const [yyyy, mm, dd] = dateStr.split('-').map(Number);
  const probe = new Date(Date.UTC(yyyy, mm - 1, dd, 12, 0, 0)); // mezzogiorno UTC
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Rome',
    year:     'numeric', month:  '2-digit', day:    '2-digit',
    hour:     '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  }).formatToParts(probe);
  const get = t => { const p = parts.find(x => x.type === t); return p ? parseInt(p.value) : 0; };
  let h = get('hour'); if (h === 24) h = 0;
  const romeAsUtc = Date.UTC(get('year'), get('month') - 1, get('day'), h, get('minute'), get('second'));
  return romeAsUtc - probe.getTime();
}

// Crea un Date UTC corrispondente a totalMinutes (es. 9*60) nell'orario di Roma
function makeRomeDateTime(dateStr, totalMinutes) {
  const [yyyy, mm, dd] = dateStr.split('-').map(Number);
  const hours = Math.floor(totalMinutes / 60);
  const mins  = totalMinutes % 60;
  const offsetMs = getRomeOffsetMs(dateStr);
  return new Date(Date.UTC(yyyy, mm - 1, dd, hours, mins, 0) - offsetMs);
}

function capitalizeWords(s) {
  if (!s) return s;
  return s.trim().toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
}

// ─── Impegni personali da Google Calendar → intervalli occupati ───────────
// Lettura in tempo reale: se il medico è impegnato nel suo calendario,
// quegli orari NON sono prenotabili. In caso di errore restituisce []
// (la disponibilità resta comunque coperta dai blocchi importati alle 06:00).
async function intervalliGoogleCalendar(daISO, aISO) {
  // Via service account (consigliata): legge SOLO gli impegni personali del
  // medico ed esclude automaticamente le ecografie che l'agenda stessa ha
  // scritto nel calendario (riconosciute da extendedProperties.agendaStudioId).
  if (getCreds()) {
    try {
      const eventi = await leggiEventiPersonali(daISO, aISO);
      const intervalli = [];
      for (const ev of eventi || []) {
        // Eventi marcati "Disponibile" (transparent) o annullati non bloccano
        if (ev.transparency === 'transparent') continue;
        if (ev.status === 'cancelled') continue;

        if (ev.start?.dateTime && ev.end?.dateTime) {
          intervalli.push({
            data_ora_inizio: ev.start.dateTime,
            data_ora_fine:   ev.end.dateTime,
          });
        } else if (ev.start?.date && ev.end?.date) {
          // Evento "tutto il giorno": end.date è esclusivo in Google
          intervalli.push({
            data_ora_inizio: makeRomeDateTime(ev.start.date, 0).toISOString(),
            data_ora_fine:   makeRomeDateTime(ev.end.date,   0).toISOString(),
          });
        }
      }
      return intervalli;
    } catch (e) {
      console.error('[Disponibilità] Lettura Google Calendar (service account) fallita:', e.message);
      return [];
    }
  }

  // Fallback: link iCal segreto (sola lettura), usato solo se il service
  // account non è configurato. NB: l'iCal non distingue le ecografie scritte
  // dall'agenda dagli impegni personali, ma blocca comunque correttamente.
  if (icalConfigurato()) {
    return leggiImpegniIcal(daISO, aISO);
  }

  return [];
}

// ─── Blocchi di fascia oraria (tabella indisponibilita) come intervalli ────
// Le fasce sono in ora locale Italia: mattina 08-14, pomeriggio 14-20,
// giornata 08-20. Servono a impedire le prenotazioni online quando il medico
// blocca una fascia dall'agenda (es. quando in ambulatorio c'è la collega).
const FASCE_INDISP = {
  mattina:    { startH: 8,  endH: 14 },
  pomeriggio: { startH: 14, endH: 20 },
  giornata:   { startH: 8,  endH: 20 },
};

async function intervalliIndisponibilita(fromDateStr, toDateStr) {
  const { data, error } = await supabase
    .from('indisponibilita')
    .select('data, tipo')
    .gte('data', fromDateStr)
    .lte('data', toDateStr);

  if (error || !data) return [];

  const intervalli = [];
  for (const b of data) {
    const f = FASCE_INDISP[b.tipo];
    if (!f) continue;
    intervalli.push({
      data_ora_inizio: makeRomeDateTime(b.data, f.startH * 60).toISOString(),
      data_ora_fine:   makeRomeDateTime(b.data, f.endH   * 60).toISOString(),
    });
  }
  return intervalli;
}

function esamePrenotabile(nome) {
  const n = String(nome || '').toLowerCase();
  if (/mammell|mammaria|\bseno\b/.test(n)) return false;
  if (/ginecolog|ostetric|transvagin|pelvic|pelvi femm|gestaz|fetale|nucale|ecocardio fet/.test(n)) return false;
  return true;
}

function dedupeEsamiPerNome(rows) {
  const seen = new Set();
  return (rows || []).filter((row) => {
    const key = String(row.nome || '').toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── GET /api/public/esami ────────────────────────────────────────────────
router.get('/esami', async (req, res) => {
  const { data, error } = await supabase
    .from('tipi_prestazione')
    .select('id, nome, durata_minuti')
    .eq('attivo', true)
    .order('nome');
  if (error) return res.status(500).json({ error: 'Errore caricamento esami' });
  const rows = dedupeEsamiPerNome((data || []).filter(row => esamePrenotabile(row.nome)));
  res.json(rows.map(row => ({
    ...row,
    durata_minuti: SLOT_MINUTI,
  })));
});

// ─── GET /api/public/disponibilita?tipo_id=UUID ───────────────────────────
// Restituisce gli slot liberi per i prossimi 45 giorni (lunedì–venerdì)
router.get('/disponibilita', async (req, res) => {
  const { tipo_id } = req.query;
  if (!tipo_id) return res.status(400).json({ error: 'tipo_id obbligatorio' });

  const { data: tipo } = await supabase
    .from('tipi_prestazione')
    .select('durata_minuti')
    .eq('id', tipo_id)
    .eq('attivo', true)
    .single();

  if (!tipo) return res.status(404).json({ error: 'Esame non trovato' });

  const durata = SLOT_MINUTI;

  const adesso = new Date();
  const domani = new Date(adesso);
  domani.setDate(domani.getDate() + 1);
  domani.setHours(0, 0, 0, 0);

  const fine45 = new Date(domani);
  fine45.setDate(fine45.getDate() + 45);
  fine45.setHours(23, 59, 59, 999);

  // Appuntamenti non annullati nel range (inclusi in_attesa — bloccano lo slot)
  const { data: appuntamenti } = await supabase
    .from('appuntamenti')
    .select('data_ora_inizio, data_ora_fine')
    .neq('stato', 'annullato')
    .gte('data_ora_inizio', domani.toISOString())
    .lte('data_ora_inizio', fine45.toISOString());

  // Blocchi agenda nel range
  const { data: blocchi } = await supabase
    .from('blocchi_agenda')
    .select('data_ora_inizio, data_ora_fine')
    .lt('data_ora_inizio', fine45.toISOString())
    .gt('data_ora_fine',  domani.toISOString());

  // Impegni personali letti in tempo reale dal Google Calendar del medico
  const impegniGoogle = await intervalliGoogleCalendar(domani.toISOString(), fine45.toISOString());

  // Blocchi di fascia oraria messi dall'agenda (mattina/pomeriggio/giornata)
  const indisponibilita = await intervalliIndisponibilita(
    domani.toISOString().slice(0, 10),
    fine45.toISOString().slice(0, 10)
  );

  const occupied = [...(appuntamenti || []), ...(blocchi || []), ...impegniGoogle, ...indisponibilita];

  const FASCE = [
    { start:  9 * 60,      end: 12 * 60 + 30 }, // 09:00–12:30
    { start: 15 * 60,      end: 19 * 60 },       // 15:00–19:00
  ];
  const GIORNI_APERTI = new Set([1, 2, 3, 4, 5]); // Lunedì–Venerdì

  const giorni = [];

  for (let cursor = new Date(domani); cursor <= fine45; cursor.setDate(cursor.getDate() + 1)) {
    if (!GIORNI_APERTI.has(cursor.getDay())) continue;

    const dateStr    = cursor.toISOString().slice(0, 10);
    const slotsForDay = [];

    for (const fascia of FASCE) {
      for (let min = fascia.start; min + durata <= fascia.end; min += durata) {
        const slotStart = makeRomeDateTime(dateStr, min);
        const slotEnd   = makeRomeDateTime(dateStr, min + durata);
        const ora = `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

        const isTaken = occupied.some(o => {
          const oS = new Date(o.data_ora_inizio).getTime();
          const oE = new Date(o.data_ora_fine).getTime();
          return oS < slotEnd.getTime() && oE > slotStart.getTime();
        });

        if (!isTaken) {
          slotsForDay.push({
            data_ora_inizio: slotStart.toISOString(),
            data_ora_fine:   slotEnd.toISOString(),
            ora,
          });
        }
      }
    }

    if (slotsForDay.length > 0) {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dataObj = new Date(y, m - 1, d);
      giorni.push({
        data:   dateStr,
        giorno: dataObj.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }),
        slots:  slotsForDay,
      });
    }
  }

  res.json({ giorni });
});

// ─── POST /api/public/prenota ─────────────────────────────────────────────
router.post('/prenota', async (req, res) => {
  const {
    tipo_id, data_ora_inizio,
    cognome, nome, data_nascita, sesso,
    telefono, codice_fiscale, note
  } = req.body;

  if (!tipo_id || !data_ora_inizio || !cognome?.trim() || !nome?.trim() || !data_nascita || !telefono?.trim()) {
    return res.status(400).json({ error: 'Dati obbligatori mancanti' });
  }

  // Verifica esame
  const { data: tipo } = await supabase
    .from('tipi_prestazione')
    .select('id, nome, durata_minuti')
    .eq('id', tipo_id)
    .eq('attivo', true)
    .single();

  if (!tipo) return res.status(404).json({ error: 'Tipo esame non trovato' });

  const durata       = SLOT_MINUTI;
  const data_ora_fine = new Date(new Date(data_ora_inizio).getTime() + durata * 60000).toISOString();

  // Controllo slot ancora disponibile
  const { data: sovrapposti } = await supabase
    .from('appuntamenti')
    .select('id')
    .neq('stato', 'annullato')
    .lt('data_ora_inizio', data_ora_fine)
    .gt('data_ora_fine',   data_ora_inizio);

  if (sovrapposti && sovrapposti.length > 0) {
    return res.status(409).json({ error: 'Slot non più disponibile. Scegli un altro orario.' });
  }

  const { data: blocchi } = await supabase
    .from('blocchi_agenda')
    .select('id')
    .lt('data_ora_inizio', data_ora_fine)
    .gt('data_ora_fine',   data_ora_inizio);

  if (blocchi && blocchi.length > 0) {
    return res.status(409).json({ error: 'Slot non disponibile (giorno festivo o chiusura).' });
  }

  // Controllo impegni personali dal Google Calendar (tempo reale)
  const impegniGoogle = await intervalliGoogleCalendar(data_ora_inizio, data_ora_fine);
  const sovrappostoGoogle = impegniGoogle.some(o =>
    new Date(o.data_ora_inizio).getTime() < new Date(data_ora_fine).getTime() &&
    new Date(o.data_ora_fine).getTime()   > new Date(data_ora_inizio).getTime()
  );
  if (sovrappostoGoogle) {
    return res.status(409).json({ error: 'Slot non più disponibile. Scegli un altro orario.' });
  }

  // Controllo blocchi di fascia oraria messi dall'agenda (mattina/pomeriggio/giornata)
  const indispDay = data_ora_inizio.slice(0, 10);
  const indisponibilita = await intervalliIndisponibilita(indispDay, indispDay);
  const sovrappostoIndisp = indisponibilita.some(o =>
    new Date(o.data_ora_inizio).getTime() < new Date(data_ora_fine).getTime() &&
    new Date(o.data_ora_fine).getTime()   > new Date(data_ora_inizio).getTime()
  );
  if (sovrappostoIndisp) {
    return res.status(409).json({ error: 'Slot non disponibile (fascia oraria bloccata).' });
  }

  // Trova o crea paziente
  const nomePulito    = capitalizeWords(nome);
  const cognomePulito = capitalizeWords(cognome);
  const telPulito     = telefono.trim();
  const cfPulito      = codice_fiscale?.toUpperCase().trim() || null;

  let pazienteId;

  if (cfPulito) {
    const { data: ex } = await supabase
      .from('pazienti').select('id').ilike('codice_fiscale', cfPulito).maybeSingle();
    if (ex) pazienteId = ex.id;
  }

  if (!pazienteId) {
    const { data: ex } = await supabase
      .from('pazienti').select('id')
      .ilike('cognome', cognomePulito)
      .ilike('nome',    nomePulito)
      .eq('data_nascita', data_nascita)
      .maybeSingle();
    if (ex) pazienteId = ex.id;
  }

  if (!pazienteId) {
    const { data: newPaz, error: errPaz } = await supabase
      .from('pazienti')
      .insert({
        cognome:        cognomePulito,
        nome:           nomePulito,
        data_nascita,
        sesso:          sesso || null,
        codice_fiscale: cfPulito,
        telefono:       telPulito,
      })
      .select('id')
      .single();

    if (errPaz) return res.status(500).json({ error: 'Errore durante la registrazione. Riprova.' });
    pazienteId = newPaz.id;
  }

  // Crea appuntamento in_attesa
  const { data: app, error: errApp } = await supabase
    .from('appuntamenti')
    .insert({
      paziente_id:     pazienteId,
      tipo_id,
      data_ora_inizio,
      data_ora_fine,
      note_segreteria: note || null,
      stato:           'in_attesa',
      worklist_status: 'pending',
    })
    .select('*, pazienti(*), tipi_prestazione(*)')
    .single();

  if (errApp) return res.status(500).json({ error: 'Errore durante la prenotazione. Riprova.' });

  // Token per email approvazione (7 giorni)
  const token = jwt.sign({ id: app.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

  // Email al medico
  notificaPrenotazioneOnline(app, token).catch(e =>
    console.error('[email] Notifica prenotazione online:', e.message)
  );

  res.status(201).json({
    ok: true,
    messaggio: 'Richiesta inviata! Riceverai conferma via SMS dopo l\'approvazione del medico.'
  });
});

module.exports = router;
