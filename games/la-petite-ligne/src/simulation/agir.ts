/**
 * Viser et agir: ce que ferait Espace devant soi (case surlignée), ce que fait
 * un clic sur une cible, et l'exécution de l'action.
 */
import type { ClickTarget } from '../etat/actions';
import type { AimInfo, AimVerb, Cell, Character, GardenCell, MenuKind, Vec2 } from '../etat/types';
import { AIM_CONE, AIM_DISTANCE } from './constantes';
import { type Sim, bump, character, distance, emit, partnerOf, point } from './contexte';
import { queueHint } from './astuces';
import { ghostNear } from './construction';
import { footprintCells } from './deplacement';
import { talkTo } from './dialogues';
import { nearPoint, shopOpen } from './economie';
import { isBlockedCell } from './grille';
import { refreshBlockers } from './deplacement';
import { ITEM, POINT } from './ids';
import { fishAct, holdsRod, waterAhead } from './peche';
import { feedHens } from './poules';
import { chop, dig, gardenCellAt, gesture, harvest, refill, sow, till, water } from './potager';
import { placeFurniture } from './amenagement';
import { addToBag, dropAt, giveToCharacter, heldStack, takeFromBag } from './sac';
import { harvestTaken, pickupTaken, pickupTakenNear, rememberPickup } from './simultane';

/** Ce sur quoi on peut agir. */
export type Target =
  | { kind: 'villager'; id: string; pos: Vec2 }
  | { kind: 'ground_item'; id: string; pos: Vec2 }
  | { kind: 'beam'; pos: Vec2 }
  | { kind: 'bed'; furniture: string; pos: Vec2 }
  | { kind: 'station'; menu: MenuKind; furniture: string; pos: Vec2 }
  | { kind: 'point'; point: string; pos: Vec2 }
  | { kind: 'construction'; id: string; pos: Vec2 }
  | { kind: 'cell'; cell: Cell; pos: Vec2 }
  | { kind: 'tree'; id: string; pos: Vec2 }
  | { kind: 'partner'; pos: Vec2 }
  | { kind: 'place'; pos: Vec2 };

/** Points du bourg où l'on agit, et le menu qu'ils ouvrent s'il y en a un. */
const POINT_MENUS: Partial<Record<string, MenuKind>> = {
  [POINT.groceryCounter]: 'shop',
  [POINT.noticeBoard]: 'catalogue',
  [POINT.coopCrate]: 'crate',
  [POINT.workbench]: 'workbench',
};
const ACT_POINTS = [POINT.well, POINT.waterBarrel, POINT.groceryCounter, POINT.noticeBoard, POINT.coopCrate, POINT.workbench, POINT.henFeeder];

function frontPoint(c: Character, out: Vec2): Vec2 {
  out.x = c.pos.x + Math.cos(c.facing) * AIM_DISTANCE;
  out.y = c.pos.y + Math.sin(c.facing) * AIM_DISTANCE;
  return out;
}

function furnitureCentre(sim: Sim, f: { item: string; cell: Cell; rotation: number }): Vec2 {
  const def = sim.content.items[f.item];
  const fp = def?.footprint ?? { w: 1, d: 1 };
  const cells = footprintCells(fp, f.cell, f.rotation);
  let x = 0;
  let y = 0;
  for (const k of cells) {
    x += k.cx + 0.5;
    y += k.cy + 0.5;
  }
  return { x: x / cells.length, y: y / cells.length };
}

/** Le verbe d'une cible pour ce personnage, ou `null` s'il n'y a rien à faire. */
export function verbOf(sim: Sim, c: Character, t: Target): AimVerb | null {
  const held = heldStack(c);
  const heldDef = held === null ? undefined : sim.content.items[held.item];
  switch (t.kind) {
    case 'villager':
      return 'talk';
    case 'ground_item':
      return 'pickup';
    case 'beam':
      return 'carry';
    case 'bed': {
      const f = sim.world.furniture.find((x) => x.id === t.furniture);
      const sleepers = f === undefined ? 0 : (sim.content.items[f.item]?.bed?.sleepers ?? 0);
      const used = sim.world.characters.filter((x) => x.bedId === t.furniture).length;
      return used < sleepers ? 'sleep' : null;
    }
    case 'station':
      return 'open';
    case 'point':
      if (t.point === POINT.well || t.point === POINT.waterBarrel) return held?.item === ITEM.wateringCan ? 'refill' : null;
      if (t.point === POINT.henFeeder) return sim.world.hens.length > 0 ? 'feed' : null;
      if (t.point === POINT.groceryCounter) return shopOpen(sim) ? 'open' : null;
      return 'open';
    case 'construction':
      return 'build';
    case 'tree': {
      const tree = sim.world.trees.find((x) => x.id === t.id);
      return tree !== undefined && !tree.felled && held?.item === ITEM.axe ? 'chop' : null;
    }
    case 'partner':
      return held !== null && heldDef?.category !== 'tool' ? 'give' : null;
    case 'place':
      return 'place';
    case 'cell': {
      const g = gardenCellAt(sim, t.cell);
      if (g !== null) return gardenVerb(sim, g, held?.item ?? null);
      if (held?.item === ITEM.hoe && !c.inHouse && !isBlockedCell(refreshBlockers(sim), t.cell.cx, t.cell.cy)) return 'dig';
      return null;
    }
  }
}

function gardenVerb(sim: Sim, g: GardenCell, held: string | null): AimVerb | null {
  if (g.crop?.ripe === true) return 'harvest';
  const heldDef = held === null ? undefined : sim.content.items[held];
  if (g.soil === 'grass') return held === ITEM.hoe ? 'till' : null;
  if (heldDef?.category === 'seed' && g.crop === null) return 'sow';
  if (held === ITEM.wateringCan) return 'water';
  return null;
}

/** Ordre de préférence quand plusieurs cibles sont devant soi. */
const TIER: Record<Target['kind'], number> = {
  villager: 0,
  ground_item: 1,
  beam: 2,
  place: 3,
  bed: 4,
  station: 4,
  point: 4,
  partner: 5,
  construction: 6,
  tree: 7,
  cell: 8,
};

/**
 * Une case du potager où l'on a quelque chose à faire (bêcher, semer, arroser,
 * récolter) passe avant les chantiers et les arbres voisins: la porte touche
 * le potager au nord, le poulailler est juste à l'est.
 */
const GARDEN_TIER = TIER.partner;

function tierOf(sim: Sim, t: Target): number {
  return t.kind === 'cell' && gardenCellAt(sim, t.cell) !== null ? GARDEN_TIER : TIER[t.kind];
}

function inCone(c: Character, pos: Vec2): boolean {
  const d = distance(c.pos, pos);
  if (d < 0.6) return true;
  const angle = Math.atan2(pos.y - c.pos.y, pos.x - c.pos.x);
  let diff = Math.abs(angle - c.facing) % (2 * Math.PI);
  if (diff > Math.PI) diff = 2 * Math.PI - diff;
  return diff <= AIM_CONE;
}

/** Toutes les cibles à portée de ce personnage (et la case devant lui). */
export function candidates(sim: Sim, c: Character): Target[] {
  const s = sim.content.settings;
  const out: Target[] = [];
  const reach = s.ranges.action;
  for (const v of sim.world.villagers) {
    if (v.visible && distance(c.pos, v.pos) <= s.ranges.talk) out.push({ kind: 'villager', id: v.id, pos: v.pos });
  }
  for (const g of sim.world.groundItems) {
    if (distance(c.pos, g.pos) <= reach) out.push({ kind: 'ground_item', id: g.id, pos: g.pos });
  }
  const beam = sim.world.beam;
  if (beam !== null && !beam.carried && distance(c.pos, beam.pos) <= s.feel.beamGrabRange) out.push({ kind: 'beam', pos: beam.pos });
  if (c.placement !== null) out.push({ kind: 'place', pos: { x: c.placement.cell.cx + 0.5, y: c.placement.cell.cy + 0.5 } });
  for (const f of sim.world.furniture) {
    const def = sim.content.items[f.item];
    if (def === undefined) continue;
    const centre = furnitureCentre(sim, f);
    if (distance(c.pos, centre) > reach + 0.5) continue;
    if (def.bed !== null) out.push({ kind: 'bed', furniture: f.id, pos: centre });
    else if (def.station === 'stove') out.push({ kind: 'station', menu: 'stove', furniture: f.id, pos: centre });
    else if (def.storage === 'cellar') out.push({ kind: 'station', menu: 'chest', furniture: f.id, pos: centre });
  }
  for (const id of ACT_POINTS) {
    const at = sim.map.points[id];
    if (at !== undefined && distance(c.pos, at) <= reach) out.push({ kind: 'point', point: id, pos: at });
  }
  const ghost = ghostNear(sim, c);
  if (ghost !== null) out.push({ kind: 'construction', id: ghost.state.id, pos: point(sim, ghost.def.point) });
  for (const t of sim.world.trees) {
    if (!t.felled && distance(c.pos, t.pos) <= reach + 0.3) out.push({ kind: 'tree', id: t.id, pos: t.pos });
  }
  const other = character(sim, partnerOf(c.id));
  if (other.created && distance(c.pos, other.pos) <= reach) out.push({ kind: 'partner', pos: other.pos });
  const front = frontPoint(c, { x: 0, y: 0 });
  const cell = { cx: Math.floor(front.x), cy: Math.floor(front.y) };
  out.push({ kind: 'cell', cell, pos: { x: cell.cx + 0.5, y: cell.cy + 0.5 } });
  return out;
}

/** La meilleure cible devant soi (Espace), avec son verbe. */
export function bestTarget(sim: Sim, c: Character): { target: Target; verb: AimVerb | null } | null {
  const front = frontPoint(c, { x: 0, y: 0 });
  let best: { target: Target; verb: AimVerb | null; tier: number; d: number } | null = null;
  for (const t of candidates(sim, c)) {
    // Un chantier se vise comme le reste, dans le regard (son point peut être derrière soi).
    if (t.kind !== 'cell' && t.kind !== 'place' && !inCone(c, t.pos)) continue;
    const verb = verbOf(sim, c, t);
    if (verb === null && t.kind !== 'cell') continue;
    const tier = verb === null ? 99 : tierOf(sim, t);
    const d = distance(front, t.pos);
    if (best === null || tier < best.tier || (tier === best.tier && d < best.d)) best = { target: t, verb, tier, d };
  }
  return best === null ? null : { target: best.target, verb: best.verb };
}

/** Case surlignée devant le personnage (pour le rendu) et astuces de visée. */
export function updateAim(sim: Sim, c: Character): void {
  if (c.status !== 'active' || !c.created) {
    if (c.aim !== null) c.aim = null;
    return;
  }
  const best = bestTarget(sim, c);
  let aim: AimInfo | null = null;
  const water = holdsRod(c) ? (c.fishing?.bobber ?? waterAhead(sim, c)) : null;
  if (water !== null) {
    aim = { cell: { cx: Math.floor(water.x), cy: Math.floor(water.y) }, verb: 'fish', blocked: null };
  } else if (best !== null) {
    const pos = best.target.kind === 'cell' ? { x: best.target.cell.cx + 0.5, y: best.target.cell.cy + 0.5 } : best.target.pos;
    aim = { cell: { cx: Math.floor(pos.x), cy: Math.floor(pos.y) }, verb: best.verb, blocked: null };
    if (best.verb !== null) queueHint(sim, c.id, { on: 'near_interactable' });
    if (best.target.kind === 'cell') {
      const g = gardenCellAt(sim, best.target.cell);
      const held = heldStack(c);
      if (g !== null) {
        queueHint(sim, c.id, {
          on: 'aim_cell',
          cellState: g.soil,
          tool: held?.item ?? null,
          holding: held === null ? null : (sim.content.items[held.item]?.category ?? null),
        });
      }
    }
  }
  const before = c.aim;
  const same =
    (before === null && aim === null) ||
    (before !== null && aim !== null && before.cell.cx === aim.cell.cx && before.cell.cy === aim.cell.cy && before.verb === aim.verb);
  if (!same) {
    c.aim = aim;
    sim.runtime.changed = true;
  }
}

/** Ouvre un menu du jeu (déclaré par la simulation à côté d'un comptoir, ou par l'interface). */
export function openMenu(sim: Sim, c: Character, menu: MenuKind | null): void {
  c.menu = menu;
  if (c.status === 'active' || c.status === 'menu') c.status = menu === null ? 'active' : 'menu';
  sim.runtime.changed = true;
}

export function goToBed(sim: Sim, c: Character, furnitureId: string): void {
  const f = sim.world.furniture.find((x) => x.id === furnitureId);
  if (f === undefined) return;
  const centre = furnitureCentre(sim, f);
  const other = character(sim, partnerOf(c.id));
  // Lit double: chacun son côté.
  const side = other.bedId === furnitureId ? 0.45 : -0.45;
  const def = sim.content.items[f.item];
  const twoSleepers = (def?.bed?.sleepers ?? 1) > 1;
  c.pos.x = centre.x + (twoSleepers ? side : 0);
  c.pos.y = centre.y;
  c.bedId = furnitureId;
  c.status = 'sleeping';
  c.menu = null;
  c.action = { kind: 'sleep', since: sim.world.tick, duration: 0, target: null };
  bump(sim, 'bed', c.id);
  bump(sim, `bed:${f.item}`, c.id);
  emit(sim, { type: 'went_to_bed', by: c.id });
}

export function getUp(sim: Sim, c: Character): void {
  if (c.status !== 'sleeping') return;
  c.status = 'active';
  c.bedId = null;
  c.action = { kind: 'idle', since: sim.world.tick, duration: 0, target: null };
  emit(sim, { type: 'got_up', by: c.id });
}

function pickUp(sim: Sim, c: Character, id: string): void {
  const index = sim.world.groundItems.findIndex((g) => g.id === id);
  const g = sim.world.groundItems[index];
  if (g === undefined) return;
  sim.world.groundItems.splice(index, 1);
  const left = addToBag(sim, c, g.item, g.quality, g.count);
  if (left > 0) dropAt(sim, g.pos.x, g.pos.y, g.item, g.quality, left);
  if (left < g.count) rememberPickup(sim, c, g.id, g.pos);
  gesture(sim, c, 'pickup', sim.content.settings.feel.actionSeconds.pickup ?? 0, { x: g.pos.x, y: g.pos.y });
  bump(sim, `picked:${g.item}`, c.id, g.count - left);
  emit(sim, { type: 'picked_up', by: c.id, item: g.item, count: g.count - left });
}

function giveHeld(sim: Sim, c: Character): void {
  const held = heldStack(c);
  if (held === null) return;
  const other = character(sim, partnerOf(c.id));
  const { item, quality, count } = held;
  takeFromBag(c, item, count, quality);
  giveToCharacter(sim, other, item, quality, count);
  emit(sim, { type: 'gave', by: c.id, to: other.id, item, count });
}

/** Exécute le verbe sur la cible. */
export function perform(sim: Sim, c: Character, t: Target, verb: AimVerb): void {
  c.facing = Math.atan2(t.pos.y - c.pos.y, t.pos.x - c.pos.x);
  switch (verb) {
    case 'talk':
      if (t.kind === 'villager') talkTo(sim, c, t.id);
      return;
    case 'pickup':
      if (t.kind === 'ground_item') pickUp(sim, c, t.id);
      return;
    case 'carry':
      queueHint(sim, c.id, { on: 'near_point', point: 'beam_pickup' });
      return;
    case 'build':
      queueHint(sim, c.id, { on: 'near_construction' });
      return;
    case 'sleep':
      if (t.kind === 'bed') goToBed(sim, c, t.furniture);
      return;
    case 'open':
      if (t.kind === 'station') openMenu(sim, c, t.menu);
      else if (t.kind === 'point') {
        const menu = POINT_MENUS[t.point];
        if (menu !== undefined) openMenu(sim, c, menu);
      }
      return;
    case 'refill':
      if (t.kind === 'point') refill(sim, c, t.point);
      return;
    case 'feed':
      feedHens(sim, c);
      return;
    case 'place':
      placeFurniture(sim, c, null, null);
      return;
    case 'give':
      giveHeld(sim, c);
      return;
    case 'chop': {
      const tree = t.kind === 'tree' ? sim.world.trees.find((x) => x.id === t.id) : undefined;
      if (tree !== undefined) chop(sim, c, tree);
      return;
    }
    case 'dig':
      if (t.kind === 'cell') dig(sim, c, t.pos);
      return;
    case 'fish':
      fishAct(sim, c);
      return;
    case 'till':
    case 'sow':
    case 'water':
    case 'harvest': {
      const g = t.kind === 'cell' ? gardenCellAt(sim, t.cell) : null;
      if (g === null) return;
      const held = heldStack(c);
      if (verb === 'till') till(sim, c, g);
      else if (verb === 'sow' && held !== null) sow(sim, c, g, held.item);
      else if (verb === 'water') water(sim, c, g);
      else harvest(sim, c, g);
      return;
    }
  }
}

/** Espace: agir sur ce qui est devant soi. */
export function actFront(sim: Sim, c: Character): void {
  if (holdsRod(c) && (c.fishing !== null || waterAhead(sim, c) !== null)) {
    fishAct(sim, c);
    return;
  }
  const best = bestTarget(sim, c);
  if (best !== null && best.verb !== null) {
    perform(sim, c, best.target, best.verb);
    return;
  }
  if (best !== null && takenByPartner(sim, c, best.target, sim.world.tick)) return;
  const reach = sim.content.settings.ranges.action;
  pickupTakenNear(sim, c, (pos) => distance(c.pos, pos) <= reach && inCone(c, pos));
}

/** Rien à faire sur la cible visée au pas `since`: l'autre vient-il de la récolter (SI-01) ? Vrai si c'est dit. */
function takenByPartner(sim: Sim, c: Character, t: Target, since: number): boolean {
  if (t.kind !== 'cell') return false;
  const g = gardenCellAt(sim, t.cell);
  return g !== null && harvestTaken(sim, c, g, since);
}

/**
 * Agir sur la cible d'un clic (`target`, déjà résolue; `null` si elle n'est
 * plus là), comme le ferait la touche. `since`: pas du clic, même pour un
 * clic lointain qui agit à l'arrivée (« Déjà pris » compte depuis le clic).
 */
export function actOnClick(sim: Sim, c: Character, click: ClickTarget, target: Target | null, since: number): void {
  if (target === null) {
    if (click.kind === 'ground_item') pickupTaken(sim, c, click.groundItem, since);
    return;
  }
  const verb = verbOf(sim, c, target);
  if (verb !== null) perform(sim, c, target, verb);
  else takenByPartner(sim, c, target, since);
}

/** Cible d'un clic, traduite en cible de la simulation (avec sa position). */
export function resolveClick(sim: Sim, c: Character, click: ClickTarget): Target | null {
  switch (click.kind) {
    case 'villager': {
      const v = sim.world.villagers.find((x) => x.id === click.villager);
      return !v?.visible ? null : { kind: 'villager', id: v.id, pos: v.pos };
    }
    case 'ground_item': {
      const g = sim.world.groundItems.find((x) => x.id === click.groundItem);
      return g === undefined ? null : { kind: 'ground_item', id: g.id, pos: g.pos };
    }
    case 'tree': {
      const t = sim.world.trees.find((x) => x.id === click.tree);
      return t === undefined ? null : { kind: 'tree', id: t.id, pos: t.pos };
    }
    case 'character':
      return click.character === c.id ? null : { kind: 'partner', pos: character(sim, click.character).pos };
    case 'furniture': {
      const f = sim.world.furniture.find((x) => x.id === click.furniture);
      const def = f === undefined ? undefined : sim.content.items[f.item];
      if (f === undefined || def === undefined) return null;
      const centre = furnitureCentre(sim, f);
      if (def.bed !== null) return { kind: 'bed', furniture: f.id, pos: centre };
      if (def.station === 'stove') return { kind: 'station', menu: 'stove', furniture: f.id, pos: centre };
      if (def.storage === 'cellar') return { kind: 'station', menu: 'chest', furniture: f.id, pos: centre };
      return null;
    }
    case 'ground': {
      const at = { x: click.x, y: click.y };
      const beam = sim.world.beam;
      if (beam !== null && distance(beam.pos, at) <= 1) return { kind: 'beam', pos: beam.pos };
      for (const id of ACT_POINTS) {
        const p = sim.map.points[id];
        if (p !== undefined && distance(p, at) <= 1.2) return { kind: 'point', point: id, pos: p };
      }
      const cell = { cx: Math.floor(click.x), cy: Math.floor(click.y) };
      return { kind: 'cell', cell, pos: { x: cell.cx + 0.5, y: cell.cy + 0.5 } };
    }
  }
}

/** Portée à laquelle on agit sur une cible. */
export function reachFor(sim: Sim, t: Target): number {
  const r = sim.content.settings.ranges;
  return t.kind === 'villager' ? r.talk - 0.3 : t.kind === 'beam' ? sim.content.settings.feel.beamGrabRange - 0.3 : r.action;
}

export function nearPointFor(sim: Sim, c: Character, id: string): boolean {
  return nearPoint(sim, c, id, sim.content.settings.ranges.action);
}
