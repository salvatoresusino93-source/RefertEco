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

  // ── Traduzioni inglesi (nomi esami e categorie) ───────────────────────
  const CAT_EN = {
    'Addome': 'Abdomen',
    'Apparato urinario e urologia': 'Urinary tract and urology',
    'Tiroide e collo': 'Thyroid and neck',
    'Muscolo-scheletrico': 'Musculoskeletal',
    'Pediatrica': 'Paediatric',
    'Vascolare (Doppler)': 'Vascular (Doppler)',
    'Altro': 'Other',
  };

  const NOME_EN = {
    'Ecografia addome completo': 'Complete abdominal ultrasound',
    'Ecografia addome superiore': 'Upper abdominal ultrasound',
    'Ecografia addome inferiore': 'Lower abdominal ultrasound',
    'Ecografia apparato urinario': 'Urinary tract ultrasound',
    'Ecografia renale': 'Kidney ultrasound',
    'Ecografia vescico-prostatica': 'Bladder and prostate ultrasound',
    'Ecografia scrotale e testicolare': 'Scrotal and testicular ultrasound',
    'Ecografia tiroide': 'Thyroid ultrasound',
    'Ecografia del collo': 'Neck ultrasound',
    'Ecografia muscolo-scheletrica': 'Musculoskeletal ultrasound',
    'Ecografia spalla': 'Shoulder ultrasound',
    'Ecografia ginocchio': 'Knee ultrasound',
    'Ecografia anca': 'Hip ultrasound',
    'Ecografia gomito': 'Elbow ultrasound',
    'Ecografia polso e mano': 'Wrist and hand ultrasound',
    'Ecografia caviglia e piede': 'Ankle and foot ultrasound',
    'Ecografia parti molli': 'Soft-tissue ultrasound',
    'Ecografia anca neonatale': 'Newborn hip ultrasound',
    'Ecocolordoppler TSA (tronchi sovra-aortici)': 'Carotid Doppler ultrasound (supra-aortic trunks)',
    'Ecocolordoppler aorta addominale': 'Abdominal aorta Doppler ultrasound',
    'Ecocolordoppler arterie renali': 'Renal artery Doppler ultrasound',
    'Ecocolordoppler arti inferiori': 'Lower-limb Doppler ultrasound',
    'Ecocolordoppler arti superiori': 'Upper-limb Doppler ultrasound',
    'Ecografia linfonodi': 'Lymph node ultrasound',
  };

  function nomeTradotto(nome, en) {
    return en ? (NOME_EN[nome] || nome) : nome;
  }
  function catTradotta(cat, en) {
    return en ? (CAT_EN[cat] || cat) : cat;
  }

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

  root.ESAMI_CATEGORIE = { ORDINE, categoria, raggruppa, NOME_EN, CAT_EN, nomeTradotto, catTradotta };
})(typeof window !== 'undefined' ? window : globalThis);
