/**
 * Bâtiments visitables (tour 10, section 1.6; ADR 0016): heures, portes fermées, sortie toujours
 * permise, pas de porte en portant à deux, sons de porte.
 *
 * Une porte hors des heures est une case de la couche dynamique des collisions (`refreshBlockers`),
 * marquée du code de son bâtiment (2 + rang dans `map.buildings`). Qui est dedans passe la porte
 * de son bâtiment (`blockersFor`): jamais coincé à la fermeture, jamais déplacé. La règle ne lit
 * que la carte et l'horloge du monde: l'hôte et la prédiction de l'invité voient la même porte.
 */
import { joineryOpen } from './drapeaux';
import { type BuildingId, type GameMap, type MapBuilding, HOUSE_BUILDING, buildingAt, cellIndex, inMap } from '../etat/carte';
import type { Character, CharacterId, Vec2 } from '../etat/types';
import { weekdayOf } from '../donnees/calendrier';
import type { TownSettings } from '../donnees/bourg';
import { type Sim, distance, emit, sayIfWritten } from './contexte';
import type { Blockers } from './grille';

/** Code des cases de porte fermée dans `dynamicBlocked` (1 reste « bloqué pour tous »). */
const FIRST_DOOR_CODE = 2;
/** `Blockers.door`: toutes les portes s'ouvrent (les habitants ont leurs clés). */
export const ALL_DOORS = -1;
/** Distance du centre de la case de porte à laquelle une porte fermée « se dit » (m). */
const KNOCK_RADIUS = 0.9;
/** On s'éloigne d'autant avant qu'elle se redise (m). */
const KNOCK_RESET = 2;

interface MapDoors {
  list: readonly MapBuilding[];
  codes: Readonly<Record<BuildingId, number>>;
  /** Index de case de chaque porte, tous bâtiments confondus. */
  doorCells: ReadonlySet<number>;
}

const CACHE = new WeakMap<GameMap, MapDoors>();

function doorsOf(map: GameMap): MapDoors {
  const known = CACHE.get(map);
  if (known !== undefined) return known;
  const list = Object.values(map.buildings);
  const codes: Record<BuildingId, number> = {};
  const doorCells = new Set<number>();
  list.forEach((b, i) => {
    codes[b.id] = FIRST_DOOR_CODE + i;
    for (const d of b.doors) doorCells.add(cellIndex(map, d.cell.cx, d.cell.cy));
  });
  const built = { list, codes, doorCells };
  CACHE.set(map, built);
  return built;
}

/** Les heures d'une clé de `reglages.json` (`grocer`, `salon`) à ce jour et cette minute; sans clé, ouvert. */
export function hoursOpen(town: TownSettings, hours: string | null, day: number, minutes: number): boolean {
  if (hours === null) return true;
  if (hours === 'grocer') return minutes >= town.grocer.hours[0] && minutes < town.grocer.hours[1];
  if (hours === 'salon') {
    const s = town.salon;
    const weekday = weekdayOf(day);
    if (!s.weekdays.includes(weekday)) return false;
    // Samedi (0): le salon n'ouvre qu'au retour du quai (colis de tissu du train).
    if (weekday === 0 && minutes < s.saturdayFrom) return false;
    return s.open.some(([from, to]) => minutes >= from && minutes < to);
  }
  return true;
}

export function buildingOpen(sim: Sim, b: MapBuilding): boolean {
  // 0.13: la menuiserie de Basile n'ouvre que le samedi, une fois sa quête finie.
  if (b.id === sim.content.settings.flagEffects.joinery?.building) return joineryOpen(sim);
  const { clock } = sim.world;
  return hoursOpen(sim.content.settings.town, b.hours, clock.day, clock.minutes);
}

/** Bâtiments fermés à cette minute, en masque de bits (rang dans `map.buildings`). */
export function closedMask(sim: Sim): number {
  let mask = 0;
  const { list } = doorsOf(sim.map);
  for (let i = 0; i < list.length && i < 30; i++) {
    const b = list[i];
    if (b !== undefined && !buildingOpen(sim, b)) mask |= 1 << i;
  }
  return mask;
}

/** Écrit les portes fermées dans la couche dynamique (appelé par `refreshBlockers`). */
export function markClosedDoors(sim: Sim, dynamic: Uint8Array, mask: number): void {
  const { map } = sim;
  const { list, codes } = doorsOf(map);
  for (let i = 0; i < list.length && i < 30; i++) {
    const b = list[i];
    if (b === undefined || (mask & (1 << i)) === 0) continue;
    for (const d of b.doors) {
      const index = cellIndex(map, d.cell.cx, d.cell.cy);
      if (dynamic[index] === 0) dynamic[index] = codes[b.id] ?? FIRST_DOOR_CODE;
    }
  }
}

/** Code de porte d'un bâtiment (`Blockers.door`), 0 si inconnu. */
export function doorCode(map: GameMap, id: BuildingId): number {
  return doorsOf(map).codes[id] ?? 0;
}

/** La case (cx, cy) est-elle une porte de bâtiment visitable ? */
export function isDoorCell(map: GameMap, x: number, y: number): boolean {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  if (!inMap(map, cx, cy)) return false;
  return doorsOf(map).doorCells.has(cellIndex(map, cx, cy));
}

/**
 * Collisions vues depuis ce point: dedans, la porte de son bâtiment s'ouvre toujours (sortie
 * permise); dehors, les portes fermées bloquent. Objets mis en cache, sans allocation par pas.
 */
export function blockersAt(sim: Sim, base: Blockers, pos: Vec2): Blockers {
  const inside = buildingAt(sim.map, sim.world.rooms, pos.x, pos.y);
  return inside === null ? base : withDoor(sim, base, doorCode(sim.map, inside));
}

export function withDoor(sim: Sim, base: Blockers, door: number): Blockers {
  if (door === 0) return base;
  const cache = sim.runtime.doorBlockers;
  const known = cache[door];
  if (known?.dynamic === base.dynamic) return known;
  const made: Blockers = { map: base.map, dynamic: base.dynamic, door };
  cache[door] = made;
  return made;
}

/**
 * À chaque pas: un bâtiment qui ferme le dit à qui est dedans (« prends ton temps »); une porte
 * fermée devant soi dit ses heures et sonne le loquet, une fois par approche.
 */
export function updateDoors(sim: Sim): void {
  const rt = sim.runtime;
  const mask = closedMask(sim);
  const before = rt.announcedClosed;
  rt.announcedClosed = mask;
  const { list } = doorsOf(sim.map);
  if (before !== null && sim.world.phase === 'day') {
    for (let i = 0; i < list.length && i < 30; i++) {
      const b = list[i];
      const bit = 1 << i;
      if (b === undefined || (mask & bit) === 0 || (before & bit) !== 0) continue;
      for (const c of sim.world.characters) if (c.inside === b.id) sayIfWritten(sim, c.id, `closing_inside_${b.id}`);
    }
  }
  for (const c of sim.world.characters) knock(sim, c, list, mask);
}

function knock(sim: Sim, c: Character, list: readonly MapBuilding[], mask: number): void {
  const rt = sim.runtime;
  const last = rt.doorKnocked[c.id];
  if (last !== null) {
    if (distance(c.pos, last.at) > KNOCK_RESET) rt.doorKnocked[c.id] = null;
    return;
  }
  if (!c.created || c.inside !== null || c.status !== 'active' || sim.world.phase !== 'day') return;
  for (let i = 0; i < list.length && i < 30; i++) {
    const b = list[i];
    if (b === undefined || (mask & (1 << i)) === 0) continue;
    for (const d of b.doors) {
      const at = { x: d.cell.cx + 0.5, y: d.cell.cy + 0.5 };
      if (distance(c.pos, at) > KNOCK_RADIUS) continue;
      rt.doorKnocked[c.id] = { building: b.id, at };
      sayIfWritten(sim, c.id, `door_closed_${b.id}`);
      emit(sim, { type: 'door_locked', by: c.id, building: b.id });
      return;
    }
  }
}

/** La porte s'entend-elle ? Celle de la maisonnette seulement une fois bâtie (avant, c'est un trou). */
function doorSounds(sim: Sim, building: BuildingId): boolean {
  if (building !== HOUSE_BUILDING) return true;
  return sim.world.constructions.some((k) => k.id === 'house_door' && k.status === 'done');
}

/** Après les déplacements: le bâtiment où l'on est, et la porte passée (son, ambiance de la pièce). */
export function trackInside(sim: Sim, c: Character): void {
  const now = buildingAt(sim.map, sim.world.rooms, c.pos.x, c.pos.y);
  const before = c.inside;
  if (now === before) return;
  c.inside = now;
  sim.runtime.changed = true;
  const building = now ?? before;
  if (building !== null && doorSounds(sim, building)) emit(sim, { type: 'door', by: c.id, entering: now !== null, building });
}

/** Une charge à deux ne passe pas une porte (0,9 m): le message, une fois par portage. */
export function refuseDoorCarry(sim: Sim, holders: readonly CharacterId[]): void {
  if (sim.runtime.doorCarryNotified) return;
  sim.runtime.doorCarryNotified = true;
  for (const id of holders) sayIfWritten(sim, id, 'no_door_carry');
}
