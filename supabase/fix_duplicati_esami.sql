-- Rimuove duplicati attivi con lo stesso nome (tiene il più vecchio).
-- Eseguire nel SQL Editor di Supabase.

UPDATE tipi_prestazione t
SET attivo = false
WHERE t.attivo = true
  AND EXISTS (
    SELECT 1
    FROM tipi_prestazione t2
    WHERE lower(t2.nome) = lower(t.nome)
      AND t2.id <> t.id
      AND t2.attivo = true
      AND t2.id::text < t.id::text
  );

-- Verifica elenco attivo
SELECT nome, durata_minuti, attivo
FROM tipi_prestazione
WHERE attivo = true
ORDER BY nome;
