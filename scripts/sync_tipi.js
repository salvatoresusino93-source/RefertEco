// Script per sincronizzare i tipi di prestazione su Supabase
// Eseguire con: node scripts/sync_tipi.js

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(__dirname, '..', 'agenda-backend', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const idx = trimmed.indexOf('=');
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Variabili SUPABASE_URL e SUPABASE_SERVICE_KEY richieste (legge da agenda-backend/.env)');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

// Elenco ridotto per la prenotazione online — esami simili accorpati.
// Esclusi: mammella, ginecologia, ostetricia.
const TIPI = [
  { nome: 'Ecografia addome completo',                         durata_minuti: 30, codice_dicom: 'US_ADDOME' },
  { nome: 'Ecografia addome superiore',                        durata_minuti: 20, codice_dicom: 'US_ADD_SUP' },
  { nome: 'Ecografia addome inferiore',                        durata_minuti: 20, codice_dicom: 'US_ADD_INF' },
  { nome: 'Ecografia apparato urinario',                       durata_minuti: 20, codice_dicom: 'US_APP_URINARIO' },
  { nome: 'Ecografia vescico-prostatica',                      durata_minuti: 20, codice_dicom: 'US_VES_PROS' },
  { nome: 'Ecografia prostatica transrettale',                 durata_minuti: 20, codice_dicom: 'US_PROS_TR' },
  { nome: 'Ecografia scrotale e testicolare',                  durata_minuti: 20, codice_dicom: 'US_SCROTO' },
  { nome: 'Ecografia tiroide',                                 durata_minuti: 20, codice_dicom: 'US_TIROIDE' },
  { nome: 'Ecografia del collo',                               durata_minuti: 20, codice_dicom: 'US_COLLO' },
  { nome: 'Ecografia muscolo-scheletrica',                     durata_minuti: 20, codice_dicom: 'US_MSK' },
  { nome: 'Ecografia spalla',                                  durata_minuti: 20, codice_dicom: 'US_SPALLA' },
  { nome: 'Ecografia ginocchio',                               durata_minuti: 20, codice_dicom: 'US_GINOCCHIO' },
  { nome: 'Ecografia anca',                                    durata_minuti: 20, codice_dicom: 'US_ANCA' },
  { nome: 'Ecografia gomito',                                  durata_minuti: 20, codice_dicom: 'US_GOMITO' },
  { nome: 'Ecografia polso e mano',                            durata_minuti: 20, codice_dicom: 'US_POLSO' },
  { nome: 'Ecografia caviglia e piede',                        durata_minuti: 20, codice_dicom: 'US_CAVIGLIA' },
  { nome: 'Ecografia parti molli',                             durata_minuti: 20, codice_dicom: 'US_PARTI_MOLLI' },
  { nome: 'Ecocolordoppler TSA (tronchi sovra-aortici)',       durata_minuti: 30, codice_dicom: 'DOPPLER_TSA' },
  { nome: 'Ecocolordoppler arti inferiori',                    durata_minuti: 30, codice_dicom: 'DOPPLER_AAII' },
  { nome: 'Ecocolordoppler arti superiori',                    durata_minuti: 30, codice_dicom: 'DOPPLER_AASS' },
  { nome: 'Ecografia linfonodi',                               durata_minuti: 20, codice_dicom: 'US_LINFONODI' },
];

const NOMI_ATTIVI = new Set(TIPI.map(t => t.nome));

function esameEscluso(nome) {
  const n = nome.toLowerCase();
  if (/mammell|mammaria|\bseno\b/.test(n)) return true;
  if (/ginecolog|ostetric|transvagin|pelvic|pelvi femm|gestaz|fetale|nucale|ecocardio fet/.test(n)) return true;
  return false;
}

async function main() {
  console.log('🔄 Lettura tipi esistenti...');
  const { data: esistenti, error: errLet } = await supabase
    .from('tipi_prestazione')
    .select('id, nome, attivo');
  if (errLet) { console.error('❌ Errore lettura:', errLet.message); process.exit(1); }

  const mapNome = new Map(esistenti.map(r => [r.nome, r.id]));
  console.log(`   Trovati ${esistenti.length} tipi esistenti`);

  let aggiornati = 0, inseriti = 0, disattivati = 0, errori = 0;

  for (const tipo of TIPI) {
    if (mapNome.has(tipo.nome)) {
      const { error } = await supabase
        .from('tipi_prestazione')
        .update({ durata_minuti: tipo.durata_minuti, codice_dicom: tipo.codice_dicom, attivo: true })
        .eq('id', mapNome.get(tipo.nome));
      if (error) { console.error(`❌ Update "${tipo.nome}":`, error.message); errori++; }
      else aggiornati++;
    } else {
      const { error } = await supabase
        .from('tipi_prestazione')
        .insert({ ...tipo, attivo: true });
      if (error) { console.error(`❌ Insert "${tipo.nome}":`, error.message); errori++; }
      else inseriti++;
    }
  }

  for (const row of esistenti) {
    const restaAttivo = NOMI_ATTIVI.has(row.nome);
    if (restaAttivo) continue;
    if (!row.attivo && esameEscluso(row.nome)) continue;

    const { error } = await supabase
      .from('tipi_prestazione')
      .update({ attivo: false })
      .eq('id', row.id);
    if (error) { console.error(`❌ Disattiva "${row.nome}":`, error.message); errori++; }
    else disattivati++;
  }

  console.log('');
  console.log('✅ Sincronizzazione completata:');
  console.log(`   - ${inseriti} tipi inseriti`);
  console.log(`   - ${aggiornati} tipi attivi/aggiornati`);
  console.log(`   - ${disattivati} tipi disattivati (non in prenotazione)`);
  console.log(`   - ${TIPI.length} esami prenotabili online`);
  if (errori > 0) console.log(`   - ${errori} errori`);
}

main().catch(e => { console.error('Errore fatale:', e); process.exit(1); });
