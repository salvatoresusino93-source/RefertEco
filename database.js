const fs = require('fs');
const path = require('path');
const config = require('./config');

const DB_FILE = path.join(config.getDataDir(), 'referteco_data.json');

const PREDEF_DEFAULT = [
  // ── GENERICI ───────────────────────────────────────────────────
  { categoria: 'Generici', titolo: 'Esame negativo (generico)', testo: "L'esame ecografico non evidenzia alterazioni di rilievo a carico delle strutture esaminate.", ordine: 0 },
  { categoria: 'Generici', titolo: 'Esame limitato da meteorismo', testo: "L'esame risulta parzialmente limitato dalla presenza di abbondante meteorismo intestinale.", ordine: 1 },
  { categoria: 'Generici', titolo: 'Controllo ecografico consigliato', testo: 'Si consiglia controllo ecografico a distanza di ___ mesi.', ordine: 2 },
  { categoria: 'Generici', titolo: 'Formazione solida (generica)', testo: 'Si documenta formazione ___ (ipo/iso/iperecogena), a margini ___, di ___ × ___ mm, in sede ___. Al color Doppler si documenta/non si documenta vascolarizzazione interna. Si consiglia correlazione clinica e approfondimento diagnostico.', ordine: 3 },
  { categoria: 'Generici', titolo: 'Cisti semplice (generica)', testo: 'Si documenta formazione anecogena a margini netti di ___ mm, a contenuto omogeneo, priva di setti interni e componente solida, di tipo cistico semplice.', ordine: 4 },

  // ── ADDOME ─────────────────────────────────────────────────────
  { categoria: 'Addome', titolo: 'Negativo', testo: 'Fegato di dimensioni nei limiti della norma, con margini regolari, ecostruttura omogenea e indenne da lesioni focali ecograficamente risolvibili. Regolare calibro e pervietà delle vene sovraepatiche e della vena porta.\nColecisti distesa, indenne da calcoli endoluminali. Vie biliari non dilatate.\nNon tumefazioni pancreatiche a carico delle porzioni esplorabili.\nMilza nei limiti morfo-volumetrici.\nReni in sede, di dimensioni nei limiti della norma, con regolare spessore parenchimale e buona differenziazione cortico-midollare. Cavità calico-pieliche non dilatate. Non evidenti segni di nefrolitiasi.\nNon dilatazioni aneurismatiche nelle porzioni esplorabili dell\'aorta addominale.\nVescica distesa, con pareti regolari, indenne da evidenti lesioni aggettanti nel lume.\nNon falde fluide nei recessi peritoneali esplorati.', ordine: 10 },
  { categoria: 'Addome', titolo: 'Steatosi epatica', testo: 'Il fegato appare ad ecostruttura iperriflettente, come si osserva nei quadri di steatosi epatica; ha dimensioni aumentate e appare indenne da lesioni focali ecograficamente risolvibili.\nColecisti distesa, indenne da calcoli endoluminali. Vie biliari non dilatate.\nNon tumefazioni pancreatiche a carico delle porzioni esplorabili.\nMilza nei limiti morfo-volumetrici.\nReni in sede, di dimensioni nei limiti della norma, con regolare spessore parenchimale e buona differenziazione cortico-midollare. Cavità calico-pieliche non dilatate.\nVescica distesa, con pareti regolari.\nNon falde fluide nei recessi peritoneali esplorati.', ordine: 11 },
  { categoria: 'Addome', titolo: 'Calcoli colecisti', testo: 'Colecisti distesa, con evidenza nel contesto di ___ formazioni litiasiche calcifiche, la maggiore delle dimensioni di circa ___ mm. Vie biliari non dilatate.\nFegato di dimensioni nei limiti della norma, con margini regolari ed ecostruttura omogenea, indenne da lesioni focali ecograficamente risolvibili.\nNon tumefazioni pancreatiche a carico delle porzioni esplorabili.\nMilza nei limiti morfo-volumetrici.\nReni in sede, di dimensioni nei limiti della norma, con regolare spessore parenchimale. Cavità calico-pieliche non dilatate.\nNon falde fluide nei recessi peritoneali esplorati.', ordine: 12 },
  { categoria: 'Addome', titolo: 'Cisti renale', testo: 'Al ___ del rene ___ si documenta una formazione anecogena, con rinforzo di parete posteriore, compatibile con cisti semplice delle dimensioni massime di ___ mm.\nFegato di dimensioni nei limiti della norma, con margini regolari ed ecostruttura omogenea.\nColecisti distesa, indenne da calcoli endoluminali. Vie biliari non dilatate.\nMilza nei limiti morfo-volumetrici.\nNon falde fluide nei recessi peritoneali esplorati.', ordine: 13 },
  { categoria: 'Addome', titolo: 'Angioma epatico', testo: 'Nel ___ segmento epatico si documenta focalità iperecogena a margini netti di ___ mm, in prima ipotesi compatibile con angioma. Non si rilevano ulteriori evidenti lesioni focali.\nColecisti distesa, indenne da calcoli endoluminali. Vie biliari non dilatate.\nNon tumefazioni pancreatiche a carico delle porzioni esplorabili.\nMilza nei limiti morfo-volumetrici.\nReni in sede, di dimensioni nei limiti della norma. Cavità calico-pieliche non dilatate.\nNon falde fluide nei recessi peritoneali esplorati.', ordine: 14 },
  { categoria: 'Addome', titolo: 'Calcoli renali', testo: 'A destra si visualizzano ___ formazioni iperecogene con cono d\'ombra posteriore, la maggiore nei calici ___ con diametro massimo di ___ mm; cavità calico-pieliche non dilatate.\nA sinistra si visualizzano ___ formazioni iperecogene caliceali compatibili con la natura litiasica, della maggiore di ___ mm; cavità calico-pieliche non dilatate.\nFegato, colecisti, pancreas, milza nei limiti della norma.\nNon falde fluide nei recessi peritoneali esplorati.', ordine: 15 },
  { categoria: 'Addome', titolo: 'Polipo colecisti', testo: 'Lungo il profilo del corpo colecistico aggetta nel lume una formazione di aspetto polipoide di ___ mm, meritevole di controllo ecografico a distanza di circa 4-6 mesi in considerazione del primo riscontro.\nVie biliari non dilatate. Fegato nei limiti della norma.', ordine: 16 },
  { categoria: 'Addome', titolo: 'Prostata ipertrofica', testo: 'Prostata esplorata per via sovrapubica, con ecostruttura disomogenea per la presenza di millimetriche calcificazioni intraghiandolari; volume di circa ___ cc, con ipertrofia del lobo medio improntante il pavimento vescicale.\nVescica con pareti regolari, senza aggetti endoluminali, improntata sul pavimento dalla prostata ipertrofica.\nNon falde fluide perirenali né nello scavo pelvico.', ordine: 17 },
  { categoria: 'Addome', titolo: 'Urgenza negativo', testo: 'Esame eseguito in regime d\'urgenza.\nNon si osservano alterazioni ecostrutturali da riferire alla natura post-traumatica a carico di fegato, milza, reni. Cavità peritoneale libera da versamento.', ordine: 18 },
  { categoria: 'Addome', titolo: 'Secondarismi epatici', testo: 'L\'ecostruttura epatica è sovvertita per la presenza di plurime lesioni focali, variabili per aspetto e dimensioni, compatibili con secondarismi. Utile approfondimento diagnostico con esame TC.', ordine: 19 },

  // ── TIROIDE ────────────────────────────────────────────────────
  { categoria: 'Tiroide', titolo: 'Negativa', testo: 'Tiroide in sede, di dimensioni nei limiti della norma (diametro a-p lobo destro ___ mm; diametro a-p lobo sinistro ___ mm; istmo non ispessito).\nTrachea in asse.\nL\'ecostruttura ghiandolare è omogenea in assenza di formazioni nodulari.\nLa vascolarizzazione ghiandolare non è aumentata.\nNon si osservano linfoadenopatie in sede laterocervicale bilaterale.\nRegolare ecostruttura delle ghiandole sottomandibolari.', ordine: 30 },
  { categoria: 'Tiroide', titolo: 'Tiroidite cronica', testo: 'Tiroide in sede, di dimensioni nei limiti della norma (diametro a-p lobo destro ___ mm; diametro a-p lobo sinistro ___ mm; istmo non ispessito).\nTrachea in asse.\nL\'ecostruttura ghiandolare è disomogenea per la presenza di multiple formazioni ipoecogene confluenti, come si osserva nei quadri tiroiditici cronici.\nLa vascolarizzazione ghiandolare non è aumentata.\nNon si osservano linfoadenopatie in sede laterocervicale bilaterale.\nRegolare ecostruttura delle ghiandole sottomandibolari.\nUtile integrazione con esami laboratoristici e valutazione clinico-specialistica.', ordine: 31 },
  { categoria: 'Tiroide', titolo: 'Nodulo singolo', testo: 'Tiroide in sede, di dimensioni nei limiti della norma.\nNel contesto del lobo ___ si apprezza nodulo ad ecostruttura ___ (iso/ipo/iperecogena), delle dimensioni massime di ___ × ___ mm, caratterizzato da vascolarizzazione ___ al color Doppler.\nNon franche nodularità nel lobo controlaterale.\nNon linfoadenopatie laterocervicali.\nUtile integrazione con esami laboratoristici e valutazione specialistica.', ordine: 32 },
  { categoria: 'Tiroide', titolo: 'Multinodulare', testo: 'Tiroide in sede, di dimensioni ___ (nei limiti/aumentate), ad ecostruttura disomogenea per la presenza di plurime formazioni nodulari a carico di entrambi i lobi.\nIl nodulo di maggiori dimensioni è sito al ___ del lobo ___, delle dimensioni massime di ___ × ___ mm, ad ecostruttura ___, caratterizzato da vascolarizzazione ___ al color Doppler.\nNon linfoadenopatie laterocervicali.\nUtile valutazione specialistica endocrinologica.', ordine: 33 },
  { categoria: 'Tiroide', titolo: 'Esiti tiroidectomia', testo: 'In esiti di tiroidectomia totale/parziale non si documentano lesioni espansive nelle logge tiroidee.\nNon linfoadenopatie laterocervicali.', ordine: 34 },

  // ── LINFONODI ──────────────────────────────────────────────────
  { categoria: 'Linfonodi', titolo: 'Latero-cervicali negativi', testo: 'Indagate le regioni laterocervicali e sovraclaveari bilateralmente: non si documentano linfoadenopatie né linfonodi con franche caratteristiche di sovvertimento strutturale.\nGhiandole salivari maggiori (sottomandibolari e parotidi) regolari per dimensioni ed aspetto ecografico.', ordine: 40 },
  { categoria: 'Linfonodi', titolo: 'Reattivi latero-cervicali', testo: 'In sede laterocervicale si documentano alcuni linfonodi ipoecogeni, ovalari, con ilo ben rappresentato e vascolarizzazione unipolare, i maggiori in sede sottoangolomandibolare, delle dimensioni massime di ___ × ___ mm, di aspetto ecografico reattivo-benigno.\nNon linfonodi con caratteristiche di sovvertimento strutturale sospette per secondarietà.\nSi indica follow-up clinico-strumentale.', ordine: 41 },
  { categoria: 'Linfonodi', titolo: 'Dimensioni aumentate', testo: 'In sede laterocervicale e sottomandibolare bilaterale si riconoscono alcuni linfonodi di dimensioni nettamente aumentate, a morfologia ovalare, con ilo adiposo apparentemente riconoscibile, delle dimensioni massime di circa ___ mm.\nI reperti, in considerazione del quadro clinico, sono meritevoli di valutazione specialistica ed eventuale rivalutazione ecografica a breve distanza.', ordine: 42 },

  // ── SPALLA ─────────────────────────────────────────────────────
  { categoria: 'Spalla', titolo: 'Negativa', testo: 'L\'articolazione acromion-claveare presenta morfologia conservata. I tendini della cuffia dei rotatori (sovraspinato, sottospinato, sottoscapolare) appaiono regolari per spessore, margini ed ecostruttura fibrillare, senza evidenza di lesioni focali, discontinuità, calcificazioni o segni di tendinopatia. Il tendine del capo lungo del bicipite brachiale è in sede, ben contenuto nella doccia bicipitale, con guaina peritendinea priva di distensione fluida. La borsa subacromion-deltoidea presenta pareti regolari e non risulta significativamente distesa da fluido. Non si rileva versamento nei recessi articolari esplorabili. Non si documentano segni dinamici di impingement subacromiale.', ordine: 50 },
  { categoria: 'Spalla', titolo: 'Tendinosi sovraspinato', testo: 'L\'articolazione acromion-claveare appare lievemente irregolare, con modesto assottigliamento della rima articolare e piccoli rilievi osteofitosici marginali.\nIl tendine sovraspinato mostra perdita della regolare struttura fibrillare ed aspetto ipoecogeno disomogeneo, in assenza di segni di avulsione, reperto compatibile con tendinopatia cronica.\nIl tendine del capo lungo del bicipite brachiale è in sede, con contorni e spessore conservati, in assenza di significativa distensione della guaina peritendinea.\nLa borsa subacromion-deltoidea si presenta lievemente ispessita e ipoecogena.\nNei recessi articolari esplorabili non si apprezzano versamenti significativi.', ordine: 51 },
  { categoria: 'Spalla', titolo: 'Tendinosi calcifica', testo: 'Il tendine del capo lungo del bicipite brachiale è in sede, in presenza di minima falda fluida peritendinea.\nModeste alterazioni tendinosiche a carico del tendine sovraspinato che appare ispessito e disomogeneo con alcune minute calcificazioni in sede preinserzionale. Analoghi reperti, di minore entità, a carico del tendine sottoscapolare.\nRegolare ecostruttura fibrillare del tendine sottospinato.\nMinima sovradistensione fluida della borsa subacromion-deltoidea.\nIniziali segni di fibro-artrosi acromion-claveare.', ordine: 52 },
  { categoria: 'Spalla', titolo: 'Fissurazione sovraspinato', testo: 'Il tendine sovraspinato mostra lungo il versante capsulare un difetto della struttura fibrillare di circa ___ mm compatibile con fissurazione, con associata minima falda fluida limitrofa.\nNon si apprezzano ulteriori alterazioni a carico degli altri componenti della cuffia dei rotatori.\nIl tendine del capo lungo del bicipite brachiale è in sede.\nNon significativo versamento articolare.', ordine: 53 },
  { categoria: 'Spalla', titolo: 'Rottura cuffia dei rotatori', testo: 'Rottura totale con retrazione miotendinea del tendine sovraspinato, sottoscapolare ed in minor misura del tendine infraspinato.\nNon distensione liquida della borsa subacromion-deltoidea.\nTendine del capo lungo del bicipite in sede; non falde liquide peritendinee.\nDiffuso quadro di artrosi scapolo-omerale.', ordine: 54 },

  // ── GOMITO ─────────────────────────────────────────────────────
  { categoria: 'Gomito', titolo: 'Negativo', testo: 'Regolari reperti ecografici a livello dei tendini comuni estensori e flessori delle dita e del tendine tricipite.\nNon versamento liquido intra-articolare.\nNon distensione della borsa olecranica.\nRegolare il nervo ulnare al passaggio nel canale cubitale.', ordine: 60 },
  { categoria: 'Gomito', titolo: 'Epicondilite', testo: 'Si documenta ecostruttura finemente disomogenea in sede pre-inserzionale del tendine comune degli estensori rispetto al controlato; all\'integrazione con color Doppler si apprezzano alcuni spot vascolari nel contesto; tali reperti sono compatibili in prima ipotesi con quadro di epicondilite.\nRegolari reperti ecografici a carico del tendine comune dei flessori e del tendine tricipitale.\nRegolare ecostruttura del nervo ulnare.\nNon segni di borsite olecranica né versamento articolare.', ordine: 61 },

  // ── GINOCCHIO ──────────────────────────────────────────────────
  { categoria: 'Ginocchio', titolo: 'Negativo', testo: 'Regolare spessore ed aspetto fibrillare dell\'inserzione distale del tendine quadricipitale, del tendine rotuleo e dei legamenti collaterali mediale e laterale.\nNon estrusione delle fibro-cartilagini meniscali ecograficamente esplorabili.\nNon significativo versamento articolare.\nNon espansi nel cavo popliteo.', ordine: 70 },
  { categoria: 'Ginocchio', titolo: 'Cisti di Baker', testo: 'Si documenta distensione fluida della borsa gastrocnemio-semimembranosa con contenuto ___ (cisti di Baker) delle dimensioni massime di ___ × ___ mm.\nRegolari reperti il tendine rotuleo e i legamenti collaterali.\nNon versamento intrarticolare significativo.', ordine: 71 },
  { categoria: 'Ginocchio', titolo: 'Entesopatia calcifica', testo: 'Si documenta regolare spessore ed aspetto fibrillare dell\'inserzione distale del tendine quadricipitale, quest\'ultimo in presenza di segni di entesopatia calcifica al polo rotuleo superiore.\nRegolari il tendine rotuleo e i legamenti collaterali.\nNon versamento intrarticolare significativo.', ordine: 72 },

  // ── CAVIGLIA ───────────────────────────────────────────────────
  { categoria: 'Caviglia', titolo: 'Negativa', testo: 'Regolare ecostruttura fibrillare dei tendini peronei lungo e breve.\nRegolare il legamento peroneo-astragalico anteriore e i tendini tibiale anteriore e posteriore.\nConservato lo spessore dell\'aponeurosi plantare superficiale all\'inserzione calcaneare.\nNon falde fluide visualizzabili nel recesso tibio-peroneo-astragalico anteriore.', ordine: 80 },
  { categoria: 'Caviglia', titolo: 'Entesopatia calcaneale', testo: 'Nel tendine d\'Achille, a livello preinserzionale calcaneare, sono riconoscibili calcificazioni in quadro di entesopatia, senza segni di rottura.\nNon si riconoscono falde fluide peritendinee.\nMinima falda fluida nella borsa retrocalcaneare.\nNon alterazioni a carico della fascia plantare a livello dell\'inserzione calcaneare.', ordine: 81 },
  { categoria: 'Caviglia', titolo: 'Sperone calcaneare', testo: 'In quadro di entesopatia calcifica retro- e sottocalcaneare, i tendini d\'Achille hanno regolare aspetto e struttura conservata.\nLa fascia plantare risulta lievemente ispessita all\'inserzione calcaneare, senza segni di rottura.', ordine: 82 },

  // ── CUTE E TESSUTI MOLLI ───────────────────────────────────────
  { categoria: 'Tessuti molli', titolo: 'Cisti sebacea', testo: 'Nei tessuti molli sottocutanei, in sede sovrafasciale, si riconosce una formazione ovalare a margini netti e contenuto disomogeneamente ipoecogeno delle dimensioni di ___ × ___ mm, priva di alterazioni vascolari all\'integrazione con color Doppler, compatibile con cisti sebacea.', ordine: 90 },
  { categoria: 'Tessuti molli', titolo: 'Lipoma', testo: 'Nel contesto del tessuto sottocutaneo si riconosce formazione ovalare a margini netti, ad ecostruttura mista prevalentemente ipoecogena con tralci iperecogeni nel contesto, delle dimensioni massime di ___ × ___ mm, priva di significativi segnali vascolari al color Doppler, riferibile in prima ipotesi a fibrolipoma.\nUtile valutazione specialistica.', ordine: 91 },
  { categoria: 'Tessuti molli', titolo: 'Ernia inguinale', testo: 'Si riconosce tessuto adiposo addominale che si affaccia all\'orifizio inguinale esterno durante la manovra del ponzamento eseguita in stazione supina, e spontaneamente in stazione eretta, riducendosi al termine della manovra.\nNon si riconoscono falde fluide limitrofe.', ordine: 92 },
  { categoria: 'Tessuti molli', titolo: 'Negativo ernia inguinale', testo: 'Non si riconoscono immagini compatibili con protrusioni erniarie nelle sedi esaminate, neanche durante la manovra del ponzamento.', ordine: 93 },

  // ── TESTICOLO ──────────────────────────────────────────────────
  { categoria: 'Testicolo', titolo: 'Negativo', testo: 'Didimi regolari per morfologia, dimensioni ed ecostruttura omogenea, priva di calcificazioni.\nEpididimi regolari per morfologia ed ecostruttura.\nRegolare vascolarizzazione parenchimale al color Doppler.\nNon idrocele rilevabile.\nNon segni di varicocele né ectasie delle strutture venose.', ordine: 100 },

  // ── DOPPLER TSA ────────────────────────────────────────────────
  { categoria: 'Doppler TSA', titolo: 'Negativo', testo: 'A destra: si documenta regolare pervietà della carotide comune, della carotide interna ed esterna in assenza di ateromi e/o stenosi.\nA sinistra: si documenta regolare pervietà della carotide comune, della carotide interna ed esterna in assenza di ateromi e/o stenosi.\nArterie vertebrali pervie con tracciati normodiretti.', ordine: 110 },
  { categoria: 'Doppler TSA', titolo: 'Angiosclerosi, stenosi minime', testo: 'Si rileva diffusa angiosclerosi a carico del distretto esaminato.\nA destra: regolare pervietà della carotide comune e della carotide esterna. Sottili ateromi fibrocalcifici alla biforcazione coinvolgenti l\'origine della carotide interna, non determinanti stenosi significative (<20%).\nA sinistra: regolare pervietà della carotide comune e della carotide esterna. Sottili ateromi fibrocalcifici alla biforcazione coinvolgenti l\'origine della carotide interna, non determinanti stenosi significative (<20%).\nArterie vertebrali pervie con tracciati normodiretti.', ordine: 111 },
  { categoria: 'Doppler TSA', titolo: 'Angiosclerosi, stenosi lievi', testo: 'Si rileva diffusa angiosclerosi a carico del distretto esaminato.\nA destra: ateromi fibrocalcifici alla biforcazione coinvolgenti l\'origine della carotide interna, determinanti stenosi di grado lieve (circa 30%).\nA sinistra: ateromi fibrocalcifici alla biforcazione coinvolgenti l\'origine della carotide interna, determinanti stenosi di grado lieve (circa 30%).\nArterie vertebrali pervie con tracciati normodiretti.', ordine: 112 },
  { categoria: 'Doppler TSA', titolo: 'Angiosclerosi, stenosi moderate', testo: 'Si rileva diffusa angiosclerosi a carico del distretto esaminato.\nA destra: ateromi fibrocalcifici alla biforcazione coinvolgenti l\'origine della carotide interna, determinanti stenosi di grado moderato (<50%).\nA sinistra: ateromi fibrocalcifici alla biforcazione coinvolgenti l\'origine della carotide interna, determinanti stenosi di grado moderato (<50%).\nArterie vertebrali pervie con tracciati normodiretti.', ordine: 113 },

  // ── DOPPLER VENOSO ─────────────────────────────────────────────
  { categoria: 'Doppler venoso', titolo: 'Arti inferiori negativo', testo: 'Regolare pervietà, calibro e continenza del sistema venoso profondo bilateralmente.\nIn particolare non si documentano segni di TVP in atto bilateralmente.\nA destra: regolare pervietà, calibro e continenza della safena interna ed esterna. Non si documentano segni di tromboflebite in atto.\nA sinistra: regolare pervietà, calibro e continenza della safena interna ed esterna. Non si documentano segni di tromboflebite in atto.', ordine: 120 },

  // ── DOPPLER ARTERIOSO ──────────────────────────────────────────
  { categoria: 'Doppler arterioso', titolo: 'Arti inferiori negativo', testo: 'Si documenta un quadro di modesta e diffusa ateromasia a carico del distretto esaminato.\nA destra: regolare pervietà dell\'asse femoro-popliteo e dei vasi di gamba, con tracciati di tipo trifasico in assenza di stenosi emodinamiche.\nA sinistra: regolare pervietà dell\'asse femoro-popliteo e dei vasi di gamba, con tracciati di tipo trifasico in assenza di stenosi emodinamiche.', ordine: 121 },

  // ── ARTERIE RENALI ─────────────────────────────────────────────
  { categoria: 'Doppler arterie renali', titolo: 'Negativo', testo: 'I reni, in sede, hanno regolari dimensioni ed ecostruttura con conservato gradiente cortico-midollare.\nLe vie escretrici urinarie non sono dilatate.\nLe arterie renali sono regolarmente pervie senza evidenza di stenosi emodinamiche, con indici di resistenza < 0.8.\nIl campionamento dei vasi intraparenchimali ha documentato indici di resistenza < 0.7.\nReperti nei limiti di normalità.', ordine: 122 },
];

function makeDefault() {
  return {
    referti: [],
    predefiniti: PREDEF_DEFAULT.map((p, i) => ({ id: i + 1, ...p })),
    nextPredefId: PREDEF_DEFAULT.length + 1,
  };
}

let _data = null;

function init() {
  if (fs.existsSync(DB_FILE)) {
    try {
      _data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      if (typeof _data.nextPredefId !== 'number') {
        _data.nextPredefId = (_data.predefiniti || []).reduce((m, p) => Math.max(m, p.id), 0) + 1;
      }
      // Aggiunge i nuovi predefiniti di default mancanti (migrazione)
      const titoliEsistenti = new Set((_data.predefiniti || []).map(p => p.titolo));
      const nuovi = PREDEF_DEFAULT.filter(p => !titoliEsistenti.has(p.titolo));
      if (nuovi.length > 0) {
        const maxOrdine = (_data.predefiniti || []).reduce((m, p) => Math.max(m, p.ordine || 0), 0);
        nuovi.forEach((p, i) => {
          _data.predefiniti.push({ id: _data.nextPredefId++, ...p, ordine: maxOrdine + i + 1 });
        });
        persist();
      }
    } catch(e) {
      _data = makeDefault();
      persist();
    }
  } else {
    _data = makeDefault();
    persist();
  }
}

function get() { return _data; }

function persist() {
  const content = JSON.stringify(_data, null, 2);
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, content, 'utf8');
  try {
    if (fs.existsSync(DB_FILE)) fs.unlinkSync(DB_FILE);
    fs.renameSync(tmp, DB_FILE);
  } catch(e) {
    fs.writeFileSync(DB_FILE, content, 'utf8');
    try { fs.unlinkSync(tmp); } catch(_) {}
  }
}

init();

module.exports = { get, persist, DB_FILE };
