/**
 * Aménagement de la pièce (MA-02 réduit): un meuble du sac en main montre son
 * fantôme devant soi; on le tourne, on le pose, on le reprend.
 * Coin à soi (MA-06 de la démo): chacun désigne un carré de 2x2 cases de la
 * pièce où lui seul pose et reprend des meubles.
 * Tour 10 (lot L4): on pose dans toute pièce de la maisonnette (le cellier, la chambre une fois
 * bâtis); les étagères hautes aux places du cellier; les rideaux seulement à une fenêtre libre
 * (`pieces.json`, nœuds `window_<n>` du modèle), qu'on ouvre et qu'on ferme.
 * 0.11.2 (S03): un petit objet (plume de geai, pot de fleurs) se pose aussi sur le dessus d'un
 * meuble porteur (table, coffre), à l'une de ses places (`surface` de `objets.json`).
 */
import { type GameMap, HOUSE_BUILDING, type MapRoom, type Rect, inRect } from '../etat/carte';
import { isHome } from '../etat/interieurs';
import { TOOL_RACK } from './ids';
import { CORNER_SIZE, type Cell, type Character, type CharacterId, type PlacedDecor, type PlacedFurniture, type PlacementPreview, type Vec2 } from '../etat/types';
import type { ItemDef } from '../donnees/types';
import type { WindowDef, WindowSide } from '../donnees/maison';
import { activeHouseRooms, curtainsAt, houseRoomAt, windowsNow } from '../etat/maison';
import { wallPlacement } from '../etat/murs';
import { addHeart } from './besoins';
import { removalOverflows, storeAtHome } from './rangement';
import { TOOLBAR_SLOTS } from './constantes';
import { type Sim, bump, emit, message, newId, partnerName, partnerOf, say } from './contexte';
import { queueHint } from './astuces';
import { closesRoom } from './deblocage';
import { footprintCells, rotatedSize, touchesCell } from './deplacement';
import { addToBag, giveToCharacter, heldItem, takeFromBag } from './sac';

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
  if (target?.kind !== 'ground' || houseRoomAt(sim.map, sim.world.rooms, target.x, target.y) === null) return null;
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

export type PlacementProblem =
  | 'outside'
  | 'wall'
  | 'wall_opening'
  | 'back_wall'
  | 'not_yours'
  | 'overlap'
  | 'occupied'
  | 'blocks_way'
  | 'not_window'
  | 'fenestron'
  | 'rack_place';

const PROBLEM_KEYS: Record<PlacementProblem, string> = {
  outside: 'placement_outside',
  wall: 'placement_wall',
  wall_opening: 'placement_wall_opening',
  back_wall: 'placement_back_wall',
  not_yours: 'placement_not_yours',
  overlap: 'placement_overlap',
  occupied: 'placement_occupied',
  blocks_way: 'placement_blocks_way',
  not_window: 'placement_not_window',
  fenestron: 'placement_fenestron',
  rack_place: 'placement_rack_place',
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
  if (isCurtains(def)) return curtainsProblem(sim, cell);
  const cells = footprintCells(def.footprint, cell, rotation);
  const first = cells[0];
  const home = first === undefined ? null : houseRoomAt(sim.map, sim.world.rooms, first.cx + 0.5, first.cy + 0.5);
  if (home === null || !cells.every((k) => inRect(home.rect, k.cx + 0.5, k.cy + 0.5))) return 'outside';
  const room = home.rect;
  // L'étagère haute du cellier: seulement à l'une de ses deux places (section 5.2).
  if (sim.content.settings.storage !== null && item === RACK_ITEM && !onShelfPlace(home, cells)) return 'rack_place';
  if (def.wall) {
    // Objet mural (R15, R17): une place sur le mur, pas une case du sol. Refusé par une fenêtre, une
    // porte, un autre objet mural ou un meuble haut à cet endroit du mur; le mobilier bas ne compte pas.
    const placed = wallPlacement(sim.content, sim.map, sim.world, item, cell, rotation, ignore);
    if (typeof placed === 'string') return placed;
    return cornerOwnerOf(sim, cells, by) !== null ? 'not_yours' : null;
  }
  if (def.backToWall && !backAgainstWall(room, cells, rotation)) return 'back_wall';
  if (cornerOwnerOf(sim, cells, by) !== null) return 'not_yours';
  for (const f of sim.world.furniture) {
    if (f.id === ignore) continue;
    const other = sim.content.items[f.item];
    if (other?.footprint === null || other === undefined) continue;
    // Un tapis va sous les autres meubles; deux tapis ne se chevauchent pas. Un objet mural est au
    // mur, pas au sol (R17): il ne prend la case de personne.
    if (other.floor !== def.floor || other.wall) continue;
    const taken = footprintCells(other.footprint, f.cell, f.rotation);
    if (taken.some((t) => cells.some((k) => k.cx === t.cx && k.cy === t.cy))) return 'overlap';
  }
  // Ce qui barre le passage (ni tapis, ni lit; un objet mural est déjà validé) ne touche aucun corps et ne coupe
  // aucune case de la pièce de sa porte (R01: les deux personnages étaient restés enfermés).
  if (!def.floor && def.bed === null) {
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
  if (item === null || !isPlaceable(def) || def.footprint === null || !isHome(c) || c.status !== 'active') {
    if (c.placement !== null) {
      c.placement = null;
      sim.runtime.changed = true;
    }
    return;
  }
  // Petit objet visé sur un meuble porteur (R11): il va dessus, ou l'aperçu reste rouge sur le
  // meuble (plein, coin de l'autre); jamais au sol au pied du meuble, où la table le cachait.
  const aimed = def.small ? surfaceHostAimed(sim, c) : null;
  if (aimed !== null) {
    const place = surfaceUsable(sim, c, aimed) ? nearestFreePlace(sim, aimed, c.pos) : null;
    const on = { furniture: aimed.id, place: place ?? 0 };
    const valid = place !== null;
    const problem: PlacementProblem = surfaceUsable(sim, c, aimed) ? 'overlap' : 'not_yours';
    const blocked = valid ? null : message(sim, problemKey(sim, problem), { partner: partnerName(sim, c.id) });
    const before = c.placement;
    if (
      before?.on?.furniture !== on.furniture ||
      before.on.place !== on.place ||
      before.item !== item ||
      before.valid !== valid ||
      before.blocked !== blocked
    ) {
      c.placement = { item, cell: { cx: aimed.cell.cx, cy: aimed.cell.cy }, rotation: aimed.rotation, valid, blocked, small: true, on };
      sim.runtime.changed = true;
      if (before === null) queueHint(sim, c.id, { on: 'holding_furniture' });
    }
    return;
  }
  let rotation = c.placement?.item === item && c.placement.on === undefined ? c.placement.rotation : 0;
  const size = rotatedSize(def.footprint, rotation);
  let cell = pointerCell(sim, c, size) ?? previewCell(c, size);
  // Les rideaux s'accrochent à la fenêtre visée: l'aperçu se cale dessus.
  const win = isCurtains(def) ? windowNear(sim, c, cell) : null;
  if (win !== null) {
    cell = windowCell(win);
    rotation = SIDE_ROTATION[win.side];
  }
  const problem = placementProblem(sim, item, cell, rotation, null, c.id);
  const valid = problem === null;
  // Sans texte dans `textes.json`, la clé: l'interface la traduit, sinon montre son message général.
  const blocked = problem === null ? null : message(sim, problemKey(sim, problem), { partner: partnerName(sim, c.id) });
  const before = c.placement;
  if (
    before?.item !== item ||
    before.on !== undefined ||
    before.cell.cx !== cell.cx ||
    before.cell.cy !== cell.cy ||
    before.rotation !== rotation ||
    before.valid !== valid ||
    before.blocked !== blocked
  ) {
    c.placement = { item, cell, rotation, valid, blocked };
    if (def.small) c.placement.small = true;
    sim.runtime.changed = true;
    if (before === null) queueHint(sim, c.id, { on: 'holding_furniture' });
  }
}

export function rotatePlacement(sim: Sim, c: Character, delta: number): void {
  const p: PlacementPreview | null = c.placement;
  // Sur un meuble porteur, le petit objet suit le meuble: rien à tourner.
  if (p === null || p.on !== undefined) return;
  p.rotation = (((p.rotation + Math.sign(delta)) % 4) + 4) % 4;
  updatePlacement(sim, c);
  sim.runtime.changed = true;
}

/** Pose le meuble tenu (à l'aperçu, ou à la case donnée par un clic). */
export function placeFurniture(sim: Sim, c: Character, cell: Cell | null, rotation: number | null): boolean {
  const item = heldItem(c);
  if (item === null || !isHome(c)) return false;
  const def = sim.content.items[item];
  if (!isPlaceable(def) || def.footprint === null) return false;
  const on = cell === null ? (c.placement?.on ?? null) : null;
  if (on !== null && def.small) return placeDecor(sim, c, item, on);
  let r = rotation ?? c.placement?.rotation ?? 0;
  let at = cell ?? c.placement?.cell ?? null;
  if (at === null) return false;
  const win = isCurtains(def) ? windowNear(sim, c, at) : null;
  if (isCurtains(def)) {
    const problem = win === null ? curtainsProblem(sim, at) : null;
    if (win === null) {
      say(sim, c.id, problemKey(sim, problem ?? 'not_window'));
      return false;
    }
    at = windowCell(win);
    r = SIDE_ROTATION[win.side];
  }
  const problem = placementProblem(sim, item, at, r, null, c.id);
  if (problem === 'not_yours') say(sim, c.id, PROBLEM_KEYS.not_yours, { partner: partnerName(sim, c.id) });
  if (problem !== null) return false;
  if (takeFromBag(c, item, 1).length === 0) return false;
  const id = newId(sim, 'f');
  const placed: PlacedFurniture = { id, item, cell: { cx: at.cx, cy: at.cy }, rotation: r, placedBy: c.id };
  if (win !== null) placed.window = win.id;
  sim.world.furniture.push(placed);
  c.placement = null;
  sim.runtime.dynamicDirty = true;
  bump(sim, 'placed', c.id);
  bump(sim, `placed:${item}`, c.id);
  emit(sim, { type: 'furniture_placed', by: c.id, furniture: id, item });
  return true;
}

/** Reprend un meuble posé dans le sac (X, clic droit). */
export function takeFurniture(sim: Sim, c: Character, furnitureId: string): boolean {
  // Un petit objet posé sur un meuble se vise et se reprend comme un meuble (même clic droit).
  if (sim.world.decor.some((d) => d.id === furnitureId)) return takeDecor(sim, c, furnitureId);
  const index = sim.world.furniture.findIndex((f) => f.id === furnitureId);
  const f = sim.world.furniture[index];
  if (f === undefined) return false;
  if (sim.world.characters.some((ch) => ch.bedId === f.id)) return false;
  // Le râtelier a sa place fixe près de la porte (lot L3): il ne se reprend pas.
  if (f.item === TOOL_RACK.item) return false;
  // Jamais de débordement provoqué: le reste du rangement doit tout contenir (section 5.3).
  if (removalOverflows(sim, f.id)) {
    say(sim, c.id, 'storage_remove_refused');
    return false;
  }
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
  // Ce qu'il portait revient au sac, sinon au rangement: rien ne se perd (S03).
  returnDecorOf(sim, f.id, c);
  sim.runtime.dynamicDirty = true;
  emit(sim, { type: 'furniture_taken', by: c.id, item: f.item });
  return true;
}

// ---------------------------------------------------------------------------
// Petits objets sur les meubles (0.11.2, S03)

/** Milieu de l'empreinte d'un meuble posé. */
function furnitureMiddle(def: ItemDef, f: PlacedFurniture): Vec2 {
  const size = rotatedSize(def.footprint ?? { w: 1, d: 1 }, f.rotation);
  return { x: f.cell.cx + size.w / 2, y: f.cell.cy + size.d / 2 };
}

/**
 * Où est une place du dessus, au sol (même repère que les bancs: le modèle tourné d'un quart de
 * tour par rotation, X le long, Z vers l'avant). Le rendu lit la hauteur dans le modèle.
 */
export function surfacePlacePos(sim: Sim, f: PlacedFurniture, place: number): Vec2 | null {
  const def = sim.content.items[f.item];
  const at = def?.surface[place];
  if (def === undefined || at === undefined) return null;
  const middle = furnitureMiddle(def, f);
  const a = f.rotation * (Math.PI / 2);
  return { x: middle.x + Math.cos(a) * at.x + Math.sin(a) * at.z, y: middle.y - Math.sin(a) * at.x + Math.cos(a) * at.z };
}

/** Les places libres du dessus de ce meuble. */
export function freeSurfacePlaces(sim: Sim, f: PlacedFurniture): number[] {
  const places = sim.content.items[f.item]?.surface ?? [];
  const out: number[] = [];
  for (let i = 0; i < places.length; i++) if (!sim.world.decor.some((d) => d.on === f.id && d.place === i)) out.push(i);
  return out;
}

/** Ce meuble porte-t-il quelque chose, et peut-on y toucher (dans la maison, hors du coin de l'autre) ? */
function surfaceUsable(sim: Sim, c: Character, f: PlacedFurniture): boolean {
  const def = sim.content.items[f.item];
  if (def === undefined || def.footprint === null || def.surface.length === 0 || f.window !== undefined) return false;
  if (!furnitureAtHome(sim, f)) return false;
  return cornerOwnerOf(sim, footprintCells(def.footprint, f.cell, f.rotation), c.id) === null;
}

function furnitureAtHome(sim: Sim, f: PlacedFurniture): boolean {
  return houseRoomAt(sim.map, sim.world.rooms, f.cell.cx + 0.5, f.cell.cy + 0.5) !== null;
}

/** La place libre de ce meuble la plus proche de `from`, ou `null`. */
function nearestFreePlace(sim: Sim, f: PlacedFurniture, from: Vec2): number | null {
  let best: number | null = null;
  let bestD = Number.POSITIVE_INFINITY;
  for (const place of freeSurfacePlaces(sim, f)) {
    const at = surfacePlacePos(sim, f, place);
    const d = at === null ? Number.POSITIVE_INFINITY : Math.hypot(at.x - from.x, at.y - from.y);
    if (d < bestD) {
      best = place;
      bestD = d;
    }
  }
  return best;
}

/**
 * Le meuble porteur (table, coffre) que vise un petit objet en main, utilisable ou non: celui que
 * survole la souris (ou celui sous le point du sol survolé), sinon celui de la case devant soi.
 * `null`: rien de porteur n'est visé, on pose au sol.
 */
export function surfaceHostAimed(sim: Sim, c: Character): PlacedFurniture | null {
  if (!isHome(c)) return null;
  const pointer = sim.runtime.pointer[c.id];
  const carrying = (f: PlacedFurniture): boolean => {
    const def = sim.content.items[f.item];
    return def !== undefined && def.footprint !== null && def.surface.length > 0 && f.window === undefined;
  };
  const covering = (cx: number, cy: number): PlacedFurniture | null =>
    sim.world.furniture.find((f) => {
      const footprint = sim.content.items[f.item]?.footprint ?? null;
      return carrying(f) && footprint !== null && footprintCells(footprint, f.cell, f.rotation).some((k) => k.cx === cx && k.cy === cy);
    }) ?? null;
  if (pointer?.kind === 'furniture') {
    // Survoler un petit objet déjà posé vise son meuble.
    const id = sim.world.decor.find((d) => d.id === pointer.furniture)?.on ?? pointer.furniture;
    const host = sim.world.furniture.find((f) => f.id === id);
    return host !== undefined && carrying(host) ? host : null;
  }
  // La souris sur le sol, sous le plateau d'une table: c'est la table qu'on vise.
  if (pointer?.kind === 'ground') return covering(Math.floor(pointer.x), Math.floor(pointer.y));
  return covering(Math.floor(c.pos.x + Math.cos(c.facing)), Math.floor(c.pos.y + Math.sin(c.facing)));
}

/** Pose le petit objet tenu sur le meuble porteur, à la place visée. */
function placeDecor(sim: Sim, c: Character, item: string, on: { furniture: string; place: number }): boolean {
  const host = sim.world.furniture.find((f) => f.id === on.furniture);
  if (host === undefined || !surfaceUsable(sim, c, host) || !freeSurfacePlaces(sim, host).includes(on.place)) {
    c.placement = null;
    sim.runtime.changed = true;
    return false;
  }
  if (takeFromBag(c, item, 1).length === 0) return false;
  const id = newId(sim, 'd');
  const placed: PlacedDecor = { id, item, on: host.id, place: on.place, placedBy: c.id };
  sim.world.decor.push(placed);
  c.placement = null;
  sim.runtime.changed = true;
  bump(sim, 'placed', c.id);
  bump(sim, `placed:${item}`, c.id);
  emit(sim, { type: 'furniture_placed', by: c.id, furniture: id, item });
  return true;
}

/** Reprend un petit objet posé sur un meuble (X devant le meuble, clic droit sur l'objet). */
export function takeDecor(sim: Sim, c: Character, decorId: string): boolean {
  const index = sim.world.decor.findIndex((d) => d.id === decorId);
  const d = sim.world.decor[index];
  const host = d === undefined ? undefined : sim.world.furniture.find((f) => f.id === d.on);
  if (d === undefined) return false;
  if (host !== undefined) {
    const def = sim.content.items[host.item];
    const owner = def === undefined || def.footprint === null ? null : cornerOwnerOf(sim, footprintCells(def.footprint, host.cell, host.rotation), c.id);
    if (owner !== null) {
      say(sim, c.id, 'corner_not_yours', { partner: owner.name });
      return false;
    }
  }
  sim.world.decor.splice(index, 1);
  giveToCharacter(sim, c, d.item, 'ordinary', 1);
  const slot = c.bag.findIndex((s) => s?.item === d.item);
  if (slot >= 0 && slot < TOOLBAR_SLOTS) c.selected = slot;
  sim.runtime.changed = true;
  emit(sim, { type: 'furniture_taken', by: c.id, item: d.item });
  return true;
}

/** Le dernier petit objet posé sur ce meuble, ou `null` (X reprend d'abord ce qui est dessus). */
export function topDecorOf(sim: Sim, furnitureId: string): PlacedDecor | null {
  for (let i = sim.world.decor.length - 1; i >= 0; i--) {
    const d = sim.world.decor[i];
    if (d?.on === furnitureId) return d;
  }
  return null;
}

/**
 * Le meuble porteur s'en va (repris, rangé): ce qu'il porte revient au sac de `c` s'il y a de la
 * place, sinon au rangement de la maison (`storeAtHome`, au pied du coffre s'il est plein).
 */
export function returnDecorOf(sim: Sim, furnitureId: string, c: Character | null): void {
  const carried = sim.world.decor.filter((d) => d.on === furnitureId);
  if (carried.length === 0) return;
  sim.world.decor = sim.world.decor.filter((d) => d.on !== furnitureId);
  for (const d of carried) {
    const left = c === null ? 1 : addToBag(sim, c, d.item, 'ordinary', 1);
    if (left > 0) storeAtHome(sim, d.item, 'ordinary', left);
  }
  sim.runtime.changed = true;
}

/**
 * Petits objets relus d'une sauvegarde: ceux dont le meuble porteur ou la place n'existe plus (ou
 * qu'une autre occupe déjà) reviennent au rangement. Renvoie le nombre d'objets rendus.
 */
export function settleDecor(sim: Sim): number {
  const kept: PlacedDecor[] = [];
  let returned = 0;
  for (const d of sim.world.decor) {
    const host = sim.world.furniture.find((f) => f.id === d.on);
    const places = host === undefined ? 0 : (sim.content.items[host.item]?.surface.length ?? 0);
    const taken = kept.some((k) => k.on === d.on && k.place === d.place);
    if (host !== undefined && d.place >= 0 && d.place < places && !taken && sim.content.items[d.item] !== undefined) kept.push(d);
    else {
      returned += 1;
      if (sim.content.items[d.item] !== undefined) storeAtHome(sim, d.item, 'ordinary', 1);
    }
  }
  sim.world.decor = kept;
  return returned;
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
  if (!isHome(c)) {
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

// ---------------------------------------------------------------------------
// Étagères hautes et rideaux (tour 10, sections 5.2 et 6)

/** L'étagère haute du cellier (`reglages.storage`): elle ne tient qu'aux places de la carte. */
const RACK_ITEM = 'cellar_rack';

function onShelfPlace(room: MapRoom, cells: readonly Cell[]): boolean {
  const places: readonly Rect[] = room.build?.shelves ?? [];
  return places.some(
    (p) => p.w * p.h === cells.length && cells.every((k) => k.cx >= p.x && k.cy >= p.y && k.cx < p.x + p.w && k.cy < p.y + p.h),
  );
}

/** Des rideaux (toutes couleurs): le même modèle à deux états (section 6.3). */
export function isCurtains(def: ItemDef | undefined): boolean {
  return def?.model === 'curtains';
}

/** Rotation d'un meuble posé dos à ce mur (convention de `backAgainstWall`). */
export const SIDE_ROTATION: Readonly<Record<WindowSide, number>> = { north: 0, west: 1, south: 2, east: 3 };

/** La case de la pièce au pied de la fenêtre (le bord du mur où elle s'ouvre). */
export function windowCell(w: WindowDef): Cell {
  switch (w.side) {
    case 'north':
      return { cx: Math.floor(w.x), cy: Math.round(w.y) };
    case 'south':
      return { cx: Math.floor(w.x), cy: Math.round(w.y) - 1 };
    case 'west':
      return { cx: Math.round(w.x), cy: Math.floor(w.y) };
    case 'east':
      return { cx: Math.round(w.x) - 1, cy: Math.floor(w.y) };
  }
}

/** Portée (m) à laquelle une fenêtre se vise depuis la case de l'aperçu. */
const WINDOW_AIM = 1.6;

function windowsOfRoom(sim: Sim, room: MapRoom): WindowDef[] {
  return windowsNow(sim.content, sim.map, sim.world.rooms).filter((w) => w.room === room.id);
}

/** La fenêtre libre à rideaux la plus proche du point visé, dans la pièce où l'on est, ou `null`. */
function windowNear(sim: Sim, c: Character, cell: Cell): WindowDef | null {
  const room = houseRoomAt(sim.map, sim.world.rooms, c.pos.x, c.pos.y);
  if (room === null) return null;
  let best: WindowDef | null = null;
  let bestD = WINDOW_AIM;
  for (const w of windowsOfRoom(sim, room)) {
    if (!w.curtains || curtainsAt(sim.world, w.id) !== null) continue;
    const d = Math.hypot(w.x - (cell.cx + 0.5), w.y - (cell.cy + 0.5));
    if (d <= bestD) {
      best = w;
      bestD = d;
    }
  }
  return best;
}

/** Pourquoi des rideaux ne vont pas là: aucune fenêtre libre visée, ou le fenestron du cellier. */
function curtainsProblem(sim: Sim, cell: Cell): PlacementProblem | null {
  const room = houseRoomAt(sim.map, sim.world.rooms, cell.cx + 0.5, cell.cy + 0.5);
  if (room === null) return 'outside';
  const near = windowsOfRoom(sim, room).filter((w) => Math.hypot(w.x - (cell.cx + 0.5), w.y - (cell.cy + 0.5)) <= WINDOW_AIM);
  if (near.some((w) => w.curtains && curtainsAt(sim.world, w.id) === null)) return null;
  return near.some((w) => !w.curtains) ? 'fenestron' : 'not_window';
}

/**
 * Ouvrir ou fermer des rideaux (Agir, de dedans). Les premiers rideaux ouverts du matin donnent
 * Cœur +2 à qui les ouvre, une fois par jour (section 6.2).
 */
export function toggleCurtains(sim: Sim, c: Character, furnitureId: string): boolean {
  const f = sim.world.furniture.find((x) => x.id === furnitureId);
  if (f?.window === undefined || c.inside !== HOUSE_BUILDING) return false;
  const reach = sim.content.settings.ranges.action + 1;
  if (Math.hypot(c.pos.x - (f.cell.cx + 0.5), c.pos.y - (f.cell.cy + 0.5)) > reach) return false;
  const closing = f.closed !== true;
  if (closing) f.closed = true;
  else delete f.closed;
  sim.runtime.changed = true;
  bump(sim, closing ? 'curtains_closed' : 'curtains_opened', c.id);
  emit(sim, { type: 'curtains', by: c.id, furniture: f.id, closed: closing });
  if (!closing && !c.needs.curtainsMorningDone && sim.world.clock.minutes < MORNING_UNTIL) {
    c.needs.curtainsMorningDone = true;
    addHeart(sim, c, sim.content.settings.needs.soft.heart.curtainsMorning);
    say(sim, c.id, 'curtains_morning');
  }
  return true;
}

/** « Le matin » des rideaux ouverts: jusqu'à midi. */
const MORNING_UNTIL = 12 * 60;

/**
 * Rideaux à replacer (migration du format 6, fenêtre devenue porte): à la fenêtre libre la plus
 * proche de la même pièce, sinon au rangement. Renvoie ce qui a bougé: `hung` (accrochés ailleurs)
 * et `stored` (rangés).
 */
export function rehangCurtains(sim: Sim, f: PlacedFurniture): 'hung' | 'stored' {
  const room = houseRoomAt(sim.map, sim.world.rooms, f.cell.cx + 0.5, f.cell.cy + 0.5) ?? activeHouseRooms(sim.map, sim.world.rooms)[0] ?? null;
  const free = room === null ? [] : windowsOfRoom(sim, room).filter((w) => w.curtains && curtainsAt(sim.world, w.id) === null);
  free.sort((a, b) => Math.hypot(a.x - f.cell.cx - 0.5, a.y - f.cell.cy - 0.5) - Math.hypot(b.x - f.cell.cx - 0.5, b.y - f.cell.cy - 0.5));
  const win = free[0];
  if (win !== undefined) {
    f.window = win.id;
    f.cell = windowCell(win);
    f.rotation = SIDE_ROTATION[win.side];
    return 'hung';
  }
  sim.world.furniture = sim.world.furniture.filter((x) => x !== f);
  storeAtHome(sim, f.item, 'ordinary', 1);
  return 'stored';
}

/**
 * Un meuble sur la case devant une porte percée cette nuit (section 4.3): sur la case libre la plus
 * proche de la même pièce, sinon rangé. Renvoie les objets déplacés.
 */
export function clearDoorway(sim: Sim, cell: Cell, roomId: string): string[] {
  const room = activeHouseRooms(sim.map, sim.world.rooms).find((r) => r.id === roomId);
  if (room === undefined) return [];
  const moved: string[] = [];
  for (const f of [...sim.world.furniture]) {
    const def = sim.content.items[f.item];
    if (def?.footprint === null || def === undefined || def.wall || isCurtains(def)) continue;
    const cells = footprintCells(def.footprint, f.cell, f.rotation);
    if (!cells.some((k) => k.cx === cell.cx && k.cy === cell.cy)) continue;
    moved.push(f.item);
    const spots: Cell[] = [];
    for (let cy = room.rect.y; cy < room.rect.y + room.rect.h; cy++) {
      for (let cx = room.rect.x; cx < room.rect.x + room.rect.w; cx++) spots.push({ cx, cy });
    }
    spots.sort((a, b) => Math.hypot(a.cx - f.cell.cx, a.cy - f.cell.cy) - Math.hypot(b.cx - f.cell.cx, b.cy - f.cell.cy));
    const spot = spots.find((k) => {
      const taken = footprintCells(def.footprint ?? { w: 1, d: 1 }, k, f.rotation);
      return !taken.some((t) => t.cx === cell.cx && t.cy === cell.cy) && placementProblem(sim, f.item, k, f.rotation, f.id) === null;
    });
    if (spot !== undefined) f.cell = spot;
    else {
      sim.world.furniture = sim.world.furniture.filter((x) => x !== f);
      for (const ch of sim.world.characters) if (ch.bedId === f.id) ch.bedId = null;
      storeAtHome(sim, f.item, 'ordinary', 1);
      returnDecorOf(sim, f.id, null);
    }
  }
  if (moved.length > 0) sim.runtime.dynamicDirty = true;
  return moved;
}


