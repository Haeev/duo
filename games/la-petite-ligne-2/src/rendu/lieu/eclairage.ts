/**
 * Quels bâtiments sont éclairés de l'intérieur, à cet instant: la vie du bourg lue dans les
 * données, sans aucun bâtiment nommé (demande du client: la nuit se lit à ses foyers de lumière).
 *
 * 1. Un commerce tenu et ouvert éclaire le rez-de-chaussée du bâtiment où son commerçant le tient.
 * 2. Un habitant éveillé dans un bâtiment, ou à sa porte, l'éclaire (la maison le soir, le
 *    fournil avant l'aube); couché, sa chambre reste éclairée quelques minutes.
 * 3. La fiche d'un bâtiment peut déclarer des plages (`eclairage`: la gare, l'église).
 *
 * Logique pure: le rendu (`grand-lieu.ts`) fond les fenêtres vers ces cibles.
 */
import * as v from 'valibot';
import type { PlaceContent } from '../../donnees/charger';
import { BuildingLightingSchema, type BuildingLighting } from '../../donnees/schemas/batiment';
import { isTrading } from '../../simulation/commerces/prix';
import { currentEntry, goalOf, inRange, type Look } from '../../simulation/habitants/planning';
import { INK_SETTINGS } from '../encre/reglages';
import { keyDraw } from './decors-manifeste';

/** Parts éclairées d'un bâtiment, de 0 à 1: rez-de-chaussée et étage. */
export interface BuildingLight {
  ground: number;
  upper: number;
}

/** Ce que l'éclairage lit de la fiche d'un bâtiment. */
export interface LightSheet {
  readonly levels: number;
  readonly lighting: BuildingLighting;
}

export type LightSheets = ReadonlyMap<string, LightSheet>;
export type LightSettings = typeof INK_SETTINGS.buildingLights;

const SheetSchema = v.object({
  id: v.string(),
  niveaux: v.number(),
  eclairage: v.optional(BuildingLightingSchema),
});

const FILES = import.meta.glob<unknown>('../../../donnees/lieux/*/batiments/*.json', {
  import: 'default',
  eager: true,
});

/** Fiches lues (niveaux, plages d'éclairage) à partir de fichiers `lieux/<lieu>/batiments/<id>.json`. */
export function lightSheets(
  files: Readonly<Record<string, unknown>>,
): ReadonlyMap<string, LightSheets> {
  const places = new Map<string, Map<string, LightSheet>>();
  for (const [path, raw] of Object.entries(files)) {
    const place = /lieux\/([^/]+)\/batiments\//.exec(path)?.[1];
    const parsed = v.safeParse(SheetSchema, raw);
    if (place === undefined || !parsed.success) continue;
    const sheets = places.get(place) ?? new Map<string, LightSheet>();
    sheets.set(parsed.output.id, {
      levels: parsed.output.niveaux,
      lighting: parsed.output.eclairage ?? [],
    });
    places.set(place, sheets);
  }
  return places;
}

let shared: ReadonlyMap<string, LightSheets> | null = null;
const NO_SHEETS: LightSheets = new Map();

/** Les fiches livrées d'un lieu. */
export function gameLightSheets(place: string): LightSheets {
  shared ??= lightSheets(FILES);
  return shared.get(place) ?? NO_SHEETS;
}

const MINUTES_PER_DAY = 1440;
/** Salt du tirage de la durée du coucher d'un habitant. */
const BEDTIME_SALT = 43;

/** À quel bâtiment appartient chaque pièce: celle de sa porte, puis celles où mènent ses escaliers. */
export function roomBuildings(place: PlaceContent): Map<string, string> {
  const doorRoom = new Map<string, string>();
  for (const room of place.interiors)
    for (const id of Object.keys(room.doors ?? {})) doorRoom.set(id, room.id);
  const owner = new Map<string, string>();
  const queue: string[] = [];
  for (const [id, building] of Object.entries(place.map.buildings ?? {})) {
    const first = building.interior;
    if (first === null || owner.has(first)) continue;
    owner.set(first, id);
    queue.push(first);
  }
  while (queue.length > 0) {
    const roomId = queue.shift();
    const room = place.interiors.find((r) => r.id === roomId);
    const building = roomId === undefined ? undefined : owner.get(roomId);
    if (room === undefined || building === undefined) continue;
    for (const door of Object.values(room.doors ?? {})) {
      const next = doorRoom.get(door.to);
      if (next === undefined || owner.has(next)) continue;
      owner.set(next, building);
      queue.push(next);
    }
  }
  return owner;
}

/** Recherche du bâtiment d'un point: dans une de ses pièces, sinon devant sa porte. */
export function buildingFinder(
  place: PlaceContent,
  settings: LightSettings = INK_SETTINGS.buildingLights,
): (x: number, y: number) => string | null {
  const rooms = roomBuildings(place);
  const buildings = Object.entries(place.map.buildings ?? {});
  return (x, y) => {
    for (const room of place.interiors)
      if (
        x >= room.at.x &&
        y >= room.at.y &&
        x <= room.at.x + room.width &&
        y <= room.at.y + room.height
      )
        return rooms.get(room.id) ?? null;
    let best: string | null = null;
    let nearest: number = settings.doorReach;
    for (const [id, building] of buildings) {
      const door = building.door;
      if (door === null) continue;
      const d = Math.hypot(door.x - x, door.y - y);
      if (d <= nearest) {
        nearest = d;
        best = id;
      }
    }
    return best;
  };
}

/** Les bâtiments éclairés à cet instant (absent de la table: éteint). */
export function buildingLights(
  look: Look,
  place: PlaceContent,
  sheets: LightSheets,
  settings: LightSettings = INK_SETTINGS.buildingLights,
  find: (x: number, y: number) => string | null = buildingFinder(place, settings),
): Map<string, BuildingLight> {
  const out = new Map<string, BuildingLight>();
  const light = (id: string, part: 'ground' | 'upper', amount: number): void => {
    const entry = out.get(id) ?? { ground: 0, upper: 0 };
    // Un bâtiment d'un seul niveau n'a pas d'étage: tout ce qui l'éclaire éclaire ses fenêtres.
    const where = part === 'upper' && (sheets.get(id)?.levels ?? 2) < 2 ? 'ground' : part;
    entry[where] = Math.max(entry[where], amount);
    out.set(id, entry);
  };
  const minute = Math.min(look.world.minutes, MINUTES_PER_DAY - 0.001);

  for (const [id, sheet] of sheets)
    for (const range of sheet.lighting) {
      if (!inRange(minute, range.de, range.a)) continue;
      const amount = range.force ?? 1;
      if (range.niveau !== 'etage') light(id, 'ground', amount);
      if (range.niveau === 'etage' || range.niveau === 'tout') light(id, 'upper', amount);
    }

  const spotBuilding = (spot: Parameters<typeof goalOf>[2]): string | null => {
    const goal = goalOf(look.content, place, spot, () => false);
    return goal === null ? null : find(goal.x, goal.y);
  };

  for (const shop of Object.values(place.shops)) {
    if (!isTrading(look, shop)) continue;
    const keeper = place.villagers.find((villager) => villager.id === shop.keeper);
    const post = keeper?.life?.schedule.find((entry) => entry.shop === shop.id);
    const building = post === undefined ? null : spotBuilding(post.at);
    if (building !== null) light(building, 'ground', 1);
  }

  const state = look.world.places[look.world.common.place];
  for (const villager of place.villagers) {
    const life = villager.life;
    if (life === undefined) continue;
    if (state?.villagers[villager.id]?.life?.presence === 'away') continue;
    const entry = life.schedule[currentEntry(look, life)];
    if (entry === undefined) continue;
    const building = spotBuilding(entry.at);
    if (building === null) continue;
    const asleep = 'bed' in entry.at || settings.asleep.includes(entry.activity);
    if (!asleep) {
      light(building, 'ground', 1);
      continue;
    }
    const since = (minute - entry.from + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    const [shortest, longest] = settings.bedtime;
    const awake = shortest + keyDraw(villager.id, BEDTIME_SALT) * (longest - shortest);
    if (since < awake) light(building, 'upper', 1);
  }
  return out;
}
