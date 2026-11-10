/**
 * Zones du lieu (`map.zones`): ouvertes ou fermées selon les verrous d'histoire. Une zone est
 * ouverte quand on en rejoint à pied, depuis le quai d'arrivée, au moins `zoneOpenShare` des
 * cases libres (murs et eau exclus). Aucun état: on le déduit de la carte et des verrous, avec
 * un remplissage refait seulement quand un verrou change. Lu par la carte du carnet (zones
 * hachurées), le rendu et les quêtes (`isZoneOpen`).
 */
import type { PlaceContent } from '../../donnees/charger';
import { zoneKey } from '../quetes/faits';
import { PLACES } from './reglages';
import { lockCount, markClosedLocks, refreshLockStates, type PlaceLook } from './verrous';

export interface ZoneView {
  readonly id: string;
  readonly name: string;
  readonly act: number;
  readonly open: boolean;
  /** Cases libres de la zone et celles qu'on rejoint à pied aujourd'hui. */
  readonly cells: number;
  readonly reachable: number;
}

interface ZoneCache {
  /** Zone de chaque case (index dans `ids` plus 1), 0 hors des zones. La première zone l'emporte. */
  readonly zoneOf: Uint16Array;
  readonly ids: readonly string[];
  readonly locks: Uint8Array;
  /** Cases que l'on rejoint à pied depuis le quai, verrous dans leur état actuel. */
  readonly reach: Uint8Array;
  views: readonly ZoneView[];
}

const caches = new WeakMap<PlaceContent, ZoneCache>();

/** Le point (x, y) est-il dans le polygone ? (règle pair-impair) */
export function insidePolygon(
  x: number,
  y: number,
  polygon: readonly (readonly [number, number])[],
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (a === undefined || b === undefined) continue;
    if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0])
      inside = !inside;
  }
  return inside;
}

function zoneGrid(place: PlaceContent, ids: readonly string[]): Uint16Array {
  const { width, height } = place.map;
  const zoneOf = new Uint16Array(width * height);
  ids.forEach((id, k) => {
    const zone = place.map.zones?.[id];
    if (zone === undefined) return;
    let x0 = width;
    let y0 = height;
    let x1 = 0;
    let y1 = 0;
    for (const [x, y] of zone.polygon) {
      x0 = Math.min(x0, Math.floor(x));
      y0 = Math.min(y0, Math.floor(y));
      x1 = Math.max(x1, Math.ceil(x));
      y1 = Math.max(y1, Math.ceil(y));
    }
    for (let cy = Math.max(0, y0); cy < Math.min(height, y1); cy++)
      for (let cx = Math.max(0, x0); cx < Math.min(width, x1); cx++) {
        const i = cy * width + cx;
        if (zoneOf[i] === 0 && insidePolygon(cx + 0.5, cy + 0.5, zone.polygon)) zoneOf[i] = k + 1;
      }
  });
  return zoneOf;
}

/** Murs de la carte (rectangles `blocked`, intérieurs compris) et verrous fermés. */
function walls(place: PlaceContent, locks: Uint8Array): Uint8Array {
  const { width, height } = place.map;
  const cells = new Uint8Array(width * height);
  for (const r of place.map.blocked)
    for (let cy = Math.max(0, r.y); cy < Math.min(height, r.y + r.h); cy++)
      for (let cx = Math.max(0, r.x); cx < Math.min(width, r.x + r.w); cx++)
        cells[cy * width + cx] = 1;
  markClosedLocks(place, locks, cells, width, height);
  return cells;
}

/**
 * Cases que l'on rejoint à pied depuis le point d'arrivée du lieu, verrous dans l'état `locks`
 * (meubles ignorés: on les contourne ou on les déplace). Écrit dans `out` (1 atteinte).
 */
export function fillReach(place: PlaceContent, locks: Uint8Array, out: Uint8Array): void {
  const { width, height } = place.map;
  out.fill(0);
  const arrival = place.map.points[place.def.station.arrival];
  if (arrival === undefined) return;
  const blocked = walls(place, locks);
  const start = Math.floor(arrival.y) * width + Math.floor(arrival.x);
  if (blocked[start] === 1) return;
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  queue[tail++] = start;
  out[start] = 1;
  while (head < tail) {
    const i = queue[head++] ?? 0;
    const x = i % width;
    const y = (i - x) / width;
    for (let k = 0; k < 4; k++) {
      const nx = x + (k === 0 ? 1 : k === 1 ? -1 : 0);
      const ny = y + (k === 2 ? 1 : k === 3 ? -1 : 0);
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const j = ny * width + nx;
      if (out[j] === 1 || blocked[j] === 1) continue;
      out[j] = 1;
      queue[tail++] = j;
    }
  }
}

function cacheOf(look: PlaceLook, place: PlaceContent): ZoneCache {
  let cache = caches.get(place);
  if (cache === undefined) {
    const ids = Object.keys(place.map.zones ?? {});
    cache = {
      zoneOf: zoneGrid(place, ids),
      ids,
      locks: new Uint8Array(lockCount(place)).fill(2),
      reach: new Uint8Array(place.map.width * place.map.height),
      views: [],
    };
    caches.set(place, cache);
    refreshLockStates(look, place, cache.locks);
  } else if (!refreshLockStates(look, place, cache.locks)) return cache;
  fillReach(place, cache.locks, cache.reach);
  const blocked = walls(place, cache.locks);
  // Les verrous comptent comme cases libres de leur zone: on les dénombre ouverts.
  const allOpen = walls(place, new Uint8Array(cache.locks.length).fill(1));
  const cells = new Array<number>(cache.ids.length).fill(0);
  const reachable = new Array<number>(cache.ids.length).fill(0);
  for (let i = 0; i < cache.zoneOf.length; i++) {
    const z = cache.zoneOf[i] ?? 0;
    if (z === 0 || allOpen[i] === 1) continue;
    cells[z - 1] = (cells[z - 1] ?? 0) + 1;
    if (cache.reach[i] === 1 && blocked[i] !== 1) reachable[z - 1] = (reachable[z - 1] ?? 0) + 1;
  }
  cache.views = cache.ids.map((id, k): ZoneView => {
    const zone = place.map.zones?.[id];
    const total = cells[k] ?? 0;
    const got = reachable[k] ?? 0;
    return {
      id,
      name: zone?.name ?? id,
      act: zone?.act ?? 1,
      open: total > 0 && got >= total * PLACES.zoneOpenShare,
      cells: total,
      reachable: got,
    };
  });
  return cache;
}

/**
 * Les zones du lieu courant, ouvertes ou fermées, dans l'ordre de la carte. L'histoire peut
 * aussi ouvrir une zone (effet `unlock_zone` des quêtes, fait `zones.<lieu>.<zone>`): la zone
 * compte alors ouverte même si un verrou intérieur en garde encore une grande part.
 */
export function zoneViews(look: PlaceLook): readonly ZoneView[] {
  const placeId = look.world.common.place;
  const place = look.content.places[placeId];
  if (place === undefined) return [];
  const views = cacheOf(look, place).views;
  const memory = look.world.progress.memory;
  if (!views.some((z) => !z.open && memory[zoneKey(placeId, z.id)] !== undefined)) return views;
  return views.map((z) =>
    z.open || memory[zoneKey(placeId, z.id)] === undefined ? z : { ...z, open: true },
  );
}

/** La zone `id` du lieu courant est-elle ouverte ? Une zone inconnue compte pour fermée. */
export function isZoneOpen(look: PlaceLook, id: string): boolean {
  return zoneViews(look).find((z) => z.id === id)?.open ?? false;
}

/**
 * Cases que l'on rejoint à pied aujourd'hui (1), pour hachurer précisément la carte du carnet
 * (une zone ouverte peut garder un recoin fermé par un verrou intérieur). Lecture seule.
 */
export function reachMask(look: PlaceLook): Uint8Array | null {
  const place = look.content.places[look.world.common.place];
  return place === undefined ? null : cacheOf(look, place).reach;
}

/** La zone qui contient (x, y) dans le lieu courant, `null` hors des zones. */
export function zoneAt(look: PlaceLook, x: number, y: number): string | null {
  const place = look.content.places[look.world.common.place];
  if (place === undefined) return null;
  const { width, height } = place.map;
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  if (cx < 0 || cy < 0 || cx >= width || cy >= height) return null;
  const cache = cacheOf(look, place);
  const z = cache.zoneOf[cy * width + cx] ?? 0;
  return z === 0 ? null : (cache.ids[z - 1] ?? null);
}
