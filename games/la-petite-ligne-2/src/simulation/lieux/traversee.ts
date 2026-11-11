/**
 * Traversée des portes: d'un endroit du lieu à un autre qui n'est pas dans la même pièce (le
 * dehors, un intérieur, un étage), la suite de portes à franchir. Même règle du seuil que pour
 * les joueurs (`donnees/seuils.ts`): on vient devant une porte, on arrive devant l'autre porte de
 * la paire, à `arriveOffset` de son seuil. Pur, lu dans la carte seule: les habitants s'en
 * servent pour leurs trajets (`habitants/chemins.ts`), les scènes pour sortir un habitant de chez
 * lui, le carnet pour montrer la porte à prendre.
 */
import type { PlaceContent } from '../../donnees/charger';
import { interiorAt, sillsOf } from './portes';
import { PLACES } from './reglages';

/** Une porte franchie: où l'on se présente devant elle, où l'on arrive de l'autre côté. */
export interface DoorHop {
  /** Porte prise, et celle par laquelle on arrive. */
  readonly door: string;
  readonly to: string;
  /** Devant la porte prise, du côté d'où l'on vient (m). */
  readonly fromX: number;
  readonly fromY: number;
  /** Devant la porte d'arrivée, dans la pièce où l'on entre (m). */
  readonly toX: number;
  readonly toY: number;
}

interface DoorSide {
  readonly id: string;
  readonly to: string;
  /** Pièce où se tient cette porte: identifiant d'intérieur, `''` pour le dehors. */
  readonly area: string;
  readonly x: number;
  readonly y: number;
}

const OUTSIDE = '';
const sides = new WeakMap<PlaceContent, readonly DoorSide[]>();

/** Pièce d'un point: identifiant d'intérieur, `''` dehors. */
export function areaAt(place: PlaceContent, x: number, y: number): string {
  return interiorAt(place, x, y) ?? OUTSIDE;
}

/** Chaque porte avec le point où l'on se tient devant elle, par identifiant (ordre stable). */
function sidesOf(place: PlaceContent): readonly DoorSide[] {
  let list = sides.get(place);
  if (list !== undefined) return list;
  const doors = place.map.doors ?? {};
  const sills = sillsOf(place);
  const built: DoorSide[] = [];
  for (const id of Object.keys(doors).sort()) {
    const door = doors[id];
    const sill = sills[id];
    if (door === undefined || sill === undefined) continue;
    const offset = sill.kind === 'floor' ? PLACES.floorArriveOffset : PLACES.arriveOffset;
    const x = sill.x + sill.nx * offset;
    const y = sill.y + sill.ny * offset;
    built.push({ id, to: door.to, area: areaAt(place, x, y), x, y });
  }
  list = built;
  sides.set(place, list);
  return list;
}

/**
 * Les portes à franchir de (fx, fy) à (tx, ty), dans l'ordre: aucune dans la même pièce, `null`
 * si rien ne relie les deux. Le moins de portes possible; à égalité, l'ordre des identifiants.
 */
export function doorChain(
  place: PlaceContent,
  fx: number,
  fy: number,
  tx: number,
  ty: number,
): readonly DoorHop[] | null {
  const from = areaAt(place, fx, fy);
  const goal = areaAt(place, tx, ty);
  if (from === goal) return [];
  const all = sidesOf(place);
  const byId = new Map(all.map((s) => [s.id, s]));
  // Parcours en largeur sur les pièces; `via`: la porte par laquelle on est entré dans chacune.
  const via = new Map<string, { readonly hop: DoorHop; readonly before: string }>();
  const queue = [from];
  for (const area of queue) {
    if (area === goal) break;
    for (const side of all) {
      if (side.area !== area) continue;
      const other = byId.get(side.to);
      if (other === undefined || other.area === from || via.has(other.area)) continue;
      via.set(other.area, {
        hop: {
          door: side.id,
          to: other.id,
          fromX: side.x,
          fromY: side.y,
          toX: other.x,
          toY: other.y,
        },
        before: area,
      });
      queue.push(other.area);
    }
  }
  const chain: DoorHop[] = [];
  for (let area = goal; area !== from;) {
    const step = via.get(area);
    if (step === undefined) return null;
    chain.push(step.hop);
    area = step.before;
  }
  return chain.reverse();
}
