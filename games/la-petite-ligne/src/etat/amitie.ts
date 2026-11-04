/**
 * L'amitié lue sur l'état (0.13, lot H2; conception `v0-13-habitants.md`, section 6): le lien de
 * chaque habitant avec le duo, son niveau, ses goûts. Pur: la simulation, le carnet (lot H3) et les
 * plannings lisent les mêmes règles.
 */
import type { Content } from '../donnees/types';
import type { BondSettings } from '../donnees/types-voisins';
import type { ReadonlyWorld } from './types';
import type { TasteLevel } from './types-voisins';

/** Le lien de cet habitant avec le duo (0 s'il n'en a pas encore). */
export function bondOf(world: ReadonlyWorld, villager: string): number {
  return world.bonds[villager] ?? 0;
}

/** Le niveau (0 « De vue » à 5 « Comme la famille ») d'un lien. */
export function bondLevel(settings: BondSettings, bond: number): number {
  let level = 0;
  settings.levels.forEach((threshold, i) => {
    if (bond >= threshold) level = i;
  });
  return level;
}

/** Ce que cet habitant pense de cet objet (ses goûts des données; le reste lui est égal). */
export function tasteOf(content: Content, villager: string, item: string): TasteLevel {
  const t = content.villagers.find((v) => v.id === villager)?.tastes;
  if (t === undefined) return 'neutral';
  if (t.loves.includes(item)) return 'loves';
  if (t.likes.includes(item)) return 'likes';
  if (t.dislikes.some((d) => d.item === item)) return 'dislikes';
  return 'neutral';
}
