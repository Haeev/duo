/**
 * Réglages du noyau qui n'ont pas encore leur place dans `donnees/commun/reglages.json` (schéma
 * tenu par L0). Typés et réunis ici pour rester réglables; à déplacer dans `reglages.json` quand
 * L0 aura ajouté les champs (liste dans le compte rendu du lot L2).
 */
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
}

export const CORE_TUNING: CoreTuning = {
  moveDeadzone: 0.1,
  cornerNudgeStep: 0.05,
  cornerNudgeMax: 0.35,
  stuckSeconds: 1,
  freeCellRadius: 8,
  arrivalSpread: 0.8,
  arrivalSeconds: 1,
  aimDistanceWeight: 0.5,
  pickupClip: 'pickup',
  standUpGap: 0.05,
};
