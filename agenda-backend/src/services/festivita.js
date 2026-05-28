// ═══════════════════════════════════════════════════════════════════════════
// FESTIVITÀ ITALIANE — calcolo e inserimento automatico in blocchi_agenda
// ═══════════════════════════════════════════════════════════════════════════

const supabase = require('./supabase');

// ─── Festività fisse (mese 1-12, giorno 1-31) ────────────────────────────
const FISSI = [
  { mese: 1,  giorno: 1,  nome: 'Capodanno' },
  { mese: 1,  giorno: 6,  nome: 'Epifania' },
  { mese: 4,  giorno: 25, nome: 'Festa della Liberazione' },
  { mese: 5,  giorno: 1,  nome: 'Festa dei Lavoratori' },
  { mese: 6,  giorno: 2,  nome: 'Festa della Repubblica' },
  { mese: 8,  giorno: 15, nome: 'Ferragosto' },
  { mese: 11, giorno: 1,  nome: 'Ognissanti' },
  { mese: 12, giorno: 8,  nome: 'Immacolata Concezione' },
  { mese: 12, giorno: 25, nome: 'Natale' },
  { mese: 12, giorno: 26, nome: 'Santo Stefano' },
];

// ─── Calcolo Pasqua (algoritmo gregoriano anonimo) ──────────────────────
function calcolaPasqua(anno) {
  const a = anno % 19;
  const b = Math.floor(anno / 100);
  const c = anno % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mese   = Math.floor((h + l - 7 * m + 114) / 31);
  const giorno = ((h + l - 7 * m + 114) % 31) + 1;
  return `${anno}-${String(mese).padStart(2, '0')}-${String(giorno).padStart(2, '0')}`;
}

// ─── Aggiunge un giorno a una data YYYY-MM-DD ─────────────────────────────
function addDay(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// ─── Tutte le festività di un anno → array di { dateStr, nome } ──────────
function festivitaAnno(anno) {
  const lista = [];

  for (const f of FISSI) {
    lista.push({
      dateStr: `${anno}-${String(f.mese).padStart(2,'0')}-${String(f.giorno).padStart(2,'0')}`,
      nome: f.nome,
    });
  }

  const pasqua = calcolaPasqua(anno);
  lista.push({ dateStr: pasqua,         nome: 'Pasqua' });
  lista.push({ dateStr: addDay(pasqua), nome: "Lunedì dell'Angelo" });

  return lista;
}

// ─── Popola blocchi_agenda con le festività dell'anno ────────────────────
async function popolaFestivita(anno) {
  const festivita = festivitaAnno(anno);

  // Controlla quali sono già presenti
  const { data: esistenti } = await supabase
    .from('blocchi_agenda')
    .select('motivo')
    .eq('tipo', 'festivo')
    .eq('anno', anno);

  const nomiEsistenti = new Set((esistenti || []).map(r => r.motivo));

  let inseriti = 0;
  let saltati  = 0;

  for (const f of festivita) {
    if (nomiEsistenti.has(f.nome)) { saltati++; continue; }

    // Tutto il giorno in UTC (08:00-20:00 ora italiana rientrano sempre in 00:00Z-23:59Z)
    const { error } = await supabase
      .from('blocchi_agenda')
      .insert({
        data_ora_inizio: `${f.dateStr}T00:00:00.000Z`,
        data_ora_fine:   `${f.dateStr}T23:59:59.000Z`,
        motivo:          f.nome,
        tipo:            'festivo',
        tutto_il_giorno: true,
        anno,
      });

    if (error) {
      console.error(`[Festività] Errore ${f.nome} ${anno}:`, error.message);
    } else {
      inseriti++;
    }
  }

  console.log(`[Festività] Anno ${anno}: ${inseriti} inseriti, ${saltati} già presenti`);
  return { inseriti, saltati };
}

module.exports = { popolaFestivita, festivitaAnno };
