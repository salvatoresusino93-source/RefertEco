// ═══════════════════════════════════════════════════════════════════════════
// AGENDA STUDIO — Frontend
// ═══════════════════════════════════════════════════════════════════════════

const CAL_START = 8;          // 08:00
const CAL_END   = 20;         // 20:00
const PX_PER_MIN = 2;         // 2px per minuto → 1 ora = 120px
const SLOT_MIN  = 20;         // slot cliccabili ogni 20 min
const SLOT_H    = SLOT_MIN * PX_PER_MIN; // 40px

const STATI = {
  prenotato: 'Prenotato',
  arrivato:  'Arrivato',
  in_corso:  'In corso',
  refertato: 'Refertato',
  annullato: 'Annullato'
};
const GIORNI = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];

// ─── Stato ────────────────────────────────────────────────────────────────
let _user         = null;
let _viewStart    = null;   // lunedì della settimana visualizzata
let _appointments = [];
let _prestazioni  = [];
let _editId       = null;   // id appuntamento in modifica
let _pazienteId   = null;   // paziente selezionato nel modal
let _searchTimer  = null;

// ─── Utils ────────────────────────────────────────────────────────────────
const toISO    = d => d.toISOString();
const toDate   = s => toDateStr(new Date(s));
const addDays  = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
function toDateStr(d) { return d.toISOString().slice(0,10); }
function getMon(d) {
  const x = new Date(d); x.setHours(0,0,0,0);
  const day = x.getDay(); x.setDate(x.getDate() - (day === 0 ? 6 : day - 1));
  return x;
}
function fmtTime(iso)  { return new Date(iso).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'}); }
function fmtDateShort(d) { return d.toLocaleDateString('it-IT',{day:'2-digit',month:'short'}); }
function isToday(d) {
  const t = new Date();
  return d.getFullYear()===t.getFullYear() && d.getMonth()===t.getMonth() && d.getDate()===t.getDate();
}
function minFromMidnight(iso) { const d=new Date(iso); return d.getHours()*60+d.getMinutes(); }
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

// ─── Bootstrap ────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  const tok = localStorage.getItem('agenda_token');
  if (tok) {
    try { onLoginOk(await api.me()); return; } catch { api.setToken(null); }
  }
  showLogin();
});

// ─── Login ────────────────────────────────────────────────────────────────
function showLogin() {
  $('login-screen').classList.remove('hidden');
  $('app').classList.add('hidden');
}

$('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = $('login-btn'), err = $('login-err');
  btn.textContent = 'Accesso…'; btn.disabled = true;
  err.classList.add('hidden');
  try {
    const { token, user } = await api.login($('login-user').value, $('login-pass').value);
    api.setToken(token);
    onLoginOk(user);
  } catch(ex) {
    err.textContent = ex.message;
    err.classList.remove('hidden');
    btn.textContent = 'Accedi'; btn.disabled = false;
  }
});

$('btn-logout').onclick = () => { api.setToken(null); _user = null; showLogin(); };

async function onLoginOk(user) {
  _user = user;
  $('login-screen').classList.add('hidden');
  $('app').classList.remove('hidden');
  $('user-badge').textContent = user.nome_display || user.username;
  try { _prestazioni = await api.prestazioni(); } catch { _prestazioni = []; }
  fillPrestazioni();
  _viewStart = getMon(new Date());
  await refreshWeek();
  await refreshSidebar();
  initSocket();
  bindEvents();
}

// ─── Socket.io ────────────────────────────────────────────────────────────
function initSocket() {
  try {
    const s = io();
    const refresh = () => { refreshWeek(); refreshSidebar(); };
    s.on('appuntamento:nuovo',      refresh);
    s.on('appuntamento:aggiornato', refresh);
    s.on('appuntamento:annullato',  refresh);
  } catch {}
}

// ─── Calendar load & render ───────────────────────────────────────────────
async function refreshWeek() {
  try {
    _appointments = await api.appuntamenti(
      toISO(_viewStart),
      toISO(addDays(_viewStart, 7))
    );
  } catch { _appointments = []; }
  renderCalendar();
  renderPeriod();
}

function renderPeriod() {
  $('header-period').textContent =
    `${fmtDateShort(_viewStart)} — ${fmtDateShort(addDays(_viewStart,6))}`;
}

function renderCalendar() {
  const totalMin = (CAL_END - CAL_START) * 60;
  const totalPx  = totalMin * PX_PER_MIN;

  // ── Header
  let hdr = `<div class="cal-header"><div class="cal-th-time"></div>`;
  for (let i=0; i<7; i++) {
    const d = addDays(_viewStart, i);
    const cls = isToday(d) ? ' today' : '';
    hdr += `<div class="cal-th-day${cls}">
      <span class="cal-th-dayname">${GIORNI[i]}</span>
      <span class="cal-th-daynum">${d.getDate()}</span>
    </div>`;
  }
  hdr += `</div>`;

  // ── Time labels
  let timeLbls = `<div class="cal-time-col" style="height:${totalPx}px">`;
  for (let m=0; m<=totalMin; m+=60) {
    const h = CAL_START + m/60;
    timeLbls += `<div class="cal-lbl" style="top:${m*PX_PER_MIN}px">${String(h).padStart(2,'0')}:00</div>`;
  }
  timeLbls += `</div>`;

  // ── Day columns
  let days = '';
  for (let i=0; i<7; i++) {
    const d       = addDays(_viewStart, i);
    const dateStr = toDateStr(d);
    const todayCls = isToday(d) ? ' today' : '';

    // Hour lines
    let lines = '';
    for (let m=0; m<=totalMin; m+=20) {
      lines += `<div class="cal-hline${m%60===0?' major':''}" style="top:${m*PX_PER_MIN}px"></div>`;
    }

    // Click slots
    let slots = '';
    for (let m=0; m<totalMin; m+=SLOT_MIN) {
      const absMin = CAL_START*60 + m;
      const hh = String(Math.floor(absMin/60)).padStart(2,'0');
      const mm = String(absMin%60).padStart(2,'0');
      slots += `<div class="cal-slot" style="top:${m*PX_PER_MIN}px;height:${SLOT_H}px"
        onclick="onSlotClick('${dateStr}','${hh}:${mm}')"></div>`;
    }

    // Appointments
    let appHtml = '';
    for (const a of _appointments.filter(x => x.data_ora_inizio.startsWith(dateStr))) {
      const startM = minFromMidnight(a.data_ora_inizio);
      const endM   = minFromMidnight(a.data_ora_fine);
      const top    = (startM - CAL_START*60) * PX_PER_MIN;
      const height = Math.max((endM - startM) * PX_PER_MIN, 22);
      if (top < 0 || top >= totalPx) continue;

      const stato   = a.stato || 'prenotato';
      const pazNome = a.pazienti ? `${esc(a.pazienti.cognome)} ${esc(a.pazienti.nome)}` : '—';
      const esame   = esc(a.tipi_prestazione?.nome || '');

      appHtml += `<div class="cal-app stato-${stato}"
        style="top:${top}px;height:${height}px"
        onclick="onAppClick('${a.id}',event)"
        title="${pazNome} — ${esame}">
        <div class="cal-app-time">${fmtTime(a.data_ora_inizio)}</div>
        <div class="cal-app-nome">${pazNome}</div>
        ${height>=50?`<div class="cal-app-esame">${esame}</div>`:''}
      </div>`;
    }

    days += `<div class="cal-day${todayCls}" style="height:${totalPx}px">${lines}${slots}${appHtml}</div>`;
  }

  $('cal-wrap').innerHTML = `${hdr}
    <div class="cal-body">${timeLbls}${days}</div>`;
}

// ─── Sidebar ──────────────────────────────────────────────────────────────
async function refreshSidebar() {
  try {
    const list = await api.appuntamentiOggi();
    const el   = $('sidebar-oggi');
    if (!list.length) { el.innerHTML = '<p class="empty-msg">Nessun appuntamento</p>'; return; }
    el.innerHTML = list.map(a => {
      const nome  = a.pazienti ? `${esc(a.pazienti.cognome)} ${esc(a.pazienti.nome)}` : '—';
      const esame = esc(a.tipi_prestazione?.nome || '');
      return `<div class="sidebar-item stato-${a.stato}" onclick="onAppClick('${a.id}')">
        <div class="sidebar-time">${fmtTime(a.data_ora_inizio)}</div>
        <div class="sidebar-nome">${nome}</div>
        <div class="sidebar-esame">${esame}</div>
      </div>`;
    }).join('');
  } catch {}
}

// ─── Nav events ───────────────────────────────────────────────────────────
function bindEvents() {
  $('btn-prev').onclick  = () => { _viewStart = addDays(_viewStart,-7); refreshWeek(); };
  $('btn-next').onclick  = () => { _viewStart = addDays(_viewStart, 7); refreshWeek(); };
  $('btn-oggi').onclick  = () => { _viewStart = getMon(new Date()); refreshWeek(); };
  $('btn-nuovo').onclick = () => openModal();
  $('btn-stampa').onclick = stampaDiario;
  $('btn-sidebar-toggle').onclick = () => $('app-sidebar').classList.toggle('open');
  $('modal-overlay').onclick = e => { if (e.target===e.currentTarget) closeModal(); };
  $('modal-close').onclick   = closeModal;
  $('btn-modal-cancel').onclick = closeModal;
  $('btn-salva-app').onclick    = salvaApp;
  $('btn-annulla-app').onclick  = annullaApp;
  $('app-tipo').onchange = () => {
    const p = _prestazioni.find(x => x.id===$('app-tipo').value);
    if (p) $('app-durata').value = p.durata_minuti;
  };
  $('paziente-search').addEventListener('input', onPazSearch);
  $('paziente-search').addEventListener('blur', () =>
    setTimeout(() => $('paz-results').classList.add('hidden'), 200));
  $('btn-nuovo-paz-toggle').onclick = () => {
    $('nuovo-paz-form').classList.toggle('hidden');
    $('btn-nuovo-paz-toggle').textContent =
      $('nuovo-paz-form').classList.contains('hidden') ? '+ Crea nuovo paziente' : '— Nascondi';
  };
  $('btn-salva-nuovo-paz').onclick = salvaNuovoPaz;
  $('btn-cambia-paz').onclick = resetPaziente;
}

// ─── Modal ────────────────────────────────────────────────────────────────
function openModal(opts={}) {
  _editId = opts.id || null;
  _pazienteId = null;
  resetPaziente();
  $('app-tipo').value   = '';
  $('app-durata').value = 20;
  $('app-note').value   = '';
  $('field-stato').style.display = 'none';
  $('btn-annulla-app').classList.add('hidden');
  $('nuovo-paz-form').classList.add('hidden');
  $('btn-nuovo-paz-toggle').textContent = '+ Crea nuovo paziente';
  $('app-data').value      = opts.date || toDateStr(new Date());
  $('app-ora-inizio').value = opts.time || '09:00';
  $('modal-title').textContent = _editId ? 'Modifica appuntamento' : 'Nuovo appuntamento';
  if (_editId) {
    $('btn-annulla-app').classList.remove('hidden');
    loadAppInModal(_editId);
  }
  $('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  $('modal-overlay').classList.add('hidden');
  _editId = null; _pazienteId = null;
}

async function loadAppInModal(id) {
  try {
    const a = await api.appuntamento(id);
    if (a.pazienti) {
      _pazienteId = a.paziente_id;
      showPazSelezionato(`${a.pazienti.cognome} ${a.pazienti.nome}`);
    }
    $('app-tipo').value = a.tipo_id || '';
    const t = new Date(a.data_ora_inizio);
    $('app-data').value = toDateStr(t);
    $('app-ora-inizio').value = `${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}`;
    $('app-durata').value = Math.round((new Date(a.data_ora_fine)-new Date(a.data_ora_inizio))/60000);
    $('app-note').value = a.note_segreteria || '';
    $('field-stato').style.display = '';
    renderStatoBtns(a.stato);
  } catch { alert('Errore nel caricamento'); closeModal(); }
}

function renderStatoBtns(attuale) {
  $('stato-btns').innerHTML = ['prenotato','arrivato','in_corso','refertato'].map(s =>
    `<button class="stato-btn stato-${s}${s===attuale?' active':''}"
      onclick="clickStato(this,'${s}')">${STATI[s]}</button>`
  ).join('');
}

function clickStato(btn, stato) {
  document.querySelectorAll('.stato-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  btn.dataset.stato = stato;
}

function getStatoAttivo() {
  const a = document.querySelector('.stato-btn.active');
  if (!a) return 'prenotato';
  return a.className.match(/stato-(\w+)/)?.[1] || 'prenotato';
}

// ─── Salva appuntamento ───────────────────────────────────────────────────
async function salvaApp() {
  if (!_pazienteId) { alert('Seleziona un paziente'); return; }
  const tipo_id = $('app-tipo').value;
  if (!tipo_id) { alert('Seleziona il tipo di esame'); return; }
  const data = $('app-data').value, ora = $('app-ora-inizio').value;
  if (!data || !ora) { alert('Inserisci data e ora'); return; }

  const inizio = new Date(`${data}T${ora}:00`);
  const durata = Number($('app-durata').value) || 20;
  const fine   = new Date(inizio.getTime() + durata*60000);

  const body = {
    paziente_id:     _pazienteId,
    tipo_id,
    data_ora_inizio: inizio.toISOString(),
    data_ora_fine:   fine.toISOString(),
    note_segreteria: $('app-note').value || null
  };
  if (_editId) body.stato = getStatoAttivo();

  const btn = $('btn-salva-app');
  btn.textContent = 'Salvataggio…'; btn.disabled = true;
  try {
    _editId ? await api.aggiornaAppuntamento(_editId, body) : await api.creaAppuntamento(body);
    closeModal();
    refreshWeek(); refreshSidebar();
  } catch(ex) {
    alert('Errore: ' + ex.message);
  } finally {
    btn.textContent = 'Salva'; btn.disabled = false;
  }
}

async function annullaApp() {
  if (!_editId || !confirm('Annullare questo appuntamento?')) return;
  try {
    await api.annullaAppuntamento(_editId);
    closeModal(); refreshWeek(); refreshSidebar();
  } catch(ex) { alert('Errore: '+ex.message); }
}

// ─── Paziente ─────────────────────────────────────────────────────────────
function resetPaziente() {
  _pazienteId = null;
  $('paziente-search').value = '';
  $('paziente-search').style.display = '';
  $('paz-results').classList.add('hidden');
  $('paz-selezionato').classList.add('hidden');
  $('btn-nuovo-paz-toggle').style.display = '';
}

function showPazSelezionato(nome) {
  $('paz-nome-display').textContent = nome;
  $('paz-selezionato').classList.remove('hidden');
  $('paziente-search').style.display = 'none';
  $('btn-nuovo-paz-toggle').style.display = 'none';
  $('paz-results').classList.add('hidden');
}

async function onPazSearch() {
  clearTimeout(_searchTimer);
  const q = $('paziente-search').value.trim();
  if (q.length < 2) { $('paz-results').classList.add('hidden'); return; }
  _searchTimer = setTimeout(async () => {
    try {
      const { data } = await api.pazienti(q);
      renderPazResults(data || []);
    } catch {}
  }, 300);
}

function renderPazResults(list) {
  const el = $('paz-results');
  if (!list.length) {
    el.innerHTML = '<div class="paz-item"><em>Nessun risultato</em></div>';
  } else {
    el.innerHTML = list.map(p => {
      const nasc = p.data_nascita ? new Date(p.data_nascita).toLocaleDateString('it-IT') : '';
      return `<div class="paz-item" onclick="selezionaPaz('${p.id}','${esc(p.cognome)} ${esc(p.nome)}')">
        <div class="paz-nome">${esc(p.cognome)} ${esc(p.nome)}</div>
        <div class="paz-info">${nasc?'Nato: '+nasc:''} ${p.codice_fiscale||''}</div>
      </div>`;
    }).join('');
  }
  el.classList.remove('hidden');
}

function selezionaPaz(id, nome) {
  _pazienteId = id;
  showPazSelezionato(nome);
}

async function salvaNuovoPaz() {
  const cognome = $('np-cognome').value.trim();
  const nome    = $('np-nome').value.trim();
  if (!cognome||!nome) { alert('Cognome e nome obbligatori'); return; }
  const btn = $('btn-salva-nuovo-paz');
  btn.textContent = 'Salvataggio…'; btn.disabled = true;
  try {
    const p = await api.creaPaziente({
      cognome, nome,
      data_nascita:   $('np-nascita').value || null,
      sesso:          $('np-sesso').value   || null,
      codice_fiscale: $('np-cf').value.trim()       || null,
      telefono:       $('np-telefono').value.trim() || null,
    });
    selezionaPaz(p.id, `${p.cognome} ${p.nome}`);
    $('nuovo-paz-form').classList.add('hidden');
    $('btn-nuovo-paz-toggle').textContent = '+ Crea nuovo paziente';
    // Reset campi
    ['np-cognome','np-nome','np-nascita','np-cf','np-telefono'].forEach(id => $(id).value='');
    $('np-sesso').value = '';
  } catch(ex) {
    alert('Errore: '+ex.message);
  } finally {
    btn.textContent = '✓ Salva paziente'; btn.disabled = false;
  }
}

// ─── Slot / App click ─────────────────────────────────────────────────────
function onSlotClick(date, time) { openModal({ date, time }); }
function onAppClick(id, e) { if(e) e.stopPropagation(); openModal({ id }); }

// ─── Stampa lista giornaliera ─────────────────────────────────────────────
async function stampaDiario() {
  try {
    const list = await api.appuntamentiOggi();
    const data = new Date().toLocaleDateString('it-IT',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
    const righe = list.map(a => {
      const nome  = a.pazienti ? `${a.pazienti.cognome} ${a.pazienti.nome}` : '—';
      const esame = a.tipi_prestazione?.nome || '';
      const note  = a.note_segreteria || '';
      return `<tr><td>${fmtTime(a.data_ora_inizio)}</td>
        <td><strong>${esc(nome)}</strong></td>
        <td>${esc(esame)}</td><td>${esc(note)}</td>
        <td><span class="badge stato-${a.stato}">${STATI[a.stato]}</span></td></tr>`;
    }).join('');
    const win = window.open('','_blank');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Agenda ${data}</title>
<style>body{font-family:Arial,sans-serif;padding:20px}h1{font-size:20px;margin-bottom:4px}
p.sub{color:#666;margin-bottom:20px}table{width:100%;border-collapse:collapse}
th{background:#f1f5f9;padding:8px 12px;text-align:left;border-bottom:2px solid #e2e8f0;font-size:11px;text-transform:uppercase}
td{padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px}
.badge{padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700}
.stato-prenotato{background:#dbeafe;color:#1e40af}.stato-arrivato{background:#fef3c7;color:#92400e}
.stato-in_corso{background:#d1fae5;color:#065f46}.stato-refertato{background:#f1f5f9;color:#475569}
</style></head><body>
<h1>🏥 Lista appuntamenti</h1>
<p class="sub">${data} — ${list.length} appuntament${list.length===1?'o':'i'}</p>
<table><thead><tr><th>Ora</th><th>Paziente</th><th>Esame</th><th>Note</th><th>Stato</th></tr></thead>
<tbody>${righe}</tbody></table></body></html>`);
    win.document.close(); win.print();
  } catch(e) { alert('Errore stampa: '+e.message); }
}

// ─── Shortcut ─────────────────────────────────────────────────────────────
function $(id) { return document.getElementById(id); }
