// ═══════════════════════════════════════════════════════════════════════════
// AGENDA STUDIO — Frontend
// ═══════════════════════════════════════════════════════════════════════════

const CAL_START = 8;          // 08:00
const CAL_END   = 20;         // 20:00
const PX_PER_MIN = 2;         // 2px per minuto → 1 ora = 120px
const SLOT_MIN  = 30;         // slot cliccabili ogni 30 min
const SLOT_H    = SLOT_MIN * PX_PER_MIN; // 40px

const STATI = {
  in_attesa: '🌐 Online (in attesa)',
  prenotato: 'Prenotato',
  arrivato:  'Arrivato',
  in_corso:  'In corso',
  refertato: 'Refertato',
  annullato: 'Annullato'
};
const GIORNI = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];

const BLOCCO_TIPI = {
  mattina:    { label: 'Mattina bloccata',    startH: 8,  endH: 14 },
  pomeriggio: { label: 'Pomeriggio bloccato', startH: 14, endH: 20 },
  giornata:   { label: 'Giornata bloccata',   startH: 8,  endH: 20 },
};

// ── Calendario continuo (mobile + desktop) ───────────────────────────────
const CAL_WEEKS_MOB   = 5;    // settimane renderizzate (2 prima + corrente + 2 dopo)
const CAL_SHIFT_DAYS  = 14;   // giorni di shift al re-center (2 settimane)
const COL_W_MOB       = 68;   // larghezza colonna giorno mobile (px)
const TIME_W_MOB      = 44;   // larghezza colonna ore mobile (px)
const COL_W_DESK      = 148;  // larghezza colonna giorno desktop (px) — ~7 colonne visibili
const TIME_W_DESK     = 52;   // larghezza colonna ore desktop (px)
// Larghezza corrente (usata dal listener scroll)
function getColW()  { return isMobile() ? COL_W_MOB  : COL_W_DESK;  }
function getTimeW() { return isMobile() ? TIME_W_MOB : TIME_W_DESK; }
// Nomi giorni indicizzati per d.getDay() (0=Dom…6=Sab)
const GIORNI_IT = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab'];

// ─── Stato ────────────────────────────────────────────────────────────────
let _user         = null;
let _viewStart    = null;   // lunedì della settimana visualizzata
let _calStart     = null;   // inizio range renderizzato su mobile (CAL_WEEKS_MOB settimane)
let _mobileDay    = null;   // giorno corrente in vista mobile
let _appointments = [];
let _prestazioni  = [];
let _blocchi          = [];     // blocchi agenda (festività, impegni)
let _indisponibilita  = [];     // blocchi fascia oraria (mattina/pomeriggio/giornata)
let _editId           = null;   // id appuntamento in modifica
let _pazienteId       = null;   // paziente selezionato nel modal
let _searchTimer      = null;
let _bloccoTipo       = null;   // tipo selezionato nel modal blocco fascia
let _pazCache         = {};     // cache pazienti: id → oggetto completo
let _scrollShift      = null;   // px da sommare allo scrollLeft corrente dopo re-render
let _firstRender      = true;   // primo render mobile: posiziona su settimana corrente
let _scrollDebounce   = null;
let _extendingRange   = false;  // lock: evita doppio fetch contemporaneo

function isMobile() { return window.innerWidth <= 768; }

// ─── Utils ────────────────────────────────────────────────────────────────
const toISO    = d => d.toISOString();
const toDate   = s => toDateStr(new Date(s));
const addDays  = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
function toDateStr(d) {
  // Usa la data LOCALE (non UTC) per evitare sfasamenti di fuso orario
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const g = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${g}`;
}
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

// Logout gestito dal menu hamburger

async function onLoginOk(user) {
  _user = user;
  $('login-screen').classList.add('hidden');
  $('app').classList.remove('hidden');
  $('user-badge').textContent = user.nome_display || user.username;
  try { _prestazioni = await api.prestazioni(); } catch { _prestazioni = []; }
  fillPrestazioni();
  _viewStart  = getMon(new Date());
  _calStart   = addDays(_viewStart, -CAL_SHIFT_DAYS); // 2 settimane prima (buffer 5 sett.)
  await refreshWeek();
  await refreshSidebar();
  initSocket();
  bindEvents();
  initSwipe();
  initScrollListener();
  window.addEventListener('resize', () => { _firstRender = true; renderCalendar(); renderPeriod(); });
}

// ─── Socket.io ────────────────────────────────────────────────────────────
function initSocket() {
  try {
    const s = io();
    const refresh = () => { refreshWeek(); refreshSidebar(); };
    s.on('appuntamento:nuovo',      refresh);
    s.on('appuntamento:aggiornato', refresh);
    s.on('appuntamento:annullato',  refresh);
    s.on('indisponibilita:creata',  () => refreshWeek());
    s.on('indisponibilita:rimossa', () => refreshWeek());
  } catch {}
}

// ─── Calendar load & render ───────────────────────────────────────────────
async function refreshWeek() {
  if (!_calStart) _calStart = addDays(getMon(_viewStart), -CAL_SHIFT_DAYS);
  const fromDate = _calStart;
  const toDate   = addDays(_calStart, CAL_WEEKS_MOB * 7);
  const from     = toISO(fromDate);
  const to       = toISO(toDate);
  try { _appointments    = await api.appuntamenti(from, to); }   catch { _appointments = []; }
  try { _blocchi         = await api.blocchi(from, to); }         catch { _blocchi = []; }
  try { _indisponibilita = await api.indisponibilita(
    toDateStr(fromDate), toDateStr(addDays(toDate, -1))
  ); }                                                            catch { _indisponibilita = []; }
  renderCalendar();
  renderPeriod();
}

function renderPeriod() {
  const txt = `${fmtDateShort(_viewStart)} — ${fmtDateShort(addDays(_viewStart,6))}`;
  $('header-period').textContent = txt;
  const el = $('mobile-day-label');
  if (el) el.textContent = txt;
}

function renderCalendar() {
  const numDays   = CAL_WEEKS_MOB * 7;
  const colW      = getColW();
  const timeW     = getTimeW();
  const startDate = _calStart || _viewStart;
  const gridCols  = `${timeW}px repeat(${numDays},${colW}px)`;

  // Salva scroll corrente prima di ricostruire il DOM
  const mainEl      = document.querySelector('.app-main');
  const savedScroll = mainEl ? mainEl.scrollLeft : 0;

  const totalMin = (CAL_END - CAL_START) * 60;
  const totalPx  = totalMin * PX_PER_MIN;

  // ── Header (con badge festività / ecografia)
  let hdr = `<div class="cal-header" style="grid-template-columns:${gridCols}"><div class="cal-th-time"></div>`;
  for (let i = 0; i < numDays; i++) {
    const d          = addDays(startDate, i);
    const dateStr    = toDateStr(d);
    const bloccoGiorno = _blocchi.find(b => b.tutto_il_giorno && b.data_ora_inizio.startsWith(dateStr));
    const isDomenica   = d.getDay() === 0;
    const isEcografia  = d.getDay() >= 1 && d.getDay() <= 5;
    const isChiuso     = bloccoGiorno || isDomenica;
    const motivoCh     = isDomenica ? 'Domenica — giorno di chiusura' : (bloccoGiorno?.motivo || '');
    const giorno       = GIORNI_IT[d.getDay()];
    const cls = (isToday(d) ? ' today' : '') +
                (isChiuso ? ' festivo' : '') +
                (isEcografia && !isChiuso ? ' ecografia' : '');
    hdr += `<div class="cal-th-day${cls}">
      <span class="cal-th-dayname">${giorno}</span>
      <span class="cal-th-daynum">${d.getDate()}</span>
      ${isChiuso ? `<span class="cal-th-festivo" title="${esc(motivoCh)}">🔴</span>` : ''}
    </div>`;
  }
  hdr += `</div>`;

  // ── Colonna ore (sticky a sinistra)
  let timeLbls = `<div class="cal-time-col" style="height:${totalPx}px">`;
  for (let m = 0; m <= totalMin; m += 60) {
    const h = CAL_START + m / 60;
    timeLbls += `<div class="cal-lbl" style="top:${m*PX_PER_MIN}px">${String(h).padStart(2,'0')}:00</div>`;
  }
  timeLbls += `</div>`;

  // ── Colonne giorno
  let days = '';
  for (let i = 0; i < numDays; i++) {
    const d          = addDays(startDate, i);
    const dateStr    = toDateStr(d);
    const todayCls   = isToday(d) ? ' today' : '';
    const bloccoGiorno = _blocchi.find(b => b.tutto_il_giorno && b.data_ora_inizio.startsWith(dateStr));
    const isDomenica   = d.getDay() === 0;
    const isEcografia  = d.getDay() >= 1 && d.getDay() <= 5;
    const isChiuso     = bloccoGiorno || isDomenica;
    const motivoCh     = isDomenica ? 'Domenica — giorno di chiusura' : (bloccoGiorno?.motivo || '');
    const festivoCls   = isChiuso ? ' festivo' : (isEcografia ? ' ecografia' : '');

    let lines = '';
    for (let m = 0; m <= totalMin; m += 30)
      lines += `<div class="cal-hline${m%60===0?' major':''}" style="top:${m*PX_PER_MIN}px"></div>`;

    let slots = '';
    for (let m = 0; m < totalMin; m += SLOT_MIN) {
      const absMin = CAL_START * 60 + m;
      const hh = String(Math.floor(absMin/60)).padStart(2,'0');
      const mm = String(absMin%60).padStart(2,'0');
      slots += isChiuso
        ? `<div class="cal-slot cal-slot-blocked" style="top:${m*PX_PER_MIN}px;height:${SLOT_H}px"
            onclick="onSlotBlockedClick('${esc(motivoCh)}')"></div>`
        : `<div class="cal-slot" style="top:${m*PX_PER_MIN}px;height:${SLOT_H}px"
            onclick="onSlotClick('${dateStr}','${hh}:${mm}')"></div>`;
    }

    const bloccoOverlay = isChiuso
      ? `<div class="cal-blocco-overlay" title="${esc(motivoCh)}"><span class="cal-blocco-label">${esc(motivoCh)}</span></div>` : '';

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
      appHtml += `<div class="cal-app stato-${stato}" style="top:${top}px;height:${height}px"
        onclick="onAppClick('${a.id}',event)" title="${pazNome} — ${esame}">
        <div class="cal-app-time">${fmtTime(a.data_ora_inizio)}</div>
        <div class="cal-app-nome">${pazNome}</div>
        ${height>=50?`<div class="cal-app-esame">${esame}</div>`:''}
      </div>`;
    }

    let fasceBlocchi = '';
    for (const b of _indisponibilita.filter(x => x.data === dateStr)) {
      const bt = BLOCCO_TIPI[b.tipo];
      if (!bt) continue;
      const top    = (bt.startH - CAL_START) * 60 * PX_PER_MIN;
      const height = (bt.endH - bt.startH) * 60 * PX_PER_MIN;
      const motivo  = b.motivo ? esc(b.motivo) : '';
      const tooltip = `${bt.label}${motivo ? ' — ' + motivo : ''}\n\nClicca per rimuovere il blocco`;
      fasceBlocchi += `<div class="cal-blocco" style="top:${top}px;height:${height}px"
        onclick="onBloccoClick('${b.id}',event)" title="${tooltip}">
        <span class="cal-blocco-icon">🔒</span>
        <span class="cal-blocco-label">${bt.label}</span>
        ${motivo ? `<span class="cal-blocco-motivo">${motivo}</span>` : ''}
      </div>`;
    }

    // ── Impegni personali da Google Calendar (blocchi a orario, non rimovibili)
    // Mostra un blocco grosso "Non prenotabile" sullo slot occupato, senza
    // svelare i dettagli privati dell'impegno (etichetta generica).
    let impegniGcal = '';
    for (const b of _blocchi.filter(x => !x.tutto_il_giorno && x.tipo === 'google_calendar' && x.data_ora_inizio.startsWith(dateStr))) {
      const startM = minFromMidnight(b.data_ora_inizio);
      const endM   = minFromMidnight(b.data_ora_fine);
      const top    = (startM - CAL_START*60) * PX_PER_MIN;
      const height = Math.max((endM - startM) * PX_PER_MIN, 30);
      if (top < 0 || top >= totalPx) continue;
      const oraTxt = `${fmtTime(b.data_ora_inizio)}–${fmtTime(b.data_ora_fine)}`;
      impegniGcal += `<div class="cal-blocco cal-blocco-gcal" style="top:${top}px;height:${height}px"
        onclick="onImpegnoClick(event)" title="Impegno personale ${oraTxt} — slot non prenotabile">
        <span class="cal-blocco-icon">🚫</span>
        <span class="cal-blocco-label">Non prenotabile</span>
        ${height>=44?`<span class="cal-blocco-motivo">Impegno personale</span>`:''}
      </div>`;
    }

    days += `<div class="cal-day${todayCls}${festivoCls}" style="height:${totalPx}px">${lines}${slots}${bloccoOverlay}${fasceBlocchi}${impegniGcal}${appHtml}</div>`;
  }

  // ── Applica larghezza al wrapper (colonne pixel fissi, scrollabile)
  const calWrap = $('cal-wrap');
  calWrap.style.width    = `${timeW + numDays * colW}px`;
  calWrap.style.minWidth = '0';

  calWrap.innerHTML = `${hdr}<div class="cal-body" style="grid-template-columns:${gridCols}">${timeLbls}${days}</div>`;

  // ── Gestione scroll (uguale su mobile e desktop)
  if (mainEl) {
    if (_scrollShift !== null) {
      // Edge re-center: shift applicato allo scroll ATTUALE (l'utente ha continuato a scorrere durante il fetch)
      mainEl.scrollLeft = Math.max(0, savedScroll + _scrollShift);
      _scrollShift  = null;
      _firstRender  = false;
    } else if (!_firstRender) {
      // Re-render normale: mantieni posizione corrente
      mainEl.scrollLeft = savedScroll;
    } else {
      // Primo render: posiziona sulla settimana corrente (_viewStart)
      const dayIdx = Math.max(0, Math.round((getMon(_viewStart) - startDate) / 86400000));
      mainEl.scrollLeft = dayIdx * colW;
      _firstRender = false;
    }
  }
}

// ─── Navigazione settimana (mobile: frecce, desktop: frecce + swipe) ─────
function navMobileWeek(n) {
  const el = document.querySelector('.app-main');
  if (el) el.scrollBy({ left: n * 7 * getColW(), behavior: 'smooth' });
}

function goToToday() {
  _viewStart      = getMon(new Date());
  _calStart       = addDays(_viewStart, -CAL_SHIFT_DAYS);
  _firstRender    = true;
  _extendingRange = false;
  refreshWeek();
}

// ─── Tasto freccia (desktop) ──────────────────────────────────────────────
function initSwipe() {
  document.addEventListener('keydown', e => {
    if (['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) return;
    const el = document.querySelector('.app-main');
    if (e.key === 'ArrowRight') { e.preventDefault(); if(el) el.scrollBy({left: 7*getColW(), behavior:'smooth'}); }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); if(el) el.scrollBy({left:-7*getColW(), behavior:'smooth'}); }
  });
}

// ─── Scroll continuo multi-settimana (mobile) ─────────────────────────────
function initScrollListener() {
  const mainEl = document.querySelector('.app-main');
  if (!mainEl) return;
  mainEl.addEventListener('scroll', onCalMainScroll, { passive: true });
}

function onCalMainScroll() {
  if (!_calStart) return;
  const el = document.querySelector('.app-main');
  if (!el) return;

  // Aggiorna etichetta periodo in tempo reale
  const colW   = getColW();
  const dayIdx = Math.max(0, Math.floor(el.scrollLeft / colW));
  const visMon = getMon(addDays(_calStart, dayIdx));
  if (toDateStr(visMon) !== toDateStr(_viewStart)) {
    _viewStart = visMon;
    renderPeriod();
  }

  // Prefetch anticipato: trigger a 1 settimana dal bordo
  if (_extendingRange) return;

  clearTimeout(_scrollDebounce);
  _scrollDebounce = setTimeout(async () => {
    if (!_calStart || _extendingRange) return;
    const el2 = document.querySelector('.app-main');
    if (!el2) return;
    const cw        = getColW();
    const maxScroll = el2.scrollWidth - el2.clientWidth;
    const triggerPx = 7 * cw;   // 1 settimana dal bordo

    if (el2.scrollLeft < triggerPx) {
      _extendingRange = true;
      _calStart       = addDays(_calStart, -CAL_SHIFT_DAYS);
      _scrollShift    = CAL_SHIFT_DAYS * cw;
      await refreshWeek();
      _extendingRange = false;
    } else if (el2.scrollLeft > maxScroll - triggerPx) {
      _extendingRange = true;
      _calStart       = addDays(_calStart, CAL_SHIFT_DAYS);
      _scrollShift    = -(CAL_SHIFT_DAYS * cw);
      await refreshWeek();
      _extendingRange = false;
    }
  }, 150);
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
  $('btn-prev').onclick  = () => { const el=document.querySelector('.app-main'); if(el) el.scrollBy({left:-7*getColW(),behavior:'smooth'}); };
  $('btn-next').onclick  = () => { const el=document.querySelector('.app-main'); if(el) el.scrollBy({left: 7*getColW(),behavior:'smooth'}); };
  $('btn-oggi').onclick  = () => goToToday();
  $('btn-nuovo').onclick = () => openModal();
  $('btn-stampa').onclick = stampaDiario;
  $('btn-menu').onclick = e => { e.stopPropagation(); $('menu-dropdown').classList.toggle('hidden'); };
  document.addEventListener('click', () => $('menu-dropdown').classList.add('hidden'));
  $('menu-dropdown').addEventListener('click', e => e.stopPropagation());
  $('modal-overlay').onclick = e => { if (e.target===e.currentTarget) closeModal(); };
  $('modal-close').onclick   = closeModal;
  $('btn-modal-cancel').onclick = closeModal;
  $('btn-salva-app').onclick    = salvaApp;
  $('btn-annulla-app').onclick  = annullaApp;
  $('app-tipo').onchange = () => {
    const p = _prestazioni.find(x => x.id===$('app-tipo').value);
    if (p) $('app-durata').value = p.durata_minuti;
    checkPreparazione();
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

  // iOS fix: ascolta il resize del visual viewport (apertura/chiusura tastiera)
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', _adjustModalToViewport);
    window.visualViewport.addEventListener('scroll', _adjustModalToViewport);
  }
}

// ─── Popola select prestazioni ────────────────────────────────────────────
function fillPrestazioni() {
  const sel = $('app-tipo');
  sel.innerHTML = '<option value="">— seleziona —</option>';
  for (const p of _prestazioni) {
    const opt = document.createElement('option');
    opt.value       = p.id;
    opt.textContent = `${p.nome} (${p.durata_minuti} min)`;
    sel.appendChild(opt);
  }
}

// ─── iOS Safari: fix tastiera che nasconde il pulsante Salva ─────────────
// Su iOS, position:fixed è ancorato alla "layout viewport" (tutta la pagina),
// mentre la tastiera occupa la parte bassa della "visual viewport" (quello che vedi).
// Risultato: il footer del modal (con il pulsante Salva) finisce SOTTO la tastiera.
// Fix: ascoltiamo visualViewport.resize e aggiorniamo top/height dell'overlay
// in modo che copra solo l'area visibile sopra la tastiera.
function _adjustModalToViewport() {
  if (!window.visualViewport || window.innerWidth > 768) return;
  const overlay = document.getElementById('modal-overlay');
  if (!overlay || overlay.classList.contains('hidden')) return;
  const vv = window.visualViewport;
  overlay.style.top    = vv.offsetTop + 'px';
  overlay.style.height = vv.height    + 'px';
  overlay.style.bottom = 'auto';
  overlay.dataset.vv   = '1'; // attiva regole CSS che usano % invece di vh
}
function _resetModalViewport() {
  const overlay = document.getElementById('modal-overlay');
  if (!overlay) return;
  overlay.style.top = '';
  overlay.style.height = '';
  overlay.style.bottom = '';
  delete overlay.dataset.vv;
}

// ─── Modal ────────────────────────────────────────────────────────────────
function openModal(opts={}) {
  _editId = opts.id || null;
  _pazienteId = null;
  resetPaziente();
  $('app-tipo').value   = '';
  $('app-durata').value = 30;
  $('app-note').value   = '';
  $('app-invia-sms').checked = true; // default: invia promemoria
  $('prep-reminder').classList.add('hidden');
  $('field-stato').style.display = 'none';
  $('field-fattura').classList.add('hidden');
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
  _adjustModalToViewport(); // iOS: adatta subito all'altezza corrente
}

function closeModal() {
  $('modal-overlay').classList.add('hidden');
  _resetModalViewport();    // iOS: ripristina stile overlay
  _editId = null; _pazienteId = null;
}

async function loadAppInModal(id) {
  try {
    const a = await api.appuntamento(id);
    if (a.pazienti) {
      _pazienteId = a.paziente_id;
      _pazCache[a.paziente_id] = a.pazienti;
      showPazSelezionato(`${a.pazienti.cognome} ${a.pazienti.nome}`);
      showPazInfo(a.pazienti);   // dati in sola lettura + link "Modifica"
    }
    $('app-tipo').value = a.tipo_id || '';
    checkPreparazione();
    const t = new Date(a.data_ora_inizio);
    $('app-data').value = toDateStr(t);
    $('app-ora-inizio').value = `${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}`;
    $('app-durata').value = Math.round((new Date(a.data_ora_fine)-new Date(a.data_ora_inizio))/60000);
    $('app-note').value = a.note_segreteria || '';
    $('app-invia-sms').checked = a.invia_sms_promemoria !== false; // default true
    $('field-stato').style.display = '';
    renderStatoBtns(a.stato);
    renderFatturaBox(a);
  } catch { alert('Errore nel caricamento'); closeModal(); }
}

// ─── Fattura elettronica ──────────────────────────────────────────────────
function renderFatturaBox(a) {
  const box    = $('field-fattura');
  const info   = $('fattura-info');
  const statiConFattura = ['prenotato','arrivato','refertato'];

  if (!statiConFattura.includes(a.stato)) {
    box.classList.add('hidden'); return;
  }
  box.classList.remove('hidden');

  if (a.numero_fattura) {
    // Fattura già emessa
    info.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;
                  background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;
                  font-size:13px;color:#166534;">
        ✅ <strong>Fattura ${a.numero_fattura}</strong> — già inviata al SDI
      </div>`;
  } else {
    // Fattura da emettere
    const importo = ((a.importo_pagato_cent || 8000) / 100).toFixed(2);
    info.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        <button onclick="emettiFattura(${a.id})" id="btn-emetti-fattura"
          style="background:#0ea5e9;color:#fff;border:none;border-radius:6px;
                 padding:7px 14px;cursor:pointer;font-size:13px;font-weight:600;">
          🧾 Emetti fattura (€ ${importo})
        </button>
        <span style="font-size:12px;color:#6b7280;">Verrà inviata al SDI tramite Aruba</span>
      </div>`;
  }
}

async function emettiFattura(appId) {
  const btn = $('btn-emetti-fattura');
  btn.textContent = '⏳ Invio in corso…';
  btn.disabled    = true;
  try {
    const res = await fetch('/api/fatture/crea', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json',
                 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body:    JSON.stringify({ appuntamento_id: appId }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Errore sconosciuto');

    $('fattura-info').innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;
                  background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;
                  font-size:13px;color:#166534;">
        ✅ <strong>Fattura ${data.numeroFattura}</strong> — inviata al SDI con successo
      </div>`;
  } catch (e) {
    btn.textContent = '🧾 Emetti fattura';
    btn.disabled    = false;
    alert('Errore emissione fattura: ' + e.message);
  }
}

function renderStatoBtns(attuale) {
  // Banner informativo per prenotazioni online in attesa
  const banner = attuale === 'in_attesa'
    ? `<div style="background:#fef3c7;border:1px solid #fde68a;border-radius:6px;
         padding:8px 10px;margin-bottom:8px;font-size:12px;color:#78350f;">
         🌐 Prenotazione online — in attesa di approvazione.<br>
         Clicca <strong>Prenotato</strong> per confermare manualmente.
       </div>`
    : '';
  $('stato-btns').innerHTML = banner + ['prenotato','arrivato','refertato'].map(s =>
    `<button class="stato-btn stato-${s}${s===attuale?' active':''}"
      data-stato="${s}" onclick="clickStato(this,'${s}')">${STATI[s]}</button>`
  ).join('');
}

function clickStato(btn, stato) {
  document.querySelectorAll('.stato-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  btn.dataset.stato = stato;
}

function getStatoAttivo() {
  return document.querySelector('.stato-btn.active')?.dataset?.stato || 'prenotato';
}

// ─── Salva appuntamento ───────────────────────────────────────────────────
async function salvaApp() {
  if (!_pazienteId) { alert('Seleziona un paziente'); return; }
  const tipo_id = $('app-tipo').value;
  if (!tipo_id) { alert('Seleziona il tipo di esame'); return; }
  const data = $('app-data').value, ora = $('app-ora-inizio').value;
  if (!data || !ora) { alert('Inserisci data e ora'); return; }

  const inizio = new Date(`${data}T${ora}:00`);
  const durata = Number($('app-durata').value) || 30;
  const fine   = new Date(inizio.getTime() + durata*60000);

  const body = {
    paziente_id:     _pazienteId,
    tipo_id,
    data_ora_inizio: inizio.toISOString(),
    data_ora_fine:   fine.toISOString(),
    note_segreteria: $('app-note').value || null,
    invia_sms_promemoria: $('app-invia-sms').checked,
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
  $('btn-nuovo-paz-toggle').textContent = '+ Crea nuovo paziente';
  // Nascondi pannello info e form paziente
  $('paz-info-panel').classList.add('hidden');
  $('nuovo-paz-form').classList.add('hidden');
  ['np-cognome','np-nome','np-nascita','np-cf','np-telefono','np-email'].forEach(id => $(id).value = '');
  $('np-sesso').value = '';
  $('btn-salva-nuovo-paz').textContent = '✓ Salva paziente';
}

function showPazSelezionato(nome) {
  $('paz-nome-display').textContent = nome;
  $('paz-selezionato').classList.remove('hidden');
  $('paziente-search').style.display = 'none';
  $('btn-nuovo-paz-toggle').style.display = 'none';  // nascosto: form sempre visibile
  $('paz-results').classList.add('hidden');
}

// Mostra i dati del paziente in sola lettura con link "Modifica"
function showPazInfo(p) {
  if (!p) return;
  const nasc = p.data_nascita
    ? new Date(p.data_nascita + 'T12:00:00').toLocaleDateString('it-IT') : '—';
  const sesso = p.sesso === 'M' ? 'Maschio' : p.sesso === 'F' ? 'Femmina' : '—';
  $('paz-info-nascita').textContent = nasc;
  $('paz-info-sesso').textContent   = sesso;
  $('paz-info-tel').textContent     = p.telefono || '—';
  $('paz-info-cf').textContent      = (p.codice_fiscale || '—').toUpperCase();
  $('paz-info-panel').classList.remove('hidden');
  $('btn-modifica-paz').style.display = '';   // mostra link modifica
  $('nuovo-paz-form').classList.add('hidden'); // form nascosto (sola lettura)
}

// Quando l'utente clicca "Modifica dati paziente": mostra il form editabile
function abilitaModificaPaz() {
  const p = _pazCache[_pazienteId];
  if (!p) return;
  $('np-cognome').value  = p.cognome || '';
  $('np-nome').value     = p.nome    || '';
  $('np-nascita').value  = p.data_nascita ? p.data_nascita.split('T')[0] : '';
  $('np-sesso').value    = p.sesso   || '';
  $('np-cf').value       = (p.codice_fiscale || '').toUpperCase();
  $('np-telefono').value = p.telefono || '';
  $('np-email').value    = p.email || '';
  $('nuovo-paz-form').classList.remove('hidden');
  $('btn-modifica-paz').style.display = 'none'; // nasconde il link mentre il form è aperto
  $('btn-salva-nuovo-paz').textContent = '✓ Aggiorna paziente';
  $('np-cognome').focus();
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
  // Metti in cache tutti i pazienti trovati (id → oggetto)
  list.forEach(p => { _pazCache[p.id] = p; });
  const el = $('paz-results');
  if (!list.length) {
    el.innerHTML = '<div class="paz-item"><em>Nessun risultato</em></div>';
  } else {
    el.innerHTML = list.map(p => {
      const nasc = p.data_nascita ? new Date(p.data_nascita).toLocaleDateString('it-IT') : '';
      const tel  = p.telefono ? ' · ' + p.telefono : '';
      return `<div class="paz-item" onclick="selezionaPaz('${p.id}')">
        <div class="paz-nome">${esc(p.cognome)} ${esc(p.nome)}</div>
        <div class="paz-info">${nasc ? '📅 ' + nasc : ''}${tel}</div>
      </div>`;
    }).join('');
  }
  el.classList.remove('hidden');
}

async function selezionaPaz(id) {
  _pazienteId = id;
  let p = _pazCache[id];
  if (!p) {
    try { p = await api.paziente(id); _pazCache[id] = p; } catch {}
  }
  const nome = p ? `${p.cognome} ${p.nome}` : id;
  showPazSelezionato(nome);
  showPazInfo(p);  // dati in sola lettura + link "Modifica"
}

async function salvaNuovoPaz() {
  const cognome  = $('np-cognome').value.trim();
  const nome     = $('np-nome').value.trim();
  const telefono = $('np-telefono').value.trim();
  if (!cognome || !nome)      { alert('Cognome e nome obbligatori'); return; }
  if (!$('np-nascita').value) { alert('La data di nascita è obbligatoria'); $('np-nascita').focus(); return; }
  if (!telefono)              { alert('Il numero di telefono è obbligatorio'); $('np-telefono').focus(); return; }

  const btn  = $('btn-salva-nuovo-paz');
  const dati = {
    cognome, nome,
    data_nascita:   $('np-nascita').value || null,
    sesso:          $('np-sesso').value   || null,
    codice_fiscale: $('np-cf').value.trim().toUpperCase() || null,
    telefono,
    email:          $('np-email').value.trim() || null,
  };

  btn.textContent = 'Salvataggio…'; btn.disabled = true;

  // ── MODALITÀ AGGIORNA (paziente già selezionato) ──────────────────────
  if (_pazienteId) {
    try {
      const p = await api.aggiornaPaziente(_pazienteId, dati);
      _pazCache[_pazienteId] = { ...dati, id: _pazienteId, ...p };
      $('paz-nome-display').textContent = `${cognome} ${nome}`;
      btn.textContent = '✓ Aggiornato!';
      setTimeout(() => { btn.textContent = '✓ Aggiorna paziente'; btn.disabled = false; }, 1500);
    } catch(ex) {
      alert('Errore aggiornamento: ' + ex.message);
      btn.textContent = '✓ Aggiorna paziente'; btn.disabled = false;
    }
    return;
  }

  // ── MODALITÀ CREA (nuovo paziente) ────────────────────────────────────
  try {
    const p = await api.creaPaziente(dati);
    // Paziente creato: selezionalo e mostra il form in modalità modifica
    _pazienteId = p.id;
    _pazCache[p.id] = p;
    showPazSelezionato(`${p.cognome} ${p.nome}`);
    fillPazForm(p);
    btn.textContent = '✓ Salvato!';
    setTimeout(() => { btn.textContent = '✓ Aggiorna paziente'; btn.disabled = false; }, 1500);
  } catch(ex) {
    if (ex.status === 409 && ex.paziente) {
      const p   = ex.paziente;
      const nasc = p.data_nascita
        ? new Date(p.data_nascita + 'T12:00:00').toLocaleDateString('it-IT') : 'non inserita';

      if (ex.motivo === 'telefono') {
        alert(`⚠️ Il numero ${p.telefono} è già associato a:\n${p.cognome} ${p.nome} (nato/a il ${nasc})\n\nIl nuovo paziente verrà salvato ugualmente.`);
        try {
          const p2 = await api.creaPaziente({ ...dati, forza_creazione: true });
          _pazienteId = p2.id; _pazCache[p2.id] = p2;
          showPazSelezionato(`${p2.cognome} ${p2.nome}`);
          fillPazForm(p2);
          btn.textContent = '✓ Aggiorna paziente'; btn.disabled = false;
        } catch(ex2) { alert('Errore: ' + ex2.message); btn.textContent = '✓ Salva paziente'; btn.disabled = false; }
      } else {
        const msg = `⚠️ Paziente già presente:\n\n${p.cognome} ${p.nome}\nNato/a il: ${nasc}\nTel: ${p.telefono||'—'}\n\nOK = usa il paziente esistente\nAnnulla = torna al form`;
        if (confirm(msg)) {
          await selezionaPaz(p.id);   // carica e mostra il paziente esistente
        }
        btn.textContent = '✓ Salva paziente'; btn.disabled = false;
      }
    } else {
      alert('Errore: ' + ex.message);
      btn.textContent = '✓ Salva paziente'; btn.disabled = false;
    }
  }
}

// ─── Slot / App click ─────────────────────────────────────────────────────
function onSlotClick(date, time) {
  // Blocco se lo slot cade in una fascia indisponibile
  const [hh, mm] = time.split(':').map(Number);
  const slotMin  = hh * 60 + mm;
  for (const b of _indisponibilita.filter(x => x.data === date)) {
    const bt = BLOCCO_TIPI[b.tipo];
    if (!bt) continue;
    if (slotMin >= bt.startH * 60 && slotMin < bt.endH * 60) return;
  }
  openModal({ date, time });
}
function onSlotBlockedClick(motivo) {
  alert(`⛔ Giorno non disponibile: ${motivo}\n\nIl centro è chiuso in questa data.`);
}
function onImpegnoClick(e) {
  if (e) e.stopPropagation();
  alert('🚫 Slot non prenotabile\n\nQui hai un impegno personale segnato sul tuo Google Calendar.\nLo slot è bloccato per le prenotazioni online.\n\nPer liberarlo, rimuovi o sposta l\'impegno dal Google Calendar.');
}
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
.stato-in_attesa{background:#fef3c7;color:#78350f}
</style></head><body>
<h1>🏥 Lista appuntamenti</h1>
<p class="sub">${data} — ${list.length} appuntament${list.length===1?'o':'i'}</p>
<table><thead><tr><th>Ora</th><th>Paziente</th><th>Esame</th><th>Note</th><th>Stato</th></tr></thead>
<tbody>${righe}</tbody></table></body></html>`);
    win.document.close(); win.print();
  } catch(e) { alert('Errore stampa: '+e.message); }
}

// ─── Menu hamburger ────────────────────────────────────────────────────────
function chiudiMenu()  { $('menu-dropdown').classList.add('hidden'); }
function toggleMenu()  { $('menu-dropdown').classList.toggle('hidden'); }

function menuNuovoApp() {
  chiudiMenu();
  openModal({});
}

function menuStampa() {
  chiudiMenu();
  stampaDiario();
}

function menuLogout() {
  chiudiMenu();
  api.setToken(null);
  _user = null;
  showLogin();
}

function menuBlocco() {
  chiudiMenu();
  openModalBlocco(toDateStr(new Date()));
}

function menuCredenziali() {
  chiudiMenu();
  $('cred-pass-attuale').value  = '';
  $('cred-nuovo-username').value = '';
  $('cred-nuova-pass').value    = '';
  $('cred-conferma-pass').value = '';
  $('cred-err').classList.add('hidden');
  $('cred-overlay').onclick = e => { if (e.target === e.currentTarget) chiudiCredenziali(); };
  $('cred-overlay').classList.remove('hidden');
  setTimeout(() => $('cred-pass-attuale').focus(), 80);
}

function menuArchivio() {
  chiudiMenu();
  apriArchivio();
}

// ─── Sistema TS / 730 ─────────────────────────────────────────────────────
let _tsRighe = []; // cache righe caricate

function menuSistemaTS() {
  chiudiMenu();
  // Preseleziona anno corrente
  const anno = new Date().getFullYear();
  const sel = $('ts-anno');
  // Popola anni disponibili (anno corrente + 3 precedenti)
  sel.innerHTML = '';
  for (let a = anno; a >= anno - 3; a--) {
    const opt = document.createElement('option');
    opt.value = a; opt.textContent = a;
    sel.appendChild(opt);
  }
  $('ts-overlay').classList.remove('hidden');
  caricaTS();
}

function chiudiSistemaTS() {
  $('ts-overlay').classList.add('hidden');
}

async function caricaTS() {
  const anno   = $('ts-anno').value;
  const filtro = $('ts-filtro-stato').value;
  $('ts-tbody').innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--muted)">Caricamento…</td></tr>';

  try {
    const da  = `${anno}-01-01T00:00:00.000Z`;
    const a   = `${anno}-12-31T23:59:59.999Z`;
    const res = await api.req('GET', `/api/sistema-ts/prestazioni?da=${da}&a=${a}`);
    let righe = res || [];

    // Filtra per stato se richiesto
    if (filtro === 'si') righe = righe.filter(r => r.ts_inviato);
    if (filtro === 'no') righe = righe.filter(r => !r.ts_inviato);

    _tsRighe = righe;
    renderTS(righe);
  } catch(e) {
    $('ts-tbody').innerHTML = `<tr><td colspan="8" style="text-align:center;color:#dc2626;padding:24px">Errore: ${esc(e.message)}</td></tr>`;
  }
}

function renderTS(righe) {
  $('ts-contatore').textContent = `${righe.length} prestazioni`;
  if (!righe.length) {
    $('ts-tbody').innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--muted)">Nessuna prestazione trovata</td></tr>';
    return;
  }

  $('ts-tbody').innerHTML = righe.map((r, i) => {
    const paz    = r.pazienti ? `${r.pazienti.cognome} ${r.pazienti.nome}` : '—';
    const cf     = r.pazienti?.codice_fiscale || '—';
    const esame  = r.tipi_prestazione?.nome || '—';
    const data   = fmtData(r.data_ora_inizio);
    const imp    = r.importo_ts_cent != null ? r.importo_ts_cent : (r.importo_pagato_cent != null ? r.importo_pagato_cent : 8000);
    const impEur = (imp / 100).toFixed(2);
    const pag    = r.pagamento_stato === 'pagato' ? 'Tracciato' : 'Contanti';
    const inviato = r.ts_inviato;
    const badge  = inviato
      ? '<span class="ts-badge-inviato">✅ Inviato</span>'
      : '<span class="ts-badge-attesa">⬜ Da inviare</span>';
    const checked = (!inviato) ? 'checked' : '';
    const disabled = inviato ? 'disabled' : '';
    return `<tr class="${inviato ? 'ts-inviata' : ''}" data-id="${r.id}">
      <td><input type="checkbox" class="ts-check" data-idx="${i}" ${checked} ${disabled}></td>
      <td>${data}</td>
      <td>${esc(paz)}</td>
      <td style="font-family:monospace;font-size:12px">${esc(cf)}</td>
      <td>${esc(esame)}</td>
      <td><input type="number" class="ts-importo-input" value="${impEur}" min="0" step="0.01"
          data-idx="${i}" ${disabled} onchange="tsAggiornaCifra(${i}, this.value)"> €</td>
      <td>${pag}</td>
      <td>${badge}</td>
    </tr>`;
  }).join('');
}

function tsToggleAll(checked) {
  document.querySelectorAll('.ts-check:not(:disabled)').forEach(cb => cb.checked = checked);
}

function tsAggiornaCifra(idx, val) {
  const cent = Math.round(parseFloat(val) * 100);
  if (!isNaN(cent) && cent >= 0) _tsRighe[idx]._importoOverride = cent;
}

async function inviaSistemaTS() {
  const checks = [...document.querySelectorAll('.ts-check:not(:disabled):checked')];
  if (!checks.length) { alert('Nessuna prestazione selezionata.'); return; }

  const selezionate = checks.map(cb => {
    const idx = parseInt(cb.dataset.idx);
    const r   = _tsRighe[idx];
    const imp = r._importoOverride != null
      ? r._importoOverride
      : (r.importo_ts_cent != null ? r.importo_ts_cent : (r.importo_pagato_cent != null ? r.importo_pagato_cent : 8000));
    return { id: r.id, importo_ts_cent: imp };
  });

  const btn = $('btn-invia-ts');
  btn.disabled = true;
  btn.textContent = '⏳ Invio in corso…';

  try {
    const res = await api.req('POST', '/api/sistema-ts/invia', { prestazioni: selezionate });
    alert(`✅ Invio completato!\n\nInviate: ${res.inviate}\nErrori: ${res.errori}${res.errori > 0 ? '\n\nControllare i log per dettagli.' : ''}`);
    caricaTS();
  } catch(e) {
    alert(`❌ Errore invio: ${e.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = '📤 Invia selezionati al Sistema TS';
  }
}

// ─── Archivio Pazienti ─────────────────────────────────────────────────────
let _archTimer = null;

async function apriArchivio() {
  $('arch-overlay').classList.remove('hidden');
  $('arch-search').value = '';
  await caricaArchivio('');
  $('arch-search').focus();
  $('arch-search').oninput = () => {
    clearTimeout(_archTimer);
    _archTimer = setTimeout(() => caricaArchivio($('arch-search').value.trim()), 280);
  };
}

function chiudiArchivio() {
  $('arch-overlay').classList.add('hidden');
}

async function caricaArchivio(q) {
  $('arch-tbody').innerHTML = `<tr><td colspan="5" class="arch-empty">Caricamento…</td></tr>`;
  try {
    const { data } = await api.pazienti(q);
    if (!data || data.length === 0) {
      $('arch-tbody').innerHTML = `<tr><td colspan="5" class="arch-empty">Nessun paziente trovato</td></tr>`;
      return;
    }
    $('arch-tbody').innerHTML = data.map(p => {
      const nasc = p.data_nascita
        ? new Date(p.data_nascita + 'T12:00:00').toLocaleDateString('it-IT')
        : '—';
      return `<tr onclick="selezionaPazienteDaArchivio('${p.id}','${esc(p.cognome)} ${esc(p.nome)}')">
        <td><strong>${esc(p.cognome)}</strong></td>
        <td>${esc(p.nome)}</td>
        <td>${nasc}</td>
        <td>${esc(p.telefono || '—')}</td>
        <td style="font-size:11px;color:var(--muted)">${esc(p.codice_fiscale || '—')}</td>
      </tr>`;
    }).join('');
  } catch(e) {
    $('arch-tbody').innerHTML = `<tr><td colspan="5" class="arch-empty">Errore: ${esc(e.message)}</td></tr>`;
  }
}

function selezionaPazienteDaArchivio(id) {
  chiudiArchivio();
  apriDettaglioPaziente(id);
}

// ─── Dettaglio / modifica paziente ───────────────────────────────────────
let _pdId = null; // ID paziente nel modal dettaglio

async function apriDettaglioPaziente(id) {
  _pdId = id;
  $('paz-detail-title').textContent = 'Caricamento…';
  $('pd-storico-list').innerHTML = '<span class="arch-empty">Caricamento…</span>';
  $('paz-detail-overlay').classList.remove('hidden');

  try {
    const p = await api.paziente(id);
    _pdId = p.id;

    // Popola i campi
    $('paz-detail-title').textContent = `${p.cognome} ${p.nome}`;
    $('pd-cognome').value  = p.cognome       || '';
    $('pd-nome').value     = p.nome          || '';
    $('pd-nascita').value  = p.data_nascita  || '';
    $('pd-sesso').value    = p.sesso         || '';
    $('pd-telefono').value = p.telefono      || '';
    $('pd-email').value    = p.email         || '';
    $('pd-cf').value       = p.codice_fiscale|| '';
    $('pd-note').value     = p.note          || '';
  } catch(e) {
    alert('Errore caricamento paziente: ' + e.message);
    chiudiDettaglioPaziente();
    return;
  }

  // Carica storico appuntamenti
  try {
    const apps = await api.appuntamentiPaziente(id);
    if (!apps || apps.length === 0) {
      $('pd-storico-list').innerHTML = '<span class="paz-storico-vuoto">Nessun appuntamento registrato</span>';
    } else {
      $('pd-storico-list').innerHTML = apps.map(a => {
        const dataStr = new Date(a.data_ora_inizio).toLocaleDateString('it-IT', { day:'2-digit', month:'2-digit', year:'numeric' });
        const ora     = fmtTime(a.data_ora_inizio);
        const esame   = a.tipi_prestazione?.nome || '—';
        const stato   = a.stato || 'prenotato';
        const statoStyle = stato === 'annullato'
          ? 'background:#fce4e4;color:#c62828'
          : stato === 'completato'
          ? 'background:#e8f5e9;color:#2e7d32'
          : stato === 'in_attesa'
          ? 'background:#fef3c7;color:#78350f'
          : 'background:#e3f2fd;color:#1565c0';
        return `<div class="paz-storico-item">
          <span class="paz-storico-data">${dataStr} ${ora}</span>
          <span class="paz-storico-esame">${esc(esame)}</span>
          <span class="paz-storico-stato" style="${statoStyle}">${esc(stato)}</span>
        </div>`;
      }).join('');
    }
  } catch(e) {
    $('pd-storico-list').innerHTML = '<span class="paz-storico-vuoto">Impossibile caricare lo storico</span>';
  }
}

function chiudiDettaglioPaziente() {
  $('paz-detail-overlay').classList.add('hidden');
  _pdId = null;
}

async function salvaPaziente() {
  if (!_pdId) return;

  const cognome  = $('pd-cognome').value.trim();
  const nome     = $('pd-nome').value.trim();
  const telefono = $('pd-telefono').value.trim();
  const nascita  = $('pd-nascita').value;

  if (!cognome || !nome)     { alert('Cognome e nome sono obbligatori'); return; }
  if (!nascita)              { alert('La data di nascita è obbligatoria'); return; }
  if (!telefono)             { alert('Il numero di telefono è obbligatorio'); return; }

  const btn = $('pd-btn-salva');
  btn.disabled = true;
  btn.textContent = 'Salvataggio…';

  try {
    await api.aggiornaPaziente(_pdId, {
      cognome,
      nome,
      data_nascita:   nascita,
      sesso:          $('pd-sesso').value || null,
      telefono,
      email:          $('pd-email').value.trim()  || null,
      codice_fiscale: $('pd-cf').value.trim().toUpperCase() || null,
      note:           $('pd-note').value.trim()   || null,
    });

    $('paz-detail-title').textContent = `${cognome} ${nome}`;
    btn.textContent = '✓ Salvato';
    setTimeout(() => { btn.textContent = 'Salva modifiche'; btn.disabled = false; }, 1800);
  } catch(e) {
    alert('Errore salvataggio: ' + e.message);
    btn.textContent = 'Salva modifiche';
    btn.disabled = false;
  }
}

async function eliminaPaziente() {
  if (!_pdId) return;
  const nome = $('paz-detail-title').textContent;
  if (!confirm(`⚠️ Eliminare definitivamente il paziente "${nome}"?\n\nQuesta azione non può essere annullata.`)) return;

  try {
    await api.eliminaPaziente(_pdId);
    chiudiDettaglioPaziente();
    // Aggiorna la lista in archivio se è aperta
    if (!$('arch-overlay').classList.contains('hidden')) {
      caricaArchivio($('arch-search').value.trim());
    }
  } catch(e) {
    alert('Impossibile eliminare:\n' + e.message);
  }
}

function nuovoAppDaPaziente() {
  if (!_pdId) return;
  const idPaz   = _pdId;
  const cognome = $('pd-cognome').value.trim();
  const nome    = $('pd-nome').value.trim();
  chiudiDettaglioPaziente();
  openModal({});
  // Pre-seleziona il paziente con i dati anagrafici
  _pazienteId = idPaz;
  $('paziente-search').style.display = 'none';
  $('paz-results').classList.add('hidden');
  $('paz-nome-display').textContent = `${cognome} ${nome}`;
  $('paz-selezionato').classList.remove('hidden');
  $('btn-nuovo-paz-toggle').style.display = 'none';
  // Form editabile pre-compilato
  const cached = _pazCache[idPaz];
  if (cached) {
    fillPazForm(cached);
  } else {
    api.paziente(idPaz).then(p => { _pazCache[idPaz] = p; fillPazForm(p); }).catch(() => {});
  }
}

// ─── Reminder preparazione ────────────────────────────────────────────────
function checkPreparazione() {
  const selEl = $('app-tipo');
  const selId  = selEl.value;
  const reminder = $('prep-reminder');
  if (!selId) { reminder.classList.add('hidden'); return; }

  const prest = _prestazioni.find(x => String(x.id) === String(selId));
  const nome  = (prest ? prest.nome : selEl.options[selEl.selectedIndex]?.text || '');

  const richiede = window.PREPARAZIONE_ESAMI
    ? PREPARAZIONE_ESAMI.richiedePreparazione(nome)
    : false;
  reminder.classList.toggle('hidden', !richiede);
}

// ─── Cambio credenziali ───────────────────────────────────────────────────

function chiudiCredenziali() {
  $('cred-overlay').classList.add('hidden');
}

async function salvaCredenziali() {
  const passAttuale    = $('cred-pass-attuale').value;
  const nuovoUsername  = $('cred-nuovo-username').value.trim();
  const nuovaPass      = $('cred-nuova-pass').value;
  const confermaPass   = $('cred-conferma-pass').value;
  const errEl          = $('cred-err');

  errEl.classList.add('hidden');

  if (!passAttuale) { errEl.textContent = 'Inserisci la password attuale'; errEl.classList.remove('hidden'); return; }
  if (!nuovoUsername && !nuovaPass) { errEl.textContent = 'Inserisci almeno un nuovo username o una nuova password'; errEl.classList.remove('hidden'); return; }
  if (nuovaPass && nuovaPass !== confermaPass) { errEl.textContent = 'Le due password non coincidono'; errEl.classList.remove('hidden'); return; }
  if (nuovaPass && nuovaPass.length < 6) { errEl.textContent = 'La nuova password deve essere di almeno 6 caratteri'; errEl.classList.remove('hidden'); return; }

  const btn = $('btn-salva-cred');
  btn.textContent = 'Salvataggio…'; btn.disabled = true;
  try {
    await api.cambiaCredenziali({
      password_attuale: passAttuale,
      nuovo_username:   nuovoUsername || undefined,
      nuova_password:   nuovaPass     || undefined,
    });
    chiudiCredenziali();
    alert('✅ Credenziali aggiornate. Effettua di nuovo il login.');
    // Forza logout
    api.setToken(null);
    _user = null;
    showLogin();
  } catch(ex) {
    errEl.textContent = ex.message;
    errEl.classList.remove('hidden');
  } finally {
    btn.textContent = '💾 Salva'; btn.disabled = false;
  }
}

// ─── Blocco fascia oraria ─────────────────────────────────────────────────

function openModalBlocco(dateStr) {
  _bloccoTipo = null;
  $('blocco-data').value   = dateStr || toDateStr(new Date());
  $('blocco-motivo').value = '';
  document.querySelectorAll('.blocco-tipo-btn').forEach(b => b.classList.remove('active'));
  $('blocco-overlay').onclick = e => { if (e.target === e.currentTarget) chiudiBlocco(); };
  $('blocco-overlay').classList.remove('hidden');
}

function chiudiBlocco() {
  $('blocco-overlay').classList.add('hidden');
  _bloccoTipo = null;
}

function selezionaTipoBlocco(tipo, btn) {
  _bloccoTipo = tipo;
  document.querySelectorAll('.blocco-tipo-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

async function salvaBlocco() {
  const dataVal = $('blocco-data').value;
  if (!dataVal)     { alert('Seleziona una data'); return; }
  if (!_bloccoTipo) { alert('Seleziona la fascia oraria'); return; }

  const btn = $('btn-salva-blocco');
  btn.textContent = 'Salvataggio…'; btn.disabled = true;
  try {
    await api.creaIndisponibilita({
      data:   dataVal,
      tipo:   _bloccoTipo,
      motivo: $('blocco-motivo').value.trim() || null
    });
    chiudiBlocco();
    await refreshWeek();
  } catch(ex) {
    alert((ex.status === 409 ? '⚠️ ' : '❌ Errore: ') + ex.message);
  } finally {
    btn.textContent = '🔒 Blocca'; btn.disabled = false;
  }
}

async function onBloccoClick(id, e) {
  e.stopPropagation();
  const b  = _indisponibilita.find(x => x.id === id);
  if (!b) return;
  const bt = BLOCCO_TIPI[b.tipo];
  const label = bt?.label || b.tipo;
  const dataFmt = new Date(b.data + 'T12:00:00').toLocaleDateString('it-IT',
    { weekday: 'long', day: '2-digit', month: 'long' });
  const msg = `Rimuovere il blocco?\n\n📅 ${dataFmt}\n🔒 ${label}${b.motivo ? '\n📝 ' + b.motivo : ''}`;
  if (!confirm(msg)) return;
  try {
    await api.eliminaIndisponibilita(id);
    await refreshWeek();
  } catch(ex) { alert('Errore: ' + ex.message); }
}

// ─── Shortcut ─────────────────────────────────────────────────────────────
function $(id) { return document.getElementById(id); }
