/** Textes de l'écran de chantier. Les refus disent ce qui manque, en une phrase. */
export const SITE_TEXTS = {
  heading: 'Chantier',
  stage: 'Étape {n} sur {total}',
  materials: 'Matériaux',
  inBag: 'dans ton sac: {n}',
  money: 'Somme due',
  chest: 'Coffre commun: {montant}',
  free: 'Rien à payer',
  paid: 'Payé',
  work: 'Travail',
  workLeft: 'Reste {n} s',
  workNone: 'Rien à faire au marteau',
  workDuo: 'à deux: {n} fois plus vite',
  working: '{nom} travaille',
  gestures: {
    supply: 'Apporter',
    pay: 'Payer',
    work: 'Travailler',
    stop: 'Arrêter',
  },
  payFromChest: 'pris au coffre commun',
  payMixed: 'coffre {coffre}, ta bourse {bourse}',
  payFromPurse: 'coffre vide: ta bourse',
  supplyHint: 'ce que tu as dans ton sac',
  workHint: 'reste sur place',
  done: 'fait',
  keys: { choose: 'choisir', act: 'faire', leave: 'sortir', close: 'fermer' },
  finished: '{piece}: c’est fini !',
  stageDone: 'Étape finie. La suite demande autre chose.',
  supplied: '{nom} a apporté: {quoi}',
  clue: 'Trouvé pendant les travaux',
  lockStory: 'Ce chantier attend son heure: l’histoire n’en est pas là.',
  lockRooms: 'D’abord: {pieces}.',
  refusals: {
    'room-nothing-to-give': 'Rien à apporter: ton sac n’a rien de ce qui manque ({manque}).',
    'room-missing-materials': 'Les matériaux d’abord. Il manque: {manque}.',
    'room-not-paid': 'Le devis d’abord: il reste {montant} à payer.',
    'room-already-paid': 'C’est déjà payé.',
    'not-enough-money': 'Coffre trop maigre: il manque {montant}, même en vidant ta bourse.',
    'room-done': 'Cette pièce est finie.',
    'too-far': 'Trop loin du chantier.',
    gone: 'Ce chantier n’existe plus.',
  },
  refusalDefault: 'Impossible pour l’instant.',
  notices: {
    supplied: '{nom}: {quoi} pour {piece}',
    stage: '{piece}: une étape de finie',
    finished: '{piece}: c’est fini !',
  },
} as const;

export type SiteRefusalKey = keyof typeof SITE_TEXTS.refusals;

export function isSiteRefusal(reason: string): reason is SiteRefusalKey {
  return reason in SITE_TEXTS.refusals;
}
