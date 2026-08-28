-- ============================================================
-- CONFERMA PRESENZA PAZIENTE (link nel promemoria SMS)
--
-- Queste colonne erano state aggiunte a mano su Supabase quando la
-- funzione è stata sviluppata, ma non erano mai finite in un file SQL
-- del progetto: se un giorno il database va ricreato da zero, senza
-- questo file la conferma presenza smetterebbe di funzionare.
--
-- Sono tutte IF NOT EXISTS: eseguirlo su un database dove esistono già
-- non cambia nulla ed è sicuro.
--
-- Supabase → SQL Editor → incolla tutto → Run
-- ============================================================

-- Token breve (~7 caratteri) usato nel link corto /p/:token dell'SMS.
-- Generato al primo invio del promemoria e poi riusato.
ALTER TABLE appuntamenti ADD COLUMN IF NOT EXISTS conferma_token TEXT;

-- Risposta del paziente al promemoria:
--   'confermato' → ha premuto CONFERMO (in agenda compare la spunta ✅)
--   'disdetto'   → ha premuto NON POSSO VENIRE (appuntamento annullato)
--   NULL         → non ha ancora risposto
ALTER TABLE appuntamenti ADD COLUMN IF NOT EXISTS conferma_paziente TEXT;

-- Spunta "Invia SMS" del singolo appuntamento. Il default TRUE è
-- importante: reminder.js salta gli appuntamenti con valore false, quindi
-- un default diverso spegnerebbe i promemoria senza avvisare.
ALTER TABLE appuntamenti
  ADD COLUMN IF NOT EXISTS invia_sms_promemoria BOOLEAN NOT NULL DEFAULT TRUE;

-- Il link /p/:token viene cercato per token: senza indice è una scansione
-- completa della tabella a ogni apertura del link da parte di un paziente.
CREATE INDEX IF NOT EXISTS idx_app_conferma_token
  ON appuntamenti (conferma_token);
