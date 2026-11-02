/**
 * Rangement de la nuit (QA8-02, taille de l'état I-06). À partir de `tidy.fromDay`, ce qui traîne
 * par terre rentre au coffre de la maisonnette pendant la nuit, comme un duo qui ramasse ses
 * affaires avant d'aller se coucher: un sac plein ne sème plus des tas qui restent des semaines
 * (et grossissent la sauvegarde sans limite). Restent dehors les objets qui ont leur place au sol:
 * ceux de l'histoire (catégorie `quest`, posés par les quêtes), les œufs au poulailler (on les
 * ramasse le matin) et les cueillettes à leur coin de la lisière (le coin ne se regarnit pas tant
 * qu'elles y sont).
 */
import type { ItemCategory } from '../donnees/types';
import { furnitureAtHome, isTool, storageCapacity, storageView, usedCells } from '../etat/maison';
import type { Character, GroundItem, ItemStack, Quality } from '../etat/types';
import { type Sim, distance, emit, notifyKey, point, say } from './contexte';
import { ITEM, POINT } from './ids';
import { FORAGE_CORNER_RADIUS } from './lisiere';
import { addStack, countInBag, countInStacks, dropAt, giveToCharacter, takeFromBag, takeFromStacks } from './sac';

/** Où les poules pondent (même décalage que `morningEggs`). */
const EGG_OFFSET = { x: 0.5, y: -0.6 };
/** Un œuf à moins de cette distance du nid est encore au poulailler (m). */
const NEST_RADIUS = 0.5;

function staysOnGround(sim: Sim, g: GroundItem): boolean {
  const def = sim.content.items[g.item];
  if (def?.category === 'quest') return true;
  if (g.item === ITEM.egg) {
    const coop = point(sim, POINT.chickenCoop);
    return distance(g.pos, { x: coop.x + EGG_OFFSET.x, y: coop.y + EGG_OFFSET.y }) <= NEST_RADIUS;
  }
  if (def?.category === 'forage') {
    const corners = sim.content.settings.forage?.points ?? [];
    return corners.some((p) => {
      const at = sim.map.points[p.point];
      return at !== undefined && distance(g.pos, at) <= FORAGE_CORNER_RADIUS;
    });
  }
  return false;
}

/** La nuit: les piles qui traînent rentrent au coffre (qualités gardées), un mot au petit-déjeuner. */
export function tidyGround(sim: Sim): void {
  const from = sim.content.settings.tidy.fromDay;
  const { world } = sim;
  if (from === null || world.clock.day < from) return;
  const kept: GroundItem[] = [];
  let moved = false;
  for (const g of world.groundItems) {
    if (staysOnGround(sim, g)) {
      kept.push(g);
      continue;
    }
    // Tour 10: au rangement tant qu'il y a de la place (outils au râtelier); le reste attend là où il est.
    const left = storeHere(sim, g.item, g.quality, g.count);
    if (left < g.count) moved = true;
    if (left > 0) kept.push({ ...g, count: left });
  }
  if (!moved) return;
  world.groundItems = kept;
  sim.runtime.changed = true;
  notifyKey(sim, 'both', 'message', 'ground_tidied', {});
}

// ---------------------------------------------------------------------------
// Rangement à cases et râtelier (tour 10, section 5)

/** Cases encore libres, `Infinity` sans limite (pas de réglage `storage`); négatif quand ça déborde. */
function freeCells(sim: Sim): number {
  const total = storageCapacity(sim.content, sim.map, sim.world);
  return total === null ? Infinity : total - usedCells(sim.content, sim.world.cellar);
}

/** Combien d'unités de cet objet entrent encore: le reste des piles entamées, puis les cases libres. */
export function storageRoomFor(sim: Sim, item: string, quality: Quality): number {
  const free = freeCells(sim);
  if (free === Infinity) return Infinity;
  if (free < 0) return 0;
  const size = sim.content.settings.storage?.stackSize ?? 1;
  const have = countInStacks(sim.world.cellar, item, quality);
  const partial = have % size === 0 ? 0 : size - (have % size);
  return partial + free * size;
}

function rackFree(sim: Sim): number {
  const hooks = sim.content.settings.storage?.rackHooks ?? Infinity;
  return Math.max(0, hooks - sim.world.rack.reduce((n, s) => n + s.count, 0));
}

/** Range ce qui entre (outils au râtelier, le reste dans les cases); renvoie ce qui n'a pas trouvé de place. */
function storeHere(sim: Sim, item: string, quality: Quality, count: number): number {
  let left = count;
  if (isTool(sim.content, item)) {
    const hooks = Math.min(left, rackFree(sim));
    addStack(sim.world.rack, item, quality, hooks);
    left -= hooks;
  }
  const fit = Math.min(left, storageRoomFor(sim, item, quality));
  addStack(sim.world.cellar, item, quality, fit);
  return left - fit;
}

/** Le pied du rangement: un pas devant le premier meuble de rangement de la maison, vers le milieu de la pièce. */
function storageFoot(sim: Sim): { x: number; y: number } {
  const cells = sim.content.settings.storage?.cells ?? {};
  const f = sim.world.furniture.find((x) => cells[x.item] !== undefined && furnitureAtHome(sim.map, sim.world.rooms, x));
  const room = sim.map.house.room;
  const mx = room.x + room.w / 2;
  const my = room.y + room.h / 2;
  if (f === undefined) return { x: mx, y: my };
  const cx = f.cell.cx + 0.5;
  const cy = f.cell.cy + 0.5;
  const d = Math.hypot(mx - cx, my - cy);
  return d < 0.01 ? { x: cx, y: cy } : { x: cx + ((mx - cx) / d) * FOOT_STEP, y: cy + ((my - cy) / d) * FOOT_STEP };
}

/** Distance du pied du coffre au meuble (m): sur la case voisine, côté pièce. */
const FOOT_STEP = 0.8;

/**
 * Ce qui rentre à la maison sans passer par un sac (livraison, colis, effet): les outils au
 * râtelier, le reste au rangement tant qu'il y a de la place, le surplus au pied du coffre (objet
 * au sol dans la maison, jamais perdu), avec la ligne `storage_ground`. Renvoie ce qui est resté par terre.
 */
export function storeAtHome(sim: Sim, item: string, quality: Quality, count: number): number {
  if (count <= 0) return 0;
  const left = storeHere(sim, item, quality, count);
  sim.runtime.changed = true;
  if (left > 0) {
    const at = storageFoot(sim);
    dropAt(sim, at.x, at.y, item, quality, left);
    say(sim, 'both', 'storage_ground');
  }
  return left;
}

/**
 * Déposer ou reprendre au rangement (panneau ouvert près d'un meuble de rangement): un outil va au
 * râtelier et en revient. Plein: refus doux `storage_full`; qui déborde: on reprend, on ne dépose
 * pas (`storage_overflow`). Renvoie le nombre d'unités déplacées.
 */
export function storageMove(sim: Sim, c: Character, item: string, quality: Quality, count: number, deposit: boolean): number {
  if (count < 1) return 0;
  const tool = isTool(sim.content, item);
  if (!deposit) {
    const from = tool && countInStacks(sim.world.rack, item, quality) > 0 ? sim.world.rack : sim.world.cellar;
    const taken = takeFromStacks(from, item, Math.min(count, countInStacks(from, item, quality)), quality);
    const n = taken.reduce((sum, s) => sum + s.count, 0);
    if (n > 0) {
      giveToCharacter(sim, c, item, quality, n);
      emit(sim, { type: 'picked_up', by: c.id, item, count: n });
    }
    return n;
  }
  const inBag = countInBag(c, item, quality);
  const toRack = tool && rackFree(sim) > 0;
  if (!toRack && freeCells(sim) < 0) {
    const v = storageView(sim.content, sim.map, sim.world);
    say(sim, c.id, 'storage_overflow', { used: v.used, total: v.total ?? 0 });
    return 0;
  }
  const room = toRack ? rackFree(sim) : storageRoomFor(sim, item, quality);
  const n = Math.min(count, inBag, room);
  if (n <= 0) {
    if (inBag > 0) {
      say(sim, c.id, 'storage_full');
      emit(sim, { type: 'storage_full', by: c.id });
    }
    return 0;
  }
  const taken = takeFromBag(c, item, n, quality);
  const moved = taken.reduce((sum, s) => sum + s.count, 0);
  addStack(toRack ? sim.world.rack : sim.world.cellar, item, quality, moved);
  sim.runtime.changed = true;
  emit(sim, { type: 'deposited', by: c.id, item, count: moved });
  if (moved < Math.min(count, inBag)) {
    say(sim, c.id, 'storage_full');
    emit(sim, { type: 'storage_full', by: c.id });
  }
  return moved;
}

/** Familles de « Tout déposer » (section 5.3): catégories de `objets.json`, dans l'ordre du tri. */
export const DEPOSIT_FAMILIES: readonly ItemCategory[] = ['crop', 'fish', 'forage', 'food', 'material'];

/** « Tout déposer: {family} »: les piles déjà au rangement d'abord, puis les autres; s'arrête quand c'est plein. */
export function depositFamily(sim: Sim, c: Character, family: string): number {
  if (!DEPOSIT_FAMILIES.some((f) => f === family)) return 0;
  const stacks = c.bag.filter((s): s is ItemStack => s !== null && sim.content.items[s.item]?.category === family).map((s) => ({ ...s }));
  const known = stacks.filter((s) => countInStacks(sim.world.cellar, s.item, s.quality) > 0);
  const fresh = stacks.filter((s) => countInStacks(sim.world.cellar, s.item, s.quality) === 0);
  let moved = 0;
  for (const s of [...known, ...fresh]) {
    const n = storageMove(sim, c, s.item, s.quality, s.count, true);
    moved += n;
    if (n < s.count) break;
  }
  return moved;
}

/** « Ranger »: piles regroupées, triées par famille puis par nom. */
export function sortStorage(sim: Sim): void {
  const merged: ItemStack[] = [];
  for (const s of sim.world.cellar) addStack(merged, s.item, s.quality, s.count);
  const family = (item: string): number => {
    const category = sim.content.items[item]?.category;
    const i = category === undefined ? -1 : DEPOSIT_FAMILIES.indexOf(category);
    return i < 0 ? DEPOSIT_FAMILIES.length : i;
  };
  const name = (item: string): string => sim.content.items[item]?.name ?? item;
  merged.sort((a, b) => family(a.item) - family(b.item) || name(a.item).localeCompare(name(b.item), 'fr') || a.quality.localeCompare(b.quality));
  sim.world.cellar = merged;
  sim.runtime.changed = true;
}

/** Retirer ce meuble de rangement ferait-il déborder le reste ? (refus `storage_remove_refused`) */
export function removalOverflows(sim: Sim, furnitureId: string): boolean {
  const f = sim.world.furniture.find((x) => x.id === furnitureId);
  const cells = f === undefined ? undefined : sim.content.settings.storage?.cells[f.item];
  if (f === undefined || cells === undefined || !furnitureAtHome(sim.map, sim.world.rooms, f)) return false;
  const total = storageCapacity(sim.content, sim.map, sim.world);
  return total !== null && usedCells(sim.content, sim.world.cellar) > total - cells;
}
