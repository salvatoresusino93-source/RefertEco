const jwt = require('jsonwebtoken');

/**
 * Middleware JWT — verifica il token Bearer nell'header Authorization.
 * Popola req.user = { id, username, ruolo }
 */
function requireAuth(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token di autenticazione mancante' });
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token non valido o scaduto' });
  }
}

/**
 * Middleware che richiede ruolo "medico"
 */
function requireMedico(req, res, next) {
  if (req.user?.ruolo !== 'medico') {
    return res.status(403).json({ error: 'Accesso riservato al medico' });
  }
  next();
}

module.exports = { requireAuth, requireMedico };
