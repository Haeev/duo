/**
 * Lit de l'Aubrune (technical artist, tour 8): la forme visible des berges et
 * du gué, calculée au chargement d'après la grille de la carte, qui ne change
 * pas (bible, 8.7). Sur une grille fine (`texelsPerMeter`), on cherche:
 *
 * - la hauteur du lit: la berge descend en pente douce et continue sous l'eau,
 *   et la ligne d'eau (là où le lit passe sous la surface) suit une courbe
 *   irrégulière au lieu du bord des cases. Elle reste dans les cases d'eau (les
 *   cases de berge, où l'on marche, restent au sec); les angles des anses
 *   s'arrondissent (distance signée floutée), et un bruit doux fait onduler la
 *   rive;
 * - le gué: un haut-fond de galets, 8 cm sous la surface, qui retombe en pente
 *   vers les fosses de part et d'autre;
 * - le sable des rives: le bord entre le sable et l'herbe ondule aussi;
 * - le radier: la part du courant vif sur le gué et juste à côté.
 *
 * La géométrie du lit (`terrain.ts`) lit la hauteur aux nœuds; les shaders
 * lisent une texture de données (hauteur avec les pierres du gué, courant vif,
 * sable), une seule pour le sol et pour l'eau. Tout est déterministe.
 */
import { DataTexture, LinearFilter, NoColorSpace, RGBAFormat, UnsignedByteType, Vector4 } from 'three';
import { valueNoise } from './bruit';
import { boxBlur } from './occlusion';
import { RENDER_SETTINGS } from './reglages';

const SETTINGS = RENDER_SETTINGS.terrain;
const RIVER = SETTINGS.river;
const BYTE = 255;
const RGBA = 4;
const SEED_SHORE = 41;
const SEED_SAND = 42;
const SEED_BED = 43;
/** Pente (m par m) du coussin d'eau autour d'une pierre du gué, dans la texture de l'eau. */
const STONE_CUSHION_SLOPE = 0.25;
/** Largeur du coussin (m); au-delà, il retombe vite (les remous restent serrés autour de la pierre). */
const STONE_CUSHION = 0.2;
const STONE_CUSHION_DROP = 1.2;
/** Passes du flou des distances signées (deux boîtes: une cloche). */
const BLUR_PASSES = 2;
/** Le sable le long d'un chemin est plein dès ce rapport à la distance au bord (m): bord net, coin arrondi. */
const PATH_SAND_GAIN = 8;
/** Canal A de la texture: présent partout (> 0); la moitié marque le côté d'un chemin (`pathSide`). */
const PATH_SIDE_ALPHA = 128;
/** Hauteurs codées dans le canal R de la texture: de `BED_MIN` à `BED_MIN + BED_RANGE` (m). */
export const RIVER_BED_MIN = -0.5;
export const RIVER_BED_RANGE = 0.75;
/** Distance signée du sable codée dans le canal B: de -`SAND_RANGE` à +`SAND_RANGE` (m). */
export const RIVER_SAND_RANGE = 0.75;

/**
 * Ce que le lit doit savoir d'une case (bande prolongée comprise). `path`: terre ferme comme
 * `land` (hauteur, ligne d'eau), mais le sable de la grève va jusqu'à elle (R22).
 */
export type RiverCell = 'water' | 'ford' | 'bank' | 'land' | 'path';

/** Une pierre qui affleure (gué): elle crève la surface, le courant s'ouvre autour d'elle. */
export interface RiverStone {
  x: number;
  y: number;
  radius: number;
}

export interface RiverField {
  /** Premier nœud (m), pas entre deux nœuds (m), nombre de nœuds. */
  originX: number;
  originY: number;
  step: number;
  width: number;
  height: number;
  /** Hauteur du lit aux nœuds (m), pierres non comprises. */
  bed: Float32Array;
  /** Distance signée au bord du sable (m, positive dans le sable). */
  sand: Float32Array;
  /** Part du courant vif (gué). */
  riffle: Float32Array;
  /**
   * Nœuds loin de toute herbe (le long d'un chemin, R22): là où le bord du sable recule (coin
   * arrondi), c'est le chemin qui paraît, pas l'herbe (canal A de la texture).
   */
  pathSide: Uint8Array;
  /** Hauteur du lit au point (x, y), interpolée entre les nœuds; `null` hors de la grille. */
  bedAt(x: number, y: number): number | null;
  /** Texture pour les shaders (R: lit et pierres, G: courant vif, B: sable); voir `riverTexture`. */
  texture: DataTexture | null;
  /** Origine (x, z) du premier texel et inverse de la taille (m), pour `uv = (xz - origine) * inverse`. */
  rect: Vector4;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Transformée en distance exacte d'une ligne (Felzenszwalb et Huttenlocher):
 * `f` vaut 0 sur les points de départ, l'infini ailleurs; renvoie le carré de
 * la distance (en pas de grille).
 */
function distanceLine(f: Float64Array, n: number): Float64Array {
  const d = new Float64Array(n);
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);
  let k = 0;
  let first = -1;
  for (let q = 0; q < n; q += 1) {
    if (Number.isFinite(f[q] ?? Number.POSITIVE_INFINITY)) {
      first = q;
      break;
    }
  }
  if (first < 0) {
    return d.fill(Number.POSITIVE_INFINITY);
  }
  v[0] = first;
  z[0] = Number.NEGATIVE_INFINITY;
  z[1] = Number.POSITIVE_INFINITY;
  for (let q = first + 1; q < n; q += 1) {
    const fq = f[q] ?? Number.POSITIVE_INFINITY;
    if (!Number.isFinite(fq)) {
      continue;
    }
    // z[0] vaut moins l'infini: la boucle s'arrête toujours à k >= 0.
    let p = v[k] ?? 0;
    let s = (fq + q * q - ((f[p] ?? 0) + p * p)) / (2 * q - 2 * p);
    while (s <= (z[k] ?? Number.NEGATIVE_INFINITY)) {
      k -= 1;
      p = v[k] ?? 0;
      s = (fq + q * q - ((f[p] ?? 0) + p * p)) / (2 * q - 2 * p);
    }
    k += 1;
    v[k] = q;
    z[k] = s;
    z[k + 1] = Number.POSITIVE_INFINITY;
  }
  k = 0;
  for (let q = 0; q < n; q += 1) {
    while ((z[k + 1] ?? Number.POSITIVE_INFINITY) < q) {
      k += 1;
    }
    const p = v[k] ?? 0;
    d[q] = (q - p) * (q - p) + (f[p] ?? 0);
  }
  return d;
}

/** Distance (m) de chaque nœud au plus proche nœud marqué (`seeds`). */
export function distanceField(
  seeds: Uint8Array,
  width: number,
  height: number,
  step: number,
): Float32Array {
  const column = new Float64Array(height);
  const temp = new Float64Array(width * height);
  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      column[y] = seeds[y * width + x] === 1 ? 0 : Number.POSITIVE_INFINITY;
    }
    const d = distanceLine(column, height);
    for (let y = 0; y < height; y += 1) {
      temp[y * width + x] = d[y] ?? Number.POSITIVE_INFINITY;
    }
  }
  const out = new Float32Array(width * height);
  const row = new Float64Array(width);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      row[x] = temp[y * width + x] ?? Number.POSITIVE_INFINITY;
    }
    const d = distanceLine(row, width);
    for (let x = 0; x < width; x += 1) {
      // Pas de départ du tout: une grande distance finie (le flou en a besoin).
      const value = d[x] ?? Number.POSITIVE_INFINITY;
      out[y * width + x] = Number.isFinite(value) ? Math.sqrt(value) * step : 1e3;
    }
  }
  return out;
}

/** Distance signée (m) au bord de la région `inside`: positive dedans, négative dehors, puis floutée. */
function signedDistance(
  inside: Uint8Array,
  width: number,
  height: number,
  step: number,
  blurMeters: number,
): Float32Array {
  const outside = inside.map((v) => (v === 1 ? 0 : 1));
  const toOutside = distanceField(outside, width, height, step);
  const toInside = distanceField(inside, width, height, step);
  let sdf: Float32Array = new Float32Array(width * height);
  for (let i = 0; i < sdf.length; i += 1) {
    // Bornée: le flou ne doit pas tirer une rive vers une région lointaine.
    const value = inside[i] === 1 ? (toOutside[i] ?? 0) : -(toInside[i] ?? 0);
    sdf[i] = Math.max(-RIVER.signedClamp, Math.min(RIVER.signedClamp, value));
  }
  // Une droite reste une droite sous le flou (moyenne symétrique): seuls les angles s'arrondissent.
  const texels = blurMeters / step / BLUR_PASSES;
  for (let pass = 0; pass < BLUR_PASSES; pass += 1) {
    sdf = boxBlur(sdf, width, height, texels);
  }
  return sdf;
}

/**
 * Profil de la berge: hauteur du lit selon la distance signée `d` au bord sec
 * (m, positive dans l'eau) et la distance `shore` de la ligne d'eau. Au bord
 * (d <= 0), le dessus de la berge; à `shore`, la surface de l'eau; puis le
 * fond. Pente nulle en haut et en bas, la même de part et d'autre de la ligne
 * d'eau (pas de marche ni de replat au ras de l'eau).
 */
export function bankProfile(d: number, shore: number, top: number): number {
  const level = SETTINGS.waterSurface;
  const deep = SETTINGS.heights.water;
  if (d <= 0) {
    return top;
  }
  if (d < shore) {
    const u = d / shore;
    return top + (level - top) * u * u;
  }
  // Pentes égales à la ligne d'eau: 2 (level - top) / shore = 2 (deep - level) / run.
  const run = (shore * (deep - level)) / Math.min(level - top, -1e-3);
  const v = Math.min(1, (d - shore) / Math.max(run, 1e-3));
  return level + (deep - level) * (1 - (1 - v) * (1 - v));
}

/**
 * Lit de la rivière sur la bande de la carte qui la contient. `cellAt` dit ce
 * qu'est une case (coordonnées entières, bande prolongée comprise); `x0` à
 * `x1` et `y0` à `y1` bornent les cases à couvrir (bornes exclues en fin).
 */
export function createRiverField(
  cellAt: (cx: number, cy: number) => RiverCell,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
): RiverField {
  const k = RIVER.texelsPerMeter;
  const step = 1 / k;
  // Une case de marge autour du lit: le sable et l'herbe voisine y voient leur bord.
  const originX = x0 - 1;
  const originY = y0 - 1;
  const width = (x1 - x0 + 2) * k + 1;
  const height = (y1 - y0 + 2) * k + 1;
  const count = width * height;
  const dry = new Uint8Array(count);
  const ford = new Uint8Array(count);
  const sandy = new Uint8Array(count);
  const land = new Uint8Array(count);
  const bankNode = new Uint8Array(count);
  const grass = new Uint8Array(count);
  for (let j = 0; j < height; j += 1) {
    const y = originY + j * step;
    for (let i = 0; i < width; i += 1) {
      const x = originX + i * step;
      // Un nœud touche jusqu'à quatre cases (sur un bord ou un coin): il est sec si l'une l'est.
      const cxs = [Math.floor(x - 1e-6), Math.floor(x + 1e-6)];
      const cys = [Math.floor(y - 1e-6), Math.floor(y + 1e-6)];
      let anyDry = false;
      let anyFord = false;
      let anyBank = false;
      let anyLand = false;
      let anyGrass = false;
      for (const cy of cys) {
        for (const cx of cxs) {
          const cell = cellAt(cx, cy);
          anyDry ||= cell === 'bank' || cell === 'land' || cell === 'path';
          anyFord ||= cell === 'ford';
          anyBank ||= cell === 'bank' || cell === 'ford' || cell === 'water';
          anyLand ||= cell === 'land' || cell === 'path';
          anyGrass ||= cell === 'land';
        }
      }
      const index = j * width + i;
      dry[index] = anyDry ? 1 : 0;
      ford[index] = anyFord ? 1 : 0;
      // Sable: tout le lit (berge, gué, eau) jusqu'aux chemins; l'herbe l'arrête.
      sandy[index] = anyBank && !anyGrass ? 1 : 0;
      bankNode[index] = anyBank ? 1 : 0;
      grass[index] = anyGrass ? 1 : 0;
      land[index] = anyLand ? 1 : 0;
    }
  }
  const wet = dry.map((v) => (v === 1 ? 0 : 1));
  const shoreDistance = signedDistance(wet, width, height, step, RIVER.roundRadius);
  const sandDistance = signedDistance(sandy, width, height, step, RIVER.roundRadius);
  const toFord = distanceField(ford, width, height, step);
  const toLand = distanceField(land, width, height, step);
  const toGrass = distanceField(grass, width, height, step);
  // Loin de toute herbe (le long d'un chemin, R22), le sable ne recule pas: le bord du lit touche
  // le chemin sans liseré vert. Zone en distance signée arrondie (comme le reste du sable): un
  // angle de chemin contre la grève s'arrondit au lieu de garder le coin carré de la case (retour
  // du 2026-11-02, case 20, 36).
  const pathSide = new Uint8Array(count);
  const nearPath = new Uint8Array(count);
  for (let i = 0; i < count; i += 1) {
    pathSide[i] = (toGrass[i] ?? 0) > RIVER.sandWobble + RIVER.roundRadius ? 1 : 0;
    nearPath[i] = bankNode[i] === 1 && pathSide[i] === 1 ? 1 : 0;
  }
  const pathSand = signedDistance(nearPath, width, height, step, RIVER.roundRadius);

  const bed = new Float32Array(count);
  const sand = new Float32Array(count);
  const riffle = new Float32Array(count);
  const top = SETTINGS.heights.gravel;
  for (let j = 0; j < height; j += 1) {
    const y = originY + j * step;
    for (let i = 0; i < width; i += 1) {
      const x = originX + i * step;
      const index = j * width + i;
      // Ligne d'eau: entre `shoreMin` et `shoreMax` du bord sec, selon un bruit doux le long de la rive.
      const shore =
        RIVER.shoreMin + (RIVER.shoreMax - RIVER.shoreMin) * valueNoise(x, y, RIVER.shoreNoise, SEED_SHORE);
      // Le haut de la berge rejoint l'herbe à sa hauteur (aucune marche entre l'herbe et le sable).
      const crest = top * smoothstep(0, RIVER.crestRun, toLand[index] ?? 0);
      let h = bankProfile(shoreDistance[index] ?? 0, shore, crest);
      // Haut-fond du gué, qui retombe vers les fosses; il ne remonte jamais au-dessus de la berge.
      const fordDistance = toFord[index] ?? 1e3;
      if (fordDistance < RIVER.fordRamp) {
        const bump = (valueNoise(x, y, 0.9, SEED_BED) - 0.5) * 2 * RIVER.fordBedNoise;
        const fordBed =
          SETTINGS.fordBed + bump + (SETTINGS.heights.water - SETTINGS.fordBed) * smoothstep(0, RIVER.fordRamp, fordDistance);
        h = Math.max(h, Math.min(fordBed, crest));
      }
      bed[index] = h;
      const wobble = (valueNoise(x, y, RIVER.sandNoise, SEED_SAND) - 0.5) * 2 * RIVER.sandWobble;
      sand[index] = (sandDistance[index] ?? 0) + wobble;
      if (nearPath[index] === 1) {
        sand[index] = Math.max(sand[index] ?? 0, Math.min(RIVER_SAND_RANGE, (pathSand[index] ?? 0) * PATH_SAND_GAIN));
      }
      riffle[index] = 1 - smoothstep(0, RIVER.riffleReach, fordDistance);
    }
  }
  const bedAt = (x: number, y: number): number | null => {
    const fx = (x - originX) / step;
    const fy = (y - originY) / step;
    if (fx < 0 || fy < 0 || fx > width - 1 || fy > height - 1) {
      return null;
    }
    const i = Math.min(width - 2, Math.floor(fx));
    const j = Math.min(height - 2, Math.floor(fy));
    const tx = fx - i;
    const ty = fy - j;
    const a = bed[j * width + i] ?? 0;
    const b = bed[j * width + i + 1] ?? 0;
    const c = bed[(j + 1) * width + i] ?? 0;
    const d = bed[(j + 1) * width + i + 1] ?? 0;
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  };
  return {
    originX,
    originY,
    step,
    width,
    height,
    bed,
    sand,
    riffle,
    pathSide,
    bedAt,
    texture: null,
    // Le centre du texel i est le nœud i: origine décalée d'un demi-pas.
    rect: new Vector4(originX - step / 2, originY - step / 2, 1 / (width * step), 1 / (height * step)),
  };
}

/**
 * Texture des shaders: R, hauteur du lit avec les pierres qui affleurent (le
 * courant s'ouvre autour d'elles); G, courant vif; B, distance signée au bord
 * du sable. Filtrée (les bords se lisent entre deux nœuds).
 */
export function riverTexture(field: RiverField, stones: readonly RiverStone[]): DataTexture {
  const { width, height, step, originX, originY } = field;
  const heights = field.bed.slice();
  const stoneTop = SETTINGS.waterSurface + SETTINGS.fordStones.protrude;
  for (const stone of stones) {
    const reach = stone.radius + STONE_CUSHION + (stoneTop - SETTINGS.heights.water) / STONE_CUSHION_DROP;
    const i0 = Math.max(0, Math.floor((stone.x - reach - originX) / step));
    const i1 = Math.min(width - 1, Math.ceil((stone.x + reach - originX) / step));
    const j0 = Math.max(0, Math.floor((stone.y - reach - originY) / step));
    const j1 = Math.min(height - 1, Math.ceil((stone.y + reach - originY) / step));
    for (let j = j0; j <= j1; j += 1) {
      for (let i = i0; i <= i1; i += 1) {
        const d = Math.hypot(originX + i * step - stone.x, originY + j * step - stone.y);
        const index = j * width + i;
        // Coussin d'eau autour de la pierre: le courant s'y relève sur une vingtaine de centimètres.
        const out = Math.max(0, d - stone.radius);
        const h =
          stoneTop -
          Math.min(out, STONE_CUSHION) * STONE_CUSHION_SLOPE -
          Math.max(0, out - STONE_CUSHION) * STONE_CUSHION_DROP;
        heights[index] = Math.max(heights[index] ?? 0, h);
      }
    }
  }
  const data = new Uint8Array(width * height * RGBA);
  for (let index = 0; index < width * height; index += 1) {
    const h = ((heights[index] ?? 0) - RIVER_BED_MIN) / RIVER_BED_RANGE;
    const s = 0.5 + (field.sand[index] ?? 0) / (2 * RIVER_SAND_RANGE);
    data[index * RGBA] = Math.round(Math.min(1, Math.max(0, h)) * BYTE);
    data[index * RGBA + 1] = Math.round(Math.min(1, Math.max(0, field.riffle[index] ?? 0)) * BYTE);
    data[index * RGBA + 2] = Math.round(Math.min(1, Math.max(0, s)) * BYTE);
    data[index * RGBA + 3] = field.pathSide[index] === 1 ? PATH_SIDE_ALPHA : BYTE;
  }
  const texture = new DataTexture(data, width, height, RGBAFormat, UnsignedByteType);
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}
