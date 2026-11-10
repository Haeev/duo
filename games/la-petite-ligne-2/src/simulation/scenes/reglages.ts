/** Réglages du placement des acteurs d'une scène (m). */
export interface SceneStaging {
  /** Distance de conversation: un habitant qui rejoint les joueurs s'arrête à cette distance d'eux. */
  readonly talkDistance: number;
  /** Écart minimal entre un acteur et chaque joueur (deux corps ne se recouvrent jamais). */
  readonly playerClearance: number;
  /** Rayon du corps d'un acteur, pour ne pas le poser dans un mur ou un meuble. */
  readonly bodyRadius: number;
  /** Directions essayées autour des joueurs quand la place en face est prise. */
  readonly steps: number;
  /**
   * Durée visée d'une marche de scène (s): au-delà, l'habitant presse le pas (règle de ressenti:
   * pas de longue attente sans rien à lire; la caméra de la scène le suit pendant ce temps).
   */
  readonly walkBudgetSeconds: number;
  /** Pas pressé le plus vif (m/s), sous la course franche du rendu (`runTo`). */
  readonly hurrySpeed: number;
}

export const SCENE_STAGING: SceneStaging = {
  talkDistance: 1.7,
  playerClearance: 1.2,
  bodyRadius: 0.3,
  steps: 12,
  walkBudgetSeconds: 4,
  hurrySpeed: 4.5,
};
