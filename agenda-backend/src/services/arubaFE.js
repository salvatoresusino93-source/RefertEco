// ═══════════════════════════════════════════════════════════════════════════
// ARUBA FATTURAZIONE ELETTRONICA — Creazione e invio fattura al SDI
//
// Flusso:
//   1. Autenticazione (username/password → access_token)
//   2. Costruzione XML FatturaPA (formato B2C, semplificata per prestazioni mediche)
//   3. Upload fattura (base64) → Aruba firma e invia al SDI
//   4. Ritorna { numeroFattura, filename } → usato poi da Sistema TS
//
// Variabili d'ambiente:
//   ARUBA_FE_USERNAME   (es. ARUBA01737560886)
//   ARUBA_FE_PASSWORD   (password account Aruba FE)
//   ARUBA_FE_DEMO       (se "true" usa ambiente demo Aruba — per test)
// ═══════════════════════════════════════════════════════════════════════════

const https   = require('https');
const http    = require('http');

const USERNAME = process.env.ARUBA_FE_USERNAME || '';
const PASSWORD = process.env.ARUBA_FE_PASSWORD || '';
const DEMO     = process.env.ARUBA_FE_DEMO === 'true';

// URL base Aruba FE
const AUTH_URL = DEMO
  ? 'https://demoauth.fatturazioneelettronica.aruba.it'
  : 'https://auth.fatturazioneelettronica.aruba.it';

const WS_URL = DEMO
  ? 'https://demows.fatturazioneelettronica.aruba.it'
  : 'https://ws.fatturazioneelettronica.aruba.it';

// Dati fissi del cedente (Studio Dr. Susino)
const PIVA_STUDIO    = process.env.SISTEMA_TS_PIVA           || '01737560886';
const CF_STUDIO      = process.env.SISTEMA_TS_CF_EROGATORE   || 'SSNSVT93M14H163N';
const NOME_STUDIO    = 'Studio Ecografico Dr. Salvatore Susino';
const INDIRIZZO      = 'Via dell\'Arno';
const CIVICO         = '34';
const CAP            = '97016';
const COMUNE         = 'Pozzallo';
const PROVINCIA      = 'RG';
const NAZIONE        = 'IT';

// ─── Utility HTTP ────────────────────────────────────────────────────────────
function httpRequest(method, baseUrl, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url     = new URL(path, baseUrl);
    const lib     = url.protocol === 'https:' ? https : http;
    const bodyStr = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;

    const options = {
      hostname: url.hostname,
      port:     url.port || (url.protocol === 'https:' ? 443 : 80),
      path:     url.pathname + url.search,
      method,
      headers:  {
        ...headers,
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
    };

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ─── 1. Autenticazione ────────────────────────────────────────────────────────
// Ritorna access_token (valido 30 min).
async function getToken() {
  if (!USERNAME || !PASSWORD) {
    throw new Error('[ArubaFE] ARUBA_FE_USERNAME o ARUBA_FE_PASSWORD non configurati');
  }

  const body = `grant_type=password&username=${encodeURIComponent(USERNAME)}&password=${encodeURIComponent(PASSWORD)}`;

  const res = await httpRequest('POST', AUTH_URL, '/auth/signin', {
    'Content-Type': 'application/x-www-form-urlencoded',
  }, body);

  if (res.status !== 200 || !res.body.access_token) {
    throw new Error(`[ArubaFE] Autenticazione fallita (HTTP ${res.status}): ${JSON.stringify(res.body)}`);
  }

  console.log('[ArubaFE] Token ottenuto OK');
  return res.body.access_token;
}

// ─── 2. Costruzione XML FatturaPA ─────────────────────────────────────────────
// Fattura B2C semplificata per prestazioni mediche esenti IVA (natura N2.2).
// numProgressivo: numero progressivo fattura (da tenere in DB o passare dall'esterno).
function buildFatturaXML({ numProgressivo, dataFattura, nomePaziente, cfPaziente, importoEuro, descrizionePrestazione }) {
  const anno = new Date(dataFattura).getFullYear();
  // Numero documento: es. "1/2026" — Aruba usa questo come numero fattura
  const numDocumento = `${numProgressivo}/${anno}`;

  // Importo senza IVA (prestazioni mediche esenti N2.2)
  const imponibile = parseFloat(importoEuro).toFixed(2);

  return `<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica
  versione="FPR12"
  xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
  xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2 http://www.fatturapa.gov.it/export/fatturazione/sdi/fatturapa/v1.2/Schema_del_file_xml_FatturaPA_versione_1.2.xsd">

  <FatturaElettronicaHeader>

    <DatiTrasmissione>
      <IdTrasmittente>
        <IdPaese>IT</IdPaese>
        <IdCodice>${PIVA_STUDIO}</IdCodice>
      </IdTrasmittente>
      <ProgressivoInvio>${String(numProgressivo).padStart(5, '0')}</ProgressivoInvio>
      <FormatoTrasmissione>FPR12</FormatoTrasmissione>
      <CodiceDestinatario>0000000</CodiceDestinatario>
    </DatiTrasmissione>

    <CedentePrestatore>
      <DatiAnagrafici>
        <IdFiscaleIVA>
          <IdPaese>${NAZIONE}</IdPaese>
          <IdCodice>${PIVA_STUDIO}</IdCodice>
        </IdFiscaleIVA>
        <CodiceFiscale>${CF_STUDIO}</CodiceFiscale>
        <Anagrafica>
          <Denominazione>${NOME_STUDIO}</Denominazione>
        </Anagrafica>
        <RegimeFiscale>RF19</RegimeFiscale>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>${INDIRIZZO}</Indirizzo>
        <NumeroCivico>${CIVICO}</NumeroCivico>
        <CAP>${CAP}</CAP>
        <Comune>${COMUNE}</Comune>
        <Provincia>${PROVINCIA}</Provincia>
        <Nazione>${NAZIONE}</Nazione>
      </Sede>
    </CedentePrestatore>

    <CessionarioCommittente>
      <DatiAnagrafici>
        <CodiceFiscale>${cfPaziente}</CodiceFiscale>
        <Anagrafica>
          <Denominazione>${nomePaziente}</Denominazione>
        </Anagrafica>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>Via</Indirizzo>
        <CAP>00000</CAP>
        <Comune>-</Comune>
        <Nazione>${NAZIONE}</Nazione>
      </Sede>
    </CessionarioCommittente>

  </FatturaElettronicaHeader>

  <FatturaElettronicaBody>

    <DatiGenerali>
      <DatiGeneraliDocumento>
        <TipoDocumento>TD06</TipoDocumento>
        <Divisa>EUR</Divisa>
        <Data>${dataFattura}</Data>
        <Numero>${numDocumento}</Numero>
        <Causale>Prestazione medica specialistica</Causale>
      </DatiGeneraliDocumento>
    </DatiGenerali>

    <DatiBeniServizi>
      <DettaglioLinee>
        <NumeroLinea>1</NumeroLinea>
        <Descrizione>${descrizionePrestazione}</Descrizione>
        <Quantita>1.00</Quantita>
        <PrezzoUnitario>${imponibile}</PrezzoUnitario>
        <PrezzoTotale>${imponibile}</PrezzoTotale>
        <AliquotaIVA>0.00</AliquotaIVA>
        <Natura>N2.2</Natura>
      </DettaglioLinee>
      <DatiRiepilogo>
        <AliquotaIVA>0.00</AliquotaIVA>
        <Natura>N2.2</Natura>
        <ImponibileImporto>${imponibile}</ImponibileImporto>
        <Imposta>0.00</Imposta>
        <RiferimentoNormativo>Prestazioni mediche esenti ex art.10 DPR 633/72</RiferimentoNormativo>
      </DatiRiepilogo>
    </DatiBeniServizi>

    <DatiPagamento>
      <CondizioniPagamento>TP02</CondizioniPagamento>
      <DettaglioPagamento>
        <ModalitaPagamento>${
          // MP08 = Bonifico, MP08 standard per studio medico
          'MP08'
        }</ModalitaPagamento>
        <ImportoPagamento>${imponibile}</ImportoPagamento>
      </DettaglioPagamento>
    </DatiPagamento>

  </FatturaElettronicaBody>

</p:FatturaElettronica>`;
}

// ─── 3. Upload fattura su Aruba → invio SDI ───────────────────────────────────
// Ritorna { numeroFattura, filename, idSdi }
async function uploadFattura(token, xmlString) {
  const base64 = Buffer.from(xmlString, 'utf8').toString('base64');

  const res = await httpRequest('POST', WS_URL, '/services/invoice/upload', {
    'Authorization': `Bearer ${token}`,
    'Content-Type':  'application/json',
  }, {
    dataFile:        base64,
    credential:      '',
    domain:          '',
    senderPIVA:      PIVA_STUDIO,
    skipExtraSchema: false,
  });

  if (res.status !== 200) {
    throw new Error(`[ArubaFE] Upload fallito (HTTP ${res.status}): ${JSON.stringify(res.body)}`);
  }

  const body = res.body;
  if (body.errorCode && body.errorCode !== '0000') {
    throw new Error(`[ArubaFE] Errore Aruba: ${body.errorCode} — ${body.errorDescription}`);
  }

  console.log('[ArubaFE] Fattura inviata:', body.uploadFileName);
  return {
    filename:       body.uploadFileName || '',
    descrizione:    body.errorDescription || '',
  };
}

// ─── Funzione principale: crea e invia la fattura ─────────────────────────────
// dati: { numProgressivo, dataFattura (YYYY-MM-DD), nomePaziente, cfPaziente,
//         importoEuro (es. "80.00"), descrizionePrestazione }
// Ritorna: { numeroFattura, filename } — numeroFattura è "numProgressivo/anno"
async function creaEInviaFattura(dati) {
  const token = await getToken();

  const xmlString = buildFatturaXML(dati);
  const risultato = await uploadFattura(token, xmlString);

  const anno           = new Date(dati.dataFattura).getFullYear();
  const numeroFattura  = `${dati.numProgressivo}/${anno}`;

  console.log(`[ArubaFE] Fattura ${numeroFattura} inviata al SDI (file: ${risultato.filename})`);

  return {
    numeroFattura,
    filename:    risultato.filename,
    descrizione: risultato.descrizione,
  };
}

// ─── Modalità demo: testa solo l'autenticazione ───────────────────────────────
async function testConnessione() {
  try {
    const token = await getToken();
    return { ok: true, token: token.slice(0, 8) + '...' };
  } catch (e) {
    return { ok: false, errore: e.message };
  }
}

module.exports = {
  arubaFE: {
    configurato:       () => !!(USERNAME && PASSWORD),
    creaEInviaFattura,
    testConnessione,
    buildFatturaXML,   // esportata per debug/test unitari
  }
};
