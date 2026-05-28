-- ─── Tabella indisponibilità agenda ──────────────────────────────────────────
-- Eseguire nel SQL Editor di Supabase

CREATE TABLE IF NOT EXISTS indisponibilita (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data        DATE        NOT NULL,
  tipo        VARCHAR(20) NOT NULL CHECK (tipo IN ('mattina', 'pomeriggio', 'giornata')),
  motivo      TEXT,
  created_by  INTEGER REFERENCES utenti(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_indisponibilita_data ON indisponibilita(data);

-- Unicità: non si può avere lo stesso tipo sullo stesso giorno
CREATE UNIQUE INDEX IF NOT EXISTS idx_indisponibilita_unique
  ON indisponibilita(data, tipo);
