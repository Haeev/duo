/**
 * Ce qui fait changer le contenu des poches avec ses conséquences: événements, objets posés au
 * sol, tranches à renvoyer. Les autres systèmes (effets, briques, dialogues) passent par ici.
 */
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { PlayerState, Stack } from '../../etat/joueur';
import type { PlaceState } from '../../etat/lieu';
import type { SimContext } from '../noyau/systemes';
import type { SlotRef } from './cases';
import { addStack, newStack, setStack, slotExists, stackAt } from './inventaire';

/** Au plus 80 objets au sol (`etat/lieu.ts`): au-delà, le plus ancien disparaît. */
export const GROUND_MAX = 80;

export function currentPlace(sim: SimContext): PlaceState | null {
  return sim.world.places[sim.world.common.place] ?? null;
}

/** Pose une pile au sol, aux pieds du joueur. */
export function dropStack(sim: SimContext, player: PlayerIndex, stack: Stack): void {
  const place = currentPlace(sim);
  if (place === null) return;
  const { x, y } = sim.world.players[player].body;
  while (place.ground.length >= GROUND_MAX) place.ground.shift();
  place.ground.push({ id: place.nextGroundId, stack: { ...stack }, x, y });
  place.nextGroundId += 1;
  sim.touch('place');
}

/**
 * Donne une pile au joueur: ce qui rentre part dans ses poches, le reste tombe au sol et brille
 * (« Poches pleines »). Renvoie le nombre d'exemplaires entrés dans les poches.
 */
export function giveStack(sim: SimContext, player: PlayerIndex, stack: Stack): number {
  const state = sim.world.players[player];
  const left = addStack(sim.content, state, stack);
  const added = stack.count - left;
  if (added > 0) {
    sim.emit({ type: 'item_gained', player, item: stack.item, count: added });
    sim.touch('players');
  }
  if (left > 0) {
    dropStack(sim, player, { ...stack, count: left });
    sim.emit({ type: 'pockets_full', player, item: stack.item });
  }
  return added;
}

export function giveItem(
  sim: SimContext,
  player: PlayerIndex,
  item: string,
  count: number,
): number {
  return giveStack(sim, player, newStack(sim.content, item, count));
}

/**
 * Change de sac (cahier 4.5: un sac remplace le précédent). Le contenu passe dans le nouveau; ce
 * qui n'y tient plus tombe au sol. Le rachat à moitié prix relève du commerce (jalon 2). Un sac
 * offert plus petit que celui qu'on porte ne le remplace jamais (`false`): on garderait moins de
 * cases (la besace de Solange donnée à qui a déjà le sac à dos).
 */
export function equipBag(sim: SimContext, player: PlayerIndex, bagId: string): boolean {
  const def = sim.content.bags.bags.find((bag) => bag.id === bagId);
  if (def === undefined) return false;
  const state: PlayerState = sim.world.players[player];
  const worn = sim.content.bags.bags.find((bag) => bag.id === state.bag?.id);
  if (worn !== undefined && worn.slots > def.slots) return false;
  const old = state.bag?.slots ?? [];
  state.bag = { id: def.id, slots: Array.from({ length: def.slots }, () => null) };
  for (const stack of old) {
    if (stack === null) continue;
    const left = addStack(sim.content, state, stack);
    if (left > 0) dropStack(sim, player, { ...stack, count: left });
  }
  sim.emit({ type: 'bag_changed', player, bag: def.id });
  sim.touch('players');
  return true;
}

/** Distance au sol entre un joueur et un point. */
export function distanceTo(state: PlayerState, x: number, y: number): number {
  return Math.hypot(state.body.x - x, state.body.y - y);
}

/**
 * Équipe le sac contenu dans une case de la barre ou du sac (objet à champ `bag`). L'objet est
 * consommé; le sac porté jusque-là revient dans les poches s'il a son objet (famille `bag`), sinon
 * il disparaît comme avec `give_bag`. Renvoie la raison du refus, ou `null`.
 */
export function equipBagItem(
  sim: SimContext,
  player: PlayerIndex,
  from: SlotRef,
): 'empty-slot' | 'not-a-bag' | 'no-slot' | 'bag-not-bigger' | null {
  const state: PlayerState = sim.world.players[player];
  if (!slotExists(state, from)) return 'no-slot';
  const stack = stackAt(state, from);
  if (stack === null) return 'empty-slot';
  const bagId = sim.content.items[stack.item]?.bag;
  if (bagId === undefined) return 'not-a-bag';
  // Un sac pas plus grand que celui qu'on porte ne s'équipe pas (on perdrait des cases).
  const slotsOf = (id: string | undefined): number =>
    sim.content.bags.bags.find((bag) => bag.id === id)?.slots ?? 0;
  if (state.bag !== null && slotsOf(bagId) <= slotsOf(state.bag.id)) return 'bag-not-bigger';
  const previous = state.bag?.id;
  setStack(state, from, null);
  if (!equipBag(sim, player, bagId)) {
    // Données inconnues du validateur: on rend la pile plutôt que de la perdre.
    setStack(state, from, stack);
    return 'not-a-bag';
  }
  const old = Object.values(sim.content.items).find(
    (item) => previous !== undefined && item.bag === previous,
  );
  if (old !== undefined) giveItem(sim, player, old.id, 1);
  return null;
}
