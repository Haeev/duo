/**
 * Réserve et cour d'Ormeval, en géométrie procédurale: la coque cuite s'arrête au refend (z 6,70),
 * alors que la porte de l'arrière-comptoir mène à la réserve, puis à la cour (palette des
 * livraisons). Cotes du plan dans `arriere-cotes.ts`.
 *
 * Rendu comme la coque cuite: `MeshBasicMaterial` sans lumière de scène, la lumière est « cuite »
 * une fois dans les couleurs de sommets (ampoule de la réserve, jour de la porte de la cour, ciel
 * et soleil de fin d'après-midi dans la cour, occlusion des coins). Texture et couleurs de sommets
 * à quatre composantes: le programme du ciel de la place (`dt_ciel`), déjà compilé; l'ampoule
 * prend celui des abat-jour allumés (`dt_lampe`). Aucun programme de plus (budget de 12).
 *
 * Toiture, gouttière et maisons voisines vues par-dessus les murs sont dans le modèle de la place
 * (`shell_village_place.glb`): la façade monte jusque sous sa toiture.
 *
 * Ce qui double la pièce du fond (`shell_village_ext_fond.glb`, qui dessine sa propre cour vue
 * par la fenêtre) passe dans un groupe caché quand l'extension est ouverte: volets et tableaux
 * de la fenêtre, figuier, poubelles.
 */
import {
  BufferGeometry,
  Color,
  CylinderGeometry,
  DataTexture,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicMaterial,
  RepeatWrapping,
  SphereGeometry,
  SRGBColorSpace,
  TextureLoader,
  type Object3D,
  type Texture,
} from 'three';
import {
  BINS,
  BINS_HEIGHT,
  CEILING,
  DOOR_BACKBAR,
  DOOR_HEIGHT,
  DOOR_YARD,
  EAVE_HEIGHT,
  FACADE_Z,
  FIG,
  GATE,
  JOIST_BOTTOM,
  JOIST_STEP,
  PANEL_AT,
  RESERVE,
  WINDOW_FOND,
  WINDOW_FOND_SILL,
  WINDOW_FOND_TOP,
  YARD,
  YARD_BACK_THICKNESS,
  YARD_WALL_EAST,
  YARD_WALL_HEIGHT,
  YARD_WALL_WEST,
} from './arriere-cotes';
import { textureUrl } from './modeles';

type Surface = 'enduit' | 'crepi' | 'bois' | 'pierre' | 'paves' | 'carreaux';

/** Texture de chaque matière et mètres couverts par une répétition. */
const SURFACES: Readonly<
  Record<Surface, { readonly file: string | null; readonly metres: number }>
> = {
  enduit: { file: 'mur_enduit.jpg', metres: 1 },
  // Le même enduit, plus large sur la grande façade (moins de taches répétées).
  crepi: { file: 'mur_enduit.jpg', metres: 2.2 },
  bois: { file: 'coque_bois.jpg', metres: 1 },
  pierre: { file: 'coque_pierre.jpg', metres: 1.2 },
  paves: { file: 'coque_paves.jpg', metres: 1.6 },
  // Carreaux de grès de 20 cm, dessinés ici (`tileTexture`).
  carreaux: { file: null, metres: 1 },
};

/** Teintes de la bible (`bible/source/palette.cjs`). */
const TINT = {
  lime: '#D5C4A5',
  ceiling: '#C7B597',
  beam: '#6B4B35',
  linen: '#D4C7AE',
  sage: '#7E937B',
  shutter: '#7F979B',
  stone: '#CDB892',
  stoneShade: '#A8946F',
  paving: '#A49B8A',
  facade: '#CDBB98',
  tiles: '#C2B6A2',
  zinc: '#8D9190',
  brass: '#B08A48',
  porcelain: '#F5F0E6',
  enamel: '#4F6150',
  binGreen: '#56684F',
  binGrey: '#6A6E6B',
  bark: '#6B5A48',
  leaves: '#667F4E',
  leavesLight: '#7A9160',
  ink: '#2B2622',
} as const;

/** Moyenne d'une texture neutre (sRGB 0,86, soit 0,70 en linéaire): la teinte se retrouve. */
const TEXTURE_MEAN = 0.7;

// -----------------------------------------------------------------------------------------------
// Lumière cuite dans les sommets

type Rgb = [number, number, number];
interface Vec {
  x: number;
  y: number;
  z: number;
}
type LightFn = (p: Vec, n: Vec, out: Rgb) => void;

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Occlusion des coins d'une boîte (pièce ou cour): plus sombre près des arêtes. Le plan sur
 * lequel est posé le sommet ne compte pas.
 */
function cornerShade(
  p: Vec,
  planes: readonly (readonly [axis: 'x' | 'y' | 'z', at: number, top: number])[],
): number {
  let near = Infinity;
  for (const [axis, at, top] of planes) {
    if (axis !== 'y' && p.y > top) continue;
    const d = Math.abs(p[axis] - at);
    if (d < 0.025) continue;
    near = Math.min(near, d);
  }
  return 0.6 + 0.4 * smooth(0, 0.7, near);
}

const [RX, RZ, RW, RD] = RESERVE;
/** Ampoule sous son abat-jour émaillé, pendue à la solive du milieu de la réserve. */
const LAMP = { x: RX + RW / 2, y: 2.3, z: RZ + 0.31 + 2 * JOIST_STEP } as const;
const BULB: Rgb = [1.0, 0.8, 0.56];
const ROOM_AMBIENT: Rgb = [0.25, 0.23, 0.21];
const DAY: Rgb = [0.75, 0.8, 0.9];
const RESERVE_PLANES = [
  ['x', RX, CEILING],
  ['x', RX + RW, CEILING],
  ['z', RZ, CEILING],
  ['z', RZ + RD, CEILING],
  ['y', 0, 0],
  ['y', CEILING, 0],
] as const;

/** Réserve: l'ampoule (l'abat-jour coupe le haut), le jour de la porte de la cour, les coins. */
const reserveLight: LightFn = (p, n, out) => {
  const lx = LAMP.x - p.x;
  const ly = LAMP.y - p.y;
  const lz = LAMP.z - p.z;
  const d2 = lx * lx + ly * ly + lz * lz;
  const d = Math.sqrt(d2);
  let direct = (Math.max(0, (n.x * lx + n.y * ly + n.z * lz) / d) * 4.2) / (d2 + 0.6);
  if (ly < 0.04) direct *= 0.12;
  // Jour de la cour par la porte ouverte: il entre vers +z.
  const doorX = DOOR_YARD[0] + DOOR_YARD[2] / 2;
  const dx = doorX - p.x;
  const dy = 1.0 - p.y;
  const dz = FACADE_Z - p.z;
  const dd2 = dx * dx + dy * dy + dz * dz;
  const dd = Math.sqrt(dd2);
  const facing = Math.max(0, (n.x * dx + n.y * dy + n.z * dz) / dd);
  const inward = Math.max(0, -dz / dd);
  const day = (facing * inward * 1.1) / (dd2 + 1.2);
  const ao = cornerShade(p, RESERVE_PLANES);
  for (let i = 0; i < 3; i++)
    out[i] = ((BULB[i] ?? 0) * direct + (ROOM_AMBIENT[i] ?? 0) + (DAY[i] ?? 0) * day) * ao;
};

/** Soleil de fin d'après-midi, à l'ouest-sud-ouest, à 30 degrés (comme la place). */
const SUN = (() => {
  const v = { x: -0.75, y: 0.52, z: 0.42 };
  const l = Math.hypot(v.x, v.y, v.z);
  return { x: v.x / l, y: v.y / l, z: v.z / l };
})();
const SUN_RGB: Rgb = [1.05, 0.86, 0.62];
const SKY_RGB: Rgb = [0.74, 0.79, 0.88];

/** Volumes qui font de l'ombre au soleil dans la cour: maisons, murs. x0, x1, y0, y1, z0, z1. */
const SUN_BLOCKERS: readonly (readonly [number, number, number, number, number, number])[] = [
  [-8, YARD_WALL_EAST[0], 0, EAVE_HEIGHT + 0.2, FACADE_Z, 14],
  [13.5, 20, 0, 6.3, 4, 14],
  [YARD_WALL_EAST[0], 13.5, 0, 3.65, 2.7, 3],
  [YARD_WALL_WEST[0], YARD_WALL_WEST[0] + YARD_WALL_WEST[2], 0, YARD_WALL_HEIGHT + 0.06, -0.3, 3],
  [1.9, 11.7, 0, YARD_WALL_HEIGHT + 0.06, -YARD_BACK_THICKNESS, 0],
  [YARD_WALL_EAST[0], YARD_WALL_EAST[0] + YARD_WALL_EAST[2], 0, YARD_WALL_HEIGHT + 0.06, 0, 3],
];

function inSunShadow(p: Vec, n: Vec): boolean {
  const ox = p.x + n.x * 0.02;
  const oy = p.y + n.y * 0.02;
  const oz = p.z + n.z * 0.02;
  for (const [x0, x1, y0, y1, z0, z1] of SUN_BLOCKERS) {
    let tmin = 0;
    let tmax = 100;
    const slab = (o: number, dir: number, lo: number, hi: number): boolean => {
      if (Math.abs(dir) < 1e-9) return o >= lo && o <= hi;
      let t0 = (lo - o) / dir;
      let t1 = (hi - o) / dir;
      if (t0 > t1) [t0, t1] = [t1, t0];
      tmin = Math.max(tmin, t0);
      tmax = Math.min(tmax, t1);
      return tmin <= tmax;
    };
    if (slab(ox, SUN.x, x0, x1) && slab(oy, SUN.y, y0, y1) && slab(oz, SUN.z, z0, z1)) return true;
  }
  return false;
}

const [YX, YZ, YW, YD] = YARD;
const YARD_PLANES = [
  ['x', YX, YARD_WALL_HEIGHT],
  ['x', YX + YW, YARD_WALL_HEIGHT],
  ['z', YZ, YARD_WALL_HEIGHT],
  ['z', YZ + YD, EAVE_HEIGHT],
  ['y', 0, 0],
] as const;

/** Cour et façade: ciel (plus ouvert en hauteur), soleil là où rien ne l'arrête. */
const yardLight: LightFn = (p, n, out) => {
  const up = Math.max(0, n.y);
  const open = 0.62 + 0.38 * Math.max(up, smooth(0, 4.5, p.y));
  const ao =
    p.x > YX - 0.05 && p.x < YX + YW + 0.05 && p.z < YZ + YD + 0.05
      ? cornerShade(p, YARD_PLANES)
      : 1;
  const facing = n.x * SUN.x + n.y * SUN.y + n.z * SUN.z;
  const sun = facing > 0 && !inSunShadow(p, n) ? facing : 0;
  for (let i = 0; i < 3; i++)
    out[i] = ((SKY_RGB[i] ?? 0) * open * ao + (SUN_RGB[i] ?? 0) * sun) * 1.0;
};

// -----------------------------------------------------------------------------------------------
// Construction

interface Layer {
  readonly pos: number[];
  readonly nrm: number[];
  readonly uv: number[];
  readonly col: number[];
  readonly idx: number[];
}

type Face = 'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz';

const CELL = 0.25;

class Builder {
  readonly layers = new Map<Surface, Layer>();
  /** Fil du bois vertical sur les faces verticales (portes, volets), sinon horizontal (solives). */
  grainUp = false;
  private readonly tint = new Color();
  private readonly light: Rgb = [0, 0, 0];
  private readonly p: Vec = { x: 0, y: 0, z: 0 };
  private readonly n: Vec = { x: 0, y: 0, z: 0 };

  private layer(s: Surface): Layer {
    let l = this.layers.get(s);
    if (l === undefined) {
      l = { pos: [], nrm: [], uv: [], col: [], idx: [] };
      this.layers.set(s, l);
    }
    return l;
  }

  private vertex(l: Layer, s: Surface, lightFn: LightFn): void {
    const { p, n } = this;
    l.pos.push(p.x, p.y, p.z);
    l.nrm.push(n.x, n.y, n.z);
    // Projection plane selon l'axe dominant de la normale: les joints se suivent d'une face à l'autre.
    const m = SURFACES[s].metres;
    const ax = Math.abs(n.x);
    const ay = Math.abs(n.y);
    const az = Math.abs(n.z);
    if (ay >= ax && ay >= az) l.uv.push(p.x / m, p.z / m);
    else if (this.grainUp) l.uv.push(-p.y / m, (ax >= az ? p.z : p.x) / m);
    else if (ax >= az) l.uv.push(p.z / m, -p.y / m);
    else l.uv.push(p.x / m, -p.y / m);
    lightFn(p, n, this.light);
    const t = this.tint;
    l.col.push(
      (t.r / TEXTURE_MEAN) * this.light[0],
      (t.g / TEXTURE_MEAN) * this.light[1],
      (t.b / TEXTURE_MEAN) * this.light[2],
      1,
    );
  }

  /** Quadrilatère o, o+a, o+a+b, o+b, découpé en cases de 25 cm (la lumière y varie), tourné vers `nrm`. */
  quad(o: Vec, a: Vec, b: Vec, nrm: Vec, s: Surface, tint: string, lightFn: LightFn): void {
    const cx = a.y * b.z - a.z * b.y;
    const cy = a.z * b.x - a.x * b.z;
    const cz = a.x * b.y - a.y * b.x;
    let [u, w] = [a, b];
    if (cx * nrm.x + cy * nrm.y + cz * nrm.z < 0) [u, w] = [b, a];
    const nu = Math.max(1, Math.ceil(Math.hypot(u.x, u.y, u.z) / CELL));
    const nw = Math.max(1, Math.ceil(Math.hypot(w.x, w.y, w.z) / CELL));
    const l = this.layer(s);
    this.tint.set(tint);
    const base = l.pos.length / 3;
    this.n.x = nrm.x;
    this.n.y = nrm.y;
    this.n.z = nrm.z;
    for (let j = 0; j <= nw; j++) {
      for (let i = 0; i <= nu; i++) {
        this.p.x = o.x + (u.x * i) / nu + (w.x * j) / nw;
        this.p.y = o.y + (u.y * i) / nu + (w.y * j) / nw;
        this.p.z = o.z + (u.z * i) / nu + (w.z * j) / nw;
        this.vertex(l, s, lightFn);
      }
    }
    for (let j = 0; j < nw; j++) {
      for (let i = 0; i < nu; i++) {
        const k = base + j * (nu + 1) + i;
        l.idx.push(k, k + 1, k + nu + 2, k, k + nu + 2, k + nu + 1);
      }
    }
  }

  /** Rectangle aligné sur les axes, dans le plan `axis = at`, tourné vers `sign`. */
  rect(
    axis: 'x' | 'y' | 'z',
    at: number,
    sign: 1 | -1,
    a0: number,
    a1: number,
    b0: number,
    b1: number,
    s: Surface,
    tint: string,
    lightFn: LightFn,
  ): void {
    if (a1 - a0 <= 1e-4 || b1 - b0 <= 1e-4) return;
    // x: (z, y); y: (x, z); z: (x, y)
    if (axis === 'x')
      this.quad(
        { x: at, y: b0, z: a0 },
        { x: 0, y: 0, z: a1 - a0 },
        { x: 0, y: b1 - b0, z: 0 },
        { x: sign, y: 0, z: 0 },
        s,
        tint,
        lightFn,
      );
    else if (axis === 'y')
      this.quad(
        { x: a0, y: at, z: b0 },
        { x: a1 - a0, y: 0, z: 0 },
        { x: 0, y: 0, z: b1 - b0 },
        { x: 0, y: sign, z: 0 },
        s,
        tint,
        lightFn,
      );
    else
      this.quad(
        { x: a0, y: b0, z: at },
        { x: a1 - a0, y: 0, z: 0 },
        { x: 0, y: b1 - b0, z: 0 },
        { x: 0, y: 0, z: sign },
        s,
        tint,
        lightFn,
      );
  }

  /** Pavé aligné sur les axes; `skip`: faces cachées (contre un mur, dans le sol). */
  box(
    x0: number,
    x1: number,
    y0: number,
    y1: number,
    z0: number,
    z1: number,
    s: Surface,
    tint: string,
    lightFn: LightFn,
    skip: readonly Face[] = [],
  ): void {
    const has = (f: Face): boolean => !skip.includes(f);
    if (has('px')) this.rect('x', x1, 1, z0, z1, y0, y1, s, tint, lightFn);
    if (has('nx')) this.rect('x', x0, -1, z0, z1, y0, y1, s, tint, lightFn);
    if (has('py')) this.rect('y', y1, 1, x0, x1, z0, z1, s, tint, lightFn);
    if (has('ny')) this.rect('y', y0, -1, x0, x1, z0, z1, s, tint, lightFn);
    if (has('pz')) this.rect('z', z1, 1, x0, x1, y0, y1, s, tint, lightFn);
    if (has('nz')) this.rect('z', z0, -1, x0, x1, y0, y1, s, tint, lightFn);
  }

  /** Géométrie Three.js (cylindre, sphère) déjà placée: ses normales servent à la lumière. */
  shape(g: BufferGeometry, s: Surface, tint: string, lightFn: LightFn): void {
    const pos = g.getAttribute('position');
    const nrm = g.getAttribute('normal');
    const index = g.getIndex();
    const l = this.layer(s);
    this.tint.set(tint);
    const base = l.pos.length / 3;
    for (let i = 0; i < pos.count; i++) {
      this.p.x = pos.getX(i);
      this.p.y = pos.getY(i);
      this.p.z = pos.getZ(i);
      this.n.x = nrm.getX(i);
      this.n.y = nrm.getY(i);
      this.n.z = nrm.getZ(i);
      this.vertex(l, s, lightFn);
    }
    if (index !== null) for (let i = 0; i < index.count; i++) l.idx.push(base + index.getX(i));
    else for (let i = 0; i < pos.count; i++) l.idx.push(base + i);
    g.dispose();
  }
}

/** Carreaux de grès de 20 cm, joints fins, légère variation d'un carreau à l'autre (sRGB). */
function tileTexture(): DataTexture {
  const size = 250;
  const tile = 50;
  const data = new Uint8Array(size * size * 4);
  let seed = 7;
  const rand = (): number => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const shades: number[] = [];
  for (let i = 0; i < 25; i++) shades.push(0.96 + rand() * 0.08);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tx = x % tile;
      const ty = y % tile;
      const joint = tx < 2 || ty < 2;
      const k =
        (shades[Math.floor(y / tile) * 5 + Math.floor(x / tile)] ?? 1) * (0.985 + rand() * 0.03);
      const o = (y * size + x) * 4;
      const [r, g, b] = joint ? [176, 170, 160] : [222 * k, 218 * k, 210 * k];
      data[o] = Math.min(255, r);
      data[o + 1] = Math.min(255, g);
      data[o + 2] = Math.min(255, b);
      data[o + 3] = 255;
    }
  }
  const t = new DataTexture(data, size, size);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.magFilter = LinearFilter;
  t.minFilter = LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

// -----------------------------------------------------------------------------------------------
// Les pièces

const [D5X, D5Z, D5W] = DOOR_BACKBAR;
const [D2X, D2Z, D2W, D2D] = DOOR_YARD;
const [WX, , WW] = WINDOW_FOND;
const REFEND_FACE = D5Z - 0.004;

function buildReserve(b: Builder): void {
  const x0 = RX;
  const x1 = RX + RW;
  const z0 = RZ;
  const z1 = RZ + RD;
  const L = reserveLight;
  // Sol de grès, plafond enduit entre les solives.
  b.rect('y', 0, 1, x0, x1, z0, z1, 'carreaux', TINT.tiles, L);
  b.rect('y', CEILING, -1, x0, x1, z0, z1, 'enduit', TINT.ceiling, L);
  for (let z = z0 + JOIST_STEP / 2; z < z1 - 0.1; z += JOIST_STEP)
    b.box(x0, x1, JOIST_BOTTOM, CEILING, z - 0.06, z + 0.06, 'bois', TINT.beam, L, [
      'py',
      'px',
      'nx',
    ]);
  // Murs enduits: cloison de la pièce du fond (ouest), mur est, mur sur cour (porte), refend.
  b.rect('x', x0, 1, z0, z1, 0, CEILING, 'enduit', TINT.lime, L);
  b.rect('x', x1, -1, z0, z1, 0, CEILING, 'enduit', TINT.lime, L);
  b.rect('z', z0, 1, x0, D2X, 0, CEILING, 'enduit', TINT.lime, L);
  b.rect('z', z0, 1, D2X + D2W, x1, 0, CEILING, 'enduit', TINT.lime, L);
  b.rect('z', z0, 1, D2X, D2X + D2W, DOOR_HEIGHT, CEILING, 'enduit', TINT.lime, L);
  // Côté réserve du refend: un enduit à 4 mm de la face cuite (éclairée pour la salle, pas ici).
  b.rect('z', REFEND_FACE, -1, x0, D5X, 0, CEILING, 'enduit', TINT.lime, L);
  b.rect('z', REFEND_FACE, -1, D5X + D5W, x1, 0, CEILING, 'enduit', TINT.lime, L);
  b.rect('z', REFEND_FACE, -1, D5X, D5X + D5W, DOOR_HEIGHT, CEILING, 'enduit', TINT.lime, L);
  // Plinthes carrelées (10 cm), interrompues aux portes et au chambranle.
  const pl = 0.1;
  const t = 0.01;
  b.box(x0, x0 + t, 0, pl, z0 + t, z1 - t, 'carreaux', TINT.tiles, L, ['nx', 'ny']);
  b.box(x1 - t, x1, 0, pl, z0 + t, z1 - t, 'carreaux', TINT.tiles, L, ['px', 'ny']);
  b.box(x0, D2X, 0, pl, z0, z0 + t, 'carreaux', TINT.tiles, L, ['nz', 'ny']);
  b.box(D2X + D2W, x1, 0, pl, z0, z0 + t, 'carreaux', TINT.tiles, L, ['nz', 'ny']);
  b.box(x0, D5X - 0.07, 0, pl, REFEND_FACE - t, REFEND_FACE, 'carreaux', TINT.tiles, L, [
    'pz',
    'ny',
  ]);

  // Porte de l'arrière-comptoir: chambranle côté réserve (comme côté salle), seuil de pierre,
  // vantail ouvert à 90 degrés contre le mur est (gonds à l'est, il ouvre vers la réserve).
  const fz0 = REFEND_FACE - 0.024;
  b.box(D5X - 0.07, D5X, 0, 2.17, fz0, REFEND_FACE, 'bois', TINT.linen, L, ['pz', 'ny']);
  b.box(D5X + D5W, D5X + D5W + 0.07, 0, 2.17, fz0, REFEND_FACE, 'bois', TINT.linen, L, [
    'pz',
    'ny',
  ]);
  b.box(D5X, D5X + D5W, DOOR_HEIGHT, 2.17, fz0, REFEND_FACE, 'bois', TINT.linen, L, [
    'pz',
    'px',
    'nx',
  ]);
  b.box(
    D5X,
    D5X + D5W,
    -0.06,
    0.004,
    D5Z - 0.02,
    D5Z + DOOR_BACKBAR[3],
    'pierre',
    TINT.stoneShade,
    L,
    ['ny'],
  );
  const lx0 = D5X + D5W + 0.02;
  const lx1 = lx0 + 0.04;
  const lz1 = fz0 - 0.012;
  const lz0 = lz1 - D5W;
  b.grainUp = true;
  b.box(lx0, lx1, 0.006, DOOR_HEIGHT - 0.01, lz0, lz1, 'bois', TINT.sage, L);
  for (const [y0, y1] of [
    [0.15, 0.95],
    [1.1, 1.95],
  ] as const)
    b.box(lx0 - 0.012, lx0, y0, y1, lz0 + 0.1, lz1 - 0.1, 'bois', TINT.sage, L, ['px']);
  b.grainUp = false;
  b.shape(cylinder(lx0 - 0.02, 1.0, lz0 + 0.1, 0.022, 0.022, 0.04, 'x'), 'bois', TINT.brass, L);
  // Interrupteur de porcelaine, côté serrure (ouest) de la porte.
  b.box(
    D5X - 0.22,
    D5X - 0.14,
    1.06,
    1.14,
    REFEND_FACE - 0.018,
    REFEND_FACE,
    'enduit',
    TINT.porcelain,
    L,
    ['pz'],
  );

  // Porte de la cour: chambranle intérieur, deux vantaux ouverts à 90 degrés vers la réserve
  // (gonds aux deux tableaux), seuil de pierre.
  const iz1 = z0 + 0.024;
  b.box(D2X - 0.07, D2X, 0, 2.17, z0, iz1, 'bois', TINT.linen, L, ['nz', 'ny']);
  b.box(D2X + D2W, D2X + D2W + 0.07, 0, 2.17, z0, iz1, 'bois', TINT.linen, L, ['nz', 'ny']);
  b.box(D2X - 0.07, D2X + D2W + 0.07, DOOR_HEIGHT, 2.17, z0, iz1, 'bois', TINT.linen, L, ['nz']);
  const leaf = D2W / 2;
  for (const [a0, a1] of [
    [D2X, D2X + 0.04],
    [D2X + D2W - 0.04, D2X + D2W],
  ] as const) {
    b.grainUp = true;
    b.box(
      a0,
      a1,
      0.006,
      DOOR_HEIGHT - 0.01,
      iz1 + 0.006,
      iz1 + 0.006 + leaf - 0.03,
      'bois',
      TINT.shutter,
      L,
    );
    b.grainUp = false;
  }
  b.box(D2X, D2X + D2W, -0.06, 0.008, D2Z - 0.05, D2Z + D2D, 'pierre', TINT.stoneShade, yardLight, [
    'ny',
  ]);

  // Tableau électrique (marker-5), mince, contre le mur est.
  const [, pz] = PANEL_AT;
  b.box(x1 - 0.08, x1, 1.4, 1.9, pz - 0.2, pz + 0.2, 'enduit', '#B9B4AA', L, ['px']);
  b.box(x1 - 0.085, x1 - 0.08, 1.45, 1.85, pz - 0.16, pz + 0.16, 'enduit', '#A7A296', L, ['px']);
  // Câble sous goulotte du tableau au plafond.
  b.box(x1 - 0.03, x1, 1.9, CEILING, pz + 0.13, pz + 0.17, 'enduit', '#E3DDD0', L, ['px', 'py']);

  // Suspension: fil, abat-jour émaillé vert, ampoule (matériau à part).
  b.shape(
    cylinder(LAMP.x, (JOIST_BOTTOM + 2.45) / 2, LAMP.z, 0.006, 0.006, JOIST_BOTTOM - 2.45, 'y'),
    'enduit',
    TINT.ink,
    L,
  );
  b.shape(cone(LAMP.x, 2.38, LAMP.z), 'enduit', TINT.enamel, ambientOnly);
  b.shape(insideOut(cone(LAMP.x, 2.38, LAMP.z)), 'enduit', TINT.porcelain, shadeInside);
}

/**
 * Houppier à facettes (bible: rondeurs par chanfreins): icosaèdre subdivisé une fois, sommets
 * poussés de quelques pour cent (même poussée pour un même point: pas de fente), un peu aplati.
 */
function crown(x: number, y: number, z: number, r: number): BufferGeometry {
  const g = new IcosahedronGeometry(r, 1);
  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const py = pos.getY(i);
    const pz = pos.getZ(i);
    const h = Math.sin(px * 12.9898 + py * 78.233 + pz * 37.719) * 43758.5453;
    const k = 0.94 + 0.12 * (h - Math.floor(h));
    pos.setXYZ(i, px * k + x, py * k * 0.85 + y, pz * k + z);
  }
  g.computeVertexNormals();
  return g;
}

/** Abat-jour conique (ouvert en bas): dehors émaillé, dedans blanc éclairé par l'ampoule. */
function cone(x: number, y: number, z: number): BufferGeometry {
  const g = new CylinderGeometry(0.05, 0.19, 0.14, 20, 1, true);
  g.translate(x, y, z);
  return g;
}

function cylinder(
  x: number,
  y: number,
  z: number,
  rTop: number,
  rBottom: number,
  length: number,
  axis: 'x' | 'y' | 'z',
): BufferGeometry {
  const g = new CylinderGeometry(rTop, rBottom, length, 10);
  if (axis === 'x') g.rotateZ(Math.PI / 2);
  if (axis === 'z') g.rotateX(Math.PI / 2);
  g.translate(x, y, z);
  return g;
}

const ambientOnly: LightFn = (_p, _n, out) => {
  out[0] = 0.55;
  out[1] = 0.5;
  out[2] = 0.45;
};

/** Dedans de l'abat-jour, sous l'ampoule. */
const shadeInside: LightFn = (_p, _n, out) => {
  out[0] = 1.25;
  out[1] = 1.05;
  out[2] = 0.78;
};

/** Même surface vue de l'autre côté: ordre des sommets et normales inversés. */
function insideOut(g: BufferGeometry): BufferGeometry {
  const index = g.getIndex();
  if (index !== null) {
    for (let i = 0; i + 2 < index.count; i += 3) {
      const a = index.getX(i + 1);
      index.setX(i + 1, index.getX(i + 2));
      index.setX(i + 2, a);
    }
  }
  const n = g.getAttribute('normal');
  for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  return g;
}

/** Façade sur cour percée d'ouvertures (x0, x1, y0, y1), sur une bande de hauteur. */
function facadeBand(
  b: Builder,
  xa: number,
  xb: number,
  ya: number,
  yb: number,
  holes: readonly (readonly [number, number, number, number])[],
  tint: string,
  z = FACADE_Z - 0.01,
): void {
  let x = xa;
  for (const [h0, h1, hy0, hy1] of holes) {
    b.rect('z', z, -1, x, h0, ya, yb, 'crepi', tint, yardLight);
    b.rect('z', z, -1, h0, h1, ya, hy0, 'crepi', tint, yardLight);
    b.rect('z', z, -1, h0, h1, hy1, yb, 'crepi', tint, yardLight);
    x = h1;
  }
  b.rect('z', z, -1, x, xb, ya, yb, 'crepi', tint, yardLight);
}

/** Encadrement de pierre en saillie de 3 cm autour d'une baie, appui débordant si `sill`. */
function stoneFrame(
  b: Builder,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  sill: boolean,
): void {
  const zf = FACADE_Z - 0.01;
  const w = 0.15;
  const L = yardLight;
  b.box(x0 - w, x0, y0 - (sill ? 0.06 : 0), y1, zf - 0.03, zf, 'pierre', TINT.stone, L, ['pz']);
  b.box(x1, x1 + w, y0 - (sill ? 0.06 : 0), y1, zf - 0.03, zf, 'pierre', TINT.stone, L, ['pz']);
  b.box(x0 - w, x1 + w, y1, y1 + 0.16, zf - 0.03, zf, 'pierre', TINT.stone, L, ['pz']);
  if (sill)
    b.box(
      x0 - w - 0.03,
      x1 + w + 0.03,
      y0 - 0.06,
      y0,
      zf - 0.08,
      FACADE_Z,
      'pierre',
      TINT.stoneShade,
      L,
      ['pz'],
    );
}

/** Volets pleins fermés au fond du tableau (6 cm), tableaux enduits. */
function closedShutters(b: Builder, x0: number, x1: number, y0: number, y1: number): void {
  const zf = FACADE_Z - 0.01;
  const zs = FACADE_Z + 0.06;
  const L = yardLight;
  b.rect('x', x0, 1, zf, zs, y0, y1, 'enduit', TINT.facade, L);
  b.rect('x', x1, -1, zf, zs, y0, y1, 'enduit', TINT.facade, L);
  b.rect('y', y1, -1, x0, x1, zf, zs, 'enduit', TINT.facade, L);
  b.rect('y', y0, 1, x0, x1, FACADE_Z, zs, 'pierre', TINT.stoneShade, L);
  const mid = (x0 + x1) / 2;
  b.grainUp = true;
  b.box(x0, mid, y0, y1, zs, zs + 0.03, 'bois', TINT.shutter, L, ['pz']);
  b.box(mid, x1, y0, y1, zs, zs + 0.03, 'bois', TINT.shutter, L, ['pz']);
  // Battue entre les deux vantaux, et barres (pentures) à un tiers et deux tiers.
  b.box(mid - 0.012, mid + 0.012, y0, y1, zs - 0.006, zs, 'bois', TINT.shutter, L, ['pz']);
  b.grainUp = false;
  for (const f of [0.25, 0.75])
    b.box(
      x0 + 0.04,
      x1 - 0.04,
      y0 + (y1 - y0) * f - 0.02,
      y0 + (y1 - y0) * f + 0.02,
      zs - 0.008,
      zs,
      'bois',
      TINT.ink,
      L,
      ['pz'],
    );
}

function buildYard(b: Builder, closedOnly: Builder): void {
  const L = yardLight;
  const top = YARD_WALL_HEIGHT;
  const x0 = YX;
  const x1 = YX + YW;
  // Sol pavé, seuil de pierre sous le portail.
  b.rect('y', 0, 1, x0, x1, YZ, YZ + YD, 'paves', TINT.paving, L);
  const [gx, gz, gw, gd] = GATE;
  b.rect('y', 0.004, 1, gx, gx + gw / 2, gz, gz + gd, 'pierre', TINT.stoneShade, L);

  // Clôture du fond (au bord du plan) et murs mitoyens, en pierre, chaperons débordants.
  b.rect('z', YZ, 1, x0, x1, 0, top, 'pierre', TINT.stone, L);
  b.rect('x', x0, 1, YZ, YZ + YD, 0, top, 'pierre', TINT.stone, L);
  // Face du mur de la ruelle à 5 mm: le mur qui ferme la ruelle (modèle de la place) a sa tranche
  // dans le même plan, au coin sud-est.
  const xe = x1 - 0.005;
  b.rect('x', xe, -1, YZ, gz, 0, top, 'pierre', TINT.stone, L);
  b.rect('x', xe, -1, gz + gd, YZ + YD, 0, top, 'pierre', TINT.stone, L);
  b.rect('x', xe, -1, gz, gz + gd, DOOR_HEIGHT, top, 'pierre', TINT.stone, L);
  const [wx] = YARD_WALL_WEST;
  const back = -YARD_BACK_THICKNESS;
  b.box(
    wx - 0.05,
    x1 + gw + 0.05,
    top,
    top + 0.06,
    back - 0.03,
    YZ + 0.03,
    'pierre',
    TINT.stoneShade,
    L,
  );
  b.box(wx - 0.05, x0 + 0.03, top, top + 0.06, YZ + 0.03, YZ + YD, 'pierre', TINT.stoneShade, L, [
    'pz',
  ]);
  b.box(
    x1 - 0.03,
    x1 + gw + 0.05,
    top,
    top + 0.06,
    YZ + 0.03,
    YZ + YD,
    'pierre',
    TINT.stoneShade,
    L,
    ['pz'],
  );
  // Dessus des murs sous le chaperon: rien à voir d'ici (le chaperon couvre).

  // Portail de livraison fermé (sur la ruelle): tableaux, deux vantaux de planches, écharpes.
  b.rect('z', gz, 1, xe, x1 + gw, 0, DOOR_HEIGHT, 'pierre', TINT.stoneShade, L);
  b.rect('z', gz + gd, -1, xe, x1 + gw, 0, DOOR_HEIGHT, 'pierre', TINT.stoneShade, L);
  b.rect('y', DOOR_HEIGHT, -1, xe, x1 + gw, gz, gz + gd, 'pierre', TINT.stoneShade, L);
  const gxl = x1 + 0.1;
  b.grainUp = true;
  b.box(gxl, gxl + 0.05, 0, DOOR_HEIGHT, gz, gz + gd, 'bois', TINT.shutter, L, ['px', 'ny']);
  b.grainUp = false;
  b.box(
    gxl - 0.006,
    gxl,
    0,
    DOOR_HEIGHT,
    gz + gd / 2 - 0.006,
    gz + gd / 2 + 0.006,
    'bois',
    TINT.ink,
    L,
    ['px'],
  );
  for (const y of [0.3, 1.0, 1.75])
    b.box(
      gxl - 0.025,
      gxl,
      y - 0.06,
      y + 0.06,
      gz + 0.05,
      gz + gd - 0.05,
      'bois',
      TINT.shutter,
      L,
      ['px'],
    );
  b.box(
    gxl - 0.045,
    gxl - 0.025,
    0.98,
    1.04,
    gz + gd / 2 - 0.12,
    gz + gd / 2 + 0.08,
    'bois',
    TINT.ink,
    L,
    ['px'],
  );

  // Façade sur cour: rez-de-chaussée (fenêtre de la pièce du fond, porte de la réserve), puis
  // l'étage du logement jusque sous la toiture.
  const upperY0 = 4.0;
  const upperY1 = 5.3;
  const uppers = [
    [WX + 0.05, WX + WW - 0.05],
    [D2X + 0.1, D2X + D2W - 0.1],
  ] as const;
  facadeBand(
    b,
    x0,
    x1,
    0,
    top,
    [
      [WX, WX + WW, WINDOW_FOND_SILL, WINDOW_FOND_TOP],
      [D2X, D2X + D2W, 0, DOOR_HEIGHT],
    ],
    TINT.facade,
  );
  // Au-dessus des murs, 2 cm de plus de chaque côté: le modèle de la place a deux minces tranches
  // de mur à ces coins (x 1,88 à 1,90 et 11,50 à 11,52), qui se verraient en traits sombres.
  facadeBand(b, wx - 0.02, x1 + 0.02, top, 3.1, [], TINT.facade);
  facadeBand(
    b,
    wx - 0.02,
    x1 + 0.02,
    3.1,
    EAVE_HEIGHT,
    uppers.map(([a, c]) => [a, c, upperY0, upperY1] as const),
    TINT.facade,
  );
  stoneFrame(b, WX, WX + WW, WINDOW_FOND_SILL, WINDOW_FOND_TOP, true);
  stoneFrame(b, D2X, D2X + D2W, 0, DOOR_HEIGHT, false);
  // Tableaux de la porte de la réserve (épaisseur du mur).
  b.rect('x', D2X, 1, FACADE_Z - 0.01, RZ, 0, DOOR_HEIGHT, 'enduit', TINT.lime, L);
  b.rect('x', D2X + D2W, -1, FACADE_Z - 0.01, RZ, 0, DOOR_HEIGHT, 'enduit', TINT.lime, L);
  b.rect('y', DOOR_HEIGHT, -1, D2X, D2X + D2W, FACADE_Z - 0.01, RZ, 'enduit', TINT.lime, L);
  // Fenêtres de l'étage au-dessus de celles du rez-de-chaussée, volets fermés: le logement est fermé
  // (porte `door-3`).
  for (const [a, c] of uppers) {
    stoneFrame(b, a, c, upperY0, upperY1, true);
    closedShutters(b, a, c, upperY0, upperY1);
  }
  // Fenêtre de la pièce du fond: volets fermés tant que la pièce est fermée.
  closedShutters(closedOnly, WX, WX + WW, WINDOW_FOND_SILL, WINDOW_FOND_TOP);

  // Descente d'eau pluviale au coin est, de la gouttière de la toiture (modèle de la place, vers
  // 6,40 m) au regard du pavé.
  const pipeX = x1 - 0.08;
  const pipeZ = FACADE_Z - 0.06;
  const pipeTop = EAVE_HEIGHT - 0.08;
  b.shape(cylinder(pipeX, pipeTop / 2, pipeZ, 0.04, 0.04, pipeTop, 'y'), 'bois', TINT.zinc, L);
  for (const y of [1.2, 3.0, 4.8])
    b.box(
      pipeX - 0.05,
      pipeX + 0.05,
      y - 0.015,
      y + 0.015,
      pipeZ - 0.05,
      FACADE_Z - 0.01,
      'bois',
      TINT.zinc,
      L,
      ['pz'],
    );
  b.box(pipeX - 0.12, pipeX + 0.07, 0, 0.012, pipeZ - 0.12, pipeZ + 0.05, 'pierre', TINT.ink, L, [
    'ny',
  ]);

  // Figuier (tree-2) et poubelles (fixture-2): la pièce du fond ouverte apporte les siens.
  const [fx, fz] = FIG;
  closedOnly.grainUp = true;
  closedOnly.shape(cylinder(fx, 1.4, fz, 0.1, 0.15, 2.8, 'y'), 'bois', TINT.bark, L);
  closedOnly.grainUp = false;
  for (const [dx, dz, h, r, tint] of [
    [0, 0, 3.4, 1.1, TINT.leaves],
    [0.7, 0.3, 3.0, 0.8, TINT.leavesLight],
    [-0.4, -0.2, 3.3, 0.75, TINT.leavesLight],
  ] as const) {
    closedOnly.shape(crown(fx + dx, h, fz + dz, r), 'enduit', tint, L);
  }
  const [bx, bz, bw, bd] = BINS;
  const half = bw / 2;
  for (const [i, tint] of [
    [0, TINT.binGreen],
    [1, TINT.binGrey],
  ] as const) {
    const a = bx + i * half + 0.05;
    const c = a + half - 0.1;
    closedOnly.box(
      a + 0.02,
      c - 0.02,
      0,
      BINS_HEIGHT - 0.06,
      bz + 0.02,
      bz + bd - 0.02,
      'enduit',
      tint,
      L,
      ['ny'],
    );
    closedOnly.box(a, c, BINS_HEIGHT - 0.06, BINS_HEIGHT, bz, bz + bd, 'enduit', tint, L);
  }
}

// -----------------------------------------------------------------------------------------------

export interface BackRooms {
  /** La pièce du fond est ouverte (extension): ses éléments remplacent ceux d'ici. */
  setFondOpen(open: boolean): void;
  dispose(): void;
}

export function createBackRooms(parent: Object3D): BackRooms {
  const always = new Builder();
  const closedOnly = new Builder();
  buildReserve(always);
  buildYard(always, closedOnly);

  const owned: { dispose(): void }[] = [];
  const loader = new TextureLoader();
  const textures = new Map<string, Texture>();
  const materials = new Map<Surface, MeshBasicMaterial>();
  const material = (s: Surface): MeshBasicMaterial => {
    const known = materials.get(s);
    if (known !== undefined) return known;
    const file = SURFACES[s].file;
    let map = textures.get(file ?? s);
    if (map === undefined) {
      const url = file === null ? undefined : textureUrl(file);
      map = url === undefined ? tileTexture() : loader.load(url);
      map.colorSpace = SRGBColorSpace;
      map.wrapS = RepeatWrapping;
      map.wrapT = RepeatWrapping;
      map.anisotropy = 4;
      textures.set(file ?? s, map);
      owned.push(map);
    }
    // Mêmes réglages que le ciel de la place (normales, couleurs RGBA, sans brouillard): même programme.
    const m = new MeshBasicMaterial({
      name: `dt_arriere_${s}`,
      map,
      vertexColors: true,
      fog: false,
    });
    materials.set(s, m);
    owned.push(m);
    return m;
  };

  const meshes = (b: Builder, name: string): Group => {
    const g = new Group();
    g.name = name;
    for (const [s, l] of b.layers) {
      const geo = new BufferGeometry();
      geo.setAttribute('position', new Float32BufferAttribute(l.pos, 3));
      geo.setAttribute('normal', new Float32BufferAttribute(l.nrm, 3));
      geo.setAttribute('uv', new Float32BufferAttribute(l.uv, 2));
      geo.setAttribute('color', new Float32BufferAttribute(l.col, 4));
      geo.setIndex(l.idx);
      geo.computeBoundingSphere();
      owned.push(geo);
      const mesh = new Mesh(geo, material(s));
      mesh.name = `${name}_${s}`;
      g.add(mesh);
    }
    return g;
  };

  const root = new Group();
  root.name = 'reserve_et_cour';
  root.add(meshes(always, 'arriere'));
  const fondClosed = meshes(closedOnly, 'arriere_fond_ferme');
  root.add(fondClosed);
  // Ampoule allumée: le matériau des abat-jour cuits (aucun programme de plus).
  const bulbGeo = new SphereGeometry(0.045, 12, 8);
  bulbGeo.translate(LAMP.x, LAMP.y + 0.02, LAMP.z);
  const bulbMat = new MeshBasicMaterial({ name: 'dt_arriere_ampoule', color: '#ffe6be' });
  const bulb = new Mesh(bulbGeo, bulbMat);
  bulb.name = 'arriere_ampoule';
  root.add(bulb);
  owned.push(bulbGeo, bulbMat);
  parent.add(root);

  return {
    setFondOpen(open) {
      fondClosed.visible = !open;
    },
    dispose() {
      root.removeFromParent();
      for (const d of owned) d.dispose();
    },
  };
}
