/**
 * Obstacles du lieu courant: la carte, plus l'emprise des meubles solides (ceux de la carte et
 * ceux posés par les joueurs) et les verrous d'histoire fermés (`lieux/verrous.ts`). Pur et gardé
 * d'un pas à l'autre: la couche mobile n'est refaite que si un meuble a changé ou si un verrou
 * s'est ouvert ou fermé. Sert à l'hôte et à la prédiction de l'invité, qui lit la même progression.
 */
import type { Content, PlaceContent } from '../../donnees/charger';
import type { PropDef } from '../../donnees/schemas/meuble';
import type { PlaceState } from '../../etat/lieu';
import type { DeepReadonly, ReadonlyWorld } from '../../etat/monde';
import type { Blockers } from './grille';
import { conditionalObjects, refreshPresence } from '../lieux/presents';
import { lockCount, markClosedLocks, refreshLockStates } from '../lieux/verrous';

/** Un meuble en place, qu'il vienne de la carte ou d'un joueur. */
export interface PropInstance {
  readonly id: string;
  readonly type: string;
  readonly x: number;
  readonly y: number;
  readonly rotation: 0 | 1 | 2 | 3;
}

export type ReadPlace = DeepReadonly<PlaceState>;

interface Cached {
  readonly blockers: Blockers;
  signature: number;
  /** État des verrous à la dernière construction (1 ouvert), dans l'ordre de la carte. */
  readonly locks: Uint8Array;
  /** Objets de la carte qui sont l'obstacle d'un verrou, et l'index de ce verrou. */
  readonly lockObjects: ReadonlyMap<string, number>;
  /** Présence des meubles conditionnés (`when`) à la dernière construction (1 présent). */
  readonly present: Uint8Array;
  /** Meubles conditionnés de la carte, et leur index dans `present`. */
  readonly conditional: ReadonlyMap<string, number>;
}

const cache = new WeakMap<PlaceContent, Cached>();

/** Marge: une emprise qui finit pile sur un bord de case ne prend pas la case voisine. */
const EDGE = 1e-6;

/** Emprise au sol d'un meuble une fois tourné (m). */
export function footprintOf(
  def: PropDef,
  rotation: number,
): { readonly w: number; readonly h: number } {
  return rotation % 2 === 0 ? def.size : { w: def.size.h, h: def.size.w };
}

/**
 * Un meuble solide bloque, sauf une porte ouverte (brique `open`), l'obstacle d'un verrou ouvert
 * ou un meuble conditionné absent.
 */
function blocks(def: PropDef, state: ReadPlace, id: string, cached: Cached): boolean {
  if (!def.solid) return false;
  const when = cached.conditional.get(id);
  if (when !== undefined && cached.present[when] !== 1) return false;
  const lock = cached.lockObjects.get(id);
  if (lock !== undefined) return cached.locks[lock] !== 1;
  return state.objects[id]?.open !== true;
}

function mix(h: number, value: number): number {
  return (Math.imul(h, 31) + Math.round(value * 16)) | 0;
}

function signatureOf(place: PlaceContent, state: ReadPlace): number {
  let h = state.placed.length;
  // Les portes: leur état ouvert ou fermé change ce qui bloque.
  for (const o of place.map.objects) h = mix(h, state.objects[o.id]?.open === true ? 1 : 2);
  for (const p of state.placed) {
    h = mix(mix(mix(h, p.x), p.y), p.rotation);
    h = mix(h, state.objects[p.id]?.open === true ? 1 : 2);
  }
  return h;
}

function mark(content: Content, cached: Cached, state: ReadPlace, prop: PropInstance): void {
  const b = cached.blockers;
  const def = content.props[prop.type];
  if (def === undefined || !blocks(def, state, prop.id, cached)) return;
  const size = footprintOf(def, prop.rotation);
  const maxX = Math.floor(prop.x + size.w / 2 - EDGE);
  const maxY = Math.floor(prop.y + size.h / 2 - EDGE);
  for (let cy = Math.floor(prop.y - size.h / 2 + EDGE); cy <= maxY; cy++) {
    for (let cx = Math.floor(prop.x - size.w / 2 + EDGE); cx <= maxX; cx++) {
      if (cx >= 0 && cy >= 0 && cx < b.width && cy < b.height) b.props[cy * b.width + cx] = 1;
    }
  }
}

/** Les obstacles d'un lieu dans son état actuel; `world` dit quels verrous sont ouverts. */
export function placeBlockers(
  content: Content,
  place: PlaceContent,
  state: ReadPlace,
  world: ReadonlyWorld,
): Blockers {
  let cached = cache.get(place);
  if (cached === undefined) {
    const { width, height } = place.map;
    const fixed = new Uint8Array(width * height);
    for (const r of place.map.blocked) {
      for (let cy = Math.max(0, r.y); cy < Math.min(height, r.y + r.h); cy++)
        for (let cx = Math.max(0, r.x); cx < Math.min(width, r.x + r.w); cx++)
          fixed[cy * width + cx] = 1;
    }
    const lockObjects = new Map<string, number>();
    let index = 0;
    for (const id in place.map.locks ?? {}) {
      const object = place.map.locks?.[id]?.object;
      if (object !== undefined && object !== null) lockObjects.set(object, index);
      index++;
    }
    cached = {
      blockers: { width, height, fixed, props: new Uint8Array(width * height) },
      signature: Number.NaN,
      // 2: ni ouvert ni fermé, pour forcer la première construction.
      locks: new Uint8Array(lockCount(place)).fill(2),
      lockObjects,
      present: new Uint8Array(conditionalObjects(place).length).fill(2),
      conditional: new Map(conditionalObjects(place).map((o, i) => [o.id, i])),
    };
    cache.set(place, cached);
  }
  const locksChanged = refreshLockStates({ content, world }, place, cached.locks);
  const presenceChanged = refreshPresence({ content, world }, place, cached.present);
  const signature = signatureOf(place, state);
  if (signature !== cached.signature || locksChanged || presenceChanged) {
    cached.signature = signature;
    cached.blockers.props.fill(0);
    markClosedLocks(place, cached.locks, cached.blockers.props, place.map.width, place.map.height);
    for (const object of place.map.objects) mark(content, cached, state, object);
    for (const placed of state.placed) mark(content, cached, state, placed);
  }
  return cached.blockers;
}

/** Les obstacles du lieu courant, `null` si son état manque (invité en cours de voyage). */
export function currentBlockers(content: Content, world: ReadonlyWorld): Blockers | null {
  const place = content.places[world.common.place];
  const state = world.places[world.common.place];
  if (place === undefined || state === undefined) return null;
  return placeBlockers(content, place, state, world);
}

/** Le meuble de cet identifiant d'instance, dans la carte ou parmi les meubles posés. */
export function findProp(place: PlaceContent, state: ReadPlace, id: string): PropInstance | null {
  for (const object of place.map.objects) if (object.id === id) return object;
  for (const placed of state.placed) if (placed.id === id) return placed;
  return null;
}
