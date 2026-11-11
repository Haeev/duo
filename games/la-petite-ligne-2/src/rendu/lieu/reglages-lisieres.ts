/**
 * Limites de sol adoucies (rendu encré des grands lieux): quels couples de natures de sol ont une
 * frontière lissée, et de combien elle peut s'écarter de la grille. Affaire d'affichage
 * seulement: collisions et cases franchissables restent celles de la grille, c'est pourquoi
 * l'écart est borné (`reach` + `ragged`, une trentaine de centimètres).
 *
 * Ajouter un couple à lisser: une entrée dans `pairs` (recette dans le README du dossier).
 */

/**
 * Sélecteur d'une nature de sol: son nom (`chemin`), `surface:<surface>` pour toutes les natures
 * de cette surface (`surface:herbe`), ou `*` pour toute nature au bord souple.
 */
export type EdgeSelector = string;

/** Un couple de natures dont la frontière commune est lissée (dans les deux sens). */
export interface EdgePair {
  readonly pourquoi: string;
  readonly a: readonly EdgeSelector[];
  readonly b: readonly EdgeSelector[];
}

/** Réglages des limites de sol adoucies (un lieu d'essai peut en passer d'autres). */
export interface EdgeSettings {
  /**
   * Couples lissés. Une frontière qui n'est dans aucun couple reste sur la grille, et un sol au
   * bord `rigide` (dallage, quai, rue, emprise de bâtiment: `reglages-relief.ts`) garde toujours
   * ses bords droits.
   */
  readonly pairs: readonly EdgePair[];
  /** Natures au bord souple qui gardent pourtant leurs bords droits. */
  readonly straight: readonly string[];
  /**
   * Écart maximal (m) entre la frontière lissée et la grille, ondulation comprise (moins d'une
   * demi-case). Le nuanceur y ajoute le tremblé du trait: `ragged` (m) au plus sur chaque axe.
   * Au pire, `reach + ragged x 1,41`: 0,32 m.
   */
  readonly reach: number;
  readonly ragged: number;
  /** Noeuds du treillis par mètre (1 à 4): à 2, un coin de case s'arrondit au lieu de se couper. */
  readonly steps: number;
  /** Passes de lissage: chaque noeud de frontière va vers le milieu de ses deux voisins. */
  readonly passes: number;
  /**
   * Ondulations tirées de la place, de la plus lente à la plus serrée: écart (m) et pas du bruit
   * (m). Une frontière droite ne l'est jamais tout à fait. Puis `finish` passes de lissage lui
   * rendent sa rondeur.
   */
  readonly waves: readonly { readonly height: number; readonly span: number }[];
  readonly finish: number;
  /** Part du décalage reprise par les noeuds voisins de la frontière, puis par les suivants. */
  readonly carry: readonly number[];
  /** Pleine échelle du décalage rangé sur un octet (m): au moins `reach`. */
  readonly span: number;
}

export const EDGE_SETTINGS: EdgeSettings = {
  pairs: [
    {
      pourquoi: 'une berge est rongée par le courant: ni angle droit ni marche',
      a: ['surface:eau'],
      b: ['*'],
    },
    {
      pourquoi:
        'un chemin, une cour de terre, une grève de galets: leur bord s’use et mord sur l’herbe',
      a: ['surface:terre', 'surface:sable', 'surface:gravier'],
      b: ['surface:herbe', 'surface:terre', 'surface:sable', 'surface:gravier'],
    },
    {
      pourquoi: 'deux herbes (pré, friche, lisière) se mêlent sans ligne tirée au cordeau',
      a: ['surface:herbe'],
      b: ['surface:herbe'],
    },
  ],
  // La voie: un lit de ballast réglé, parallèle aux rails.
  straight: ['voie'],
  reach: 0.21,
  ragged: 0.08,
  steps: 2,
  passes: 40,
  waves: [{ height: 0.17, span: 1.5 }],
  finish: 1,
  carry: [0.9, 0.6, 0.3],
  span: 0.3,
};
