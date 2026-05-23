// ═══════════════════════════════════════════════════════════════════════════
// REMINDER — Cron job promemoria SMS appuntamenti
// Ogni giorno alle 19:00 ora italiana invia SMS per gli appuntamenti
// del giorno successivo
// ═══════════════════════════════════════════════════════════════════════════

const cron    = require('node-cron');
const supabase = require('./supabase');
const { inviaPromemoria } = require('./sms');

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

// ─── Avvia il cron job ───────────────────────────────────────────────────
function avviaReminder() {
  // Ogni giorno alle 19:00 ora italiana (Europe/Rome)
  cron.schedule('0 19 * * *', inviaPromemoriDomani, {
    timezone: 'Europe/Rome'
  });

  console.log('[SMS Reminder] Cron job attivo — invio SMS ogni giorno alle 19:00 (Europe/Rome)');
}

module.exports = { avviaReminder, inviaPromemoriDomani };
