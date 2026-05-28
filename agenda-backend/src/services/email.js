const MEDICO_EMAIL = 'salvatore.susino93@gmail.com';

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
      from: 'Agenda Studio <onboarding@resend.dev>',
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
      from: 'Agenda Studio <onboarding@resend.dev>',
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
      from:    'Agenda Studio <onboarding@resend.dev>',
      to:      MEDICO_EMAIL,
      subject: `🌐 ONLINE: ${nome} — ${tipoEsame} — ${data} ore ${ora}`,
      html,
    });
  } catch (e) {
    console.error('[email] Errore notifica prenotazione online:', e.message);
  }
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
      from:    'Agenda Studio <onboarding@resend.dev>',
      to:      MEDICO_EMAIL,
      subject: `🔐 Credenziali modificate — utente: ${utente}`,
      html,
    });
  } catch (e) {
    console.error('[email] Errore notifica cambio credenziali:', e.message);
  }
}

module.exports = { notificaNuovoAppuntamento, notificaAppuntamentoAnnullato, notificaPrenotazioneOnline, notificaCambioCredenziali };
