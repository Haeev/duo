/**
 * Garde-robe dans les sauvegardes (0.12): migration de l'ancien `appearance.outfit` (rang de tenue)
 * vers une tenue de départ équivalente, contrôle de forme à la lecture, et remise d'aplomb à la
 * reprise si `vetements.json` a changé depuis (vêtement porté disparu).
 */
import type { ClothesContent } from '../donnees/vetements';
import { REQUIRED_SLOTS } from '../donnees/vetements';
import { starterWardrobe, starterWear, wornIds } from '../etat/garde-robe';
import type { Character } from '../etat/types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Format 11: `outfit` devient la tenue de départ du même rang, portée et seule dans la garde-robe. */
export function migrateToWardrobe(world: Record<string, unknown>, clothes: ClothesContent): void {
  const people = world.characters;
  if (!Array.isArray(people)) return;
  people.forEach((c: unknown, index) => {
    if (!isRecord(c) || !isRecord(c.appearance)) return;
    const a = c.appearance;
    const outfit = typeof a.outfit === 'number' && Number.isFinite(a.outfit) ? a.outfit : index;
    const wear = starterWear(clothes, outfit);
    a.wear = wear;
    delete a.outfit;
    c.wardrobe = starterWardrobe(wear);
  });
}

/** Forme de la garde-robe d'une sauvegarde relue: `false` si elle ne convient pas. */
export function wardrobeShapeOk(characters: readonly unknown[]): boolean {
  const str = (v: unknown): boolean => typeof v === 'string';
  const opt = (v: unknown): boolean => v === null || typeof v === 'string';
  return characters.every((c) => {
    if (!isRecord(c) || !isRecord(c.appearance)) return false;
    const w = c.appearance.wear;
    return (
      isRecord(w) &&
      str(w.top) &&
      str(w.bottom) &&
      str(w.shoes) &&
      opt(w.outer) &&
      opt(w.hat) &&
      Array.isArray(c.wardrobe) &&
      c.wardrobe.every(str)
    );
  });
}

/**
 * À la reprise: un vêtement porté qui n'existe plus est remplacé par celui de la tenue de départ
 * (obligatoires) ou ôté (facultatifs); ce qui est porté est toujours dans la garde-robe. Les
 * identifiants inconnus de la garde-robe restent (rien ne se perd si le vêtement revient).
 */
export function settleWardrobe(clothes: ClothesContent, c: Character, starterIndex: number): void {
  if (clothes.list.length === 0) return;
  const wear = c.appearance.wear;
  const starter = starterWear(clothes, starterIndex);
  for (const slot of REQUIRED_SLOTS) {
    if (clothes.byId[wear[slot]]?.slot !== slot) wear[slot] = starter[slot];
  }
  if (wear.outer !== null && clothes.byId[wear.outer]?.slot !== 'outer') wear.outer = null;
  if (wear.hat !== null && clothes.byId[wear.hat]?.slot !== 'hat') wear.hat = null;
  for (const id of wornIds(wear)) if (!c.wardrobe.includes(id)) c.wardrobe.push(id);
}
