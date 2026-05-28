// ─── API wrapper ─────────────────────────────────────────────────────────────
const API_BASE = '/api';
let _token = localStorage.getItem('agenda_token');

const api = {
  setToken(t) {
    _token = t;
    if (t) localStorage.setItem('agenda_token', t);
    else   localStorage.removeItem('agenda_token');
  },

  async _req(method, path, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (_token)            opts.headers['Authorization'] = `Bearer ${_token}`;
    if (body !== undefined) opts.body = JSON.stringify(body);

    const res  = await fetch(API_BASE + path, opts);
    if (res.status === 204) return null;
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.error || `Errore ${res.status}`);
      err.status   = res.status;
      err.paziente = data.paziente || null;   // presente nel 409 duplicato
      throw err;
    }
    return data;
  },

  // Auth
  login:  (u, p) => api._req('POST', '/auth/login', { username: u, password: p }),
  logout: ()     => api._req('POST', '/auth/logout'),
  me:     ()     => api._req('GET',  '/auth/me'),

  // Pazienti
  pazienti:         (q)      => api._req('GET',  `/pazienti${q ? '?q=' + encodeURIComponent(q) : ''}`),
  paziente:         (id)     => api._req('GET',  `/pazienti/${id}`),
  creaPaziente:     (data)   => api._req('POST', '/pazienti', data),
  aggiornaPaziente: (id, d)  => api._req('PUT',  `/pazienti/${id}`, d),

  // Appuntamenti
  appuntamenti:         (from, to) => api._req('GET', `/appuntamenti?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  appuntamentiOggi:     ()         => api._req('GET', '/appuntamenti/oggi'),
  appuntamento:         (id)       => api._req('GET', `/appuntamenti/${id}`),
  creaAppuntamento:     (data)     => api._req('POST', '/appuntamenti', data),
  aggiornaAppuntamento: (id, data) => api._req('PUT',  `/appuntamenti/${id}`, data),
  annullaAppuntamento:  (id)       => api._req('DELETE', `/appuntamenti/${id}`),

  // Prestazioni
  prestazioni: () => api._req('GET', '/prestazioni'),

  // Indisponibilità
  indisponibilita:        (from, to) => api._req('GET',    `/indisponibilita?from=${from}&to=${to}`),
  creaIndisponibilita:    (data)     => api._req('POST',   '/indisponibilita', data),
  eliminaIndisponibilita: (id)       => api._req('DELETE', `/indisponibilita/${id}`),
};
