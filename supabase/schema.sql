-- ============================================================
-- SCHEMA Agenda Studio Medico — da eseguire su Supabase
-- SQL Editor → incolla tutto → Run
-- ============================================================

-- ─── Estensioni ──────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Tabella: utenti ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS utenti (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  ruolo         TEXT NOT NULL CHECK (ruolo IN ('medico', 'segreteria')),
  nome_display  TEXT,
  attivo        BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ─── Tabella: pazienti ───────────────────────────────────
CREATE TABLE IF NOT EXISTS pazienti (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cognome         TEXT NOT NULL,
  nome            TEXT NOT NULL,
  data_nascita    DATE,
  sesso           CHAR(1) CHECK (sesso IN ('M', 'F', 'O')),
  codice_fiscale  TEXT,
  telefono        TEXT,
  email           TEXT,
  note            TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pazienti_cognome ON pazienti (cognome);
CREATE INDEX IF NOT EXISTS idx_pazienti_cf ON pazienti (codice_fiscale);

-- ─── Tabella: tipi_prestazione ───────────────────────────
CREATE TABLE IF NOT EXISTS tipi_prestazione (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome            TEXT NOT NULL,
  durata_minuti   INTEGER DEFAULT 20,
  codice_dicom    TEXT,
  attivo          BOOLEAN DEFAULT true
);

-- Prestazioni di default
INSERT INTO tipi_prestazione (nome, durata_minuti, codice_dicom) VALUES
  ('Ecografia addome completo',        20, 'US_ADDOME'),
  ('Ecografia addome superiore',       15, 'US_ADD_SUP'),
  ('Ecografia addome inferiore',       15, 'US_ADD_INF'),
  ('Ecografia tiroide',                15, 'US_TIROIDE'),
  ('Ecografia mammella',               20, 'US_MAMMELLA'),
  ('Ecografia parti molli',            15, 'US_PARTI_MOLLI'),
  ('Ecografia muscolo-tendinea',       20, 'US_MUSC_TEND'),
  ('Ecografia renale',                 15, 'US_RENE'),
  ('Ecografia pelvi femminile',        20, 'US_PELVI_F'),
  ('Ecografia pelvi maschile',         15, 'US_PELVI_M'),
  ('Ecografia testicolare',            15, 'US_TESTICOLO'),
  ('Ecografia linfonodi',              15, 'US_LINFONODI'),
  ('Ecocolordoppler TSA',              30, 'DOPPLER_TSA'),
  ('Ecocolordoppler arti inferiori',   30, 'DOPPLER_AAII'),
  ('Ecocolordoppler arti superiori',   30, 'DOPPLER_AASS')
ON CONFLICT DO NOTHING;

-- ─── Tabella: appuntamenti ────────────────────────────────
CREATE TABLE IF NOT EXISTS appuntamenti (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paziente_id         UUID NOT NULL REFERENCES pazienti(id) ON DELETE RESTRICT,
  tipo_id             UUID NOT NULL REFERENCES tipi_prestazione(id),
  data_ora_inizio     TIMESTAMPTZ NOT NULL,
  data_ora_fine       TIMESTAMPTZ NOT NULL,
  stato               TEXT NOT NULL DEFAULT 'prenotato'
                      CHECK (stato IN ('in_attesa','prenotato','arrivato','in_corso','refertato','annullato')),
  note_segreteria     TEXT,
  note_medico         TEXT,
  accession_number    TEXT UNIQUE,
  worklist_status     TEXT DEFAULT 'pending'
                      CHECK (worklist_status IN ('pending','synced','not_needed','error')),
  worklist_synced_at  TIMESTAMPTZ,
  created_by          UUID REFERENCES utenti(id),
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_data        ON appuntamenti (data_ora_inizio);
CREATE INDEX IF NOT EXISTS idx_app_paziente    ON appuntamenti (paziente_id);
CREATE INDEX IF NOT EXISTS idx_app_stato       ON appuntamenti (stato);
CREATE INDEX IF NOT EXISTS idx_app_worklist    ON appuntamenti (worklist_status);
CREATE INDEX IF NOT EXISTS idx_app_accession   ON appuntamenti (accession_number);

-- ─── Tabella: worklist_sync_log ───────────────────────────
CREATE TABLE IF NOT EXISTS worklist_sync_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appuntamento_id   UUID REFERENCES appuntamenti(id) ON DELETE CASCADE,
  tentativo_at      TIMESTAMPTZ DEFAULT now(),
  esito             TEXT CHECK (esito IN ('success','error')),
  messaggio         TEXT
);

CREATE INDEX IF NOT EXISTS idx_synclog_app ON worklist_sync_log (appuntamento_id);

-- ─── Trigger: updated_at automatico ─────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pazienti_updated_at ON pazienti;
CREATE TRIGGER trg_pazienti_updated_at
  BEFORE UPDATE ON pazienti
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_appuntamenti_updated_at ON appuntamenti;
CREATE TRIGGER trg_appuntamenti_updated_at
  BEFORE UPDATE ON appuntamenti
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── RLS (Row Level Security) ────────────────────────────
-- Il backend usa la service key (bypassa RLS).
-- Disabilitare RLS è OK lato backend; abilitarlo protegge
-- da accessi diretti accidentali via anon key.

ALTER TABLE utenti          ENABLE ROW LEVEL SECURITY;
ALTER TABLE pazienti        ENABLE ROW LEVEL SECURITY;
ALTER TABLE tipi_prestazione ENABLE ROW LEVEL SECURITY;
ALTER TABLE appuntamenti    ENABLE ROW LEVEL SECURITY;
ALTER TABLE worklist_sync_log ENABLE ROW LEVEL SECURITY;

-- Nessuna policy pubblica: solo la service key può leggere/scrivere
-- (il backend usa sempre la service key)

-- ============================================================
-- FINE SCHEMA
-- Dopo aver eseguito questo SQL:
-- 1. Copia .env.example in .env nella cartella agenda-backend
-- 2. Incolla SUPABASE_URL e SUPABASE_SERVICE_KEY dal pannello Supabase
-- 3. Esegui: cd agenda-backend && npm install && npm run dev
-- 4. Crea il primo utente medico con:
--    POST /api/auth/setup  { username, password, ruolo:'medico', nome_display }
-- ============================================================
