// ═══════════════════════════════════════════════════════════════════════════
//  PIPELINE DI ELABORAZIONE IMMAGINI ECOGRAFICHE
// ═══════════════════════════════════════════════════════════════════════════
//
//  Prende un'immagine come esce dall'ecografo e la prepara per la stampa,
//  applicando in sequenza: ritaglio → gamma → recupero ombre → ingrandimento
//  → profilo colore (se configurato).
//
//  REGOLA INVIOLABILE: qui dentro non si scrive MAI su un file di origine.
//  Ogni funzione riceve un Buffer in memoria e restituisce un Buffer nuovo.
//  Gli originali .dcm sul disco dati e le immagini su Orthanc non vengono
//  toccati in nessun caso.
//
//  Tutti i parametri arrivano da stampa-config.js — qui non ci sono numeri
//  fissi da cercare nel codice.
//
const sharp = require('sharp');

// Non usare la cache di libvips: le immagini cambiano a ogni esame e la
// cache terrebbe occupata memoria inutilmente sul PC dello studio.
sharp.cache(false);

// Valore massimo della gobba B(u) = u*(1-u)^2, raggiunto in u = 1/3.
// Serve a normalizzare lo schiarimento delle ombre, così che il parametro
// 'intensita' abbia lo stesso significato qualunque sia la soglia.
const B_MAX = (1 / 3) * (2 / 3) * (2 / 3); // = 4/27

// Oltre questa intensità la curva di tono smetterebbe di essere crescente.
// Il calcolo è nel commento dentro costruisciCurvaToni().
const INTENSITA_OMBRE_MAX = 0.44;


// ═══════════════════════════════════════════════════════════════════════════
//  CURVA DI TONO (gamma + recupero ombre)
// ═══════════════════════════════════════════════════════════════════════════
//
//  Gamma e ombre vengono combinate in UNA sola tabella di 256 valori, non
//  applicate una dopo l'altra. Il motivo è di qualità: ogni passaggio separato
//  arrotonderebbe i valori a numeri interi, e due arrotondamenti in fila
//  introducono scalini visibili nelle sfumature — proprio nei grigi bassi,
//  cioè dove ci interessa vedere.
//
//  Restituisce un array di 256 byte: alla luminosità X in ingresso
//  corrisponde lut[X] in uscita.
//
function costruisciCurvaToni({ gamma, ombre }) {
  const gammaAttiva = !!(gamma && gamma.attivo);
  const gammaVal = gammaAttiva ? Number(gamma.valore) : 1;
  if (!(gammaVal > 0)) throw new Error('gamma.valore deve essere maggiore di zero');

  const ombreAttive = !!(ombre && ombre.attivo && Number(ombre.intensita) > 0);
  const intensita = ombreAttive ? Number(ombre.intensita) : 0;
  const soglia = ombreAttive ? Number(ombre.soglia) : 0;
  if (ombreAttive && !(soglia > 0 && soglia <= 1)) {
    throw new Error('ombre.soglia deve stare tra 0 (escluso) e 1');
  }
  // Oltre questo limite la curva si ribalterebbe (vedi nota qui sotto).
  if (intensita > INTENSITA_OMBRE_MAX) {
    throw new Error(
      `ombre.intensita = ${intensita} è troppo alta: il massimo sicuro è ` +
      `${INTENSITA_OMBRE_MAX}. Oltre, la curva invertirebbe i grigi vicini ` +
      `creando sull'immagine bordi inesistenti.`
    );
  }

  const lut = Buffer.allocUnsafe(256);
  for (let i = 0; i < 256; i++) {
    const x = i / 255;

    // --- gamma: schiarisce i toni medi, lascia fermi nero e bianco puri ---
    let v = Math.pow(x, 1 / gammaVal);

    // --- recupero ombre ---
    //
    // Lo schiarimento è una "gobba" che vale zero sul nero puro, cresce fino
    // a un massimo dentro le ombre e torna a zero alla soglia. Due vantaggi:
    // il nero resta nero pieno (la stampa non ingrigisce) e sopra la soglia
    // non si tocca niente.
    //
    // La forma è  B(u) = u * (1-u)^2  con u = v/soglia.
    // La sua pendenza non scende mai sotto -1/3, quindi la curva finale ha
    // pendenza almeno 1 - intensita/(3*B_MAX): resta crescente finché
    // intensita <= 0.44. È il motivo del controllo qui sopra, e il test
    // "la curva non deve MAI invertirsi" verifica che sia davvero così.
    if (ombreAttive && v < soglia) {
      const u = v / soglia;
      const gobba = u * (1 - u) * (1 - u);
      v += intensita * soglia * (gobba / B_MAX);
    }

    lut[i] = Math.max(0, Math.min(255, Math.round(v * 255)));
  }
  return lut;
}


// ═══════════════════════════════════════════════════════════════════════════
//  RITAGLIO
// ═══════════════════════════════════════════════════════════════════════════
//
//  Ricava dal config il rettangolo da ritagliare e lo limita ai bordi
//  dell'immagine reale. Se l'ecografo un giorno producesse immagini di
//  dimensioni diverse, il ritaglio si adatta invece di far fallire la stampa.
//
//  Restituisce null quando non c'è niente da ritagliare.
//
function calcolaRitaglio(cfgRitaglio, larghezza, altezza) {
  if (!cfgRitaglio || !cfgRitaglio.attivo) return null;

  const nome = cfgRitaglio.preset;
  const presets = cfgRitaglio.preset_disponibili || {};
  if (!(nome in presets)) {
    throw new Error(
      `ritaglio.preset = "${nome}" non esiste. ` +
      `Valori ammessi: ${Object.keys(presets).join(', ')}`
    );
  }

  const p = presets[nome];
  if (!p) return null; // preset 'nessuno'

  const left = Math.max(0, Math.min(Math.round(p.left), larghezza - 1));
  const top = Math.max(0, Math.min(Math.round(p.top), altezza - 1));
  const width = Math.max(1, Math.min(Math.round(p.width), larghezza - left));
  const height = Math.max(1, Math.min(Math.round(p.height), altezza - top));

  // Ritaglio che coincide con l'immagine intera: inutile, evitiamo il passaggio
  if (left === 0 && top === 0 && width === larghezza && height === altezza) return null;

  return { left, top, width, height };
}


// ═══════════════════════════════════════════════════════════════════════════
//  ELABORAZIONE DI UNA SINGOLA IMMAGINE
// ═══════════════════════════════════════════════════════════════════════════
//
//  ingresso: Buffer con l'immagine originale (il JPEG estratto dal DICOM)
//  uscita:   Buffer PNG pronto per l'impaginazione
//
//  Il PNG è senza perdita: dopo aver lavorato sui toni sarebbe un controsenso
//  ricomprimere in JPEG e reintrodurre artefatti proprio nei grigi bassi.
//
async function elaboraImmagine(bufferOriginale, cfg) {
  if (!Buffer.isBuffer(bufferOriginale) || bufferOriginale.length === 0) {
    throw new Error('elaboraImmagine: serve un Buffer non vuoto');
  }

  let img = sharp(bufferOriginale, { failOn: 'none' });
  const meta = await img.metadata();

  // ── 1. ritaglio del settore utile ──────────────────────────────────────
  const rit = calcolaRitaglio(cfg.ritaglio, meta.width, meta.height);
  if (rit) img = img.extract(rit);

  // ── 2. + 3. gamma e recupero ombre, in un solo passaggio ───────────────
  //
  // Si lavora sui pixel grezzi perché sharp non offre le curve di tono.
  // Il canale alfa, se presente, non va toccato: è trasparenza, non luce.
  const curva = costruisciCurvaToni(cfg);
  const identita = curva.every((v, i) => v === i);

  if (!identita) {
    const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
    const canaliColore = info.channels === 4 ? 3 : info.channels;
    for (let i = 0; i < data.length; i += info.channels) {
      for (let c = 0; c < canaliColore; c++) data[i + c] = curva[data[i + c]];
    }
    img = sharp(data, {
      raw: { width: info.width, height: info.height, channels: info.channels },
    });
  }

  // ── 4. ingrandimento di qualità ────────────────────────────────────────
  //
  // Non aggiunge dettaglio (non esiste modo di aggiungerlo): evita solo che
  // sia il driver della stampante a ingrandire con un metodo grossolano.
  const ing = cfg.ingrandimento;
  if (ing && ing.attivo && Number(ing.fattore) > 1) {
    const base = rit || { width: meta.width, height: meta.height };
    img = img.resize({
      width: Math.round(base.width * Number(ing.fattore)),
      height: Math.round(base.height * Number(ing.fattore)),
      kernel: 'lanczos3',
      fit: 'fill', // le dimensioni sono già in proporzione: nessuna deformazione
    });
  }

  // ── 5. profilo colore ICC, solo se configurato ─────────────────────────
  const icc = cfg.profilo_icc;
  if (icc && icc.profilo) {
    // Nota: sharp non espone la scelta dell'intento di resa (vedi commento
    // in stampa-config.js). Usa il proprio predefinito.
    img = img.withIccProfile(icc.profilo, { attach: true });
  }

  return img.png({ compressionLevel: 6 }).toBuffer();
}


// ═══════════════════════════════════════════════════════════════════════════
//  SCELTA DELLA GRIGLIA
// ═══════════════════════════════════════════════════════════════════════════
//
//  Dato il numero di immagini per pagina e la loro forma, trova la
//  disposizione righe x colonne che le fa venire PIÙ GRANDI possibile
//  nello spazio disponibile, senza mai deformarle.
//
//  Non è una tabella fissa perché la forma cambia col ritaglio: il settore
//  ritagliato è quasi quadrato, l'immagine intera è invece panoramica, e la
//  disposizione migliore non è la stessa nei due casi.
//
function scegliGriglia(perPagina, proporzioneImmagine, areaLarghezza, areaAltezza, spaziatura) {
  if (!(perPagina >= 1)) throw new Error('perPagina deve essere almeno 1');
  if (!(proporzioneImmagine > 0)) throw new Error('proporzioneImmagine deve essere positiva');

  let migliore = null;
  for (let colonne = 1; colonne <= perPagina; colonne++) {
    const righe = Math.ceil(perPagina / colonne);

    const cellaL = (areaLarghezza - spaziatura * (colonne - 1)) / colonne;
    const cellaA = (areaAltezza - spaziatura * (righe - 1)) / righe;
    if (cellaL <= 0 || cellaA <= 0) continue;

    // L'immagine si inscrive nella cella mantenendo le proporzioni:
    // vince il lato che si esaurisce per primo.
    const larghezzaResa = Math.min(cellaL, cellaA * proporzioneImmagine);
    const area = larghezzaResa * (larghezzaResa / proporzioneImmagine);

    if (!migliore || area > migliore.area + 1e-9) {
      migliore = { colonne, righe, cellaL, cellaA, area };
    }
  }
  if (!migliore) throw new Error('Nessuna disposizione possibile nello spazio dato');
  return migliore;
}


module.exports = {
  costruisciCurvaToni,
  calcolaRitaglio,
  elaboraImmagine,
  scegliGriglia,
};
