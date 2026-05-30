// ═══════════════════════════════════════════════════════════════════════════
// REMINDER — Cron job promemoria SMS appuntamenti
// Ogni giorno alle 19:00 ora italiana invia SMS per gli appuntamenti
// del giorno successivo
// ═══════════════════════════════════════════════════════════════════════════

const cron    = require('node-cron');
const supabase = require('./supabase');
const { inviaPromemoria, inviaPromemoria1Ora } = require('./sms');
const { popolaFestivita } = require('./festivita');
const { leggiEventiPersonali, getCreds } = require('./googleCalendar');
const { aggiornaOreSettimana } = require('./googleBusiness');

// ─── Carica appuntamenti di domani da Supabase ────────────────────────────
async function appuntamentiDomani() {
  const domani = new Date();
  domani.setDate(domani.getDate() + 1);
  domani.setHours(0, 0, 0, 0);

  const dopoDomani = new Date(domani);
  dopoDomani.setDate(dopoDomani.getDate() + 1);

  const { data, error } = await supabase
    .from('appuntamenti')
    .select('*, pazienti(*), tipi_prestazione(*)')
    .neq('stato', 'annullato')
    .gte('data_ora_inizio', domani.toISOString())
    .lt('data_ora_inizio', dopoDomani.toISOString())
    .order('data_ora_inizio');

  if (error) throw error;
  return data || [];
}

// ─── Invia promemoria per tutti gli appuntamenti di domani ────────────────
async function inviaPromemoriDomani() {
  console.log(`\n[SMS Reminder] Avvio invio promemoria — ${new Date().toLocaleString('it-IT')}`);

  let lista;
  try {
    lista = await appuntamentiDomani();
  } catch (e) {
    console.error('[SMS Reminder] Errore lettura appuntamenti:', e.message);
    return { ok: false, error: e.message };
  }

  if (lista.length === 0) {
    console.log('[SMS Reminder] Nessun appuntamento domani. Nessun SMS inviato.');
    return { ok: true, inviati: 0, saltati: 0, errori: 0 };
  }

  console.log(`[SMS Reminder] ${lista.length} appuntamenti trovati per domani.`);

  let inviati = 0, saltati = 0, errori = 0;

  for (const app of lista) {
    const telefono = app.pazienti?.telefono;
    const nome     = app.pazienti ? `${app.pazienti.nome} ${app.pazienti.cognome}` : app.id;

    if (!telefono) {
      console.log(`  [SALTATO] ${nome} — nessun numero di telefono`);
      saltati++;
      continue;
    }

    if (app.invia_sms_promemoria === false) {
      console.log(`  [SALTATO] ${nome} — promemoria SMS disattivato per questo appuntamento`);
      saltati++;
      continue;
    }

    try {
      const result = await inviaPromemoria(app);
      console.log(`  [OK] ${nome} → ${result.numero} (SID: ${result.sid})`);
      inviati++;
    } catch (e) {
      console.error(`  [ERRORE] ${nome} → ${e.message}`);
      errori++;
    }
  }

  console.log(`[SMS Reminder] Fine — Inviati: ${inviati}, Saltati: ${saltati}, Errori: ${errori}\n`);
  return { ok: true, inviati, saltati, errori, totale: lista.length };
}

// ─── Invia promemoria 1 ora prima dell'appuntamento ──────────────────────
async function controllaSmsUnaOra() {
  const ora = new Date();

  // Finestra: appuntamenti che iniziano tra 59 e 61 minuti da adesso
  const da = new Date(ora.getTime() + 59 * 60 * 1000);
  const a  = new Date(ora.getTime() + 61 * 60 * 1000);

  const { data, error } = await supabase
    .from('appuntamenti')
    .select('*, pazienti(*), tipi_prestazione(*)')
    .neq('stato', 'annullato')
    .gte('data_ora_inizio', da.toISOString())
    .lte('data_ora_inizio', a.toISOString());

  if (error || !data || data.length === 0) return;

  for (const app of data) {
    const telefono = app.pazienti?.telefono;
    const nome     = app.pazienti ? `${app.pazienti.nome} ${app.pazienti.cognome}` : app.id;
    if (!telefono) continue;
    if (app.invia_sms_promemoria === false) {
      console.log(`[SMS 1h] Saltato ${nome} — promemoria SMS disattivato`);
      continue;
    }

    try {
      await inviaPromemoria1Ora(app);
      console.log(`[SMS 1h] Inviato a ${nome}`);
    } catch (e) {
      console.error(`[SMS 1h] Errore ${nome}: ${e.message}`);
    }
  }
}

// ─── Sincronizza impegni personali da Google Calendar → blocchi_agenda ───
async function sincronizzaBlocchiGoogleCalendar() {
  if (!getCreds()) {
    console.log('[GCal Sync] Credenziali non configurate, skip.');
    return;
  }

  // Importa i prossimi 46 giorni (copre l'orizzonte di prenotazione online: 45 gg)
  const da = new Date();
  da.setHours(0, 0, 0, 0);
  const a = new Date(da);
  a.setDate(a.getDate() + 46);

  let eventi;
  try {
    eventi = await leggiEventiPersonali(da.toISOString(), a.toISOString());
  } catch (e) {
    console.error('[GCal Sync] Errore lettura eventi:', e.message);
    return;
  }

  if (!eventi.length) {
    console.log('[GCal Sync] Nessun impegno personale nei prossimi 46 giorni.');
    return;
  }

  // Rimuovi blocchi google_calendar esistenti nel periodo (per aggiornare)
  await supabase
    .from('blocchi_agenda')
    .delete()
    .eq('tipo', 'google_calendar')
    .gte('data_ora_inizio', da.toISOString())
    .lte('data_ora_inizio', a.toISOString());

  let inseriti = 0;
  for (const ev of eventi) {
    // Evento tutto il giorno
    const tuttoIlGiorno = !!(ev.start?.date && !ev.start?.dateTime);
    const inizio = ev.start?.dateTime || (ev.start?.date + 'T00:00:00.000Z');
    const fine   = ev.end?.dateTime   || (ev.end?.date   + 'T23:59:59.000Z');

    // Etichetta generica: nell'agenda si vede che lo slot è occupato/non
    // prenotabile, ma NON i dettagli privati dell'impegno (titolo nascosto).
    const { error } = await supabase.from('blocchi_agenda').insert({
      data_ora_inizio: inizio,
      data_ora_fine:   fine,
      motivo:          'Impegno personale',
      tipo:            'google_calendar',
      tutto_il_giorno: tuttoIlGiorno,
    });

    if (!error) inseriti++;
  }

  console.log(`[GCal Sync] Importati ${inseriti} impegni da Google Calendar`);
}

// ─── Avvia i cron job ────────────────────────────────────────────────────
function avviaReminder() {
  // Ogni giorno alle 19:00 ora italiana → promemoria per domani
  cron.schedule('0 19 * * *', inviaPromemoriDomani, {
    timezone: 'Europe/Rome'
  });

  // Ogni minuto → controlla appuntamenti tra 1 ora
  cron.schedule('* * * * *', controllaSmsUnaOra);

  // Ogni 1 gennaio alle 09:00 → popola festività anno nuovo
  cron.schedule('0 9 1 1 *', () => {
    const anno = new Date().getFullYear();
    popolaFestivita(anno).catch(e => console.error('[Festività]', e.message));
    popolaFestivita(anno + 1).catch(e => console.error('[Festività]', e.message));
  }, { timezone: 'Europe/Rome' });

  // Ogni 30 minuti → importa gli impegni personali da Google Calendar come
  // blocchi nell'agenda (etichetta generica, senza dettagli privati). Così
  // nell'agenda lo slot risulta "non prenotabile". Gli impegni bloccano anche
  // la prenotazione online in tempo reale (vedi routes/public.js).
  cron.schedule('*/30 * * * *', sincronizzaBlocchiGoogleCalendar, { timezone: 'Europe/Rome' });
  // All'avvio: importa subito una prima volta
  sincronizzaBlocchiGoogleCalendar().catch(e => console.error('[GCal Sync avvio]', e.message));

  // Ogni 30 minuti → aggiorna gli orari pubblici di Google Business Profile per
  // i prossimi 30 giorni in base agli impegni del medico (Google Calendar) e
  // alle festività. Così gli orari su Google riflettono SEMPRE la reale
  // disponibilità. La funzione salta la scrittura se nulla è cambiato.
  cron.schedule('*/30 * * * *', () => {
    aggiornaOreSettimana().catch(e => console.error('[GBP] Errore aggiornamento orari:', e.message));
  }, { timezone: 'Europe/Rome' });
  // All'avvio: allinea subito gli orari
  aggiornaOreSettimana().catch(e => console.error('[GBP avvio]', e.message));

  console.log('[SMS Reminder] Cron job attivi — 19:00 SMS + 1h prima + sync GCal ogni 30min + GBP ogni 30min (Europe/Rome)');

  // All'avvio: popola festività anno corrente e prossimo se non già presenti
  const annoOra = new Date().getFullYear();
  popolaFestivita(annoOra).catch(e => console.error('[Festività avvio]', e.message));
  popolaFestivita(annoOra + 1).catch(e => console.error('[Festività avvio]', e.message));
}

module.exports = { avviaReminder, inviaPromemoriDomani };
