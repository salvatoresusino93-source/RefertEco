-- ============================================================
-- FIX: consente lo stato 'in_attesa' sugli appuntamenti
-- Necessario per le prenotazioni online (in attesa di approvazione
-- del medico via email). Senza questo, l'insert viene rifiutato e
-- la prenotazione dal sito dà "Errore durante la prenotazione".
-- Supabase → SQL Editor → incolla tutto → Run
-- ============================================================

ALTER TABLE appuntamenti DROP CONSTRAINT IF EXISTS appuntamenti_stato_check;

ALTER TABLE appuntamenti ADD CONSTRAINT appuntamenti_stato_check
  CHECK (stato IN ('in_attesa','prenotato','arrivato','in_corso','refertato','annullato'));
