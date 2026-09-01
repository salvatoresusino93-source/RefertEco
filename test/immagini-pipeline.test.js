// ═══════════════════════════════════════════════════════════════════════════
//  TEST DELLA PIPELINE DI ELABORAZIONE IMMAGINI
// ═══════════════════════════════════════════════════════════════════════════
//
//  Si lanciano con:   node --test test/
//  (usa il test runner incluso in Node 20: nessuna libreria da installare)
//
//  I test NON usano immagini di pazienti: le immagini di prova vengono
//  generate qui dentro. Si possono quindi eseguire su qualsiasi PC.
//
const { test } = require('node:test');
const assert = require('node:assert');
const sharp = require('sharp');

const {
  costruisciCurvaToni,
  calcolaRitaglio,
  elaboraImmagine,
  scegliGriglia,
} = require('../immagini-pipeline');


// ─────────────────────────────────────────────────────────────────────────
//  CURVA DI TONO
// ─────────────────────────────────────────────────────────────────────────

test('curva: senza gamma e senza ombre non cambia nulla', () => {
  const lut = costruisciCurvaToni({
    gamma: { attivo: false, valore: 1.12 },
    ombre: { attivo: false, intensita: 0.18, soglia: 0.25 },
  });
  for (let i = 0; i < 256; i++) assert.strictEqual(lut[i], i, 'valore ' + i);
});

test('curva: nero e bianco puri restano dove sono', () => {
  const lut = costruisciCurvaToni({
    gamma: { attivo: true, valore: 1.4 },
    ombre: { attivo: true, intensita: 0.3, soglia: 0.35 },
  });
  assert.strictEqual(lut[0], 0, 'il nero deve restare nero');
  assert.strictEqual(lut[255], 255, 'il bianco deve restare bianco');
});

// Questo è il test più importante di tutti. Una curva che scende anche solo
// per un valore invertirebbe due grigi vicini, creando sull'immagine un bordo
// o una banda che nell'originale NON esiste. Su un referto sarebbe un
// artefatto potenzialmente scambiabile per un reperto.
test('curva: non deve MAI invertirsi, con nessuna combinazione di parametri', () => {
  const gammi = [1, 1.05, 1.12, 1.25, 1.4, 1.8, 0.8];
  const intensita = [0, 0.05, 0.18, 0.3, 0.4, 0.44];
  const soglie = [0.05, 0.1, 0.25, 0.4, 0.6, 0.8, 1];

  for (const g of gammi) {
    for (const s of intensita) {
      for (const t of soglie) {
        const lut = costruisciCurvaToni({
          gamma: { attivo: true, valore: g },
          ombre: { attivo: true, intensita: s, soglia: t },
        });
        for (let i = 1; i < 256; i++) {
          assert.ok(
            lut[i] >= lut[i - 1],
            `curva discendente con gamma=${g} intensita=${s} soglia=${t}: ` +
            `lut[${i}]=${lut[i]} < lut[${i - 1}]=${lut[i - 1]}`
          );
        }
      }
    }
  }
});

test('curva: la gamma sopra 1 schiarisce i toni medi', () => {
  const lut = costruisciCurvaToni({
    gamma: { attivo: true, valore: 1.25 },
    ombre: { attivo: false },
  });
  for (let i = 1; i < 255; i++) {
    assert.ok(lut[i] >= i, `il tono ${i} dovrebbe schiarire, invece è ${lut[i]}`);
  }
  assert.ok(lut[128] > 128 + 5, 'sui toni medi lo schiarimento deve essere percettibile');
});

test('curva: il recupero ombre non tocca i toni sopra la soglia', () => {
  const base = { gamma: { attivo: false }, ombre: { attivo: false } };
  const conOmbre = {
    gamma: { attivo: false },
    ombre: { attivo: true, intensita: 0.18, soglia: 0.25 },
  };
  const lutBase = costruisciCurvaToni(base);
  const lutOmbre = costruisciCurvaToni(conOmbre);

  const sogliaByte = Math.ceil(0.25 * 255);
  for (let i = sogliaByte + 1; i < 256; i++) {
    assert.strictEqual(lutOmbre[i], lutBase[i], `il tono ${i} è sopra soglia: non va toccato`);
  }
  // ...e sotto soglia invece deve schiarire davvero
  assert.ok(lutOmbre[20] > lutBase[20], 'sotto soglia le ombre devono schiarire');
});

test('curva: parametri assurdi vengono rifiutati con un messaggio chiaro', () => {
  assert.throws(
    () => costruisciCurvaToni({ gamma: { attivo: true, valore: 0 }, ombre: { attivo: false } }),
    /gamma\.valore/,
  );
  assert.throws(
    () => costruisciCurvaToni({
      gamma: { attivo: false },
      ombre: { attivo: true, intensita: 0.2, soglia: 0 },
    }),
    /ombre\.soglia/,
  );
});

// Meglio un messaggio chiaro subito che una stampa con artefatti.
test('curva: un intensita ombre oltre il limite sicuro viene rifiutata', () => {
  assert.throws(
    () => costruisciCurvaToni({
      gamma: { attivo: false },
      ombre: { attivo: true, intensita: 0.8, soglia: 0.25 },
    }),
    /troppo alta/,
  );
});

// Il nero pieno è quello che dà "corpo" alla stampa: se si ingrigisce,
// tutta l'immagine sembra sbiadita.
test('curva: il recupero ombre non ingrigisce il nero pieno', () => {
  const lut = costruisciCurvaToni({
    gamma: { attivo: false },
    ombre: { attivo: true, intensita: 0.4, soglia: 0.4 },
  });
  assert.strictEqual(lut[0], 0);
});


// ─────────────────────────────────────────────────────────────────────────
//  RITAGLIO
// ─────────────────────────────────────────────────────────────────────────

const CFG_RITAGLIO = {
  attivo: true,
  preset: 'settore',
  preset_disponibili: {
    settore: { left: 307, top: 188, width: 666, height: 674 },
    nessuno: null,
  },
};

test('ritaglio: restituisce le coordinate del preset scelto', () => {
  const r = calcolaRitaglio(CFG_RITAGLIO, 1280, 960);
  assert.deepStrictEqual(r, { left: 307, top: 188, width: 666, height: 674 });
});

test('ritaglio: spento o preset "nessuno" non ritaglia', () => {
  assert.strictEqual(calcolaRitaglio({ ...CFG_RITAGLIO, attivo: false }, 1280, 960), null);
  assert.strictEqual(calcolaRitaglio({ ...CFG_RITAGLIO, preset: 'nessuno' }, 1280, 960), null);
});

// Se un giorno l'ecografo venisse impostato su una risoluzione diversa, la
// stampa non deve fallire: il rettangolo va semplicemente ridotto ai bordi.
test('ritaglio: su immagini più piccole del previsto si adatta ai bordi', () => {
  const r = calcolaRitaglio(CFG_RITAGLIO, 800, 600);
  assert.ok(r.left + r.width <= 800, 'non deve sforare a destra');
  assert.ok(r.top + r.height <= 600, 'non deve sforare in basso');
  assert.ok(r.width > 0 && r.height > 0, 'deve restare un rettangolo valido');
});

// I test qui sopra usano coordinate di prova. Questo invece controlla il file
// di configurazione VERO: un errore di battitura lì si scoprirebbe altrimenti
// solo davanti alla stampante.
test('ritaglio: tutti i preset del file di configurazione reale sono validi', () => {
  const cfgReale = require('../stampa-config');
  const presets = cfgReale.ritaglio.preset_disponibili;

  assert.ok(
    cfgReale.ritaglio.preset in presets,
    `il preset scelto ("${cfgReale.ritaglio.preset}") non esiste tra quelli definiti`
  );

  for (const [nome, p] of Object.entries(presets)) {
    if (p === null) continue; // 'nessuno'
    const r = calcolaRitaglio(
      { attivo: true, preset: nome, preset_disponibili: presets }, 1280, 960
    );
    assert.ok(r, `il preset "${nome}" non produce un ritaglio`);
    assert.ok(r.left >= 0 && r.top >= 0, `"${nome}": coordinate negative`);
    assert.ok(r.left + r.width <= 1280, `"${nome}": sfora a destra`);
    assert.ok(r.top + r.height <= 960, `"${nome}": sfora in basso`);
  }
});

// Le informazioni che l'ecografo scrive attorno all'immagine (misure, angoli,
// scala, etichette Dx/Sn) devono restare sul foglio col preset predefinito.
// Sono dati diagnostici: perderli è peggio che avere l'immagine più piccola.
test('ritaglio: il preset predefinito conserva le annotazioni dell ecografo', () => {
  const cfgReale = require('../stampa-config');
  const r = calcolaRitaglio(cfgReale.ritaglio, 1280, 960);
  if (r === null) return; // preset 'nessuno': conserva tutto per definizione

  // Fasce misurate sulle immagini reali del Samsung Medison V5
  const colonnaMisureX = 14;   // valori Alfa/Beta a sinistra
  const scalaProfonditaX = 1270; // tacche di profondità a destra
  const etichetteY = 898;      // riga della scritta "Dx"

  assert.ok(r.left <= colonnaMisureX, 'taglia via le misurazioni di sinistra');
  assert.ok(r.left + r.width > scalaProfonditaX, 'taglia via la scala di profondità');
  assert.ok(r.top + r.height > etichetteY, 'taglia via le etichette in basso (Dx/Sn)');
});

test('ritaglio: un preset inesistente lo dice, invece di stampare male in silenzio', () => {
  assert.throws(
    () => calcolaRitaglio({ ...CFG_RITAGLIO, preset: 'sbagliato' }, 1280, 960),
    /non esiste/,
  );
});


// ─────────────────────────────────────────────────────────────────────────
//  ELABORAZIONE COMPLETA
// ─────────────────────────────────────────────────────────────────────────

// Immagine di prova: sfumatura dal nero al bianco, stessa forma e dimensione
// dei fotogrammi del Samsung Medison V5.
async function immagineDiProva(larghezza = 1280, altezza = 960) {
  const px = Buffer.allocUnsafe(larghezza * altezza * 3);
  for (let y = 0; y < altezza; y++) {
    for (let x = 0; x < larghezza; x++) {
      const v = Math.round((x / (larghezza - 1)) * 255);
      const i = (y * larghezza + x) * 3;
      px[i] = px[i + 1] = px[i + 2] = v;
    }
  }
  return sharp(px, { raw: { width: larghezza, height: altezza, channels: 3 } })
    .jpeg({ quality: 95 }).toBuffer();
}

const CFG_COMPLETA = {
  ritaglio: CFG_RITAGLIO,
  gamma: { attivo: true, valore: 1.12 },
  ombre: { attivo: true, intensita: 0.18, soglia: 0.25 },
  ingrandimento: { attivo: true, fattore: 2 },
  profilo_icc: { profilo: null },
};

test('elaborazione: ritaglia e ingrandisce nelle misure attese', async () => {
  const originale = await immagineDiProva();
  const out = await elaboraImmagine(originale, CFG_COMPLETA);
  const meta = await sharp(out).metadata();

  assert.strictEqual(meta.format, 'png', 'in uscita deve essere PNG senza perdita');
  assert.strictEqual(meta.width, 666 * 2);
  assert.strictEqual(meta.height, 674 * 2);
});

test('elaborazione: le proporzioni non vengono mai alterate', async () => {
  const originale = await immagineDiProva();
  const out = await elaboraImmagine(originale, CFG_COMPLETA);
  const meta = await sharp(out).metadata();

  const attesa = 666 / 674;
  const ottenuta = meta.width / meta.height;
  assert.ok(
    Math.abs(attesa - ottenuta) < 0.001,
    `proporzioni alterate: attese ${attesa.toFixed(4)}, ottenute ${ottenuta.toFixed(4)}`
  );
});

// Il vincolo più importante di tutto il progetto.
test('elaborazione: il buffer di partenza non viene modificato', async () => {
  const originale = await immagineDiProva();
  const copia = Buffer.from(originale);
  await elaboraImmagine(originale, CFG_COMPLETA);
  assert.ok(originale.equals(copia), 'la pipeline ha modificato i dati di origine');
});

test('elaborazione: senza ingrandimento resta alla dimensione del ritaglio', async () => {
  const originale = await immagineDiProva();
  const out = await elaboraImmagine(originale, {
    ...CFG_COMPLETA,
    ingrandimento: { attivo: false, fattore: 2 },
  });
  const meta = await sharp(out).metadata();
  assert.strictEqual(meta.width, 666);
  assert.strictEqual(meta.height, 674);
});

test('elaborazione: senza profilo ICC il passo viene saltato senza errori', async () => {
  const originale = await immagineDiProva();
  const out = await elaboraImmagine(originale, { ...CFG_COMPLETA, profilo_icc: { profilo: null } });
  assert.ok(out.length > 0);
});

test('elaborazione: la stampa risulta più chiara dell originale', async () => {
  const originale = await immagineDiProva();
  const out = await elaboraImmagine(originale, {
    ...CFG_COMPLETA,
    ritaglio: { ...CFG_RITAGLIO, attivo: false },
    ingrandimento: { attivo: false },
  });

  const mediaPrima = (await sharp(originale).stats()).channels[0].mean;
  const mediaDopo = (await sharp(out).stats()).channels[0].mean;
  assert.ok(
    mediaDopo > mediaPrima,
    `l'immagine elaborata dovrebbe essere più chiara: prima ${mediaPrima.toFixed(1)}, dopo ${mediaDopo.toFixed(1)}`
  );
});

test('elaborazione: un buffer vuoto viene rifiutato subito', async () => {
  await assert.rejects(() => elaboraImmagine(Buffer.alloc(0), CFG_COMPLETA), /Buffer non vuoto/);
});


// ─────────────────────────────────────────────────────────────────────────
//  GRIGLIA DI IMPAGINAZIONE
// ─────────────────────────────────────────────────────────────────────────

// A4 verticale con margini da 10 mm, meno l'intestazione
const AREA_L = 190;
const AREA_A = 269;
const SPAZIO = 3;

test('griglia: con il settore ritagliato (quasi quadrato) sceglie le disposizioni attese', () => {
  const q = 666 / 674; // proporzione reale dopo il ritaglio

  assert.deepStrictEqual(pick(scegliGriglia(4, q, AREA_L, AREA_A, SPAZIO)), { colonne: 2, righe: 2 });
  assert.deepStrictEqual(pick(scegliGriglia(8, q, AREA_L, AREA_A, SPAZIO)), { colonne: 2, righe: 4 });
  assert.deepStrictEqual(pick(scegliGriglia(12, q, AREA_L, AREA_A, SPAZIO)), { colonne: 3, righe: 4 });
  assert.deepStrictEqual(pick(scegliGriglia(15, q, AREA_L, AREA_A, SPAZIO)), { colonne: 3, righe: 5 });

  function pick(g) { return { colonne: g.colonne, righe: g.righe }; }
});

test('griglia: più immagini per pagina significa immagini più piccole', () => {
  const q = 666 / 674;
  const aree = [4, 8, 12, 15].map(n => scegliGriglia(n, q, AREA_L, AREA_A, SPAZIO).area);
  for (let i = 1; i < aree.length; i++) {
    assert.ok(aree[i] < aree[i - 1], 'passando a più immagini per pagina l area deve calare');
  }
});

test('griglia: la disposizione scelta è davvero la migliore possibile', () => {
  const q = 666 / 674;
  const scelta = scegliGriglia(12, q, AREA_L, AREA_A, SPAZIO);
  for (let colonne = 1; colonne <= 12; colonne++) {
    const righe = Math.ceil(12 / colonne);
    const cellaL = (AREA_L - SPAZIO * (colonne - 1)) / colonne;
    const cellaA = (AREA_A - SPAZIO * (righe - 1)) / righe;
    if (cellaL <= 0 || cellaA <= 0) continue;
    const l = Math.min(cellaL, cellaA * q);
    assert.ok(
      l * (l / q) <= scelta.area + 1e-9,
      `${colonne} colonne darebbero immagini più grandi di quella scelta`
    );
  }
});

test('griglia: ci stanno sempre abbastanza celle per le immagini richieste', () => {
  for (const n of [1, 4, 8, 12, 15, 20]) {
    const g = scegliGriglia(n, 1.33, AREA_L, AREA_A, SPAZIO);
    assert.ok(g.colonne * g.righe >= n, `${n} immagini non ci stanno in ${g.colonne}x${g.righe}`);
  }
});

// Un errore di battitura in un nome di proprietà qui produrrebbe misure NaN,
// il foglio verrebbe impaginato a caso e nessuno se ne accorgerebbe finché
// non esce dalla stampante.
test('griglia: restituisce le misure della cella come numeri utilizzabili', () => {
  const g = scegliGriglia(4, 666 / 674, AREA_L, AREA_A, SPAZIO);
  for (const campo of ['colonne', 'righe', 'cellaL', 'cellaA', 'area']) {
    assert.ok(Number.isFinite(g[campo]), `il campo "${campo}" deve essere un numero valido`);
    assert.ok(g[campo] > 0, `il campo "${campo}" deve essere positivo`);
  }
  assert.ok(g.cellaL <= AREA_L, 'la cella non può essere più larga della pagina');
  assert.ok(g.cellaA <= AREA_A, 'la cella non può essere più alta della pagina');
});

// Il guadagno più grosso e più sicuro: girare il foglio. Le ecografie sono
// panoramiche, e su un A4 verticale si spreca larghezza.
test('griglia: per 4 immagini panoramiche il foglio orizzontale le fa più grandi', () => {
  const q = 1280 / 894; // proporzione reale col ritaglio 'completo'
  const verticale = scegliGriglia(4, q, 190, 269, 3);
  const orizzontale = scegliGriglia(4, q, 277, 182, 3);

  const largh = g => Math.min(g.cellaL, g.cellaA * q);
  assert.ok(
    largh(orizzontale) > largh(verticale) * 1.25,
    `atteso un guadagno netto: verticale ${largh(verticale).toFixed(0)}mm, ` +
    `orizzontale ${largh(orizzontale).toFixed(0)}mm`
  );
});

// ...ma non sempre: con tante immagini per pagina si ribalta. È il motivo per
// cui l'orientamento va scelto caso per caso invece che fissato una volta.
test('griglia: per 8 immagini invece conviene il foglio verticale', () => {
  const q = 1280 / 894;
  const largh = g => Math.min(g.cellaL, g.cellaA * q);
  const verticale = largh(scegliGriglia(8, q, 190, 269, 3));
  const orizzontale = largh(scegliGriglia(8, q, 277, 182, 3));
  assert.ok(
    verticale > orizzontale,
    `con 8 per pagina il verticale dovrebbe vincere: ${verticale.toFixed(0)} vs ${orizzontale.toFixed(0)}`
  );
});

test('griglia: le immagini panoramiche (non ritagliate) si dispongono diversamente', () => {
  // 1280x960 non ritagliata = 4:3. Con una forma più larga conviene
  // incolonnare meno immagini per riga rispetto al settore quadrato.
  const panoramica = scegliGriglia(4, 1280 / 960, AREA_L, AREA_A, SPAZIO);
  assert.ok(panoramica.colonne >= 1 && panoramica.righe >= 1);
  assert.ok(panoramica.colonne * panoramica.righe >= 4);
});
