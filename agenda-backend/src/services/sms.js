// ═══════════════════════════════════════════════════════════════════════════
// SERVIZIO SMS — Skebby REST API v2
// ═══════════════════════════════════════════════════════════════════════════

const STUDIO = process.env.STUDIO_NOME      || 'Studio Medico';
const TEL    = process.env.STUDIO_TELEFONO  || '';

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

// ─── Autenticazione Skebby → restituisce { userKey, sessionKey } ──────────
async function skebbyAuth() {
  const username = process.env.SKEBBY_USERNAME;
  const password = process.env.SKEBBY_PASSWORD;
  if (!username || !password) throw new Error('SKEBBY_USERNAME o SKEBBY_PASSWORD non impostati');

  const url = `https://api.skebby.it/API/send/smseasy/advanced/json` +
              `?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;

  const res = await fetch(url);
  const txt = await res.text();
  if (!res.ok || !txt.includes(';')) {
    throw new Error(`Skebby auth fallita: ${txt}`);
  }

  const [userKey, sessionKey] = txt.split(';');
  return { userKey: userKey.trim(), sessionKey: sessionKey.trim() };
}

// ─── Invia SMS tramite Skebby ─────────────────────────────────────────────
async function inviaSms(numero, testo) {
  const { userKey, sessionKey } = await skebbyAuth();

  const sender = (process.env.SKEBBY_SENDER || 'Studio').slice(0, 11);

  const body = {
    message:      testo,
    message_type: 'SI',   // Smart Info — permette mittente alfanumerico
    sender,
    recipient: [numero],
  };

  const res = await fetch('https://api.skebby.it/API/send/smseasy/advanced/json', {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      'user_key':     userKey,
      'Session_key':  sessionKey,
    },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.result === 'KO') {
    throw new Error(`Skebby invio fallito: ${JSON.stringify(json)}`);
  }
  return json;
}

// ─── SMS promemoria (inviato la sera prima dall'appuntamento) ────────────
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
    `Gentile ${nome}, le ricordiamo il suo appuntamento ` +
    `di domani ${data} alle ore ${ora} ` +
    `(${esame}) ` +
    `presso il ${STUDIO}.` +
    (TEL ? ` Per info: ${TEL}.` : '');

  const result = await inviaSms(numero, testo);
  return { sid: result.order_id || 'ok', numero, testo };
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
  return { sid: result.order_id || 'ok', numero, testo };
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
  return { sid: result.order_id || 'ok', numero, testo };
}

module.exports = { inviaPromemoria, inviaSmsConferma, inviaSmsAnnullamento, normalizzaNumero };
