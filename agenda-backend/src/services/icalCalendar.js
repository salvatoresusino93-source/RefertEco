// ═══════════════════════════════════════════════════════════════════════════
// ICAL CALENDAR — Lettura impegni personali da link iCal segreto (sola lettura)
// Alternativa semplice al service account: basta incollare in
// GOOGLE_CALENDAR_ICAL_URL l'"Indirizzo segreto in formato iCal" del calendario
// Google (Impostazioni calendario → Integra il calendario).
// ═══════════════════════════════════════════════════════════════════════════

const ical = require('node-ical');

// Restituisce true se il link iCal è configurato
function icalConfigurato() {
  return !!process.env.GOOGLE_CALENDAR_ICAL_URL;
}

// ─── Espande gli eventi (incl. ricorrenti) in intervalli occupati ─────────
// Ritorna array di { data_ora_inizio, data_ora_fine } (stringhe ISO) che si
// sovrappongono alla finestra [da, a]. In caso di errore ritorna [].
async function leggiImpegniIcal(daISO, aISO) {
  const url = process.env.GOOGLE_CALENDAR_ICAL_URL;
  if (!url) return [];

  const da = new Date(daISO);
  const a  = new Date(aISO);

  let dati;
  try {
    dati = await ical.async.fromURL(url);
  } catch (e) {
    console.error('[iCal] Lettura calendario fallita:', e.message);
    return [];
  }

  const intervalli = [];

  const overlapsWindow = (s, e) => s.getTime() < a.getTime() && e.getTime() > da.getTime();
  const pushInterval = (s, e) => {
    if (!s || !e) return;
    if (overlapsWindow(s, e)) {
      intervalli.push({ data_ora_inizio: s.toISOString(), data_ora_fine: e.toISOString() });
    }
  };

  for (const key of Object.keys(dati)) {
    const ev = dati[key];
    if (!ev || ev.type !== 'VEVENT') continue;
    // Eventi marcati "Disponibile" o annullati non bloccano l'agenda
    if (String(ev.transparency).toUpperCase() === 'TRANSPARENT') continue;
    if (String(ev.status).toUpperCase() === 'CANCELLED') continue;
    if (!ev.start || !ev.end) continue;

    const durataMs = new Date(ev.end).getTime() - new Date(ev.start).getTime();

    // ── Evento ricorrente ──────────────────────────────────────────────
    if (ev.rrule) {
      let occorrenze = [];
      try {
        // Margine di un giorno per coprire eventi a cavallo dei bordi
        const after  = new Date(da.getTime() - 24 * 3600 * 1000);
        const before = new Date(a.getTime()  + 24 * 3600 * 1000);
        occorrenze = ev.rrule.between(after, before, true);
      } catch (e) {
        console.error('[iCal] Espansione ricorrenza fallita:', e.message);
      }

      // Date escluse (EXDATE) e istanze modificate (overrides)
      const exdate = ev.exdate || {};
      const overrides = ev.recurrences || {};

      for (const occ of occorrenze) {
        const dayKey = occ.toISOString().slice(0, 10);
        if (exdate[dayKey]) continue; // occorrenza cancellata

        const ov = overrides[dayKey];
        if (ov) {
          // Istanza modificata: usa i suoi orari
          if (String(ov.transparency).toUpperCase() === 'TRANSPARENT') continue;
          if (String(ov.status).toUpperCase() === 'CANCELLED') continue;
          pushInterval(new Date(ov.start), new Date(ov.end));
        } else {
          const s = new Date(occ);
          const e = new Date(occ.getTime() + durataMs);
          pushInterval(s, e);
        }
      }
      continue;
    }

    // ── Evento singolo ─────────────────────────────────────────────────
    pushInterval(new Date(ev.start), new Date(ev.end));
  }

  return intervalli;
}

module.exports = { leggiImpegniIcal, icalConfigurato };
