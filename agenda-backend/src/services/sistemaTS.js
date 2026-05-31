// ═══════════════════════════════════════════════════════════════════════════
// SISTEMA TS — Invio dati spese sanitarie 730 precompilata (MEF)
//
// Flusso:
//   1. Costruisce XML con CF cifrati RSA (SanitelCF.cer)
//   2. Comprime in ZIP
//   3. Invia via MTOM/SOAP al web service MEF
//
// Variabili d'ambiente:
//   SISTEMA_TS_CF_EROGATORE   (CF del medico)
//   SISTEMA_TS_PIVA           (P.IVA studio)
//   SISTEMA_TS_CODICE_UFFICIO (codice ufficio MEF)
//   SISTEMA_TS_PINCODE        (pincode MEF)
//   SISTEMA_TS_TEST           (se "true" usa endpoint di test MEF)
// ═══════════════════════════════════════════════════════════════════════════

const https  = require('https');
const crypto = require('crypto');
const zlib   = require('zlib');
const fs     = require('fs');
const path   = require('path');

const CF_EROGATORE   = process.env.SISTEMA_TS_CF_EROGATORE  || '';
const PIVA           = process.env.SISTEMA_TS_PIVA           || '';
const CODICE_UFFICIO = process.env.SISTEMA_TS_CODICE_UFFICIO || '';
const PINCODE        = process.env.SISTEMA_TS_PINCODE        || '';
const TEST_MODE      = process.env.SISTEMA_TS_TEST === 'true';

const WS_URL_PROD = 'https://invioss730p.sanita.finanze.it/InvioTelematicoSS730pMtomWeb/InvioTelematicoSS730pMtomPort';
const WS_URL_TEST = 'https://invioSS730pTest.sanita.finanze.it/InvioTelematicoSS730pMtomWeb/InvioTelematicoSS730pMtomPort';
const WS_URL      = TEST_MODE ? WS_URL_TEST : WS_URL_PROD;

const CERT_PATH = path.join(__dirname, '..', 'certs', 'SanitelCF.cer');
let _cert = null;
function getCert() {
  if (!_cert) _cert = fs.readFileSync(CERT_PATH);
  return _cert;
}

function sistemaTSConfigurato() {
  return !!(CF_EROGATORE && PIVA && CODICE_UFFICIO && PINCODE);
}

// ─── Cifratura RSA PKCS1 con SanitelCF.cer ──────────────────────────────────
function cifraRSA(testo) {
  const enc = crypto.publicEncrypt(
    { key: getCert(), padding: crypto.constants.RSA_PKCS1_PADDING },
    Buffer.from(testo.toUpperCase(), 'utf8')
  );
  return enc.toString('base64');
}

// ─── Costruisce XML delle spese ──────────────────────────────────────────────
function buildXML(prestazioni) {
  const cfPropCifrato = cifraRSA(CF_EROGATORE);

  const documenti = prestazioni.map(p => {
    const cfCittadinoCifrato = cifraRSA(p.codice_fiscale);
    const dataEmissione      = p.data_fattura.slice(0, 10);
    const dataPagamento      = (p.data_pagamento || p.data_fattura).slice(0, 10);
    const importo            = parseFloat(p.importo_euro).toFixed(2);
    const pagTracciato       = p.pagamento_tracciato ? 'SI' : 'NO';
    const numDocumento       = p.numero_fattura
      ? p.numero_fattura.replace('/', '')   // "5/2026" → "52026"
      : String(p.id).replace(/\D/g, '').slice(-8) || '1';

    return `
  <documentoSpesa>
    <idSpesa>
      <pIva>${PIVA}</pIva>
      <dataEmissione>${dataEmissione}</dataEmissione>
      <numDocumentoFiscale>
        <dispositivo>1</dispositivo>
        <numDocumento>${numDocumento}</numDocumento>
      </numDocumentoFiscale>
    </idSpesa>
    <dataPagamento>${dataPagamento}</dataPagamento>
    <flagOperazione>${p.flag_operazione || 'I'}</flagOperazione>
    <cfCittadino>${cfCittadinoCifrato}</cfCittadino>
    <pagamentoTracciato>${pagTracciato}</pagamentoTracciato>
    <tipoDocumento>F</tipoDocumento>
    <flagOpposizione>0</flagOpposizione>
    <voceSpesa>
      <tipoSpesa>SR</tipoSpesa>
      <importo>${importo}</importo>
      <naturaIVA>N2</naturaIVA>
    </voceSpesa>
  </documentoSpesa>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<precompilata xsi:noNamespaceSchemaLocation="730_precompilata.xsd"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <proprietario>
    <cfProprietario>${cfPropCifrato}</cfProprietario>
  </proprietario>${documenti}
</precompilata>`;
}

// ─── CRC32 per ZIP ───────────────────────────────────────────────────────────
function crc32(buf) {
  const t = crc32._t || (crc32._t = (() => {
    const arr = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      arr[i] = c;
    }
    return arr;
  })());
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// ─── Crea ZIP in memoria ─────────────────────────────────────────────────────
function creaZip(nomeFile, xmlContent) {
  return new Promise((resolve, reject) => {
    const xmlBuf  = Buffer.from(xmlContent, 'utf8');
    const nameBuf = Buffer.from(nomeFile, 'utf8');
    const now     = new Date();
    const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
    const crc     = crc32(xmlBuf);

    zlib.deflateRaw(xmlBuf, (err, comp) => {
      if (err) return reject(err);

      // Local file header (30 + name)
      const lfh = Buffer.alloc(30 + nameBuf.length);
      lfh.writeUInt32LE(0x04034b50, 0);
      lfh.writeUInt16LE(20, 4); lfh.writeUInt16LE(0, 6); lfh.writeUInt16LE(8, 8);
      lfh.writeUInt16LE(dosTime, 10); lfh.writeUInt16LE(dosDate, 12);
      lfh.writeUInt32LE(crc, 14); lfh.writeUInt32LE(comp.length, 18);
      lfh.writeUInt32LE(xmlBuf.length, 22); lfh.writeUInt16LE(nameBuf.length, 26);
      lfh.writeUInt16LE(0, 28); nameBuf.copy(lfh, 30);

      // Central directory (46 + name)
      const cdh = Buffer.alloc(46 + nameBuf.length);
      cdh.writeUInt32LE(0x02014b50, 0);
      cdh.writeUInt16LE(20, 4); cdh.writeUInt16LE(20, 6);
      cdh.writeUInt16LE(0, 8); cdh.writeUInt16LE(8, 10);
      cdh.writeUInt16LE(dosTime, 12); cdh.writeUInt16LE(dosDate, 14);
      cdh.writeUInt32LE(crc, 16); cdh.writeUInt32LE(comp.length, 20);
      cdh.writeUInt32LE(xmlBuf.length, 24); cdh.writeUInt16LE(nameBuf.length, 28);
      for (let i = 30; i < 42; i += 2) cdh.writeUInt16LE(0, i);
      cdh.writeUInt32LE(0, 42); nameBuf.copy(cdh, 46);

      const offsetCD = lfh.length + comp.length;

      // End of central directory
      const eocd = Buffer.alloc(22);
      eocd.writeUInt32LE(0x06054b50, 0);
      eocd.writeUInt16LE(0, 4); eocd.writeUInt16LE(0, 6);
      eocd.writeUInt16LE(1, 8); eocd.writeUInt16LE(1, 10);
      eocd.writeUInt32LE(cdh.length, 12); eocd.writeUInt32LE(offsetCD, 16);
      eocd.writeUInt16LE(0, 20);

      resolve(Buffer.concat([lfh, comp, cdh, eocd]));
    });
  });
}

// ─── Costruisce MTOM/SOAP ────────────────────────────────────────────────────
function buildMTOM(nomeZip, zipBuf, pincodeCifrato) {
  const boundary = 'MIMEBoundary_sistemats';

  const soap = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:ejb="http://ejb.invioTelematicoSS730p.sanita.finanze.it/">
  <soapenv:Header/>
  <soapenv:Body>
    <ejb:inviaFileMtom>
      <nomeFileAllegato>${nomeZip}</nomeFileAllegato>
      <pincodeInvianteCifrato>${pincodeCifrato}</pincodeInvianteCifrato>
      <datiProprietario>
        <cfProprietario>${CF_EROGATORE}</cfProprietario>
      </datiProprietario>
      <opzionale1></opzionale1>
      <opzionale2></opzionale2>
      <opzionale3></opzionale3>
      <documento><xop:Include xmlns:xop="http://www.w3.org/2004/08/xop/include"
        href="cid:${nomeZip}@sistemats"/></documento>
    </ejb:inviaFileMtom>
  </soapenv:Body>
</soapenv:Envelope>`;

  const body = [
    `--${boundary}`,
    `Content-Type: application/xop+xml; charset=UTF-8; type="text/xml"`,
    `Content-Transfer-Encoding: 8bit`,
    `Content-ID: <rootpart@sistemats>`,
    ``,
    soap,
    `--${boundary}`,
    `Content-Type: application/zip`,
    `Content-Transfer-Encoding: base64`,
    `Content-ID: <${nomeZip}@sistemats>`,
    ``,
    zipBuf.toString('base64'),
    `--${boundary}--`,
  ].join('\r\n');

  return {
    body,
    contentType: `multipart/related; type="application/xop+xml"; start="<rootpart@sistemats>"; start-info="text/xml"; boundary="${boundary}"`,
  };
}

// ─── Invio HTTP al MEF ───────────────────────────────────────────────────────
function inviaAlWebService(body, contentType) {
  return new Promise((resolve, reject) => {
    const url     = new URL(WS_URL);
    const bodyBuf = Buffer.from(body, 'utf8');
    const req = https.request({
      hostname: url.hostname,
      path:     url.pathname,
      method:   'POST',
      // L'endpoint di TEST del MEF usa un certificato firmato dalla CA privata
      // "Sogei Certification Authority Test", non attendibile pubblicamente: in
      // modalità test disabilitiamo la verifica TLS. In PRODUZIONE l'endpoint usa
      // una catena Sectigo/USERTrust pubblica e valida, quindi la verifica resta
      // attiva (rejectUnauthorized: true) per sicurezza.
      rejectUnauthorized: !TEST_MODE,
      headers:  {
        'Content-Type':   contentType,
        'Content-Length': bodyBuf.length,
        'SOAPAction':     '""',
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(data);
        else reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 500)}`));
      });
    });
    req.on('error', reject);
    req.write(bodyBuf);
    req.end();
  });
}

// ─── Funzione principale ─────────────────────────────────────────────────────
async function inviaPrestazioni(prestazioni) {
  if (!sistemaTSConfigurato()) throw new Error('Sistema TS: variabili d\'ambiente mancanti');
  if (!prestazioni?.length)   throw new Error('Nessuna prestazione da inviare');

  console.log(`[SistemaTS] Invio ${prestazioni.length} prestazioni (${TEST_MODE ? 'TEST' : 'PRODUZIONE'})`);

  const anno    = new Date().getFullYear();
  const nomeXml = `${CF_EROGATORE}_${anno}.xml`;
  const nomeZip = `${CF_EROGATORE}_${anno}.zip`;

  const xml     = buildXML(prestazioni);
  const zipBuf  = await creaZip(nomeXml, xml);
  const pinCif  = cifraRSA(PINCODE);
  const { body, contentType } = buildMTOM(nomeZip, zipBuf, pinCif);

  const risposta   = await inviaAlWebService(body, contentType);
  const esito      = risposta.match(/<codiceEsito>(.*?)<\/codiceEsito>/)?.[1]      || '';
  const descEsito  = risposta.match(/<descrizioneEsito>(.*?)<\/descrizioneEsito>/)?.[1] || '';
  const protocollo = risposta.match(/<protocollo>(.*?)<\/protocollo>/)?.[1]        || '';

  console.log(`[SistemaTS] Esito: ${esito} — ${descEsito} — Protocollo: ${protocollo}`);

  return { ok: esito === '000', esito, descrizione: descEsito, protocollo, inviate: prestazioni.length };
}

async function simulaInvio(prestazioni) {
  console.log(`[SistemaTS] SIMULAZIONE — ${prestazioni.length} prestazioni`);
  prestazioni.forEach(p =>
    console.log(`  CF:${p.codice_fiscale} | €${p.importo_euro} | fattura:${p.numero_fattura || 'N/A'}`)
  );
  return { ok: true, inviate: prestazioni.length, simulazione: true };
}

module.exports = {
  sistemaTS: {
    configurato: sistemaTSConfigurato,
    invia:       inviaPrestazioni,
    simula:      simulaInvio,
    buildXML,
    cifraRSA,
  }
};
