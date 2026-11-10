/**
 * Réglages des lieux (verrous, portes, zones) qui attendent leur place dans `reglages.json`.
 * Valeurs de jeu: le game designer les règle ici, jamais dans la logique.
 */
export interface PlacesTuning {
  /** Marge autour de la case d'une porte où le corps la « touche » (m, en plus du rayon du corps). */
  readonly doorReach: number;
  /** À l'arrivée, distance entre le centre de la case de la porte et le joueur, vers `facing` (m). */
  readonly arriveOffset: number;
  /**
   * Part des cases libres d'une zone qu'il faut pouvoir rejoindre à pied pour la dire ouverte. Un
   * chemin ouvert qui mord sur une zone voisine (le ponton sur la rivière) ne l'ouvre donc pas.
   */
  readonly zoneOpenShare: number;
}

export const PLACES: PlacesTuning = {
  doorReach: 0.15,
  arriveOffset: 1,
  zoneOpenShare: 0.5,
};
