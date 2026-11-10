/**
 * Du plan vu du dessus à la carte du lieu (ADR 0022, règle « le plan avant le volume »):
 *   node outils/plan-vers-lieu.ts <plan.json> <carte.json> [--lieu <id>] [--annexe <m>]
 * Le plan du level designer (`docs/jeux/jeu-1/refonte/carte-aubrune/plan.json`) est la source;
 * la carte produite (grille, collisions, terrain, zones, verrous, graphe, repères, points
 * d'intérêt, bâtiments) ne se retouche jamais à la main: on corrige le plan et on relance.
 * Lancé par Node tel quel (types effacés): aucun import d'un autre fichier TypeScript.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as v from 'valibot';

// ---- Le plan (format `plan-de-lieu`, version 1, écrit par `construire_plan.py`) ----

const Num = v.pipe(v.number(), v.finite());
const Pt = v.tuple([Num, Num]);
const Name = v.nullable(v.string());

const PlanSchema = v.looseObject({
  format: v.literal('plan-de-lieu'),
  version: v.literal(1),
  id: v.string(),
  taille: v.looseObject({
    largeur: v.pipe(v.number(), v.integer()),
    hauteur: v.pipe(v.number(), v.integer()),
  }),
  zones: v.record(
    v.string(),
    v.looseObject({ nom: v.string(), acte: v.number(), poly: v.array(Pt) }),
  ),
  eaux: v.array(v.looseObject({ id: v.string(), largeur: Num, pts: v.array(Pt) })),
  plans_eau: v.array(v.looseObject({ id: v.string(), cx: Num, cy: Num, rx: Num, ry: Num })),
  rails: v.array(v.looseObject({ id: v.string(), pts: v.array(Pt) })),
  noeuds: v.record(v.string(), v.looseObject({ x: Num, y: Num, zone: v.string() })),
  aretes: v.array(
    v.looseObject({ a: v.string(), b: v.string(), classe: v.string(), nom: Name, verrou: Name }),
  ),
  verrous: v.record(
    v.string(),
    v.looseObject({ acte: v.number(), x: Num, y: Num, obstacle: v.string(), leve: v.string() }),
  ),
  ouvrages: v.array(v.looseObject({ id: v.string(), nature: v.string(), x: Num, y: Num, r: Num })),
  batiments: v.array(
    v.looseObject({
      id: v.string(),
      nom: v.string(),
      rect: v.tuple([Num, Num, Num, Num]),
      porte: v.nullable(Pt),
      noeud: v.string(),
      interieur: Name,
    }),
  ),
  reperes: v.array(v.looseObject({ id: v.string(), nom: v.string(), x: Num, y: Num, h: Num })),
  points_interet: v.array(
    v.looseObject({
      id: v.string(),
      nom: v.string(),
      type: v.string(),
      noeud: v.string(),
      x: Num,
      y: Num,
    }),
  ),
  parcelles: v.array(v.looseObject({ nom: v.string(), rect: v.tuple([Num, Num, Num, Num]) })),
});
export type Plan = v.InferOutput<typeof PlanSchema>;

// ---- Réglages de l'outil (dessin du blockout, pas du gameplay) ----

/** Largeur au sol de chaque classe de chemin du plan (m). */
const PATH_WIDTH: Readonly<Record<string, number>> = {
  route: 5,
  rue: 4,
  chemin: 3,
  sentier: 2,
  voie: 3,
  interieur: 3,
};
/** Demi-largeur du ballast autour d'un rail (m). */
const RAIL_HALF_WIDTH = 1.5;
/** Ouvrages qu'on ne franchit pas à pied. */
const NOT_CROSSABLE = new Set(['déversoir']);
/** Hauteur de l'annexe où se posent les intérieurs, sous le dehors (m): 208 + 48 = 8 tuiles de 32 m. */
const DEFAULT_ANNEX = 48;

/** Terrain d'affichage: l'ordre fixe les codes. */
const LEGEND = [
  'hors-jeu',
  'herbe',
  'champ',
  'route',
  'rue',
  'chemin',
  'sentier',
  'voie',
  'ouvrage',
  'eau',
  'batiment',
  'quai',
  'lisiere',
  'annexe',
] as const;
type Ground = (typeof LEGEND)[number];
const CODE = Object.fromEntries(LEGEND.map((name, i) => [name, i])) as Record<Ground, number>;
/** Ce qui bloque la marche. Un verrou fermé bloque en plus (son rectangle, dans `locks`). */
const SOLID = new Set<number>([CODE['hors-jeu'], CODE.eau, CODE.batiment, CODE.lisiere]);

// ---- Géométrie ----

function distToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function insidePolygon(
  px: number,
  py: number,
  poly: readonly (readonly [number, number])[],
): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a === undefined || b === undefined) continue;
    if (a[1] > py !== b[1] > py && px < ((b[0] - a[0]) * (py - a[1])) / (b[1] - a[1]) + a[0])
      inside = !inside;
  }
  return inside;
}

/** Identifiant du jeu: minuscules sans accent, `_` devient `-` (`quai_o` donne `quai-o`). */
export function gameId(id: string): string {
  const out = id
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!/^[a-z][a-z0-9-]{0,39}$/.test(out)) throw new Error(`identifiant impossible: « ${id} »`);
  return out;
}

class Grid {
  readonly width: number;
  readonly height: number;
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }
  /** Appelle `fn` pour chaque case dont le centre est à `radius` au plus du segment. */
  stampSegment(
    a: readonly [number, number],
    b: readonly [number, number],
    radius: number,
    fn: (i: number) => void,
  ): void {
    const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0]) - radius));
    const x1 = Math.min(this.width - 1, Math.ceil(Math.max(a[0], b[0]) + radius));
    const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1]) - radius));
    const y1 = Math.min(this.height - 1, Math.ceil(Math.max(a[1], b[1]) + radius));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++)
        if (distToSegment(x + 0.5, y + 0.5, a[0], a[1], b[0], b[1]) <= radius)
          fn(y * this.width + x);
  }
  stampPolyline(
    pts: readonly (readonly [number, number])[],
    radius: number,
    fn: (i: number) => void,
  ): void {
    for (let k = 1; k < pts.length; k++) {
      const a = pts[k - 1];
      const b = pts[k];
      if (a !== undefined && b !== undefined) this.stampSegment(a, b, radius, fn);
    }
  }
  /** Cases dont le centre est dans le rectangle [x, x + w[ x [y, y + h[. */
  stampRect(x: number, y: number, w: number, h: number, fn: (i: number) => void): void {
    for (let cy = Math.max(0, Math.ceil(y - 0.5)); cy < Math.min(this.height, y + h - 0.5); cy++)
      for (let cx = Math.max(0, Math.ceil(x - 0.5)); cx < Math.min(this.width, x + w - 0.5); cx++)
        fn(cy * this.width + cx);
  }
}

/** Rectangles pleins qui couvrent exactement les cases vraies (plages par ligne, fusionnées d'une ligne à l'autre). */
export function rectsOf(
  solid: (i: number) => boolean,
  width: number,
  height: number,
): { x: number; y: number; w: number; h: number }[] {
  const done: { x: number; y: number; w: number; h: number }[] = [];
  let open = new Map<string, { x: number; y: number; w: number; h: number }>();
  for (let y = 0; y < height; y++) {
    const next = new Map<string, { x: number; y: number; w: number; h: number }>();
    let x = 0;
    while (x < width) {
      if (!solid(y * width + x)) {
        x++;
        continue;
      }
      let w = 1;
      while (x + w < width && solid(y * width + x + w)) w++;
      const key = `${String(x)},${String(w)}`;
      const rect = open.get(key);
      if (rect !== undefined) {
        rect.h++;
        open.delete(key);
        next.set(key, rect);
      } else next.set(key, { x, y, w, h: 1 });
      x += w;
    }
    for (const rect of open.values()) done.push(rect);
    open = next;
  }
  for (const rect of open.values()) done.push(rect);
  return done.sort((a, b) => a.y - b.y || a.x - b.x);
}

// ---- La conversion ----

export interface Options {
  /** Identifiant du lieu dans le jeu (préfixe des faits qui ouvrent les verrous). */
  readonly place: string;
  /** Hauteur de l'annexe des intérieurs, sous le dehors (m). */
  readonly annex: number;
}

export interface Report {
  readonly cells: number;
  readonly tiles: number;
  readonly blockedRects: number;
  readonly terrainRuns: number;
  /** Cases des zones d'un acte suivant atteintes depuis le quai, verrous fermés: une fuite à reboucher dans le plan. */
  readonly leaks: Record<string, number>;
  /** Nœuds hors d'atteinte depuis le quai, verrous ouverts (chemin coupé par l'eau, un bâtiment, une lisière). */
  readonly unreachableNodes: string[];
  /** Nœuds posés sur une case pleine. */
  readonly blockedNodes: string[];
  /** Nœuds du premier acte hors d'atteinte depuis le quai, verrous fermés: le début du jeu serait coupé. */
  readonly firstActCut: string[];
}

export function planToMap(
  input: unknown,
  options: Options,
): { map: Record<string, unknown>; report: Report } {
  const plan = v.parse(PlanSchema, input);
  const W = plan.taille.largeur;
  const H = plan.taille.hauteur;
  const height = H + options.annex;
  const grid = new Grid(W, height);
  const n = W * height;

  // Zones et actes, case par case (la première zone qui contient le centre l'emporte).
  const zoneIds = Object.keys(plan.zones);
  const actOf = new Int8Array(n); // 0: hors des zones
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      for (const id of zoneIds) {
        const zone = plan.zones[id];
        if (zone !== undefined && insidePolygon(x + 0.5, y + 0.5, zone.poly)) {
          actOf[y * W + x] = zone.acte;
          break;
        }
      }

  const water = new Uint8Array(n);
  for (const w of plan.eaux) grid.stampPolyline(w.pts, w.largeur / 2, (i) => (water[i] = 1));
  for (const pond of plan.plans_eau)
    grid.stampRect(pond.cx - pond.rx, pond.cy - pond.ry, 2 * pond.rx, 2 * pond.ry, (i) => {
      const dx = ((i % W) + 0.5 - pond.cx) / pond.rx;
      const dy = (Math.floor(i / W) + 0.5 - pond.cy) / pond.ry;
      if (dx * dx + dy * dy <= 1) water[i] = 1;
    });
  const crossing = new Uint8Array(n);
  for (const o of plan.ouvrages)
    if (!NOT_CROSSABLE.has(o.nature))
      grid.stampSegment([o.x, o.y], [o.x, o.y], o.r, (i) => (crossing[i] = 1));
  const rail = new Uint8Array(n);
  for (const r of plan.rails) grid.stampPolyline(r.pts, RAIL_HALF_WIDTH, (i) => (rail[i] = 1));
  // Chemin: code de terrain de la classe la plus large qui passe sur la case.
  const path = new Uint8Array(n);
  const pathWidth = new Float32Array(n);
  const nodeAt = (id: string): readonly [number, number] => {
    const node = plan.noeuds[id];
    if (node === undefined) throw new Error(`arête vers un nœud inconnu: ${id}`);
    return [node.x, node.y];
  };
  for (const e of plan.aretes) {
    const width = PATH_WIDTH[e.classe] ?? 2;
    // Classe inconnue du terrain (et le tunnel, classé « intérieur » par le plan): dessinée en chemin ou en voie.
    const known = LEGEND.find((name) => name === e.classe);
    const code =
      e.classe === 'interieur' ? CODE.voie : known === undefined ? CODE.chemin : CODE[known];
    grid.stampSegment(nodeAt(e.a), nodeAt(e.b), width / 2, (i) => {
      if (width > (pathWidth[i] ?? 0)) {
        pathWidth[i] = width;
        path[i] = code;
      }
    });
  }
  // Un chemin entre deux nœuds du même acte appartient à cet acte, même s'il mord sur une zone
  // voisine (le ponton avance sur la rivière): ses bords seront une lisière, pas une fuite.
  const actOfNode = (id: string): number => plan.zones[plan.noeuds[id]?.zone ?? '']?.acte ?? 0;
  for (const e of plan.aretes) {
    const act = actOfNode(e.a);
    if (act === 0 || act !== actOfNode(e.b)) continue;
    grid.stampSegment(nodeAt(e.a), nodeAt(e.b), (PATH_WIDTH[e.classe] ?? 2) / 2, (i) => {
      if (Math.floor(i / W) < H) actOf[i] = act;
    });
  }
  const building = new Uint8Array(n); // 1: plein, 2: plateforme
  for (const b of plan.batiments) {
    const [bx, by, bw, bh] = b.rect;
    grid.stampRect(bx, by, bw, bh, (i) => (building[i] = b.porte === null ? 2 : 1));
  }
  const field = new Uint8Array(n);
  for (const p of plan.parcelles) {
    const [px, py, pw, ph] = p.rect;
    grid.stampRect(px, py, pw, ph, (i) => (field[i] = 1));
  }

  const ground = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const y = Math.floor(i / W);
    const act = actOf[i] ?? 0;
    let g: number;
    if (y >= H) g = CODE.annexe;
    else if (act === 0) g = CODE['hors-jeu'];
    else if (building[i] === 1) g = CODE.batiment;
    else if (path[i] !== 0)
      g = water[i] === 1 ? (crossing[i] === 1 ? CODE.ouvrage : CODE.eau) : (path[i] ?? 0);
    else if (water[i] === 1) g = CODE.eau;
    else if (rail[i] === 1) g = CODE.voie;
    else if (building[i] === 2) g = CODE.quai;
    else if (field[i] === 1) g = CODE.champ;
    else g = CODE.herbe;
    ground[i] = g;
  }
  // Verrous: un carré qui couvre largement le chemin verrouillé, posé là où ce chemin passe d'un
  // acte à l'autre (sinon on contournerait l'obstacle par l'herbe de la zone fermée); à défaut,
  // à la place du verrou dans le plan.
  const locks: Record<string, unknown> = {};
  const lockRects: { x: number; y: number; w: number; h: number }[] = [];
  const actAt = (x: number, y: number): number =>
    x < 0 || y < 0 || x >= W || y >= H ? 0 : (actOf[Math.floor(y) * W + Math.floor(x)] ?? 0);
  for (const [id, lock] of Object.entries(plan.verrous)) {
    const edges = plan.aretes.filter((e) => e.verrou === id);
    const side = Math.max(5, ...edges.map((e) => (PATH_WIDTH[e.classe] ?? 2) + 4));
    // Chaque passage d'un acte à l'autre le long des arêtes verrouillées reçoit son carré
    // (le portail et le portillon du moulin; la berge qui longe la limite de zone).
    const centers: (readonly [number, number])[] = [];
    for (const e of edges) {
      const [ax, ay] = nodeAt(e.a);
      const [bx, by] = nodeAt(e.b);
      const steps = Math.ceil(Math.hypot(bx - ax, by - ay) * 4);
      for (let k = 1; k <= steps; k++) {
        const t0 = (k - 1) / steps;
        const t1 = k / steps;
        const before = actAt(ax + (bx - ax) * t0, ay + (by - ay) * t0);
        const after = actAt(ax + (bx - ax) * t1, ay + (by - ay) * t1);
        // Le carré commence à la limite et s'étend du côté fermé: le pied de l'obstacle reste accessible.
        const len = Math.hypot(bx - ax, by - ay);
        const sign = after > before ? 1 : -1;
        const p = [
          ax + (bx - ax) * t1 + (((bx - ax) / len) * sign * side) / 2,
          ay + (by - ay) * t1 + (((by - ay) / len) * sign * side) / 2,
        ] as const;
        if (
          before > 0 &&
          after > 0 &&
          before !== after &&
          centers.every((c) => Math.hypot(c[0] - p[0], c[1] - p[1]) > side / 2)
        )
          centers.push(p);
      }
    }
    if (centers.length === 0) centers.push([lock.x, lock.y]);
    const rects = centers.map((c) => ({
      x: Math.round(c[0] - side / 2),
      y: Math.round(c[1] - side / 2),
      w: side,
      h: side,
    }));
    lockRects.push(...rects);
    locks[gameId(id)] = {
      rects,
      object: null,
      opens: [{ type: 'remembered', key: `${options.place}.verrou.${gameId(id)}`, equals: true }],
      note: `${lock.obstacle}. Levé: ${lock.leve}`.slice(0, 400),
    };
  }

  const inLock = new Uint8Array(n);
  for (const r of lockRects) grid.stampRect(r.x, r.y, r.w, r.h, (i) => (inLock[i] = 1));
  // Lisière: une case pleine du côté de la zone d'acte suivant, partout où deux actes se touchent,
  // chemins compris, sauf dans les verrous: on n'entre dans une zone fermée que par un verrou.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const act = actOf[i] ?? 0;
      if (act <= 1 || inLock[i] === 1 || SOLID.has(ground[i] ?? 0)) continue;
      const lower = [i - 1, i + 1, i - W, i + W].some((j, k) => {
        if ((k === 0 && x === 0) || (k === 1 && x === W - 1) || j < 0 || j >= W * H) return false;
        const other = actOf[j] ?? 0;
        return other > 0 && other < act;
      });
      if (lower) ground[i] = CODE.lisiere;
    }

  const solidAt = (i: number): boolean => SOLID.has(ground[i] ?? 0);
  const blocked = rectsOf(solidAt, W, height);
  // Mur entre le dehors et l'annexe des intérieurs.
  if (options.annex > 0) blocked.push({ x: 0, y: H, w: W, h: 1 });

  // Contrôles par remplissage depuis le quai: fuites (verrous fermés) et nœuds coupés (verrous ouverts).
  const cellOf = (x: number, y: number): number => Math.floor(y) * W + Math.floor(x);
  const flood = (start: number, closed: boolean): Uint8Array => {
    const seen = new Uint8Array(n);
    const queue = [start];
    seen[start] = 1;
    while (queue.length > 0) {
      const i = queue.pop() ?? 0;
      const x = i % W;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
        if (j < 0 || j >= W * H || seen[j] === 1 || solidAt(j) || (closed && inLock[j] === 1))
          continue;
        seen[j] = 1;
        queue.push(j);
      }
    }
    return seen;
  };
  const start = plan.noeuds.quai ?? Object.values(plan.noeuds)[0];
  if (start === undefined) throw new Error('plan sans nœud');
  const closed = flood(cellOf(start.x, start.y), true);
  const open = flood(cellOf(start.x, start.y), false);
  const leaks: Record<string, number> = {};
  for (let i = 0; i < W * H; i++) {
    if (closed[i] !== 1 || (actOf[i] ?? 0) <= 1) continue;
    const id = zoneIds.find((z) => {
      const zone = plan.zones[z];
      return zone !== undefined && insidePolygon((i % W) + 0.5, Math.floor(i / W) + 0.5, zone.poly);
    });
    if (id !== undefined) leaks[id] = (leaks[id] ?? 0) + 1;
  }
  const unreachableNodes: string[] = [];
  const blockedNodes: string[] = [];
  const firstActCut: string[] = [];
  for (const [id, node] of Object.entries(plan.noeuds)) {
    const i = cellOf(node.x, node.y);
    if (solidAt(i)) blockedNodes.push(id);
    else if (open[i] !== 1) unreachableNodes.push(id);
    else if (actOfNode(id) === 1 && closed[i] !== 1) firstActCut.push(id);
  }

  const runs = encode(ground);
  const nodes = Object.fromEntries(
    Object.entries(plan.noeuds).map(([id, p]) => [gameId(id), { x: p.x, y: p.y }]),
  );
  const map = {
    schema: 1,
    width: W,
    height,
    outdoor: { x: 0, y: 0, w: W, h: H },
    blocked,
    // Les nœuds du plan servent aussi de points nommés (postes des habitants, cibles de quête).
    points: Object.fromEntries(
      Object.entries(nodes).filter(([id]) => !blockedNodes.map(gameId).includes(id)),
    ),
    objects: [],
    terrain: { legend: [...LEGEND], runs },
    zones: Object.fromEntries(
      Object.entries(plan.zones).map(([id, z]) => [
        gameId(id),
        { name: z.nom, act: z.acte, polygon: z.poly },
      ]),
    ),
    locks,
    graph: {
      nodes,
      edges: plan.aretes.map((e) => ({
        a: gameId(e.a),
        b: gameId(e.b),
        kind: e.classe,
        lock: e.verrou === null ? null : gameId(e.verrou),
      })),
    },
    landmarks: Object.fromEntries(
      plan.reperes.map((r) => [gameId(r.id), { name: r.nom, x: r.x, y: r.y, height: r.h }]),
    ),
    interests: Object.fromEntries(
      plan.points_interet.map((p) => [
        gameId(p.id),
        { name: p.nom, kind: gameId(p.type), node: gameId(p.noeud), x: p.x, y: p.y },
      ]),
    ),
    buildings: Object.fromEntries(
      plan.batiments.map((b) => [
        gameId(b.id),
        {
          name: b.nom,
          rect: { x: b.rect[0], y: b.rect[1], w: b.rect[2], h: b.rect[3] },
          door: b.porte === null ? null : { x: b.porte[0], y: b.porte[1] },
          interior: b.interieur === null ? null : gameId(b.id),
        },
      ]),
    ),
  };
  return {
    map,
    report: {
      cells: n,
      tiles: Math.ceil(W / 32) * Math.ceil(height / 32),
      blockedRects: blocked.length,
      terrainRuns: runs.length / 2,
      leaks,
      unreachableNodes,
      blockedNodes,
      firstActCut,
    },
  };
}

function encode(codes: Uint8Array): number[] {
  const runs: number[] = [];
  let i = 0;
  while (i < codes.length) {
    const code = codes[i] ?? 0;
    let k = 1;
    while (i + k < codes.length && codes[i + k] === code) k++;
    runs.push(code, k);
    i += k;
  }
  return runs;
}

function main(args: readonly string[]): void {
  const [from, to] = args.filter(
    (a, i) => !a.startsWith('--') && !(args[i - 1] ?? '').startsWith('--'),
  );
  if (from === undefined || to === undefined) {
    process.stderr.write(
      'usage: node outils/plan-vers-lieu.ts <plan.json> <carte.json> [--lieu <id>] [--annexe <m>]\n',
    );
    process.exitCode = 1;
    return;
  }
  const flag = (name: string): string | undefined => {
    const i = args.indexOf(name);
    return i < 0 ? undefined : args[i + 1];
  };
  const started = performance.now();
  const input = JSON.parse(readFileSync(from, 'utf8')) as unknown;
  const place = flag('--lieu') ?? gameId(v.parse(v.looseObject({ id: v.string() }), input).id);
  const { map, report } = planToMap(input, {
    place,
    annex: Number(flag('--annexe') ?? DEFAULT_ANNEX),
  });
  const text = `${JSON.stringify(map)}\n`;
  writeFileSync(to, text);
  const ms = performance.now() - started;
  process.stdout.write(
    `${to}: ${String(Buffer.byteLength(text))} octets en ${ms.toFixed(0)} ms\n${JSON.stringify(report, null, 1)}\n`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
