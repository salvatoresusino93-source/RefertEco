// ═══════════════════════════════════════════════════════════════════════════
// PRENOTA.JS — Prenotazione online per i pazienti
// ═══════════════════════════════════════════════════════════════════════════

// ─── Stato globale ────────────────────────────────────────────────────────
const ST = {
  step:             1,
  esami:            [],
  esameId:          null,
  esameName:        null,
  giorni:           [],
  dataScelta:       null,
  dataLabel:        null,
  slotScelta:       null,
  privacyAccettata: false,
  form: {
    cognome:        '',
    nome:           '',
    data_nascita:   '',
    sesso:          '',
    telefono:       '',
    codice_fiscale: '',
    note:           '',
  }
};

const main    = () => document.getElementById('pr-main');
const dots    = n  => document.getElementById(`dot-${n}`);
const esc     = s  => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function prepBlock() {
  if (!ST.esameName || !window.PREPARAZIONE_ESAMI) return '';
  if (!PREPARAZIONE_ESAMI.richiedePreparazione(ST.esameName)) return '';
  return PREPARAZIONE_ESAMI.htmlReminder('pr-prep-reminder');
}

function dedupeEsami(list) {
  const seen = new Set();
  return (list || []).filter(function (e) {
    const key = String(e.nome || '').toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Step indicator ───────────────────────────────────────────────────────
function updateDots(currentStep) {
  for (let i = 1; i <= 4; i++) {
    const d = dots(i);
    if (!d) continue;
    d.classList.remove('active','done');
    if (i < currentStep) d.classList.add('done');
    else if (i === currentStep) d.classList.add('active');
  }
}

// ─── Formato ora locale ───────────────────────────────────────────────────
function fmtOra(iso) {
  return new Date(iso).toLocaleTimeString('it-IT', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome'
  });
}

// ─── STEP 1 — Selezione esame ─────────────────────────────────────────────
async function goStep1() {
  ST.step = 1;
  updateDots(1);
  main().innerHTML = `<div class="pr-card">
    <div class="pr-card-title">Quale esame vuoi prenotare?</div>
    <div class="pr-card-body">
      <div id="esami-wrap"><div class="pr-loader"><div class="pr-spinner"></div><br>Caricamento esami…</div></div>
    </div>
  </div>`;

  // Fetch esami se non ancora caricati
  if (ST.esami.length === 0) {
    try {
      const r = await fetch('/api/public/esami');
      if (!r.ok) throw new Error('Errore server');
      ST.esami = dedupeEsami(await r.json());
    } catch (e) {
      document.getElementById('esami-wrap').innerHTML =
        `<div class="pr-error">Impossibile caricare gli esami. Ricarica la pagina.</div>`;
      return;
    }
  }

  if (ST.esami.length === 0) {
    document.getElementById('esami-wrap').innerHTML =
      `<div class="pr-empty"><div class="pr-empty-icon">🩺</div>Nessun esame disponibile al momento.</div>`;
    return;
  }

  document.getElementById('esami-wrap').innerHTML = renderEsamiGrid();
}

function renderEsamiGrid() {
  function getIcon(nome) {
    const n = nome.toLowerCase();
    if (n.includes('tiro')) return '🦋';
    if (n.includes('doppler')) return '🩸';
    if (n.includes('rene') || n.includes('renale') || n.includes('urinario') || n.includes('vescic')) return '💧';
    if (n.includes('neonata')) return '👶';
    if (n.includes('addome')) return '🫀';
    return '🔵';
  }

  function renderItem(e) {
    return `<div class="esame-item${e.id === ST.esameId ? ' selected' : ''}" onclick="selectEsame('${e.id}')">
      <div class="esame-icon">${getIcon(e.nome)}</div>
      <div>
        <div class="esame-nome">${esc(e.nome)}</div>
        <div class="esame-durata">⏱ ${e.durata_minuti} minuti · 80 €</div>
      </div>
      <div class="esame-arrow">›</div>
    </div>`;
  }

  if (!window.ESAMI_CATEGORIE) {
    return `<div class="esame-grid">${ST.esami.map(renderItem).join('')}</div>`;
  }

  return ESAMI_CATEGORIE.raggruppa(ST.esami).map(function (g) {
    return `<div class="esame-section">
      <div class="esame-section-title">${esc(g.cat)}</div>
      <div class="esame-grid">${g.items.map(renderItem).join('')}</div>
    </div>`;
  }).join('');
}

async function selectEsame(id) {
  const esame = ST.esami.find(function (e) { return e.id === id; });
  if (!esame) return;
  ST.esameId   = id;
  ST.esameName = esame.nome;
  ST.giorni    = [];
  ST.dataScelta = null;
  ST.dataLabel  = null;
  ST.slotScelta = null;
  renderEsameSceltoStep1();
}

function renderEsameSceltoStep1() {
  ST.step = 1;
  updateDots(1);
  main().innerHTML = `<div class="pr-card">
    <div class="pr-card-title">Esame selezionato</div>
    <div class="pr-card-body">
      <div class="esame-item selected" style="cursor:default">
        <div class="esame-icon">🩺</div>
        <div>
          <div class="esame-nome">${esc(ST.esameName)}</div>
          <div class="esame-durata">⏱ 30 minuti · 80 €</div>
        </div>
      </div>
      ${prepBlock()}
      <div class="pr-btn-row" style="margin-top:16px">
        <button class="pr-btn-ghost" onclick="goStep1()">← Cambia esame</button>
        <button class="pr-btn-pri" onclick="goStep2()">Scegli data →</button>
      </div>
    </div>
  </div>`;
}

// ─── STEP 2 — Selezione data ──────────────────────────────────────────────
async function goStep2() {
  ST.step = 2;
  updateDots(2);
  main().innerHTML = `
    <div class="pr-card">
      <div class="pr-card-title">Scegli la data <span>· ${esc(ST.esameName)}</span></div>
      <div class="pr-card-body">
        ${prepBlock()}
        <div id="date-wrap"><div class="pr-loader"><div class="pr-spinner"></div><br>Controllo disponibilità…</div></div>
      </div>
    </div>`;

  if (ST.giorni.length === 0) {
    try {
      const r = await fetch(`/api/public/disponibilita?tipo_id=${encodeURIComponent(ST.esameId)}`);
      if (!r.ok) throw new Error('Errore server');
      const json = await r.json();
      ST.giorni = json.giorni || [];
    } catch (e) {
      document.getElementById('date-wrap').innerHTML =
        `<div class="pr-error">Impossibile caricare le disponibilità. Riprova tra poco.</div>
         <div style="margin-top:12px"><button class="pr-btn-ghost" onclick="goStep1()">← Torna indietro</button></div>`;
      return;
    }
  }

  if (ST.giorni.length === 0) {
    document.getElementById('date-wrap').innerHTML = `
      <div class="pr-empty">
        <div class="pr-empty-icon">📅</div>
        Nessuno slot disponibile nei prossimi 45 giorni.<br>
        <small style="color:#94a3b8">Riprova più tardi o contatta lo studio.</small>
      </div>
      <div style="margin-top:12px"><button class="pr-btn-ghost" onclick="goStep1()">← Torna indietro</button></div>`;
    return;
  }

  document.getElementById('date-wrap').innerHTML = `
    <div class="date-list">
      ${ST.giorni.map(g => `
        <div class="date-item${g.data===ST.dataScelta?' selected':''}" onclick="selectData('${g.data}','${esc(g.giorno)}')">
          <div class="date-item-txt">${esc(g.giorno)}</div>
          <div class="date-item-cnt">${g.slots.length} orari</div>
        </div>
      `).join('')}
    </div>
    <div style="margin-top:14px"><button class="pr-btn-ghost" onclick="goStep1()">← Cambia esame</button></div>`;
}

function selectData(data, label) {
  ST.dataScelta = data;
  ST.dataLabel  = label;
  ST.slotScelta = null;
  goStep2b();
}

// ─── STEP 2b — Selezione orario (stessa card, sostituisce date-wrap) ──────
function goStep2b() {
  const giorno = ST.giorni.find(g => g.data === ST.dataScelta);
  if (!giorno) return;

  // Tieni riferimento globale agli slot del giorno per selectSlotByIdx
  ST._slotsGiorno = giorno.slots;

  const mattina    = giorno.slots.filter((s, i) => ({ ...s, _idx: i })).filter(s => parseInt(s.ora) < 13);
  const pomeriggio = giorno.slots.filter((s, i) => ({ ...s, _idx: i })).filter(s => parseInt(s.ora) >= 15);

  // Calcola gli indici originali
  const mattinaI    = giorno.slots.map((s, i) => ({ s, i })).filter(({s}) => parseInt(s.ora) < 13);
  const pomeriggioI = giorno.slots.map((s, i) => ({ s, i })).filter(({s}) => parseInt(s.ora) >= 15);

  main().innerHTML = `
    <div class="pr-card">
      <div class="pr-card-title">Scegli l'orario <span>· ${esc(ST.dataLabel)}</span></div>
      <div class="pr-card-body">
        ${prepBlock()}
        ${mattinaI.length > 0 ? `
          <div class="ora-section">
            <div class="ora-section-lbl">🌅 Mattina</div>
            <div class="ora-grid">
              ${mattinaI.map(({s, i}) => `
                <button class="ora-btn${ST.slotScelta?.ora===s.ora?' selected':''}"
                  onclick="selectSlotByIdx(${i})">${esc(s.ora)}</button>`).join('')}
            </div>
          </div>` : ''}
        ${pomeriggioI.length > 0 ? `
          <div class="ora-section">
            <div class="ora-section-lbl">🌆 Pomeriggio</div>
            <div class="ora-grid">
              ${pomeriggioI.map(({s, i}) => `
                <button class="ora-btn${ST.slotScelta?.ora===s.ora?' selected':''}"
                  onclick="selectSlotByIdx(${i})">${esc(s.ora)}</button>`).join('')}
            </div>
          </div>` : ''}
        <div style="margin-top:14px">
          <button class="pr-btn-ghost" onclick="goStep2()">← Cambia data</button>
        </div>
      </div>
    </div>`;
}

function selectSlotByIdx(idx) {
  ST.slotScelta = ST._slotsGiorno[idx];
  goStep3();
}

// ─── STEP 3 — Dati personali ──────────────────────────────────────────────
function goStep3() {
  ST.step = 3;
  updateDots(3);

  const f = ST.form;
  main().innerHTML = `
    <div class="pr-card">
      <div class="pr-card-title">I tuoi dati</div>
      <div class="pr-card-body">
        ${prepBlock()}
        <div class="field-row">
          <div class="field">
            <label>Cognome *</label>
            <input type="text" id="f-cognome" value="${esc(f.cognome)}" placeholder="Rossi" autocomplete="family-name" required>
          </div>
          <div class="field">
            <label>Nome *</label>
            <input type="text" id="f-nome" value="${esc(f.nome)}" placeholder="Mario" autocomplete="given-name" required>
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label>Data di nascita *</label>
            <input type="date" id="f-nascita" value="${esc(f.data_nascita)}" required>
          </div>
          <div class="field">
            <label>Sesso</label>
            <select id="f-sesso">
              <option value="">—</option>
              <option value="M"${f.sesso==='M'?' selected':''}>Maschio</option>
              <option value="F"${f.sesso==='F'?' selected':''}>Femmina</option>
            </select>
          </div>
        </div>
        <div class="field-full">
          <div class="field">
            <label>Telefono *</label>
            <input type="tel" id="f-telefono" value="${esc(f.telefono)}" placeholder="333 1234567" autocomplete="tel" required>
          </div>
        </div>
        <div class="field-full">
          <div class="field">
            <label>Codice Fiscale (opzionale)</label>
            <input type="text" id="f-cf" value="${esc(f.codice_fiscale)}" placeholder="RSSMRA80A01H501Z"
              autocomplete="off" style="text-transform:uppercase">
          </div>
        </div>
        <div class="field-full">
          <div class="field">
            <label>Note aggiuntive (opzionale)</label>
            <textarea id="f-note" rows="2" placeholder="Es. allergie, particolarità cliniche…">${esc(f.note)}</textarea>
          </div>
        </div>
        <!-- Privacy consent — obbligatorio GDPR -->
        <div class="privacy-wrap">
          <label class="privacy-label">
            <input type="checkbox" id="f-privacy" ${ST.privacyAccettata ? 'checked' : ''}
              onchange="ST.privacyAccettata=this.checked">
            <span>
              Ho letto l'<a href="/privacy" target="_blank" class="pr-link">informativa sulla privacy</a>
              e acconsento al trattamento dei miei dati personali, inclusi i dati sanitari,
              per la gestione della prenotazione.
            </span>
          </label>
        </div>
        <div id="form-err" class="pr-error hidden"></div>
        <div class="pr-btn-row">
          <button class="pr-btn-ghost" onclick="goStep2b()">←</button>
          <button class="pr-btn-pri" onclick="avanzaStep4()">Avanti →</button>
        </div>
      </div>
    </div>`;

  // Focus primo campo
  setTimeout(() => {
    const el = document.getElementById('f-cognome');
    if (el && !el.value) el.focus();
  }, 100);
}

function avanzaStep4() {
  const cognome       = document.getElementById('f-cognome').value.trim();
  const nome          = document.getElementById('f-nome').value.trim();
  const data_nascita  = document.getElementById('f-nascita').value;
  const sesso         = document.getElementById('f-sesso').value;
  const telefono      = document.getElementById('f-telefono').value.trim();
  const codice_fiscale = document.getElementById('f-cf').value.trim().toUpperCase();
  const note          = document.getElementById('f-note').value.trim();
  const errEl         = document.getElementById('form-err');

  errEl.classList.add('hidden');

  if (!cognome || !nome) { showFormErr(errEl, 'Inserisci cognome e nome.'); return; }
  if (!data_nascita)     { showFormErr(errEl, 'Inserisci la data di nascita.'); return; }
  if (!telefono)         { showFormErr(errEl, 'Inserisci il numero di telefono.'); return; }
  if (!ST.privacyAccettata) {
    showFormErr(errEl, 'Devi accettare l\'informativa sulla privacy per procedere.');
    return;
  }

  Object.assign(ST.form, { cognome, nome, data_nascita, sesso, telefono, codice_fiscale, note });
  goStep4();
}

function showFormErr(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
  el.scrollIntoView({ block: 'nearest' });
}

// ─── STEP 4 — Riepilogo & conferma ───────────────────────────────────────
function goStep4() {
  ST.step = 4;
  updateDots(4);

  const f = ST.form;
  const nascitaFmt = f.data_nascita
    ? new Date(f.data_nascita + 'T00:00:00').toLocaleDateString('it-IT', { day:'2-digit', month:'2-digit', year:'numeric' })
    : '—';
  const orarioFmt = ST.slotScelta?.ora || fmtOra(ST.slotScelta?.data_ora_inizio || '');

  main().innerHTML = `
    <div class="pr-card">
      <div class="pr-card-title">Riepilogo prenotazione</div>
      <div class="pr-card-body">
        ${prepBlock()}
        <div class="recap">
          <div class="recap-row">
            <div class="recap-icon">🩺</div>
            <div><div class="recap-lbl">Esame</div><div class="recap-val">${esc(ST.esameName)}</div></div>
          </div>
          <div class="recap-row">
            <div class="recap-icon">💶</div>
            <div><div class="recap-lbl">Costo</div><div class="recap-val">80 €</div></div>
          </div>
          <div class="recap-row">
            <div class="recap-icon">📅</div>
            <div>
              <div class="recap-lbl">Data e ora</div>
              <div class="recap-val" style="text-transform:capitalize">${esc(ST.dataLabel)} alle <strong>${esc(orarioFmt)}</strong></div>
            </div>
          </div>
          <div class="recap-row">
            <div class="recap-icon">👤</div>
            <div>
              <div class="recap-lbl">Paziente</div>
              <div class="recap-val">${esc(f.cognome)} ${esc(f.nome)} · ${nascitaFmt}</div>
            </div>
          </div>
          <div class="recap-row">
            <div class="recap-icon">📞</div>
            <div><div class="recap-lbl">Telefono</div><div class="recap-val">${esc(f.telefono)}</div></div>
          </div>
          ${f.codice_fiscale ? `
          <div class="recap-row">
            <div class="recap-icon">🪪</div>
            <div><div class="recap-lbl">Codice Fiscale</div><div class="recap-val">${esc(f.codice_fiscale)}</div></div>
          </div>` : ''}
          ${f.note ? `
          <div class="recap-row">
            <div class="recap-icon">📝</div>
            <div><div class="recap-lbl">Note</div><div class="recap-val">${esc(f.note)}</div></div>
          </div>` : ''}
        </div>
        <div class="recap-note">
          ℹ️ La prenotazione deve essere approvata dal medico.<br>
          Riceverai una conferma via <strong>SMS</strong> al numero <strong>${esc(f.telefono)}</strong>.
        </div>
        <div id="submit-err" class="pr-error hidden"></div>
        <div class="pr-btn-row">
          <button class="pr-btn-ghost" onclick="goStep3()">←</button>
          <button class="pr-btn-pri" id="btn-submit" onclick="inviaPrenota()">
            ✅ Conferma prenotazione
          </button>
        </div>
      </div>
    </div>`;
}

// ─── INVIO PRENOTAZIONE ───────────────────────────────────────────────────
async function inviaPrenota() {
  const btn    = document.getElementById('btn-submit');
  const errEl  = document.getElementById('submit-err');
  errEl.classList.add('hidden');

  btn.disabled = true;
  btn.textContent = 'Invio in corso…';

  const f = ST.form;
  const payload = {
    tipo_id:        ST.esameId,
    data_ora_inizio: ST.slotScelta.data_ora_inizio,
    cognome:         f.cognome,
    nome:            f.nome,
    data_nascita:    f.data_nascita,
    sesso:           f.sesso || null,
    telefono:        f.telefono,
    codice_fiscale:  f.codice_fiscale || null,
    note:            f.note || null,
  };

  try {
    const r = await fetch('/api/public/prenota', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    const data = await r.json();
    if (!r.ok) {
      if (r.status === 409) {
        // Slot preso — torna alla selezione orario
        ST.giorni = []; // forza reload disponibilità
        showFormErr(errEl, data.error || 'Slot non più disponibile. Scegli un altro orario.');
        btn.disabled = false;
        btn.textContent = '✅ Conferma prenotazione';
        return;
      }
      throw new Error(data.error || 'Errore del server');
    }
    // Successo
    goSuccess(f.telefono);
  } catch (e) {
    showFormErr(errEl, e.message || 'Errore di rete. Riprova.');
    btn.disabled = false;
    btn.textContent = '✅ Conferma prenotazione';
  }
}

// ─── PAGINA SUCCESSO ──────────────────────────────────────────────────────
function goSuccess(telefono) {
  // Nascondi step indicator
  document.getElementById('pr-steps').classList.add('hidden');

  main().innerHTML = `
    <div class="pr-card">
      <div class="pr-success">
        <div class="pr-success-icon">✅</div>
        <h2>Prenotazione inviata!</h2>
        <p>La tua richiesta è stata ricevuta.</p>
        <p>Il medico la esaminerà e riceverai una <strong>conferma via SMS</strong>
           al numero <span class="tel">${esc(telefono)}</span>.</p>
        <p style="margin-top:16px;font-size:13px;color:#94a3b8">
          In caso di problemi o per informazioni,<br>contatta lo studio telefonicamente.
        </p>
      </div>
    </div>`;
}

// ─── AVVIO ────────────────────────────────────────────────────────────────
function findEsameFromQuery() {
  const q = new URLSearchParams(window.location.search).get('esame');
  if (!q || !ST.esami.length) return null;
  const normalized = q.trim().toLowerCase();
  return (
    ST.esami.find((e) => e.nome.toLowerCase() === normalized) ||
    ST.esami.find((e) => e.nome.toLowerCase().includes(normalized)) ||
    ST.esami.find((e) => normalized.includes(e.nome.toLowerCase()))
  );
}

document.addEventListener('DOMContentLoaded', async () => {
  await goStep1();
  const match = findEsameFromQuery();
  if (match) {
    ST.esameId = match.id;
    ST.esameName = match.nome;
    renderEsameSceltoStep1();
  }
});
