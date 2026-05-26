// ═══════════════════════════════════════════════════════════════════════════
// SERVIZIO SMS — SMS Hosting REST API
// ═══════════════════════════════════════════════════════════════════════════

const STUDIO = process.env.STUDIO_NOME     || 'Studio Medico';
const TEL    = process.env.STUDIO_TELEFONO || '';

// ─── Normalizza numero italiano → formato E.164 (+39XXXXXXXXXX) ───────────
function normalizzaNumero(tel) {
  if (!tel) return null;
  let n = tel.replace(/[\s\-\.]/g, '');
  if (n.startsWith('+39'))  return n;
  if (n.startsWith('0039')) return '+39' + n.slice(4);
  if (n.startsWith('3') && n.length >= 9) return '+39' + n;
  if (n.startsWith('0') && n.length >= 8) return '+39' + n;
  return null;
}

// ─── Formatta data in italiano (es. "sabato 24 maggio") ──────────────────
function fmtData(iso) {
  return new Date(iso).toLocaleDateString('it-IT', {
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

// ─── Invia SMS tramite SMS Hosting ───────────────────────────────────────
async function inviaSms(numero, testo) {
  const apiKey    = process.env.SMSHOSTING_API_KEY;
  const apiSecret = process.env.SMSHOSTING_API_SECRET;
  const sender    = (process.env.SMS_SENDER || 'Studio').slice(0, 11);

  if (!apiKey || !apiSecret) {
    throw new Error('SMSHOSTING_API_KEY o SMSHOSTING_API_SECRET non impostati');
  }

  // Basic Auth: Base64(apiKey:apiSecret)
  const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');

  const params = new URLSearchParams({
    to:   numero,
    text: testo,
    from: sender,
  });

  const res = await fetch('https://api.smshosting.it/rest/api/sms/send', {
    method:  'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type':  'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.status === 'ERROR') {
    throw new Error(`SMS Hosting errore: ${JSON.stringify(json)}`);
  }
  return json;
}

// ─── SMS promemoria (inviato la sera prima dell'appuntamento) ────────────
async function inviaPromemoria(appuntamento) {
  const p = appuntamento.pazienti;
  if (!p) throw new Error('Dati paziente mancanti');

  const numero = normalizzaNumero(p.telefono);
  if (!numero) throw new Error(`Numero non valido: "${p.telefono}"`);

  const data  = fmtData(appuntamento.data_ora_inizio);
  const ora   = fmtOra(appuntamento.data_ora_inizio);
  const esame = appuntamento.tipi_prestazione?.nome || 'visita';
  const nome  = `${p.nome} ${p.cognome}`;

  const testo =
    `PROMEMORIA: Gentile ${nome}, le ricordiamo il suo appuntamento ` +
    `di domani ${data} alle ore ${ora} ` +
    `per ${esame} presso il ${STUDIO}.` +
    (TEL ? ` Per info: ${TEL}.` : '');

  const result = await inviaSms(numero, testo);
  return { sid: result.id || 'ok', numero, testo };
}

// ─── SMS conferma prenotazione ────────────────────────────────────────────
async function inviaSmsConferma(appuntamento) {
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

  const result = await inviaSms(numero, testo);
  return { sid: result.id || 'ok', numero, testo };
}

// ─── SMS annullamento appuntamento ────────────────────────────────────────
async function inviaSmsAnnullamento(appuntamento) {
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

  const result = await inviaSms(numero, testo);
  return { sid: result.id || 'ok', numero, testo };
}

module.exports = { inviaPromemoria, inviaSmsConferma, inviaSmsAnnullamento, normalizzaNumero };
