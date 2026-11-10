/**
 * Obstacles du lieu courant: la carte, plus l'emprise des meubles solides (ceux de la carte et
 * ceux posés par les joueurs). Pur et gardé d'un pas à l'autre: la couche des meubles n'est
 * refaite que si un meuble a changé. Sert à l'hôte et à la prédiction de l'invité.
 */
import type { Content, PlaceContent } from '../../donnees/charger';
import type { PropDef } from '../../donnees/schemas/meuble';
import type { PlaceState } from '../../etat/lieu';
import type { DeepReadonly, ReadonlyWorld } from '../../etat/monde';
import type { Blockers } from './grille';

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

/** Un meuble solide bloque, sauf une porte ouverte (brique `open`). */
function blocks(def: PropDef, state: ReadPlace, id: string): boolean {
  if (!def.solid) return false;
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

function mark(content: Content, b: Blockers, state: ReadPlace, prop: PropInstance): void {
  const def = content.props[prop.type];
  if (def === undefined || !blocks(def, state, prop.id)) return;
  const size = footprintOf(def, prop.rotation);
  const maxX = Math.floor(prop.x + size.w / 2 - EDGE);
  const maxY = Math.floor(prop.y + size.h / 2 - EDGE);
  for (let cy = Math.floor(prop.y - size.h / 2 + EDGE); cy <= maxY; cy++) {
    for (let cx = Math.floor(prop.x - size.w / 2 + EDGE); cx <= maxX; cx++) {
      if (cx >= 0 && cy >= 0 && cx < b.width && cy < b.height) b.props[cy * b.width + cx] = 1;
    }
  }
}

/** Les obstacles d'un lieu dans son état actuel. */
export function placeBlockers(content: Content, place: PlaceContent, state: ReadPlace): Blockers {
  let cached = cache.get(place);
  if (cached === undefined) {
    const { width, height } = place.map;
    const fixed = new Uint8Array(width * height);
    for (const r of place.map.blocked) {
      for (let cy = Math.max(0, r.y); cy < Math.min(height, r.y + r.h); cy++)
        for (let cx = Math.max(0, r.x); cx < Math.min(width, r.x + r.w); cx++)
          fixed[cy * width + cx] = 1;
    }
    cached = {
      blockers: { width, height, fixed, props: new Uint8Array(width * height) },
      signature: Number.NaN,
    };
    cache.set(place, cached);
  }
  const signature = signatureOf(place, state);
  if (signature !== cached.signature) {
    cached.signature = signature;
    cached.blockers.props.fill(0);
    for (const object of place.map.objects) mark(content, cached.blockers, state, object);
    for (const placed of state.placed) mark(content, cached.blockers, state, placed);
  }
  return cached.blockers;
}

/** Les obstacles du lieu courant, `null` si son état manque (invité en cours de voyage). */
export function currentBlockers(content: Content, world: ReadonlyWorld): Blockers | null {
  const place = content.places[world.common.place];
  const state = world.places[world.common.place];
  if (place === undefined || state === undefined) return null;
  return placeBlockers(content, place, state);
}

/** Le meuble de cet identifiant d'instance, dans la carte ou parmi les meubles posés. */
export function findProp(place: PlaceContent, state: ReadPlace, id: string): PropInstance | null {
  for (const object of place.map.objects) if (object.id === id) return object;
  for (const placed of state.placed) if (placed.id === id) return placed;
  return null;
}
