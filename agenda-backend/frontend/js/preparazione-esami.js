(function (root) {
  const PREP_KEYWORDS = [
    'addome',
    'addominale',
    'epatica',
    'epato',
    'fegato',
    'colecisti',
    'colecistopatia',
    'biliare',
    'pancreas',
    'pancreatica',
    'pancreatico',
    'splenica',
    'milza',
    'renale',
    'rene',
    'reni',
    'urinario',
    'urinaria',
    'urinari',
    'vescic',
    'surrenal',
    'aorta',
    'portale',
    'portali',
    'mesenter',
    'anse intestinali',
    'retroperiton',
    'ceus',
    'arterie renali',
  ];

  const TESTO =
    'Venire a DIGIUNO (almeno 6 ore, solo acqua permessa) e con VESCICA PIENA ' +
    '(non urinare nelle 2–3 ore prima dell\'esame).';

  function richiedePreparazione(nome) {
    const n = String(nome || '').toLowerCase();
    return PREP_KEYWORDS.some(function (k) {
      return n.includes(k);
    });
  }

  function htmlReminder(className) {
    const cls = className || 'prep-reminder';
    return (
      '<div class="' +
      cls +
      '">' +
      '<div class="prep-icon">⚠️</div>' +
      '<div class="prep-text">' +
      '<strong>Preparazione per l\'esame:</strong><br>' +
      'Venire a <strong>DIGIUNO</strong> (almeno 6 ore) e con <strong>VESCICA PIENA</strong>.' +
      '</div></div>'
    );
  }

  root.PREPARAZIONE_ESAMI = {
    richiedePreparazione: richiedePreparazione,
    htmlReminder: htmlReminder,
    testo: TESTO,
  };
})(typeof window !== 'undefined' ? window : globalThis);
