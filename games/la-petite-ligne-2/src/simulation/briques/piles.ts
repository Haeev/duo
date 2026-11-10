/**
 * Piles dans des cases (barre, sac, rangement): ajout avec empilement jusqu'à la limite de
 * l'objet. Le strict nécessaire aux briques `pickup` et `store`; le lot L3 (`sac/`) tient les
 * règles complètes du sac et peut reprendre ces fonctions.
 */
import type { Content } from '../../donnees/charger';
import type { PlayerState, Stack } from '../../etat/joueur';
import type { DeepReadonly } from '../../etat/monde';

type Slots = (Stack | null)[];
type ReadSlots = DeepReadonly<Slots>;

function limitOf(content: Content, item: string): number {
  return content.items[item]?.stack ?? 1;
}

/** Combien d'exemplaires de cette pile tiendraient dans ces cases. */
function roomIn(slots: ReadSlots, stack: DeepReadonly<Stack>, limit: number): number {
  let room = 0;
  for (const slot of slots) {
    if (slot === null) room += limit;
    else if (slot.item === stack.item && slot.wear === undefined && stack.wear === undefined)
      room += Math.max(0, limit - slot.count);
  }
  return room;
}

/**
 * Ajoute une pile à des cases: d'abord sur les piles du même objet, puis dans les cases vides.
 * Renvoie ce qui n'est pas entré. Un outil usé (`wear`) ne s'empile pas et garde son usure.
 */
export function addToSlots(slots: Slots, stack: DeepReadonly<Stack>, limit: number): number {
  let left = stack.count;
  if (stack.wear === undefined) {
    for (const slot of slots) {
      if (left === 0) break;
      if (slot?.item !== stack.item || slot.wear !== undefined) continue;
      const moved = Math.min(left, limit - slot.count);
      if (moved <= 0) continue;
      slot.count += moved;
      left -= moved;
    }
  }
  for (let i = 0; i < slots.length && left > 0; i++) {
    if (slots[i] !== null) continue;
    const moved = Math.min(left, limit);
    slots[i] =
      stack.wear === undefined
        ? { item: stack.item, count: moved }
        : { item: stack.item, count: moved, wear: stack.wear };
    left -= moved;
  }
  return left;
}

/** Place libre chez un joueur pour cette pile (barre puis sac). */
export function roomFor(
  content: Content,
  player: DeepReadonly<PlayerState>,
  stack: DeepReadonly<Stack>,
): number {
  const limit = limitOf(content, stack.item);
  return (
    roomIn(player.toolbar, stack, limit) +
    (player.bag === null ? 0 : roomIn(player.bag.slots, stack, limit))
  );
}

/** Donne une pile à un joueur (barre puis sac). Renvoie ce qui n'est pas entré. */
export function giveToPlayer(
  content: Content,
  player: PlayerState,
  stack: DeepReadonly<Stack>,
): number {
  const limit = limitOf(content, stack.item);
  const left = addToSlots(player.toolbar, stack, limit);
  if (left === 0 || player.bag === null) return left;
  return addToSlots(player.bag.slots, { ...stack, count: left }, limit);
}

/** Range une pile dans un meuble. Renvoie ce qui n'est pas entré. */
export function storeStack(content: Content, slots: Slots, stack: DeepReadonly<Stack>): number {
  return addToSlots(slots, stack, limitOf(content, stack.item));
}
