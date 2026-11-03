/**
 * Apparence des deux joueurs: pièces du modèle (`personnages.glb`) et
 * couleurs écrites dans leur rangée de la texture des personnages. Les
 * couleurs reprennent `assets-src/modeles/palette.py` (`PLAYER_PRESETS` et les
 * rangées `player_a`, `player_b`). Depuis la 0.12, les vêtements viennent de
 * `vetements.json` (`habillage.ts`) et les joueurs n'ont plus de foulard: la
 * couleur du profil Duo va au badge brodé; les symboles servent aux signes.
 */
import type { CharacterId } from '../etat/types';
import type { CharacterSlot } from './palette';

/**
 * Coiffures (index `appearance.hair`, tour 10, conception 2.1, dans l'ordre de sa table): 0 à 2
 * les trois d'avant, 3 à 11 les nouvelles de la création, 12 à 14 celles du salon seulement.
 */
export const HAIR_MESHES = [
  'player_hair_short',
  'player_hair_bob',
  'player_hair_bun',
  'player_hair_crop',
  'player_hair_curls',
  'player_hair_ponytail',
  'player_hair_braid',
  'player_hair_pigtails',
  'player_hair_wavy',
  'player_hair_long',
  'player_hair_fringe',
  'player_hair_quiff',
  'player_hair_cloud',
  'player_hair_crown',
  'player_hair_bob_long',
] as const;

/**
 * Coupes qui s'enfoncent dans l'oreiller au coucher (mesure de l'artiste, `coiffures_couche.py`:
 * nuage -10 cm, long et queue de cheval -8 cm, tresse -7 cm sous la coupe courte): le rendu les
 * aplatit derrière la tête pendant le sommeil (`personnages.ts`).
 */
export const HAIR_FLATTENED_ASLEEP: ReadonlySet<string> = new Set([
  'player_hair_cloud',
  'player_hair_long',
  'player_hair_ponytail',
  'player_hair_braid',
]);

/** Barbe ou moustache (index `appearance.beard`): 0 aucune, puis barbe courte, fournie, moustache. */
export const BEARD_MESHES = [null, 'player_beard_short', 'player_beard_full', 'player_mustache'] as const;

/**
 * Couleurs des cheveux (index `appearance.hairColor`, conception 2.2): noir, brun, châtain, auburn,
 * roux, blond paille, gris, blanc (`PLAYER_PRESETS["hair_colors"]` de `palette.py`). La barbe et la
 * moustache prennent la couleur des cheveux.
 */
export const HAIR_COLORS: readonly { hair: string; hair_dark: string }[] = [
  { hair: '#2b2522', hair_dark: '#1a1614' },
  { hair: '#4f3626', hair_dark: '#36251a' },
  { hair: '#7a5236', hair_dark: '#563823' },
  { hair: '#8e3f28', hair_dark: '#652b1b' },
  { hair: '#c2622e', hair_dark: '#93461e' },
  { hair: '#d8b46a', hair_dark: '#b08a48' },
  { hair: '#9a958e', hair_dark: '#75706a' },
  { hair: '#e8e4dc', hair_dark: '#c4beb4' },
];

/** Peau et cheveux par défaut de chaque personnage (la démo ne les fait pas choisir). */
export const BODY_COLORS: Readonly<Record<CharacterId, Partial<Record<CharacterSlot, string>>>> = {
  p1: {
    skin: '#e8be9a',
    skin_shade: '#d29d7b',
    hair: '#6b4a33',
    hair_dark: '#4a3324',
    cheek: '#e99a8e',
  },
  p2: {
    skin: '#b9825c',
    skin_shade: '#9c6646',
    hair: '#2e2622',
    hair_dark: '#1e1916',
    cheek: '#d9857a',
  },
};

/** Symbole du profil Duo et sa couleur (identité « Étoile double »): forme du foulard. */
export const SCARF_SYMBOLS: readonly { mesh: string; color: string }[] = [
  { mesh: 'player_scarf_orb', color: '#5ce1e6' },
  { mesh: 'player_scarf_crescent', color: '#8d6cff' },
  { mesh: 'player_scarf_star', color: '#d4f27a' },
  { mesh: 'player_scarf_sun', color: '#fc663f' },
  { mesh: 'player_scarf_planet', color: '#e787b1' },
  { mesh: 'player_scarf_comet', color: '#22b07d' },
];

/** Marque du symbole sur le foulard (couleur « on » de l'identité). */
export const SCARF_MARK = '#0e1126';

const HEX_RADIX = 16;
const RED_SHIFT = 16;
const GREEN_SHIFT = 8;
const BYTE_MASK = 0xff;

function rgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.replace('#', ''), HEX_RADIX);
  if (Number.isNaN(value)) {
    return [0, 0, 0];
  }
  return [(value >> RED_SHIFT) & BYTE_MASK, (value >> GREEN_SHIFT) & BYTE_MASK, value & BYTE_MASK];
}

/** Forme du foulard la plus proche de la couleur du profil. */
export function scarfMeshFor(color: string): string {
  const [r, g, b] = rgb(color);
  let best = SCARF_SYMBOLS[0]?.mesh ?? 'player_scarf_orb';
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const symbol of SCARF_SYMBOLS) {
    const [sr, sg, sb] = rgb(symbol.color);
    const distance = (r - sr) ** 2 + (g - sg) ** 2 + (b - sb) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = symbol.mesh;
    }
  }
  return best;
}

/** Couleur valide `#rrggbb`, sinon celle du premier symbole. */
export function safeColor(color: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : (SCARF_SYMBOLS[0]?.color ?? '#ffffff');
}
