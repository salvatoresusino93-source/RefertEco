-- ─── Fasce orarie personalizzate per indisponibilità ─────────────────────────
-- Eseguire nel SQL Editor di Supabase DOPO indisponibilita.sql

-- Rimuove il vincolo di unicità (data, tipo): con le fasce personalizzate
-- si possono avere più blocchi 'personalizzata' nello stesso giorno.
DROP INDEX IF EXISTS idx_indisponibilita_unique;

-- Aggiorna il CHECK per includere 'personalizzata'
ALTER TABLE indisponibilita DROP CONSTRAINT IF EXISTS indisponibilita_tipo_check;
ALTER TABLE indisponibilita ADD CONSTRAINT indisponibilita_tipo_check
  CHECK (tipo IN ('mattina', 'pomeriggio', 'giornata', 'personalizzata'));

-- Orari della fascia personalizzata (NULL per mattina/pomeriggio/giornata, che restano fissi)
ALTER TABLE indisponibilita ADD COLUMN IF NOT EXISTS ora_inizio TIME;
ALTER TABLE indisponibilita ADD COLUMN IF NOT EXISTS ora_fine   TIME;

-- Ripristina l'unicità solo per i tipi a fascia fissa (non per 'personalizzata')
CREATE UNIQUE INDEX IF NOT EXISTS idx_indisponibilita_unique_fisse
  ON indisponibilita(data, tipo)
  WHERE tipo <> 'personalizzata';
