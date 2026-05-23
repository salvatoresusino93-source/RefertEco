// Script per sincronizzare i tipi di prestazione su Supabase
// Eseguire con: node scripts/sync_tipi.js

// Carica variabili da agenda-backend/.env se presenti
require('dotenv').config({ path: require('path').join(__dirname, '..', 'agenda-backend', '.env') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Variabili SUPABASE_URL e SUPABASE_SERVICE_KEY richieste (legge da agenda-backend/.env)');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

const TIPI = [
  // ADDOME
  { nome: 'Ecografia addome superiore',                             durata_minuti: 20, codice_dicom: 'US_ADD_SUP' },
  { nome: 'Ecografia addome inferiore',                             durata_minuti: 20, codice_dicom: 'US_ADD_INF' },
  { nome: 'Ecografia addome completo',                              durata_minuti: 30, codice_dicom: 'US_ADDOME' },
  { nome: 'Ecografia epatica',                                      durata_minuti: 20, codice_dicom: 'US_FEGATO' },
  { nome: 'Ecografia epato-biliare',                                durata_minuti: 20, codice_dicom: 'US_EPATO_BIL' },
  { nome: 'Ecografia colecisti e vie biliari',                      durata_minuti: 20, codice_dicom: 'US_COLECISTI' },
  { nome: 'Ecografia pancreatica',                                  durata_minuti: 20, codice_dicom: 'US_PANCREAS' },
  { nome: 'Ecografia splenica',                                     durata_minuti: 15, codice_dicom: 'US_MILZA' },
  { nome: 'Ecografia delle anse intestinali',                       durata_minuti: 20, codice_dicom: 'US_INTESTINO' },
  { nome: 'Ecografia della parete addominale',                      durata_minuti: 15, codice_dicom: 'US_PARETE_ADD' },
  { nome: 'Eco-CEUS epatica',                                       durata_minuti: 30, codice_dicom: 'CEUS_FEGATO' },
  // APPARATO URINARIO
  { nome: 'Ecografia apparato urinario',                            durata_minuti: 20, codice_dicom: 'US_APP_URINARIO' },
  { nome: 'Ecografia renale',                                       durata_minuti: 20, codice_dicom: 'US_RENE' },
  { nome: 'Ecografia vescicale',                                    durata_minuti: 15, codice_dicom: 'US_VESCICA' },
  { nome: 'Ecografia vescico-prostatica sovrapubica',               durata_minuti: 20, codice_dicom: 'US_VES_PROS' },
  { nome: 'Ecografia prostatica transrettale',                      durata_minuti: 20, codice_dicom: 'US_PROS_TR' },
  { nome: 'Ecografia surrenalica',                                  durata_minuti: 15, codice_dicom: 'US_SURRENE' },
  // COLLO E TIROIDE
  { nome: 'Ecografia tiroide',                                      durata_minuti: 20, codice_dicom: 'US_TIROIDE' },
  { nome: 'Ecografia tiroide e paratiroidi',                        durata_minuti: 20, codice_dicom: 'US_TIROIDE_PT' },
  { nome: 'Ecografia del collo',                                    durata_minuti: 20, codice_dicom: 'US_COLLO' },
  { nome: 'Ecografia linfonodale laterocervicale',                  durata_minuti: 20, codice_dicom: 'US_LINFONODI_CERV' },
  { nome: 'Ecografia ghiandole salivari',                           durata_minuti: 15, codice_dicom: 'US_SALIVARI' },
  { nome: 'Ecografia parotide',                                     durata_minuti: 15, codice_dicom: 'US_PAROTIDE' },
  // GINECOLOGIA E OSTETRICIA
  { nome: 'Ecografia ginecologica sovrapubica',                     durata_minuti: 20, codice_dicom: 'US_GIN_SV' },
  { nome: 'Ecografia ginecologica transvaginale',                   durata_minuti: 20, codice_dicom: 'US_GIN_TV' },
  { nome: 'Ecografia pelvica',                                      durata_minuti: 20, codice_dicom: 'US_PELVI' },
  { nome: 'Ecografia ostetrica I trimestre',                        durata_minuti: 20, codice_dicom: 'US_GEST_1T' },
  { nome: 'Ecografia ostetrica morfologica (II trimestre)',          durata_minuti: 30, codice_dicom: 'US_GEST_2T' },
  { nome: 'Ecografia ostetrica di accrescimento (III trimestre)',    durata_minuti: 20, codice_dicom: 'US_GEST_3T' },
  { nome: 'Ecografia ostetrica con translucenza nucale',            durata_minuti: 30, codice_dicom: 'US_NUCALE' },
  { nome: 'Ecocardiografia fetale',                                 durata_minuti: 40, codice_dicom: 'US_ECOFETALE' },
  // UROLOGIA
  { nome: 'Ecografia scrotale',                                     durata_minuti: 15, codice_dicom: 'US_SCROTO' },
  { nome: 'Ecografia testicolare',                                  durata_minuti: 15, codice_dicom: 'US_TESTICOLO' },
  { nome: 'Ecocolordoppler scrotale',                               durata_minuti: 20, codice_dicom: 'DOPPLER_SCROTO' },
  // MAMMELLA
  { nome: 'Ecografia mammaria monolaterale',                        durata_minuti: 20, codice_dicom: 'US_MAMMELLA_MONO' },
  { nome: 'Ecografia mammaria bilaterale',                          durata_minuti: 30, codice_dicom: 'US_MAMMELLA_BI' },
  { nome: 'Ecografia mammaria con studio ascellare',                durata_minuti: 30, codice_dicom: 'US_MAMMELLA_ASCELL' },
  // MUSCOLO-SCHELETRICO
  { nome: 'Ecografia muscolo-scheletrica',                          durata_minuti: 20, codice_dicom: 'US_MSK' },
  { nome: 'Ecografia muscolo-tendinea',                             durata_minuti: 20, codice_dicom: 'US_MUSC_TEND' },
  { nome: 'Ecografia parti molli',                                  durata_minuti: 20, codice_dicom: 'US_PARTI_MOLLI' },
  { nome: 'Ecografia spalla',                                       durata_minuti: 20, codice_dicom: 'US_SPALLA' },
  { nome: 'Ecografia gomito',                                       durata_minuti: 20, codice_dicom: 'US_GOMITO' },
  { nome: 'Ecografia polso e mano',                                 durata_minuti: 20, codice_dicom: 'US_POLSO' },
  { nome: 'Ecografia anca',                                         durata_minuti: 20, codice_dicom: 'US_ANCA' },
  { nome: 'Ecografia ginocchio',                                    durata_minuti: 20, codice_dicom: 'US_GINOCCHIO' },
  { nome: 'Ecografia caviglia e piede',                             durata_minuti: 20, codice_dicom: 'US_CAVIGLIA' },
  { nome: 'Ecografia anca neonatale',                               durata_minuti: 20, codice_dicom: 'US_ANCA_NEO' },
  { nome: 'Ecografia inguinale',                                    durata_minuti: 15, codice_dicom: 'US_INGUINE' },
  { nome: 'Ecografia cute e sottocute',                             durata_minuti: 15, codice_dicom: 'US_CUTE' },
  // ECOCOLORDOPPLER VASCOLARE
  { nome: 'Ecocolordoppler TSA (tronchi sovraortici)',               durata_minuti: 30, codice_dicom: 'DOPPLER_TSA' },
  { nome: 'Ecocolordoppler aorta addominale',                       durata_minuti: 20, codice_dicom: 'DOPPLER_AORTA' },
  { nome: 'Ecocolordoppler arterioso arti inferiori',               durata_minuti: 30, codice_dicom: 'DOPPLER_ART_AAII' },
  { nome: 'Ecocolordoppler venoso arti inferiori',                  durata_minuti: 30, codice_dicom: 'DOPPLER_VEN_AAII' },
  { nome: 'Ecocolordoppler arterioso arti superiori',               durata_minuti: 30, codice_dicom: 'DOPPLER_ART_AASS' },
  { nome: 'Ecocolordoppler venoso arti superiori',                  durata_minuti: 30, codice_dicom: 'DOPPLER_VEN_AASS' },
  { nome: 'Ecocolordoppler arterie renali',                         durata_minuti: 30, codice_dicom: 'DOPPLER_RENALE' },
  { nome: 'Ecocolordoppler circolo portale',                        durata_minuti: 20, codice_dicom: 'DOPPLER_PORTALE' },
  { nome: 'Ecocolordoppler penieno',                                durata_minuti: 20, codice_dicom: 'DOPPLER_PENIENO' },
  { nome: 'Ecocolordoppler transcranico',                           durata_minuti: 30, codice_dicom: 'DOPPLER_TCD' },
  { nome: 'Ecocolordoppler vasi mesenterici',                       durata_minuti: 20, codice_dicom: 'DOPPLER_MESENT' },
  // ALTRO
  { nome: 'Ecografia torace e pleura',                              durata_minuti: 20, codice_dicom: 'US_TORACE' },
  { nome: 'Ecografia polmonare (LUS)',                              durata_minuti: 20, codice_dicom: 'US_POLMONE' },
  { nome: 'Ecografia linfonodi',                                    durata_minuti: 20, codice_dicom: 'US_LINFONODI' },
  { nome: 'Ecografia oculare',                                      durata_minuti: 20, codice_dicom: 'US_OCCHIO' },
  { nome: 'Ecografia al letto (POCUS)',                             durata_minuti: 15, codice_dicom: 'POCUS' },
  { nome: 'Ecografia intraoperatoria',                              durata_minuti: 20, codice_dicom: 'US_INTRAOP' },
  { nome: 'Ecografia interventistica (guida biopsia/drenaggio)',    durata_minuti: 30, codice_dicom: 'US_INTERVENTISTICA' },
];

async function main() {
  console.log('🔄 Lettura tipi esistenti...');
  const { data: esistenti, error: errLet } = await supabase
    .from('tipi_prestazione')
    .select('id, nome');
  if (errLet) { console.error('❌ Errore lettura:', errLet.message); process.exit(1); }

  const mapNome = new Map(esistenti.map(r => [r.nome, r.id]));
  console.log(`   Trovati ${esistenti.length} tipi esistenti`);

  let aggiornati = 0, inseriti = 0, errori = 0;

  for (const tipo of TIPI) {
    if (mapNome.has(tipo.nome)) {
      // Aggiorna durata e codice_dicom
      const { error } = await supabase
        .from('tipi_prestazione')
        .update({ durata_minuti: tipo.durata_minuti, codice_dicom: tipo.codice_dicom })
        .eq('id', mapNome.get(tipo.nome));
      if (error) { console.error(`❌ Update "${tipo.nome}":`, error.message); errori++; }
      else aggiornati++;
    } else {
      // Inserisci nuovo
      const { error } = await supabase
        .from('tipi_prestazione')
        .insert(tipo);
      if (error) { console.error(`❌ Insert "${tipo.nome}":`, error.message); errori++; }
      else inseriti++;
    }
  }

  // Rimuovi i vecchi tipi con nomi diversi che non sono più nella lista
  const nomiNuovi = new Set(TIPI.map(t => t.nome));
  const daEliminare = esistenti.filter(r => !nomiNuovi.has(r.nome));
  let eliminati = 0;
  for (const old of daEliminare) {
    // Controlla se è usato in qualche appuntamento
    const { count } = await supabase
      .from('appuntamenti')
      .select('id', { count: 'exact', head: true })
      .eq('tipo_id', old.id);
    if (count > 0) {
      console.log(`⚠️  "${old.nome}" usato in ${count} appuntamenti — mantenuto`);
    } else {
      const { error } = await supabase.from('tipi_prestazione').delete().eq('id', old.id);
      if (!error) eliminati++;
    }
  }

  console.log('');
  console.log('✅ Sincronizzazione completata:');
  console.log(`   - ${inseriti} tipi inseriti`);
  console.log(`   - ${aggiornati} tipi aggiornati`);
  console.log(`   - ${eliminati} vecchi tipi rimossi`);
  if (errori > 0) console.log(`   - ${errori} errori`);
}

main().catch(e => { console.error('Errore fatale:', e); process.exit(1); });
