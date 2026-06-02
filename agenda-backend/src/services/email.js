const MEDICO_EMAIL = 'salvatore.susino93@gmail.com';

// Mittente di tutte le email. Di default usa l'indirizzo di test di Resend
// (onboarding@resend.dev), che però consegna SOLO al proprietario dell'account
// Resend — quindi le email ai pazienti NON partono. Per inviare ai pazienti
// occorre verificare un dominio su Resend (es. studiosusino.it) e impostare
// EMAIL_FROM su Railway, es: "Studio Ecografico <noreply@studiosusino.it>".
const MITTENTE = process.env.EMAIL_FROM || 'Agenda Studio <onboarding@resend.dev>';

// ─── Dati dello studio mostrati sulla ricevuta di pagamento ──────────────
// Personalizzabili via variabili d'ambiente senza toccare il codice.
// NB: questi sono dati di intestazione "informali" della ricevuta di
// pagamento. NON costituiscono i dati fiscali (P.IVA/C.F., regime, marca
// da bollo) richiesti per una fattura/ricevuta sanitaria fiscale: quella è
// di competenza del commercialista (vedi nota in fondo al file).
const STUDIO = {
  nome:      process.env.STUDIO_NOME      || 'Studio Dott. Salvatore Susino',
  indirizzo: process.env.STUDIO_INDIRIZZO || '',
  email:     process.env.STUDIO_EMAIL     || MEDICO_EMAIL,
  telefono:  process.env.STUDIO_TELEFONO  || '',
};

function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  const { Resend } = require('resend');
  return new Resend(process.env.RESEND_API_KEY);
}

function formatData(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString('it-IT', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    timeZone: 'Europe/Rome'
  });
}

function formatOra(isoString) {
  return new Date(isoString).toLocaleTimeString('it-IT', {
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Rome'
  });
}

function formatImporto(cent) {
  const n = Number(cent);
  if (!Number.isFinite(n) || n <= 0) return '—';
  return (n / 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

async function notificaNuovoAppuntamento(appuntamento) {
  const resend = getResend();
  if (!resend) return;

  const paziente = appuntamento.pazienti;
  const esame    = appuntamento.tipi_prestazione;
  const nome     = paziente ? `${paziente.cognome} ${paziente.nome}` : '—';
  const tipoEsame = esame?.nome || '—';
  const data     = formatData(appuntamento.data_ora_inizio);
  const ora      = formatOra(appuntamento.data_ora_inizio);
  const note     = appuntamento.note_segreteria || '';

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#f9f9f9;border-radius:10px;overflow:hidden;">
      <div style="background:#4a7c2a;padding:20px 24px;">
        <h2 style="color:#fff;margin:0;font-size:18px;">📅 Nuovo appuntamento</h2>
      </div>
      <div style="padding:24px;background:#fff;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:8px 0;color:#777;font-size:13px;width:120px;">Paziente</td>
            <td style="padding:8px 0;font-weight:bold;font-size:15px;color:#222;">${nome}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#777;font-size:13px;">Esame</td>
            <td style="padding:8px 0;font-size:14px;color:#333;">${tipoEsame}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#777;font-size:13px;">Data</td>
            <td style="padding:8px 0;font-size:14px;color:#333;">${data}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#777;font-size:13px;">Ora</td>
            <td style="padding:8px 0;font-size:14px;color:#333;">${ora}</td>
          </tr>
          ${note ? `
          <tr>
            <td style="padding:8px 0;color:#777;font-size:13px;vertical-align:top;">Note</td>
            <td style="padding:8px 0;font-size:13px;color:#555;font-style:italic;">${note}</td>
          </tr>` : ''}
        </table>
      </div>
      <div style="padding:12px 24px;background:#f0f9e8;font-size:11px;color:#888;text-align:center;">
        Agenda Studio — notifica automatica
      </div>
    </div>
  `;

  try {
    await resend.emails.send({
      from: MITTENTE,
      to: MEDICO_EMAIL,
      subject: `📅 ${nome} — ${tipoEsame} — ${data} ore ${ora}`,
      html,
    });
  } catch (e) {
    console.error('[email] Errore invio notifica:', e.message);
  }
}

async function notificaAppuntamentoAnnullato(appuntamento) {
  const resend = getResend();
  if (!resend) return;

  const paziente = appuntamento.pazienti;
  const esame    = appuntamento.tipi_prestazione;
  const nome     = paziente ? `${paziente.cognome} ${paziente.nome}` : '—';
  const tipoEsame = esame?.nome || '—';
  const data     = formatData(appuntamento.data_ora_inizio);
  const ora      = formatOra(appuntamento.data_ora_inizio);

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#f9f9f9;border-radius:10px;overflow:hidden;">
      <div style="background:#b94a4a;padding:20px 24px;">
        <h2 style="color:#fff;margin:0;font-size:18px;">❌ Appuntamento annullato</h2>
      </div>
      <div style="padding:24px;background:#fff;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:8px 0;color:#777;font-size:13px;width:120px;">Paziente</td>
            <td style="padding:8px 0;font-weight:bold;font-size:15px;color:#222;">${nome}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#777;font-size:13px;">Esame</td>
            <td style="padding:8px 0;font-size:14px;color:#333;">${tipoEsame}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#777;font-size:13px;">Data</td>
            <td style="padding:8px 0;font-size:14px;color:#333;">${data}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#777;font-size:13px;">Ora</td>
            <td style="padding:8px 0;font-size:14px;color:#333;">${ora}</td>
          </tr>
        </table>
      </div>
      <div style="padding:12px 24px;background:#fdf0f0;font-size:11px;color:#888;text-align:center;">
        Agenda Studio — notifica automatica
      </div>
    </div>
  `;

  try {
    await resend.emails.send({
      from: MITTENTE,
      to: MEDICO_EMAIL,
      subject: `❌ ANNULLATO: ${nome} — ${tipoEsame} — ${data} ore ${ora}`,
      html,
    });
  } catch (e) {
    console.error('[email] Errore invio notifica annullamento:', e.message);
  }
}

// ─── EMAIL: Nuova prenotazione online (richiede approvazione) ────────────
async function notificaPrenotazioneOnline(appuntamento, tokenJwt) {
  const resend = getResend();
  if (!resend) return;

  const BASE_URL  = process.env.APP_URL || 'https://referteco-production.up.railway.app';
  const paziente  = appuntamento.pazienti;
  const esame     = appuntamento.tipi_prestazione;
  const nome      = paziente ? `${paziente.cognome} ${paziente.nome}` : '—';
  const tipoEsame = esame?.nome || '—';
  const data      = formatData(appuntamento.data_ora_inizio);
  const ora       = formatOra(appuntamento.data_ora_inizio);
  const telefono  = paziente?.telefono || '—';
  const nascita   = paziente?.data_nascita
    ? new Date(paziente.data_nascita + 'T00:00:00').toLocaleDateString('it-IT')
    : '—';

  const urlConferma = `${BASE_URL}/api/prenota/conferma/${tokenJwt}`;
  const urlRifiuta  = `${BASE_URL}/api/prenota/rifiuta/${tokenJwt}`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#f9f9f9;border-radius:10px;overflow:hidden;">
      <div style="background:#d97706;padding:20px 24px;">
        <h2 style="color:#fff;margin:0;font-size:18px;">🌐 Nuova prenotazione online</h2>
        <p style="color:#fef3c7;margin:6px 0 0;font-size:13px;">In attesa di approvazione — rispondere il prima possibile</p>
      </div>
      <div style="padding:24px;background:#fff;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:8px 0;color:#777;font-size:13px;width:120px;">Paziente</td>
            <td style="padding:8px 0;font-weight:bold;font-size:15px;color:#222;">${nome}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#777;font-size:13px;">Telefono</td>
            <td style="padding:8px 0;font-size:14px;color:#333;">${telefono}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#777;font-size:13px;">Nascita</td>
            <td style="padding:8px 0;font-size:14px;color:#333;">${nascita}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#777;font-size:13px;">Esame</td>
            <td style="padding:8px 0;font-size:14px;color:#333;">${tipoEsame}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#777;font-size:13px;">Data</td>
            <td style="padding:8px 0;font-size:14px;color:#333;">${data}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#777;font-size:13px;">Ora</td>
            <td style="padding:8px 0;font-size:14px;color:#333;">${ora}</td>
          </tr>
        </table>
      </div>
      <div style="padding:22px 24px;background:#fffbeb;text-align:center;">
        <p style="margin:0 0 18px;font-size:14px;color:#78350f;font-weight:600;">Approva o rifiuta la prenotazione:</p>
        <table style="margin:0 auto;border-spacing:16px 0;border-collapse:separate;">
          <tr>
            <td>
              <a href="${urlConferma}"
                 style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;
                        padding:13px 32px;border-radius:8px;font-size:16px;font-weight:700;">
                ✅ Conferma
              </a>
            </td>
            <td>
              <a href="${urlRifiuta}"
                 style="display:inline-block;background:#ef4444;color:#fff;text-decoration:none;
                        padding:13px 32px;border-radius:8px;font-size:16px;font-weight:700;">
                ❌ Rifiuta
              </a>
            </td>
          </tr>
        </table>
        <p style="margin:14px 0 0;font-size:11px;color:#92400e;">I link scadono tra 7 giorni.</p>
      </div>
      <div style="padding:12px 24px;background:#f0f9e8;font-size:11px;color:#888;text-align:center;">
        Agenda Studio — prenotazione online
      </div>
    </div>
  `;

  try {
    await resend.emails.send({
      from:    MITTENTE,
      to:      MEDICO_EMAIL,
      subject: `🌐 ONLINE: ${nome} — ${tipoEsame} — ${data} ore ${ora}`,
      html,
    });
  } catch (e) {
    console.error('[email] Errore notifica prenotazione online:', e.message);
  }
}

// ─── EMAIL: Prenotazione online confermata con visita pagata ─────────────
// Notifica informativa (senza pulsanti): l'appuntamento è già confermato
// perché il paziente ha pagato la visita online. Niente da approvare.
async function notificaPrenotazionePagata(appuntamento) {
  const resend = getResend();
  if (!resend) return;

  const paziente  = appuntamento.pazienti;
  const esame     = appuntamento.tipi_prestazione;
  const nome      = paziente ? `${paziente.cognome} ${paziente.nome}` : '—';
  const tipoEsame = esame?.nome || '—';
  const data      = formatData(appuntamento.data_ora_inizio);
  const ora       = formatOra(appuntamento.data_ora_inizio);
  const telefono  = paziente?.telefono || '—';
  const importo   = appuntamento.importo_pagato_cent
    ? (appuntamento.importo_pagato_cent / 100).toLocaleString('it-IT', { minimumFractionDigits: 2 }) + ' €'
    : '—';

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#f9f9f9;border-radius:10px;overflow:hidden;">
      <div style="background:#16a34a;padding:20px 24px;">
        <h2 style="color:#fff;margin:0;font-size:18px;">✅ Prenotazione confermata (pagata online)</h2>
        <p style="color:#dcfce7;margin:6px 0 0;font-size:13px;">Conferma automatica — nessuna azione richiesta</p>
      </div>
      <div style="padding:24px;background:#fff;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:8px 0;color:#777;font-size:13px;width:120px;">Paziente</td>
            <td style="padding:8px 0;font-weight:bold;font-size:15px;color:#222;">${nome}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#777;font-size:13px;">Telefono</td>
            <td style="padding:8px 0;font-size:14px;color:#333;">${telefono}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#777;font-size:13px;">Esame</td>
            <td style="padding:8px 0;font-size:14px;color:#333;">${tipoEsame}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#777;font-size:13px;">Data</td>
            <td style="padding:8px 0;font-size:14px;color:#333;">${data}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#777;font-size:13px;">Ora</td>
            <td style="padding:8px 0;font-size:14px;color:#333;">${ora}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#777;font-size:13px;">Importo pagato</td>
            <td style="padding:8px 0;font-size:14px;color:#16a34a;font-weight:700;">${importo}</td>
          </tr>
        </table>
      </div>
      <div style="padding:12px 24px;background:#f0f9e8;font-size:11px;color:#888;text-align:center;">
        Agenda Studio — prenotazione online
      </div>
    </div>
  `;

  try {
    await resend.emails.send({
      from:    MITTENTE,
      to:      MEDICO_EMAIL,
      subject: `✅ PAGATA: ${nome} — ${tipoEsame} — ${data} ore ${ora}`,
      html,
    });
  } catch (e) {
    console.error('[email] Errore notifica prenotazione pagata:', e.message);
  }
}

// ─── EMAIL: Ricevuta di pagamento al paziente ────────────────────────────
// Inviata automaticamente al PAZIENTE subito dopo il pagamento online andato
// a buon fine (dal webhook Stripe `checkout.session.completed`). Il medico
// riceve una copia in copia nascosta (BCC) per archivio.
//
// ⚠️  IMPORTANTE — NON è un documento fiscale.
// Questa è una semplice RICEVUTA DI PAGAMENTO (conferma dell'avvenuto
// incasso), utile al paziente come promemoria. NON è una fattura/ricevuta
// sanitaria fiscale: le prestazioni sanitarie sono esenti IVA (art. 10
// DPR 633/72) e la fattura sanitaria con eventuale marca da bollo e l'invio
// al Sistema Tessera Sanitaria sono di competenza del commercialista.
// Per emettere un vero documento fiscale serve un provider di fatturazione
// (es. Fatture in Cloud, Aruba, ecc.) e i dati fiscali dello studio: vedi il
// gancio `emettiFatturaFiscale` documentato in fondo al file.
//
// appuntamento: oggetto con pazienti(*) e tipi_prestazione(*) inclusi.
// importoCent:  importo effettivamente pagato in centesimi (fallback su
//               appuntamento.importo_pagato_cent).
async function inviaRicevutaPagamento(appuntamento, importoCent) {
  const resend = getResend();
  if (!resend) return;

  const paziente  = appuntamento.pazienti;
  const esame     = appuntamento.tipi_prestazione;
  const nome      = paziente ? `${paziente.cognome} ${paziente.nome}` : '—';
  const tipoEsame = esame?.nome || 'Ecografia';
  const data      = formatData(appuntamento.data_ora_inizio);
  const ora       = formatOra(appuntamento.data_ora_inizio);
  const emailPaz  = paziente?.email?.trim();
  const cent      = Number.isFinite(Number(importoCent)) && Number(importoCent) > 0
    ? Number(importoCent)
    : appuntamento.importo_pagato_cent;
  const importo   = formatImporto(cent);
  const rifPagamento = appuntamento.stripe_payment_intent || appuntamento.stripe_session_id || '—';
  const dataPagamento = new Date().toLocaleString('it-IT', {
    timeZone: 'Europe/Rome', dateStyle: 'long', timeStyle: 'short'
  });

  // Senza email del paziente non possiamo inviare la ricevuta. Avvisiamo nei
  // log così il medico (che riceve comunque la notifica "pagata") lo sa.
  if (!emailPaz) {
    console.warn('[email] Ricevuta non inviata: paziente senza email (appuntamento ' + appuntamento.id + ').');
    return;
  }

  const intestazioneStudio = [
    `<strong style="color:#1e293b;">${STUDIO.nome}</strong>`,
    STUDIO.indirizzo,
    STUDIO.telefono ? `Tel. ${STUDIO.telefono}` : '',
    STUDIO.email,
  ].filter(Boolean).join('<br>');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#f9f9f9;border-radius:10px;overflow:hidden;">
      <div style="background:#16a34a;padding:20px 24px;">
        <h2 style="color:#fff;margin:0;font-size:18px;">🧾 Ricevuta di pagamento</h2>
        <p style="color:#dcfce7;margin:6px 0 0;font-size:13px;">Pagamento ricevuto — grazie!</p>
      </div>
      <div style="padding:24px;background:#fff;">
        <p style="margin:0 0 18px;font-size:14px;color:#374151;">
          Gentile <strong>${nome}</strong>,<br>
          confermiamo di aver ricevuto il pagamento per la prestazione prenotata.
          Riepilogo:
        </p>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:8px 0;color:#777;font-size:13px;width:150px;">Paziente</td>
            <td style="padding:8px 0;font-weight:bold;font-size:15px;color:#222;">${nome}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#777;font-size:13px;">Prestazione</td>
            <td style="padding:8px 0;font-size:14px;color:#333;">${tipoEsame}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#777;font-size:13px;">Data appuntamento</td>
            <td style="padding:8px 0;font-size:14px;color:#333;">${data} — ore ${ora}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#777;font-size:13px;">Importo pagato</td>
            <td style="padding:8px 0;font-size:16px;color:#16a34a;font-weight:700;">${importo}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#777;font-size:13px;">Data pagamento</td>
            <td style="padding:8px 0;font-size:14px;color:#333;">${dataPagamento}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#777;font-size:13px;vertical-align:top;">Riferimento</td>
            <td style="padding:8px 0;font-size:12px;color:#666;font-family:monospace;word-break:break-all;">${rifPagamento}</td>
          </tr>
        </table>
      </div>
      <div style="padding:18px 24px;background:#f8fafc;font-size:12px;color:#64748b;line-height:1.6;">
        ${intestazioneStudio}
      </div>
      <div style="padding:14px 24px;background:#fffbeb;font-size:11px;color:#92400e;line-height:1.6;border-top:1px solid #fde68a;">
        Questa è una <strong>ricevuta di pagamento</strong> e non costituisce
        documento fiscale. Le prestazioni sanitarie sono esenti IVA
        (art. 10 DPR 633/72). L'eventuale fattura/ricevuta sanitaria fiscale
        verrà gestita dallo studio. Per assistenza scrivi a ${STUDIO.email}.
      </div>
      <div style="padding:12px 24px;background:#f0f9e8;font-size:11px;color:#888;text-align:center;">
        ${STUDIO.nome} — ricevuta automatica
      </div>
    </div>
  `;

  try {
    await resend.emails.send({
      from:    MITTENTE,
      to:      emailPaz,
      bcc:     MEDICO_EMAIL,
      subject: `🧾 Ricevuta di pagamento — ${tipoEsame} del ${data}`,
      html,
    });
  } catch (e) {
    console.error('[email] Errore invio ricevuta pagamento:', e.message);
  }
}

// ─── GANCIO FUTURO: fattura/ricevuta sanitaria fiscale ───────────────────
// Le prestazioni sanitarie sono esenti IVA (art. 10 DPR 633/72). L'emissione
// di una vera fattura/ricevuta sanitaria fiscale — con numerazione, eventuale
// marca da bollo (2 € sopra i 77,47 € se non già assolta) e l'invio al
// Sistema Tessera Sanitaria (e/o SDI) — NON può essere fatta "a mano" via
// codice in modo conforme: è di competenza del commercialista oppure di un
// provider di fatturazione dedicato.
//
// Quando (e se) il Dott. Susino vorrà la fatturazione fiscale automatica,
// questa funzione è il punto di innesto: integrare qui le API di un provider
// (es. Fatture in Cloud, Aruba Fatturazione, Fattura24…) usando i dati
// fiscali dello studio e del paziente (codice fiscale già disponibile su
// `pazienti.codice_fiscale`). Per ora è volutamente un no-op documentato.
// eslint-disable-next-line no-unused-vars
async function emettiFatturaFiscale(appuntamento, importoCent) {
  // TODO (opzionale): integrazione provider di fatturazione + Sistema TS.
  // Richiede: scelta provider, credenziali API, dati fiscali studio,
  // gestione numerazione/marca da bollo. Vedi nota sopra.
  return null;
}

// ─── Notifica cambio credenziali ──────────────────────────────────────────
async function notificaCambioCredenziali({ utente, cambiaUsername, cambiaPassword, ip }) {
  const resend = getResend();
  if (!resend) return;

  const ora  = new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome', dateStyle: 'full', timeStyle: 'short' });
  const cosa = [
    cambiaUsername && `Username → <strong>${cambiaUsername}</strong>`,
    cambiaPassword && `Password modificata`,
  ].filter(Boolean).join('<br>');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#f9f9f9;border-radius:10px;overflow:hidden;">
      <div style="background:#dc2626;padding:20px 24px;">
        <h2 style="color:#fff;margin:0;font-size:18px;">🔐 Credenziali modificate</h2>
      </div>
      <div style="padding:20px 24px;background:#fff;">
        <p style="margin:0 0 16px;color:#374151;">Le credenziali di accesso all'Agenda Studio sono state modificate.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:6px 0;color:#6b7280;width:140px;">Utente</td>
              <td style="padding:6px 0;font-weight:700;">${utente}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Modifiche</td>
              <td style="padding:6px 0;">${cosa}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Data e ora</td>
              <td style="padding:6px 0;">${ora}</td></tr>
          ${ip ? `<tr><td style="padding:6px 0;color:#6b7280;">IP</td>
              <td style="padding:6px 0;font-family:monospace;">${ip}</td></tr>` : ''}
        </table>
        <p style="margin:20px 0 0;font-size:13px;color:#ef4444;">
          Se non sei stato tu a fare questa modifica, accedi immediatamente e cambia la password.
        </p>
      </div>
      <div style="padding:12px 24px;background:#fef2f2;font-size:11px;color:#888;text-align:center;">
        Agenda Studio — avviso di sicurezza
      </div>
    </div>
  `;

  try {
    await resend.emails.send({
      from:    MITTENTE,
      to:      MEDICO_EMAIL,
      subject: `🔐 Credenziali modificate — utente: ${utente}`,
      html,
    });
  } catch (e) {
    console.error('[email] Errore notifica cambio credenziali:', e.message);
  }
}

module.exports = { notificaNuovoAppuntamento, notificaAppuntamentoAnnullato, notificaPrenotazioneOnline, notificaPrenotazionePagata, inviaRicevutaPagamento, emettiFatturaFiscale, notificaCambioCredenziali };
