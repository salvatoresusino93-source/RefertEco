// ═══════════════════════════════════════════════════════════════════════════
// SERVIZIO WHATSAPP — Meta Cloud API (WhatsApp Business Platform)
//
// Accesso diretto a Meta, senza rivenditori (Twilio, ecc.): nessun canone
// mensile, si paga solo per messaggio effettivamente consegnato. Va in
// AGGIUNTA all'SMS (services/sms.js), non lo sostituisce: se l'invio
// WhatsApp fallisce (numero non configurato, non attivo su WhatsApp, ecc.)
// il paziente riceve comunque l'SMS.
//
// Come attivarlo (una tantum, sul pannello Meta for Developers):
//   1. Crea un'app Meta di tipo "Business" su developers.facebook.com,
//      aggiungi il prodotto "WhatsApp".
//   2. Collega un numero dedicato (NON il numero che usi già nell'app
//      WhatsApp Business sul telefono: collegandolo alla Cloud API perdi
//      la possibilità di usarlo nell'app — meglio un numero nuovo).
//   3. Nel pannello del prodotto WhatsApp trovi PHONE_NUMBER_ID (Da) e puoi
//      generare un ACCESS_TOKEN permanente (System User, in Business
//      Settings → System Users → Generate token, permesso whatsapp_business_messaging).
//   4. Crea i modelli (template) elencati sotto in
//      Meta Business Manager → WhatsApp Manager → Modelli di messaggio,
//      categoria UTILITY, lingua Italiano — i nomi e i placeholder {{1}},
//      {{2}}... devono combaciare ESATTAMENTE con quelli usati qui sotto.
//      L'approvazione di Meta richiede da pochi minuti a 1-2 giorni.
//   5. Imposta su Railway: WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN.
//
// Fuori dalla finestra di assistenza di 24 ore (il caso normale: è lo
// studio a scrivere per primo) WhatsApp richiede SEMPRE un messaggio
// "template" pre-approvato — non si può mandare testo libero come con
// l'SMS. Per questo ogni funzione qui sotto invia un template con dei
// parametri, non una stringa qualsiasi.
//
// VINCOLI META SUI TEMPLATE (scoperti creando il primo modello, ago 2026):
// Meta rifiuta un modello che abbia "troppe variabili rispetto alla sua
// lunghezza", e NON permette che il testo inizi o finisca con una
// variabile. Per questo i modelli qui sotto non possono essere identici
// parola per parola all'SMS gemello: usano MENO variabili, con nome dello
// studio e contatti scritti come testo FISSO dentro il modello.
// Conseguenza pratica: se cambiano il nome dello studio, il telefono o il
// sito, NON basta cambiare la variabile d'ambiente — va rifatto e
// riapprovato il modello su Meta.
//
//   promemoria_appuntamento  (gemello: sms.js → inviaPromemoria)
//   ────────────────────────  ✅ APPROVATO/IN USO — 2 variabili
//   Promemoria dello Studio Ecografico Dr. Susino: il Suo appuntamento è
//   domani, {{1}}. Confermi la presenza o disdica cliccando qui: {{2}}
//   Info: studiosusino.it - 351 374 6102.
//      {{1}} = data + ora insieme (es. "venerdì 5 settembre alle ore 10:30")
//      {{2}} = link di conferma presenza (/p/:token)
//   Validità impostata su Meta: 12 ore (il default di 10 minuti è troppo
//   corto: se il paziente ha il telefono spento, il messaggio si perde).
//
// ── I modelli qui sotto NON sono ancora stati creati su Meta ───────────
// Le funzioni che li userebbero esistono ma non sono collegate a nessuna
// route (vedi PR #3: la conferma resta solo SMS). Se un giorno si vorranno
// attivare, vanno prima creati e approvati su Meta RISPETTANDO i vincoli
// descritti sopra — i testi seguenti sono bozze col vecchio formato a più
// variabili e verrebbero probabilmente rifiutati così come sono.
//
//   conferma_prenotazione  (gemello: sms.js → inviaSmsConferma)
//   ──────────────────────  ⚠️ bozza, non creato su Meta
//   Gentile paziente, la sua prenotazione è confermata: {{1}} alle ore
//   {{2}} presso lo {{3}}. Per info: {{4}}.
//
//   promemoria_1ora  (gemello: sms.js → inviaPromemoria1Ora)
//   ─────────────────  ⚠️ bozza, non creato su Meta
//   PROMEMORIA: Gentile paziente, il suo appuntamento è tra un'ora, alle
//   ore {{1}} presso lo {{2}}. Per info: {{3}}.
//
//   richiesta_recensione  (gemello: sms.js → inviaRichiestaRecensione)
//   ──────────────────────  ⚠️ bozza, non creato su Meta
//   {{1}}: grazie della visita. Se ti sei trovato bene, una recensione su
//   Google ci aiuta molto: {{2}}
//
//   annullamento_appuntamento  (gemello: sms.js → inviaSmsAnnullamento —
//   pronto, non ancora collegato a nessuna route, come il suo gemello SMS)
//   ─────────────────────────────────────────  ⚠️ bozza, non creato su Meta
//   Gentile paziente, il suo appuntamento del {{1}} alle ore {{2}} è stato
//   annullato. Per info o nuova prenotazione: {{3}}.
//
// NOTA PRIVACY (decisione presa insieme al Dott. Susino): nessuno dei
// testi sopra nomina il tipo di esame prenotato (dato sanitario, art. 9
// GDPR) — tolto anche dall'SMS per lo stesso motivo. WhatsApp è un canale
// meno "effimero" dell'SMS (chat persistente, backup su cloud del
// telefono), quindi vale la stessa prudenza su entrambi i canali.
// ═══════════════════════════════════════════════════════════════════════════

const { normalizzaNumero, urlConferma } = require('./sms');

const STUDIO   = process.env.STUDIO_NOME     || 'Studio Medico';
const TEL      = process.env.STUDIO_TELEFONO || '';
const SITO     = process.env.STUDIO_SITO     || 'studiosusino.it';
const LINGUA   = process.env.WHATSAPP_LANG   || 'it';

const TEMPLATE_CONFERMA      = process.env.WHATSAPP_TEMPLATE_CONFERMA      || 'conferma_prenotazione';
const TEMPLATE_PROMEMORIA    = process.env.WHATSAPP_TEMPLATE_PROMEMORIA    || 'promemoria_appuntamento';
const TEMPLATE_PROMEMORIA_1H = process.env.WHATSAPP_TEMPLATE_PROMEMORIA_1H || 'promemoria_1ora';
const TEMPLATE_RECENSIONE    = process.env.WHATSAPP_TEMPLATE_RECENSIONE    || 'richiesta_recensione';
const TEMPLATE_ANNULLAMENTO  = process.env.WHATSAPP_TEMPLATE_ANNULLAMENTO  || 'annullamento_appuntamento';

// ─── Formatta data/ora in italiano (stesso formato usato per l'SMS) ──────
function fmtData(iso) {
  return new Date(iso).toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long',
    timeZone: 'Europe/Rome'
  });
}
function fmtOra(iso) {
  return new Date(iso).toLocaleTimeString('it-IT', {
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Rome'
  });
}

// Usata dal promemoria della sera prima (gemello SMS: mostra sito + telefono)
function infoContatto() {
  return TEL ? `${SITO} - ${TEL}` : SITO;
}

// Usata da conferma / promemoria 1h / annullamento (gemelli SMS: mostrano
// SOLO il telefono — "Per info: {TEL}."). Un template Meta non può far
// sparire l'intera frase se manca il valore come fa l'SMS con la stringa
// vuota, quindi qui, solo se STUDIO_TELEFONO non è configurato, ripieghiamo
// sul sito per non lasciare il placeholder vuoto nel messaggio.
function soloTelefono() {
  return TEL || SITO;
}

// ─── Configurato? ──────────────────────────────────────────────────────────
// Come per Resend/SMS Hosting: se le credenziali mancano, l'invio è un
// no-op silenzioso — così il progetto funziona anche senza WhatsApp attivo,
// e attivarlo in futuro è solo questione di impostare le due variabili.
function whatsappConfigurato() {
  return Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN);
}

// ─── Registra il numero sulla Cloud API (da fare UNA VOLTA per numero) ────
// Un numero appena aggiunto/verificato su WhatsApp Manager resta "Non in
// linea" finché non viene registrato con questa chiamata — non esiste un
// pulsante equivalente nell'interfaccia Meta per i numeri Cloud API, va
// fatta così. Il PIN è a scelta libera (6 cifre): serve solo se in futuro
// si deve ri-registrare lo stesso numero, va conservato ma non è mai
// richiesto al paziente né al medico nell'uso normale.
async function registraNumero(pin) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken   = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    throw new Error('WHATSAPP_PHONE_NUMBER_ID o WHATSAPP_ACCESS_TOKEN non impostati');
  }
  if (!/^\d{6}$/.test(String(pin || ''))) {
    throw new Error('Il PIN deve essere di 6 cifre');
  }

  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/register`, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ messaging_product: 'whatsapp', pin: String(pin) }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    throw new Error(`Registrazione numero fallita: ${JSON.stringify(json.error || json)}`);
  }
  return json;
}

// ─── Invia un messaggio template via Meta Cloud API ───────────────────────
async function inviaTemplate(numero, nomeTemplate, parametriTesto) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken   = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    throw new Error('WHATSAPP_PHONE_NUMBER_ID o WHATSAPP_ACCESS_TOKEN non impostati');
  }

  // Meta vuole il numero in formato internazionale SENZA il '+' iniziale.
  const to = numero.replace(/^\+/, '');

  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: nomeTemplate,
      language: { code: LINGUA },
      components: [
        {
          type: 'body',
          parameters: parametriTesto.map(testo => ({ type: 'text', text: String(testo) })),
        },
      ],
    },
  };

  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    // Errori tipici da qui: template non ancora approvato da Meta, numero
    // del paziente non registrato su WhatsApp, finestra/permessi account.
    throw new Error(`WhatsApp errore: ${JSON.stringify(json.error || json)}`);
  }
  return json;
}

// ─── WhatsApp: conferma prenotazione ──────────────────────────────────────
// Pronta ma NON collegata (deciso col Dott. Susino, agosto 2026): la
// conferma resta solo SMS, il WhatsApp è riservato al promemoria della
// sera prima (vedi nota in routes/prenota.js e routes/appuntamenti.js).
async function inviaWhatsappConferma(appuntamento) {
  if (!whatsappConfigurato()) return null; // no-op: WhatsApp non attivo

  const p = appuntamento.pazienti;
  if (!p) throw new Error('Dati paziente mancanti');

  const numero = normalizzaNumero(p.telefono);
  if (!numero) throw new Error(`Numero non valido: "${p.telefono}"`);

  const data = fmtData(appuntamento.data_ora_inizio);
  const ora  = fmtOra(appuntamento.data_ora_inizio);

  const result = await inviaTemplate(numero, TEMPLATE_CONFERMA, [data, ora, STUDIO, soloTelefono()]);
  return { id: result.messages?.[0]?.id || 'ok', numero };
}

// ─── WhatsApp: promemoria (sera prima) ────────────────────────────────────
async function inviaWhatsappPromemoria(appuntamento) {
  if (!whatsappConfigurato()) return null;

  const p = appuntamento.pazienti;
  if (!p) throw new Error('Dati paziente mancanti');

  const numero = normalizzaNumero(p.telefono);
  if (!numero) throw new Error(`Numero non valido: "${p.telefono}"`);

  // Il template Meta ha solo 2 variabili: data+ora unite in una sola, e il
  // link. Nome studio e contatti sono testo fisso nel modello approvato —
  // vedi la nota sui vincoli Meta in cima al file.
  const dataOra = `${fmtData(appuntamento.data_ora_inizio)} alle ore ${fmtOra(appuntamento.data_ora_inizio)}`;
  const link    = await urlConferma(appuntamento);

  const result = await inviaTemplate(numero, TEMPLATE_PROMEMORIA, [dataOra, link]);
  return { id: result.messages?.[0]?.id || 'ok', numero };
}

// ─── WhatsApp: promemoria 1 ora prima ─────────────────────────────────────
async function inviaWhatsappPromemoria1Ora(appuntamento) {
  if (!whatsappConfigurato()) return null;

  const p = appuntamento.pazienti;
  if (!p) throw new Error('Dati paziente mancanti');

  const numero = normalizzaNumero(p.telefono);
  if (!numero) throw new Error(`Numero non valido: "${p.telefono}"`);

  const ora = fmtOra(appuntamento.data_ora_inizio);

  const result = await inviaTemplate(numero, TEMPLATE_PROMEMORIA_1H, [ora, STUDIO, soloTelefono()]);
  return { id: result.messages?.[0]?.id || 'ok', numero };
}

// ─── WhatsApp: annullamento appuntamento ──────────────────────────────────
// Pronta come services/sms.js:inviaSmsAnnullamento, ma non ancora collegata
// da nessuna route (l'equivalente SMS è commentato in appuntamenti.js).
async function inviaWhatsappAnnullamento(appuntamento) {
  if (!whatsappConfigurato()) return null;

  const p = appuntamento.pazienti;
  if (!p) throw new Error('Dati paziente mancanti');

  const numero = normalizzaNumero(p.telefono);
  if (!numero) throw new Error(`Numero non valido: "${p.telefono}"`);

  const data = fmtData(appuntamento.data_ora_inizio);
  const ora  = fmtOra(appuntamento.data_ora_inizio);

  const result = await inviaTemplate(numero, TEMPLATE_ANNULLAMENTO, [data, ora, soloTelefono()]);
  return { id: result.messages?.[0]?.id || 'ok', numero };
}

// ─── WhatsApp: invito a lasciare una recensione ───────────────────────────
async function inviaWhatsappRecensione(appuntamento) {
  if (!whatsappConfigurato()) return null;

  const p = appuntamento.pazienti;
  if (!p) throw new Error('Dati paziente mancanti');

  const numero = normalizzaNumero(p.telefono);
  if (!numero) throw new Error(`Numero non valido: "${p.telefono}"`);

  const link = process.env.GOOGLE_REVIEW_URL;
  if (!link) throw new Error('GOOGLE_REVIEW_URL non impostata');

  const result = await inviaTemplate(numero, TEMPLATE_RECENSIONE, [STUDIO, link]);
  return { id: result.messages?.[0]?.id || 'ok', numero };
}

module.exports = {
  whatsappConfigurato,
  inviaTemplate,   // esposta per l'endpoint di test /api/test-whatsapp
  registraNumero,  // esposta per l'endpoint di attivazione /api/whatsapp/registra-numero
  inviaWhatsappConferma,
  inviaWhatsappPromemoria,
  inviaWhatsappPromemoria1Ora,
  inviaWhatsappAnnullamento,
  inviaWhatsappRecensione,
};
