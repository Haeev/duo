/**
 * Règle d'accès des lieux: tout ce que l'histoire et la vie du lieu utilisent s'atteint à pied
 * depuis le point d'arrivée du lieu. Elle se lit dans les données seules (carte, intérieurs,
 * meubles, quêtes, scènes, habitants) et vaut pour tout lieu, présent ou à venir.
 *
 * La marche suit le jeu: quatre voisins, murs et meubles solides bloquent; franchir le seuil d'une
 * porte (`donnees/seuils.ts`) fait passer à sa jumelle (`portes.ts`: on arrive devant son seuil, ou
 * sur la case libre la plus proche). Une porte dans un mur se passe depuis la case devant son
 * seuil; une porte au sol (escalier, trappe) en marchant dessus, sa case ne se traverse donc pas.
 * Les verrous d'histoire bloquent tant que l'état de l'histoire ne les a pas levés;
 * `walkableFromArrival` sans état les compte ouverts.
 *
 * Devant chaque porte, des deux côtés, 1,5 m restent libres dans son axe (`doorClearanceProblems`):
 * on ne bute pas sur un meuble en entrant.
 */
import type { Content, PlaceContent } from '../src/donnees/charger';
import type { StepCondition } from '../src/donnees/schemas/quete';
import type { Condition } from '../src/donnees/schemas/regles';
import { DOORS, doorSills } from '../src/donnees/seuils';
import { interiorAt } from '../src/simulation/lieux/portes';
import { PLACES } from '../src/simulation/lieux/reglages';
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

/** Verrous levés: `undefined` les compte tous ouverts (l'histoire finie). */
type OpenLocks = ReadonlySet<string> | undefined;

/** Cases bloquées du lieu: murs de la carte et des intérieurs, meubles solides, verrous fermés. */
export function blockedCells(content: Content, place: PlaceContent, open?: OpenLocks): Uint8Array {
  const { width, height } = place.map;
  const cells = new Uint8Array(width * height);
  const fill = (x0: number, y0: number, x1: number, y1: number): void => {
    for (let cy = Math.max(0, y0); cy <= Math.min(height - 1, y1); cy++)
      for (let cx = Math.max(0, x0); cx <= Math.min(width - 1, x1); cx++)
        cells[cy * width + cx] = 1;
  };
  for (const r of place.map.blocked) fill(r.x, r.y, r.x + r.w - 1, r.y + r.h - 1);
  for (const [id, lock] of Object.entries(place.map.locks ?? {}))
    if (open !== undefined && !open.has(id))
      for (const r of lock.rects) fill(r.x, r.y, r.x + r.w - 1, r.y + r.h - 1);
  const lockObjects = new Set(Object.values(place.map.locks ?? {}).map((l) => l.object));
  for (const o of place.map.objects) {
    const def = content.props[o.type];
    if (def === undefined || !def.solid || lockObjects.has(o.id)) continue;
    // Une porte battante (brique `open`) s'ouvre: elle ne ferme aucun passage.
    if (def.bricks.some((b) => b.brick === 'open')) continue;
    for (const c of footprintCells(content, o)) fill(c.x, c.y, c.x, c.y);
  }
  return cells;
}

/** Cases couvertes par un meuble, comme le jeu les bloque (centre, taille du type, rotation). */
function footprintCells(
  content: Content,
  o: { readonly type: string; readonly x: number; readonly y: number; readonly rotation: number },
): Cell[] {
  const def = content.props[o.type];
  if (def === undefined) return [{ x: Math.floor(o.x), y: Math.floor(o.y) }];
  const size = footprintOf(def, o.rotation);
  const edge = 1e-6;
  const out: Cell[] = [];
  for (let y = Math.floor(o.y - size.h / 2 + edge); y <= Math.floor(o.y + size.h / 2 - edge); y++)
    for (let x = Math.floor(o.x - size.w / 2 + edge); x <= Math.floor(o.x + size.w / 2 - edge); x++)
      out.push({ x, y });
  return out;
}

/** Ce qu'une marche a rejoint: les cases, et les portes touchées (donc passées). */
export interface Walk {
  readonly cells: ReadonlySet<number>;
  readonly doors: ReadonlySet<string>;
}

/** Marche depuis l'arrivée du lieu, verrous `open` levés (tous sans état), portes franchies. */
export function walkFromArrival(content: Content, place: PlaceContent, open: OpenLocks): Walk {
  const { width, height } = place.map;
  const blocked = blockedCells(content, place, open);
  const doors = place.map.doors ?? {};
  const sills = doorSills(place.map, DOORS.width);
  const doorAt = new Map<number, string>();
  const touching = new Map<number, string[]>();
  const touch = (i: number, id: string): void => {
    touching.set(i, [...(touching.get(i) ?? []), id]);
  };
  for (const [id, d] of Object.entries(doors)) {
    const sill = sills[id];
    if (sill === undefined) continue;
    if (sill.kind === 'wall') {
      // On la passe depuis la case devant son seuil, en poussant vers le mur.
      touch(Math.floor(sill.y + sill.ny / 2) * width + Math.floor(sill.x + sill.nx / 2), id);
      continue;
    }
    const cx = Math.floor(d.x);
    const cy = Math.floor(d.y);
    doorAt.set(cy * width + cx, id);
    for (const [dx, dy] of [[0, 0] as const, ...NEIGHBOURS]) touch((cy + dy) * width + cx + dx, id);
  }
  const free = (x: number, y: number): boolean =>
    x >= 0 &&
    y >= 0 &&
    x < width &&
    y < height &&
    blocked[y * width + x] !== 1 &&
    !doorAt.has(y * width + x);
  // Arrivée devant la porte `id` (`passDoor`): devant son seuil, sinon la case libre la plus proche.
  const arrival = (id: string): number | null => {
    const sill = sills[id];
    if (sill === undefined) return null;
    const offset = sill.kind === 'floor' ? PLACES.floorArriveOffset : PLACES.arriveOffset;
    const x = sill.x + sill.nx * offset;
    const y = sill.y + sill.ny * offset;
    const tx = Math.floor(x);
    const ty = Math.floor(y);
    for (let r = 0; r <= content.settings.movement.freeCellRadius; r++) {
      let best: number | null = null;
      let bestD = Number.POSITIVE_INFINITY;
      for (let cy = ty - r; cy <= ty + r; cy++)
        for (let cx = tx - r; cx <= tx + r; cx++) {
          if (Math.max(Math.abs(cx - tx), Math.abs(cy - ty)) !== r || !free(cx, cy)) continue;
          const dist = Math.hypot(cx + 0.5 - x, cy + 0.5 - y);
          if (dist < bestD - 1e-9) {
            bestD = dist;
            best = cy * width + cx;
          }
        }
      if (best !== null) return best;
    }
    return null;
  };
  const seen = new Set<number>();
  const passed = new Set<string>();
  const queue: number[] = [];
  const visit = (i: number | null): void => {
    if (i === null || seen.has(i)) return;
    seen.add(i);
    queue.push(i);
  };
  const start = place.map.points[place.def.station.arrival];
  if (start === undefined) return { cells: seen, doors: passed };
  visit(Math.floor(start.y) * width + Math.floor(start.x));
  // La file grandit pendant le parcours: `for...of` lit aussi les cases ajoutées.
  for (const i of queue) {
    for (const id of touching.get(i) ?? []) {
      if (passed.has(id)) continue;
      passed.add(id);
      const to = doors[id]?.to;
      if (to !== undefined) visit(arrival(to));
    }
    const x = i % width;
    const y = (i - x) / width;
    for (const [dx, dy] of NEIGHBOURS) if (free(x + dx, y + dy)) visit((y + dy) * width + x + dx);
  }
  return { cells: seen, doors: passed };
}

/** Dégagement gardé libre devant chaque porte, dans son axe (m). */
export const DOOR_CLEARANCE = 1.5;

/**
 * Règle « 1,5 m libre devant chaque porte, des deux côtés »: dans l'axe de chaque porte du lieu
 * (celle du dehors comme celle de la pièce), aucune case pleine (mur, meuble solide) à moins de
 * `DOOR_CLEARANCE` de son seuil. Vide: le lieu respecte la règle.
 */
export function doorClearanceProblems(content: Content, place: PlaceContent): string[] {
  const { width, height } = place.map;
  const blocked = blockedCells(content, place);
  const sills = doorSills(place.map, DOORS.width);
  const problems: string[] = [];
  for (const [id, sill] of Object.entries(sills)) {
    // Porte au sol: on compte depuis le bord de sa case, du côté où l'on arrive.
    const from = sill.kind === 'floor' ? 0.5 : 0;
    for (const reach of [0.5, DOOR_CLEARANCE - 0.25]) {
      const x = Math.floor(sill.x + sill.nx * (from + reach));
      const y = Math.floor(sill.y + sill.ny * (from + reach));
      const full = x < 0 || y < 0 || x >= width || y >= height || blocked[y * width + x] === 1;
      if (!full) continue;
      const what = place.map.objects.find(
        (o) =>
          content.props[o.type]?.solid === true &&
          footprintCells(content, o).some((c) => c.x === x && c.y === y),
      );
      problems.push(
        `${place.def.id}: porte « ${id} »: ${what === undefined ? 'un mur' : `le meuble « ${what.id} »`} à moins de ${String(DOOR_CLEARANCE)} m dans son axe (case ${String(x)}; ${String(y)})`,
      );
      break;
    }
  }
  return problems;
}

/** Cases atteintes à pied depuis l'arrivée du lieu, verrous d'histoire ouverts. */
export function walkableFromArrival(content: Content, place: PlaceContent): Set<number> {
  return new Set(walkFromArrival(content, place, undefined).cells);
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
  const doorCells = new Set(
    Object.values(place.map.doors ?? {}).map((d) => Math.floor(d.y) * width + Math.floor(d.x)),
  );
  const problems: string[] = [];
  for (const spot of questSpots(place)) {
    const x = Math.floor(spot.x);
    const y = Math.floor(spot.y);
    // Un point sur le seuil d'une porte s'atteint en s'y présentant (y entrer, c'est la passer).
    const around = spot.post || doorCells.has(y * width + x) ? NEIGHBOURS : [];
    const ok =
      reached.has(y * width + x) ||
      around.some(([dx, dy]) => reached.has((y + dy) * width + x + dx));
    if (!ok) problems.push(`${place.def.id}: ${spot.label} (${String(spot.x)}; ${String(spot.y)})`);
  }
  return problems;
}

// ---------------------------------------------------------------- tout ce que l'histoire utilise

/** Un élément qui doit s'atteindre: porte, escalier, meuble à brique, point cité. */
export interface StoryElement extends Cell {
  readonly label: string;
  /** Intérieur qui le contient, `null` dehors. */
  readonly room: string | null;
  /** Porte: atteinte quand on la passe. */
  readonly door: string | null;
  /** Autres éléments: atteints quand l'une de ces cases l'est. */
  readonly touch: readonly number[];
}

/** Toutes les chaînes d'une fiche (quête, scène, habitant, lieu): les points qu'elle nomme. */
function strings(o: unknown, out: Set<string>): Set<string> {
  if (typeof o === 'string') out.add(o);
  else if (Array.isArray(o)) for (const v of o) strings(v, out);
  else if (o !== null && typeof o === 'object') for (const v of Object.values(o)) strings(v, out);
  return out;
}

/**
 * Ce que l'histoire et la vie du lieu utilisent: portes et escaliers, meubles à brique (lit,
 * siège, coffre, comptoir, réchaud, établi, poulailler...), points nommés par une quête, une
 * scène, un planning d'habitant ou la fiche du lieu, et tous les points des intérieurs.
 */
export function storyElements(content: Content, place: PlaceContent): StoryElement[] {
  const { width, height } = place.map;
  const index = (c: Cell): number[] =>
    c.x >= 0 && c.y >= 0 && c.x < width && c.y < height ? [c.y * width + c.x] : [];
  const around = (cells: readonly Cell[], inside: boolean): number[] => {
    const out = new Set<number>();
    for (const c of cells) {
      if (inside) for (const i of index(c)) out.add(i);
      for (const [dx, dy] of NEIGHBOURS)
        for (const i of index({ x: c.x + dx, y: c.y + dy })) out.add(i);
    }
    return [...out];
  };
  const out: StoryElement[] = [];
  for (const [id, d] of Object.entries(place.map.doors ?? {}))
    out.push({
      label: `porte « ${id} »`,
      room: interiorAt(place, d.x, d.y),
      door: id,
      touch: [],
      x: d.x,
      y: d.y,
    });
  const lockObjects = new Set(Object.values(place.map.locks ?? {}).map((l) => l.object));
  for (const o of place.map.objects) {
    const def = content.props[o.type];
    if (def === undefined || def.bricks.length === 0 || lockObjects.has(o.id)) continue;
    const bricks = def.bricks.map((b) => b.brick).join('/');
    out.push({
      label: `meuble « ${o.id} » (${o.type}, ${bricks})`,
      room: interiorAt(place, o.x, o.y),
      door: null,
      touch: around(footprintCells(content, o), !def.solid),
      x: o.x,
      y: o.y,
    });
  }
  const named = strings([place.def, place.quests, place.scenes, place.villagers], new Set());
  for (const [id, p] of Object.entries(place.map.points)) {
    const room = interiorAt(place, p.x, p.y);
    if (room === null && !named.has(id)) continue;
    const cell = { x: Math.floor(p.x), y: Math.floor(p.y) };
    out.push({
      label: `point « ${id} »`,
      room,
      door: null,
      touch: around([cell], true),
      x: p.x,
      y: p.y,
    });
  }
  return out;
}

/** Faits posés par une étape: ses effets de fin, et ceux des scènes qu'elle joue ou attend. */
function stepFacts(place: PlaceContent, step: unknown): Map<string, unknown> {
  const facts = new Map<string, unknown>();
  const read = (o: unknown): void => {
    if (Array.isArray(o)) for (const v of o) read(v);
    else if (o !== null && typeof o === 'object') {
      const r = o as Record<string, unknown>;
      if (r.type === 'remember' && typeof r.key === 'string') facts.set(r.key, r.value);
      for (const v of Object.values(r)) read(v);
    }
  };
  const s = step as { onDone: unknown; onStart: unknown[]; done: unknown[] };
  read(s.onDone);
  for (const c of [...s.done, ...s.onStart]) {
    const scene = (c as { scene?: unknown }).scene;
    if (typeof scene === 'string' && place.scenes[scene] !== undefined) read(place.scenes[scene]);
  }
  return facts;
}

/** Vrai si ces conditions tiennent avec ces faits. Seuls les faits retenus changent avec l'histoire. */
function holds(conditions: readonly Condition[], facts: ReadonlyMap<string, unknown>): boolean {
  const one = (c: Condition): boolean => {
    if (c.type === 'remembered')
      return facts.has(c.key) && (c.equals === undefined || facts.get(c.key) === c.equals);
    if (c.type === 'all') return c.conditions.every(one);
    if (c.type === 'any') return c.conditions.some(one);
    if (c.type === 'not') return !one(c.condition);
    // Heure, météo, besoins: l'histoire ne les fixe pas, on les compte vrais (le passage existe).
    return true;
  };
  return conditions.every(one);
}

/** Un état de l'histoire: les étapes à verrou franchies, et les verrous ouverts qui en découlent. */
export interface StoryState {
  readonly name: string;
  readonly open: ReadonlySet<string>;
}

/**
 * Tous les états de verrous que les fiches permettent: ensembles d'étapes qui lèvent un verrou,
 * fermés vers le bas (une étape franchie l'est avec ses ancêtres: `after`, sinon l'étape d'avant;
 * chapitres et suites l'un après l'autre, suites dans l'ordre de leurs `requires`), dans tous les
 * ordres des fils parallèles. Le dernier état lève tout.
 */
export function storyStates(place: PlaceContent): StoryState[] {
  const locks = Object.entries(place.map.locks ?? {});
  const lines = Object.values(place.quests);
  const order: string[] = [];
  while (order.length < lines.length) {
    const next = lines.find(
      (l) =>
        !order.includes(l.id) &&
        [...strings(l.requires, new Set())].every(
          (s) => place.quests[s] === undefined || s === l.id || order.includes(s),
        ),
    );
    // Suites en cercle: le chargement les refuse; on prend la suivante pour ne pas boucler.
    order.push((next ?? lines.find((l) => !order.includes(l.id)))?.id ?? '');
  }
  const steps = new Map<string, { anc: Set<string>; facts: Map<string, unknown> }>();
  const before: string[] = [];
  for (const id of order) {
    const line = place.quests[id];
    if (line === undefined) continue;
    for (const chapter of line.chapters) {
      const ids = chapter.steps.map((s) => `${id}/${s.id}`);
      chapter.steps.forEach((s, i) => {
        const pre = s.after?.map((a) => `${id}/${a}`) ?? (i > 0 ? [ids[i - 1] ?? ''] : []);
        const anc = new Set<string>(before);
        for (const p of pre) {
          anc.add(p);
          for (const a of steps.get(p)?.anc ?? []) anc.add(a);
        }
        steps.set(ids[i] ?? '', { anc, facts: stepFacts(place, s) });
      });
      before.push(...ids);
    }
  }
  const lockKeys = new Set<string>();
  for (const [, lock] of locks) for (const s of strings(lock.opens, new Set())) lockKeys.add(s);
  const keySteps = [...steps].filter(([, s]) => [...s.facts.keys()].some((k) => lockKeys.has(k)));
  const keyIds = new Set(keySteps.map(([k]) => k));
  const openOf = (done: ReadonlySet<string>): Set<string> => {
    const facts = new Map<string, unknown>();
    for (const k of done) for (const [f, v] of steps.get(k)?.facts ?? []) facts.set(f, v);
    return new Set(locks.filter(([, l]) => holds(l.opens, facts)).map(([id]) => id));
  };
  const seen = new Map<string, Set<string>>();
  const grow = (done: Set<string>): void => {
    const key = [...done].sort().join('+');
    if (seen.has(key)) return;
    seen.set(key, done);
    for (const [k, s] of keySteps)
      if (!done.has(k) && [...s.anc].every((a) => !keyIds.has(a) || done.has(a)))
        grow(new Set([...done, k]));
  };
  grow(new Set());
  const states: StoryState[] = [...seen].map(([key, done]) => ({
    name: key === '' ? 'début' : [...done].map((k) => k.split('/')[1] ?? k).join('+'),
    open: openOf(done),
  }));
  states.push({ name: 'tous verrous levés', open: new Set(locks.map(([id]) => id)) });
  return states;
}

/**
 * Les éléments de l'histoire (`storyElements`) qu'on n'atteint pas à pied depuis l'arrivée, dans
 * l'un des états de l'histoire. Un élément n'est attendu dans un état que si le graphe des chemins
 * du lieu y atteint le nœud le plus proche de lui (dans le même intérieur, ou dehors): ce qui est
 * derrière un verrou fermé attend son ouverture. Sans graphe, tout est attendu, verrous levés.
 * Vide: le lieu respecte la règle.
 */
export function unreachableStoryElements(content: Content, place: PlaceContent): string[] {
  const elements = storyElements(content, place);
  const graph = place.map.graph;
  const states =
    graph === undefined ? [{ name: 'tous verrous levés', open: undefined }] : storyStates(place);
  const nodes = Object.entries(graph?.nodes ?? {}).map(([id, n]) => ({
    id,
    ...n,
    room: interiorAt(place, n.x, n.y),
  }));
  const nearest = elements.map((e) => {
    let best: string | null = null;
    let bestD = Number.POSITIVE_INFINITY;
    for (const n of nodes) {
      const d = Math.hypot(n.x - e.x, n.y - e.y);
      if (n.room === e.room && d < bestD) {
        bestD = d;
        best = n.id;
      }
    }
    return best;
  });
  const graphReach = (open: ReadonlySet<string> | undefined): Set<string> => {
    const adj = new Map<string, string[]>();
    for (const e of graph?.edges ?? [])
      if (e.lock === null || open === undefined || open.has(e.lock)) {
        adj.set(e.a, [...(adj.get(e.a) ?? []), e.b]);
        adj.set(e.b, [...(adj.get(e.b) ?? []), e.a]);
      }
    const start = place.def.station.arrival;
    const seen = new Set([start]);
    const queue = [start];
    for (const u of queue)
      for (const w of adj.get(u) ?? [])
        if (!seen.has(w)) {
          seen.add(w);
          queue.push(w);
        }
    return seen;
  };
  const problems = new Map<string, string>();
  for (const state of states) {
    const walk = walkFromArrival(content, place, state.open);
    const expected = state.name === 'tous verrous levés' ? null : graphReach(state.open);
    elements.forEach((e, k) => {
      const node = nearest[k];
      if (problems.has(e.label)) return;
      if (expected !== null && node !== null && node !== undefined && !expected.has(node)) return;
      const ok = e.door !== null ? walk.doors.has(e.door) : e.touch.some((i) => walk.cells.has(i));
      if (ok) return;
      const room = e.room === null ? null : place.interiors.find((r) => r.id === e.room);
      const where =
        room === null || room === undefined
          ? `dehors (${String(e.x)}; ${String(e.y)})`
          : `dans « ${room.id} » (${String(e.x - room.at.x)}; ${String(e.y - room.at.y)})`;
      problems.set(e.label, `${place.def.id}, état ${state.name}: ${e.label}, ${where}`);
    });
  }
  return [...problems.values()];
}
