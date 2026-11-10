/**
 * Brique `store`: un rangement partagé par les deux joueurs. La touche d'action l'ouvre
 * (événement `store_opened`: l'interface montre ses cases, lues dans l'état du meuble); les
 * intentions `store_put` et `store_take` déplacent une pile entière, validées par l'hôte.
 */
import type { Brick } from '../../donnees/schemas/briques';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { Stack } from '../../etat/joueur';
import type { SimContext } from '../noyau/systemes';
import type { SlotRef } from '../sac/cases';
import { giveToPlayer, storeStack } from './piles';
import type { BrickBehaviour } from './types';

type StoreBrick = Extract<Brick, { brick: 'store' }>;

export const storeBehaviour: BrickBehaviour<StoreBrick> = {
  verb: 'Ouvrir',
  refuse() {
    return null;
  },
  use(sim, player, target) {
    sim.emit({ type: 'store_opened', player, target: target.id });
  },
};

function playerSlots(sim: SimContext, player: PlayerIndex, ref: SlotRef): (Stack | null)[] | null {
  const actor = sim.world.players[player];
  return ref.area === 'toolbar' ? actor.toolbar : (actor.bag?.slots ?? null);
}

/** Dépose une case du joueur dans le rangement; ce qui n'entre pas reste chez le joueur. */
export function storePut(
  sim: SimContext,
  player: PlayerIndex,
  target: string,
  slots: (Stack | null)[],
  from: SlotRef,
): void {
  const source = playerSlots(sim, player, from);
  const stack = source?.[from.index] ?? null;
  if (source === null || stack === null) return;
  const left = storeStack(sim.content, slots, stack);
  if (left === stack.count) {
    sim.emit({ type: 'refused', player, reason: 'store-full', target });
    return;
  }
  if (left === 0) {
    source[from.index] = null;
    // L'outil en main vient d'être rangé: mains libres.
    const actor = sim.world.players[player];
    if (from.area === 'toolbar' && actor.selected === from.index) actor.selected = null;
  } else stack.count = left;
  sim.touch('players');
  sim.touch('place');
}

/** Reprend une case du rangement; ce qui n'entre pas dans les poches y reste. */
export function storeTake(
  sim: SimContext,
  player: PlayerIndex,
  target: string,
  slots: (Stack | null)[],
  index: number,
): void {
  const stack = slots[index] ?? null;
  if (stack === null) return;
  const left = giveToPlayer(sim.content, sim.world.players[player], stack);
  if (left === stack.count) {
    sim.emit({ type: 'pockets_full', player, item: stack.item });
    sim.emit({ type: 'refused', player, reason: 'pockets-full', target });
    return;
  }
  sim.emit({ type: 'item_gained', player, item: stack.item, count: stack.count - left });
  if (left === 0) slots[index] = null;
  else stack.count = left;
  sim.touch('players');
  sim.touch('place');
}
