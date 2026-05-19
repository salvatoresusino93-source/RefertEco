const fs = require('fs');
const path = require('path');
const os = require('os');

// Config sempre in ~/.referteco/ — stesso posto indipendentemente da dove sta l'app
const CONFIG_DIR = path.join(os.homedir(), '.referteco');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

function load() {
  try {
    let raw = fs.readFileSync(CONFIG_FILE, 'utf8');
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
    raw = raw.trim();
    if (!raw) return { dataDir: null };
    return JSON.parse(raw);
  }
  catch(e) {
    console.error('[config] errore parsing ' + CONFIG_FILE + ':', e.message);
    return { dataDir: null };
  }
}

function save(cfg) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), { encoding: 'utf8' });
}

function getDataDir() {
  const cfg = load();
  if (cfg.dataDir) {
    try {
      fs.mkdirSync(cfg.dataDir, { recursive: true });
      return cfg.dataDir;
    } catch(e) {}
  }
  // Default: ~/.referteco/ — accessibile senza restrizioni di permesso
  const defaultDir = path.join(os.homedir(), '.referteco');
  fs.mkdirSync(defaultDir, { recursive: true });
  return defaultDir;
}

function findGoogleDriveRoot() {
  if (process.platform === 'darwin') {
    const cloudStorage = path.join(os.homedir(), 'Library', 'CloudStorage');
    if (fs.existsSync(cloudStorage)) {
      try {
        const dirs = fs.readdirSync(cloudStorage);
        const gd = dirs.find(d => d.startsWith('GoogleDrive-'));
        if (gd) {
          for (const name of ['My Drive', 'Il mio Drive']) {
            const p = path.join(cloudStorage, gd, name);
            if (fs.existsSync(p)) return p;
          }
          return path.join(cloudStorage, gd, 'My Drive');
        }
      } catch(e) {}
    }
    for (const sub of ['My Drive', 'Il mio Drive', '']) {
      const p = path.join(os.homedir(), 'Google Drive', sub);
      if (fs.existsSync(p)) return p;
    }
  }
  if (process.platform === 'win32') {
    const home = os.homedir();
    const candidates = [
      path.join(home, 'Google Drive', 'My Drive'),
      path.join(home, 'Google Drive', 'Il mio Drive'),
      path.join(home, 'Google Drive'),
      path.join(home, 'GoogleDrive', 'My Drive'),
    ];
    for (const letter of ['G', 'H', 'I', 'J', 'K']) {
      candidates.push(`${letter}:\\My Drive`);
      candidates.push(`${letter}:\\Il mio Drive`);
    }
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
  }
  return null;
}

function detectGoogleDrive() {
  const root = findGoogleDriveRoot();
  if (!root) return null;
  const nuovo = path.join(root, 'RefertEco Dati Pazienti');
  const vecchio = path.join(root, 'RefertEco');
  if (fs.existsSync(nuovo)) return nuovo;
  if (fs.existsSync(vecchio)) return vecchio;
  return nuovo;
}

module.exports = { load, save, getDataDir, detectGoogleDrive };
