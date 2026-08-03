-- ═══════════════════════════════════════════════════════════════════════════
-- SMS invito recensione Google
--
-- Il giorno dopo l'esame il sistema manda un SMS al paziente con il link per
-- lasciare una recensione. Questa colonna registra QUANDO è stato mandato,
-- così nessuno lo riceve due volte (anche se il cron gira più volte o il
-- server si riavvia).
--
-- Eseguire una sola volta su Supabase → SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE appuntamenti
  ADD COLUMN IF NOT EXISTS sms_recensione_at TIMESTAMPTZ;

COMMENT ON COLUMN appuntamenti.sms_recensione_at IS
  'Quando è stato inviato l''SMS di invito alla recensione Google. NULL = non ancora inviato.';

-- Serve al cron per trovare in fretta gli esami di ieri ancora da contattare.
CREATE INDEX IF NOT EXISTS idx_app_sms_recensione
  ON appuntamenti (sms_recensione_at)
  WHERE sms_recensione_at IS NULL;

-- ─── Sicurezza: non contattare gli appuntamenti già passati ────────────────
-- Alla prima installazione segniamo come "già inviato" tutto ciò che è
-- antecedente a oggi. Senza questa riga, al primo giro il sistema manderebbe
-- l'invito a TUTTI i pazienti storici in una volta sola.
UPDATE appuntamenti
   SET sms_recensione_at = now()
 WHERE sms_recensione_at IS NULL
   AND data_ora_inizio < date_trunc('day', now());
