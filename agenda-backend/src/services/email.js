const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const MEDICO_EMAIL = 'salvatore.susino93@gmail.com';

function formatData(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString('it-IT', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  });
}

function formatOra(isoString) {
  return new Date(isoString).toLocaleTimeString('it-IT', {
    hour: '2-digit', minute: '2-digit'
  });
}

async function notificaNuovoAppuntamento(appuntamento) {
  if (!process.env.RESEND_API_KEY) return;

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

module.exports = { notificaNuovoAppuntamento };
