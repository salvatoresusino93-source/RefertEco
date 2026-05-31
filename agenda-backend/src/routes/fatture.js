// ═══════════════════════════════════════════════════════════════════════════
// ROUTE /api/fatture — Fatturazione Elettronica Aruba
// ═══════════════════════════════════════════════════════════════════════════

const express   = require('express');
const router    = express.Router();
const supabase  = require('../services/supabase');
const { arubaFE } = require('../services/arubaFE');

// ─── GET /api/fatture/test-connessione ───────────────────────────────────────
// Testa che le credenziali Aruba funzionino (senza inviare nulla).
router.get('/test-connessione', async (req, res) => {
  const risultato = await arubaFE.testConnessione();
  res.json(risultato);
});

// ─── GET /api/fatture/prossimo-numero ────────────────────────────────────────
// Ritorna il prossimo numero progressivo fattura per l'anno corrente.
router.get('/prossimo-numero', async (req, res) => {
  try {
    const anno = new Date().getFullYear();
    const { data, error } = await supabase
      .from('fatture')
      .select('numero_progressivo')
      .gte('data_fattura', `${anno}-01-01`)
      .lte('data_fattura', `${anno}-12-31`)
      .order('numero_progressivo', { ascending: false })
      .limit(1);

    if (error) throw error;
    const ultimo = data?.[0]?.numero_progressivo || 0;
    res.json({ prossimoNumero: ultimo + 1, anno });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/fatture/crea ───────────────────────────────────────────────────
// Crea e invia una fattura per un appuntamento.
// Body: { appuntamento_id }
router.post('/crea', async (req, res) => {
  try {
    const { appuntamento_id } = req.body;
    if (!appuntamento_id) return res.status(400).json({ error: 'appuntamento_id mancante' });

    // 1. Carica appuntamento con paziente e prestazione
    const { data: app, error: errApp } = await supabase
      .from('appuntamenti')
      .select('*, pazienti(*), tipi_prestazione(*)')
      .eq('id', appuntamento_id)
      .single();

    if (errApp || !app) return res.status(404).json({ error: 'Appuntamento non trovato' });

    const paziente = app.pazienti;
    if (!paziente?.codice_fiscale) {
      return res.status(400).json({ error: 'Codice fiscale paziente mancante' });
    }

    // 2. Calcola prossimo numero progressivo
    const anno = new Date().getFullYear();
    const { data: ultimaFattura } = await supabase
      .from('fatture')
      .select('numero_progressivo')
      .gte('data_fattura', `${anno}-01-01`)
      .order('numero_progressivo', { ascending: false })
      .limit(1);

    const numProgressivo = ((ultimaFattura?.[0]?.numero_progressivo) || 0) + 1;
    const dataFattura    = new Date().toISOString().slice(0, 10);
    const importoEuro    = ((app.importo_pagato_cent || 8000) / 100).toFixed(2);
    const nomePaziente   = `${paziente.cognome || ''} ${paziente.nome || ''}`.trim();
    const descrizione    = app.tipi_prestazione?.nome || 'Prestazione ecografica';

    // 3. Invia fattura ad Aruba
    const risultato = await arubaFE.creaEInviaFattura({
      numProgressivo,
      dataFattura,
      nomePaziente,
      cfPaziente:           paziente.codice_fiscale,
      importoEuro,
      descrizionePrestazione: descrizione,
    });

    // 4. Salva in DB tabella fatture
    const { data: fattura, error: errFattura } = await supabase
      .from('fatture')
      .insert({
        appuntamento_id,
        numero_progressivo: numProgressivo,
        numero_fattura:     risultato.numeroFattura,
        data_fattura:       dataFattura,
        importo_euro:       parseFloat(importoEuro),
        cf_paziente:        paziente.codice_fiscale,
        nome_paziente:      nomePaziente,
        filename_sdi:       risultato.filename,
        stato:              'inviata',
      })
      .select()
      .single();

    if (errFattura) {
      console.error('[Fatture] Errore salvataggio DB:', errFattura.message);
      // La fattura è stata inviata — loghiamo ma non blocchiamo
    }

    // 5. Aggiorna appuntamento con numero fattura
    await supabase
      .from('appuntamenti')
      .update({ numero_fattura: risultato.numeroFattura })
      .eq('id', appuntamento_id);

    res.json({
      ok:             true,
      numeroFattura:  risultato.numeroFattura,
      filename:       risultato.filename,
      fattura_id:     fattura?.id,
    });

  } catch (e) {
    console.error('[Fatture] Errore:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /api/fatture ────────────────────────────────────────────────────────
// Lista fatture emesse (con filtro anno opzionale).
router.get('/', async (req, res) => {
  try {
    const anno = req.query.anno || new Date().getFullYear();
    const { data, error } = await supabase
      .from('fatture')
      .select('*, appuntamenti(data_ora_inizio, tipi_prestazione(nome))')
      .gte('data_fattura', `${anno}-01-01`)
      .lte('data_fattura', `${anno}-12-31`)
      .order('numero_progressivo', { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
