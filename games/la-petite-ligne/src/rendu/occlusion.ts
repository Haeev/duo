/**
 * Occlusion cuite du sol (technical artist, tour 8): une carte vue de dessus,
 * calculée au chargement, qui dit combien le ciel est caché au ras du sol par
 * ce qui se dresse tout près (pied des bâtiments, des meubles et des rochers,
 * houppier des arbres). Le shader des surfaces la lit pour assombrir le sol et
 * le teinter (herbe plus profonde sous les arbres), sans SSAO ni passe de plus.
 *
 * Canaux: occlusion (R, 0 à 1) et hauteur du sol (G, codée comme le champ du
 * terrain), qui sert à assombrir le pied des faces verticales; cases de pavés
 * de la carte (B) et, parmi elles, celles qui sont vraiment pavées (A: la place
 * n'est pavée que là où un bourg en poserait, terre battue ailleurs).
 *
 * Tout est déterministe (mêmes données, même carte chez les deux joueurs).
 */
import {
  DataTexture,
  InstancedMesh,
  LinearFilter,
  Matrix4,
  NoColorSpace,
  RGBAFormat,
  UnsignedByteType,
  Vector3,
  Vector4,
  type Object3D,
} from 'three';
import type { GameMap, MapProp } from '../etat/carte';
import { groundAt, inRect } from '../etat/carte';
import { FIELD_HEIGHT_MIN, FIELD_HEIGHT_RANGE } from './champs';
import { RENDER_SETTINGS } from './reglages';
import { AMBIANCE_SETTINGS } from './reglages-ambiance';
import type { Terrain } from './terrain';

const BYTE = 255;
const RGBA = 4;
const HALF = 0.5;
/** Deux flous en boîte successifs: une pénombre en cloche (presque gaussienne). */
const BLUR_PASSES = 2;
/** Préfixe des maillages instanciés de la forêt du pourtour (`vegetation.ts`). */
const FOREST_PREFIX = 'foret ';

/** Une forme qui cache le ciel au sol: disque (centre, rayon) ou rectangle, et son poids (0 à 1). */
export type Occluder =
  | { kind: 'disc'; x: number; y: number; radius: number; weight: number }
  | { kind: 'rect'; x: number; y: number; w: number; h: number; weight: number };

/** Grille de l'occlusion: origine (m) du premier texel, taille, texels par mètre. */
export interface OcclusionGrid {
  originX: number;
  originY: number;
  width: number;
  height: number;
  texelsPerMeter: number;
}

type LookSettings = (typeof AMBIANCE_SETTINGS)['look'];
type DiscName = keyof LookSettings['occluders']['discs'];

/** Disque du modèle s'il en a un (`tree_oak` vaut aussi pour `tree_oak_02`). */
function discOf(model: string): { radius: number; weight: number } | null {
  const discs = AMBIANCE_SETTINGS.look.occluders.discs;
  for (const name of Object.keys(discs) as DiscName[]) {
    if (model === name || model.startsWith(`${name}_`)) {
      return discs[name];
    }
  }
  return null;
}

/** Ce qui fait de l'ombre au sol pour un objet de la carte (aucune forme pour les sols et les clôtures). */
export function occludersOfProp(prop: MapProp): Occluder[] {
  const o = AMBIANCE_SETTINGS.look.occluders;
  const disc = discOf(prop.model);
  const out: Occluder[] = [];
  if (disc !== null) {
    out.push({ kind: 'disc', x: prop.pos.x, y: prop.pos.y, ...disc });
    if (prop.category === 'arbre') {
      out.push({ kind: 'disc', x: prop.pos.x, y: prop.pos.y, ...o.canopy });
    }
    return out;
  }
  if (prop.rect === null) {
    return out;
  }
  const weight =
    prop.category === 'batiment'
      ? o.building.weight
      : prop.category === 'equipement'
        ? o.equipment.weight
        : prop.category === 'mobilier'
          ? o.furniture.weight
          : 0;
  if (weight > 0) {
    out.push({ kind: 'rect', ...prop.rect, weight });
  }
  return out;
}

/** Pose les formes dans une grille (valeur la plus forte là où elles se recouvrent). */
export function rasterizeOccluders(grid: OcclusionGrid, occluders: readonly Occluder[]): Float32Array {
  const { width, height, texelsPerMeter: k } = grid;
  const mask = new Float32Array(width * height);
  const toPx = (x: number): number => (x - grid.originX) * k;
  const toPy = (y: number): number => (y - grid.originY) * k;
  for (const shape of occluders) {
    const minX = shape.kind === 'disc' ? shape.x - shape.radius : shape.x;
    const maxX = shape.kind === 'disc' ? shape.x + shape.radius : shape.x + shape.w;
    const minY = shape.kind === 'disc' ? shape.y - shape.radius : shape.y;
    const maxY = shape.kind === 'disc' ? shape.y + shape.radius : shape.y + shape.h;
    const px0 = Math.max(0, Math.floor(toPx(minX)));
    const px1 = Math.min(width - 1, Math.ceil(toPx(maxX)));
    const py0 = Math.max(0, Math.floor(toPy(minY)));
    const py1 = Math.min(height - 1, Math.ceil(toPy(maxY)));
    for (let py = py0; py <= py1; py += 1) {
      const y = grid.originY + (py + HALF) / k;
      for (let px = px0; px <= px1; px += 1) {
        const x = grid.originX + (px + HALF) / k;
        const inside =
          shape.kind === 'disc'
            ? (x - shape.x) ** 2 + (y - shape.y) ** 2 <= shape.radius ** 2
            : x >= minX && x < maxX && y >= minY && y < maxY;
        const i = py * width + px;
        if (inside && shape.weight > (mask[i] ?? 0)) {
          mask[i] = shape.weight;
        }
      }
    }
  }
  return mask;
}

/** Flou en boîte séparable (rayon en texels), bords prolongés. */
export function boxBlur(values: Float32Array, width: number, height: number, radius: number): Float32Array {
  const r = Math.max(0, Math.round(radius));
  if (r === 0) {
    return values.slice();
  }
  const span = 2 * r + 1;
  const temp = new Float32Array(values.length);
  const out = new Float32Array(values.length);
  const at = (array: Float32Array, i: number): number => array[i] ?? 0;
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    let sum = 0;
    for (let d = -r; d <= r; d += 1) {
      sum += at(values, row + Math.min(width - 1, Math.max(0, d)));
    }
    for (let x = 0; x < width; x += 1) {
      temp[row + x] = sum / span;
      sum += at(values, row + Math.min(width - 1, x + r + 1)) - at(values, row + Math.max(0, x - r));
    }
  }
  for (let x = 0; x < width; x += 1) {
    let sum = 0;
    for (let d = -r; d <= r; d += 1) {
      sum += at(temp, Math.min(height - 1, Math.max(0, d)) * width + x);
    }
    for (let y = 0; y < height; y += 1) {
      out[y * width + x] = sum / span;
      sum +=
        at(temp, Math.min(height - 1, y + r + 1) * width + x) -
        at(temp, Math.max(0, y - r) * width + x);
    }
  }
  return out;
}

/**
 * Occlusion d'un masque: pénombre floue autour des formes, qui vaut à peu près
 * le poids de la forme contre elle et s'éteint à `radius` m.
 */
export function occlusionFromMask(mask: Float32Array, grid: OcclusionGrid, radius: number): Float32Array {
  // Deux passes de rayon r / 2 couvrent à peu près le rayon voulu (cloche).
  const texels = (radius * grid.texelsPerMeter) / BLUR_PASSES;
  let blurred = mask;
  for (let pass = 0; pass < BLUR_PASSES; pass += 1) {
    blurred = boxBlur(blurred, grid.width, grid.height, texels);
  }
  const out = new Float32Array(mask.length);
  for (let i = 0; i < mask.length; i += 1) {
    // Contre la forme, le flou vaut la moitié du poids: on le ramène au poids entier.
    out[i] = Math.min(1, Math.max(mask[i] ?? 0, (blurred[i] ?? 0) * 2));
  }
  return out;
}

/** Arbres de la forêt du pourtour (maillages instanciés de `vegetation.ts`): leur pied. */
function forestTrees(scene: Object3D): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  const matrix = new Matrix4();
  const position = new Vector3();
  scene.traverse((object) => {
    if (!(object instanceof InstancedMesh) || !object.name.startsWith(FOREST_PREFIX)) {
      return;
    }
    object.updateWorldMatrix(true, false);
    for (let i = 0; i < object.count; i += 1) {
      object.getMatrixAt(i, matrix);
      position.setFromMatrixPosition(matrix).applyMatrix4(object.matrixWorld);
      out.push({ x: position.x, y: position.z });
    }
  });
  return out;
}

/** Distance du point (x, y) au segment de a à b. */
function segmentDistance(
  x: number,
  y: number,
  a: readonly [number, number],
  b: readonly [number, number],
): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length2 = dx * dx + dy * dy;
  const t = length2 > 0 ? Math.min(1, Math.max(0, ((x - a[0]) * dx + (y - a[1]) * dy) / length2)) : 0;
  return Math.hypot(x - (a[0] + t * dx), y - (a[1] + t * dy));
}

/**
 * Où sont les pavés sur une case de pavés de la carte (`terrain.square`): dans
 * la place, seulement dans ses zones pavées (puits, devant l'épicerie, chemins
 * qui les relient); hors de la place (rue de la Gare, quai), partout.
 */
export function squarePaving(map: GameMap): (x: number, y: number) => boolean {
  const square = RENDER_SETTINGS.terrain.square;
  const shapes = square.paved.flatMap((shape) => {
    if (shape.kind === 'band') {
      return [{ a: shape.a, b: shape.b, half: shape.half }];
    }
    const prop = map.props.find((candidate) => candidate.model === shape.model);
    if (prop === undefined) {
      return [];
    }
    const centre: [number, number] = [prop.pos.x, prop.pos.y];
    return [{ a: centre, b: centre, half: shape.radius }];
  });
  return (x: number, y: number): boolean =>
    !inRect(square.area, x, y) || shapes.some((s) => segmentDistance(x, y, s.a, s.b) <= s.half);
}

/** Ce que les shaders doivent savoir pour lire l'occlusion. */
export interface OcclusionField {
  texture: DataTexture;
  /** Origine (x, z) et inverse de la taille en mètres, pour `uv = (xz - origine) * inverse`. */
  rect: Vector4;
}

/** Carte d'occlusion et de hauteur du sol de toute la carte, bande prolongée comprise. */
export function createOcclusionField(map: GameMap, terrain: Terrain, scene: Object3D): OcclusionField {
  const look = AMBIANCE_SETTINGS.look;
  const ext = RENDER_SETTINGS.terrain.extension;
  const k = look.occlusionTexelsPerMeter;
  const grid: OcclusionGrid = {
    originX: map.originX - ext,
    originY: map.originY - ext,
    width: (map.width + 2 * ext) * k,
    height: (map.height + 2 * ext) * k,
    texelsPerMeter: k,
  };
  const occluders: Occluder[] = map.props.flatMap((prop) => occludersOfProp(prop));
  const trunk = look.occluders.discs;
  // Arbres à couper: le pied seulement (une souche reste quand ils tombent, pas le houppier).
  for (const tree of map.trees) {
    const disc = tree.kind === 'oak' ? trunk.tree_oak : trunk.tree_fir;
    occluders.push({ kind: 'disc', x: tree.pos.x, y: tree.pos.y, ...disc });
  }
  const forest = look.occluders.forestCanopy;
  for (const tree of forestTrees(scene)) {
    occluders.push({ kind: 'disc', x: tree.x, y: tree.y, ...forest });
  }
  const occlusion = occlusionFromMask(
    rasterizeOccluders(grid, occluders),
    grid,
    look.occlusionRadius,
  );
  const paved = squarePaving(map);
  const data = new Uint8Array(grid.width * grid.height * RGBA);
  for (let py = 0; py < grid.height; py += 1) {
    const y = grid.originY + (py + HALF) / k;
    for (let px = 0; px < grid.width; px += 1) {
      const x = grid.originX + (px + HALF) / k;
      const i = py * grid.width + px;
      const ground = terrain.heightAt(x, y);
      data[i * RGBA] = Math.round((occlusion[i] ?? 0) * BYTE);
      data[i * RGBA + 1] = Math.round(
        Math.min(1, Math.max(0, (ground - FIELD_HEIGHT_MIN) / FIELD_HEIGHT_RANGE)) * BYTE,
      );
      const cx = Math.floor(x);
      const cy = Math.floor(y);
      const stone = groundAt(map, cx, cy) === 'stone';
      data[i * RGBA + 2] = stone ? BYTE : 0;
      data[i * RGBA + 3] = stone && paved(x, y) ? BYTE : 0;
    }
  }
  const texture = new DataTexture(data, grid.width, grid.height, RGBAFormat, UnsignedByteType);
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = NoColorSpace;
  texture.needsUpdate = true;
  const metersX = grid.width / k;
  const metersY = grid.height / k;
  return { texture, rect: new Vector4(grid.originX, grid.originY, 1 / metersX, 1 / metersY) };
}
