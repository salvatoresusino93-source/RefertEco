// ═══════════════════════════════════════════════════════════════════════════
// GOOGLE CALENDAR — Sincronizzazione appuntamenti e blocchi
// Usa Service Account + JWT (no googleapis package, solo jsonwebtoken + fetch)
// ═══════════════════════════════════════════════════════════════════════════

const jwt = require('jsonwebtoken');

// ─── Carica credenziali da variabile d'ambiente ───────────────────────────
function getCreds() {
  const raw = process.env.GOOGLE_PRIVATE_KEY;
  if (!raw) return null;

  // Supporta sia JSON completo (intero file service account) sia solo private key
  try {
    const json = JSON.parse(raw);
    return {
      clientEmail: json.client_email || process.env.GOOGLE_CLIENT_EMAIL,
      privateKey:  json.private_key,
      calendarId:  process.env.GOOGLE_CALENDAR_ID || json.client_email,
    };
  } catch {
    // raw è solo la chiave privata PEM
    return {
      clientEmail: process.env.GOOGLE_CLIENT_EMAIL,
      privateKey:  raw.replace(/\\n/g, '\n'),
      calendarId:  process.env.GOOGLE_CALENDAR_ID,
    };
  }
}

// ─── Ottieni access token Google (service account JWT flow) ───────────────
async function getAccessToken() {
  const creds = getCreds();
  if (!creds?.privateKey || !creds?.clientEmail) {
    throw new Error('Credenziali Google Calendar non configurate (GOOGLE_PRIVATE_KEY, GOOGLE_CLIENT_EMAIL)');
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss:   creds.clientEmail,
    scope: 'https://www.googleapis.com/auth/calendar',
    aud:   'https://oauth2.googleapis.com/token',
    exp:   now + 3600,
    iat:   now,
  };

  const assertion = jwt.sign(payload, creds.privateKey, { algorithm: 'RS256' });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`Google token error: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

// ─── Formato data/ora per Google Calendar (ISO 8601 con timezone) ─────────
function gCalDateTime(iso) {
  return { dateTime: iso, timeZone: 'Europe/Rome' };
}

// ─── Crea evento su Google Calendar ──────────────────────────────────────
async function creaEvento(appuntamento) {
  const creds = getCreds();
  if (!creds) return null;

  const token   = await getAccessToken();
  const calId   = encodeURIComponent(creds.calendarId);
  const paziente = appuntamento.pazienti;
  const esame    = appuntamento.tipi_prestazione?.nome || 'Visita';

  const summary = paziente
    ? `🏥 ${esame} — ${paziente.cognome} ${paziente.nome}`
    : `🏥 ${esame}`;

  const event = {
    summary,
    description: paziente
      ? `Tel: ${paziente.telefono || '—'}\nPrenotato da Agenda Studio`
      : 'Prenotato da Agenda Studio',
    start: gCalDateTime(appuntamento.data_ora_inizio),
    end:   gCalDateTime(appuntamento.data_ora_fine),
    colorId: '2', // verde
    extendedProperties: {
      private: { agendaStudioId: String(appuntamento.id) }
    },
  };

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calId}/events`,
    {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    }
  );

  const data = await res.json();
  if (!res.ok) throw new Error(`Google Calendar crea errore: ${JSON.stringify(data)}`);
  return data.id; // Google Calendar event ID
}

// ─── Elimina evento da Google Calendar ───────────────────────────────────
async function eliminaEvento(googleEventId) {
  if (!googleEventId) return;
  const creds = getCreds();
  if (!creds) return;

  const token = await getAccessToken();
  const calId = encodeURIComponent(creds.calendarId);

  await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calId}/events/${googleEventId}`,
    {
      method:  'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }
  );
}

// ─── Aggiorna evento su Google Calendar ──────────────────────────────────
async function aggiornaEvento(googleEventId, appuntamento) {
  if (!googleEventId) return creaEvento(appuntamento);
  const creds = getCreds();
  if (!creds) return;

  const token   = await getAccessToken();
  const calId   = encodeURIComponent(creds.calendarId);
  const paziente = appuntamento.pazienti;
  const esame    = appuntamento.tipi_prestazione?.nome || 'Visita';

  const summary = paziente
    ? `🏥 ${esame} — ${paziente.cognome} ${paziente.nome}`
    : `🏥 ${esame}`;

  const event = {
    summary,
    start: gCalDateTime(appuntamento.data_ora_inizio),
    end:   gCalDateTime(appuntamento.data_ora_fine),
  };

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calId}/events/${googleEventId}`,
    {
      method:  'PATCH',
      headers: {
        Authorization:  `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    }
  );

  if (!res.ok) {
    const data = await res.json();
    throw new Error(`Google Calendar aggiorna errore: ${JSON.stringify(data)}`);
  }
}

// ─── Leggi eventi personali da Google Calendar (per blocchi agenda) ───────
// Restituisce eventi NON creati da Agenda Studio (= impegni personali del medico)
async function leggiEventiPersonali(da, a) {
  const creds = getCreds();
  if (!creds) return [];

  const token = await getAccessToken();
  const calId = encodeURIComponent(creds.calendarId);

  const params = new URLSearchParams({
    timeMin:      da,
    timeMax:      a,
    singleEvents: 'true',
    orderBy:      'startTime',
    maxResults:   '250',
  });

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calId}/events?${params}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  const data = await res.json();
  if (!res.ok) throw new Error(`Google Calendar leggi errore: ${JSON.stringify(data)}`);

  // Filtra: tieni solo gli eventi NON creati da Agenda Studio
  return (data.items || []).filter(ev => {
    const agendaId = ev.extendedProperties?.private?.agendaStudioId;
    return !agendaId; // eventi personali del medico
  });
}

module.exports = { creaEvento, eliminaEvento, aggiornaEvento, leggiEventiPersonali, getCreds };
