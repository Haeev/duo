/**
 * Valeurs de ressenti que `reglages.json` ne fixe pas (encore). Une clé
 * `feel` dans `reglages.json` remplace chaque valeur une à une; `ranges`
 * complète de même les portées absentes. À reprendre par le game designer.
 */
import type { FeelSettings } from './types';

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
  notificationsKept: 12,
  trainWarningMinutes: 60,
  // GE-07: l'épingle reste 15 s.
  pinSeconds: 15,
};

export const DEFAULT_RANGES = {
  eatTogether: 3,
  stayAt: 3,
} as const;
