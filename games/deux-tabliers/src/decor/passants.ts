/**
 * Passants de la place (retour de séance du 2026-11-09: « le village est désert en extérieur »).
 * Du décor, simulé à part chez chaque joueur, sans réseau: une graine commune (`duo.seed`) et la
 * seconde de service de l'état partagé font naître les mêmes passants aux mêmes instants chez les
 * deux joueurs; leur marche avance ensuite au temps de chaque machine (aucun saut si la frise change).
 *
 * Chaque passant a une raison d'être là et va quelque part de réel (`place.ts`): il traverse la place
 * d'un bord à l'autre ou rentre chez lui, va à la boulangerie, à la mairie, à l'église (il y entre et
 * en ressort), s'assoit un moment sur un banc, dépose son enfant à l'école le matin ou l'attend à
 * 16 h 30; des écoliers rentrent seuls. Les clients du café viennent de la place: on voit venir ceux
 * que la simulation fera entrer (`arrivals`, `expected` de l'état), et ceux qui repartent continuent
 * leur chemin. Un client attendu qui renonce (file trop longue) regarde la porte et s'en va.
 *
 * Rien ne traverse rien: chemins tenus loin des obstacles (`tests/passants.test.ts`), voie à droite
 * du chemin, départ décalé si le trajet croiserait un autre passant de trop près, arrêt devant un
 * joueur, un client ou un passant (patience bornée envers les passants).
 */
import { createRandom, deriveSeed, type RandomSource } from '@duo/sdk';
import { EDGES, NODES, PLACES, groundAt, placeById, type NodeId, type Place } from './place';
import { PASSERS, type PurposeId } from './reglages';

export type PasserAnim = 'walk' | 'idle' | 'sit';

interface Seg {
  readonly kind: 'walk' | 'idle' | 'sit' | 'hidden';
  readonly t0: number;
  t1: number;
  /** Marche: points (x, z) et longueurs cumulées. */
  readonly xs: readonly number[];
  readonly zs: readonly number[];
  readonly cum: readonly number[];
  readonly speed: number;
  /** Arrêt, assise: lieu et cap. */
  readonly x: number;
  readonly z: number;
  readonly yawDeg: number;
  /** Assise: hauteur du siège. */
  readonly seatY: number;
}

export interface Member {
  readonly model: string;
  readonly scale: number;
  /** Âges du trajet où ce membre se voit (un enfant déposé, un enfant récupéré). */
  readonly from: number;
  readonly until: number;
}

/** Client attendu au café: le passant s'efface quand la simulation le fait entrer. */
interface Approach {
  readonly sec: number;
  readonly profile: string | null;
  readonly regular: string | null;
  /** Âge où il est à la porte. */
  readonly at: number;
  done: boolean;
}

export interface Trip {
  readonly key: string;
  readonly purpose: string;
  readonly members: Member[];
  readonly segs: Seg[];
  age: number;
  end: number;
  /** Banc ou place d'attente tenue pendant le trajet. */
  readonly reserve: string | null;
  readonly approach: Approach | null;
  /** Secondes passées arrêté devant un autre passant (patience). */
  blocked: number;
  /** Arrêté à cette image (animation d'attente). */
  halted: boolean;
}

export interface PasserPose {
  x: number;
  y: number;
  z: number;
  yawDeg: number;
  anim: PasserAnim;
}

/** Ce que le décor lit de la partie à chaque image. */
export interface PassersInput {
  readonly minute: number;
  readonly segment: string;
  readonly timeline: number;
  readonly shared: boolean;
  /** Secondes réelles par minute de jeu (rythme du service). */
  readonly spm: number;
  readonly weather: string;
}

/** Clientèle vue par le décor (état partagé): arrivées prévues, habitués attendus, groupes. */
export interface ClienteleView {
  readonly arrivals: readonly (readonly [number, string, number, boolean])[];
  readonly expected: readonly (readonly [number, string])[];
  readonly groups: readonly {
    readonly id: number;
    readonly stage: string;
    readonly profile: string;
    readonly regular: string | null;
    readonly arrivedAt: number;
  }[];
}

/** Modèles des clients (rendu des clients): à l'arrivée (devinés) et au départ (connus). */
export interface CustomerModels {
  arriving(profile: string | null, regular: string | null, size: number): string[];
  leaving(groupId: number): string[];
}

export interface Body {
  readonly x: number;
  readonly z: number;
}

export interface Passers {
  update(
    input: PassersInput,
    dt: number,
    bodies: readonly Body[],
    clientele: ClienteleView | null,
  ): void;
  trips(): readonly Trip[];
  /** Pose du membre `k`; `false` s'il ne se voit pas (dans un bâtiment, pas encore parti). */
  pose(trip: Trip, k: number, out: PasserPose): boolean;
  dispose(): void;
}

// -----------------------------------------------------------------------------------------------
// Réseau de chemins

const ADJ = new Map<NodeId, { to: NodeId; d: number }[]>();
for (const [a, b] of EDGES) {
  const d = Math.hypot(NODES[a].x - NODES[b].x, NODES[a].z - NODES[b].z);
  ADJ.set(a, [...(ADJ.get(a) ?? []), { to: b, d }]);
  ADJ.set(b, [...(ADJ.get(b) ?? []), { to: a, d }]);
}

/** Plus court chemin (Dijkstra, une trentaine de nœuds). */
export function nodePath(from: NodeId, to: NodeId): NodeId[] {
  const dist = new Map<NodeId, number>([[from, 0]]);
  const prev = new Map<NodeId, NodeId>();
  const open = new Set<NodeId>([from]);
  while (open.size > 0) {
    let best: NodeId | null = null;
    for (const n of open) if (best === null || (dist.get(n) ?? 0) < (dist.get(best) ?? 0)) best = n;
    if (best === null || best === to) break;
    open.delete(best);
    for (const e of ADJ.get(best) ?? []) {
      const d = (dist.get(best) ?? 0) + e.d;
      if (d < (dist.get(e.to) ?? Infinity)) {
        dist.set(e.to, d);
        prev.set(e.to, best);
        open.add(e.to);
      }
    }
  }
  const out: NodeId[] = [to];
  for (let n = prev.get(to); n !== undefined; n = prev.get(n)) out.unshift(n);
  return out[0] === from ? out : [from, to];
}

/**
 * Points d'un trajet de `a` à `b` (lieux), voie à droite: les nœuds traversés sont décalés de
 * `lane` mètres vers la droite du sens de marche; départ et arrivée restent sur le lieu.
 */
export function routePoints(a: Place, b: Place, lane: number): { xs: number[]; zs: number[] } {
  const pts: [number, number][] = [[a.x, a.z]];
  for (const n of nodePath(a.node, b.node)) pts.push([NODES[n].x, NODES[n].z]);
  pts.push([b.x, b.z]);
  const clean: [number, number][] = [];
  for (const p of pts) {
    const last = clean[clean.length - 1];
    if (last === undefined || Math.hypot(last[0] - p[0], last[1] - p[1]) > 0.05) clean.push(p);
  }
  const xs: number[] = [];
  const zs: number[] = [];
  for (let i = 0; i < clean.length; i++) {
    const p = clean[i] ?? [0, 0];
    const prev = clean[i - 1];
    const next = clean[i + 1];
    if (prev === undefined || next === undefined) {
      xs.push(p[0]);
      zs.push(p[1]);
      continue;
    }
    const n1 = rightOf(p[0] - prev[0], p[1] - prev[1]);
    const n2 = rightOf(next[0] - p[0], next[1] - p[1]);
    let nx = n1[0] + n2[0];
    let nz = n1[1] + n2[1];
    const l = Math.hypot(nx, nz);
    if (l < 1e-6) {
      nx = n1[0];
      nz = n1[1];
    } else {
      nx /= l;
      nz /= l;
    }
    const miter = lane / Math.max(0.6, nx * n1[0] + nz * n1[1]);
    xs.push(p[0] + nx * miter);
    zs.push(p[1] + nz * miter);
  }
  return { xs, zs };
}

/** Droite du sens de marche (x vers l'est, z vers le sud: face au nord, la droite est l'est). */
function rightOf(dx: number, dz: number): [number, number] {
  const l = Math.hypot(dx, dz) || 1;
  return [-dz / l, dx / l];
}

// -----------------------------------------------------------------------------------------------
// Construction des trajets

class Builder {
  readonly segs: Seg[] = [];
  t = 0;
  x: number;
  z: number;
  yaw = 0;
  constructor(readonly at: Place) {
    this.x = at.x;
    this.z = at.z;
    this.yaw = at.yawDeg;
  }

  walk(to: Place, speed: number, lane: number): this {
    const from: Place = { ...this.at, x: this.x, z: this.z, node: this.nodeNear() };
    const { xs, zs } = routePoints(from, to, lane);
    const cum = [0];
    for (let i = 1; i < xs.length; i++)
      cum.push(
        (cum[i - 1] ?? 0) +
          Math.hypot((xs[i] ?? 0) - (xs[i - 1] ?? 0), (zs[i] ?? 0) - (zs[i - 1] ?? 0)),
      );
    const len = cum[cum.length - 1] ?? 0;
    const t1 = this.t + len / speed;
    this.segs.push({ ...BASE, kind: 'walk', t0: this.t, t1, xs, zs, cum, speed });
    this.t = t1;
    this.x = to.x;
    this.z = to.z;
    this.yaw = to.yawDeg;
    this.last = to;
    return this;
  }

  /** Droit au point (quelques mètres sans obstacle: de la place d'attente à la porte). */
  step(to: Place, speed: number): this {
    const len = Math.hypot(to.x - this.x, to.z - this.z);
    const t1 = this.t + len / speed;
    this.segs.push({
      ...BASE,
      kind: 'walk',
      t0: this.t,
      t1,
      xs: [this.x, to.x],
      zs: [this.z, to.z],
      cum: [0, len],
      speed,
    });
    this.t = t1;
    this.x = to.x;
    this.z = to.z;
    this.yaw = to.yawDeg;
    this.last = to;
    return this;
  }

  hold(kind: 'idle' | 'sit' | 'hidden', seconds: number, seatY = 0): this {
    const t1 = this.t + Math.max(0, seconds);
    this.segs.push({
      ...BASE,
      kind,
      t0: this.t,
      t1,
      x: this.x,
      z: this.z,
      yawDeg: this.yaw,
      seatY,
    });
    this.t = t1;
    return this;
  }

  last: Place | null = null;
  private nodeNear(): NodeId {
    return (this.last ?? this.at).node;
  }
}

const BASE: Seg = {
  kind: 'idle',
  t0: 0,
  t1: 0,
  xs: [],
  zs: [],
  cum: [],
  speed: 1,
  x: 0,
  z: 0,
  yawDeg: 0,
  seatY: 0,
};

/** Hauteur de l'assise des bancs de la place (sol -0,16, lattes à 0,47 au-dessus). */
const BENCH_SEAT_Y = 0.31;

function weighted<T>(rng: RandomSource, items: readonly (readonly [T, number])[]): T | null {
  let total = 0;
  for (const [, w] of items) total += Math.max(0, w);
  if (total <= 0) return null;
  let r = rng.next() * total;
  for (const [item, w] of items) {
    r -= Math.max(0, w);
    if (r < 0) return item;
  }
  return items[items.length - 1]?.[0] ?? null;
}

function home(rng: RandomSource, not: string | null): Place {
  const list = PASSERS.homes.filter(([id]) => id !== not);
  const id = weighted(rng, list) ?? 'ouest';
  return placeById(id) ?? PLACES[0] ?? { id, kind: 'edge', node: 'ouest', x: 0, z: 0, yawDeg: 0 };
}

/** Interpolation linéaire d'un tableau [heure, valeur] à la minute `m`. */
function byHour(table: readonly (readonly [number, number])[], m: number): number {
  const h = m / 60;
  let prev = table[0];
  if (prev === undefined) return 0;
  if (h <= prev[0]) return prev[1];
  for (const row of table) {
    if (row[0] >= h) {
      const t = (h - prev[0]) / Math.max(1e-6, row[0] - prev[0]);
      return prev[1] + (row[1] - prev[1]) * t;
    }
    prev = row;
  }
  return prev[1];
}

function purposeWeights(m: number): [PurposeId, number][] {
  const ids: PurposeId[] = ['traverser', 'boulangerie', 'mairie', 'eglise', 'banc'];
  return ids.map((id) => [
    id,
    byHour(
      PASSERS.purposes.map(([h, w]) => [h, w[id]] as const),
      m,
    ),
  ]);
}

/** Pas d'échantillonnage des trajets pour les croisements (s). */
const TRACK_STEP = 0.1;

const range = (rng: RandomSource, [a, b]: readonly [number, number]): number => rng.float(a, b);

// -----------------------------------------------------------------------------------------------
// Poses

function segAt(trip: Trip, age: number): Seg | null {
  for (const s of trip.segs) if (age < s.t1) return s;
  return trip.segs[trip.segs.length - 1] ?? null;
}

/** Pose du meneur à l'âge `age` (sans les membres); `false` s'il ne se voit pas. */
export function leadPose(trip: Trip, age: number, out: PasserPose): boolean {
  if (age < 0) return false;
  const s = segAt(trip, age);
  if (s === null || s.kind === 'hidden') return false;
  if (s.kind === 'walk') {
    const d = Math.min(s.cum[s.cum.length - 1] ?? 0, Math.max(0, (age - s.t0) * s.speed));
    let i = 1;
    while (i < s.cum.length - 1 && (s.cum[i] ?? 0) < d) i++;
    const a = s.cum[i - 1] ?? 0;
    const b = s.cum[i] ?? a;
    const t = b - a > 1e-6 ? (d - a) / (b - a) : 0;
    const x0 = s.xs[i - 1] ?? 0;
    const z0 = s.zs[i - 1] ?? 0;
    const x1 = s.xs[i] ?? x0;
    const z1 = s.zs[i] ?? z0;
    out.x = x0 + (x1 - x0) * t;
    out.z = z0 + (z1 - z0) * t;
    if (Math.hypot(x1 - x0, z1 - z0) > 1e-6)
      out.yawDeg = (Math.atan2(-(x1 - x0), -(z1 - z0)) * 180) / Math.PI;
    out.anim = 'walk';
    out.y = groundAt(out.x, out.z);
    return true;
  }
  out.x = s.x;
  out.z = s.z;
  out.yawDeg = s.yawDeg;
  out.anim = s.kind === 'sit' ? 'sit' : 'idle';
  out.y = s.kind === 'sit' ? s.seatY : groundAt(s.x, s.z);
  return true;
}

/** Place du membre `k` d'après le meneur: l'enfant à droite du parent, les autres deux par deux. */
export function memberPose(trip: Trip, k: number, age: number, out: PasserPose): boolean {
  if (!leadPose(trip, age, out)) return false;
  if (k === 0) return true;
  const m = trip.members[k];
  if (m === undefined || age < m.from || age >= m.until) return false;
  const a = (out.yawDeg * Math.PI) / 180;
  const child = m.scale < 1;
  // Côté gauche d'abord: le meneur tient la voie de droite, le suiveur reste près du milieu du
  // chemin (jamais poussé vers un obstacle du bord).
  const back = child ? 0.15 : 0.55 * Math.ceil(k / 2);
  const side = child ? -0.42 : k % 2 === 1 ? -0.34 : 0.3;
  // Derrière (sens opposé au cap) et sur le côté (droite du cap).
  out.x += Math.sin(a) * back + Math.cos(a) * side;
  out.z += Math.cos(a) * back - Math.sin(a) * side;
  if (out.anim !== 'sit') out.y = groundAt(out.x, out.z);
  return true;
}

// -----------------------------------------------------------------------------------------------
// Le décor

export function createPassers(seed: number, models: CustomerModels | null): Passers {
  const trips: Trip[] = [];
  const spawned = new Set<string>();
  let segment = '';
  let lastSlot = 0;
  let first = true;
  const leaving = new Map<number, string[]>();
  const tmpA: PasserPose = { x: 0, y: 0, z: 0, yawDeg: 0, anim: 'idle' };
  const tmpB: PasserPose = { x: 0, y: 0, z: 0, yawDeg: 0, anim: 'idle' };

  const reserved = (id: string): boolean => trips.some((t) => t.reserve === id);
  /** Positions échantillonnées de chaque membre (x, z, état), de l'âge 0 à la fin du trajet. */
  const tracks = new WeakMap<Trip, Float32Array[]>();
  /** Emprise de chaque trajet (x0, z0, x1, z1): deux trajets qui ne se recouvrent pas ne se croisent pas. */
  const boxes = new WeakMap<Trip, Float32Array>();
  const boxOf = (trip: Trip): Float32Array => {
    const known = boxes.get(trip);
    if (known !== undefined) return known;
    const b = new Float32Array([Infinity, Infinity, -Infinity, -Infinity]);
    for (const arr of trackOf(trip))
      for (let i = 0; i < arr.length; i += 3) {
        if (arr[i + 2] === 0) continue;
        const x = arr[i] ?? 0;
        const z = arr[i + 1] ?? 0;
        b[0] = Math.min(b[0] ?? 0, x);
        b[1] = Math.min(b[1] ?? 0, z);
        b[2] = Math.max(b[2] ?? 0, x);
        b[3] = Math.max(b[3] ?? 0, z);
      }
    boxes.set(trip, b);
    return b;
  };
  const trackOf = (trip: Trip): Float32Array[] => {
    const known = tracks.get(trip);
    if (known !== undefined) return known;
    const n = Math.ceil(trip.end / TRACK_STEP) + 1;
    const out = trip.members.map(() => new Float32Array(n * 3));
    for (let i = 0; i < n; i++)
      for (let k = 0; k < trip.members.length; k++) {
        const arr = out[k];
        if (arr === undefined) continue;
        const seen = memberPose(trip, k, i * TRACK_STEP, tmpA);
        arr[i * 3] = tmpA.x;
        arr[i * 3 + 1] = tmpA.z;
        arr[i * 3 + 2] = !seen ? 0 : tmpA.anim === 'sit' ? 2 : 1;
      }
    tracks.set(trip, out);
    return out;
  };

  /** Le trajet croiserait-il de trop près un passant déjà là (même instant à venir)? */
  /**
   * Le trajet croiserait-il de trop près un passant déjà là (mêmes instants à venir)? Les positions
   * de chaque trajet sont échantillonnées une fois (`trackOf`, pas de 0,1 s): un départ essayé à
   * plusieurs décalages ne coûte que des lectures de tableaux (aucun à-coup sur le PC).
   */
  const conflicts = (trip: Trip): boolean => {
    const mine = trackOf(trip);
    const n = Math.round((trip.end - trip.age) / TRACK_STEP);
    const i0 = Math.round(trip.age / TRACK_STEP);
    const min2 = PASSERS.spacing * PASSERS.spacing;
    const box = boxOf(trip);
    const m = PASSERS.spacing;
    for (const o of trips) {
      const ob = boxOf(o);
      if (
        (ob[0] ?? 0) > (box[2] ?? 0) + m ||
        (ob[2] ?? 0) < (box[0] ?? 0) - m ||
        (ob[1] ?? 0) > (box[3] ?? 0) + m ||
        (ob[3] ?? 0) < (box[1] ?? 0) - m
      )
        continue;
      const theirs = trackOf(o);
      const j0 = Math.round(o.age / TRACK_STEP);
      for (const a of mine) {
        for (const b of theirs) {
          for (let d = 0; d < n; d++) {
            const ia = (i0 + d) * 3;
            const ib = (j0 + d) * 3;
            if (ia < 0 || ib < 0) continue;
            if (ib >= b.length || ia >= a.length) break;
            const va = a[ia + 2] ?? 0;
            const vb = b[ib + 2] ?? 0;
            // 1: debout et visible; 2: assis (bancs réservés, on ne vérifie pas son propre banc).
            if (va !== 1 || vb === 0) continue;
            const dx = (a[ia] ?? 0) - (b[ib] ?? 0);
            const dz = (a[ia + 1] ?? 0) - (b[ib + 1] ?? 0);
            if (dx * dx + dz * dz < min2) return true;
          }
        }
      }
    }
    return false;
  };

  /**
   * Allure la moins portée en ce moment (puis au hasard parmi elles): deux sosies côte à côte sur
   * un banc se remarquent. `also`: membres déjà choisis pour ce trajet.
   */
  const leastUsed = (
    rng: RandomSource,
    list: readonly string[],
    also: readonly Member[],
  ): string => {
    let best: string[] = [];
    let bestN = Infinity;
    for (const m of list) {
      let n = also.filter((x) => x.model === m).length * 10;
      for (const t of trips) for (const x of t.members) if (x.model === m) n++;
      if (n < bestN) {
        bestN = n;
        best = [m];
      } else if (n === bestN) best.push(m);
    }
    return best.length > 0 ? rng.pick(best) : rng.pick(list);
  };
  const adult = (rng: RandomSource, also: readonly Member[] = []): Member => ({
    model: leastUsed(rng, PASSERS.adults, also),
    scale: rng.float(0.97, 1.03),
    from: -Infinity,
    until: Infinity,
  });
  const child = (
    rng: RandomSource,
    from = -Infinity,
    until = Infinity,
    also: readonly Member[] = [],
  ): Member => ({
    model: leastUsed(rng, PASSERS.children, also),
    scale: PASSERS.childScale * rng.float(0.94, 1.06),
    from,
    until,
  });
  /** Passants dehors (ni dans un bâtiment ni pas encore partis): le plafond `maxPassers`. */
  const outside = (): number => {
    let n = 0;
    for (const t of trips) if (leadPose(t, t.age, tmpA)) n++;
    return n;
  };

  /** Un trajet du décor (motif tiré, ou école), `null` si rien ne part à cette seconde. */
  const build = (
    rng: RandomSource,
    minute: number,
    spm: number,
    weather: string,
    crowded: boolean,
  ): Omit<Trip, 'age' | 'key'> | null => {
    const w = PASSERS.weather[weather] ?? 1;
    const perSec = (perHour: number): number => (perHour * w) / (60 * spm);
    const speed = rng.float(PASSERS.speed[0], PASSERS.speed[1]);
    const lane = PASSERS.lane;
    const sc = PASSERS.school;
    const mairie = placeById('mairie');
    // École, le matin: un parent dépose son enfant à la porte de la mairie-école.
    if (minute >= sc.morning[0] && minute < sc.morning[1] && mairie !== undefined) {
      if (rng.next() < perSec(sc.morningPerHour)) {
        const from = home(rng, null);
        const b = new Builder(from).walk(mairie, PASSERS.childSpeed, lane).hold('idle', 2.5);
        const drop = b.t;
        b.walk(home(rng, null), speed, lane).hold('hidden', 0);
        return finish('ecole_matin', [adult(rng), child(rng, -Infinity, drop)], b, null, null);
      }
    }
    // 16 h 30: les parents attendent devant la mairie-école, puis repartent avec leur enfant.
    if (minute >= sc.parentsFrom && minute < sc.outMinute + 4 && mairie !== undefined) {
      if (rng.next() < perSec(sc.parentsPerHour)) {
        const from = home(rng, null);
        const waits = PLACES.filter((p) => p.kind === 'wait' && !reserved(p.id));
        // Quatre places devant la façade: au-delà, on ne vient pas plus tôt (personne ne fait
        // le pied de grue au milieu du passage).
        if (waits.length === 0) return null;
        const spot = rng.pick(waits);
        const b = new Builder(from).walk(spot, speed, lane);
        // Comme à l'école: jusqu'à 16 h 30 et quelques, on attend; minutes de jeu en secondes réelles.
        const out = (sc.outMinute + rng.float(0.5, 4) - minute) * spm;
        b.hold('idle', Math.max(2, out - b.t));
        b.step(mairie, PASSERS.childSpeed);
        b.hold('idle', 2.5);
        const pick = b.t;
        b.walk(home(rng, null), PASSERS.childSpeed, lane).hold('hidden', 0);
        return finish('ecole_sortie', [adult(rng), child(rng, pick)], b, spot.id, null);
      }
    }
    // Après la sortie: des écoliers rentrent seuls, à deux.
    if (minute >= sc.outMinute && minute < sc.pupilsUntil && mairie !== undefined) {
      if (rng.next() < perSec(sc.pupilsPerHour)) {
        const b = new Builder(mairie).walk(home(rng, null), PASSERS.childSpeed, lane);
        b.hold('hidden', 0);
        const kid = child(rng);
        return finish('ecoliers', [kid, child(rng, -Infinity, Infinity, [kid])], b, null, null);
      }
    }
    // Les sorties de l'école passent toujours; les autres attendent qu'il y ait de la place.
    if (rng.next() >= perSec(byHour(PASSERS.perHour, minute)) || crowded) return null;
    const purpose = weighted(rng, purposeWeights(minute)) ?? 'traverser';
    const from = home(rng, null);
    const to = home(rng, from.id);
    const b = new Builder(from);
    const members = [adult(rng)];
    // Un sur cinq sort à deux (un couple, deux voisines).
    if (rng.next() < 0.2) members.push(adult(rng, members));
    let reserve: string | null = null;
    const visit = (id: string, dwell: readonly [number, number]): void => {
      const door = placeById(id);
      if (door === undefined) return;
      b.walk(door, speed, lane).hold('hidden', range(rng, dwell));
    };
    if (purpose === 'boulangerie') visit('boulangerie', PASSERS.dwell.boulangerie);
    else if (purpose === 'mairie') visit('mairie', PASSERS.dwell.mairie);
    else if (purpose === 'eglise') visit('eglise', PASSERS.dwell.eglise);
    else if (purpose === 'banc') {
      const seats = PLACES.filter((p) => p.kind === 'seat' && !reserved(p.id));
      const seat = seats.length > 0 ? rng.pick(seats) : null;
      if (seat !== null) {
        // Assis seul sur sa place (un banc de deux places: à deux, chacun la sienne serait trop
        // serré pour un groupe; on garde un passant par place).
        members.length = 1;
        reserve = seat.id;
        b.walk({ ...seat, x: NODES[seat.node].x, z: NODES[seat.node].z }, speed, lane);
        b.step(seat, 0.8).hold('sit', range(rng, PASSERS.dwell.banc), BENCH_SEAT_Y);
        b.step({ ...seat, x: NODES[seat.node].x, z: NODES[seat.node].z }, 0.8);
      }
    }
    b.walk(to, speed, lane).hold('hidden', 0);
    return finish(purpose, members, b, reserve, null);
  };

  const finish = (
    purpose: string,
    members: Member[],
    b: Builder,
    reserve: string | null,
    approach: Approach | null,
  ): Omit<Trip, 'age' | 'key'> => ({
    purpose,
    members,
    segs: b.segs,
    end: b.t,
    reserve,
    approach,
    blocked: 0,
    halted: false,
  });

  const add = (key: string, t: Omit<Trip, 'age' | 'key'>, age: number, avoid: boolean): void => {
    if (age >= t.end) return;
    const trip: Trip = { ...t, key, age };
    if (avoid) {
      let tries = 0;
      while (conflicts(trip)) {
        if (++tries > PASSERS.delayTries) return;
        trip.age -= PASSERS.delayStep;
      }
    }
    trips.push(trip);
  };

  const spawnSlot = (input: PassersInput, slot: number, age: number): void => {
    const rng = createRandom(deriveSeed(seed, `passants:${input.segment}:${String(slot)}`));
    const minute = input.shared ? input.minute - (input.timeline - slot) / input.spm : input.minute;
    const t = build(rng, minute, input.spm, input.weather, outside() >= PASSERS.maxPassers);
    if (t !== null) add(`${input.segment}:${String(slot)}`, t, age, true);
  };

  /** Clients attendus: ils viennent d'un lieu de la place et arrivent à la porte à leur seconde. */
  const approaches = (input: PassersInput, c: ClienteleView): void => {
    if (!input.shared || models === null) return;
    const cafe = placeById('cafe');
    if (cafe === undefined) return;
    const list: [number, string | null, string | null, number][] = [
      ...c.arrivals.map(([sec, profile, size]): [number, string | null, string | null, number] => [
        sec,
        profile,
        null,
        size,
      ]),
      ...c.expected.map(([sec, id]): [number, string | null, string | null, number] => [
        sec,
        null,
        id,
        1,
      ]),
    ];
    for (const [sec, profile, regular, size] of list) {
      if (sec <= input.timeline) continue;
      const key = `${input.segment}:client:${String(sec)}:${profile ?? regular ?? ''}`;
      if (spawned.has(key)) continue;
      const rng = createRandom(deriveSeed(seed, key));
      const from = home(rng, null);
      const speed = rng.float(PASSERS.speed[0], PASSERS.speed[1]);
      const b = new Builder(from).walk(cafe, speed, PASSERS.lane);
      const at = b.t;
      if (sec - at > input.timeline) continue;
      spawned.add(key);
      b.hold('idle', PASSERS.arrivalWaitSeconds);
      const names = models.arriving(profile, regular, Math.max(1, size));
      const members = names.map((model) => ({ model, scale: 1, from: -Infinity, until: Infinity }));
      add(
        key,
        finish('client', members, b, null, { sec, profile, regular, at, done: false }),
        input.timeline - (sec - at),
        false,
      );
    }
  };

  /** Le client attendu est entré (groupe né à sa seconde): le passant s'efface; sinon il repart. */
  const resolveApproach = (trip: Trip, c: ClienteleView | null): void => {
    const a = trip.approach;
    if (a === null || a.done) return;
    const entered =
      c?.groups.some(
        (g) =>
          Math.abs(g.arrivedAt - a.sec) <= 2 &&
          (a.regular === null
            ? g.profile === a.profile && g.regular === null
            : g.regular === a.regular),
      ) ?? false;
    if (entered) {
      // Le client entre (dessiné par le rendu des clients à la porte): le passant qui le figurait
      // s'efface, tout près de la porte (retardé par un arrêt, il a pu prendre un pas de retard).
      a.done = true;
      trip.end = trip.age;
      return;
    }
    if (trip.age < a.at + PASSERS.arrivalWaitSeconds - 0.05) return;
    // Il a renoncé (file trop longue, café plein): il regarde encore la porte et s'en va.
    a.done = true;
    const rng = createRandom(deriveSeed(seed, `${trip.key}:renonce`));
    const cafe = placeById('cafe');
    if (cafe === undefined) return;
    const b = new Builder(cafe);
    b.t = trip.end;
    b.walk(home(rng, null), rng.float(PASSERS.speed[0], PASSERS.speed[1]), PASSERS.lane);
    b.hold('hidden', 0);
    trip.segs.push(...b.segs);
    trip.end = b.t;
    tracks.delete(trip);
    boxes.delete(trip);
  };

  /** Clients qui repartent: à la porte, ils deviennent des passants qui rentrent chez eux. */
  const departures = (input: PassersInput, c: ClienteleView): void => {
    if (models === null) return;
    const present = new Set<number>();
    for (const g of c.groups) {
      present.add(g.id);
      if (g.stage === 'leaving' && !leaving.has(g.id)) leaving.set(g.id, models.leaving(g.id));
    }
    for (const [id, names] of leaving) {
      if (present.has(id)) continue;
      leaving.delete(id);
      const cafe = placeById('cafe');
      if (cafe === undefined || names.length === 0) continue;
      const key = `${input.segment}:depart:${String(id)}`;
      const rng = createRandom(deriveSeed(seed, key));
      const b = new Builder(cafe).walk(
        home(rng, null),
        rng.float(PASSERS.speed[0], PASSERS.speed[1]),
        PASSERS.lane,
      );
      b.hold('hidden', 0);
      const members = names.map((model) => ({ model, scale: 1, from: -Infinity, until: Infinity }));
      add(key, finish('client', members, b, null, null), 0, false);
    }
  };

  return {
    update(input, dt, bodies, clientele) {
      if (input.segment !== segment) {
        segment = input.segment;
        spawned.clear();
        lastSlot = Math.floor(input.timeline) - (first ? PASSERS.prewarmSeconds : 1);
        if (first) {
          // Place déjà vivante au premier affichage: les départs des dernières secondes, avancés.
          for (let s = lastSlot + 1; s <= Math.floor(input.timeline); s++)
            spawnSlot(input, s, input.timeline - s);
          lastSlot = Math.floor(input.timeline);
        }
        first = false;
      }
      // Marche et arrêts (devant quelqu'un: on attend; envers un passant, patience bornée).
      for (const t of trips) {
        t.halted = false;
        if (leadPose(t, t.age, tmpA) && tmpA.anim === 'walk') {
          const a = (tmpA.yawDeg * Math.PI) / 180;
          const fx = -Math.sin(a);
          const fz = -Math.cos(a);
          const ahead = (bx: number, bz: number): boolean => {
            const dx = bx - tmpA.x;
            const dz = bz - tmpA.z;
            const d = Math.hypot(dx, dz);
            return d < PASSERS.yieldDistance && d > 1e-3 && dx * fx + dz * fz > 0.5 * d;
          };
          let stop = bodies.some((b) => ahead(b.x, b.z));
          if (!stop && t.blocked < PASSERS.yieldPatience)
            for (const o of trips) {
              if (o === t) continue;
              // Entre passants, les horaires suffisent (départs décalés, `conflicts`): on ne
              // s'arrête que derrière un passant lui-même arrêté (devant un joueur, un client),
              // seul écart à son horaire.
              if (!o.halted) continue;
              for (let k = 0; k < o.members.length && !stop; k++)
                if (memberPose(o, k, o.age, tmpB) && ahead(tmpB.x, tmpB.z)) stop = true;
              if (stop) break;
            }
          if (stop) {
            t.halted = true;
            t.blocked += dt;
            continue;
          }
          if (t.blocked > 0) t.blocked = Math.max(0, t.blocked - dt);
        }
        t.age += dt;
      }
      for (const t of trips) resolveApproach(t, clientele);
      for (let i = trips.length - 1; i >= 0; i--)
        if ((trips[i]?.age ?? 0) >= (trips[i]?.end ?? 0)) trips.splice(i, 1);
      const now = Math.floor(input.timeline);
      if (now > lastSlot + 600) lastSlot = now - 1;
      for (let s = lastSlot + 1; s <= now; s++) spawnSlot(input, s, input.timeline - s);
      lastSlot = Math.max(lastSlot, now);
      if (clientele !== null) {
        approaches(input, clientele);
        departures(input, clientele);
      }
    },
    trips: () => trips,
    pose: (trip, k, out) => memberPose(trip, k, trip.age, out),
    dispose() {
      trips.length = 0;
      spawned.clear();
      leaving.clear();
    },
  };
}
