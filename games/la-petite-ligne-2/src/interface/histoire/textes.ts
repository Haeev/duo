/**
 * Textes de l'histoire à l'écran: fin de chapitre et consignes des scènes à deux (tutoiement).
 * Espace insécable (U+00A0) avant « : ; ! ? ». `{nom}`, `{n}`: valeurs remplies à
 * l'affichage (`fill`); la logique n'écrit aucun texte.
 */
export const HISTOIRE_TEXTS = {
  end: {
    eyebrow: 'Fin du chapitre',
    continue: 'Continuer',
    waiting: 'On attend {nom}',
    waitingHint: 'La suite arrive dès que {nom} a continué.',
    otherDone: 'a fini de lire',
    otherReading: 'lit encore',
    you: 'Toi',
    youDone: 'tu as fini de lire',
    youReading: 'tu lis',
  },
  scene: {
    label: 'Consigne',
    role: 'Ton rôle : {role}',
    you: 'Toi',
    /** Verbe du geste, à côté de la touche ou du point. */
    verb: {
      hold: 'Tiens enfoncée',
      holding: 'Continue, ne lâche pas',
      press: 'Appuie',
      pressed: 'Appuyé',
      stand: 'Va sur le point marqué',
      standing: 'Reste là',
    },
    away: 'à {n} m',
    state: { idle: 'Pas encore', active: 'En cours', done: 'Fait' },
    otherIdle: 'Pas encore',
    otherActive: 'En cours',
    otherDone: 'Fait',
    togetherWait: 'À faire en même temps que {nom}',
    togetherNow: 'Ensemble !',
    done: 'Fait',
    /** Messages courts après un événement de geste. */
    events: {
      lost: 'Pas en même temps : on reprend',
      expiredMe: 'Trop tôt : attends {nom}',
      expiredOther: '{nom} a appuyé trop tôt',
    },
    gauge: 'Avancement de {nom}',
    pin: 'Point à atteindre',
  },
} as const;
