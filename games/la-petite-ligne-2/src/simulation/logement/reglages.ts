/**
 * Réglages du logement et du mode déco, typés et réunis ici pour le game designer. Ils migreront
 * dans `donnees/commun/reglages.json` quand L0 aura ajouté la section, sans changer les systèmes.
 */
export interface HousingTuning {
  /** Pas de la grille de pose (m): la position d'un meuble s'aimante à ce pas. */
  readonly gridStep: number;
  /** Carré laissé libre autour du point de chaque porte (demi-côté, m): 0,75 m de seuil dans la pièce derrière un mur de 1 m. */
  readonly doorClearance: number;
  /** Distance (m) à la pièce pour y apporter, payer ou travailler. */
  readonly reach: number;
  /** Vitesse du travail à deux (1 = un joueur seul). */
  readonly duoWorkRate: number;
  /** Au-delà de cette vitesse au sol (m/s), le joueur a quitté le chantier. */
  readonly workStopSpeed: number;
  /** Clip joué pendant le travail. */
  readonly workClip: string;
  readonly comfort: {
    /** Confort par pièce restaurée. */
    readonly perRoom: number;
    /** Confort d'un meuble posable sans section `deco`. */
    readonly defaultProp: number;
    /** Exemplaires d'un même meuble comptés en entier; les suivants comptent pour moitié. */
    readonly fullCopies: number;
    /** Seuils des paliers 1, 2, 3...: le palier 0 est la maison nue, jamais une faute. */
    readonly tiers: readonly number[];
    /** Points de sommeil en plus au réveil, par palier, dans un lit du logement. */
    readonly sleepBonusPerLevel: number;
  };
  /** Cadence d'envoi du meuble en main pendant le glissé (ms): l'autre voit le geste. */
  readonly dragSendMs: number;
}

export const HOUSING_TUNING: HousingTuning = {
  gridStep: 0.5,
  doorClearance: 1.25,
  reach: 2,
  duoWorkRate: 2.5,
  workStopSpeed: 0.2,
  workClip: 'hammer',
  comfort: {
    perRoom: 2,
    defaultProp: 1,
    fullCopies: 2,
    tiers: [8, 18, 32, 50],
    sleepBonusPerLevel: 4,
  },
  dragSendMs: 100,
};
