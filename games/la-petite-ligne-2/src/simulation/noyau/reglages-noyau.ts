/**
 * Réglages du noyau. Leurs valeurs vivent désormais dans `donnees/commun/reglages.json`
 * (sections `movement`, `reach`, `gestures`, `travel`); ce fichier les expose sous leurs anciens
 * noms le temps que les appels lisent `content.settings` directement.
 */
import settings from '../../../donnees/commun/reglages.json';

export interface CoreTuning {
  /** En dessous, une commande de marche compte pour nulle. */
  readonly moveDeadzone: number;
  /** Coin de mur: décalage latéral essayé pour passer, pas et maximum (m). */
  readonly cornerNudgeStep: number;
  readonly cornerNudgeMax: number;
  /** Pris dans un obstacle et poussant sans avancer: dégagé après ce délai (s). */
  readonly stuckSeconds: number;
  /** Rayon de recherche d'une case libre (cases). */
  readonly freeCellRadius: number;
  /** Écart entre les deux joueurs à la descente du train (m). */
  readonly arrivalSpread: number;
  /** Durée de la phase `arrival` (descente sur le quai) avant de rendre la main (s). */
  readonly arrivalSeconds: number;
  /** Poids de la distance face à l'écart à l'axe dans le choix de la cible (0: l'axe seul). */
  readonly aimDistanceWeight: number;
  /** Animation du ramassage au sol. */
  readonly pickupClip: string;
  /** Marge entre un siège et le personnage qui se relève (m). */
  readonly standUpGap: number;
  /**
   * Personnages qui se chevauchent (deux joueurs, un joueur et un habitant): part du
   * chevauchement rendue par seconde. Poussée douce, jamais un mur: on finit toujours par passer.
   */
  readonly bodyPushPerSecond: number;
}

const { movement, reach, gestures, travel } = settings;

/** Valeurs lues dans `reglages.json` (schéma: `src/donnees/schemas/reglages.ts`), validées au chargement du contenu. */
export const CORE_TUNING: CoreTuning = {
  moveDeadzone: movement.deadzone,
  cornerNudgeStep: movement.cornerNudgeStep,
  cornerNudgeMax: movement.cornerNudgeMax,
  stuckSeconds: movement.stuckSeconds,
  freeCellRadius: movement.freeCellRadius,
  arrivalSpread: travel.arrivalSpread,
  arrivalSeconds: travel.arrivalSeconds,
  aimDistanceWeight: reach.aimDistanceWeight,
  pickupClip: gestures.pickupClip,
  standUpGap: movement.standUpGap,
  // En attente d'une place dans `reglages.json` (section `movement`, lot L0).
  bodyPushPerSecond: 10,
};
