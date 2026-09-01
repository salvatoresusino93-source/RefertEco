// ═══════════════════════════════════════════════════════════════════════════
//  STAMPA DELLE IMMAGINI ECOGRAFICHE — foglio a griglia, indipendente dal referto
// ═══════════════════════════════════════════════════════════════════════════
//
//  Questo modulo si occupa SOLO delle immagini. Non sa niente del testo del
//  referto e non lo tocca: i due flussi di stampa sono separati apposta, così
//  le immagini si possono stampare appena finito l'esame, con il referto
//  ancora vuoto, e il referto si stampa (o si ristampa) quando si vuole.
//
//  Percorso completo:
//    file .dcm sul disco  →  estrazione del JPEG interno  →  pipeline
//    (ritaglio, gamma, ombre, ingrandimento)  →  griglia HTML  →  PDF con
//    Chrome  →  stampante.
//
//  Gli originali non vengono mai riscritti: si leggono e basta.
//
const fs = require('fs');
const os = require('os');
const path = require('path');

const pipeline = require('./immagini-pipeline');

// dicom-parser è già presente nel programma per il visualizzatore del browser.
// Va bene anche qui lato server: evita di installare un'altra dipendenza.
const dicomParser = require('./public/lib/dicom-parser.min.js');


// ═══════════════════════════════════════════════════════════════════════════
//  ESTRAZIONE DELL'IMMAGINE DAL FILE DICOM
// ═══════════════════════════════════════════════════════════════════════════
//
//  Il Samsung Medison V5 salva dentro il .dcm un JPEG già bello e pronto.
//  Non serve decodificare i pixel: si prende il JPEG così com'è e lo si passa
//  a sharp, che i JPEG li legge nativamente. Zero perdita di qualità, perché
//  non c'è nessuna ricompressione in mezzo.
//
//  Restituisce:
//    { cine: true }              → è un video, va saltato
//    { immagine: Buffer }        → immagine pronta da elaborare
//    { nonSupportato: '...' }    → formato che non sappiamo leggere
//
function estraiImmagineDaDicom(bufferDicom) {
  const ds = dicomParser.parseDicom(new Uint8Array(bufferDicom));

  // I filmati (cine) hanno più fotogrammi: stamparli significherebbe
  // riempire decine di fogli con immagini quasi identiche.
  const nFotogrammi = parseInt(ds.intString('x00280008') || ds.string('x00280008') || '1', 10);
  if (nFotogrammi > 1) return { cine: true };

  const el = ds.elements.x7fe00010;
  if (!el) return { nonSupportato: 'nessun dato immagine nel file' };

  // Caso normale del nostro ecografo: pixel incapsulati (JPEG).
  if (el.fragments && el.fragments.length) {
    const parti = el.fragments.map(f => bufferDicom.slice(f.position, f.position + f.length));
    return { immagine: parti.length === 1 ? parti[0] : Buffer.concat(parti) };
  }

  // Ripiego: pixel non compressi. Meno comune, ma meglio gestirlo che
  // far sparire l'immagine dalla stampa senza dire niente.
  const righe = ds.uint16('x00280010') || 0;
  const colonne = ds.uint16('x00280011') || 0;
  const bit = ds.uint16('x00280100') || 8;
  const canali = ds.uint16('x00280002') || 1;
  if (righe && colonne && bit === 8) {
    const grezzi = bufferDicom.slice(el.dataOffset, el.dataOffset + el.length);
    return {
      immagineGrezza: {
        dati: grezzi,
        larghezza: colonne,
        altezza: righe,
        canali: canali === 3 ? 3 : 1,
      },
    };
  }

  return { nonSupportato: `formato non gestito (${bit} bit, ${canali} canali)` };
}


// ═══════════════════════════════════════════════════════════════════════════
//  INTESTAZIONE RICAVATA DAL DICOM
// ═══════════════════════════════════════════════════════════════════════════
//
//  Nome paziente, tipo di esame e data li scrive già l'ecografo dentro il
//  file. Prenderli da lì invece che dal modulo del referto è quello che
//  permette di stampare le immagini a referto ancora vuoto: appena finito
//  l'esame l'intestazione è comunque completa e corretta.
//
function intestazioneDaDicom(bufferDicom) {
  try {
    const ds = dicomParser.parseDicom(new Uint8Array(bufferDicom));

    // Formato DICOM del nome: COGNOME^NOME^...
    const grezzo = (ds.string('x00100010') || '').trim();
    const nome = grezzo.split('^').map(s => s.trim()).filter(Boolean).slice(0, 2).join(' ');

    // Il tipo di esame può stare in campi diversi a seconda di come è stato
    // avviato l'esame sull'ecografo. Con la worklist arriva in uno dei primi
    // due; inserendo il paziente a mano sulla macchina spesso non c'è affatto
    // (in quel caso l'intestazione riporta solo nome e data, e il tipo lo
    // fornisce il modulo del referto quando è già compilato).
    const tipo = ['x00081030', 'x00321060', 'x0008103e', 'x00400254']
      .map(t => { try { return (ds.string(t) || '').trim(); } catch { return ''; } })
      .find(v => v && !/^free\s*form$/i.test(v)) || '';

    const d = (ds.string('x00080020') || '').replace(/\D/g, '');
    const data = d.length === 8 ? `${d.slice(6)}/${d.slice(4, 6)}/${d.slice(0, 4)}` : '';

    return [nome, tipo, data].filter(Boolean).join('  —  ');
  } catch {
    return '';
  }
}


// ═══════════════════════════════════════════════════════════════════════════
//  PREPARAZIONE DI TUTTE LE IMMAGINI DI UN ESAME
// ═══════════════════════════════════════════════════════════════════════════
//
//  Legge i file, li elabora e li salva come PNG in una cartella temporanea.
//  I PNG temporanei vengono cancellati subito dopo la stampa: non restano
//  copie delle immagini dei pazienti in giro per il disco.
//
async function preparaImmagini(dirImmagini, elenchoFile, cfg, dirTemporanea) {
  const preparate = [];
  let cineSaltati = 0;
  const problemi = [];

  for (const nomeFile of elenchoFile) {
    const percorso = path.join(dirImmagini, nomeFile);
    try {
      let daElaborare = null;

      if (/\.dcm$/i.test(nomeFile)) {
        const esito = estraiImmagineDaDicom(fs.readFileSync(percorso));
        if (esito.cine) { cineSaltati++; continue; }
        if (esito.nonSupportato) { problemi.push(`${nomeFile}: ${esito.nonSupportato}`); continue; }

        if (esito.immagineGrezza) {
          // I pixel non compressi vanno prima impacchettati in un PNG,
          // poi seguono la stessa strada di tutti gli altri.
          const sharp = require('sharp');
          const g = esito.immagineGrezza;
          daElaborare = await sharp(g.dati, {
            raw: { width: g.larghezza, height: g.altezza, channels: g.canali },
          }).png().toBuffer();
        } else {
          daElaborare = esito.immagine;
        }
      } else if (/\.(jpe?g|png)$/i.test(nomeFile)) {
        daElaborare = fs.readFileSync(percorso);
      } else {
        continue; // file che non è un'immagine: ignorato in silenzio
      }

      const png = await pipeline.elaboraImmagine(daElaborare, cfg);
      const nomePng = 'st_' + String(preparate.length + 1).padStart(3, '0') + '.png';
      const percorsoPng = path.join(dirTemporanea, nomePng);
      fs.writeFileSync(percorsoPng, png);

      const sharp = require('sharp');
      const meta = await sharp(png).metadata();
      preparate.push({
        origine: nomeFile,
        percorso: percorsoPng,
        larghezza: meta.width,
        altezza: meta.height,
      });
    } catch (e) {
      problemi.push(`${nomeFile}: ${e.message}`);
    }
  }

  return { preparate, cineSaltati, problemi };
}


// ═══════════════════════════════════════════════════════════════════════════
//  COSTRUZIONE DEL FOGLIO
// ═══════════════════════════════════════════════════════════════════════════

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Lato corto e lato lungo di un foglio A4
const A4_CORTO_MM = 210;
const A4_LUNGO_MM = 297;
const ALTEZZA_INTESTAZIONE_MM = 8;

// Sceglie l'orientamento del foglio che fa venire le immagini più grandi.
//
// Le ecografie sono panoramiche: su un foglio verticale avanza altezza, su uno
// orizzontale avanza larghezza quando le immagini sono tante. Invece di
// decidere a priori si calcolano tutti e due i casi e si tiene il migliore.
function scegliOrientamento(preferenza, perPagina, proporzione, margine, spaziatura, conIntestazione) {
  const candidati = [];
  const aggiungi = (nome, largheza, altezza) => {
    const areaL = largheza - margine * 2;
    const areaA = altezza - margine * 2 - (conIntestazione ? ALTEZZA_INTESTAZIONE_MM : 0);
    const griglia = pipeline.scegliGriglia(perPagina, proporzione, areaL, areaA, spaziatura);
    candidati.push({ nome, paginaL: largheza, paginaA: altezza, areaL, areaA, griglia });
  };

  if (preferenza !== 'orizzontale') aggiungi('verticale', A4_CORTO_MM, A4_LUNGO_MM);
  if (preferenza !== 'verticale') aggiungi('orizzontale', A4_LUNGO_MM, A4_CORTO_MM);

  candidati.sort((a, b) => b.griglia.area - a.griglia.area);
  return candidati[0];
}

function costruisciHtml(immagini, opzioni) {
  const cfg = opzioni.cfg;
  const imp = cfg.impaginazione;

  const perPagina = Number(opzioni.perPagina || imp.per_pagina) || 4;
  const margine = Number(imp.margine_mm);
  const spaziatura = Number(imp.spaziatura_mm);
  const conIntestazione = imp.intestazione !== false && !!opzioni.intestazione;

  // Tutte le immagini di un esame hanno la stessa forma: basta la prima
  // per scegliere disposizione e orientamento che le fanno venire più grandi.
  const proporzione = immagini.length
    ? immagini[0].larghezza / immagini[0].altezza
    : 1;

  const scelta = scegliOrientamento(
    imp.orientamento || 'automatico',
    perPagina, proporzione, margine, spaziatura, conIntestazione
  );
  const areaLarghezza = scelta.areaL;
  const areaAltezza = scelta.areaA;
  const griglia = scelta.griglia;

  // Le celle vengono dimensionate ESATTAMENTE quanto l'immagine che
  // conterranno, non a righe di uguale altezza. Con celle più alte
  // dell'immagine resterebbero fasce vuote in mezzo alla pagina e i numerini
  // finirebbero staccati sotto le ecografie. La griglia così com'è viene poi
  // centrata nel foglio.
  const cellaLarghezzaMm = Math.min(griglia.cellaL, griglia.cellaA * proporzione);
  const cellaAltezzaMm = cellaLarghezzaMm / proporzione;
  if (!Number.isFinite(cellaLarghezzaMm) || !Number.isFinite(cellaAltezzaMm)) {
    throw new Error('Calcolo della griglia non valido: impossibile impaginare le immagini');
  }

  let pagine = '';
  for (let p = 0; p * perPagina < immagini.length; p++) {
    const gruppo = immagini.slice(p * perPagina, (p + 1) * perPagina);

    // L'ultima pagina spesso è incompleta: le si danno solo le righe che
    // servono davvero, così le immagini restano centrate nel foglio invece
    // di ammucchiarsi in alto lasciando un vuoto in fondo. La dimensione
    // delle celle non cambia: le immagini escono uguali su tutte le pagine.
    const righeUsate = Math.ceil(gruppo.length / griglia.colonne);

    const celle = [];
    for (let i = 0; i < griglia.colonne * righeUsate; i++) {
      const img = gruppo[i];
      if (!img) { celle.push('<div class="cella"></div>'); continue; }
      const numero = imp.numera_immagini
        ? `<span class="num">${p * perPagina + i + 1}</span>` : '';
      const url = 'file:///' + img.percorso.split('\\').join('/');
      celle.push(`<div class="cella"><img src="${esc(url)}">${numero}</div>`);
    }
    const testata = conIntestazione
      ? `<div class="testata">${esc(opzioni.intestazione)}</div>` : '';
    const stileRighe = `grid-template-rows:repeat(${righeUsate},${cellaAltezzaMm.toFixed(2)}mm)`;
    pagine += `<div class="foglio">${testata}` +
      `<div class="griglia" style="${stileRighe}">${celle.join('')}</div></div>`;
  }

  return `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8">
<title>Immagini ecografiche</title>
<style>
  @page { size: A4 ${scelta.nome === 'orizzontale' ? 'landscape' : 'portrait'}; margin: ${margine}mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: #fff; }

  .foglio {
    width: ${areaLarghezza}mm;
    height: ${scelta.paginaA - margine * 2}mm;
    display: flex; flex-direction: column;
    page-break-after: always; break-after: page;
  }
  .foglio:last-child { page-break-after: auto; break-after: auto; }

  .testata {
    height: ${ALTEZZA_INTESTAZIONE_MM}mm;
    font: 8pt/1.2 'Segoe UI', Arial, sans-serif;
    color: #444; letter-spacing: .02em;
    display: flex; align-items: center;
    border-bottom: .3pt solid #bbb;
    flex-shrink: 0;
  }

  .griglia {
    flex: 1; min-height: 0;
    display: grid;
    grid-template-columns: repeat(${griglia.colonne}, ${cellaLarghezzaMm.toFixed(2)}mm);
    grid-template-rows: repeat(${griglia.righe}, ${cellaAltezzaMm.toFixed(2)}mm);
    gap: ${spaziatura}mm;
    justify-content: center;
    align-content: center;
    padding-top: ${conIntestazione ? spaziatura : 0}mm;
  }

  .cella {
    position: relative; min-height: 0; min-width: 0;
    display: flex; align-items: center; justify-content: center;
    overflow: hidden;
  }

  /* object-fit: contain garantisce che le proporzioni restino intatte:
     l'immagine non viene mai stirata né schiacciata, si adatta al lato
     che si esaurisce per primo. */
  .cella img {
    max-width: 100%; max-height: 100%;
    object-fit: contain; display: block;
    image-rendering: high-quality;
    print-color-adjust: exact; -webkit-print-color-adjust: exact;
  }

  /* Il numero sta SOPRA l'ecografia, che è quasi nera: dev'essere chiaro,
     non scuro, altrimenti sparisce. L'ombreggiatura lo tiene leggibile
     anche quando finisce su una zona bianca dell'immagine. */
  .num {
    position: absolute; right: 1.2mm; bottom: 0.8mm;
    font: 6.5pt/1 'Consolas', monospace;
    color: rgba(255,255,255,.65);
    text-shadow: 0 0 1.5px rgba(0,0,0,.9);
  }
</style></head><body>${pagine}</body></html>`;
}


module.exports = {
  estraiImmagineDaDicom,
  intestazioneDaDicom,
  preparaImmagini,
  costruisciHtml,
};
