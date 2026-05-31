-- ============================================================
-- PAGAMENTO ONLINE (Stripe) — colonne per il pagamento della
-- visita alla prenotazione online (importo intero, nessun acconto).
--   pagamento_stato: NULL (non pagato online, "paga in studio")
--                    | 'pagato' (importo intero addebitato online).
-- Supabase → SQL Editor → incolla tutto → Run
-- ============================================================

ALTER TABLE appuntamenti
  ADD COLUMN IF NOT EXISTS importo_pagato_cent   integer,
  ADD COLUMN IF NOT EXISTS pagamento_stato       text,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent text,
  ADD COLUMN IF NOT EXISTS stripe_session_id     text;

ALTER TABLE appuntamenti DROP CONSTRAINT IF EXISTS appuntamenti_pagamento_stato_check;

ALTER TABLE appuntamenti ADD CONSTRAINT appuntamenti_pagamento_stato_check
  CHECK (pagamento_stato IS NULL OR pagamento_stato IN ('pagato'));
