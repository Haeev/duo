/**
 * Petit atelier de formes simples pour les substituts et le décor procédural:
 * chaque pièce pointe une case de la texture palette (comme les modèles de
 * l'artiste), en facettes (normales plates), puis tout est fusionné en une
 * seule géométrie, donc un seul appel de dessin par objet.
 */
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  Euler,
  IcosahedronGeometry,
  Matrix4,
  Quaternion,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { paletteUv, type PaletteCell } from './palette';

/** Couleur d'une pièce: une case, ou une case par orientation de face. */
export type Paint = PaletteCell | { top: PaletteCell; side: PaletteCell; bottom?: PaletteCell };

export type Triple = readonly [number, number, number];

export interface PartOptions {
  /** Rotation en degrés (ordre XYZ). */
  rotation?: Triple;
  /** Échelle appliquée avant la rotation. */
  scale?: Triple;
  /** Pose la pièce sur `at` (sa base au lieu de son centre). */
  base?: boolean;
}

/** Au-delà de ce cosinus, une face regarde vers le haut (ou le bas). */
const FACE_UP_THRESHOLD = 0.6;
const DEG = Math.PI / 180;
const DEFAULT_SEGMENTS = 8;

const tmpEuler = new Euler();
const tmpQuat = new Quaternion();
const tmpPos = new Vector3();
const tmpScale = new Vector3();

export class ShapeBuilder {
  private readonly parts: BufferGeometry[] = [];

  box(size: Triple, at: Triple, paint: Paint, options: PartOptions = {}): this {
    const geometry = new BoxGeometry(size[0], size[1], size[2]);
    return this.add(geometry, paint, at, options, size[1]);
  }

  cylinder(
    radiusTop: number,
    radiusBottom: number,
    height: number,
    at: Triple,
    paint: Paint,
    options: PartOptions & { segments?: number } = {},
  ): this {
    const geometry = new CylinderGeometry(
      radiusTop,
      radiusBottom,
      height,
      options.segments ?? DEFAULT_SEGMENTS,
    );
    return this.add(geometry, paint, at, options, height);
  }

  cone(
    radius: number,
    height: number,
    at: Triple,
    paint: Paint,
    options: PartOptions & { segments?: number; open?: boolean } = {},
  ): this {
    // `open`: sans le disque du dessous (brins d'herbe posés au sol: jamais vu, des triangles en moins).
    const geometry = new ConeGeometry(radius, height, options.segments ?? DEFAULT_SEGMENTS, 1, options.open === true);
    return this.add(geometry, paint, at, options, height);
  }

  /** Boule à facettes (icosaèdre), pour les feuillages et les têtes. */
  ball(
    radius: number,
    at: Triple,
    paint: Paint,
    options: PartOptions & { detail?: number } = {},
  ): this {
    const geometry = new IcosahedronGeometry(radius, options.detail ?? 0);
    return this.add(geometry, paint, at, options, 2 * radius);
  }

  /** Bosse ronde à douze faces (feuillage de chêne, laitue). */
  blob(radius: number, at: Triple, paint: Paint, options: PartOptions = {}): this {
    const geometry = new DodecahedronGeometry(radius, 0);
    return this.add(geometry, paint, at, options, 2 * radius);
  }

  /** Ajoute une géométrie quelconque (elle est absorbée et libérée à la fusion). */
  add(
    geometry: BufferGeometry,
    paint: Paint,
    at: Triple,
    options: PartOptions = {},
    height = 0,
  ): this {
    const flat = geometry.index === null ? geometry : geometry.toNonIndexed();
    if (flat !== geometry) {
      geometry.dispose();
    }
    flat.deleteAttribute('uv');
    flat.computeVertexNormals();
    const scale = options.scale ?? [1, 1, 1];
    const rotation = options.rotation ?? [0, 0, 0];
    const lift = options.base === true ? (height * scale[1]) / 2 : 0;
    tmpEuler.set(rotation[0] * DEG, rotation[1] * DEG, rotation[2] * DEG);
    tmpQuat.setFromEuler(tmpEuler);
    tmpPos.set(at[0], at[1] + lift, at[2]);
    tmpScale.set(scale[0], scale[1], scale[2]);
    flat.applyMatrix4(new Matrix4().compose(tmpPos, tmpQuat, tmpScale));
    paintGeometry(flat, paint);
    this.parts.push(flat);
    return this;
  }

  get isEmpty(): boolean {
    return this.parts.length === 0;
  }

  /** Fusionne toutes les pièces. Le constructeur est vide ensuite. */
  build(): BufferGeometry {
    const merged = this.parts.length === 1 ? this.parts[0] : mergeGeometries(this.parts, false);
    for (const part of this.parts) {
      if (part !== merged) {
        part.dispose();
      }
    }
    this.parts.length = 0;
    if (!merged) {
      return new BufferGeometry();
    }
    merged.computeBoundingBox();
    merged.computeBoundingSphere();
    return merged;
  }
}

/** Donne à chaque triangle l'UV de la case voulue, selon l'orientation de sa face. */
export function paintGeometry(geometry: BufferGeometry, paint: Paint): void {
  const normals = geometry.getAttribute('normal');
  const count = geometry.getAttribute('position').count;
  const uvs = new Float32Array(count * 2);
  const single = typeof paint === 'string' ? paletteUv(paint) : null;
  for (let vertex = 0; vertex < count; vertex += 3) {
    let uv = single;
    if (uv === null && typeof paint !== 'string') {
      const ny = normals.getY(vertex);
      const cell =
        ny > FACE_UP_THRESHOLD
          ? paint.top
          : ny < -FACE_UP_THRESHOLD
            ? (paint.bottom ?? paint.side)
            : paint.side;
      uv = paletteUv(cell);
    }
    if (uv === null) {
      continue;
    }
    for (let corner = 0; corner < 3; corner += 1) {
      uvs[(vertex + corner) * 2] = uv.u;
      uvs[(vertex + corner) * 2 + 1] = uv.v;
    }
  }
  geometry.setAttribute('uv', new BufferAttribute(uvs, 2));
}

/** Géométrie vide (substitut d'un objet sans forme). */
export function emptyGeometry(): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(0), 3));
  return geometry;
}
