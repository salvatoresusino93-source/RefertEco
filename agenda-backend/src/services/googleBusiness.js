// ═══════════════════════════════════════════════════════════════════════════
// GOOGLE BUSINESS PROFILE — Aggiornamento automatico orari apertura
//
// Logica:
//  • Orari base: Martedì e Venerdì 9:00-13:00 e 15:00-19:00
//  • Festivi (blocchi_agenda tipo='festivo'): mostra chiuso
//  • Impegni personali su Google Calendar: riduce orari apertura
//  • Ogni domenica sera (cron) aggiorna specialHours per i prossimi 30 gg
//
// Richiede variabili d'ambiente:
//   GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET,
//   GOOGLE_OAUTH_REFRESH_TOKEN, (opz.) GBP_LOCATION_NAME
// ═══════════════════════════════════════════════════════════════════════════

const supabase = require('./supabase');
const { leggiEventiPersonali } = require('./googleCalendar');

// ─── Orari base (lunedì–venerdì) ─────────────────────────────────────────
// Slot in minuti dal mezzanotte
const SLOT_BASE = [
  { start:  9 * 60,      end: 12 * 60 + 30 }, // 09:00–12:30
  { start: 15 * 60,      end: 19 * 60 },       // 15:00–19:00
];
const GIORNI_APERTI = new Set([1, 2, 3, 4, 5]); // 0=dom 1=lun 2=mar 3=mer 4=gio 5=ven 6=sab

// Indisponibilità inserite dall'agenda (tabella `indisponibilita`).
// Fasce in minuti dal mezzanotte — devono coprire interamente gli slot base.
const FASCE_INDISPONIBILITA = {
  mattina:    { inizio:  8 * 60, fine: 14 * 60 },
  pomeriggio: { inizio: 14 * 60, fine: 20 * 60 },
  giornata:   { inizio:  8 * 60, fine: 20 * 60 },
};

// Memorizza l'ultimo payload inviato a Google: se ricalcolando esce identico
// evitiamo di riscrivere su Google (la funzione gira ogni 30 min).
let _ultimoPayloadGBP = null;

// ─── Genera URL autorizzazione OAuth2 ────────────────────────────────────
function generaAuthUrl() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) throw new Error('GOOGLE_OAUTH_CLIENT_ID non configurato');

  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI ||
    'https://beautiful-surprise.up.railway.app/api/gbp/callback';

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope:         'https://www.googleapis.com/auth/business.manage',
    access_type:   'offline',
    prompt:        'consent',       // forza sempre il refresh_token
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

// ─── Scambia authorization code → access + refresh token ─────────────────
async function scambiaCodePerToken(code) {
  const clientId    = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI ||
    'https://beautiful-surprise.up.railway.app/api/gbp/callback';

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      redirect_uri:  redirectUri,
      code,
      grant_type: 'authorization_code',
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`OAuth2 token exchange error: ${JSON.stringify(data)}`);
  return data; // { access_token, refresh_token, expires_in, ... }
}

// ─── Rinnova access token con refresh token ───────────────────────────────
async function refreshAccessToken() {
  const clientId     = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'OAuth2 GBP non configurato — mancano: ' +
      [!clientId && 'GOOGLE_OAUTH_CLIENT_ID',
       !clientSecret && 'GOOGLE_OAUTH_CLIENT_SECRET',
       !refreshToken && 'GOOGLE_OAUTH_REFRESH_TOKEN']
        .filter(Boolean).join(', ')
    );
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`OAuth2 refresh error: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

// ─── Scopri il nome location GBP (cached in GBP_LOCATION_NAME) ───────────
async function getLocationName(token) {
  if (process.env.GBP_LOCATION_NAME) return process.env.GBP_LOCATION_NAME;

  // 1) lista account
  const resAcc = await fetch(
    'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const accData = await resAcc.json();
  if (!resAcc.ok || !accData.accounts?.length) {
    throw new Error(`GBP accounts error: ${JSON.stringify(accData)}`);
  }
  const accountName = accData.accounts[0].name; // "accounts/XXXXXXXXX"

  // 2) lista locations
  const resLoc = await fetch(
    `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const locData = await resLoc.json();
  if (!resLoc.ok || !locData.locations?.length) {
    throw new Error(`GBP locations error: ${JSON.stringify(locData)}`);
  }

  const loc = locData.locations[0];
  console.log(`[GBP] Location trovata: ${loc.name} — "${loc.title || ''}"`);
  console.log(`[GBP] ✏️  Aggiungi su Railway: GBP_LOCATION_NAME=${loc.name}`);
  return loc.name; // "locations/XXXXXXXXXXXXXXXXXX"
}

// ─── Legge gli orari attualmente registrati su Google ────────────────────
// Serve a verificare cosa Google ha effettivamente accettato/salvato.
async function leggiOrari() {
  const token        = await refreshAccessToken();
  const locationName = await getLocationName(token);

  const res = await fetch(
    `https://mybusinessbusinessinformation.googleapis.com/v1/${locationName}?readMask=title,regularHours,specialHours`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`GBP leggiOrari error: ${JSON.stringify(data)}`);
  }
  return {
    location:     locationName,
    title:        data.title || null,
    regularHours: data.regularHours || null,
    specialHours: data.specialHours || null,
  };
}

// ─── Imposta orari settimanali base (da eseguire una volta) ──────────────
async function impostaOrariBase() {
  const token        = await refreshAccessToken();
  const locationName = await getLocationName(token);

  const days = [
    ['MONDAY', 'MONDAY'], ['TUESDAY', 'TUESDAY'], ['WEDNESDAY', 'WEDNESDAY'],
    ['THURSDAY', 'THURSDAY'], ['FRIDAY', 'FRIDAY'],
  ];
  const body = {
    regularHours: {
      periods: days.flatMap(([open, close]) => [
        { openDay: open, openTime: { hours: 9  }, closeDay: close, closeTime: { hours: 13 } },
        { openDay: open, openTime: { hours: 15 }, closeDay: close, closeTime: { hours: 19 } },
      ]),
    },
  };

  const res = await fetch(
    `https://mybusinessbusinessinformation.googleapis.com/v1/${locationName}?updateMask=regularHours`,
    {
      method:  'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`GBP regularHours error: ${JSON.stringify(err)}`);
  }

  console.log('[GBP] ✓ Orari settimanali base impostati (Lunedì–Venerdì: 9-13 e 15-19)');
  return true;
}

// ─── Helper: sottrai intervalli occupati dagli slot aperti ───────────────
// slotsMinuti: [{ start, end }, ...]  (minuti dal mezzanotte)
// eventiMinuti: [{ inizio, fine }, ...]
// Ritorna gli slot residui (filtra via < 30 min)
function sottraiEventi(slotsMinuti, eventiMinuti) {
  let slots = slotsMinuti.map(s => ({ ...s }));

  for (const ev of eventiMinuti) {
    const next = [];
    for (const s of slots) {
      if (ev.fine <= s.start || ev.inizio >= s.end) {
        next.push(s);                                           // nessuna sovrapposizione
      } else {
        if (ev.inizio > s.start) next.push({ start: s.start, end: ev.inizio }); // prima
        if (ev.fine   < s.end)   next.push({ start: ev.fine, end: s.end   }); // dopo
      }
    }
    slots = next;
  }

  return slots.filter(s => s.end - s.start >= 30); // mantieni solo slot ≥ 30 min
}

// ─── Helper: converti minuti → { hours, minutes } (TimeOfDay Google) ─────
function minToTOD(min) {
  return { hours: Math.floor(min / 60), minutes: min % 60 };
}

// ─── Helper: confronta slot residui con base ─────────────────────────────
function slotUgualiBase(residui) {
  if (residui.length !== SLOT_BASE.length) return false;
  return residui.every((s, i) => s.start === SLOT_BASE[i].start && s.end === SLOT_BASE[i].end);
}

// ─── Calcola e aggiorna specialHours su Google Business Profile ───────────
async function aggiornaOreSettimana() {
  console.log(`\n[GBP] ── Aggiornamento orari ─────────────────────────────`);
  console.log(`[GBP] ${new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' })}`);

  // Verifica configurazione OAuth
  if (!process.env.GOOGLE_OAUTH_REFRESH_TOKEN) {
    console.log('[GBP] GOOGLE_OAUTH_REFRESH_TOKEN non configurato — skip.');
    return { ok: false, error: 'OAuth2 non configurato' };
  }

  const adesso = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Rome' }));
  const specialHourPeriods = [];

  for (let i = 1; i <= 30; i++) {
    const g = new Date(adesso);
    g.setDate(adesso.getDate() + i);
    g.setHours(0, 0, 0, 0);

    const dow = g.getDay();
    if (!GIORNI_APERTI.has(dow)) continue; // solo giorni feriali (lun–ven)

    const dateKey = { year: g.getFullYear(), month: g.getMonth() + 1, day: g.getDate() };
    const gFine   = new Date(g); gFine.setHours(23, 59, 59, 999);
    const label   = g.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: '2-digit' });

    // ── Controlla festività ───────────────────────────────────────────────
    const { data: festivi } = await supabase
      .from('blocchi_agenda')
      .select('motivo')
      .eq('tipo', 'festivo')
      .lte('data_ora_inizio', gFine.toISOString())
      .gte('data_ora_fine',   g.toISOString())
      .limit(1);

    if (festivi?.length) {
      console.log(`[GBP]   ${label} — FESTIVO (${festivi[0].motivo})`);
      specialHourPeriods.push({ startDate: dateKey, endDate: dateKey, closed: true });
      continue;
    }

    // ── Leggi impegni personali Google Calendar ───────────────────────────
    let eventiGCal = [];
    try {
      eventiGCal = await leggiEventiPersonali(g.toISOString(), gFine.toISOString());
    } catch (e) {
      console.warn(`[GBP]   ${label} — GCal non disponibile: ${e.message}`);
    }

    // ── Converti eventi GCal in minuti dal mezzanotte (ora italiana) ───────
    const evMin = eventiGCal.map(ev => {
      if (ev.start?.date) return { inizio: 0, fine: 24 * 60 }; // tutto il giorno
      const si = new Date(new Date(ev.start.dateTime).toLocaleString('en-US', { timeZone: 'Europe/Rome' }));
      const fi = new Date(new Date(ev.end.dateTime).toLocaleString('en-US',   { timeZone: 'Europe/Rome' }));
      return {
        inizio: si.getHours() * 60 + si.getMinutes(),
        fine:   fi.getHours() * 60 + fi.getMinutes(),
      };
    });

    // ── Leggi indisponibilità inserite dall'agenda ────────────────────────
    const dataStr = `${dateKey.year}-${String(dateKey.month).padStart(2,'0')}-${String(dateKey.day).padStart(2,'0')}`;
    const { data: indisp } = await supabase
      .from('indisponibilita')
      .select('tipo, motivo')
      .eq('data', dataStr);

    for (const ind of (indisp || [])) {
      const fascia = FASCE_INDISPONIBILITA[ind.tipo];
      if (fascia) evMin.push({ inizio: fascia.inizio, fine: fascia.fine });
    }

    if (!evMin.length) {
      console.log(`[GBP]   ${label} — orari normali`);
      continue; // nessuna eccezione, regularHours è già corretto
    }

    const residui = sottraiEventi(SLOT_BASE, evMin);

    if (!residui.length) {
      console.log(`[GBP]   ${label} — impegni coprono tutto il giorno → CHIUSO`);
      specialHourPeriods.push({ startDate: dateKey, endDate: dateKey, closed: true });
    } else if (slotUgualiBase(residui)) {
      console.log(`[GBP]   ${label} — impegni fuori orario, orari normali`);
    } else {
      // Orari parziali — aggiungi una entry per ogni slot residuo
      const slotsStr = residui
        .map(s => `${minToTOD(s.start).hours}:${String(minToTOD(s.start).minutes).padStart(2,'0')}`
          + `-${minToTOD(s.end).hours}:${String(minToTOD(s.end).minutes).padStart(2,'0')}`)
        .join(', ');
      console.log(`[GBP]   ${label} — orari ridotti: ${slotsStr}`);

      for (const s of residui) {
        specialHourPeriods.push({
          startDate: dateKey,
          endDate:   dateKey,
          openTime:  minToTOD(s.start),
          closeTime: minToTOD(s.end),
          closed:    false,
        });
      }
    }
  }

  console.log(`[GBP] Periodi speciali calcolati: ${specialHourPeriods.length}`);

  // ── Salta la scrittura se nulla è cambiato dall'ultima volta ───────────
  const payloadStr = JSON.stringify(specialHourPeriods);
  if (payloadStr === _ultimoPayloadGBP) {
    console.log('[GBP] Nessuna variazione rispetto all\'ultimo aggiornamento — skip scrittura.');
    return { ok: true, periodi: specialHourPeriods.length, invariato: true };
  }

  // ── Aggiorna Google Business Profile ──────────────────────────────────
  try {
    const token        = await refreshAccessToken();
    const locationName = await getLocationName(token);

    const res = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${locationName}?updateMask=specialHours`,
      {
        method:  'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ specialHours: { specialHourPeriods } }),
      }
    );

    if (!res.ok) {
      const err = await res.json();
      throw new Error(`GBP PATCH error: ${JSON.stringify(err)}`);
    }

    _ultimoPayloadGBP = payloadStr;
    console.log(`[GBP] ✓ specialHours aggiornati — ${specialHourPeriods.length} periodi`);
    return { ok: true, periodi: specialHourPeriods.length };
  } catch (e) {
    console.error(`[GBP] ✗ Errore aggiornamento: ${e.message}`);
    return { ok: false, error: e.message };
  }
}

// ─── Imposta URL prenotazione online su Google Business Profile ───────────
// Usa l'attributo "url_appointment" — visibile come pulsante "Prenota" su Google
async function impostaUrlPrenotazione(bookingUrl) {
  const token        = await refreshAccessToken();
  const locationName = await getLocationName(token); // es. "locations/12345678901234567"

  const body = {
    name:       `${locationName}/attributes`,
    attributes: [
      {
        name:      `${locationName}/attributes/url_appointment`,
        uriValues: [{ uri: bookingUrl }],
      },
    ],
  };

  const res = await fetch(
    `https://mybusinessbusinessinformation.googleapis.com/v1/${locationName}/attributes?attributeMask=url_appointment`,
    {
      method:  'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  const data = await res.json();
  if (!res.ok) throw new Error(`GBP attributes error: ${JSON.stringify(data)}`);

  console.log(`[GBP] ✓ URL prenotazione impostato: ${bookingUrl}`);
  return data;
}

module.exports = {
  leggiOrari,
  aggiornaOreSettimana,
  impostaOrariBase,
  impostaUrlPrenotazione,
  generaAuthUrl,
  scambiaCodePerToken,
  refreshAccessToken,
  getLocationName,
};
