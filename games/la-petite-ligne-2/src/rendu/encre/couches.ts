/**
 * Rendu encré: ce que les géométries, les textures et le nuanceur ont en commun. Les couches de
 * la texture de traits, les natures de face lues par le nuanceur, et les numéros de pièce et de
 * morceau (un octet chacun: 6 bits de numéro, 2 bits de classe de taille) dont la passe de
 * contour tire le trait et son rang. Logique pure, sans Three.js.
 */

export type Rgb = readonly [number, number, number];

/** Couleur d'affichage (sRGB, de 0 à 1) telle qu'écrite: le rendu encré peint en valeurs d'écran. */
export function hex(color: string): Rgb {
  const value = Number.parseInt(color.slice(1), 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

/** Couches de la texture de traits (voir `textures.ts`), dans l'ordre du tableau de textures. */
export const LAYER = {
  plain: 0,
  wood: 1,
  wall: 2,
  slab: 3,
  roof: 4,
  leaf: 5,
  bark: 6,
  hatch: 7,
  grass: 8,
  dirt: 9,
  ballast: 10,
  /** Une seule planche: veines et noeuds, sans joints (les planches sont alors des volumes). */
  grain: 11,
  /** Une seule pierre ou dalle: éclats, fissures, piqûres, sans appareil. */
  face: 12,
  /**
   * Un carreau ou une dalle d'intérieur posés en volume: quelques piqûres, une fêlure rare,
   * aucune tache (le damier, les joints et les teintes sont dans la géométrie).
   */
  tile: 13,
} as const;
export const LAYER_COUNT = 14;
export type LayerName = keyof typeof LAYER;

/** Côté d'un carreau de texture, en mètres: 512 points pour 4 m, un trait de 3 points fait 2,3 cm. */
export const TILE_METRES = 4;

/**
 * Nature d'une face, lue par le nuanceur: vitre (éclairée de l'intérieur ou par le ciel), flamme,
 * feuillage (bord d'ombre dentelé, noir plein dessous, vent), tige souple (vent seulement), sol
 * (teinte et matière lues dans la carte du sol du lieu), eau. Ajouter `SWAP` tourne les traits de
 * la couche d'un quart de tour (rangs de tuiles le long du faîtage, fil d'une planche).
 */
export const KIND = {
  none: 0,
  window: 1,
  flame: 2,
  leaf: 3,
  stem: 4,
  ground: 5,
  water: 6,
} as const;
export const SWAP = 8;

/** Numéro de morceau « peau lisse »: la passe de contour n'y trace aucune arête (visage). */
export const SLEEK_PART = 63;

/** Classe de taille d'un objet ou d'un morceau, d'après la diagonale de sa boîte (m). */
export function sizeClass(diagonal: number): number {
  if (diagonal >= 2.5) return 0;
  if (diagonal >= 1) return 1;
  return diagonal >= 0.4 ? 2 : 3;
}

/** Code d'une pièce ou d'un morceau: numéro de 1 à 62 tiré de `index`, classe de taille dessus. */
export function inkCode(index: number, diagonal: number): number {
  return (((index % 62) + 62) % 62) + 1 + 64 * sizeClass(diagonal);
}
