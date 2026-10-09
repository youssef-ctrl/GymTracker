// Mesociclo 1 di Pesce Spalla. ID fisso: il seed è idempotente anche dopo un reinstall.
// rir: 0 = cedimento tecnico, 1 = 1 RIR. inc = incremento di carico in kg.
export const SEED_PROGRAM = {
  id: '6d1f0c3e-6a51-4c1e-9b1a-000000000001',
  name: 'Mesociclo 1',
  data: {
    exercises: {
      'high-row':           { name: 'High row monolaterale',       unilateral: true,  inc: 2.5 },
      'croci-15':           { name: 'Croci manubri panca 15°',     unilateral: false, inc: 2.5 },
      'rematore-30':        { name: 'Rematore manubri panca 30°',  unilateral: false, inc: 2.5 },
      'chest-press':        { name: 'Chest press',                 unilateral: false, inc: 2.5 },
      'pushdown-corda':     { name: 'Pushdown corda lunga',        unilateral: false, inc: 2.5 },
      'curl-cavo-vbar':     { name: 'Curl cavo basso V-bar',       unilateral: false, inc: 2.5 },
      'french-press-corda': { name: 'French press corda lunga',    unilateral: false, inc: 2.5 },
      'hammer-scott':       { name: 'Hammer Scott curl',           unilateral: false, inc: 2.5 },
      'laterali-supp':      { name: 'Alzate laterali supportate',  unilateral: false, inc: 2.5 },
      'laterali-cavo':      { name: 'Alzate laterali al cavo',     unilateral: true,  inc: 2.5 },
      'leg-curl':           { name: 'Leg curl seduto',             unilateral: false, inc: 2.5 },
      'leg-press-45':       { name: 'Leg press 45',                unilateral: false, inc: 2.5 },
      'hyperextension':     { name: 'Hyperextension',              unilateral: false, inc: 2.5 },
      'leg-ext-uni':        { name: 'Leg extension unilaterale',   unilateral: true,  inc: 2.5 },
      'adductor':           { name: 'Adductor machine',            unilateral: false, inc: 2.5 }
    },
    // L'ordine è la rotazione: dopo l'ultima viene la prima.
    templates: [
      { key: 'upper-a', name: 'Upper A', slots: [
        { ex: 'high-row',       sets: 2, min: 6, max: 9,  rir: 0, note: '1" di fermo in alto e in basso' },
        { ex: 'croci-15',       sets: 2, min: 7, max: 10, rir: 0, note: 'Gomito leggermente flesso in eccentrica, omero a 45° dal fianco, 1" di fermo in basso' },
        { ex: 'rematore-30',    sets: 2, min: 7, max: 10, rir: 0, note: 'Presa neutra, gomiti stretti, tirali indietro fino a retrarre le scapole' },
        { ex: 'chest-press',    sets: 2, min: 5, max: 8,  rir: 0, note: 'Omero poco sotto la linea delle spalle, 1" di fermo a fine eccentrica' },
        { ex: 'pushdown-corda', sets: 2, min: 6, max: 9,  rir: 0, note: 'In ginocchio vicino al cavo, omero fisso accanto al fianco, 1" di fermo in alto' },
        { ex: 'curl-cavo-vbar', sets: 2, min: 6, max: 9,  rir: 0, note: '1" di fermo in basso' }
      ]},
      { key: 'lower-a', name: 'Lower A', slots: [
        { ex: 'laterali-supp',  sets: 2, min: 7, max: 10, rir: 0, note: 'Petto appoggiato su panca a 90°' },
        { ex: 'leg-curl',       sets: 2, min: 6, max: 9,  rir: 0, note: 'Dorsiflessione plantare, 1" di fermo in alto' },
        { ex: 'leg-press-45',   sets: 2, min: 6, max: 9,  rir: 1, note: 'Piedi medio-bassi, ginocchia al petto, 2" di fermo in basso' },
        { ex: 'hyperextension', sets: 2, min: 5, max: 8,  rir: 1, note: 'Full ROM, 1" di fermo in basso' },
        { ex: 'leg-ext-uni',    sets: 2, min: 7, max: 10, rir: 0, note: '1" di fermo in alto e in basso, tappetino tra tibia e rullo' },
        { ex: 'adductor',       sets: 2, min: 8, max: 12, rir: 0, note: 'Ampiezza massima, 2" di fermo in stretch a gambe aperte' }
      ]},
      { key: 'upper-b', name: 'Upper B', slots: [
        { ex: 'high-row',           sets: 2, min: 6, max: 9,  rir: 0, note: '1" di fermo in alto e in basso' },
        { ex: 'croci-15',           sets: 3, min: 7, max: 10, rir: 0, note: 'Gomito leggermente flesso in eccentrica, omero a 45° dal fianco, 1" di fermo in basso' },
        { ex: 'rematore-30',        sets: 2, min: 7, max: 10, rir: 0, note: 'Presa neutra, gomiti stretti, tirali indietro fino a retrarre le scapole' },
        { ex: 'chest-press',        sets: 2, min: 5, max: 8,  rir: 0, note: 'Omero poco sotto la linea delle spalle, 1" di fermo a fine eccentrica' },
        { ex: 'french-press-corda', sets: 3, min: 7, max: 10, rir: 0, note: 'Cavo all\'altezza del bacino, 1" di fermo in basso' },
        { ex: 'hammer-scott',       sets: 2, min: 6, max: 9,  rir: 0, note: '1" di fermo in basso quasi a estensione completa, poi sali accelerando' }
      ]},
      { key: 'lower-b', name: 'Lower B', slots: [
        { ex: 'laterali-cavo',  sets: 3, min: 7, max: 10, rir: 0, note: 'Cavo all\'altezza della mano, 1" di fermo in basso, 90" tra un braccio e l\'altro' },
        { ex: 'leg-curl',       sets: 2, min: 6, max: 9,  rir: 0, note: 'Dorsiflessione plantare, 1" di fermo in alto' },
        { ex: 'leg-press-45',   sets: 2, min: 6, max: 9,  rir: 1, note: 'Piedi medio-bassi, ginocchia al petto, 2" di fermo in basso' },
        { ex: 'hyperextension', sets: 2, min: 5, max: 8,  rir: 1, note: 'Full ROM, 1" di fermo in basso' },
        { ex: 'leg-ext-uni',    sets: 2, min: 7, max: 10, rir: 0, note: '1" di fermo in alto e in basso, tappetino tra tibia e rullo' },
        { ex: 'adductor',       sets: 2, min: 8, max: 12, rir: 0, note: 'Ampiezza massima, 2" di fermo in stretch a gambe aperte' }
      ]}
    ]
  }
};
