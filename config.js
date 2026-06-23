const fs = require('fs');
const path = require('path');
const os = require('os');

// Config sempre in ~/.referteco/ — stesso posto indipendentemente da dove sta l'app
const CONFIG_DIR = path.join(os.homedir(), '.referteco');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

function load() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); }
  catch(e) { return { dataDir: null }; }
}

function save(cfg) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
}

// Verifica se la cartella dati è pronta e SCRIVIBILE.
// REGOLA DI SICUREZZA: se è configurato un disco dati (es. K:) e NON è raggiungibile,
// NON si ripiega mai su una cartella locale nascosta. Si segnala l'errore, così i
// dati dei pazienti non finiscono mai nel posto sbagliato (niente archivi sdoppiati).
function dataDirStatus() {
  const cfg = load();
  if (!cfg.dataDir) {
    // Nessun disco dati configurato (installazione base): usa la cartella locale.
    const d = path.join(os.homedir(), '.referteco');
    try { fs.mkdirSync(d, { recursive: true }); } catch(e) {}
    return { ok: true, dir: d, external: false };
  }
  // Disco dati configurato: DEVE essere collegato e scrivibile. Niente ripiego.
  try {
    fs.mkdirSync(cfg.dataDir, { recursive: true });
    const probe = path.join(cfg.dataDir, '.referteco-write-test');
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
    return { ok: true, dir: cfg.dataDir, external: true };
  } catch(e) {
    return { ok: false, dir: cfg.dataDir, external: true, error: e.message };
  }
}

function getDataDir() {
  const s = dataDirStatus();
  if (!s.ok) {
    const err = new Error('Disco dati non disponibile: ' + s.dir);
    err.code = 'DATADIR_UNAVAILABLE';
    err.dir = s.dir;
    throw err;
  }
  return s.dir;
}

function detectGoogleDrive() {
  if (process.platform === 'darwin') {
    const cloudStorage = path.join(os.homedir(), 'Library', 'CloudStorage');
    if (fs.existsSync(cloudStorage)) {
      try {
        const dirs = fs.readdirSync(cloudStorage);
        const gd = dirs.find(d => d.startsWith('GoogleDrive-'));
        if (gd) return path.join(cloudStorage, gd, 'My Drive', 'RefertEco');
      } catch(e) {}
    }
    const leg1 = path.join(os.homedir(), 'Google Drive', 'My Drive');
    if (fs.existsSync(leg1)) return path.join(leg1, 'RefertEco');
    const leg2 = path.join(os.homedir(), 'Google Drive');
    if (fs.existsSync(leg2)) return path.join(leg2, 'RefertEco');
  }
  if (process.platform === 'win32') {
    const home = os.homedir();
    const candidates = [
      path.join(home, 'Google Drive', 'My Drive', 'RefertEco'),
      path.join(home, 'Google Drive', 'RefertEco'),
      path.join(home, 'GoogleDrive', 'My Drive', 'RefertEco'),
      'G:\\My Drive\\RefertEco',
      'H:\\My Drive\\RefertEco',
    ];
    for (const c of candidates) {
      if (fs.existsSync(path.dirname(c))) return c;
    }
  }
  return null;
}

module.exports = { load, save, getDataDir, dataDirStatus, detectGoogleDrive };
