/** Textes de la musique jouée (cahier de fanfare, partition, mot de la fin). Tutoiement. */
export const MUSIC_TEXTS = {
  title: 'Cahier de fanfare',
  duoWith: 'En duo avec {nom}',
  duoHint: '{nom} peut te rejoindre: instrument en main, au même endroit.',
  unknown: 'Air pas encore appris',
  locked: 'Il faut un meilleur instrument',
  empty: 'Ton cahier est vide: les airs s’apprennent au fil de l’histoire.',
  oneVoice: 'à l’unisson',
  twoVoices: 'à deux voix',
  difficulty: ['', 'tranquille', 'entraînant', 'vif'],
  choose: 'choisir',
  play: 'jouer',
  leave: 'ranger l’instrument',
  close: 'fermer',
  wait: '{nom} choisit l’air…',
  waitHint: 'Tu joueras la seconde voix.',
  ready: 'Prêt ?',
  page: 'Ligne {n} sur {total}',
  partner: 'La voix de {nom}',
  partnerQuiet: '{nom} reprend son souffle',
  /** Mot bref après une frappe. */
  verdicts: { just: 'Juste', early: 'Un peu tôt', late: 'Un peu tard', false: 'Couac', missed: '' },
  /** Mot gentil de la fin, du plus timide au plus beau: jamais d'échec. */
  ratings: ['C’était de bon cœur', 'Joli !', 'Bravo !', 'Magnifique !'],
  ratingLines: [
    'L’air est allé au bout, et ça compte. La prochaine sera plus sûre.',
    'Ça se reconnaît, et ça fait plaisir à entendre.',
    'Un bel air, bien mené.',
    'Pas une note de travers. On en redemande !',
  ],
  together: 'Réussi ensemble !',
  first: 'Premier passage de cet air',
  tally: { just: 'justes', near: 'presque', false: 'couacs', missed: 'envolées' },
  you: 'Toi',
  hat: 'Dans le chapeau: {somme}',
  hatDone: 'Le chapeau a déjà tourné aujourd’hui.',
  listeners: ['Personne n’écoutait: joué pour le plaisir.', '1 auditeur', '{n} auditeurs'],
  friends: ['', '1 amitié qui monte', '{n} amitiés qui montent'],
  /** Accord de l'instrument (cahier 4.5), le mot du cahier de fanfare et du sac. */
  tune: { just: 'juste', slight: 'un peu faux', off: 'faux' },
  /** À l'ouverture du cahier, l'instrument pas juste: où l'accorder. */
  tuneWhere: {
    slight:
      'Ton instrument commence à pencher. Armand, l’instituteur, l’accorde sans rien demander, ou toi-même avec un diapason.',
    off: 'Ton instrument sonne faux. Armand, l’instituteur, l’accorde sans rien demander, ou toi-même avec un diapason.',
  },
  tuneKey: 'accorder au diapason',
  tuneTitle: 'Accorder au diapason',
  tuneHelp:
    'Tiens {touche}: ta note glisse vers celle du diapason. Le battement ralentit, puis se tait: lâche à ce moment-là.',
  tunePair: '{nom} tient le diapason: à deux, on s’entend mieux.',
  tuneHold: 'tenir la note',
  tuneBack: 'revenir au cahier',
  tuneCalm: 'Ça ne bat presque plus.',
  tuneBeat: 'Ça bat.',
  tuneTuned: 'C’est juste !',
  tuneAgain: 'Ça bat encore un peu. Reprends, rien n’est perdu.',
  /** Le mot des auditeurs quand l'instrument n'était pas juste: gentil et drôle, jamais un reproche. */
  tuneListeners: {
    slight: [
      'Quelqu’un a murmuré: « C’est joli. Un peu penché, mais joli. »',
      '« L’air a pris un petit coup de froid », a souri quelqu’un.',
    ],
    off: [
      'On a souri: « Ça grince un peu, mais ça vient du cœur ! »',
      'Quelqu’un a ri tout bas: « Même les grenouilles du lavoir sont plus justes. Mais moins drôles. »',
    ],
  },
  tuneAlone: 'Même les moineaux ont penché la tête.',
  tuneAfter: 'Un petit accord chez Armand, et ça repartira.',
} as const;

export function fillText(text: string, values: Readonly<Record<string, string | number>>): string {
  return text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));
}
