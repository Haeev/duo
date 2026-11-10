/**
 * Essai « encre »: le terrain. Le sol n'est pas un plan: une fonction de hauteur, écrite en
 * données (`TerrainSpec`), donne les bosses du pré, le chemin creusé de quelques centimètres avec
 * ses talus, les ornières de la route, le fossé qui draine la voie, la terre remontée contre le
 * dos du quai et le sol relevé au pied des murs (leur pied s'y enfonce). La même fonction sert
 * trois fois: le maillage du sol, la carte des pentes lue par le nuanceur (c'est elle qui pose les
 * tons clairs et sombres de l'herbe, donc ils suivent le vrai relief et l'heure), et la hauteur
 * sous chaque objet posé, chaque brin semé et chaque pas des personnages.
 */
import * as THREE from 'three';

import type { GroundPlan } from './textures';

export interface Rect {
  readonly x0: number;
  readonly z0: number;
  readonly x1: number;
  readonly z1: number;
}

export interface TerrainSpec {
  readonly plan: GroundPlan;
  /** Amplitude des grandes bosses du pré et des petites, en mètres. */
  readonly rolling: number;
  readonly bumps: number;
  /** Emprises tenues à un niveau (voie, bâtiments, dos du quai), raccordées sur `margin` mètres. */
  readonly flats: readonly (Rect & { readonly level: number; readonly margin: number })[];
  /** Creux des chemins, en mètres, et largeur du talus qui remonte à l'herbe. */
  readonly pathDepth: number;
  readonly bank: number;
  /** Ornières: numéro du chemin, écart à son axe, profondeur. */
  readonly ruts: readonly {
    readonly path: number;
    readonly offset: number;
    readonly depth: number;
  }[];
  /** Fossés le long de x: axe, demi-largeur, profondeur, et les passages comblés (traversée). */
  readonly ditches: readonly {
    readonly z: number;
    readonly x0: number;
    readonly x1: number;
    readonly halfWidth: number;
    readonly depth: number;
    readonly gaps: readonly (readonly [number, number])[];
  }[];
  /** Maillage: pas le long de x, et bande de z où il est serré (là où sont chemins et fossé). */
  readonly stepX: number;
  readonly fineZ: readonly [number, number];
  readonly stepZ: number;
}

export type HeightAt = (x: number, z: number) => number;

function hash(a: number, b: number, seed: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7 + seed * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Bruit de valeurs lisse, de -1 à 1. */
function smoothNoise(x: number, z: number, seed: number): number {
  const fx = Math.floor(x);
  const fz = Math.floor(z);
  const tx = x - fx;
  const tz = z - fz;
  const sx = tx * tx * tx * (tx * (tx * 6 - 15) + 10);
  const sz = tz * tz * tz * (tz * (tz * 6 - 15) + 10);
  const a = hash(fx, fz, seed);
  const b = hash(fx + 1, fz, seed);
  const c = hash(fx, fz + 1, seed);
  const d = hash(fx + 1, fz + 1, seed);
  return (a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz) * 2 - 1;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Distance au bord d'un chemin (négative dessus) et écart signé à son axe. */
function pathOffset(
  path: GroundPlan['paths'][number],
  x: number,
  z: number,
): { distance: number; lateral: number } {
  let best = Infinity;
  let lateral = 0;
  for (let i = 0; i < path.points.length - 1; i += 1) {
    const a = path.points[i];
    const b = path.points[i + 1];
    if (!a || !b) continue;
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
    const ox = x - a[0] - dx * t;
    const oz = z - a[1] - dz * t;
    const distance = Math.hypot(ox, oz);
    if (distance < best) {
      best = distance;
      lateral = Math.sign(dx * oz - dz * ox) * distance;
    }
  }
  return { distance: best - path.width / 2, lateral };
}

/** Distance signée au bord du chemin le plus proche: négative sur la terre, positive dans l'herbe. */
export function pathDistance(plan: GroundPlan, x: number, z: number): number {
  let best = Infinity;
  for (const path of plan.paths) best = Math.min(best, pathOffset(path, x, z).distance);
  return best;
}

/** Distance au dehors d'un rectangle (0 dedans). */
export function outside(rect: Rect, x: number, z: number): number {
  return Math.hypot(Math.max(rect.x0 - x, 0, x - rect.x1), Math.max(rect.z0 - z, 0, z - rect.z1));
}

export function heightFunction(spec: TerrainSpec): HeightAt {
  return (x, z) => {
    let h =
      smoothNoise(x / 13, z / 13, 3) * spec.rolling +
      smoothNoise(x / 3.7 + 9.1, z / 3.7 + 4.3, 5) * spec.bumps;
    for (const flat of spec.flats) {
      const w = smoothstep(0, flat.margin, outside(flat, x, z));
      h = flat.level + (h - flat.level) * w;
    }
    spec.plan.paths.forEach((path, index) => {
      const { distance, lateral } = pathOffset(path, x, z);
      if (distance > spec.bank) return;
      h -= spec.pathDepth * (1 - smoothstep(-spec.bank * 0.5, spec.bank * 0.5, distance));
      for (const rut of spec.ruts) {
        if (rut.path !== index) continue;
        const off = (Math.abs(lateral) - rut.offset) / 0.16;
        // L'ornière se creuse et se comble le long de la route: les roues ne passent pas partout.
        const worn = 0.55 + 0.45 * smoothNoise(x / 5.5, z / 5.5, 11 + Math.sign(lateral));
        if (Math.abs(off) < 1) h -= rut.depth * worn * (0.5 + 0.5 * Math.cos(off * Math.PI));
      }
    });
    for (const ditch of spec.ditches) {
      const across = Math.abs(z - ditch.z) / ditch.halfWidth;
      if (across >= 1 || x < ditch.x0 || x > ditch.x1) continue;
      let open = 1;
      for (const [g0, g1] of ditch.gaps) {
        open = Math.min(open, 1 - smoothstep(g0 - 0.9, g0, x) * (1 - smoothstep(g1, g1 + 0.9, x)));
      }
      h -= ditch.depth * open * (0.5 + 0.5 * Math.cos(across * Math.PI));
    }
    return h;
  };
}

/** Maillage du sol: serré en z là où courent chemins, fossé et talus, lâche ailleurs. */
export function terrainGeometry(spec: TerrainSpec, height: HeightAt): THREE.BufferGeometry {
  const [ox, oz] = spec.plan.origin;
  const [sx, sz] = spec.plan.size;
  const xs: number[] = [];
  for (let x = ox; x < ox + sx - 1e-6; x += spec.stepX) xs.push(x);
  xs.push(ox + sx);
  const zs: number[] = [];
  let z = oz;
  while (z < oz + sz - 1e-6) {
    zs.push(z);
    z += z >= spec.fineZ[0] && z < spec.fineZ[1] ? spec.stepZ : 0.8;
  }
  zs.push(oz + sz);
  const positions = new Float32Array(xs.length * zs.length * 3);
  zs.forEach((pz, j) => {
    xs.forEach((px, i) => {
      const k = (j * xs.length + i) * 3;
      positions[k] = px;
      positions[k + 1] = height(px, pz);
      positions[k + 2] = pz;
    });
  });
  const indices: number[] = [];
  for (let j = 0; j < zs.length - 1; j += 1) {
    for (let i = 0; i < xs.length - 1; i += 1) {
      const a = j * xs.length + i;
      const b = a + 1;
      const c = a + xs.length;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

const MASK_SCALE = 8;

/**
 * Carte du sol à 8 points par mètre: R = terre battue, G = ballast (flous exprès: le nuanceur en
 * tire un bord franc et tremblé), B et A = la pente du terrain en x et en z (128 = à plat,
 * plus ou moins 127 pour une pente de 1).
 */
export function createGroundMap(spec: TerrainSpec, height: HeightAt): THREE.DataTexture {
  const plan = spec.plan;
  const width = Math.round(plan.size[0] * MASK_SCALE);
  const depth = Math.round(plan.size[1] * MASK_SCALE);
  const draw = (paint: (ctx: CanvasRenderingContext2D) => void): Uint8ClampedArray => {
    const sharp = document.createElement('canvas');
    sharp.width = width;
    sharp.height = depth;
    const ctx = sharp.getContext('2d');
    const softCanvas = document.createElement('canvas');
    softCanvas.width = width;
    softCanvas.height = depth;
    const soft = softCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx || !soft) throw new Error('Canevas 2D indisponible');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, depth);
    ctx.strokeStyle = '#fff';
    ctx.fillStyle = '#fff';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setTransform(
      MASK_SCALE,
      0,
      0,
      MASK_SCALE,
      -plan.origin[0] * MASK_SCALE,
      -plan.origin[1] * MASK_SCALE,
    );
    paint(ctx);
    soft.filter = 'blur(3px)';
    soft.drawImage(sharp, 0, 0);
    return soft.getImageData(0, 0, width, depth).data;
  };
  const dirt = draw((ctx) => {
    for (const path of plan.paths) {
      ctx.lineWidth = path.width;
      ctx.beginPath();
      path.points.forEach(([x, z], i) => {
        if (i === 0) ctx.moveTo(x, z);
        else ctx.lineTo(x, z);
      });
      ctx.stroke();
    }
  });
  const ballast = draw((ctx) => {
    for (const band of plan.ballast) ctx.fillRect(band.x, band.z, band.w, band.d);
  });
  const data = new Uint8Array(width * depth * 4);
  const e = 0.5 / MASK_SCALE;
  for (let j = 0; j < depth; j += 1) {
    for (let i = 0; i < width; i += 1) {
      const x = plan.origin[0] + (i + 0.5) / MASK_SCALE;
      const z = plan.origin[1] + (j + 0.5) / MASK_SCALE;
      const k = (j * width + i) * 4;
      const slopeX = (height(x + e, z) - height(x - e, z)) / (2 * e);
      const slopeZ = (height(x, z + e) - height(x, z - e)) / (2 * e);
      data[k] = dirt[k] ?? 0;
      data[k + 1] = ballast[k] ?? 0;
      data[k + 2] = Math.max(0, Math.min(255, Math.round(128 + slopeX * 127)));
      data[k + 3] = Math.max(0, Math.min(255, Math.round(128 + slopeZ * 127)));
    }
  }
  const texture = new THREE.DataTexture(data, width, depth, THREE.RGBAFormat);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
