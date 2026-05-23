const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const supabase = require('../services/supabase');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// ─── POST /api/auth/login ─────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username e password obbligatori' });
  }

  const { data: utente, error } = await supabase
    .from('utenti')
    .select('*')
    .eq('username', username.toLowerCase().trim())
    .eq('attivo', true)
    .single();

  if (error || !utente) {
    return res.status(401).json({ error: 'Credenziali non valide' });
  }

  const passwordOk = await bcrypt.compare(password, utente.password_hash);
  if (!passwordOk) {
    return res.status(401).json({ error: 'Credenziali non valide' });
  }

  const token = jwt.sign(
    { id: utente.id, username: utente.username, ruolo: utente.ruolo },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );

  res.json({
    token,
    user: {
      id:           utente.id,
      username:     utente.username,
      ruolo:        utente.ruolo,
      nome_display: utente.nome_display
    }
  });
});

// ─── POST /api/auth/logout ───────────────────────────────────────────────
// Il JWT è stateless: il client cancella il token localmente.
router.post('/logout', requireAuth, (req, res) => {
  res.json({ ok: true });
});

// ─── GET /api/auth/me ────────────────────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  const { data: utente, error } = await supabase
    .from('utenti')
    .select('id, username, ruolo, nome_display')
    .eq('id', req.user.id)
    .single();

  if (error || !utente) {
    return res.status(404).json({ error: 'Utente non trovato' });
  }
  res.json(utente);
});

// ─── POST /api/auth/crea-utente ─────────────────────────────────────────
// Solo per setup iniziale — in produzione proteggere con requireMedico
router.post('/crea-utente', requireAuth, async (req, res) => {
  if (req.user.ruolo !== 'medico') {
    return res.status(403).json({ error: 'Accesso negato' });
  }

  const { username, password, ruolo, nome_display } = req.body;
  if (!username || !password || !ruolo) {
    return res.status(400).json({ error: 'username, password e ruolo obbligatori' });
  }
  if (!['medico', 'segreteria'].includes(ruolo)) {
    return res.status(400).json({ error: 'Ruolo non valido (medico | segreteria)' });
  }

  const password_hash = await bcrypt.hash(password, 12);

  const { data, error } = await supabase
    .from('utenti')
    .insert({ username: username.toLowerCase().trim(), password_hash, ruolo, nome_display })
    .select('id, username, ruolo, nome_display')
    .single();

  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Username già esistente' });
    return res.status(500).json({ error: error.message });
  }

  res.status(201).json(data);
});

module.exports = router;
