// ═══════════════════════════════════════════════════════════════════════════
// SISTEMA TS — Invio dati spese sanitarie 730 (MEF / Tessera Sanitaria)
//
// Web service SOAP/MTOM asincrono per l'invio delle spese sanitarie
// ai fini della dichiarazione precompilata (art. 3 co. 3 D.Lgs. 175/2014).
//
// Variabili d'ambiente:
//   SISTEMA_TS_PINCODE          (obbligatorio per l'invio reale)
//   SISTEMA_TS_CF_EROGATORE     (CF del medico)
//   SISTEMA_TS_PIVA             (Partita IVA studio)
//   SISTEMA_TS_CODICE_UFFICIO   (codice ufficio Sistema TS)
// ═══════════════════════════════════════════════════════════════════════════

const https  = require('https');
const crypto = require('crypto');

// ─── Configurazione ──────────────────────────────────────────────────────
const CF_EROGATORE   = process.env.SISTEMA_TS_CF_EROGATORE  || '';
const PIVA           = process.env.SISTEMA_TS_PIVA           || '';
const CODICE_UFFICIO = process.env.SISTEMA_TS_CODICE_UFFICIO || '';
const PINCODE        = process.env.SISTEMA_TS_PINCODE        || '';

// Endpoint produzione (MTOM/SOAP)
const WS_URL = 'https://invioss730p.sanita.finanze.it/InvioTelematicoSS730pMtomWeb/InvioTelematicoSS730pMtomPort';

function sistemaTSConfigurato() {
  return !!(CF_EROGATORE && PIVA && CODICE_UFFICIO && PINCODE);
}

// ─── Cifratura CF con pincode (algoritmo Sistema TS) ─────────────────────
// Il Sistema TS richiede che i codici fiscali siano cifrati con AES-256-CBC
// usando il pincode come chiave (con padding e derivazione specifica MEF).
function cifraCF(codiceFiscale) {
  if (!PINCODE) throw new Error('SISTEMA_TS_PINCODE non configurato');
  // Derivazione chiave: SHA-256 del pincode
  const key = crypto.createHash('sha256').update(PINCODE, 'utf8').digest();
  const iv  = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let enc = cipher.update(codiceFiscale.toUpperCase(), 'utf8', 'base64');
  enc += cipher.final('base64');
  // Formato: IV (base64) + ':' + ciphertext (base64)
  return iv.toString('base64') + ':' + enc;
}

// ─── Formatta data nel formato GG/MM/AAAA ────────────────────────────────
function fmtDataTS(isoString) {
  const d = new Date(isoString);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// ─── Costruisce il record XML per una singola spesa ──────────────────────
function buildRecordSpesa(app, importoCent, numDoc) {
  const cfCittadino = app.pazienti?.codice_fiscale;
  if (!cfCittadino) throw new Error(`CF mancante per paziente ${app.id}`);

  const cfCifrato  = cifraCF(cfCittadino);
  const cfProp     = cifraCF(CF_EROGATORE);
  const dataEmiss  = fmtDataTS(app.data_ora_inizio);
  const dataPag    = fmtDataTS(app.data_ora_inizio);
  const importoEur = (importoCent / 100).toFixed(2);
  const pagTracciato = app.pagamento_stato === 'pagato' ? 'SI' : 'NO';

  return `
    <ns2:DatiSpesa>
      <ns2:cfProprietario>${cfProp}</ns2:cfProprietario>
      <ns2:documentoSpesa>
        <ns2:idDocumentoFiscale>
          <ns2:pIva>${PIVA}</ns2:pIva>
          <ns2:dataEmissione>${dataEmiss}</ns2:dataEmissione>
          <ns2:dispositivo>1</ns2:dispositivo>
          <ns2:numDoc>${numDoc}</ns2:numDoc>
          <ns2:flagPagamentoAnticipato>0</ns2:flagPagamentoAnticipato>
        </ns2:idDocumentoFiscale>
        <ns2:dataPagamento>${dataPag}</ns2:dataPagamento>
        <ns2:flagOperazione>I</ns2:flagOperazione>
        <ns2:cfCittadino>${cfCifrato}</ns2:cfCittadino>
        <ns2:pagamentoTracciato>${pagTracciato}</ns2:pagamentoTracciato>
        <ns2:tipoDocumento>F</ns2:tipoDocumento>
        <ns2:flagOpposizione>0</ns2:flagOpposizione>
        <ns2:voceSpesa>
          <ns2:tipoSpesa>SR</ns2:tipoSpesa>
          <ns2:importo>${importoEur}</ns2:importo>
          <ns2:naturaIVA>N2</ns2:naturaIVA>
        </ns2:voceSpesa>
      </ns2:documentoSpesa>
    </ns2:DatiSpesa>`;
}

// ─── Costruisce il messaggio SOAP completo ───────────────────────────────
function buildSOAP(records) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope
  xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:ns2="http://invioss730p.sanita.finanze.it/">
  <soapenv:Header/>
  <soapenv:Body>
    <ns2:invioTelematicoSS730p>
      <ns2:cfErogatore>${CF_EROGATORE}</ns2:cfErogatore>
      <ns2:codiceUfficio>${CODICE_UFFICIO}</ns2:codiceUfficio>
      <ns2:datiSpesa>
        ${records}
      </ns2:datiSpesa>
    </ns2:invioTelematicoSS730p>
  </soapenv:Body>
</soapenv:Envelope>`;
}

// ─── Invio effettivo al web service ─────────────────────────────────────
async function inviaAlWebService(soapBody) {
  return new Promise((resolve, reject) => {
    const url = new URL(WS_URL);
    const options = {
      hostname: url.hostname,
      path:     url.pathname,
      method:   'POST',
      headers:  {
        'Content-Type':   'text/xml; charset=utf-8',
        'SOAPAction':     '""',
        'Content-Length': Buffer.byteLength(soapBody),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end',  () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 500)}`));
        }
      });
    });

    req.on('error', reject);
    req.write(soapBody);
    req.end();
  });
}

// ─── Funzione principale: invia una lista di appuntamenti ────────────────
// prestazioni: array di { app: appuntamento (con pazienti+tipi_prestazione), importoCent }
// Ritorna { inviate, errori, dettagli }
async function inviaPrestazioni(prestazioni) {
  if (!sistemaSSConfigurato()) {
    throw new Error('Sistema TS non configurato (variabili d\'ambiente mancanti)');
  }

  let inviate = 0;
  const errori = [];
  const records = [];

  for (let i = 0; i < prestazioni.length; i++) {
    const { app, importoCent } = prestazioni[i];
    try {
      const numDoc = String(app.id).slice(-8).toUpperCase();
      records.push(buildRecordSpesa(app, importoCent, numDoc));
      inviate++;
    } catch (e) {
      console.error(`[SistemaTS] Errore costruzione record per app ${app.id}:`, e.message);
      errori.push({ id: app.id, errore: e.message });
    }
  }

  if (!records.length) {
    return { inviate: 0, errori: errori.length, dettagli: errori };
  }

  const soap = buildSOAP(records.join('\n'));
  console.log(`[SistemaTS] Invio ${records.length} prestazioni al Sistema TS...`);

  const risposta = await inviaAlWebService(soap);
  console.log('[SistemaTS] Risposta ricevuta:', risposta.slice(0, 500));

  return { inviate, errori: errori.length, dettagli: errori, risposta };
}

// ─── Modalità simulazione (per test senza credenziali reali) ─────────────
async function simulaInvio(prestazioni) {
  console.log(`[SistemaTS] SIMULAZIONE — ${prestazioni.length} prestazioni`);
  prestazioni.forEach(({ app }) => {
    console.log(`  - ${app.id} | ${app.pazienti?.codice_fiscale || 'CF?'} | ${app.tipi_prestazione?.nome || '?'}`);
  });
  return { inviate: prestazioni.length, errori: 0, dettagli: [], simulazione: true };
}

// Fix typo nella funzione principale
function sistemaSSConfigurato() { return sistemaTSConfigurato(); }

module.exports = {
  sistemaTS: { configurato: sistemaTSConfigurato, invia: inviaPrestazioni, simula: simulaInvio }
};
