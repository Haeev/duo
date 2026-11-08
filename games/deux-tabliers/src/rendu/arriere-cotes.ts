/**
 * Cotes de la réserve et de la cour d'Ormeval (plan `village-arrivee`, `donnees/adresses/village.json`),
 * en mètres, x et z du plan. La coque cuite s'arrête au refend (z 6,70): `rendu/arriere.ts` construit
 * le reste. `tests/arriere.test.ts` vérifie que ces cotes suivent le plan.
 */

/** Rectangle du plan: x, z, largeur (selon x), profondeur (selon z). */
export type PlanRect = readonly [number, number, number, number];

/** Hauteur sous plafond et dessous des solives, comme la salle (`assets-src/modeles/lib/scene_coque.py`). */
export const CEILING = 2.8;
export const JOIST_BOTTOM = 2.65;
/** Solives est-ouest tous les 62 cm, comme dans la salle: elles portent le plancher du logement. */
export const JOIST_STEP = 0.62;

/** Réserve (`floor-4`): sol carrelé entre la cloison de la pièce du fond et le mur est. */
export const RESERVE: PlanRect = [8.1, 3.5, 2.9, 3.2];
/** Porte de l'arrière-comptoir (`door-5`), percée dans le refend; ouvre vers la réserve, gonds à l'est. */
export const DOOR_BACKBAR: PlanRect = [10.0, 6.7, 0.9, 0.4];
/** Porte de la cour (`door-2`), deux vantaux qui ouvrent vers la réserve. */
export const DOOR_YARD: PlanRect = [9.3, 3.0, 1.2, 0.5];
/** Fenêtre de la pièce du fond sur la cour (`window-1`): appui 0,90, haut 2,40. */
export const WINDOW_FOND: PlanRect = [6.6, 3.0, 1.1, 0.5];
export const WINDOW_FOND_SILL = 0.9;
export const WINDOW_FOND_TOP = 2.4;
export const DOOR_HEIGHT = 2.1;
/** Tableau électrique (`marker-5`), contre le mur est de la réserve. */
export const PANEL_AT: readonly [number, number] = [10.8, 3.8];

/** Cour (`ground-1`), fermée par le mur mitoyen ouest, la clôture du fond et le mur du portail. */
export const YARD: PlanRect = [2.1, 0.0, 9.4, 3.0];
/** Mur mitoyen ouest (`partition-1`). */
export const YARD_WALL_WEST: PlanRect = [1.9, 0.0, 0.2, 3.0];
/** Mur de la ruelle (`partition-2`, `partition-3`) et son portail de livraison fermé (`door-1`). */
export const YARD_WALL_EAST: PlanRect = [11.5, 0.0, 0.2, 3.0];
export const GATE: PlanRect = [11.5, 0.6, 0.2, 1.6];
/**
 * Hauteur des murs de la cour: 2,60 m, comme la clôture du fond de la pièce du fond
 * (`shell_village_ext_fond.glb`), et au-dessus du portail de 2,10 m qu'ils encadrent.
 */
export const YARD_WALL_HEIGHT = 2.6;
/** Clôture du fond: au bord du cadre du plan (z 0), que les collisions ferment déjà. */
export const YARD_BACK_THICKNESS = 0.3;
/** Figuier (`tree-2`) et poubelles (`fixture-2`). */
export const FIG: readonly [number, number] = [3.2, 1.2];
export const BINS: PlanRect = [6.4, 0.3, 1.8, 0.7];
export const BINS_HEIGHT = 1.1;

/**
 * Façade sur cour: deux niveaux (la salle, le logement de Simone au-dessus). La toiture et sa
 * gouttière sont dans le modèle de la place (`shell_village_place.glb`): avant-toit à 6,25 m au
 * bord (z 2,65), 6,48 m au droit de la façade. La façade monte jusque sous la toiture.
 */
export const FACADE_Z = 3.0;
export const EAVE_HEIGHT = 6.5;

/**
 * Chaperon du mur qui ferme la ruelle (modèle de la place): il déborde de 50 cm au-dessus du coin
 * de la cour (x 11,00 à 11,50), sans rien dessous. Ses sommets ouest sont ramenés au nu du mur
 * de la ruelle (2 cm de débord). Boîte x, y, z (min puis max) et x d'arrivée.
 */
export const PLACE_RUELLE_COPING = {
  min: [10.99, 3.39, 2.49],
  max: [11.01, 3.66, 2.71],
  x: 11.48,
} as const;

/**
 * Vantail de la porte de l'arrière-comptoir dans la coque cuite (cuit fermé, on le traverse):
 * ses sommets sont repliés, la réserve dessine le vantail ouvert. Boîte x, y, z (min puis max).
 * Vérifié sur le GLB: 284 sommets, tous du vantail (panneaux et bouton compris), aucun triangle à
 * cheval.
 */
export const BAKED_DOOR_LEAF = {
  min: [9.99, -0.01, 6.97],
  max: [10.91, 2.115, 7.095],
} as const;
