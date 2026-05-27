// ═══════════════════════════════════════════════════════════════════════════
// ROUTE /api/gbp — Google Business Profile setup e aggiornamento orari
// ═══════════════════════════════════════════════════════════════════════════

const express  = require('express');
const { requireAuth } = require('../middleware/auth');
const {
  aggiornaOreSettimana,
  impostaOrariBase,
  generaAuthUrl,
  scambiaCodePerToken,
} = require('../services/googleBusiness');

const router = express.Router();

// ─── GET /api/gbp/setup — pagina setup OAuth2 (non protetta, solo per admin) ──
// Visita questa URL nel browser per avviare il flusso di autorizzazione
router.get('/setup', (req, res) => {
  try {
    const authUrl = generaAuthUrl();
    res.send(`<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <title>GBP Setup — Agenda Studio</title>
  <style>
    body { font-family: -apple-system, sans-serif; max-width: 640px; margin: 60px auto; padding: 0 20px; color: #333; }
    h2 { color: #1a73e8; }
    .btn { display: inline-block; background: #1a73e8; color: white; padding: 12px 24px;
           text-decoration: none; border-radius: 6px; font-size: 16px; margin: 16px 0; }
    .warn { background: #fff8e1; border-left: 4px solid #ffc107; padding: 12px 16px; border-radius: 4px; }
    code { background: #f1f3f4; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
    ol li { margin: 8px 0; }
  </style>
</head>
<body>
  <h2>🔗 Google Business Profile — Setup OAuth2</h2>
  <div class="warn">
    ⚠️ Assicurati di essere loggato su Google con
    <strong>salvatoresusino.md@gmail.com</strong>
    prima di cliccare il pulsante.
  </div>
  <br>
  <a href="${authUrl}" class="btn">Autorizza Agenda Studio su GBP →</a>
  <br>
  <p>Dopo l'autorizzazione verrai reindirizzato automaticamente e vedrai il <strong>Refresh Token</strong> da copiare su Railway.</p>
  <hr>
  <h3>Cosa succede dopo:</h3>
  <ol>
    <li>Copia il <code>refresh_token</code> mostrato nella pagina successiva</li>
    <li>Vai su Railway → Variables → aggiungi <code>GOOGLE_OAUTH_REFRESH_TOKEN=&lt;valore&gt;</code></li>
    <li>Rideploy automatico Railway (o redeploy manuale)</li>
    <li>Chiama <code>POST /api/gbp/set-regular-hours</code> una volta per impostare gli orari base su GBP</li>
    <li>Da quel momento il cron domenicale aggiornerà gli orari ogni settimana</li>
  </ol>
</body>
</html>`);
  } catch (e) {
    res.status(500).send(`<pre style="color:red">Errore: ${e.message}\n\nAssicurati che GOOGLE_OAUTH_CLIENT_ID sia impostato su Railway.</pre>`);
  }
});

// ─── GET /api/gbp/callback — riceve il code da Google dopo l'autorizzazione ──
router.get('/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.send(`<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px">
      <h2 style="color:red">❌ Autorizzazione rifiutata</h2>
      <pre>${error}</pre>
    </body></html>`);
  }

  if (!code) {
    return res.send(`<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px">
      <h2 style="color:red">❌ Codice mancante nella risposta Google</h2>
    </body></html>`);
  }

  try {
    const tokens = await scambiaCodePerToken(code);
    const rt = tokens.refresh_token || '';

    res.send(`<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <title>GBP — Token ottenuto</title>
  <style>
    body { font-family: -apple-system, sans-serif; max-width: 700px; margin: 60px auto; padding: 0 20px; color: #333; }
    h2 { color: #0f9d58; }
    textarea { width: 100%; font-family: monospace; font-size: 0.85em; padding: 10px;
               border: 2px solid #0f9d58; border-radius: 6px; resize: none; }
    .step { background: #e8f5e9; border-left: 4px solid #0f9d58; padding: 12px 16px;
            border-radius: 4px; margin: 16px 0; }
    .warn { background: #fff8e1; border-left: 4px solid #ffc107; padding: 12px 16px; border-radius: 4px; }
    code { background: #f1f3f4; padding: 2px 6px; border-radius: 3px; }
    .copy-btn { background: #0f9d58; color: white; border: none; padding: 8px 16px;
                border-radius: 4px; cursor: pointer; margin-top: 8px; }
  </style>
</head>
<body>
  <h2>✅ Autorizzazione completata!</h2>

  ${rt
    ? `<div class="step">
        <strong>Refresh Token ottenuto.</strong> Copialo e aggiungilo su Railway come variabile d'ambiente.
       </div>
       <p><strong>Nome variabile Railway:</strong> <code>GOOGLE_OAUTH_REFRESH_TOKEN</code></p>
       <p><strong>Valore:</strong></p>
       <textarea id="rt" rows="3" readonly>${rt}</textarea>
       <br>
       <button class="copy-btn" onclick="navigator.clipboard.writeText(document.getElementById('rt').value).then(()=>this.textContent='✓ Copiato!')">
         📋 Copia negli appunti
       </button>`
    : `<div class="warn">
        ⚠️ <strong>refresh_token non presente</strong> nella risposta Google.<br>
        Questo succede se avevi già autorizzato in precedenza. Vai su
        <a href="https://myaccount.google.com/permissions" target="_blank">myaccount.google.com/permissions</a>,
        revoca l'accesso ad "Agenda Studio" e riprova da <code>/api/gbp/setup</code>.
       </div>`
  }

  <hr>
  <h3>Prossimi passi:</h3>
  <ol>
    <li>Aggiungi su Railway: <code>GOOGLE_OAUTH_REFRESH_TOKEN = &lt;valore copiato&gt;</code></li>
    <li>Aspetta il redeploy automatico (o fai Deploy manuale)</li>
    <li>Chiama <code>POST /api/gbp/set-regular-hours</code> per impostare gli orari base (martedì + venerdì)</li>
    <li>Il cron domenicale (20:00) aggiornerà gli orari ogni settimana</li>
  </ol>
</body>
</html>`);
  } catch (e) {
    res.status(500).send(`<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px">
      <h2 style="color:red">❌ Errore scambio token</h2>
      <pre>${e.message}</pre>
    </body></html>`);
  }
});

// ─── POST /api/gbp/set-regular-hours — imposta orari settimanali base ────
// Da chiamare una volta dopo aver configurato l'OAuth
router.post('/set-regular-hours', requireAuth, async (req, res) => {
  try {
    await impostaOrariBase();
    res.json({
      ok:      true,
      message: 'Orari settimanali base impostati su Google Business Profile',
      orari:   'Martedì: 9-13 e 15-19 | Venerdì: 9-13 e 15-19 | Altri giorni: chiuso',
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/gbp/aggiorna-orari — trigger manuale aggiornamento ─────────
// Ricalcola i prossimi 30 giorni e aggiorna specialHours su GBP
router.post('/aggiorna-orari', requireAuth, async (req, res) => {
  try {
    const result = await aggiornaOreSettimana();
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /api/gbp/status — verifica configurazione ───────────────────────
router.get('/status', requireAuth, (req, res) => {
  res.json({
    configurato: !!(
      process.env.GOOGLE_OAUTH_CLIENT_ID &&
      process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
      process.env.GOOGLE_OAUTH_REFRESH_TOKEN
    ),
    client_id:       process.env.GOOGLE_OAUTH_CLIENT_ID     ? '✓ impostato' : '✗ mancante',
    client_secret:   process.env.GOOGLE_OAUTH_CLIENT_SECRET ? '✓ impostato' : '✗ mancante',
    refresh_token:   process.env.GOOGLE_OAUTH_REFRESH_TOKEN ? '✓ impostato' : '✗ mancante',
    location_name:   process.env.GBP_LOCATION_NAME          || '(verrà scoperto automaticamente)',
    cron:            'Domenica 20:00 Europe/Rome',
  });
});

module.exports = router;
