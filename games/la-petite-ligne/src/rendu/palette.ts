/**
 * Texture palette du décor (artiste-3d): 16 x 16 cases de 4 pixels, une couleur
 * par case. Toute surface pointe le centre d'une case (UV), ce qui permet de
 * partager un seul matériau entre le décor, le terrain et les substituts.
 *
 * L'ordre des cases reprend `assets-src/modeles/palette.py` (liste `WORLD`);
 * le test `palette.test.ts` vérifie que les deux listes restent identiques.
 */

/** Cases par côté de la texture palette. */
export const PALETTE_GRID = 16;

/** Noms des cases, dans l'ordre de la texture (gauche à droite, haut en bas). */
export const PALETTE_CELLS = [
  'grass',
  'grass_light',
  'grass_dark',
  'grass_dry',
  'moss',
  'leaf_oak',
  'leaf_oak_light',
  'leaf_fir',
  'leaf_fir_light',
  'leaf_birch',
  'leaf_birch_light',
  'leaf_bush',
  'leaf_hazel',
  'leaf_crop',
  'leaf_crop_light',
  'leaf_carrot',
  'soil',
  'soil_tilled',
  'soil_tilled_light',
  'soil_wet',
  'soil_wet_light',
  'soil_tired',
  'path',
  'path_dark',
  'sand',
  'ballast',
  'ballast_dark',
  'bank',
  'cobble',
  'cobble_dark',
  'straw',
  'straw_dark',
  'stone',
  'stone_light',
  'stone_dark',
  'rock',
  'rock_light',
  'rock_dark',
  'lauze',
  'lauze_light',
  'lauze_dark',
  'tile',
  'tile_dark',
  'brick',
  'plaster_cream',
  'plaster_ochre',
  'plaster_rose',
  'plaster_shade',
  'wood_new',
  'wood',
  'wood_dark',
  'wood_old',
  'wood_old_dark',
  'bark',
  'bark_dark',
  'birch_bark',
  'birch_mark',
  'log_end',
  'log_ring',
  'paint_red',
  'paint_green',
  'paint_blue',
  'paint_cream',
  'paint_yellow',
  'water',
  'water_deep',
  'water_foam',
  'glass',
  'glass_lamp',
  'flame',
  'iron',
  'iron_light',
  'rust',
  'rail_steel',
  'brass',
  'black',
  'white_paint',
  'rope',
  'leather',
  'shadow',
  'loco_green',
  'loco_green_light',
  'loco_red',
  'coach_brown',
  'coach_cream',
  'van_wood',
  'awning_red',
  'awning_cream',
  'fabric_blue',
  'fabric_red',
  'fabric_yellow',
  'fabric_green',
  'fabric_cream',
  'fabric_rose',
  'paper',
  'paper_dark',
  'bread',
  'bread_crust',
  'soup',
  'ceramic',
  'ceramic_blue',
  'egg',
  'chicken_white',
  'chicken_russet',
  'chicken_black',
  'comb_red',
  'beak',
  'grain',
  'burlap',
  'burlap_dark',
  'tin',
  'tin_paint',
  'flower_red',
  'flower_yellow',
  'flower_white',
  'flower_blue',
  'flower_pink',
  'flower_violet',
  'flower_center',
  'radish',
  'radish_tip',
  'carrot',
  'lettuce',
  'lettuce_light',
  'potato',
  'strawberry',
  'seed',
  'sprout',
  'fish_back',
  'fish_silver',
  'fish_belly',
  'fish_olive',
  'trout_spot',
  'jay_blue',
  'jay_stripe',
  'feather_brown',
  'sepia',
  'sepia_dark',
  'lamp_shade',
  'radio_dial',
  'ember',
  'mattress',
  'mattress_stripe',
  'ivy',
] as const;

export type PaletteCell = (typeof PALETTE_CELLS)[number];

const CELL_INDEX = new Map<PaletteCell, number>(PALETTE_CELLS.map((name, index) => [name, index]));

/** Coordonnées UV (convention glTF et Three.js avec `flipY = false`) du centre d'une case. */
export interface PaletteUv {
  u: number;
  v: number;
}

const HALF_CELL = 0.5;

/** Centre de la case `name` dans la texture palette (UV de 0 à 1, v vers le bas). */
export function paletteUv(name: PaletteCell): PaletteUv {
  const index = CELL_INDEX.get(name) ?? 0;
  const column = index % PALETTE_GRID;
  const row = Math.floor(index / PALETTE_GRID);
  return { u: (column + HALF_CELL) / PALETTE_GRID, v: (row + HALF_CELL) / PALETTE_GRID };
}

/**
 * Texture des personnages: une rangée de 16 cases par personnage, mêmes rôles
 * de case pour tous (`CHAR_SLOTS` de `palette.py`). Les deux joueurs utilisent
 * la rangée 0, réécrite pour chacun (foulard, tenue).
 */
export const CHARACTER_SLOTS = [
  'skin',
  'skin_shade',
  'hair',
  'hair_dark',
  'eye',
  'mouth',
  'top',
  'top_trim',
  'bottom',
  'shoes',
  'scarf',
  'scarf_mark',
  'extra_a',
  'extra_b',
  'metal',
  'cheek',
] as const;

export type CharacterSlot = (typeof CHARACTER_SLOTS)[number];

/** Index de la colonne d'un rôle de case dans une rangée de personnage. */
export function characterSlotColumn(slot: CharacterSlot): number {
  return CHARACTER_SLOTS.indexOf(slot);
}

/** Pixels par case dans les textures palette (`CELL` de `palette.py`). */
export const PALETTE_CELL_PIXELS = 4;
