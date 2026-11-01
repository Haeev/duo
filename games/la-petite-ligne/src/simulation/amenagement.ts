/**
 * Aménagement de la pièce (MA-02 réduit): un meuble du sac en main montre son
 * fantôme devant soi; on le tourne, on le pose, on le reprend.
 * Coin à soi (MA-06 de la démo): chacun désigne un carré de 2x2 cases de la
 * pièce où lui seul pose et reprend des meubles.
 */
import { type GameMap, inRect } from '../etat/carte';
import { CORNER_SIZE, type Cell, type Character, type CharacterId, type PlacementPreview } from '../etat/types';
import type { ItemDef } from '../donnees/types';
import { TOOLBAR_SLOTS } from './constantes';
import { type Sim, bump, emit, message, newId, partnerName, partnerOf, say } from './contexte';
import { queueHint } from './astuces';
import { closesRoom } from './deblocage';
import { footprintCells, rotatedSize, touchesCell } from './deplacement';
import { giveToCharacter, heldItem, takeFromBag } from './sac';

function quarterOf(facing: number): number {
  // 0 est, 1 sud, 2 ouest, 3 nord.
  const q = Math.round(facing / (Math.PI / 2));
  return ((q % 4) + 4) % 4;
}

const DIRS: readonly [number, number][] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

/** Meubles et décorations (la plume de geai) se posent dans la pièce. */
function isPlaceable(def: ItemDef | undefined): def is ItemDef {
  return def !== undefined && def.footprint !== null && (def.category === 'furniture' || def.category === 'decoration');
}

/** Coin nord-ouest d'une empreinte posée juste devant le personnage. */
export function previewCell(c: Character, size: { w: number; d: number }): Cell {
  const q = quarterOf(c.facing);
  const [dx, dy] = DIRS[q] ?? [1, 0];
  const fx = Math.floor(c.pos.x) + dx;
  const fy = Math.floor(c.pos.y) + dy;
  switch (q) {
    case 0:
      return { cx: fx, cy: fy - Math.floor((size.d - 1) / 2) };
    case 2:
      return { cx: fx - (size.w - 1), cy: fy - Math.floor((size.d - 1) / 2) };
    case 1:
      return { cx: fx - Math.floor((size.w - 1) / 2), cy: fy };
    default:
      return { cx: fx - Math.floor((size.w - 1) / 2), cy: fy - (size.d - 1) };
  }
}

/**
 * Coin nord-ouest d'une empreinte centrée sur le point du sol que survole la souris (R11), s'il est
 * dans la pièce; sinon `null` et l'aperçu reste devant le personnage (clavier).
 */
export function pointerCell(sim: Sim, c: Character, size: { w: number; d: number }): Cell | null {
  const target = sim.runtime.pointer[c.id];
  if (target?.kind !== 'ground' || !inRect(sim.map.house.room, target.x, target.y)) return null;
  return { cx: Math.round(target.x - size.w / 2), cy: Math.round(target.y - size.d / 2) };
}

/** Pourquoi un meuble ne tient pas là (clé `placement_<raison>` de `textes.json`), ou `null` s'il tient. */
/**
 * Dos au mur (convention de la carte: rotation 0 tournée vers le sud, 1 l'est, 2 le nord,
 * 3 l'ouest): toutes les cases du dos touchent le mur opposé à la face.
 */
function backAgainstWall(room: { x: number; y: number; w: number; h: number }, cells: readonly Cell[], rotation: number): boolean {
  const r = ((rotation % 4) + 4) % 4;
  if (r === 0) return cells.some((k) => k.cy === room.y);
  if (r === 1) return cells.some((k) => k.cx === room.x);
  if (r === 2) return cells.some((k) => k.cy === room.y + room.h - 1);
  return cells.some((k) => k.cx === room.x + room.w - 1);
}

/** Texte de la raison: le plus précis s'il est écrit (`placement_back_wall`), sinon `placement_wall`. */
function problemKey(sim: Sim, problem: PlacementProblem): string {
  const key = PROBLEM_KEYS[problem];
  return problem === 'back_wall' && !Object.hasOwn(sim.content.texts.messages, key) ? PROBLEM_KEYS.wall : key;
}

export type PlacementProblem = 'outside' | 'wall' | 'back_wall' | 'not_yours' | 'overlap' | 'occupied' | 'blocks_way';

const PROBLEM_KEYS: Record<PlacementProblem, string> = {
  outside: 'placement_outside',
  wall: 'placement_wall',
  back_wall: 'placement_back_wall',
  not_yours: 'placement_not_yours',
  overlap: 'placement_overlap',
  occupied: 'placement_occupied',
  blocks_way: 'placement_blocks_way',
};

/**
 * Le meuble tient-il là ? Dans la pièce, hors du coin de l'autre, sans
 * chevaucher un autre meuble (sauf tapis) ni un personnage. Sans `by`, tout
 * coin compte comme celui d'un autre (recherche de place du robot).
 */
export function canPlace(sim: Sim, item: string, cell: Cell, rotation: number, ignore: string | null = null, by?: CharacterId): boolean {
  return placementProblem(sim, item, cell, rotation, ignore, by) === null;
}

export function placementProblem(
  sim: Sim,
  item: string,
  cell: Cell,
  rotation: number,
  ignore: string | null = null,
  by?: CharacterId,
): PlacementProblem | null {
  const def = sim.content.items[item];
  if (def?.footprint === null || def === undefined) return 'outside';
  const room = sim.map.house.room;
  const cells = footprintCells(def.footprint, cell, rotation);
  if (!cells.every((k) => inRect(room, k.cx + 0.5, k.cy + 0.5))) return 'outside';
  if (def.wall) {
    const onEdge = cells.some(
      (k) => k.cx === room.x || k.cy === room.y || k.cx === room.x + room.w - 1 || k.cy === room.y + room.h - 1,
    );
    if (!onEdge) return 'wall';
  }
  if (def.backToWall && !backAgainstWall(room, cells, rotation)) return 'back_wall';
  if (cornerOwnerOf(sim, cells, by) !== null) return 'not_yours';
  for (const f of sim.world.furniture) {
    if (f.id === ignore) continue;
    const other = sim.content.items[f.item];
    if (other?.footprint === null || other === undefined) continue;
    // Un tapis va sous les autres meubles; deux tapis ne se chevauchent pas.
    if (other.floor !== def.floor) continue;
    const taken = footprintCells(other.footprint, f.cell, f.rotation);
    if (taken.some((t) => cells.some((k) => k.cx === t.cx && k.cy === t.cy))) return 'overlap';
  }
  // Ce qui barre le passage (ni tapis, ni lit, ni objet mural) ne touche aucun corps et ne coupe
  // aucune case de la pièce de sa porte (R01: les deux personnages étaient restés enfermés).
  if (!def.floor && !def.wall && def.bed === null) {
    for (const ch of sim.world.characters) {
      if (cells.some((k) => touchesCell(ch.pos, k))) return 'occupied';
    }
    if (closesRoom(sim, cells)) return 'blocks_way';
  }
  return null;
}

/** Met à jour l'aperçu du meuble en main (dans la maison seulement). */
export function updatePlacement(sim: Sim, c: Character): void {
  const item = heldItem(c);
  const def = item === null ? undefined : sim.content.items[item];
  if (item === null || !isPlaceable(def) || def.footprint === null || !c.inHouse || c.status !== 'active') {
    if (c.placement !== null) {
      c.placement = null;
      sim.runtime.changed = true;
    }
    return;
  }
  const rotation = c.placement?.item === item ? c.placement.rotation : 0;
  const size = rotatedSize(def.footprint, rotation);
  const cell = pointerCell(sim, c, size) ?? previewCell(c, size);
  const problem = placementProblem(sim, item, cell, rotation, null, c.id);
  const valid = problem === null;
  // Sans texte dans `textes.json`, la clé: l'interface la traduit, sinon montre son message général.
  const blocked = problem === null ? null : message(sim, problemKey(sim, problem), { partner: partnerName(sim, c.id) });
  const before = c.placement;
  if (
    before?.item !== item ||
    before.cell.cx !== cell.cx ||
    before.cell.cy !== cell.cy ||
    before.rotation !== rotation ||
    before.valid !== valid ||
    before.blocked !== blocked
  ) {
    c.placement = { item, cell, rotation, valid, blocked };
    sim.runtime.changed = true;
    if (before === null) queueHint(sim, c.id, { on: 'holding_furniture' });
  }
}

export function rotatePlacement(sim: Sim, c: Character, delta: number): void {
  const p: PlacementPreview | null = c.placement;
  if (p === null) return;
  p.rotation = (((p.rotation + Math.sign(delta)) % 4) + 4) % 4;
  updatePlacement(sim, c);
  sim.runtime.changed = true;
}

/** Pose le meuble tenu (à l'aperçu, ou à la case donnée par un clic). */
export function placeFurniture(sim: Sim, c: Character, cell: Cell | null, rotation: number | null): boolean {
  const item = heldItem(c);
  if (item === null || !c.inHouse) return false;
  const def = sim.content.items[item];
  if (!isPlaceable(def) || def.footprint === null) return false;
  const r = rotation ?? c.placement?.rotation ?? 0;
  const at = cell ?? c.placement?.cell ?? null;
  if (at === null) return false;
  const problem = placementProblem(sim, item, at, r, null, c.id);
  if (problem === 'not_yours') say(sim, c.id, PROBLEM_KEYS.not_yours, { partner: partnerName(sim, c.id) });
  if (problem !== null) return false;
  if (takeFromBag(c, item, 1).length === 0) return false;
  const id = newId(sim, 'f');
  sim.world.furniture.push({ id, item, cell: { cx: at.cx, cy: at.cy }, rotation: r, placedBy: c.id });
  c.placement = null;
  sim.runtime.dynamicDirty = true;
  bump(sim, 'placed', c.id);
  bump(sim, `placed:${item}`, c.id);
  emit(sim, { type: 'furniture_placed', by: c.id, furniture: id, item });
  return true;
}

/** Reprend un meuble posé dans le sac (X, clic droit). */
export function takeFurniture(sim: Sim, c: Character, furnitureId: string): boolean {
  const index = sim.world.furniture.findIndex((f) => f.id === furnitureId);
  const f = sim.world.furniture[index];
  if (f === undefined) return false;
  if (sim.world.characters.some((ch) => ch.bedId === f.id)) return false;
  const def = sim.content.items[f.item];
  const owner = def === undefined || def.footprint === null ? null : cornerOwnerOf(sim, footprintCells(def.footprint, f.cell, f.rotation), c.id);
  if (owner !== null) {
    say(sim, c.id, 'corner_not_yours', { partner: owner.name });
    return false;
  }
  sim.world.furniture.splice(index, 1);
  giveToCharacter(sim, c, f.item, 'ordinary', 1);
  // Le meuble repris passe en main, prêt à être reposé.
  const slot = c.bag.findIndex((s) => s?.item === f.item);
  if (slot >= 0 && slot < TOOLBAR_SLOTS) c.selected = slot;
  sim.runtime.dynamicDirty = true;
  emit(sim, { type: 'furniture_taken', by: c.id, item: f.item });
  return true;
}

// ---------------------------------------------------------------------------
// Coin à soi

/** Pourquoi un coin ne peut pas aller là (clé `corner_<raison>`), ou `null`. */
export type CornerProblem = 'outside' | 'taken' | 'partner_things';

const CORNER_KEYS: Record<CornerProblem, string> = {
  outside: 'corner_outside',
  taken: 'corner_taken',
  partner_things: 'corner_partner_things',
};

/** Les cases du coin dont `cell` est la case nord-ouest. */
export function cornerCells(cell: Cell): Cell[] {
  const cells: Cell[] = [];
  for (let dy = 0; dy < CORNER_SIZE; dy++) {
    for (let dx = 0; dx < CORNER_SIZE; dx++) cells.push({ cx: cell.cx + dx, cy: cell.cy + dy });
  }
  return cells;
}

function inCorner(corner: Cell, k: Cell): boolean {
  return k.cx >= corner.cx && k.cy >= corner.cy && k.cx < corner.cx + CORNER_SIZE && k.cy < corner.cy + CORNER_SIZE;
}

/** Le propriétaire d'un coin (autre que `except`) qui touche l'une de ces cases, ou `null`. */
export function cornerOwnerOf(sim: Sim, cells: readonly Cell[], except?: CharacterId): Character | null {
  for (const ch of sim.world.characters) {
    const corner = ch.id === except ? null : (ch.corner ?? null);
    if (corner !== null && cells.some((k) => inCorner(corner, k))) return ch;
  }
  return null;
}

/** Le carré de la pièce dont le centre est le plus près du point (collé aux murs si besoin). */
export function cornerAt(map: GameMap, x: number, y: number): Cell {
  const room = map.house.room;
  const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
  return {
    cx: clamp(Math.round(x - CORNER_SIZE / 2), room.x, room.x + room.w - CORNER_SIZE),
    cy: clamp(Math.round(y - CORNER_SIZE / 2), room.y, room.y + room.h - CORNER_SIZE),
  };
}

function cornerFits(map: GameMap, cell: Cell): boolean {
  const room = map.house.room;
  return cornerCells(cell).every((k) => inRect(room, k.cx + 0.5, k.cy + 0.5));
}

/** Le coin peut-il aller là ? Dans la pièce, sans toucher le coin de l'autre ni un meuble qu'il a posé. */
export function cornerProblem(sim: Sim, c: Character, cell: Cell): CornerProblem | null {
  if (!cornerFits(sim.map, cell)) return 'outside';
  const cells = cornerCells(cell);
  const partner = sim.world.characters.find((ch) => ch.id === partnerOf(c.id));
  const theirs = partner?.corner ?? null;
  if (theirs !== null && cells.some((k) => inCorner(theirs, k))) return 'taken';
  for (const f of sim.world.furniture) {
    if (f.placedBy === null || f.placedBy === c.id) continue;
    const def = sim.content.items[f.item];
    if (def === undefined || def.footprint === null) continue;
    const taken = footprintCells(def.footprint, f.cell, f.rotation);
    if (taken.some((k) => cells.some((t) => t.cx === k.cx && t.cy === k.cy))) return 'partner_things';
  }
  return null;
}

/**
 * Désigne son coin au carré le plus proche du point (x, y), ou le déplace.
 * Au même endroit, le retire. Il faut être dans la maison.
 */
export function designateCorner(sim: Sim, c: Character, x: number, y: number): void {
  if (!c.inHouse) {
    say(sim, c.id, CORNER_KEYS.outside);
    return;
  }
  const cell = cornerAt(sim.map, x, y);
  const before = c.corner ?? null;
  if (before !== null && before.cx === cell.cx && before.cy === cell.cy) {
    clearCorner(sim, c);
    return;
  }
  const problem = cornerProblem(sim, c, cell);
  if (problem !== null) {
    say(sim, c.id, CORNER_KEYS[problem], { partner: partnerName(sim, c.id) });
    return;
  }
  c.corner = cell;
  sim.runtime.changed = true;
  say(sim, c.id, before === null ? 'corner_set' : 'corner_moved');
  say(sim, partnerOf(c.id), 'corner_partner_set', { partner: c.name });
}

export function clearCorner(sim: Sim, c: Character): void {
  if ((c.corner ?? null) === null) return;
  c.corner = null;
  sim.runtime.changed = true;
  say(sim, c.id, 'corner_removed');
}

/**
 * Coin relu d'une sauvegarde (données du disque): une case entière dont le
 * carré tient dans la pièce, sinon `null` (aussi pour les sauvegardes d'avant
 * le coin, qui n'ont pas ce champ).
 */
export function sanitizeCorner(map: GameMap, value: unknown): Cell | null {
  if (typeof value !== 'object' || value === null) return null;
  const { cx, cy } = value as { cx?: unknown; cy?: unknown };
  if (typeof cx !== 'number' || typeof cy !== 'number' || !Number.isInteger(cx) || !Number.isInteger(cy)) return null;
  const cell = { cx, cy };
  return cornerFits(map, cell) ? cell : null;
}
