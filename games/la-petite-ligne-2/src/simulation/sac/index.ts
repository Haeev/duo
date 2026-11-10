/**
 * Système « sac » (lot L3): barre et sac, sol, don à l'autre joueur, meubles de rangement
 * (brique `store`) et coffre commun. Chaque refus part en `refused` avec sa raison, pour le seul
 * joueur concerné.
 */
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { Stack } from '../../etat/joueur';
import type { Intent } from '../noyau/entrees';
import type { GameSystem, SimContext } from '../noyau/systemes';
import { RULES } from '../regles/reglages';
import { currentPlace, distanceTo, dropStack } from './actions';
import { deposit, withdraw } from './argent';
import type { SlotRef } from './cases';
import {
  addStack,
  areaSlots,
  moveBetween,
  slotExists,
  stackAt,
  setStack,
  stackLimit,
} from './inventaire';

function refuse(
  sim: SimContext,
  player: PlayerIndex,
  reason: string,
  target: string | null = null,
): void {
  sim.emit({ type: 'refused', player, reason, target });
}

/** Position d'un meuble du lieu courant (carte ou posé par un joueur). */
export function objectPosition(sim: SimContext, id: string): { x: number; y: number } | null {
  const map = sim.content.places[sim.world.common.place]?.map;
  const fromMap = map?.objects.find((object) => object.id === id);
  if (fromMap !== undefined) return fromMap;
  return currentPlace(sim)?.placed.find((prop) => prop.id === id) ?? null;
}

function withinReach(sim: SimContext, player: PlayerIndex, x: number, y: number): boolean {
  return distanceTo(sim.world.players[player], x, y) <= RULES.bag.reach;
}

/** Cases de rangement du meuble visé, s'il en a et s'il est à portée. */
function storeOf(sim: SimContext, player: PlayerIndex, target: string): (Stack | null)[] | null {
  const slots = currentPlace(sim)?.objects[target]?.store;
  const at = objectPosition(sim, target);
  if (slots === undefined || at === null) {
    refuse(sim, player, 'no-store', target);
    return null;
  }
  if (!withinReach(sim, player, at.x, at.y)) {
    refuse(sim, player, 'too-far', target);
    return null;
  }
  return slots;
}

function checkSlot(sim: SimContext, player: PlayerIndex, ref: SlotRef): Stack | null {
  const state = sim.world.players[player];
  if (!slotExists(state, ref)) {
    refuse(sim, player, 'no-slot');
    return null;
  }
  const stack = stackAt(state, ref);
  if (stack === null) refuse(sim, player, 'empty-slot');
  return stack;
}

/** Range une pile dans des cases (mêmes règles de piles que le sac); renvoie ce qui reste. */
function storeInto(sim: SimContext, slots: (Stack | null)[], stack: Stack): number {
  const limit = stackLimit(sim.content, stack.item);
  let left = stack.count;
  if (stack.wear === undefined)
    for (const slot of slots) {
      if (left === 0) break;
      if (slot?.item === stack.item && slot.wear === undefined && slot.count < limit) {
        const moved = Math.min(left, limit - slot.count);
        slot.count += moved;
        left -= moved;
      }
    }
  for (let i = 0; i < slots.length && left > 0; i++) {
    if (slots[i] !== null) continue;
    const moved = Math.min(left, limit);
    slots[i] = { ...stack, count: moved };
    left -= moved;
  }
  return left;
}

function onIntent(sim: SimContext, player: PlayerIndex, intent: Intent): void {
  const state = sim.world.players[player];
  // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check -- chaque système ignore les intentions des autres
  switch (intent.type) {
    case 'move_stack': {
      if (checkSlot(sim, player, intent.from) === null) return;
      const from = areaSlots(state, intent.from.area);
      const to = areaSlots(state, intent.to.area);
      if (from === null || to === null || !slotExists(state, intent.to)) {
        refuse(sim, player, 'no-slot');
        return;
      }
      if (!moveBetween(sim.content, from, intent.from.index, to, intent.to.index)) {
        refuse(sim, player, 'stack-full');
        return;
      }
      sim.touch('players');
      return;
    }
    case 'drop': {
      const stack = checkSlot(sim, player, intent.from);
      if (stack === null) return;
      setStack(state, intent.from, null);
      dropStack(sim, player, stack);
      sim.touch('players');
      return;
    }
    case 'pick_up': {
      const place = currentPlace(sim);
      const index = place?.ground.findIndex((item) => item.id === intent.ground) ?? -1;
      const item = place?.ground[index];
      if (place === null || item === undefined) {
        refuse(sim, player, 'gone');
        return;
      }
      if (!withinReach(sim, player, item.x, item.y)) {
        refuse(sim, player, 'too-far');
        return;
      }
      const left = addStack(sim.content, state, item.stack);
      if (left === item.stack.count) {
        refuse(sim, player, 'pockets-full');
        return;
      }
      sim.emit({
        type: 'item_gained',
        player,
        item: item.stack.item,
        count: item.stack.count - left,
      });
      if (left === 0) place.ground.splice(index, 1);
      else item.stack.count = left;
      sim.touch('players');
      sim.touch('place');
      return;
    }
    case 'give_stack': {
      const stack = checkSlot(sim, player, intent.from);
      if (stack === null) return;
      const other: PlayerIndex = player === 0 ? 1 : 0;
      const { x, y } = sim.world.players[other].body;
      if (!withinReach(sim, player, x, y)) {
        refuse(sim, player, 'too-far');
        return;
      }
      const left = addStack(sim.content, sim.world.players[other], stack);
      if (left === stack.count) {
        refuse(sim, player, 'other-pockets-full');
        return;
      }
      const given = stack.count - left;
      if (left === 0) setStack(state, intent.from, null);
      else stack.count = left;
      sim.emit({ type: 'item_given', from: player, to: other, item: stack.item, count: given });
      sim.touch('players');
      return;
    }
    case 'chest_deposit': {
      const refusal = deposit(sim, player, intent.amount);
      if (refusal !== null) refuse(sim, player, refusal);
      return;
    }
    case 'chest_withdraw': {
      const refusal = withdraw(sim, player, intent.amount);
      if (refusal !== null) refuse(sim, player, refusal);
      return;
    }
    case 'store_put': {
      const stack = checkSlot(sim, player, intent.from);
      if (stack === null) return;
      const slots = storeOf(sim, player, intent.target);
      if (slots === null) return;
      const left = storeInto(sim, slots, stack);
      if (left === stack.count) {
        refuse(sim, player, 'store-full', intent.target);
        return;
      }
      if (left === 0) setStack(state, intent.from, null);
      else stack.count = left;
      sim.touch('players');
      sim.touch('place');
      return;
    }
    case 'store_take': {
      const slots = storeOf(sim, player, intent.target);
      if (slots === null) return;
      const stack = slots[intent.index] ?? null;
      if (stack === null) {
        refuse(sim, player, 'empty-slot', intent.target);
        return;
      }
      const left = giveStackQuiet(sim, player, stack);
      if (left === stack.count) {
        refuse(sim, player, 'pockets-full', intent.target);
        return;
      }
      if (left === 0) slots[intent.index] = null;
      else stack.count = left;
      sim.touch('place');
      return;
    }
    default:
      return;
  }
}

/** Comme `giveStack`, mais ce qui ne rentre pas reste où il était (dans le meuble). */
function giveStackQuiet(sim: SimContext, player: PlayerIndex, stack: Stack): number {
  const left = addStack(sim.content, sim.world.players[player], stack);
  if (left < stack.count) {
    sim.emit({ type: 'item_gained', player, item: stack.item, count: stack.count - left });
    sim.touch('players');
  }
  return left;
}

export const bagSystem: GameSystem = { id: 'sac', intent: onIntent };
