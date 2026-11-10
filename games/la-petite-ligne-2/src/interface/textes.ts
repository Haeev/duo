/**
 * Tous les textes de l'interface, en français, qui tutoient. La logique n'en écrit aucun: elle
 * lit ce fichier. `{nom}`, `{lieu}`, `{n}`, `{max}`, `{montant}`: valeurs remplies à l'affichage.
 */
export const TEXTS = {
  clock: {
    day: 'Jour {n}',
    sleep: 'Tu peux dormir',
    label: 'Jour {n}, {heure}. Bourse : {montant}.',
  },
  needs: {
    hunger: 'Faim',
    sleep: 'Sommeil',
    hygiene: 'Hygiène',
    state: {
      blocked: 'à zéro',
      low: 'basse',
      neutral: 'correcte',
      bonus: 'en forme, bonus',
    },
  },
  toolbar: {
    label: 'Barre d’outils',
    empty: 'Case vide',
  },
  prompt: {
    board: 'Monter',
    boardTo: 'Monter vers {lieu}',
    unboard: 'Descendre',
    waitOther: 'On attend {nom}',
  },
  /** Raison d'un refus (clé de la simulation): 4 mots au plus. */
  refusals: {
    'already-sharp': 'Déjà bien affûté',
    'bed-taken': 'Lit déjà pris',
    busy: 'Tu es occupé·e',
    'cannot-repair': 'Pas réparable',
    'chest-empty': 'Le coffre est vide',
    'chest-full': 'Le coffre est plein',
    'empty-slot': 'Case vide',
    gone: 'Plus là',
    'no-line': 'Pas de train par là',
    'no-slot': 'Pas de case',
    'no-tool-in-hand': 'Prends un outil',
    'no-train-now': 'Pas de train maintenant',
    'not-a-meal': 'Pas un repas',
    'not-edible': 'Ça ne se mange pas',
    'not-enough-money': 'Pas assez d’argent',
    'not-needed': 'Pas besoin',
    'not-on-platform': 'Va sur le quai',
    'not-together': 'Il faut être deux',
    'nothing-to-say': 'Rien à dire',
    'other-destination': 'L’autre va ailleurs',
    'other-pockets-full': 'Ses poches sont pleines',
    'pockets-full': 'Poches pleines',
    'purse-full': 'Bourse pleine',
    refused: 'Pas possible',
    'seat-taken': 'Place prise',
    'stack-full': 'Pile pleine',
    'store-full': 'Plus de place',
    'too-dirty': 'Lave-toi d’abord',
    'too-far': 'Trop loin',
    'train-gone': 'Le train est parti',
  } as Readonly<Record<string, string>>,
  refusalDefault: 'Pas possible',
  notices: {
    pocketsFull: 'Poches pleines',
    chestIn: 'Coffre : {montant}',
    otherLoading: '{nom} charge encore',
    otherSleeping: '{nom} veut dormir',
    youSleepWait: 'On attend {nom}',
    otherAtTrain: '{nom} t’attend au train',
    otherLeftTrain: '{nom} est descendu·e',
    given: '{nom} te donne {objet}',
    toolBlunt: 'Outil émoussé',
  },
  glance: {
    other: '{nom}, à {n} m',
    questSoon: 'Quête : bientôt',
  },
  dialogue: {
    provisional: 'Portrait provisoire',
    choices: 'Ta réponse',
    fails: 'Échouera : lave-toi d’abord',
    next: 'suite',
    close: 'fermer',
    speakerPlayer: 'Toi',
  },
  notebook: {
    label: 'Carnet',
    tabs: {
      bag: 'Sac',
      quests: 'Quêtes',
      villagers: 'Habitants',
      collections: 'Collections',
      map: 'Carte',
      outfits: 'Tenues',
      settings: 'Réglages',
    },
    soon: 'À venir',
    soonLine: 'Cette page arrive bientôt.',
    noBag: 'Pas encore de sac',
    bagLabel: 'Sac de {n} cases',
    slotLabel: '{objet}, {n} sur {max}',
    slotFull: ', pile pleine',
    wear: 'Usure : {n} %',
    count: '{n} sur {max}',
    eat: 'Manger',
    drop: 'Poser',
    give: 'Donner',
    move: 'déplacer',
    tabsKeys: 'onglets',
    close: 'fermer',
    chest: 'Coffre commun',
    purse: 'Ta bourse',
    deposit: 'Verser',
    withdraw: 'Retirer',
    nothing: 'Choisis une case',
  },
  store: {
    label: 'Rangement',
    mine: 'Tes affaires',
    furniture: 'Le meuble',
    put: 'ranger',
    take: 'reprendre',
  },
} as const;

/** Remplit `{clé}` dans un texte. */
export function fill(text: string, values: Readonly<Record<string, string | number>>): string {
  return text.replace(/\{(\w+)\}/g, (whole, key: string) => {
    const value = values[key];
    return value === undefined ? whole : String(value);
  });
}

export function refusalText(key: string): string {
  return TEXTS.refusals[key] ?? TEXTS.refusalDefault;
}
