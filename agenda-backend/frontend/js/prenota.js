// ═══════════════════════════════════════════════════════════════════════════
// PRENOTA.JS — Prenotazione online per i pazienti (bilingue IT/EN)
// La lingua si attiva con ?lang=en nell'URL.
// ═══════════════════════════════════════════════════════════════════════════

// ─── Lingua e dizionario ──────────────────────────────────────────────────
const LANG = (new URLSearchParams(window.location.search).get('lang') === 'en') ? 'en' : 'it';
const EN   = LANG === 'en';
const SITE_URL = EN ? 'https://studiosusino.it/index-en.html' : 'https://studiosusino.it/';
const NEW_BOOKING_URL = EN ? '/prenota?lang=en' : '/prenota';

const T = EN ? {
  // header / steps
  backSite: '← Back to site', headerTitle: 'Book an exam',
  stExam: 'Exam', stDate: 'Date', stData: 'Details', stConfirm: 'Confirm',
  // step 1
  whichExam: 'Which exam would you like to book?', loadingExams: 'Loading exams…',
  loadExamsErr: 'Unable to load the exams. Please reload the page.',
  noExams: 'No exams available at the moment.',
  minutes: 'minutes', selectedExam: 'Selected exam',
  changeExam: '← Change exam', chooseDate: 'Choose date →',
  // step 2
  chooseTheDate: 'Choose the date', checkingAvail: 'Checking availability…',
  loadAvailErr: 'Unable to load availability. Please try again shortly.',
  goBack: '← Go back', noSlots: 'No slots available in the next 45 days.',
  tryLater: 'Try again later or contact the practice.',
  times: 'times', changeDate: '← Change date',
  chooseTime: 'Choose the time', morning: '🌅 Morning', afternoon: '🌆 Afternoon',
  // step 3
  yourDetails: 'Your details', surname: 'Surname', firstName: 'First name',
  birthDate: 'Date of birth', sex: 'Sex', male: 'Male', female: 'Female',
  phone: 'Phone', email: 'Email', emailPh: 'name@example.com',
  taxCode: 'Tax code (Codice Fiscale)', street: 'Street / Address', streetPh: 'Via Roma',
  houseNo: 'House no.', postcode: 'Postcode (CAP)', town: 'Town of residence', townPh: 'Pozzallo',
  notes: 'Additional notes (optional)', notesPh: 'E.g. allergies, clinical notes…',
  privacyPre: "I have read the ", privacyLink: 'privacy policy',
  privacyPost: " and consent to the processing of my personal data, including health data, for managing the booking.",
  next: 'Next →',
  // validations
  vName: 'Please enter your surname and first name.', vBirth: 'Please enter your date of birth.',
  vPhone: 'Please enter your phone number.', vEmail: 'Please enter your email address.',
  vEmailValid: 'Please enter a valid email address.', vCf: 'Please enter your tax code.',
  vCfValid: 'Please enter a valid tax code (16 characters).',
  vStreet: 'Please enter your street and address.', vCivico: 'Please enter the house number.',
  vCap: 'Please enter a valid postcode (5 digits).', vComune: 'Please enter your town of residence.',
  vPrivacy: 'You must accept the privacy policy to continue.',
  // step 4
  summary: 'Booking summary', lblExam: 'Exam', lblCost: 'Cost', lblDateTime: 'Date and time',
  at: 'at', lblPatient: 'Patient', lblPhone: 'Phone', lblEmail: 'Email',
  lblTaxCode: 'Tax code', lblResidence: 'Residence', lblNotes: 'Notes',
  immConfirm: 'Immediate confirmation', recommended: 'RECOMMENDED',
  payOnlineDesc1: 'Pay the full amount of ', payOnlineDesc2: ' now by card: your booking is ',
  confirmedNow: 'confirmed immediately', payAtStudio: 'Pay at the practice',
  payAtStudioDesc: 'No payment now. The booking will be confirmed by the doctor and you will receive an SMS.',
  noteOnlinePaid: ' Paying online, your booking is ', noteConfirmedNow: 'confirmed immediately',
  noteSmsTo: ' You will receive a confirmation ', noteSms: 'SMS', noteToNumber: ' at the number ',
  noteEmailConfirm: 'You will receive a confirmation email with your appointment details.',
  noteNeedsApproval: ' The booking must be approved by the doctor.',
  submitPay: '💳 Pay and confirm', submitConfirm: '✅ Confirm booking',
  sending: 'Sending…', redirecting: 'Redirecting to payment…',
  slotTaken: 'Slot no longer available. Please choose another time.',
  serverErr: 'Server error', networkErr: 'Network error. Please try again.',
  // success
  sentTitle: 'Booking sent!', sentP1: 'Your request has been received.',
  sentP2a: 'The doctor will review it and you will receive a ', sentP2b: 'confirmation by SMS',
  sentP2c: ' at the number ',
  sentHelp: 'If you have any problems or need information,<br>please contact the practice by phone.',
  backToSite: 'Back to site',
  // payment result
  payOkTitle: 'Payment received!', payOkP1a: 'Your booking is ', payOkP1b: 'confirmed',
  payOkP2a: 'You will shortly receive a ', payOkP2b: 'confirmation email', payOkP2c: ' with your appointment details.',
  payOkNote: 'Payment completed: no waiting for confirmation.',
  payKoTitle: 'Payment cancelled', payKoP1: 'Nothing was charged.',
  payKoP2a: 'Your booking request is still recorded and will be ', payKoP2b: 'confirmed by the doctor',
  payKoP2c: ': you will receive an ', payKoP2d: 'SMS',
  payKoNote: 'Want immediate confirmation? Try booking again and choose online payment.',
  newBooking: 'New booking',
} : {
  backSite: '← Torna al sito', headerTitle: 'Prenota un esame',
  stExam: 'Esame', stDate: 'Data', stData: 'Dati', stConfirm: 'Conferma',
  whichExam: 'Quale esame vuoi prenotare?', loadingExams: 'Caricamento esami…',
  loadExamsErr: 'Impossibile caricare gli esami. Ricarica la pagina.',
  noExams: 'Nessun esame disponibile al momento.',
  minutes: 'minuti', selectedExam: 'Esame selezionato',
  changeExam: '← Cambia esame', chooseDate: 'Scegli data →',
  chooseTheDate: 'Scegli la data', checkingAvail: 'Controllo disponibilità…',
  loadAvailErr: 'Impossibile caricare le disponibilità. Riprova tra poco.',
  goBack: '← Torna indietro', noSlots: 'Nessuno slot disponibile nei prossimi 45 giorni.',
  tryLater: 'Riprova più tardi o contatta lo studio.',
  times: 'orari', changeDate: '← Cambia data',
  chooseTime: "Scegli l'orario", morning: '🌅 Mattina', afternoon: '🌆 Pomeriggio',
  yourDetails: 'I tuoi dati', surname: 'Cognome', firstName: 'Nome',
  birthDate: 'Data di nascita', sex: 'Sesso', male: 'Maschio', female: 'Femmina',
  phone: 'Telefono', email: 'Email', emailPh: 'nome@esempio.it',
  taxCode: 'Codice Fiscale', street: 'Via / Indirizzo', streetPh: 'Via Roma',
  houseNo: 'N° civico', postcode: 'CAP', town: 'Comune di residenza', townPh: 'Pozzallo',
  notes: 'Note aggiuntive (opzionale)', notesPh: 'Es. allergie, particolarità cliniche…',
  privacyPre: "Ho letto l'", privacyLink: 'informativa sulla privacy',
  privacyPost: " e acconsento al trattamento dei miei dati personali, inclusi i dati sanitari, per la gestione della prenotazione.",
  next: 'Avanti →',
  vName: 'Inserisci cognome e nome.', vBirth: 'Inserisci la data di nascita.',
  vPhone: 'Inserisci il numero di telefono.', vEmail: "Inserisci l'indirizzo email.",
  vEmailValid: 'Inserisci un indirizzo email valido.', vCf: 'Inserisci il codice fiscale.',
  vCfValid: 'Inserisci un codice fiscale valido (16 caratteri).',
  vStreet: 'Inserisci via e indirizzo.', vCivico: 'Inserisci il numero civico.',
  vCap: 'Inserisci un CAP valido (5 cifre).', vComune: 'Inserisci il comune di residenza.',
  vPrivacy: "Devi accettare l'informativa sulla privacy per procedere.",
  summary: 'Riepilogo prenotazione', lblExam: 'Esame', lblCost: 'Costo', lblDateTime: 'Data e ora',
  at: 'alle', lblPatient: 'Paziente', lblPhone: 'Telefono', lblEmail: 'Email',
  lblTaxCode: 'Codice Fiscale', lblResidence: 'Residenza', lblNotes: 'Note',
  immConfirm: 'Conferma immediata', recommended: 'CONSIGLIATO',
  payOnlineDesc1: "Paga ora l'intero importo di ", payOnlineDesc2: ' con carta: la prenotazione è ',
  confirmedNow: 'confermata subito', payAtStudio: 'Paga in studio',
  payAtStudioDesc: 'Nessun pagamento adesso. La prenotazione sarà confermata dal medico e riceverai un SMS.',
  noteOnlinePaid: ' Pagando online la prenotazione è ', noteConfirmedNow: 'confermata subito',
  noteSmsTo: ' Riceverai un ', noteSms: 'SMS', noteToNumber: ' di conferma al numero ',
  noteEmailConfirm: 'Riceverai una email di conferma con i dettagli dell\'appuntamento.',
  noteNeedsApproval: ' La prenotazione deve essere approvata dal medico.',
  submitPay: '💳 Paga e conferma', submitConfirm: '✅ Conferma prenotazione',
  sending: 'Invio in corso…', redirecting: 'Reindirizzamento al pagamento…',
  slotTaken: 'Slot non più disponibile. Scegli un altro orario.',
  serverErr: 'Errore del server', networkErr: 'Errore di rete. Riprova.',
  sentTitle: 'Prenotazione inviata!', sentP1: 'La tua richiesta è stata ricevuta.',
  sentP2a: 'Il medico la esaminerà e riceverai una ', sentP2b: 'conferma via SMS',
  sentP2c: ' al numero ',
  sentHelp: 'In caso di problemi o per informazioni,<br>contatta lo studio telefonicamente.',
  backToSite: 'Torna al sito',
  payOkTitle: 'Pagamento ricevuto!', payOkP1a: 'La tua prenotazione è ', payOkP1b: 'confermata',
  payOkP2a: 'Riceverai a breve una ', payOkP2b: 'email di conferma', payOkP2c: ' con i dettagli dell\'appuntamento.',
  payOkNote: 'Pagamento completato: nessuna attesa di conferma.',
  payKoTitle: 'Pagamento annullato', payKoP1: 'Non è stato addebitato nulla.',
  payKoP2a: 'La tua richiesta di prenotazione è comunque registrata e sarà ', payKoP2b: 'confermata dal medico',
  payKoP2c: ': riceverai un ', payKoP2d: 'SMS',
  payKoNote: 'Vuoi la conferma immediata? Riprova la prenotazione scegliendo il pagamento online.',
  newBooking: 'Nuova prenotazione',
};

const LOCALE = EN ? 'en-GB' : 'it-IT';

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
  config:           { pagamenti_attivi: false, importo_cent: 8000 },
  pagaOnline:       false,
  form: {
    cognome:        '',
    nome:           '',
    data_nascita:   '',
    sesso:          '',
    telefono:       '',
    email:          '',
    codice_fiscale: '',
    indirizzo:      '',
    civico:         '',
    cap:            '',
    comune:         '',
    note:           '',
  }
};

const main    = () => document.getElementById('pr-main');
const dots    = n  => document.getElementById(`dot-${n}`);
const esc     = s  => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
// Traduzione nomi esame / categorie in inglese (i dati arrivano in italiano)
const trNome  = nome => (window.ESAMI_CATEGORIE ? ESAMI_CATEGORIE.nomeTradotto(nome, EN) : nome);
const trCat   = cat  => (window.ESAMI_CATEGORIE ? ESAMI_CATEGORIE.catTradotta(cat, EN) : cat);

// Applica le traduzioni alle parti statiche dell'HTML (header, step)
function applyStaticI18n() {
  const back = document.querySelector('.pr-header-back');
  if (back) back.textContent = T.backSite;
  const h1 = document.querySelector('.pr-header h1');
  if (h1) h1.textContent = T.headerTitle;
  if (back) back.setAttribute('href', SITE_URL);
  const labels = [T.stExam, T.stDate, T.stData, T.stConfirm];
  for (let i = 1; i <= 4; i++) {
    const small = document.querySelector(`#dot-${i} small`);
    if (small) small.textContent = labels[i - 1];
  }
  if (EN) document.documentElement.lang = 'en';
}

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
  return new Date(iso).toLocaleTimeString(LOCALE, {
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome'
  });
}

// ─── Formato importo in euro da centesimi (es. 2000 → "20") ───────────────
function fmtEuroCent(cent) {
  const v = (cent || 0) / 100;
  return v.toLocaleString(LOCALE, { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
}

// ─── Scelta modalità di pagamento allo Step 4 ─────────────────────────────
function setPaga(online) {
  ST.pagaOnline = !!online;
  goStep4();
}

function labelSubmit() {
  return (ST.config.pagamenti_attivi && ST.pagaOnline) ? T.submitPay : T.submitConfirm;
}

// ─── STEP 1 — Selezione esame ─────────────────────────────────────────────
async function goStep1() {
  ST.step = 1;
  updateDots(1);
  main().innerHTML = `<div class="pr-card">
    <div class="pr-card-title">${T.whichExam}</div>
    <div class="pr-card-body">
      <div id="esami-wrap"><div class="pr-loader"><div class="pr-spinner"></div><br>${T.loadingExams}</div></div>
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
        `<div class="pr-error">${T.loadExamsErr}</div>`;
      return;
    }
  }

  if (ST.esami.length === 0) {
    document.getElementById('esami-wrap').innerHTML =
      `<div class="pr-empty"><div class="pr-empty-icon">🩺</div>${T.noExams}</div>`;
    return;
  }

  document.getElementById('esami-wrap').innerHTML = renderEsamiGrid();
}

function renderEsamiGrid() {
  function getIcon() {
    return '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12h4l2.5-6 4 13 3-8 1.5 3H22"/></svg>';
  }

  function renderItem(e) {
    return `<div class="esame-item${e.id === ST.esameId ? ' selected' : ''}" onclick="selectEsame('${e.id}')">
      <div class="esame-icon">${getIcon(e.nome)}</div>
      <div>
        <div class="esame-nome">${esc(trNome(e.nome))}</div>
        <div class="esame-durata">⏱ ${e.durata_minuti} ${T.minutes} · €80</div>
      </div>
      <div class="esame-arrow">›</div>
    </div>`;
  }

  if (!window.ESAMI_CATEGORIE) {
    return `<div class="esame-grid">${ST.esami.map(renderItem).join('')}</div>`;
  }

  return ESAMI_CATEGORIE.raggruppa(ST.esami).map(function (g) {
    return `<div class="esame-section">
      <div class="esame-section-title">${esc(trCat(g.cat))}</div>
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
    <div class="pr-card-title">${T.selectedExam}</div>
    <div class="pr-card-body">
      <div class="esame-item selected" style="cursor:default">
        <div class="esame-icon"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12h4l2.5-6 4 13 3-8 1.5 3H22"/></svg></div>
        <div>
          <div class="esame-nome">${esc(trNome(ST.esameName))}</div>
          <div class="esame-durata">⏱ 30 ${T.minutes} · €80</div>
        </div>
      </div>
      ${prepBlock()}
      <div class="pr-btn-row" style="margin-top:16px">
        <button class="pr-btn-ghost" onclick="goStep1()">${T.changeExam}</button>
        <button class="pr-btn-pri" onclick="goStep2()">${T.chooseDate}</button>
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
      <div class="pr-card-title">${T.chooseTheDate} <span>· ${esc(trNome(ST.esameName))}</span></div>
      <div class="pr-card-body">
        ${prepBlock()}
        <div id="date-wrap"><div class="pr-loader"><div class="pr-spinner"></div><br>${T.checkingAvail}</div></div>
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
        `<div class="pr-error">${T.loadAvailErr}</div>
         <div style="margin-top:12px"><button class="pr-btn-ghost" onclick="goStep1()">${T.goBack}</button></div>`;
      return;
    }
  }

  if (ST.giorni.length === 0) {
    document.getElementById('date-wrap').innerHTML = `
      <div class="pr-empty">
        <div class="pr-empty-icon">📅</div>
        ${T.noSlots}<br>
        <small style="color:#94a3b8">${T.tryLater}</small>
      </div>
      <div style="margin-top:12px"><button class="pr-btn-ghost" onclick="goStep1()">${T.goBack}</button></div>`;
    return;
  }

  document.getElementById('date-wrap').innerHTML = `
    <div class="date-list">
      ${ST.giorni.map(g => `
        <div class="date-item${g.data===ST.dataScelta?' selected':''}" onclick="selectData('${g.data}','${esc(g.giorno)}')">
          <div class="date-item-txt">${esc(g.giorno)}</div>
          <div class="date-item-cnt">${g.slots.length} ${T.times}</div>
        </div>
      `).join('')}
    </div>
    <div style="margin-top:14px"><button class="pr-btn-ghost" onclick="goStep1()">${T.changeExam}</button></div>`;
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

  ST._slotsGiorno = giorno.slots;

  const mattinaI    = giorno.slots.map((s, i) => ({ s, i })).filter(({s}) => parseInt(s.ora) < 13);
  const pomeriggioI = giorno.slots.map((s, i) => ({ s, i })).filter(({s}) => parseInt(s.ora) >= 15);

  main().innerHTML = `
    <div class="pr-card">
      <div class="pr-card-title">${T.chooseTime} <span>· ${esc(ST.dataLabel)}</span></div>
      <div class="pr-card-body">
        ${prepBlock()}
        ${mattinaI.length > 0 ? `
          <div class="ora-section">
            <div class="ora-section-lbl">${T.morning}</div>
            <div class="ora-grid">
              ${mattinaI.map(({s, i}) => `
                <button class="ora-btn${ST.slotScelta?.ora===s.ora?' selected':''}"
                  onclick="selectSlotByIdx(${i})">${esc(s.ora)}</button>`).join('')}
            </div>
          </div>` : ''}
        ${pomeriggioI.length > 0 ? `
          <div class="ora-section">
            <div class="ora-section-lbl">${T.afternoon}</div>
            <div class="ora-grid">
              ${pomeriggioI.map(({s, i}) => `
                <button class="ora-btn${ST.slotScelta?.ora===s.ora?' selected':''}"
                  onclick="selectSlotByIdx(${i})">${esc(s.ora)}</button>`).join('')}
            </div>
          </div>` : ''}
        <div style="margin-top:14px">
          <button class="pr-btn-ghost" onclick="goStep2()">${T.changeDate}</button>
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
      <div class="pr-card-title">${T.yourDetails}</div>
      <div class="pr-card-body">
        ${prepBlock()}
        <div class="field-row">
          <div class="field">
            <label>${T.surname} *</label>
            <input type="text" id="f-cognome" value="${esc(f.cognome)}" placeholder="Rossi" autocomplete="family-name" required>
          </div>
          <div class="field">
            <label>${T.firstName} *</label>
            <input type="text" id="f-nome" value="${esc(f.nome)}" placeholder="Mario" autocomplete="given-name" required>
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label>${T.birthDate} *</label>
            <input type="date" id="f-nascita" value="${esc(f.data_nascita)}" required>
          </div>
          <div class="field">
            <label>${T.sex}</label>
            <select id="f-sesso">
              <option value="">—</option>
              <option value="M"${f.sesso==='M'?' selected':''}>${T.male}</option>
              <option value="F"${f.sesso==='F'?' selected':''}>${T.female}</option>
            </select>
          </div>
        </div>
        <div class="field-full">
          <div class="field">
            <label>${T.phone} *</label>
            <div class="phone-wrap">
              <select id="f-prefisso" class="phone-prefix" autocomplete="tel-country-code">
                <option value="+39" data-flag="🇮🇹" selected>🇮🇹 +39</option>
                <option value="+1"  data-flag="🇺🇸">🇺🇸 +1</option>
                <option value="+44" data-flag="🇬🇧">🇬🇧 +44</option>
                <option value="+33" data-flag="🇫🇷">🇫🇷 +33</option>
                <option value="+49" data-flag="🇩🇪">🇩🇪 +49</option>
                <option value="+34" data-flag="🇪🇸">🇪🇸 +34</option>
                <option value="+351" data-flag="🇵🇹">🇵🇹 +351</option>
                <option value="+41" data-flag="🇨🇭">🇨🇭 +41</option>
                <option value="+43" data-flag="🇦🇹">🇦🇹 +43</option>
                <option value="+32" data-flag="🇧🇪">🇧🇪 +32</option>
                <option value="+31" data-flag="🇳🇱">🇳🇱 +31</option>
                <option value="+48" data-flag="🇵🇱">🇵🇱 +48</option>
                <option value="+40" data-flag="🇷🇴">🇷🇴 +40</option>
                <option value="+30" data-flag="🇬🇷">🇬🇷 +30</option>
                <option value="+7"  data-flag="🇷🇺">🇷🇺 +7</option>
                <option value="+86" data-flag="🇨🇳">🇨🇳 +86</option>
                <option value="+91" data-flag="🇮🇳">🇮🇳 +91</option>
                <option value="+55" data-flag="🇧🇷">🇧🇷 +55</option>
                <option value="+54" data-flag="🇦🇷">🇦🇷 +54</option>
                <option value="+52" data-flag="🇲🇽">🇲🇽 +52</option>
                <option value="+61" data-flag="🇦🇺">🇦🇺 +61</option>
                <option value="+81" data-flag="🇯🇵">🇯🇵 +81</option>
                <option value="+82" data-flag="🇰🇷">🇰🇷 +82</option>
                <option value="+971" data-flag="🇦🇪">🇦🇪 +971</option>
                <option value="+966" data-flag="🇸🇦">🇸🇦 +966</option>
                <option value="+20" data-flag="🇪🇬">🇪🇬 +20</option>
                <option value="+27" data-flag="🇿🇦">🇿🇦 +27</option>
              </select>
              <input type="tel" id="f-telefono" value="${esc(f.telefono)}" placeholder="333 1234567" autocomplete="tel" required>
            </div>
          </div>
        </div>
        <div class="field-full">
          <div class="field">
            <label>${T.email} *</label>
            <input type="email" id="f-email" value="${esc(f.email)}" placeholder="${T.emailPh}" autocomplete="email" required>
          </div>
        </div>
        <div class="field-full">
          <div class="field">
            <label>${T.taxCode} *</label>
            <input type="text" id="f-cf" value="${esc(f.codice_fiscale)}" placeholder="RSSMRA80A01H501Z"
              autocomplete="off" style="text-transform:uppercase" required>
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label>${T.street} *</label>
            <input type="text" id="f-indirizzo" value="${esc(f.indirizzo)}" placeholder="${T.streetPh}"
              autocomplete="street-address" required>
          </div>
          <div class="field" style="max-width:90px">
            <label>${T.houseNo} *</label>
            <input type="text" id="f-civico" value="${esc(f.civico)}" placeholder="10"
              autocomplete="address-line2" required>
          </div>
        </div>
        <div class="field-row">
          <div class="field" style="max-width:100px">
            <label>${T.postcode} *</label>
            <input type="text" id="f-cap" value="${esc(f.cap)}" placeholder="97016"
              maxlength="5" pattern="[0-9]{5}" autocomplete="postal-code" required>
          </div>
          <div class="field">
            <label>${T.town} *</label>
            <input type="text" id="f-comune" value="${esc(f.comune)}" placeholder="${T.townPh}"
              autocomplete="address-level2" required>
          </div>
        </div>
        <div class="field-full">
          <div class="field">
            <label>${T.notes}</label>
            <textarea id="f-note" rows="2" placeholder="${T.notesPh}">${esc(f.note)}</textarea>
          </div>
        </div>
        <!-- Privacy consent — obbligatorio GDPR -->
        <div class="privacy-wrap">
          <label class="privacy-label">
            <input type="checkbox" id="f-privacy" ${ST.privacyAccettata ? 'checked' : ''}
              onchange="ST.privacyAccettata=this.checked">
            <span>
              ${T.privacyPre}<a href="/privacy" target="_blank" class="pr-link">${T.privacyLink}</a>${T.privacyPost}
            </span>
          </label>
        </div>
        <div id="form-err" class="pr-error hidden"></div>
        <div class="pr-btn-row">
          <button class="pr-btn-ghost" onclick="goStep2b()">←</button>
          <button class="pr-btn-pri" onclick="avanzaStep4()">${T.next}</button>
        </div>
      </div>
    </div>`;

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
  const prefisso      = document.getElementById('f-prefisso')?.value || '+39';
  const telNudo       = document.getElementById('f-telefono').value.trim().replace(/^\+\d+\s*/, '');
  const telefono      = prefisso + telNudo;
  const email         = document.getElementById('f-email').value.trim();
  const codice_fiscale = document.getElementById('f-cf').value.trim().toUpperCase();
  const indirizzo      = document.getElementById('f-indirizzo').value.trim();
  const civico         = document.getElementById('f-civico').value.trim();
  const cap            = document.getElementById('f-cap').value.trim();
  const comune         = document.getElementById('f-comune').value.trim();
  const note           = document.getElementById('f-note').value.trim();
  const errEl         = document.getElementById('form-err');

  errEl.classList.add('hidden');

  if (!cognome || !nome) { showFormErr(errEl, T.vName); return; }
  if (!data_nascita)     { showFormErr(errEl, T.vBirth); return; }
  if (!telefono)         { showFormErr(errEl, T.vPhone); return; }
  if (!email)            { showFormErr(errEl, T.vEmail); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showFormErr(errEl, T.vEmailValid);
    return;
  }
  if (!codice_fiscale)   { showFormErr(errEl, T.vCf); return; }
  if (!/^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$/.test(codice_fiscale)) {
    showFormErr(errEl, T.vCfValid);
    return;
  }
  if (!indirizzo) { showFormErr(errEl, T.vStreet); return; }
  if (!civico)    { showFormErr(errEl, T.vCivico); return; }
  if (!cap || !/^[0-9]{5}$/.test(cap)) {
    showFormErr(errEl, T.vCap); return;
  }
  if (!comune) {
    showFormErr(errEl, T.vComune); return;
  }
  if (!ST.privacyAccettata) {
    showFormErr(errEl, T.vPrivacy);
    return;
  }

  Object.assign(ST.form, { cognome, nome, data_nascita, sesso, telefono, email, codice_fiscale, indirizzo, civico, cap, comune, note });
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
    ? new Date(f.data_nascita + 'T00:00:00').toLocaleDateString(LOCALE, { day:'2-digit', month:'2-digit', year:'numeric' })
    : '—';
  const orarioFmt = ST.slotScelta?.ora || fmtOra(ST.slotScelta?.data_ora_inizio || '');

  main().innerHTML = `
    <div class="pr-card">
      <div class="pr-card-title">${T.summary}</div>
      <div class="pr-card-body">
        ${prepBlock()}
        <div class="recap">
          <div class="recap-row">
            <div class="recap-icon">🩺</div>
            <div><div class="recap-lbl">${T.lblExam}</div><div class="recap-val">${esc(trNome(ST.esameName))}</div></div>
          </div>
          <div class="recap-row">
            <div class="recap-icon">💶</div>
            <div><div class="recap-lbl">${T.lblCost}</div><div class="recap-val">€80</div></div>
          </div>
          <div class="recap-row">
            <div class="recap-icon">📅</div>
            <div>
              <div class="recap-lbl">${T.lblDateTime}</div>
              <div class="recap-val" style="text-transform:capitalize">${esc(ST.dataLabel)} ${T.at} <strong>${esc(orarioFmt)}</strong></div>
            </div>
          </div>
          <div class="recap-row">
            <div class="recap-icon">👤</div>
            <div>
              <div class="recap-lbl">${T.lblPatient}</div>
              <div class="recap-val">${esc(f.cognome)} ${esc(f.nome)} · ${nascitaFmt}</div>
            </div>
          </div>
          <div class="recap-row">
            <div class="recap-icon">📞</div>
            <div><div class="recap-lbl">${T.lblPhone}</div><div class="recap-val">${esc(f.telefono)}</div></div>
          </div>
          <div class="recap-row">
            <div class="recap-icon">✉️</div>
            <div><div class="recap-lbl">${T.lblEmail}</div><div class="recap-val">${esc(f.email)}</div></div>
          </div>
          ${f.codice_fiscale ? `
          <div class="recap-row">
            <div class="recap-icon">🪪</div>
            <div><div class="recap-lbl">${T.lblTaxCode}</div><div class="recap-val">${esc(f.codice_fiscale)}</div></div>
          </div>` : ''}
          ${f.indirizzo ? `
          <div class="recap-row">
            <div class="recap-icon">📍</div>
            <div><div class="recap-lbl">${T.lblResidence}</div><div class="recap-val">${esc(f.indirizzo)} ${esc(f.civico)}, ${esc(f.cap)} ${esc(f.comune)}</div></div>
          </div>` : ''}
          ${f.note ? `
          <div class="recap-row">
            <div class="recap-icon">📝</div>
            <div><div class="recap-lbl">${T.lblNotes}</div><div class="recap-val">${esc(f.note)}</div></div>
          </div>` : ''}
        </div>
        ${ST.config.pagamenti_attivi ? `
        <div style="margin:18px 0 4px;display:flex;flex-direction:column;gap:10px">
          <div onclick="setPaga(true)" style="cursor:pointer;border:2px solid ${ST.pagaOnline?'#16a34a':'#e2e8f0'};background:${ST.pagaOnline?'#f0fdf4':'#fff'};border-radius:12px;padding:14px 16px">
            <div style="display:flex;align-items:center;gap:8px;font-size:15px;color:#1e293b;font-weight:700">
              <span style="width:18px;height:18px;border-radius:50%;border:2px solid ${ST.pagaOnline?'#16a34a':'#cbd5e1'};display:inline-block;position:relative;flex:none">${ST.pagaOnline?'<span style=\'position:absolute;inset:3px;background:#16a34a;border-radius:50%\'></span>':''}</span>
              ${T.immConfirm}
              <span style="margin-left:auto;background:#16a34a;color:#fff;font-size:10px;font-weight:700;padding:3px 8px;border-radius:999px;letter-spacing:.04em">${T.recommended}</span>
            </div>
            <div style="margin-top:6px;font-size:13px;color:#475569;line-height:1.5">${T.payOnlineDesc1}<strong>€${fmtEuroCent(ST.config.importo_cent)}</strong>${T.payOnlineDesc2}<strong>${T.confirmedNow}</strong>.</div>
          </div>
          <div onclick="setPaga(false)" style="cursor:pointer;border:2px solid ${!ST.pagaOnline?'#0e7c8b':'#e2e8f0'};background:${!ST.pagaOnline?'#f8fafc':'#fff'};border-radius:12px;padding:14px 16px">
            <div style="display:flex;align-items:center;gap:8px;font-size:15px;color:#1e293b;font-weight:700">
              <span style="width:18px;height:18px;border-radius:50%;border:2px solid ${!ST.pagaOnline?'#0e7c8b':'#cbd5e1'};display:inline-block;position:relative;flex:none">${!ST.pagaOnline?'<span style=\'position:absolute;inset:3px;background:#0e7c8b;border-radius:50%\'></span>':''}</span>
              ${T.payAtStudio}
            </div>
            <div style="margin-top:6px;font-size:13px;color:#475569;line-height:1.5">${T.payAtStudioDesc}</div>
          </div>
        </div>` : ''}
        <div class="recap-note">
          ${(ST.config.pagamenti_attivi && ST.pagaOnline)
            ? `💳${T.noteOnlinePaid}<strong>${T.noteConfirmedNow}</strong>.<br>${T.noteEmailConfirm}`
            : `ℹ️${T.noteNeedsApproval}<br>${T.noteSmsTo}<strong>${T.noteSms}</strong>${T.noteToNumber}<strong>${esc(f.telefono)}</strong>.`}
        </div>
        <div id="submit-err" class="pr-error hidden"></div>
        <div class="pr-btn-row">
          <button class="pr-btn-ghost" onclick="goStep3()">←</button>
          <button class="pr-btn-pri" id="btn-submit" onclick="inviaPrenota()">
            ${labelSubmit()}
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
  btn.textContent = T.sending;

  const f = ST.form;
  const payload = {
    tipo_id:        ST.esameId,
    data_ora_inizio: ST.slotScelta.data_ora_inizio,
    cognome:         f.cognome,
    nome:            f.nome,
    data_nascita:    f.data_nascita,
    sesso:           f.sesso || null,
    telefono:        f.telefono,
    email:           f.email,
    codice_fiscale:  f.codice_fiscale || null,
    indirizzo:       f.indirizzo || null,
    civico:          f.civico || null,
    cap:             f.cap || null,
    comune:          f.comune || null,
    note:            f.note || null,
    paga_online:     !!(ST.config.pagamenti_attivi && ST.pagaOnline),
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
        ST.giorni = [];
        showFormErr(errEl, data.error || T.slotTaken);
        btn.disabled = false;
        btn.textContent = labelSubmit();
        return;
      }
      throw new Error(data.error || T.serverErr);
    }
    if (data.checkout_url) {
      btn.textContent = T.redirecting;
      window.location.href = data.checkout_url;
      return;
    }
    goSuccess(f.telefono);
  } catch (e) {
    showFormErr(errEl, e.message || T.networkErr);
    btn.disabled = false;
    btn.textContent = labelSubmit();
  }
}

// ─── PAGINA SUCCESSO ──────────────────────────────────────────────────────
function goSuccess(telefono) {
  document.getElementById('pr-steps').classList.add('hidden');

  main().innerHTML = `
    <div class="pr-card">
      <div class="pr-success">
        <div class="pr-success-icon">✅</div>
        <h2>${T.sentTitle}</h2>
        <p>${T.sentP1}</p>
        <p>${T.sentP2a}<strong>${T.sentP2b}</strong>${T.sentP2c}<span class="tel">${esc(telefono)}</span>.</p>
        <p style="margin-top:16px;font-size:13px;color:#94a3b8">
          ${T.sentHelp}
        </p>
        <a href="${SITE_URL}" class="pr-btn-pri" style="margin-top:24px;text-decoration:none">
          ${T.backToSite}
        </a>
      </div>
    </div>`;
}

// ─── RITORNO DAL PAGAMENTO (Stripe Checkout) ──────────────────────────────
function renderEsitoPagamento(ok) {
  const steps = document.getElementById('pr-steps');
  if (steps) steps.classList.add('hidden');

  if (ok) {
    main().innerHTML = `
      <div class="pr-card">
        <div class="pr-success">
          <div class="pr-success-icon">✅</div>
          <h2>${T.payOkTitle}</h2>
          <p>${T.payOkP1a}<strong>${T.payOkP1b}</strong>.</p>
          <p>${T.payOkP2a}<strong>${T.payOkP2b}</strong>${T.payOkP2c}</p>
          <p style="margin-top:16px;font-size:13px;color:#94a3b8">
            ${T.payOkNote}
          </p>
          <a href="${SITE_URL}" class="pr-btn-pri" style="margin-top:24px;text-decoration:none">
            ${T.backToSite}
          </a>
        </div>
      </div>`;
  } else {
    main().innerHTML = `
      <div class="pr-card">
        <div class="pr-success">
          <div class="pr-success-icon">⚠️</div>
          <h2>${T.payKoTitle}</h2>
          <p>${T.payKoP1}</p>
          <p>${T.payKoP2a}<strong>${T.payKoP2b}</strong>${T.payKoP2c}<strong>${T.payKoP2d}</strong>.</p>
          <p style="margin-top:16px;font-size:13px;color:#94a3b8">
            ${T.payKoNote}
          </p>
          <a href="${NEW_BOOKING_URL}" class="pr-btn-pri" style="margin-top:24px;text-decoration:none">
            ${T.newBooking}
          </a>
        </div>
      </div>`;
  }
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
  applyStaticI18n();

  const pagamento = new URLSearchParams(window.location.search).get('pagamento');
  if (pagamento === 'ok' || pagamento === 'annullato') {
    renderEsitoPagamento(pagamento === 'ok');
    return;
  }

  try {
    const rc = await fetch('/api/public/config');
    if (rc.ok) ST.config = await rc.json();
  } catch (e) { /* pagamenti non disponibili: solo "paga in studio" */ }
  ST.pagaOnline = !!ST.config.pagamenti_attivi;

  await goStep1();
  const match = findEsameFromQuery();
  if (match) {
    ST.esameId = match.id;
    ST.esameName = match.nome;
    renderEsameSceltoStep1();
  }
});
