/**
 * Icônes du sprite par famille (0.12.2, « une icône par chose »): poissons, robes de poule, icônes
 * d'information des fiches et raretés. Le lot interface code contre ces signatures. Chaque fonction
 * rend l'identifiant d'un symbole qui existe dans `ui-maquettes/icones.svg`, même pour une entrée
 * inconnue (donnée d'une autre version, sauvegarde ancienne): jamais un `<use>` vide.
 */
import { FISH_RARITIES, type FishRarity } from '../etat/peche';
import {
  FISH_ICONS,
  HEN_ROBE_ICONS,
  HEN_UNKNOWN_ICON,
  INFO_ICONS,
  type InfoIconKey,
  RARITY_ICONS,
} from './config';

export type { InfoIconKey } from './config';

/** Repli d'un poisson sans dessin propre: le poisson générique. */
export const FISH_FALLBACK_ICON = 'fish';
/** Repli d'une clé d'information inconnue: la feuille épinglée (une fiche). */
export const INFO_FALLBACK_ICON = 'ui-notice';
/** Rareté prise quand la donnée n'en donne pas une connue. */
const FALLBACK_RARITY: FishRarity = 'common';

function isRarity(value: string): value is FishRarity {
  return (FISH_RARITIES as readonly string[]).includes(value);
}

function isInfoKey(value: string): value is InfoIconKey {
  return Object.hasOwn(INFO_ICONS, value);
}

/** Symbole d'un poisson (identifiant d'objet: `gudgeon`, `moon_pike`...). */
export function fishIcon(fishId: string): string {
  return FISH_ICONS[fishId] ?? FISH_FALLBACK_ICON;
}

/**
 * Portrait d'une robe de poule (`hen_white`... de `reglages.hens.care.colors`). Une robe pas encore
 * trouvée (`found` faux) ou inconnue montre la silhouette grise.
 */
export function henIcon(robeId: string, found = true): string {
  if (!found) return HEN_UNKNOWN_ICON;
  return HEN_ROBE_ICONS[robeId] ?? HEN_UNKNOWN_ICON;
}

/**
 * Icône d'information d'une fiche. Les saisons et les coins de pêche se donnent sous leur identifiant
 * du jeu (`spring`, `ford`...), ce qui permet de passer tel quel un champ lu dans les données.
 */
export function infoIcon(key: InfoIconKey | (string & Record<never, never>)): string {
  return isInfoKey(key) ? INFO_ICONS[key] : INFO_FALLBACK_ICON;
}

/** Classe CSS d'une rareté (`lpl-rarity--common`...), pour le liseré ou le fond que pose l'interface. */
export function rarityClass(rarity: FishRarity | (string & Record<never, never>)): string {
  return `lpl-rarity--${isRarity(rarity) ? rarity : FALLBACK_RARITY}`;
}

/** Symbole du fond et du liseré d'une rareté (`rarity-*`), à poser sous l'icône du poisson. */
export function rarityIcon(rarity: FishRarity | (string & Record<never, never>)): string {
  return RARITY_ICONS[isRarity(rarity) ? rarity : FALLBACK_RARITY];
}
