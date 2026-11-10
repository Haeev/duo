/**
 * Barre et sac d'un joueur (cahier 4.5, R20): fonctions pures sur les cases, sans événement.
 * La barre est toujours là; le sac vient ensuite. Une pile ne dépasse jamais la limite de la
 * fiche de son objet (`stack`); un outil amélioré naît avec toute son usure (`wear`).
 */
import type { Content } from '../../donnees/charger';
import type { PlayerState, Stack } from '../../etat/joueur';
import type { SlotRef } from './cases';

type Slots = (Stack | null)[];

/** Cases d'une zone, `null` si la zone n'existe pas (pas encore de sac). */
export function areaSlots(player: PlayerState, area: SlotRef['area']): Slots | null {
  return area === 'toolbar' ? player.toolbar : (player.bag?.slots ?? null);
}

/** La case désignée existe-t-elle chez ce joueur ? */
export function slotExists(player: PlayerState, ref: SlotRef): boolean {
  const slots = areaSlots(player, ref.area);
  return slots !== null && ref.index < slots.length;
}

export function stackAt(player: PlayerState, ref: SlotRef): Stack | null {
  return areaSlots(player, ref.area)?.[ref.index] ?? null;
}

export function setStack(player: PlayerState, ref: SlotRef, stack: Stack | null): void {
  const slots = areaSlots(player, ref.area);
  if (slots !== null && ref.index < slots.length) slots[ref.index] = stack;
}

/** Pile maximale de cet objet (1 pour un objet inconnu: rien ne s'empile par erreur). */
export function stackLimit(content: Content, item: string): number {
  return content.items[item]?.stack ?? 1;
}

/** Toutes les cases du joueur, barre d'abord: c'est l'ordre de remplissage. */
function allSlots(player: PlayerState): Slots[] {
  return player.bag === null ? [player.toolbar] : [player.toolbar, player.bag.slots];
}

export function countItem(player: PlayerState, item: string): number {
  let total = 0;
  for (const slots of allSlots(player))
    for (const stack of slots) if (stack?.item === item) total += stack.count;
  return total;
}

/** Une pile neuve: un outil amélioré porte son usure pleine, un outil de base n'en a pas. */
export function newStack(content: Content, item: string, count: number): Stack {
  const durability = content.items[item]?.tool?.durability ?? 0;
  return durability > 0 ? { item, count, wear: durability } : { item, count };
}

/** Deux piles se rejoignent si même objet et aucune n'a d'usure (un outil reste seul). */
function mergeable(a: Stack, b: Stack): boolean {
  return a.item === b.item && a.wear === undefined && b.wear === undefined;
}

/** Combien d'unités de cet objet tiendraient encore. */
export function roomFor(content: Content, player: PlayerState, item: string): number {
  const limit = stackLimit(content, item);
  let room = 0;
  for (const slots of allSlots(player))
    for (const stack of slots) {
      if (stack === null) room += limit;
      else if (stack.item === item && stack.wear === undefined) room += limit - stack.count;
    }
  return room;
}

/**
 * Ajoute une pile (ou `count` exemplaires neufs): complète d'abord les piles du même objet,
 * puis les cases vides. Renvoie ce qui n'a pas trouvé de place.
 */
export function addStack(content: Content, player: PlayerState, stack: Stack): number {
  const limit = stackLimit(content, stack.item);
  let left = stack.count;
  if (stack.wear === undefined) {
    for (const slots of allSlots(player))
      for (const slot of slots) {
        if (left === 0) return 0;
        if (slot !== null && mergeable(slot, stack) && slot.count < limit) {
          const added = Math.min(left, limit - slot.count);
          slot.count += added;
          left -= added;
        }
      }
  }
  for (const slots of allSlots(player))
    for (let i = 0; i < slots.length && left > 0; i++) {
      if (slots[i] !== null) continue;
      const added = Math.min(left, limit);
      slots[i] =
        stack.wear === undefined ? { item: stack.item, count: added } : { ...stack, count: added };
      left -= added;
    }
  return left;
}

export function addItem(
  content: Content,
  player: PlayerState,
  item: string,
  count: number,
): number {
  return addStack(content, player, newStack(content, item, count));
}

/** Retire `count` exemplaires (les dernières cases d'abord); rien n'est retiré s'il en manque. */
export function removeItem(player: PlayerState, item: string, count: number): boolean {
  if (countItem(player, item) < count) return false;
  let left = count;
  const zones = allSlots(player).reverse();
  for (const slots of zones)
    for (let i = slots.length - 1; i >= 0 && left > 0; i--) {
      const stack = slots[i];
      if (stack?.item !== item) continue;
      const taken = Math.min(left, stack.count);
      stack.count -= taken;
      left -= taken;
      if (stack.count === 0) slots[i] = null;
    }
  return true;
}

/** Retire une unité de la case (manger, poser un objet unique). */
export function takeOne(player: PlayerState, ref: SlotRef): Stack | null {
  const stack = stackAt(player, ref);
  if (stack === null) return null;
  const one: Stack =
    stack.wear === undefined ? { item: stack.item, count: 1 } : { ...stack, count: 1 };
  if (stack.count <= 1) setStack(player, ref, null);
  else stack.count -= 1;
  return one;
}

/**
 * Déplace la case `from` vers `to` dans les cases de `target` (le même joueur ou un meuble):
 * même objet, les piles se rejoignent jusqu'à leur limite; sinon les deux cases s'échangent.
 */
export function moveBetween(
  content: Content,
  fromSlots: Slots,
  from: number,
  toSlots: Slots,
  to: number,
): boolean {
  const source = fromSlots[from];
  if (source === null || source === undefined || to >= toSlots.length) return false;
  if (fromSlots === toSlots && from === to) return false;
  const dest = toSlots[to] ?? null;
  if (dest !== null && mergeable(dest, source)) {
    const limit = stackLimit(content, source.item);
    const moved = Math.min(source.count, limit - dest.count);
    if (moved <= 0) return false;
    dest.count += moved;
    source.count -= moved;
    if (source.count === 0) fromSlots[from] = null;
    return true;
  }
  toSlots[to] = source;
  fromSlots[from] = dest;
  return true;
}
