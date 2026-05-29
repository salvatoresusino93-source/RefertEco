(function (root) {
  const ORDINE = [
    'Addome',
    'Apparato urinario e urologia',
    'Tiroide e collo',
    'Muscolo-scheletrico',
    'Pediatrica',
    'Vascolare (Doppler)',
    'Altro',
  ];

  const MAP = {
    'Ecografia addome completo': 'Addome',
    'Ecografia addome superiore': 'Addome',
    'Ecografia addome inferiore': 'Addome',
    'Ecografia apparato urinario': 'Apparato urinario e urologia',
    'Ecografia renale': 'Apparato urinario e urologia',
    'Ecografia vescico-prostatica': 'Apparato urinario e urologia',
    'Ecografia prostatica transrettale': 'Apparato urinario e urologia',
    'Ecografia scrotale e testicolare': 'Apparato urinario e urologia',
    'Ecografia tiroide': 'Tiroide e collo',
    'Ecografia del collo': 'Tiroide e collo',
    'Ecografia muscolo-scheletrica': 'Muscolo-scheletrico',
    'Ecografia spalla': 'Muscolo-scheletrico',
    'Ecografia ginocchio': 'Muscolo-scheletrico',
    'Ecografia anca': 'Muscolo-scheletrico',
    'Ecografia gomito': 'Muscolo-scheletrico',
    'Ecografia polso e mano': 'Muscolo-scheletrico',
    'Ecografia caviglia e piede': 'Muscolo-scheletrico',
    'Ecografia parti molli': 'Muscolo-scheletrico',
    'Ecografia anca neonatale': 'Pediatrica',
    'Ecocolordoppler TSA (tronchi sovra-aortici)': 'Vascolare (Doppler)',
    'Ecocolordoppler aorta addominale': 'Vascolare (Doppler)',
    'Ecocolordoppler arterie renali': 'Vascolare (Doppler)',
    'Ecocolordoppler arti inferiori': 'Vascolare (Doppler)',
    'Ecocolordoppler arti superiori': 'Vascolare (Doppler)',
    'Ecografia linfonodi': 'Altro',
  };

  function categoria(nome) {
    return MAP[nome] || 'Altro';
  }

  function raggruppa(esami) {
    const gruppi = new Map();
    for (const cat of ORDINE) gruppi.set(cat, []);
    for (const e of esami) {
      const cat = categoria(e.nome);
      if (!gruppi.has(cat)) gruppi.set(cat, []);
      gruppi.get(cat).push(e);
    }
    for (const [cat, items] of gruppi) {
      items.sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
    }
    return ORDINE.map((cat) => ({ cat, items: gruppi.get(cat) || [] })).filter((g) => g.items.length);
  }

  root.ESAMI_CATEGORIE = { ORDINE, categoria, raggruppa };
})(typeof window !== 'undefined' ? window : globalThis);
