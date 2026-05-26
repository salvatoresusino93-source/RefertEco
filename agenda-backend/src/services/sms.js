// ═══════════════════════════════════════════════════════════════════════════
// SERVIZIO SMS — Twilio
// ═══════════════════════════════════════════════════════════════════════════

const twilio = require('twilio');

const SID    = process.env.TWILIO_ACCOUNT_SID;
const TOKEN  = process.env.TWILIO_AUTH_TOKEN;
const FROM   = process.env.TWILIO_PHONE_NUMBER;
const STUDIO = process.env.STUDIO_NOME  || 'Studio Medico';
const TEL    = process.env.STUDIO_TELEFONO || '';

let client = null;

function getClient() {
  if (!client && SID && TOKEN) {
    client = twilio(SID, TOKEN);
  }
  return client;
}

// ─── Normalizza numero italiano → formato E.164 (+39XXXXXXXXXX) ───────────
function normalizzaNumero(tel) {
  if (!tel) return null;
  // Rimuovi spazi, trattini, punti
  let n = tel.replace(/[\s\-\.]/g, '');
  // Già in formato internazionale
  if (n.startsWith('+39')) return n;
  if (n.startsWith('0039')) return '+39' + n.slice(4);
  // Numero mobile italiano (inizia con 3) o fisso (0...)
  if (n.startsWith('3') && n.length >= 9) return '+39' + n;
  if (n.startsWith('0') && n.length >= 8)  return '+39' + n;
  return null;
}

// ─── Formatta data in italiano (es. "sabato 24 maggio") ──────────────────
function fmtData(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long',
    timeZone: 'Europe/Rome'
  });
}

// ─── Formatta ora (es. "10:30") ───────────────────────────────────────────
function fmtOra(iso) {
  return new Date(iso).toLocaleTimeString('it-IT', {
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Rome'
  });
}

// ─── Invia un singolo SMS di promemoria ──────────────────────────────────
async function inviaPromemoria(appuntamento) {
  const c = getClient();
  if (!c) throw new Error('Twilio non configurato (credenziali mancanti)');

  const p = appuntamento.pazienti;
  if (!p) throw new Error('Dati paziente mancanti');

  const numero = normalizzaNumero(p.telefono);
  if (!numero) throw new Error(`Numero non valido: "${p.telefono}"`);

  const data  = fmtData(appuntamento.data_ora_inizio);
  const ora   = fmtOra(appuntamento.data_ora_inizio);
  const esame = appuntamento.tipi_prestazione?.nome || 'visita';
  const nome  = `${p.nome} ${p.cognome}`;

  const testo =
    `Gentile ${nome}, le ricordiamo il suo appuntamento ` +
    `di domani ${data} alle ore ${ora} ` +
    `(${esame}) ` +
    `presso il ${STUDIO}.` +
    (TEL ? ` Per info: ${TEL}.` : '');

  const msg = await c.messages.create({
    body: testo,
    from: FROM,
    to:   numero,
  });

  return { sid: msg.sid, numero, testo };
}

// ─── SMS conferma prenotazione (inviato subito al momento della prenotazione) ─
async function inviaSmsConferma(appuntamento) {
  const c = getClient();
  if (!c) throw new Error('Twilio non configurato (credenziali mancanti)');

  const p = appuntamento.pazienti;
  if (!p) throw new Error('Dati paziente mancanti');

  const numero = normalizzaNumero(p.telefono);
  if (!numero) throw new Error(`Numero non valido: "${p.telefono}"`);

  const data  = fmtData(appuntamento.data_ora_inizio);
  const ora   = fmtOra(appuntamento.data_ora_inizio);
  const esame = appuntamento.tipi_prestazione?.nome || 'visita';
  const nome  = `${p.nome} ${p.cognome}`;

  const testo =
    `Gentile ${nome}, la sua prenotazione è confermata: ` +
    `${data} alle ore ${ora} (${esame}) ` +
    `presso il ${STUDIO}.` +
    (TEL ? ` Per info: ${TEL}.` : '');

  const msg = await c.messages.create({ body: testo, from: FROM, to: numero });
  return { sid: msg.sid, numero, testo };
}

// ─── SMS annullamento appuntamento ───────────────────────────────────────
async function inviaSmsAnnullamento(appuntamento) {
  const c = getClient();
  if (!c) throw new Error('Twilio non configurato (credenziali mancanti)');

  const p = appuntamento.pazienti;
  if (!p) throw new Error('Dati paziente mancanti');

  const numero = normalizzaNumero(p.telefono);
  if (!numero) throw new Error(`Numero non valido: "${p.telefono}"`);

  const data  = fmtData(appuntamento.data_ora_inizio);
  const ora   = fmtOra(appuntamento.data_ora_inizio);
  const nome  = `${p.nome} ${p.cognome}`;

  const testo =
    `Gentile ${nome}, il suo appuntamento del ${data} alle ore ${ora} ` +
    `è stato annullato.` +
    (TEL ? ` Per info o nuova prenotazione: ${TEL}.` : '');

  const msg = await c.messages.create({ body: testo, from: FROM, to: numero });
  return { sid: msg.sid, numero, testo };
}

module.exports = { inviaPromemoria, inviaSmsConferma, inviaSmsAnnullamento, normalizzaNumero };
