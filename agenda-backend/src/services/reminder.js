// ═══════════════════════════════════════════════════════════════════════════
// REMINDER — Cron job promemoria SMS appuntamenti
// Ogni giorno alle 19:00 ora italiana invia SMS per gli appuntamenti
// del giorno successivo
// ═══════════════════════════════════════════════════════════════════════════

const cron    = require('node-cron');
const supabase = require('./supabase');
const { inviaPromemoria, inviaPromemoria1Ora, inviaRichiestaRecensione } = require('./sms');
const { inviaWhatsappPromemoria, inviaWhatsappPromemoria1Ora, inviaWhatsappRecensione } = require('./whatsapp');
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

    // Chi ha già pagato (online) NON riceve SMS: ha già conferma e ricevuta
    // via email, ed è il paziente meno a rischio di no-show.
    if (app.pagamento_stato === 'pagato') {
      console.log(`  [SALTATO] ${nome} — ha già pagato online (nessun SMS)`);
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
    // WhatsApp in aggiunta all'SMS — no-op se non configurato, non blocca il ciclo
    inviaWhatsappPromemoria(app).catch(e => console.error(`  [WhatsApp ERRORE] ${nome} → ${e.message}`));
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
    // Chi ha già pagato online non riceve SMS
    if (app.pagamento_stato === 'pagato') {
      console.log(`[SMS 1h] Saltato ${nome} — ha già pagato online`);
      continue;
    }

    try {
      await inviaPromemoria1Ora(app);
      console.log(`[SMS 1h] Inviato a ${nome}`);
    } catch (e) {
      console.error(`[SMS 1h] Errore ${nome}: ${e.message}`);
    }
    inviaWhatsappPromemoria1Ora(app).catch(e => console.error(`[WhatsApp 1h] Errore ${nome}: ${e.message}`));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// INVITO A LASCIARE UNA RECENSIONE SU GOOGLE
//
// Il giorno dopo l'esame parte un SMS con il link alla recensione. Chiediamo
// SOLO a chi l'esame l'ha davvero fatto: lo stato 'refertato' è il segnale
// affidabile (il referto è stato consegnato). Chi non si è presentato, ha
// disdetto o è ancora 'prenotato' non viene contattato.
//
// Si attiva impostando su Railway:
//   SMS_RECENSIONE = true
//   GOOGLE_REVIEW_URL = https://g.page/r/.../review
// Senza queste due variabili la funzione non fa nulla.
// ═══════════════════════════════════════════════════════════════════════════

// Diversamente dai promemoria, l'invito alla recensione va anche a chi ha
// pagato online: sono i pazienti più soddisfatti, escluderli sarebbe un
// autogol. Resta valida la spunta "Invia SMS" del singolo appuntamento.
async function inviaRichiesteRecensione() {
  if (process.env.SMS_RECENSIONE !== 'true') return;

  if (!process.env.GOOGLE_REVIEW_URL) {
    console.warn('[SMS Recensione] GOOGLE_REVIEW_URL non impostata — niente invii.');
    return;
  }

  // Finestra: la giornata di ieri
  const ieri = new Date();
  ieri.setDate(ieri.getDate() - 1);
  ieri.setHours(0, 0, 0, 0);
  const oggi = new Date(ieri);
  oggi.setDate(oggi.getDate() + 1);

  const { data, error } = await supabase
    .from('appuntamenti')
    .select('*, pazienti(*), tipi_prestazione(*)')
    .eq('stato', 'refertato')
    .is('sms_recensione_at', null)
    .gte('data_ora_inizio', ieri.toISOString())
    .lt('data_ora_inizio', oggi.toISOString());

  if (error) {
    console.error('[SMS Recensione] Errore lettura appuntamenti:', error.message);
    return;
  }
  if (!data || data.length === 0) {
    console.log('[SMS Recensione] Nessun esame refertato ieri. Nessun invito.');
    return;
  }

  console.log(`[SMS Recensione] ${data.length} esami refertati ieri.`);

  let inviati = 0, saltati = 0, errori = 0;

  for (const app of data) {
    const nome = app.pazienti ? `${app.pazienti.nome} ${app.pazienti.cognome}` : app.id;

    if (!app.pazienti?.telefono) {
      console.log(`  [SALTATO] ${nome} — nessun numero di telefono`);
      saltati++;
      continue;
    }
    if (app.invia_sms_promemoria === false) {
      console.log(`  [SALTATO] ${nome} — SMS disattivati per questo appuntamento`);
      saltati++;
      continue;
    }

    try {
      const result = await inviaRichiestaRecensione(app);
      // Segniamo subito: se il server si riavvia, nessuno riceve il doppione.
      await supabase
        .from('appuntamenti')
        .update({ sms_recensione_at: new Date().toISOString() })
        .eq('id', app.id);
      console.log(`  [OK] ${nome} → ${result.numero}`);
      inviati++;
    } catch (e) {
      console.error(`  [ERRORE] ${nome} → ${e.message}`);
      errori++;
    }
    inviaWhatsappRecensione(app).catch(e => console.error(`  [WhatsApp ERRORE] ${nome} → ${e.message}`));
  }

  console.log(`[SMS Recensione] Fine — Inviati: ${inviati}, Saltati: ${saltati}, Errori: ${errori}`);
  return { ok: true, inviati, saltati, errori, totale: data.length };
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

  // Etichetta generica: nell'agenda si vede che lo slot è occupato/non
  // prenotabile, ma NON i dettagli privati dell'impegno (titolo nascosto).
  const inserisciBlocco = async (inizio, fine, tuttoIlGiorno) => {
    const { error } = await supabase.from('blocchi_agenda').insert({
      data_ora_inizio: inizio,
      data_ora_fine:   fine,
      motivo:          'Indisponibile',
      tipo:            'google_calendar',
      tutto_il_giorno: tuttoIlGiorno,
    });
    return !error;
  };

  let inseriti = 0;
  for (const ev of eventi) {
    const tuttoIlGiorno = !!(ev.start?.date && !ev.start?.dateTime);

    if (tuttoIlGiorno) {
      // Evento "tutto il giorno": end.date è ESCLUSIVO in Google. Se copre più
      // giorni va spezzato in un blocco per ciascun giorno, altrimenti l'agenda
      // mostrerebbe chiuso solo il primo giorno (il blocco-giornata si disegna
      // sul giorno in cui il blocco inizia).
      const startStr = ev.start.date;
      let endStr = ev.end?.date;
      if (!endStr) {
        const t = new Date(startStr + 'T00:00:00.000Z');
        t.setUTCDate(t.getUTCDate() + 1);
        endStr = t.toISOString().slice(0, 10);
      }
      const cursore = new Date(startStr + 'T00:00:00.000Z');
      const fineEsclusiva = new Date(endStr + 'T00:00:00.000Z');
      while (cursore < fineEsclusiva) {
        const dayStr = cursore.toISOString().slice(0, 10);
        if (await inserisciBlocco(dayStr + 'T00:00:00.000Z', dayStr + 'T23:59:59.000Z', true)) {
          inseriti++;
        }
        cursore.setUTCDate(cursore.getUTCDate() + 1);
      }
    } else {
      // Evento a orario: un solo blocco
      if (await inserisciBlocco(ev.start.dateTime, ev.end.dateTime, false)) {
        inseriti++;
      }
    }
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

  // Ogni giorno alle 11:00 → invito alla recensione per gli esami di ieri.
  // Le 11:00 sono un buon momento: la giornata è iniziata, il paziente ha in
  // mente l'esame del giorno prima e non è né troppo presto né sera tardi.
  cron.schedule('0 11 * * *', () => {
    inviaRichiesteRecensione().catch(e =>
      console.error('[SMS Recensione] Errore:', e.message)
    );
  }, { timezone: 'Europe/Rome' });

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

  console.log('[SMS Reminder] Cron job attivi — 19:00 SMS + 1h prima + recensione 11:00 + sync GCal ogni 30min + GBP ogni 30min (Europe/Rome)');

  // All'avvio: popola festività anno corrente e prossimo se non già presenti
  const annoOra = new Date().getFullYear();
  popolaFestivita(annoOra).catch(e => console.error('[Festività avvio]', e.message));
  popolaFestivita(annoOra + 1).catch(e => console.error('[Festività avvio]', e.message));
}

module.exports = { avviaReminder, inviaPromemoriDomani, inviaRichiesteRecensione };
