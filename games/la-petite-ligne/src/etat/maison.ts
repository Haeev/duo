/**
 * La maison du tour 10 (lot L4), lue dans l'état, le contenu et la carte: pièces bâties, fenêtres,
 * rangement à cases, niveaux des besoins doux. Pur (ni DOM ni Three.js): la simulation, le rendu
 * et l'interface lisent les mêmes règles.
 */
import type { Content } from '../donnees/types';
import type { WindowDef } from '../donnees/maison';
import { type GameMap, HOUSE_BUILDING, type MapRoom, inRect } from './carte';
import type { Character, DeepReadonly, ItemStack, PlacedFurniture, RoomState, WorldState } from './types';

type ReadWorld = DeepReadonly<WorldState>;
type Rooms = Readonly<Record<string, Pick<RoomState, 'builtDay'> | undefined>>;

/** Pièces de la maisonnette où l'on peut être: la pièce principale, puis celles qui sont bâties. */
export function activeHouseRooms(map: GameMap, rooms: Rooms): MapRoom[] {
  const house = map.buildings[HOUSE_BUILDING];
  if (house === undefined) return [];
  return house.rooms.filter((r) => r.build === null || (rooms[r.build.room]?.builtDay ?? null) !== null);
}

/** La pièce de la maisonnette (déjà là ou bâtie) qui contient le point, ou `null`. */
export function houseRoomAt(map: GameMap, rooms: Rooms, x: number, y: number): MapRoom | null {
  for (const r of activeHouseRooms(map, rooms)) if (inRect(r.rect, x, y)) return r;
  return null;
}

/** La pièce de la carte d'une pièce à bâtir (`room_cellar` donne `house_cellar`). */
export function mapRoomOfBuild(map: GameMap, roomId: string): MapRoom | null {
  const house = map.buildings[HOUSE_BUILDING];
  return house?.rooms.find((r) => r.build?.room === roomId) ?? null;
}

/**
 * Fenêtres qu'on voit de dedans: celles des pièces présentes, sauf celles devenues portes (une
 * pièce bâtie perce sa porte à la place d'une fenêtre, section 4.2).
 */
export function windowsNow(content: Content, map: GameMap, rooms: Rooms): WindowDef[] {
  const active = new Set(activeHouseRooms(map, rooms).map((r) => r.id));
  const doors = new Set(content.home.rooms.filter((r) => (rooms[r.id]?.builtDay ?? null) !== null).map((r) => r.doorWindow));
  return content.home.windows.filter((w) => active.has(w.room) && !doors.has(w.id));
}

/** Les rideaux accrochés à cette fenêtre, ou `null`. */
export function curtainsAt(world: ReadWorld, windowId: string): DeepReadonly<PlacedFurniture> | null {
  return world.furniture.find((f) => f.window === windowId) ?? null;
}

// ---------------------------------------------------------------------------
// Rangement à cases (section 5)

/** Un outil: il va au râtelier, jamais dans une case (section 5.3). */
export function isTool(content: Content, item: string): boolean {
  return content.items[item]?.category === 'tool';
}

/** Cases d'une liste de piles: une case tient `stackSize` d'un même objet et d'une même qualité; les outils n'en prennent pas. */
export function usedCells(content: Content, stacks: readonly DeepReadonly<ItemStack>[]): number {
  const size = content.settings.storage?.stackSize ?? 1;
  let n = 0;
  for (const s of stacks) if (s.count > 0 && !isTool(content, s.item)) n += Math.ceil(s.count / size);
  return n;
}

/** Le meuble est-il dans une pièce de la maisonnette ? */
export function furnitureAtHome(map: GameMap, rooms: Rooms, f: DeepReadonly<PlacedFurniture>): boolean {
  return houseRoomAt(map, rooms, f.cell.cx + 0.5, f.cell.cy + 0.5) !== null;
}

/**
 * Cases du rangement de la maison: la somme des meubles de rangement posés dans la maisonnette
 * (`reglages.storage`), `null` sans réglage (coffre sans limite, comme avant le tour 10).
 */
export function storageCapacity(content: Content, map: GameMap, world: ReadWorld): number | null {
  const s = content.settings.storage;
  if (s === null) return null;
  let total = 0;
  for (const f of world.furniture) {
    const cells = s.cells[f.item];
    if (cells !== undefined && furnitureAtHome(map, world.rooms, f)) total += cells;
  }
  return total;
}

export interface StorageView {
  used: number;
  /** `null`: sans limite. */
  total: number | null;
  /** Plus de cases prises que de cases (sauvegarde d'avant, meuble retiré): « Ça déborde », on reprend seulement. */
  overflow: boolean;
  /** Outils au râtelier, et crochets. */
  rack: number;
  hooks: number;
}

/** Ce que montre le panneau du rangement (`ui.storage.count`, `messages.storage_overflow`). */
export function storageView(content: Content, map: GameMap, world: ReadWorld): StorageView {
  const used = usedCells(content, world.cellar);
  const total = storageCapacity(content, map, world);
  return {
    used,
    total,
    overflow: total !== null && used > total,
    rack: world.rack.reduce((n, s) => n + s.count, 0),
    hooks: content.settings.storage?.rackHooks ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Besoins doux (section 3): états des icônes (trois états, sans chiffre; les chiffres vont au carnet)

export type BellyLevel = 'full' | 'ok' | 'low';
export type RestLevel = 'high' | 'ok' | 'low' | 'empty';
export type HeartLevel = 'light' | 'ok' | 'missing';

export function bellyLevel(content: Content, c: DeepReadonly<Character>): BellyLevel {
  const b = content.settings.needs.soft.belly;
  if (c.needs.belly >= b.fullAt) return 'full';
  return c.needs.belly < b.lowBelow ? 'low' : 'ok';
}

/** Le Repos est l'endurance, comparée à celle du réveil (`needs.rest.levels`). */
export function restLevel(content: Content, c: DeepReadonly<Character>): RestLevel {
  const l = content.settings.needs.soft.rest.levels;
  if (c.endurance <= 0) return 'empty';
  const share = c.enduranceMax > 0 ? c.endurance / c.enduranceMax : 0;
  if (share >= l.high) return 'high';
  return share < l.low ? 'low' : 'ok';
}

/** Cœur léger au-dessus du seuil; « Envie de compagnie » après trop longtemps loin de l'autre. */
export function heartLevel(content: Content, c: DeepReadonly<Character>): HeartLevel {
  const h = content.settings.needs.soft.heart;
  if (c.needs.apartMinutes >= h.reunion.apartMinutes) return 'missing';
  return c.needs.heart >= h.lightAt ? 'light' : 'ok';
}

/** Entre 12 h et 16 h, Agir sur un lit propose « Faire la sieste » (et jamais « Se coucher »). */
export function isNapTime(content: Content, minutes: number): boolean {
  const nap = content.settings.needs.soft.rest.nap;
  return minutes >= nap.from && minutes < nap.to;
}

/** En sieste (couché l'après-midi, `needs.napStart` posé). */
export function isNapping(c: DeepReadonly<Character>): boolean {
  return c.status === 'sleeping' && c.needs.napStart !== null;
}

/**
 * « Vous avez éteint la lampe en même temps. »: les deux couchés pour la nuit à moins de
 * `needs.sleep.togetherMinutes` minutes de jeu (au rythme du jour, en pas: la veillée arrête l'horloge).
 */
export function fellAsleepTogether(content: Content, world: ReadWorld, ticksPerGameMinute: number): boolean {
  const [a, b] = world.characters;
  if (a === undefined || b === undefined) return false;
  const asleep = (c: DeepReadonly<Character>): boolean => (c.status === 'sleeping' || c.status === 'night') && c.action.kind === 'sleep' && c.needs.napStart === null;
  if (!asleep(a) || !asleep(b)) return false;
  return Math.abs(a.action.since - b.action.since) <= content.settings.needs.soft.sleep.togetherMinutes * ticksPerGameMinute;
}

/** La pièce de la maisonnette où est le lit de ce dormeur, ou `null`. */
function bedRoom(map: GameMap, world: ReadWorld, c: DeepReadonly<Character>): MapRoom | null {
  const bed = world.furniture.find((f) => f.id === c.bedId);
  return bed === undefined ? null : houseRoomAt(map, world.rooms, bed.cell.cx + 0.5, bed.cell.cy + 0.5);
}

/** Il dort dans une pièce bâtie (la chambre): Sommeil +5 (section 3.6). */
export function sleepsInBuiltRoom(map: GameMap, world: ReadWorld, c: DeepReadonly<Character>): boolean {
  return (bedRoom(map, world, c)?.build ?? null) !== null;
}

/** Rideaux fermés dans la pièce où il dort: au moins une fenêtre à rideaux, toutes fermées (section 3.6). */
export function curtainsClosedWhereSleeping(content: Content, map: GameMap, world: ReadWorld, c: DeepReadonly<Character>): boolean {
  const room = bedRoom(map, world, c);
  if (room === null) return false;
  const hung = windowsNow(content, map, world.rooms)
    .filter((w) => w.room === room.id)
    .map((w) => curtainsAt(world, w.id))
    .filter((f) => f !== null);
  return hung.length > 0 && hung.every((f) => f.closed === true);
}
