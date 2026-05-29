-- Disattiva esami non prenotabili online (mammella, ginecologia, ostetricia)
-- e tipi troppo granulari sostituiti da voci accorpate.
-- Eseguire nel SQL Editor di Supabase.

UPDATE tipi_prestazione SET attivo = false WHERE
  nome ILIKE '%mammell%' OR nome ILIKE '%mammaria%' OR nome ILIKE '% seno%'
  OR nome ILIKE '%ginecolog%' OR nome ILIKE '%ostetric%'
  OR nome ILIKE '%transvagin%' OR nome ILIKE '%pelvica%'
  OR nome ILIKE '%pelvi femm%' OR nome ILIKE '%fetale%'
  OR nome ILIKE '%nucale%' OR nome ILIKE '%gestaz%';

-- Attiva solo l'elenco ridotto per la prenotazione online
UPDATE tipi_prestazione SET attivo = true WHERE nome IN (
  'Ecografia addome completo',
  'Ecografia addome superiore',
  'Ecografia addome inferiore',
  'Ecografia apparato urinario',
  'Ecografia vescico-prostatica',
  'Ecografia prostatica transrettale',
  'Ecografia scrotale e testicolare',
  'Ecografia tiroide',
  'Ecografia del collo',
  'Ecografia muscolo-scheletrica',
  'Ecografia spalla',
  'Ecografia ginocchio',
  'Ecografia anca',
  'Ecografia anca neonatale',
  'Ecografia gomito',
  'Ecografia polso e mano',
  'Ecografia caviglia e piede',
  'Ecografia parti molli',
  'Ecocolordoppler TSA (tronchi sovra-aortici)',
  'Ecocolordoppler arti inferiori',
  'Ecocolordoppler arti superiori',
  'Ecografia linfonodi'
);

-- Disattiva tutti gli altri non nell'elenco sopra
UPDATE tipi_prestazione SET attivo = false WHERE nome NOT IN (
  'Ecografia addome completo',
  'Ecografia addome superiore',
  'Ecografia addome inferiore',
  'Ecografia apparato urinario',
  'Ecografia vescico-prostatica',
  'Ecografia prostatica transrettale',
  'Ecografia scrotale e testicolare',
  'Ecografia tiroide',
  'Ecografia del collo',
  'Ecografia muscolo-scheletrica',
  'Ecografia spalla',
  'Ecografia ginocchio',
  'Ecografia anca',
  'Ecografia anca neonatale',
  'Ecografia gomito',
  'Ecografia polso e mano',
  'Ecografia caviglia e piede',
  'Ecografia parti molli',
  'Ecocolordoppler TSA (tronchi sovra-aortici)',
  'Ecocolordoppler arti inferiori',
  'Ecocolordoppler arti superiori',
  'Ecografia linfonodi'
);

-- Inserisci eventuali voci nuove accorpate
INSERT INTO tipi_prestazione (nome, durata_minuti, codice_dicom, attivo) VALUES
  ('Ecografia scrotale e testicolare', 30, 'US_SCROTO', true),
  ('Ecocolordoppler arti inferiori', 30, 'DOPPLER_AAII', true),
  ('Ecocolordoppler arti superiori', 30, 'DOPPLER_AASS', true)
ON CONFLICT (nome) DO UPDATE SET attivo = true, durata_minuti = EXCLUDED.durata_minuti;
