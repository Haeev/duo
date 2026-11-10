/**
 * Le sol en relief d'une tuile (rendu encré): le maillage suit `Relief`. Sol souple en nappe à
 * normales lissées, serrée seulement là où le relief change (talus, berge, fossé); sol rigide en
 * un carré par case; marches entre les deux; dalles et pierres de bordure en petits volumes, tous
 * morceaux d'une même pièce (trait fin aux joints, trait fort au bord du dallage). Construit par
 * étapes (`yield`): le moteur étale le travail sur plusieurs images.
 */
import { type BufferGeometry, Color } from 'three';
import { inkCode, KIND, LAYER } from '../encre/couches';
import { GeometryBuilder } from './geometrie';
import { type Relief, SIDES, type SideIndex, sidePoint, type Slab } from './relief';

/** Pièce du dallage, la même dans toutes les tuiles (grande: son bord prend le trait fort). */
const PAVING_PIECE = inkCode(0, 99);
/** Taille nominale d'une dalle pour son trait (m): joints au trait fin, hachures gardées à l'ombre. */
const SLAB_DIAGONAL = 1.2;
/** Rangées de cases, puis pierres, construites entre deux pauses. */
const ROWS_PER_STEP = 2;
const STONES_PER_STEP = 250;

interface Rect {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

const white = new Color('#ffffff');
const tint = new Color();
const side = new Color();

/** Normale du sol souple en (x, y), par différences centrées à `e` m. */
function normalAt(
  relief: Relief,
  cx: number,
  cy: number,
  x: number,
  y: number,
  e: number,
): number[] {
  const dx = relief.softSample(cx, cy, x + e, y) - relief.softSample(cx, cy, x - e, y);
  const dz = relief.softSample(cx, cy, x, y + e) - relief.softSample(cx, cy, x, y - e);
  const nx = -dx / (2 * e);
  const nz = -dz / (2 * e);
  const k = 1 / Math.hypot(nx, 1, nz);
  return [nx * k, k, nz * k];
}

/** Case souple serrée: grille de `n` x `n`, hauteurs relevées une fois (bord d'un cran compris). */
function fineCell(
  builder: GeometryBuilder,
  relief: Relief,
  cx: number,
  cy: number,
  n: number,
): void {
  const w = n + 3;
  const heights = new Float64Array(w * w);
  for (let j = 0; j < w; j++)
    for (let i = 0; i < w; i++)
      heights[j * w + i] = relief.softSample(cx, cy, cx + (i - 1) / n, cy + (j - 1) / n);
  const h = (i: number, j: number): number => heights[(j + 1) * w + i + 1] ?? 0;
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  for (let j = 0; j <= n; j++)
    for (let i = 0; i <= n; i++) {
      positions.push(cx + i / n, h(i, j), cy + j / n);
      const nx = (-(h(i + 1, j) - h(i - 1, j)) * n) / 2;
      const nz = (-(h(i, j + 1) - h(i, j - 1)) * n) / 2;
      const k = 1 / Math.hypot(nx, 1, nz);
      normals.push(nx * k, k, nz * k);
    }
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const a = j * (n + 1) + i;
      const b = a + n + 1;
      indices.push(a, b, b + 1, a, b + 1, a + 1);
    }
  builder.sheet(positions, normals, indices, white);
}

/** Case souple lâche: un carré, ou un éventail si un de ses côtés touche une case serrée. */
function coarseCell(
  builder: GeometryBuilder,
  relief: Relief,
  cx: number,
  cy: number,
  e: number,
): void {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const put = (x: number, y: number): void => {
    positions.push(x, relief.softSample(cx, cy, x, y), y);
    normals.push(...normalAt(relief, cx, cy, x, y, e));
  };
  // Le tour, dans le sens trigonométrique vu du dessus: ouest vers le sud, sud vers l'est, est
  // vers le nord, nord vers l'ouest.
  const turn: readonly [SideIndex, boolean][] = [
    [2, false],
    [1, false],
    [3, true],
    [0, true],
  ];
  let ring = 0;
  for (const [s, reversed] of turn) {
    const count = relief.edgeResolution(cx, cy, s);
    for (let k = 0; k < count; k++) {
      const [x, y] = sidePoint(cx, cy, s, reversed ? 1 - k / count : k / count);
      put(x, y);
      ring++;
    }
  }
  if (ring === 4) {
    indices.push(0, 1, 2, 0, 2, 3);
  } else {
    put(cx + 0.5, cy + 0.5);
    for (let k = 0; k < ring; k++) indices.push(ring, k, (k + 1) % ring);
  }
  builder.sheet(positions, normals, indices, white);
}

/** Marches d'une case rigide vers ses voisines plus basses ou souples. */
function risers(builder: GeometryBuilder, relief: Relief, cx: number, cy: number): void {
  const mesh = relief.settings.mesh;
  for (const s of [0, 1, 2, 3] as const) {
    const riser = relief.riser(cx, cy, s);
    if (riser === null) continue;
    const mean = riser.far.reduce((sum, value) => sum + value, 0) / riser.far.length;
    const high = riser.near > mean;
    // La face regarde le côté le plus bas: dehors si la case rigide domine, dedans sinon.
    const out = high ? 1 : -1;
    const nx = SIDES[s].dx * out;
    const nz = SIDES[s].dy * out;
    // Sens de parcours qui met la face du bon côté: le long de (nz, -nx).
    const forward = s < 2 ? nz > 0 : nx < 0;
    builder.setInk(high ? LAYER.face : LAYER.dirt);
    tint.set(high ? mesh.stoneSide : mesh.soilSide);
    for (let k = 0; k < riser.count; k++) {
      const ka = forward ? k : riser.count - k;
      const kb = forward ? k + 1 : riser.count - k - 1;
      const [ax, az] = sidePoint(cx, cy, s, ka / riser.count);
      const [bx, bz] = sidePoint(cx, cy, s, kb / riser.count);
      const fa = riser.far[ka] ?? riser.near;
      const fb = riser.far[kb] ?? riser.near;
      builder.quad(
        [
          [ax, Math.max(riser.near, fa), az],
          [ax, Math.min(riser.near, fa), az],
          [bx, Math.min(riser.near, fb), bz],
          [bx, Math.max(riser.near, fb), bz],
        ],
        [nx, 0, nz],
        [tint],
      );
    }
  }
}

/** Une dalle ou une pierre: dessus (inégal) et quatre flancs en léger fruit, un seul morceau. */
function stone(
  builder: GeometryBuilder,
  item: Slab,
  color: Color,
  chamfer: number,
  sideShade: number,
): void {
  const { x0, z0, x1, z1, bottom } = item;
  const [nw, sw, se, ne] = item.tops;
  const c = Math.min(chamfer, (x1 - x0) / 4, (z1 - z0) / 4);
  builder.part(SLAB_DIAGONAL);
  tint.copy(color).multiplyScalar(item.tone);
  side.copy(tint).multiplyScalar(sideShade);
  // Normale du dessus d'après ses coins: une dalle penchée prend un autre ton que sa voisine.
  const ax = 0;
  const ay = sw - nw;
  const az = z1 - z0;
  const bx = x1 - x0;
  const by = ne - nw;
  const bz = 0;
  const tx = ay * bz - az * by;
  const ty = az * bx - ax * bz;
  const tz = ax * by - ay * bx;
  const tk = 1 / Math.hypot(tx, ty, tz);
  builder.quad(
    [
      [x0 + c, nw, z0 + c],
      [x0 + c, sw, z1 - c],
      [x1 - c, se, z1 - c],
      [x1 - c, ne, z0 + c],
    ],
    [tx * tk, ty * tk, tz * tk],
    [tint],
  );
  const rise = Math.max(0.001, (nw + sw + se + ne) / 4 - bottom);
  const k = 1 / Math.hypot(rise, c);
  const flat = rise * k;
  const up = c * k;
  const sides = [side];
  builder.quad(
    [
      [x0 + c, sw, z1 - c],
      [x0, bottom, z1],
      [x1, bottom, z1],
      [x1 - c, se, z1 - c],
    ],
    [0, up, flat],
    sides,
  );
  builder.quad(
    [
      [x1 - c, ne, z0 + c],
      [x1, bottom, z0],
      [x0, bottom, z0],
      [x0 + c, nw, z0 + c],
    ],
    [0, up, -flat],
    sides,
  );
  builder.quad(
    [
      [x1 - c, se, z1 - c],
      [x1, bottom, z1],
      [x1, bottom, z0],
      [x1 - c, ne, z0 + c],
    ],
    [flat, up, 0],
    sides,
  );
  builder.quad(
    [
      [x0 + c, nw, z0 + c],
      [x0, bottom, z0],
      [x0, bottom, z1],
      [x0 + c, sw, z1 - c],
    ],
    [-flat, up, 0],
    sides,
  );
}

/** Dallage d'une tuile: fond des joints, dalles, bordures; une pièce, un morceau par pierre. */
function* paving(builder: GeometryBuilder, relief: Relief, rect: Rect): Generator<void, void> {
  const mesh = relief.settings.mesh;
  const color = new Color();
  builder.piece(PAVING_PIECE);
  builder.part(null);
  builder.setInk(LAYER.plain);
  for (let cy = rect.y0; cy < rect.y1; cy++)
    for (let cx = rect.x0; cx < rect.x1; cx++) {
      const profile = relief.profileAt(cx, cy);
      const look = relief.lookAt(cx, cy);
      if (profile?.paving === undefined || look === null) continue;
      const y = profile.level - profile.paving.depth;
      tint.set(look.color).multiplyScalar(mesh.jointShade);
      builder.quad(
        [
          [cx, y, cy],
          [cx, y, cy + 1],
          [cx + 1, y, cy + 1],
          [cx + 1, y, cy],
        ],
        [0, 1, 0],
        [tint],
      );
    }
  builder.setInk(LAYER.face);
  const cellOf = (item: Slab): [number, number] => [
    Math.floor(Math.max(rect.x0, (item.x0 + item.x1) / 2)),
    Math.floor((item.z0 + item.z1) / 2),
  ];
  yield;
  let laid = 0;
  for (const slab of relief.slabs(rect)) {
    const [cx, cy] = cellOf(slab);
    const profile = relief.profileAt(cx, cy);
    color.set(relief.lookAt(cx, cy)?.color ?? '#ffffff');
    stone(builder, slab, color, profile?.paving?.chamfer ?? 0, mesh.sideShade);
    if (++laid % STONES_PER_STEP === 0) yield;
  }
  yield;
  for (const kerb of relief.kerbStones(rect)) {
    const [cx, cy] = cellOf(kerb);
    const own = relief.profileAt(cx, cy)?.kerb;
    if (own?.color !== undefined) color.set(own.color);
    else color.set(relief.lookAt(cx, cy)?.color ?? '#ffffff').multiplyScalar(1.08);
    stone(builder, kerb, color, 0.012, mesh.sideShade);
    if (++laid % STONES_PER_STEP === 0) yield;
  }
  builder.part(null);
  builder.piece(0);
}

/**
 * Géométrie du sol en relief des cases de `rect` (une tuile), `null` si rien n'est à dessiner.
 * L'appelant la suit et la libère.
 */
export function* reliefGround(relief: Relief, rect: Rect): Generator<void, BufferGeometry | null> {
  const builder = new GeometryBuilder();
  const fine = relief.settings.mesh.fine;
  const e = 1 / fine;
  for (let cy = rect.y0; cy < rect.y1; cy++) {
    for (let cx = rect.x0; cx < rect.x1; cx++) {
      const profile = relief.profileAt(cx, cy);
      if (profile === null || relief.lookAt(cx, cy)?.hidden === true) continue;
      if (profile.edge === 'souple') {
        // Teinte et matière lues dans la carte du sol du lieu (rendu encré).
        builder.setInk(LAYER.grass, KIND.ground);
        if (relief.resolution(cx, cy) > 1) fineCell(builder, relief, cx, cy, fine);
        else coarseCell(builder, relief, cx, cy, e);
        continue;
      }
      if (profile.paving === undefined) {
        builder.setInk(LAYER.grass, KIND.ground);
        const y = profile.level;
        builder.quad(
          [
            [cx, y, cy],
            [cx, y, cy + 1],
            [cx + 1, y, cy + 1],
            [cx + 1, y, cy],
          ],
          [0, 1, 0],
          [white],
        );
      }
      risers(builder, relief, cx, cy);
    }
    if ((cy - rect.y0) % ROWS_PER_STEP === ROWS_PER_STEP - 1) yield;
  }
  yield* paving(builder, relief, rect);
  return builder.build();
}
