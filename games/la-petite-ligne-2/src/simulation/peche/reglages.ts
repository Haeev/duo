/**
 * Valeurs de la pêche, réglables par le game designer (conception: `docs/jeux/jeu-1/refonte/peche.md`).
 * Le caractère de chaque poisson est dans sa fiche de prise (bloc `fish`).
 */
export const FISHING = {
  /** Clé de la collection des poissons (`progress.collections`) et préfixe des records en mémoire. */
  collection: 'fish',
  /** Ombres renouvelées toutes les N minutes de jeu. */
  waveMinutes: 30,
  /** Chance qu'une place d'ombre soit occupée à une vague. */
  shadowPresence: 0.8,
  /** Poids de tirage selon la rareté de la prise. */
  rarityWeight: { common: 1, uncommon: 0.45, rare: 0.15 },
  /** Lancer: distance au bord du pêcheur (m), aller-retour du repère (s), angle de visée (rad). */
  cast: { min: 1.5, max: 6, sweepSeconds: 1.6, turnMax: 0.7, turnPerSecond: 1.2 },
  /** Le coin doit être à moins de N m devant le pêcheur pour sortir la canne. */
  reach: 3,
  /** Une ombre à moins de N m du bouchon vient vite; au-delà, la plus proche vient plus lentement. */
  biteRadius: 1.6,
  /** Approche d'une ombre (s): base, plus N s par mètre au-delà du rayon de touche, plafond. */
  approach: { base: 1.5, perMeter: 0.8, max: 9 },
  /** Touche: écart entre deux creux (s), durée d'une feinte et du plongeon (fenêtre du ferrage, s). */
  bite: { gapMin: 0.7, gapMax: 1.6, feintSeconds: 0.25, strikeWindow: 0.55, maxFeintsSeen: 4 },
  /** Combat: pas fixe (s), durée maximale (s, au-delà le poisson se décroche). */
  fight: {
    dt: 0.05,
    maxSeconds: 40,
    /** Demi-largeur du secteur vert, aiguille de -1 à 1. */
    zoneHalf: 0.3,
    /** Hors du vert, cumul avant la casse (s), et résorption par seconde passée dans le vert. */
    escapeSeconds: 1.5,
    recoverPerSecond: 0.6,
    /** Physique de l'aiguille. */
    pullGain: 5,
    steerGain: 5.5,
    damping: 3.2,
    centering: 1.2,
    jitter: 1.4,
    /** Mouliner pendant un élan tend la ligne: accélération en plus vers le bord. */
    reelStrain: 3,
    /** Avance du moulinet: fraction de la distance par seconde, au souffle et pendant un élan. */
    reelRest: 0.1,
    reelPull: 0.03,
    /** Le poisson reprend du fil pendant un élan non contré. */
    slack: 0.02,
    /** Un poisson épuisé fait des élans plus courts (part gardée à fatigue totale). */
    tiredPull: 0.35,
    /** Distance de départ (0: au bord, 1: au bouchon). */
    startProgress: 0,
  },
  /** Aides: secteur vert selon l'état de la canne (`sac/outils.ts`). */
  rod: { base: 1, sharp: 1.3, blunt: 0.85 },
  /** Usure de la canne améliorée: une prise. */
  wearPerCatch: 1,
  /** Qualité: étoiles (1 à 3). Une de plus pour un combat propre (moins de N s hors du vert), une avec l'épuisette. */
  quality: { cleanSeconds: 0.75, max: 3 },
  /** L'autre joueur à moins de N m à la prise tend l'épuisette. */
  together: { radius: 4 },
  /**
   * Pêche à deux (prise unique `crew: "pair"`, `a-deux.ts`). À la canne on sent ses élans (côté,
   * force) sans la voir et l'on tient la touche; à l'épuisette on voit l'ombre remonter sans rien
   * sentir et l'on plonge. Rien n'est perdu à l'échec: elle repart, on recommence.
   */
  pair: {
    /** L'épuisette doit être à moins de N m de la canne (au lancer et pendant le combat). */
    radius: 7,
    /** Secondes à tenir la canne pendant ses élans pour la fatiguer. */
    holdSeconds: 3,
    /** Tenir pendant qu'elle souffle la brusque: elle reprend N s de forces par seconde. */
    restPenalty: 0.5,
    /** Avant la fatigue: élans (côté tiré au hasard) et souffles, durées en s. */
    pull: { min: 1.3, max: 2.2 },
    rest: { min: 0.9, max: 1.5 },
    /** Fatiguée: elle plonge (on sent le côté), puis remonte de ce côté (on la voit), en s. */
    dive: { min: 1.2, max: 2 },
    rise: 1.8,
    /** Bulles avant la remontée: l'épuisette a le temps de se placer (s). */
    warn: 0.7,
    /** Plongeon raté: part du temps tenu qu'on garde (elle replonge, un peu moins fatiguée). */
    missKeep: 0.5,
    /** Au-delà, elle casse la ligne et repart (s depuis la touche). */
    maxSeconds: 75,
    /** Épuisette d'un couloir à l'autre (gauche, milieu, droite), chez le joueur (s). */
    laneSeconds: 0.25,
  },
  /** Une taille au-dessus de cette part de la plage fait un « gros poisson » (vibration d'écran). */
  bigShare: 0.85,
  /** Journal des touches: longueur maximale (caractères), pour tenir dans un message de l'invité. */
  logMax: 1200,
  /** Marge de l'hôte sur la durée d'une pêche (s): un résultat arrivé trop tôt est refusé. */
  timingSlack: 1,
} as const;

export type FishingSettings = typeof FISHING;
