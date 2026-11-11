/**
 * Le sol en relief d'une tuile (rendu encré): le maillage suit `Relief`. Sol souple en nappe à
 * normales lissées, serrée seulement là où le relief change (talus, berge, fossé); sol rigide en
 * un carré par case; marches entre les deux; dalles et pierres de bordure en petits volumes, tous
 * morceaux d'une même pièce (trait fin aux joints, trait fort au bord du dallage). Construit par
 * étapes (`yield`): le moteur étale le travail sur plusieurs images.
 */
import { type BufferGeometry, Color } from 'three';
import { inkCode, KEEP_INK, KIND, LAYER } from '../encre/couches';
import { GeometryBuilder } from './geometrie';
import { type Relief, SIDES, type SideIndex, sidePoint, type Slab } from './relief';
import { hash01 } from './terrain-rendu';

/** Pièce du dallage, la même dans toutes les tuiles (grande: son bord prend le trait fort). */
const PAVING_PIECE = inkCode(0, 99);
/** Taille nominale d'une pierre de bordure pour son trait (m): joints au trait fin. */
const KERB_DIAGONAL = 1.2;
/**
 * Cases de sol (une case serrée compte pour autant de cases que ses sous-cases), puis pierres,
 * construites entre deux pauses: la construction s'étale sur plus d'images.
 */
const CELLS_PER_STEP = 48;
const STONES_PER_STEP = 120;

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
  // Case de berge: chaque sommet porte sa distance à l'eau (la terre paraît près d'elle).
  const shores: number[] | undefined = relief.besideWater(cx, cy) ? [] : undefined;
  for (let j = 0; j <= n; j++)
    for (let i = 0; i <= n; i++) {
      positions.push(cx + i / n, h(i, j), cy + j / n);
      shores?.push(relief.waterDistance(cx + i / n, cy + j / n));
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
  builder.sheet(positions, normals, indices, white, shores);
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

/**
 * Case à sillons sans autre relief: des bandes en travers des crêtes (`n` par case), un seul pas
 * le long. Les deux bandes du bord reprennent la subdivision de la case voisine (aucune fente).
 */
function ridgedCell(
  builder: GeometryBuilder,
  relief: Relief,
  cx: number,
  cy: number,
  axis: 'x' | 'y',
  n: number,
  e: number,
): void {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  // (u, v): u en travers des crêtes, v le long.
  const put = (u: number, v: number): number => {
    const x = axis === 'y' ? cx + u : cx + v;
    const y = axis === 'y' ? cy + v : cy + u;
    positions.push(x, relief.softSample(cx, cy, x, y), y);
    normals.push(...normalAt(relief, cx, cy, x, y, e));
    return positions.length / 3 - 1;
  };
  // Côtés en u = 0 et u = 1: ouest et est si les crêtes suivent y, nord et sud sinon.
  const low = relief.edgeResolution(cx, cy, axis === 'y' ? 2 : 0);
  const high = relief.edgeResolution(cx, cy, axis === 'y' ? 3 : 1);
  for (let k = 0; k < n; k++) {
    const u0 = k / n;
    const u1 = (k + 1) / n;
    // Le tour de la bande, dans le sens (u0, 0), (u0, 1), (u1, 1), (u1, 0).
    const ring: number[] = [put(u0, 0)];
    const left = k === 0 ? low : 1;
    for (let j = 1; j < left; j++) ring.push(put(u0, j / left));
    ring.push(put(u0, 1));
    const corner = ring.length;
    ring.push(put(u1, 1));
    const right = k === n - 1 ? high : 1;
    for (let j = 1; j < right; j++) ring.push(put(u1, 1 - j / right));
    ring.push(put(u1, 0));
    // Éventail depuis le coin (u1, 1), ou depuis (u0, 0) si c'est le côté u1 qui est subdivisé.
    const hub = right > 1 ? 0 : corner;
    const count = ring.length;
    for (let j = 1; j + 1 < count; j++) {
      const a = ring[hub] ?? 0;
      const b = ring[(hub + j) % count] ?? 0;
      const c = ring[(hub + j + 1) % count] ?? 0;
      // Crêtes le long de x: (u, v) est retourné par rapport à (x, z), le sens des faces aussi.
      if (axis === 'y') indices.push(a, b, c);
      else indices.push(a, c, b);
    }
  }
  builder.sheet(positions, normals, indices, white);
}

/** Racines qui sortent de la terre d'une berge (une pièce chacune: le contour les cerne). */
function bankRoots(builder: GeometryBuilder, relief: Relief, rect: Rect): void {
  const bank = relief.settings.bank;
  const level = relief.settings.water.level;
  const wet = (x: number, y: number): boolean => relief.lookAt(x, y)?.water === true;
  tint.set(bank.rootColor);
  builder.setInk(LAYER.plain);
  builder.part(null);
  let made = 0;
  for (let cy = rect.y0; cy < rect.y1; cy++)
    for (let cx = rect.x0; cx < rect.x1; cx++) {
      if (!relief.isSoft(cx, cy) || wet(cx, cy)) continue;
      if (!bank.rootNatures.includes(relief.nameAt(cx, cy) ?? '')) continue;
      if (hash01(cx, cy, 161) >= bank.roots) continue;
      const s = SIDES.find((d) => wet(cx + d.dx, cy + d.dy));
      if (s === undefined) continue;
      // Départ: en haut de la pente, là où la terre paraît, en marchant de la case vers l'eau.
      const side = 0.2 + hash01(cx, cy, 162) * 0.6;
      let x = cx + 0.5 + s.dx * -0.4 + (s.dx === 0 ? side - 0.5 : 0);
      let y = cy + 0.5 + s.dy * -0.4 + (s.dy === 0 ? side - 0.5 : 0);
      let found = false;
      for (let k = 0; k < 14 && !found; k++) {
        if (relief.waterDistance(x, y) < bank.earth - 0.04) found = true;
        else {
          x += s.dx * 0.1;
          y += s.dy * 0.1;
        }
      }
      if (!found) continue;
      const length =
        bank.rootLength[0] + hash01(cx, cy, 163) * (bank.rootLength[1] - bank.rootLength[0]);
      const sway = (hash01(cx, cy, 164) - 0.5) * 1.8;
      const segments = 4;
      // Noeuds de la racine: elle descend la pente en biaisant, sort de terre puis y replonge.
      const nodes: [number, number, number, number][] = [];
      for (let k = 0; k <= segments; k++) {
        const t = k / segments;
        const bend = Math.sin(t * Math.PI) * sway * 0.25 + t * sway * 0.3;
        const px = x + (s.dx * t - s.dy * bend) * length;
        const py = y + (s.dy * t + s.dx * bend) * length;
        const lift = k === 0 ? -0.02 : k === segments ? -0.05 : bank.rootLift * (1 - t * 0.4);
        const h = Math.max(relief.heightAt(px, py), level - 0.06) + lift;
        nodes.push([px, h, py, bank.rootWidth * (1 - t * 0.55)]);
      }
      builder.piece(inkCode(made++, 0.6));
      for (let k = 0; k < segments; k++) {
        const a = nodes[k];
        const b = nodes[k + 1];
        if (a === undefined || b === undefined) continue;
        const dx = b[0] - a[0];
        const dz = b[2] - a[2];
        const d = Math.hypot(dx, dz) || 1;
        // Travers de la racine (horizontal), vers la gauche du sens de marche vu du dessus.
        const tx = dz / d;
        const tz = -dx / d;
        const al: [number, number, number] = [a[0] + tx * a[3], a[1], a[2] + tz * a[3]];
        const ar: [number, number, number] = [a[0] - tx * a[3], a[1], a[2] - tz * a[3]];
        const bl: [number, number, number] = [b[0] + tx * b[3], b[1], b[2] + tz * b[3]];
        const br: [number, number, number] = [b[0] - tx * b[3], b[1], b[2] - tz * b[3]];
        const down = (p: [number, number, number], w: number): [number, number, number] => [
          p[0],
          p[1] - w * 1.6 - 0.05,
          p[2],
        ];
        builder.quad([al, ar, br, bl], [0, 1, 0], [tint]);
        builder.quad([al, bl, down(bl, b[3]), down(al, a[3])], [tx, 0.3, tz], [tint]);
        builder.quad([ar, down(ar, a[3]), down(br, b[3]), br], [-tx, 0.3, -tz], [tint]);
      }
    }
  builder.piece(0);
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

/** Ce qui distingue une sorte de pierre: son trait, ses flancs. */
interface StoneLook {
  readonly chamfer: number;
  readonly sideShade: number;
  /** Taille nominale pour le rang du trait (m). */
  readonly stroke: number;
  /** Petit côté sous lequel la pierre n'a que son dessus (m). */
  readonly flankFrom: number;
}

/** Une dalle ou une pierre: dessus (inégal) et quatre flancs en léger fruit, un seul morceau. */
function stone(builder: GeometryBuilder, item: Slab, color: Color, look: StoneLook): void {
  const { x0, z0, x1, z1, bottom } = item;
  const [nw, sw, se, ne] = item.tops;
  const flanks = Math.min(x1 - x0, z1 - z0) >= look.flankFrom;
  const c = flanks ? Math.min(look.chamfer, (x1 - x0) / 4, (z1 - z0) / 4) : 0;
  const sideShade = look.sideShade;
  builder.part(look.stroke);
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
  if (!flanks) return;
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
  builder.setInk(LAYER.plain, KIND.joint);
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
  const cellOf = (item: Slab): [number, number] => [
    Math.floor(Math.max(rect.x0, (item.x0 + item.x1) / 2)),
    Math.floor((item.z0 + item.z1) / 2),
  ];
  yield;
  let laid = 0;
  for (const slab of relief.slabs(rect)) {
    const [cx, cy] = cellOf(slab);
    const paving = relief.profileAt(cx, cy)?.paving;
    color.set(relief.lookAt(cx, cy)?.color ?? '#ffffff');
    builder.setInk(LAYER[paving?.layer ?? 'face'] + KEEP_INK);
    stone(builder, slab, color, {
      chamfer: paving?.chamfer ?? 0,
      sideShade: mesh.sideShade,
      stroke: paving?.stroke ?? KERB_DIAGONAL,
      flankFrom: mesh.flankFrom,
    });
    if (++laid % STONES_PER_STEP === 0) yield;
  }
  yield;
  builder.setInk(LAYER.face);
  const kerbLook: StoneLook = {
    chamfer: 0.012,
    sideShade: mesh.sideShade,
    stroke: KERB_DIAGONAL,
    flankFrom: 0,
  };
  for (const kerb of relief.kerbStones(rect)) {
    const [cx, cy] = cellOf(kerb);
    const own = relief.profileAt(cx, cy)?.kerb;
    if (own?.color !== undefined) color.set(own.color);
    else color.set(relief.lookAt(cx, cy)?.color ?? '#ffffff').multiplyScalar(1.08);
    stone(builder, kerb, color, kerbLook);
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
  // Travail fait depuis la dernière pause, en cases simples (une case serrée en vaut `fine`²).
  let work = 0;
  for (let cy = rect.y0; cy < rect.y1; cy++) {
    for (let cx = rect.x0; cx < rect.x1; cx++) {
      const profile = relief.profileAt(cx, cy);
      if (profile === null || relief.lookAt(cx, cy)?.hidden === true) continue;
      if (profile.edge === 'souple') {
        // Teinte et matière lues dans la carte du sol du lieu (rendu encré).
        builder.setInk(LAYER.grass, KIND.ground);
        builder.shore(2);
        const ridged = relief.ridged(cx, cy);
        if (relief.resolution(cx, cy) > 1) {
          fineCell(builder, relief, cx, cy, fine);
          work += fine * fine;
        } else if (ridged !== null) {
          ridgedCell(builder, relief, cx, cy, ridged, fine, e);
          work += fine;
        } else coarseCell(builder, relief, cx, cy, e);
        work += 1;
        if (work >= CELLS_PER_STEP) {
          work = 0;
          yield;
        }
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
    work += rect.x1 - rect.x0;
    if (work >= CELLS_PER_STEP) {
      work = 0;
      yield;
    }
  }
  bankRoots(builder, relief, rect);
  yield* paving(builder, relief, rect);
  return builder.build();
}
