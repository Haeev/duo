/**
 * Où se trouve un personnage (ADR 0016): les deux sens de l'ancien `inHouse`. Le même code sert à
 * la simulation, au rendu, au son et à l'interface (chez l'hôte et chez l'invité).
 *
 * - « Chez soi » (`isHome`): dans la maisonnette. Aménagement, coucher, minuit, veillée, réchaud.
 * - « À l'abri » (`isSheltered`): dans un bâtiment visitable, quel qu'il soit. Pluie, moments
 *   rares, bancs du dehors, lisière, bêche: tout ce qui se passe dehors.
 */
import { type BuildingId, HOUSE_BUILDING } from './carte';
import type { CharacterId, ReadonlyWorld } from './types';

/** Ce que ces règles lisent d'un personnage (ou d'un habitant). */
export interface Placed {
  readonly inside: BuildingId | null;
}

/** Dans la maisonnette (« chez soi »). */
export function isHome(c: Placed): boolean {
  return c.inside === HOUSE_BUILDING;
}

/** Dans un bâtiment visitable, quel qu'il soit (« à l'abri »). */
export function isSheltered(c: Placed): boolean {
  return c.inside !== null;
}

/** Au fauteuil du salon (menu `salon`, assis): on choisit pour soi. Sur le banc, menu `salon` debout: on propose. */
export function atSalonChair(c: { readonly menu: string | null; readonly action: { readonly kind: string } }): boolean {
  return c.menu === 'salon' && c.action.kind === 'sit';
}

/**
 * Première coupe offerte (`solange_first_cut`): tant que la quête court et que ce joueur n'est pas
 * encore passé au fauteuil (compteur `salon_chair`).
 */
export function firstCutFree(world: Pick<ReadonlyWorld, 'quests' | 'counters'>, id: CharacterId): boolean {
  const q = world.quests.find((x) => x.id === 'solange_first_cut');
  return q?.status === 'active' && (world.counters[id].salon_chair ?? 0) === 0;
}

/** Achats du jour au guichet du fournil, par objet du panneau (`bread` compte aussi le pain chaud). */
export function bakeryBoughtToday(world: Pick<ReadonlyWorld, 'countersToday'>, id: CharacterId): Record<string, number> {
  const today = world.countersToday[id];
  return { bread: today['bakery:bread'] ?? 0, brioche: today['bakery:brioche'] ?? 0 };
}
