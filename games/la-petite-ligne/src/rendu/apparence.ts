/**
 * Apparence des deux joueurs: pièces du modèle (`personnages.glb`) et
 * couleurs écrites dans leur rangée de la texture des personnages. Les
 * couleurs reprennent `assets-src/modeles/palette.py` (`PLAYER_PRESETS` et les
 * rangées `player_a`, `player_b`); le foulard prend la couleur du profil Duo.
 */
import type { CharacterId } from '../etat/types';
import type { CharacterSlot } from './palette';

/** Coiffures proposées à la création (index `appearance.hair`). */
export const HAIR_MESHES = ['player_hair_short', 'player_hair_bob', 'player_hair_bun'] as const;

export interface OutfitLook {
  mesh: string;
  colors: Partial<Record<CharacterSlot, string>>;
}

/** Tenues proposées à la création (index `appearance.outfit`): coupe et couleurs. */
export const OUTFITS: readonly OutfitLook[] = [
  { mesh: 'player_outfit_work', colors: { top: '#5c7fa6', top_trim: '#ede6d3', bottom: '#4a5d78', shoes: '#5a4636' } },
  { mesh: 'player_outfit_smock', colors: { top: '#b5663f', top_trim: '#ede6d3', bottom: '#6b5541', shoes: '#4a3a2e' } },
  { mesh: 'player_outfit_overalls', colors: { top: '#8ba37b', top_trim: '#f1ebdb', bottom: '#5e6a55', shoes: '#4f3f31' } },
  { mesh: 'player_outfit_work', colors: { top: '#d4a746', top_trim: '#f3ecda', bottom: '#6e5b48', shoes: '#4a3a2e' } },
];

/** Peau et cheveux par défaut de chaque personnage (la démo ne les fait pas choisir). */
export const BODY_COLORS: Readonly<Record<CharacterId, Partial<Record<CharacterSlot, string>>>> = {
  p1: { skin: '#e8be9a', skin_shade: '#d29d7b', hair: '#6b4a33', hair_dark: '#4a3324', cheek: '#e99a8e' },
  p2: { skin: '#b9825c', skin_shade: '#9c6646', hair: '#2e2622', hair_dark: '#1e1916', cheek: '#d9857a' },
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
