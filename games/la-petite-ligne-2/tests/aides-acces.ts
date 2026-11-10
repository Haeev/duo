/**
 * Règle d'accès des lieux: tout point où une quête envoie les joueurs s'atteint à pied depuis le
 * point d'arrivée du lieu. Elle se lit dans les données seules (carte, meubles, quêtes, habitants)
 * et vaut pour tout lieu, présent ou à venir. Les verrous d'histoire comptent pour ouverts (ils
 * s'ouvrent au fil des actes) et une porte mène à sa jumelle, comme en jeu.
 */
import type { Content, PlaceContent } from '../src/donnees/charger';
import type { StepCondition } from '../src/donnees/schemas/quete';
import { footprintOf } from '../src/simulation/noyau/obstacles';

export interface Cell {
  readonly x: number;
  readonly y: number;
}

/** Un endroit où une quête envoie les joueurs, et qui le demande. */
export interface QuestSpot extends Cell {
  /** `<suite>.<étape>: <ce qui est cité>`, pour le message d'échec. */
  readonly label: string;
  /** Poste d'un habitant: il peut tenir dans un meuble (comptoir), une case voisine atteinte suffit. */
  readonly post: boolean;
}

const NEIGHBOURS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** Portée de la touche d'action devant une porte à ouvrir (m): large, la règle vise les impasses. */
const DOOR_REACH = 1.6;

/** Cases bloquées du lieu, verrous d'histoire ouverts: murs de la carte et meubles solides. */
export function blockedCells(content: Content, place: PlaceContent): Uint8Array {
  const { width, height } = place.map;
  const cells = new Uint8Array(width * height);
  const fill = (x0: number, y0: number, x1: number, y1: number): void => {
    for (let cy = Math.max(0, y0); cy <= Math.min(height - 1, y1); cy++)
      for (let cx = Math.max(0, x0); cx <= Math.min(width - 1, x1); cx++)
        cells[cy * width + cx] = 1;
  };
  for (const r of place.map.blocked) fill(r.x, r.y, r.x + r.w - 1, r.y + r.h - 1);
  const lockObjects = new Set(Object.values(place.map.locks ?? {}).map((l) => l.object));
  for (const o of place.map.objects) {
    const def = content.props[o.type];
    if (def === undefined || !def.solid || lockObjects.has(o.id)) continue;
    // Une porte battante (brique `open`) s'ouvre: elle ne ferme aucun passage.
    if (def.bricks.some((b) => b.brick === 'open')) continue;
    const size = footprintOf(def, o.rotation);
    const edge = 1e-6;
    fill(
      Math.floor(o.x - size.w / 2 + edge),
      Math.floor(o.y - size.h / 2 + edge),
      Math.floor(o.x + size.w / 2 - edge),
      Math.floor(o.y + size.h / 2 - edge),
    );
  }
  return cells;
}

/** Cases atteintes à pied depuis l'arrivée du lieu (quatre voisins), portes franchies. */
export function walkableFromArrival(content: Content, place: PlaceContent): Set<number> {
  const { width, height } = place.map;
  const blocked = blockedCells(content, place);
  const free = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < width && y < height && blocked[y * width + x] !== 1;
  const seen = new Set<number>();
  const queue: number[] = [];
  const visit = (x: number, y: number): void => {
    const i = y * width + x;
    if (!free(x, y) || seen.has(i)) return;
    seen.add(i);
    queue.push(i);
  };
  const arrival = place.map.points[place.def.station.arrival];
  if (arrival === undefined) return seen;
  visit(Math.floor(arrival.x), Math.floor(arrival.y));
  const doors = Object.values(place.map.doors ?? {});
  // La file grandit pendant le parcours: `for...of` lit aussi les cases ajoutées.
  for (const i of queue) {
    const x = i % width;
    const y = (i - x) / width;
    for (const [dx, dy] of NEIGHBOURS) visit(x + dx, y + dy);
    for (const door of doors) {
      if (Math.hypot(door.x - (x + 0.5), door.y - (y + 0.5)) > DOOR_REACH) continue;
      const twin = place.map.doors?.[door.to];
      if (twin === undefined) continue;
      // On arrive devant la jumelle: sa case, ou l'une des voisines si elle est prise par la porte.
      const tx = Math.floor(twin.x);
      const ty = Math.floor(twin.y);
      visit(tx, ty);
      for (const [dx, dy] of NEIGHBOURS) visit(tx + dx, ty + dy);
    }
  }
  return seen;
}

function conditionPoints(c: StepCondition, out: string[]): string[] {
  if (c.type === 'reach') out.push(c.point);
  else if (c.type === 'all' || c.type === 'any')
    for (const sub of c.conditions) conditionPoints(sub, out);
  else if (c.type === 'not') conditionPoints(c.condition, out);
  return out;
}

/**
 * Les endroits où les quêtes du lieu envoient les joueurs: cible d'une étape (point, ou poste de
 * l'habitant visé), points des conditions `reach`, et le quai d'où l'on repart.
 */
export function questSpots(place: PlaceContent): QuestSpot[] {
  const spots: QuestSpot[] = [];
  const add = (label: string, point: string, post = false): void => {
    const at = place.map.points[point];
    // Un point absent est déjà refusé au chargement (validateur des quêtes).
    if (at !== undefined)
      spots.push({ label: `${label}: point « ${point} »`, x: at.x, y: at.y, post });
  };
  add('lieu: quai', place.def.station.platform);
  for (const line of Object.values(place.quests))
    for (const chapter of line.chapters)
      for (const step of chapter.steps) {
        const label = `${line.id}.${step.id}`;
        if (step.target !== null && 'point' in step.target) add(label, step.target.point);
        if (step.target !== null && 'villager' in step.target) {
          const id = step.target.villager;
          const villager = place.villagers.find((v) => v.id === id);
          if (villager !== undefined) add(`${label}: poste de « ${id} »`, villager.stands, true);
        }
        for (const c of step.done) for (const p of conditionPoints(c, [])) add(label, p);
      }
  return spots;
}

/** Les endroits de quête que l'on n'atteint pas depuis l'arrivée; vide: le lieu respecte la règle. */
export function unreachableQuestSpots(content: Content, place: PlaceContent): string[] {
  const reached = walkableFromArrival(content, place);
  const { width } = place.map;
  const problems: string[] = [];
  for (const spot of questSpots(place)) {
    const x = Math.floor(spot.x);
    const y = Math.floor(spot.y);
    const around = spot.post ? NEIGHBOURS : [];
    const ok =
      reached.has(y * width + x) ||
      around.some(([dx, dy]) => reached.has((y + dy) * width + x + dx));
    if (!ok) problems.push(`${place.def.id}: ${spot.label} (${String(spot.x)}; ${String(spot.y)})`);
  }
  return problems;
}
