-- Imposta tutti gli esami prenotabili online a slot da 30 minuti.
-- Eseguire nel SQL Editor di Supabase.

UPDATE tipi_prestazione SET durata_minuti = 30 WHERE attivo = true;

-- Allinea anche le voci dell'elenco ridotto (se disattivate ma con durata diversa)
UPDATE tipi_prestazione SET durata_minuti = 30 WHERE nome IN (
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
