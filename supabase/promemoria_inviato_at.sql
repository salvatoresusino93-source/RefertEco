-- ============================================================
-- TRACCIA QUANDO IL PROMEMORIA È STATO EFFETTIVAMENTE INVIATO
--
-- Serve a distinguere in agenda "promemoria mandato, il paziente non ha
-- ancora risposto" da "promemoria non ancora mandato" (il caso normale
-- per qualsiasi appuntamento fino alle 08:00 del giorno prima): prima non
-- esisteva questa distinzione e la riga "Presenza" nel dettaglio
-- dell'appuntamento diceva sempre "Nessuna risposta al promemoria" anche
-- per appuntamenti fra due settimane a cui non è mai stato scritto nulla.
--
-- Supabase → SQL Editor → incolla tutto → Run
-- ============================================================

ALTER TABLE appuntamenti ADD COLUMN IF NOT EXISTS promemoria_inviato_at TIMESTAMPTZ;
