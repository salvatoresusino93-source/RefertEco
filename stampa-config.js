// ═══════════════════════════════════════════════════════════════════════════
//  CONFIGURAZIONE STAMPA IMMAGINI ECOGRAFICHE
// ═══════════════════════════════════════════════════════════════════════════
//
//  Questo è l'UNICO file da toccare per tarare la qualità di stampa.
//  Dopo ogni modifica: riavvia RefertEco (chiudi e riapri) e ristampa.
//
//  Nessuna modifica qui tocca gli originali: né i file .dcm sul disco dati,
//  né le immagini archiviate su Orthanc. La lavorazione avviene solo in
//  memoria, al momento della stampa.
//
//  ─────────────────────────────────────────────────────────────────────────
//  COME TARARE (consiglio pratico)
//  Cambia UN parametro alla volta e stampa la stessa ecografia. Confronta i
//  fogli affiancati alla luce della finestra. Se cambi tutto insieme non
//  saprai mai quale parametro ha fatto la differenza.
//  ─────────────────────────────────────────────────────────────────────────

module.exports = {

  // ═════════════════════════════════════════════════════════════════════════
  //  1. RITAGLIO — toglie header, barre laterali e cornice nera
  // ═════════════════════════════════════════════════════════════════════════
  //
  //  È l'intervento che pesa di più sulla qualità percepita. Le immagini del
  //  Samsung Medison V5 sono 1280x960, ma l'ecografia vera occupa solo il 36%
  //  del fotogramma: il resto è nero e scritte. Ritagliando, l'anatomia
  //  riempie tutta la cella sul foglio e diventa circa una volta e mezza più
  //  grande, senza perdere un solo pixel di informazione.
  //
  ritaglio: {

    attivo: true,

    // ─────────────────────────────────────────────────────────────────────
    //  ATTENZIONE — leggi prima di cambiare questo valore
    //
    //  Il Samsung Medison NON scrive le informazioni dentro il rettangolo
    //  dell'ecografia: le scrive TUTTO INTORNO.
    //     • a sinistra  → misurazioni e angoli (Alfa, Beta, Tipo)
    //     • a destra    → scala della profondità
    //     • sotto       → le etichette (Dx, Sn, quello che aggiungi tu)
    //     • sopra       → tipo di esame, sonda, profondità, frequenza
    //
    //  Quindi più si ritaglia, più informazione diagnostica sparisce dal
    //  foglio. Non si può avere l'immagine grande E tutti i dati: sono due
    //  cose in conflitto, e la scelta dipende dall'esame.
    // ─────────────────────────────────────────────────────────────────────
    //
    //   'completo'  → PREDEFINITO. Toglie SOLO la striscia in alto con logo,
    //                 nome paziente e data (che sono già nell'intestazione
    //                 del foglio). Tiene tutto il resto: misure, angoli,
    //                 scala, etichette. È quello giusto per le anche
    //                 pediatriche e per ogni esame in cui prendi misure.
    //
    //   'settore'   → solo il rettangolo dell'ecografia. L'immagine viene
    //                 circa una volta e mezza più grande, MA spariscono
    //                 misure, angoli, scala ed etichette. Usalo solo per
    //                 esami puramente descrittivi, senza misurazioni.
    //
    //   'nessuno'   → immagine intera come esce dall'ecografo, nome del
    //                 paziente compreso. Utile per fare confronti.
    //
    preset: 'completo',

    // Coordinate in pixel, misurate sui file reali dell'ecografo (1280x960).
    // left/top = angolo in alto a sinistra. width/height = dimensioni.
    //
    // SE CAMBI SONDA O PROFONDITÀ e il ritaglio taglia male, i numeri da
    // correggere sono questi. Aumenta 'width' per allargare a destra,
    // diminuisci 'left' per allargare a sinistra, e così via.
    preset_disponibili: {

      // La striscia di identificazione occupa le righe 12-57; la riga con
      // tipo esame e sonda comincia a 75. Si taglia a 66: in mezzo.
      completo: { left: 0, top: 66, width: 1280, height: 894 },

      // Il rettangolo del settore è in posizione fissa a x 307-972, y 188-861.
      settore: { left: 307, top: 188, width: 666, height: 674 },

      nessuno: null,
    },
  },


  // ═════════════════════════════════════════════════════════════════════════
  //  2. GAMMA — schiarisce i toni medi
  // ═════════════════════════════════════════════════════════════════════════
  //
  //  Lo schermo dell'ecografo emette luce, la carta la riflette soltanto:
  //  una stampa "fedele" esce sempre più cupa di com'era a monitor. La gamma
  //  compensa questo scarto.
  //
  //  Valori sopra 1 schiariscono, sotto 1 scuriscono. Nero e bianco puri
  //  restano dove sono: si muove solo quello che sta in mezzo.
  //
  //  1.00 = nessuna correzione
  //  1.12 = predefinito, correzione leggera
  //  1.25 = deciso — se la stampa resta cupa, prova qui
  //  1.40 = molto marcato, rischia di slavare l'immagine
  //
  gamma: {
    attivo: true,
    valore: 1.12,
  },


  // ═════════════════════════════════════════════════════════════════════════
  //  3. OMBRE — recupera il dettaglio nei grigi bassi
  // ═════════════════════════════════════════════════════════════════════════
  //
  //  È il punto dove sta l'informazione diagnostica, ed è anche quello che
  //  la stampa rovina più facilmente. Su carta OPACA (la tua, 120 g/m²)
  //  l'inchiostro si allarga leggermente nella fibra: i grigi scuri si
  //  fondono tra loro e diventano una macchia nera indistinta.
  //
  //  Questo passo schiarisce SOLO i toni scuri, lasciando intatti i medi e i
  //  chiari, così le sfumature basse restano separate anche dopo la stampa.
  //
  //  Il nero pieno NON viene toccato: resta nero, così la stampa mantiene
  //  contrasto invece di sembrare sbiadita. Si alza solo quello che sta
  //  appena sopra il nero.
  //
  //  intensita → quanto schiarire. 0 = spento.
  //              0.18 = predefinito, tarato per carta opaca
  //              0.10 = appena percettibile
  //              0.30 = marcato
  //              0.44 = massimo consentito. Oltre, il programma si rifiuta e
  //                     lo dice: una curva più spinta invertirebbe i grigi
  //                     vicini, disegnando bordi che nell'originale non ci
  //                     sono. Su un referto sarebbe pericoloso.
  //
  //  soglia    → fin dove arrivare, su una scala da 0 (nero) a 1 (bianco).
  //              0.25 = predefinito: agisce sul quarto più scuro
  //              Alzandola l'effetto invade anche i toni medi.
  //
  ombre: {
    attivo: true,
    intensita: 0.18,
    soglia: 0.25,
  },


  // ═════════════════════════════════════════════════════════════════════════
  //  4. INGRANDIMENTO — evita che sia la stampante a ingrandire
  // ═════════════════════════════════════════════════════════════════════════
  //
  //  ATTENZIONE, per evitare fraintendimenti: questo NON aggiunge dettaglio.
  //  Il dettaglio che l'ecografo non ha catturato non esiste e non si inventa.
  //
  //  Serve a un'altra cosa: l'immagine ritagliata è 666 pixel, ma sul foglio
  //  occupa una casella che ne vorrebbe circa 1100. Qualcuno deve ingrandirla.
  //  Se non lo facciamo noi lo fa il driver della stampante, con un metodo
  //  grossolano che produce bordi seghettati. Ingrandendo prima con un
  //  algoritmo di qualità (Lanczos) il risultato è visibilmente più pulito.
  //
  //  1 = spento (lascia fare alla stampante)
  //  2 = predefinito, buon compromesso
  //  3 = file più pesanti, miglioramento minimo
  //
  ingrandimento: {
    attivo: true,
    fattore: 2,
  },


  // ═════════════════════════════════════════════════════════════════════════
  //  5. PROFILO COLORE ICC — opzionale, normalmente SPENTO
  // ═════════════════════════════════════════════════════════════════════════
  //
  //  Un profilo .icc è la tabella che traduce i colori per una combinazione
  //  precisa di stampante + carta + inchiostri. Serve solo se hai fatto fare
  //  una taratura vera con uno spettrofotometro: un profilo generico scaricato
  //  da internet rischia di peggiorare le cose invece di migliorarle.
  //
  //  Lasciando null questo passo viene semplicemente saltato.
  //  Per attivarlo, scrivi il percorso completo del file, per esempio:
  //     profilo: 'C:\\RefertEco Dati Pazienti\\profili\\epson-et2860-opaca.icc',
  //
  profilo_icc: {

    profilo: null,

    // NOTA TECNICA, per onestà: l'obiettivo iniziale era usare l'intento
    // "percettivo". La versione di sharp installata (0.35) NON espone la
    // scelta dell'intento nella sua interfaccia: accetta il profilo e usa
    // il proprio predefinito (colorimetrico relativo). Il parametro qui
    // sotto è quindi solo documentazione di cosa vorremmo: oggi non ha
    // effetto. Se un giorno servirà davvero l'intento percettivo bisognerà
    // passare da uno strumento esterno (per esempio ImageMagick).
    intento_desiderato: 'perceptual',
  },


  // ═════════════════════════════════════════════════════════════════════════
  //  6. IMPAGINAZIONE — come si dispongono le immagini sul foglio
  // ═════════════════════════════════════════════════════════════════════════
  //
  //  Foglio A4 verticale. Le proporzioni delle immagini sono sempre
  //  rispettate: non vengono mai stirate né schiacciate.
  //
  //  Il numero di righe e colonne non è fisso: viene calcolato per far
  //  venire le immagini più grandi possibile, tenendo conto della loro forma.
  //  Con 4 per pagina vengono 2x2, con 8 vengono 2x4, con 12 vengono 3x4,
  //  con 15 vengono 3x5.
  //
  impaginazione: {

    // Quante immagini per foglio. Valori previsti: 4, 8, 12, 15.
    // Si può cambiare al volo anche dai pulsanti dentro il programma:
    // questo è solo il valore di partenza.
    per_pagina: 4,

    // ─────────────────────────────────────────────────────────────────────
    //  ORIENTAMENTO DEL FOGLIO
    //
    //  Le immagini dell'ecografo sono PANORAMICHE (più larghe che alte).
    //  Su un foglio verticale si spreca larghezza; su uno orizzontale si
    //  sprecherebbe altezza quando le immagini sono tante. Non esiste una
    //  risposta giusta sempre: dipende da quante ne metti per pagina.
    //
    //  Con 4 per pagina l'orizzontale le fa venire circa il 37% più grandi
    //  (128 mm invece di 93). Con 8 vince invece il verticale.
    //
    //   'verticale'  → PREDEFINITO. Sempre A4 verticale, come il referto.
    //                  I fogli stanno tutti nello stesso verso e si archiviano
    //                  insieme senza girare la cartellina. È la scelta di
    //                  Salvatore: la comodità di archivio vale più dei
    //                  millimetri guadagnati.
    //                  NOTA: con 8 immagini per pagina il verticale è anche
    //                  quello che le fa venire più grandi, quindi lavorando
    //                  a 8 non si perde proprio niente.
    //   'orizzontale'→ sempre A4 orizzontale
    //   'automatico' → il programma prova tutti e due e sceglie quello che fa
    //                  venire le immagini più grandi (cambia il verso del
    //                  foglio a seconda di quante immagini per pagina)
    //
    orientamento: 'verticale',

    margine_mm: 10,      // bordo bianco attorno al foglio
    spaziatura_mm: 3,    // spazio tra un'immagine e l'altra

    // Intestazione in cima a ogni foglio: nome paziente, data e tipo di esame.
    intestazione: true,

    // Numerino progressivo in basso a destra di ogni immagine.
    numera_immagini: true,
  },


  // ═════════════════════════════════════════════════════════════════════════
  //  7. STAMPA
  // ═════════════════════════════════════════════════════════════════════════
  stampa: {

    // true  = parte subito sulla stampante predefinita, senza chiedere niente
    // false = apre prima l'anteprima, con la finestra di stampa di Chrome
    //
    // Durante la taratura dei parametri può convenire metterlo a false, per
    // vedere il risultato a schermo senza consumare carta.
    diretta: true,

    // La stampa parte sempre sulla STAMPANTE PREDEFINITA di Windows.
    // Al momento è: EPSON ET-2860 Series (Copia 1) — quella col driver Epson
    // vero, dove sono impostate la qualità Alta e il tipo di carta.
    //
    // Per cambiarla: Impostazioni di Windows → Bluetooth e dispositivi →
    // Stampanti e scanner → scegli la stampante → "Imposta come predefinita".
    //
    // (Non c'è un'opzione qui per scegliere la stampante per nome: su Windows
    // il comando di stampa diretta non permette di indicarla in modo
    // affidabile, e un interruttore che a volte non funziona è peggio che non
    // averlo.)
  },
};
