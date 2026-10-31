/**
 * Aménagement de la pièce (MA-02 réduit): un meuble du sac en main montre son
 * fantôme devant soi; on le tourne, on le pose, on le reprend.
 */
import { inRect } from '../etat/carte';
import type { Cell, Character, PlacementPreview } from '../etat/types';
import type { ItemDef } from '../donnees/types';
import { TOOLBAR_SLOTS } from './constantes';
import { type Sim, bump, emit, newId } from './contexte';
import { queueHint } from './astuces';
import { footprintCells, rotatedSize } from './deplacement';
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

/** Pourquoi un meuble ne tient pas là (clé `placement_<raison>` de `textes.json`), ou `null` s'il tient. */
export type PlacementProblem = 'outside' | 'wall' | 'overlap' | 'occupied';

/** Le meuble tient-il là ? Dans la pièce, sans chevaucher un autre meuble (sauf tapis) ni un personnage. */
export function canPlace(sim: Sim, item: string, cell: Cell, rotation: number, ignore: string | null = null): boolean {
  return placementProblem(sim, item, cell, rotation, ignore) === null;
}

export function placementProblem(sim: Sim, item: string, cell: Cell, rotation: number, ignore: string | null = null): PlacementProblem | null {
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
  for (const f of sim.world.furniture) {
    if (f.id === ignore) continue;
    const other = sim.content.items[f.item];
    if (other?.footprint === null || other === undefined) continue;
    // Un tapis va sous les autres meubles; deux tapis ne se chevauchent pas.
    if (other.floor !== def.floor) continue;
    const taken = footprintCells(other.footprint, f.cell, f.rotation);
    if (taken.some((t) => cells.some((k) => k.cx === t.cx && k.cy === t.cy))) return 'overlap';
  }
  if (!def.floor && def.bed === null) {
    for (const ch of sim.world.characters) {
      const cx = Math.floor(ch.pos.x);
      const cy = Math.floor(ch.pos.y);
      if (cells.some((k) => k.cx === cx && k.cy === cy)) return 'occupied';
    }
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
  const cell = previewCell(c, rotatedSize(def.footprint, rotation));
  const problem = placementProblem(sim, item, cell, rotation);
  const valid = problem === null;
  const before = c.placement;
  if (before?.item !== item || before.cell.cx !== cell.cx || before.cell.cy !== cell.cy || before.rotation !== rotation || before.valid !== valid) {
    const key = problem === null ? null : `placement_${problem}`;
    // Sans texte dans `textes.json`, l'interface montre son message général.
    const blocked = key === null ? null : (sim.content.texts.messages[key] ?? null);
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
  if (at === null || !canPlace(sim, item, at, r)) return false;
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
  sim.world.furniture.splice(index, 1);
  giveToCharacter(sim, c, f.item, 'ordinary', 1);
  // Le meuble repris passe en main, prêt à être reposé.
  const slot = c.bag.findIndex((s) => s?.item === f.item);
  if (slot >= 0 && slot < TOOLBAR_SLOTS) c.selected = slot;
  sim.runtime.dynamicDirty = true;
  emit(sim, { type: 'furniture_taken', by: c.id, item: f.item });
  return true;
}
