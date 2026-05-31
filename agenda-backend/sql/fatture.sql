-- Tabella fatture elettroniche
-- Esegui su Supabase → SQL Editor

CREATE TABLE IF NOT EXISTS fatture (
  id                  BIGSERIAL PRIMARY KEY,
  appuntamento_id     BIGINT REFERENCES appuntamenti(id),
  numero_progressivo  INTEGER NOT NULL,
  numero_fattura      TEXT NOT NULL,        -- es. "1/2026"
  data_fattura        DATE NOT NULL,
  importo_euro        NUMERIC(10,2) NOT NULL,
  cf_paziente         TEXT,
  nome_paziente       TEXT,
  filename_sdi        TEXT,                 -- nome file restituito da Aruba
  stato               TEXT DEFAULT 'inviata', -- inviata / errore / annullata
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Indice per ricerca per anno
CREATE INDEX IF NOT EXISTS idx_fatture_anno ON fatture (data_fattura);

-- Colonna numero_fattura sulla tabella appuntamenti (se non esiste)
ALTER TABLE appuntamenti
  ADD COLUMN IF NOT EXISTS numero_fattura TEXT;
