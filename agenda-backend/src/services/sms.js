// ═══════════════════════════════════════════════════════════════════════════
// SERVIZIO SMS — SMS Hosting REST API
// ═══════════════════════════════════════════════════════════════════════════

const crypto   = require('crypto');
const supabase = require('./supabase');

const STUDIO   = process.env.STUDIO_NOME     || 'Studio Medico';
// Recapiti dello studio mostrati ai pazienti negli SMS: fisso + cellulare.
// NB: definiti QUI e non più via STUDIO_TELEFONO — quella variabile su
// Railway contiene ancora il solo vecchio cellulare, e questo valore la
// sovrascrive di proposito. Per cambiare i recapiti in futuro basta
// modificare questa riga (oppure rimettere `process.env.STUDIO_TELEFONO`
// come sorgente, dopo aver aggiornato la variabile su Railway).
const TEL      = '0932 954441 / 339 4028454';
const BASE_URL = process.env.APP_URL    || 'https://referteco-production.up.railway.app';
const SITO     = process.env.STUDIO_SITO || 'studiosusino.it';

// ─── Genera/recupera il link di conferma presenza per un appuntamento ─────
// Usa un token breve salvato su DB (conferma_token) così l'URL nell'SMS resta
// corto. Se il token non esiste ancora, lo crea e lo salva.
async function urlConferma(app) {
  let token = app.conferma_token;
  if (!token) {
    token = crypto.randomBytes(5).toString('base64url'); // ~7 caratteri
    await supabase.from('appuntamenti').update({ conferma_token: token }).eq('id', app.id);
  }
  return `${BASE_URL}/p/${token}`;
}

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

  if (!apiKey || !apiSecret) {
    throw new Error('SMSHOSTING_API_KEY o SMSHOSTING_API_SECRET non impostati');
  }

  // Basic Auth: Base64(apiKey:apiSecret)
  const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');

  // NOTA: 'from' non viene inviato intenzionalmente.
  // I mittenti alfanumerici (es. "DrSusino") richiedono registrazione preventiva
  // presso SMS Hosting. Senza registrazione, viene sostituito da "#RANDOMNUM#"
  // e i messaggi vengono filtrati dagli operatori italiani.
  // Senza 'from', SMS Hosting usa il numero fisso 394390009000, già registrato,
  // con consegna più affidabile sugli operatori italiani (TIM, Vodafone, WindTre).
  const params = new URLSearchParams({
    to:     numero,
    text:   testo,
    isTest: 'false',
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

  const link = await urlConferma(appuntamento);

  // NB: niente tipo di esame — vedi nota in inviaSmsConferma.
  const testo =
    `Promemoria ${STUDIO}: appuntamento domani ${data} ore ${ora}. ` +
    `Conferma o disdici qui: ${link} ` +
    `Info: ${SITO}` +
    (TEL ? ` - ${TEL}` : '');

  const result = await inviaSms(numero, testo);
  return { sid: result.id || 'ok', numero, testo };
}

// ─── SMS promemoria 1 ora prima ───────────────────────────────────────────
async function inviaPromemoria1Ora(appuntamento) {
  const p = appuntamento.pazienti;
  if (!p) throw new Error('Dati paziente mancanti');

  const numero = normalizzaNumero(p.telefono);
  if (!numero) throw new Error(`Numero non valido: "${p.telefono}"`);

  const ora = fmtOra(appuntamento.data_ora_inizio);

  // NB: niente tipo di esame — vedi nota in inviaSmsConferma.
  const testo =
    `PROMEMORIA: Gentile paziente, il suo appuntamento ` +
    `è tra un'ora, alle ore ${ora} ` +
    `presso lo ${STUDIO}.` +
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

  // NB: niente tipo di esame nel testo — è un dato sanitario (art. 9 GDPR)
  // e l'SMS non è un canale riservato. Stessa scelta per il messaggio
  // WhatsApp equivalente (services/whatsapp.js): i due testi vanno tenuti
  // allineati se si modifica uno dei due.
  const testo =
    `Gentile paziente, la sua prenotazione è confermata: ` +
    `${data} alle ore ${ora} ` +
    `presso lo ${STUDIO}.` +
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

  const testo =
    `Gentile paziente, il suo appuntamento del ${data} alle ore ${ora} ` +
    `è stato annullato.` +
    (TEL ? ` Per info o nuova prenotazione: ${TEL}.` : '');

  const result = await inviaSms(numero, testo);
  return { sid: result.id || 'ok', numero, testo };
}

// ─── SMS invito a lasciare una recensione (il giorno dopo l'esame) ────────
// Testo volutamente corto: un SMS si paga ogni 160 caratteri, e un messaggio
// breve si legge per intero già nell'anteprima della notifica.
async function inviaRichiestaRecensione(appuntamento) {
  const p = appuntamento.pazienti;
  if (!p) throw new Error('Dati paziente mancanti');

  const numero = normalizzaNumero(p.telefono);
  if (!numero) throw new Error(`Numero non valido: "${p.telefono}"`);

  const link = process.env.GOOGLE_REVIEW_URL;
  if (!link) throw new Error('GOOGLE_REVIEW_URL non impostata');

  const testo =
    `${STUDIO}: grazie della visita. ` +
    `Se ti sei trovato bene, una recensione su Google ci aiuta molto: ${link}`;

  if (testo.length > 160) {
    console.warn(
      `[SMS Recensione] Testo di ${testo.length} caratteri: partirà come 2 SMS ` +
      `(costo doppio). Accorcia STUDIO_NOME oppure usa un link più corto.`
    );
  }

  const result = await inviaSms(numero, testo);
  return { sid: result.id || 'ok', numero, testo };
}

module.exports = {
  inviaPromemoria,
  inviaPromemoria1Ora,
  inviaSmsConferma,
  inviaSmsAnnullamento,
  inviaRichiestaRecensione,
  normalizzaNumero,
  urlConferma, // riusata da services/whatsapp.js per lo stesso link di conferma presenza
};
