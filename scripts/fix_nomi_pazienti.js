// Script: normalizza cognome e nome di tutti i pazienti esistenti
// Prima lettera maiuscola di ogni parola, resto minuscolo

require('dotenv').config({ path: require('path').join(__dirname, '../agenda-backend/.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function capitalizeWords(s) {
  if (!s) return s;
  return s.trim().toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
}

async function main() {
  console.log('Caricamento pazienti...');
  const { data: pazienti, error } = await supabase
    .from('pazienti')
    .select('id, cognome, nome');

  if (error) { console.error('Errore:', error.message); process.exit(1); }
  console.log(`Trovati ${pazienti.length} pazienti.\n`);

  let aggiornati = 0, invariati = 0, errori = 0;

  for (const p of pazienti) {
    const nuovoCognome = capitalizeWords(p.cognome);
    const nuovoNome    = capitalizeWords(p.nome);

    if (nuovoCognome === p.cognome && nuovoNome === p.nome) {
      invariati++;
      continue;
    }

    const { error: upErr } = await supabase
      .from('pazienti')
      .update({ cognome: nuovoCognome, nome: nuovoNome })
      .eq('id', p.id);

    if (upErr) {
      console.error(`  [ERRORE] ${p.cognome} ${p.nome}: ${upErr.message}`);
      errori++;
    } else {
      console.log(`  [OK] "${p.cognome} ${p.nome}" → "${nuovoCognome} ${nuovoNome}"`);
      aggiornati++;
    }
  }

  console.log(`\nFine — Aggiornati: ${aggiornati}, Già corretti: ${invariati}, Errori: ${errori}`);
}

main();
