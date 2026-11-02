/**
 * Sac (24 cases, les 8 premières en barre d'outils), coffre et caisse: piles
 * par objet et par qualité (PE-10).
 */
import type { Character, ItemStack, Quality } from '../etat/types';
import { TOOLBAR_SLOTS } from './constantes';
import { type Sim, character, emit, newId, say } from './contexte';

export function stackLimit(sim: Sim, item: string): number {
  return sim.content.items[item]?.stack ?? 1;
}

/** Nombre d'unités d'un objet dans le sac (toutes qualités si `quality` est absent). */
export function countInBag(c: Character, item: string, quality?: Quality): number {
  let total = 0;
  for (const slot of c.bag) {
    if (slot !== null && slot.item === item && (quality === undefined || slot.quality === quality)) {
      total += slot.count;
    }
  }
  return total;
}

/** Ajoute au sac; renvoie ce qui n'a pas trouvé de place. */
export function addToBag(sim: Sim, c: Character, item: string, quality: Quality, count: number): number {
  let left = count;
  const limit = stackLimit(sim, item);
  for (const slot of c.bag) {
    if (left === 0) break;
    if (slot !== null && slot.item === item && slot.quality === quality && slot.count < limit) {
      const added = Math.min(left, limit - slot.count);
      slot.count += added;
      left -= added;
    }
  }
  for (let i = 0; i < c.bag.length && left > 0; i++) {
    if (c.bag[i] === null) {
      const added = Math.min(left, limit);
      c.bag[i] = { item, quality, count: added };
      left -= added;
    }
  }
  return left;
}

/** Ajoute au sac; le surplus tombe aux pieds du personnage (jamais perdu). */
export function giveToCharacter(sim: Sim, c: Character, item: string, quality: Quality, count: number): void {
  const left = addToBag(sim, c, item, quality, count);
  if (left > 0) {
    dropAt(sim, c.pos.x, c.pos.y, item, quality, left);
    say(sim, c.id, 'bag_full');
    emit(sim, { type: 'bag_full', by: c.id });
  }
}

export function dropAt(sim: Sim, x: number, y: number, item: string, quality: Quality, count: number): void {
  // Après la démo, une pile du même objet au même endroit grossit au lieu d'en poser une autre
  // (les œufs du poulailler, jour après jour): le sol reste borné (QA8-02).
  const from = sim.content.settings.tidy.fromDay;
  if (from !== null && sim.world.clock.day >= from) {
    const same = sim.world.groundItems.find(
      (g) => g.item === item && g.quality === quality && Math.abs(g.pos.x - x) < SAME_SPOT && Math.abs(g.pos.y - y) < SAME_SPOT,
    );
    if (same !== undefined) {
      same.count += count;
      return;
    }
  }
  sim.world.groundItems.push({ id: newId(sim, 'g'), item, quality, count, pos: { x, y } });
}

/** Deux piles plus proches que ceci (m) sont au même endroit. */
const SAME_SPOT = 0.01;

/**
 * Retire du sac; préfère la qualité donnée, sinon commence par l'ordinaire.
 * Renvoie les piles retirées (pour savoir quelles qualités sont parties).
 */
export function takeFromBag(c: Character, item: string, count: number, quality?: Quality): ItemStack[] {
  const taken: ItemStack[] = [];
  let left = count;
  const order: Quality[] = quality === undefined ? ['ordinary', 'fine'] : [quality];
  for (const q of order) {
    for (let i = 0; i < c.bag.length && left > 0; i++) {
      const slot = c.bag[i];
      if (slot?.item !== item || slot.quality !== q) continue;
      const removed = Math.min(left, slot.count);
      slot.count -= removed;
      left -= removed;
      addStack(taken, item, q, removed);
      if (slot.count === 0) c.bag[i] = null;
    }
  }
  return taken;
}

export function countInStacks(stacks: ItemStack[], item: string, quality?: Quality): number {
  let total = 0;
  for (const s of stacks) {
    if (s.item === item && (quality === undefined || s.quality === quality)) total += s.count;
  }
  return total;
}

export function addStack(stacks: ItemStack[], item: string, quality: Quality, count: number): void {
  if (count <= 0) return;
  const existing = stacks.find((s) => s.item === item && s.quality === quality);
  if (existing !== undefined) existing.count += count;
  else stacks.push({ item, quality, count });
}

export function takeFromStacks(stacks: ItemStack[], item: string, count: number, quality?: Quality): ItemStack[] {
  const taken: ItemStack[] = [];
  let left = count;
  const order: Quality[] = quality === undefined ? ['ordinary', 'fine'] : [quality];
  for (const q of order) {
    for (const s of stacks) {
      if (left === 0) break;
      if (s.item !== item || s.quality !== q) continue;
      const removed = Math.min(left, s.count);
      s.count -= removed;
      left -= removed;
      addStack(taken, item, q, removed);
    }
  }
  for (let i = stacks.length - 1; i >= 0; i--) {
    if ((stacks[i]?.count ?? 0) <= 0) stacks.splice(i, 1);
  }
  return taken;
}

/** Ce que le personnage tient en main (case choisie de la barre). */
export function heldStack(c: Character): ItemStack | null {
  return c.bag[c.selected] ?? null;
}

export function heldItem(c: Character): string | null {
  return heldStack(c)?.item ?? null;
}

/** Possédé par le duo: sacs des deux et cellier. */
export function duoOwns(sim: Sim, item: string): number {
  return (
    countInBag(character(sim, 'p1'), item) +
    countInBag(character(sim, 'p2'), item) +
    countInStacks(sim.world.cellar, item) +
    countInStacks(sim.world.rack, item)
  );
}

/** Prend des matériaux: le sac du personnage d'abord, puis le cellier. Rien n'est pris s'il en manque. */
export function payMaterials(
  sim: Sim,
  c: Character,
  inputs: { item: string; count: number }[],
): { ok: true } | { ok: false; missing: { item: string; count: number }[] } {
  const missing: { item: string; count: number }[] = [];
  for (const input of inputs) {
    const have = countInBag(c, input.item) + countInStacks(sim.world.cellar, input.item);
    if (have < input.count) missing.push({ item: input.item, count: input.count - have });
  }
  if (missing.length > 0) return { ok: false, missing };
  for (const input of inputs) {
    const fromBag = Math.min(input.count, countInBag(c, input.item));
    takeFromBag(c, input.item, fromBag);
    takeFromStacks(sim.world.cellar, input.item, input.count - fromBag);
  }
  return { ok: true };
}

export function clampSlot(index: number): number {
  return ((index % TOOLBAR_SLOTS) + TOOLBAR_SLOTS) % TOOLBAR_SLOTS;
}
