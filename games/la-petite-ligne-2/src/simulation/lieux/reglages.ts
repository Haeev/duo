/**
 * Réglages des lieux (verrous, portes, zones) qui attendent leur place dans `reglages.json`.
 * Valeurs de jeu: le game designer les règle ici, jamais dans la logique.
 */
export interface PlacesTuning {
  /**
   * Franchir un seuil (`donnees/seuils.ts`): le corps touche le mur de la porte à `sillReach` m
   * près (en plus de son rayon), son centre dans la largeur du passage, et il avance vers elle à
   * moins de `sillHeadingDeg` degrés de son axe. On passe donc en atteignant la porte, pas avant.
   */
  readonly sillReach: number;
  readonly sillHeadingDeg: number;
  /** Porte au sol (escalier, trappe): le centre du corps à moins de cette distance de son milieu (m). */
  readonly floorDoorReach: number;
  /** À l'arrivée, distance du seuil au joueur, vers la pièce: devant la porte, sans la toucher (m). */
  readonly arriveOffset: number;
  /** À l'arrivée par une porte au sol, distance de son milieu au joueur (m): hors de sa case. */
  readonly floorArriveOffset: number;
  /**
   * Après un passage, la direction encore tenue ne fait pas repasser une porte: il faut l'avoir
   * relâchée, ou s'être éloigné d'autant (m) du point d'arrivée.
   */
  readonly rearmDistance: number;
  /**
   * Part des cases libres d'une zone qu'il faut pouvoir rejoindre à pied pour la dire ouverte. Un
   * chemin ouvert qui mord sur une zone voisine (le ponton sur la rivière) ne l'ouvre donc pas.
   */
  readonly zoneOpenShare: number;
}

export const PLACES: PlacesTuning = {
  sillReach: 0.1,
  sillHeadingDeg: 60,
  floorDoorReach: 0.3,
  arriveOffset: 0.6,
  floorArriveOffset: 1,
  rearmDistance: 1.2,
  zoneOpenShare: 0.5,
};
