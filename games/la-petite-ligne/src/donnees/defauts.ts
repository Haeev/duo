/**
 * Valeurs de ressenti que `reglages.json` ne fixe pas (encore). Une clé
 * `feel` dans `reglages.json` remplace chaque valeur une à une; `ranges`
 * complète de même les portées absentes. À reprendre par le game designer.
 */
import type {
  BenchSettings,
  FeelSettings,
  MemorySettings,
  MomentSettings,
  SecretSettings,
} from './types';

/** Moments rares (tour 6): valeurs de la conception, section 3.2; `reglages.moments` les remplace. */
export const DEFAULT_MOMENTS: MomentSettings = {
  dailyChance: 0.5,
  maxPerDay: 1,
  cooldownDays: 7,
  firstAmbientDay: 2,
  noAmbientOnTrainDays: true,
  stillSpeed: 0.05,
  noticeRadius: 12,
  heartBonus: 10,
  musicDuckDb: -6,
  musicDuckInSeconds: 0.5,
  musicDuckOutSeconds: 2,
  firstHint: 'p2',
  maxSyncGapSeconds: 0.5,
  holdRange: 1.2,
  tiers: ['P0'],
};

/** Informations propres (R16): valeurs de la conception, section 3.2; `reglages.secrets` les remplace. */
export const DEFAULT_SECRETS: SecretSettings = {
  firstInformed: 'p1',
  nudgeAfterErrors: 2,
  firstTryHeart: 5,
  henChoiceRange: 1.5,
  henChoiceKeepOpen: 3,
  hideFromGuestSnapshot: false,
  knownHensFlag: 'hen_names_known',
};

/** Souvenirs (tour 7, section 2.4): saisons de 21 jours (script `moments_rares.py`), moins de 1,5 Kio. */
export const DEFAULT_MEMORIES: MemorySettings = {
  seasonDays: 21,
  seasonsPerYear: 4,
  maxBytes: 1536,
};

export const DEFAULT_FEEL: FeelSettings = {
  // Durées des gestes simples (s), avant le doublement à endurance nulle.
  actionSeconds: {
    till: 0.5,
    sow: 0.35,
    water: 0.45,
    harvest: 0.35,
    chop: 0.6,
    dig: 0.5,
    pickup: 0.3,
    feed: 0.6,
    refill: 0.8,
    // « Le personnage mange 2 s » (tableau 5.2 du cahier).
    eat: 2,
    give: 0.4,
  },
  trainSlideSeconds: 6,
  pointRadius: 2.5,
  beamGrabRange: 2,
  beamDropRadius: 1.5,
  villagerSpeed: 1.6,
  henSpeed: 0.5,
  alreadyTakenSeconds: 1.5,
  // Gauntlet, ressenti (tour 2): un appui pendant un geste n'est pas perdu; Espace tenu bêche la rangée.
  inputBufferSeconds: 0.3,
  // Gauntlet, contenu (tour 3): les répliques quotidiennes de priorité 5 et plus sont datées.
  dailyStoryPriority: 5,
  heldRepeatSeconds: 0.1,
  notificationsKept: 12,
  trainWarningMinutes: 60,
  // GE-07: l'épingle reste 15 s.
  pinSeconds: 15,
  // CN-04: goujon commun, chevesne peu commun, truite rare.
  fishWeights: { gudgeon: 6, chub: 3, trout: 1 },
};

/** Bancs: deux places à 0,5 m du milieu, lever à 0,85 m devant l'assise (hors de l'emprise de 1 m). */
export const DEFAULT_BENCHES: BenchSettings = {
  slots: [-0.5, 0.5],
  seatForward: 0,
  standForward: 0.85,
  sitRange: 1.4,
  villagerReach: 0.8,
};

export const DEFAULT_RANGES = {
  eatTogether: 3,
  stayAt: 3,
} as const;
