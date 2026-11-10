/**
 * Essai « encre »: le semis des petits volumes. Règle « volume ou texture »: tout ce qui borde,
 * ponctue ou dépasse du sol (pierre de bordure, caillou, touffe haute, fleur) est un vrai petit
 * volume, avec son ombre et son contour; la texture du sol ne garde que le dessin à plat.
 *
 * Gabarit: un petit décor = une forme (`SHAPES`) et une ligne de densité par nature de sol
 * (`RULES`). Le semis est déterministe (même graine, même pré) et chaque forme part en un seul
 * appel de dessin instancié, quelle que soit la quantité.
 */
import * as THREE from 'three';

import { lean, TONE } from './decor';
import { at, hex, LAYER, Sculpt } from './formes';
import type { GroundPlan } from './textures';

export type Soil = 'herbe' | 'terre' | 'bord' | 'ballast';

export interface ScatterRule {
  readonly shape: string;
  readonly soil: Soil;
  /** Pièces par mètre carré de ce sol. */
  readonly density: number;
  readonly scale: readonly [number, number];
  /** Part des emplacements gardés par plaques (0: partout, 0,6: par grandes taches). */
  readonly patchy?: number;
}

/** Les formes, décrites autour de leur pied (y = 0 au sol), à l'échelle 1. */
const SHAPES: Record<string, (s: Sculpt) => void> = {
  // Pierre de bordure à demi enfoncée, arrondie par l'usure.
  'pierre-ronde': (s) => {
    s.blob(
      0.21,
      0.13,
      0.16,
      at(0, 0.035, 0),
      { color: TONE.stone, layer: LAYER.face, wobble: 0.035 },
      0,
    );
  },
  // Pierre de bordure anguleuse, posée de biais.
  'pierre-plate': (s) => {
    s.box(0.27, 0.14, 0.2, at(0, 0.03, 0, 0, 0.1, 0.06), {
      color: hex('#D2C6AC'),
      layer: LAYER.face,
      wobble: 0.05,
    });
  },
  caillou: (s) => {
    s.blob(0.08, 0.05, 0.065, at(0, 0.02, 0), { color: hex('#C9BDA6'), wobble: 0.015 }, 0);
  },
  'caillou-ballast': (s) => {
    s.box(0.13, 0.08, 0.1, at(0, 0.03, 0, 0, 0.3, 0.2), { color: hex('#CFC6B4'), wobble: 0.025 });
  },
  // Touffe haute: cinq brins effilés en éventail.
  touffe: (s) => {
    for (let i = 0; i < 5; i += 1) {
      const angle = (i / 5) * Math.PI * 2 + 0.4;
      const height = 0.3 + (i % 3) * 0.07;
      const blade = new THREE.CylinderGeometry(0.006, 0.055, height, 3, 1, true);
      s.add(
        blade,
        at(Math.cos(angle) * 0.05, height * 0.46, Math.sin(angle) * 0.05, angle, 0.38, 0),
        {
          color: i % 2 ? hex('#8FA44E') : hex('#A9BA5C'),
          wobble: 0.004,
        },
      );
    }
  },
  coquelicot: (s) => {
    s.cyl(0.012, 0.016, 0.34, 3, at(0, 0.17, 0, 0, 0.1, 0.06), {
      color: hex('#5F7340'),
      wobble: 0.002,
    });
    s.newId();
    s.blob(
      0.1,
      0.045,
      0.1,
      at(0.02, 0.36, 0.03, 0, 0.3, 0),
      { color: TONE.poppy, wobble: 0.02 },
      0,
    );
  },
  marguerite: (s) => {
    s.cyl(0.012, 0.016, 0.28, 3, at(0, 0.14, 0, 0, -0.1, 0.05), {
      color: hex('#5F7340'),
      wobble: 0.002,
    });
    s.newId();
    s.blob(
      0.09,
      0.035,
      0.09,
      at(-0.01, 0.3, 0.02, 0, 0.3, 0),
      { color: TONE.chalk, wobble: 0.015 },
      0,
    );
    s.blob(0.035, 0.035, 0.035, at(-0.01, 0.325, 0.02), { color: TONE.mustard, wobble: 0.004 }, 0);
  },
};

/** Les lignes de densité de l'essai: un nouveau petit décor s'ajoute ici, sans autre code. */
export const RULES: readonly ScatterRule[] = [
  { shape: 'pierre-ronde', soil: 'bord', density: 2.0, scale: [0.5, 1.05] },
  { shape: 'pierre-plate', soil: 'bord', density: 1.0, scale: [0.5, 0.95] },
  { shape: 'touffe', soil: 'bord', density: 1.1, scale: [0.7, 1.2] },
  { shape: 'caillou', soil: 'terre', density: 0.9, scale: [0.6, 1.6], patchy: 0.35 },
  { shape: 'touffe', soil: 'herbe', density: 0.42, scale: [0.8, 1.5], patchy: 0.55 },
  { shape: 'coquelicot', soil: 'herbe', density: 0.22, scale: [0.8, 1.2], patchy: 0.62 },
  { shape: 'marguerite', soil: 'herbe', density: 0.3, scale: [0.8, 1.2], patchy: 0.6 },
  { shape: 'pierre-ronde', soil: 'herbe', density: 0.03, scale: [0.9, 1.8] },
  { shape: 'caillou-ballast', soil: 'ballast', density: 3.2, scale: [0.7, 1.4] },
];

export interface Rect {
  readonly x0: number;
  readonly z0: number;
  readonly x1: number;
  readonly z1: number;
}

function hash(a: number, b: number, c: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Bruit lisse en plaques, pour grouper les fleurs et les touffes. */
function patches(x: number, z: number, seed: number): number {
  const fx = Math.floor(x / 3.5);
  const fz = Math.floor(z / 3.5);
  const tx = x / 3.5 - fx;
  const tz = z / 3.5 - fz;
  const sx = tx * tx * (3 - 2 * tx);
  const sz = tz * tz * (3 - 2 * tz);
  const a = hash(fx, fz, seed);
  const b = hash(fx + 1, fz, seed);
  const c = hash(fx, fz + 1, seed);
  const d = hash(fx + 1, fz + 1, seed);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}

/** Distance signée au bord du chemin le plus proche: négative sur la terre, positive dans l'herbe. */
function pathDistance(plan: GroundPlan, x: number, z: number): number {
  let best = Infinity;
  for (const path of plan.paths) {
    for (let i = 0; i < path.points.length - 1; i += 1) {
      const a = path.points[i];
      const b = path.points[i + 1];
      if (!a || !b) continue;
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
      best = Math.min(best, Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t) - path.width / 2);
    }
  }
  return best;
}

function soilAt(plan: GroundPlan, x: number, z: number): Soil | null {
  for (const band of plan.ballast) {
    if (x > band.x && x < band.x + band.w && z > band.z - 0.1 && z < band.z + band.d + 0.1) {
      return z > band.z + 0.15 && z < band.z + band.d - 0.15 ? 'ballast' : null;
    }
  }
  const distance = pathDistance(plan, x, z);
  if (distance < -0.22) return 'terre';
  if (distance < 0.16) return 'bord';
  return distance > 0.4 ? 'herbe' : null;
}

export interface ScatterBatch {
  readonly shape: string;
  readonly geometry: THREE.BufferGeometry;
  readonly matrices: readonly THREE.Matrix4[];
  /** Les très petites pièces ne projettent pas d'ombre: elle serait plus fine qu'un texel. */
  readonly shadow: boolean;
}

/** Sème les règles sur `area`, hors des emprises `keepOut` (bâtiments, quai, meubles). */
export function scatter(
  plan: GroundPlan,
  area: Rect,
  keepOut: readonly Rect[],
  rules: readonly ScatterRule[] = RULES,
): ScatterBatch[] {
  const byShape = new Map<string, THREE.Matrix4[]>();
  rules.forEach((rule, ruleIndex) => {
    const cell = 1 / Math.sqrt(rule.density);
    const list = byShape.get(rule.shape) ?? [];
    byShape.set(rule.shape, list);
    for (let gx = Math.floor(area.x0 / cell); gx * cell < area.x1; gx += 1) {
      for (let gz = Math.floor(area.z0 / cell); gz * cell < area.z1; gz += 1) {
        const seed = ruleIndex * 17 + 3;
        const x = (gx + hash(gx, gz, seed)) * cell;
        const z = (gz + hash(gz, gx, seed + 1)) * cell;
        if (soilAt(plan, x, z) !== rule.soil) continue;
        if (keepOut.some((r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1)) continue;
        if (rule.patchy && patches(x, z, seed) < rule.patchy) continue;
        const scale = rule.scale[0] + (rule.scale[1] - rule.scale[0]) * hash(gx, gz, seed + 2);
        list.push(
          new THREE.Matrix4().compose(
            new THREE.Vector3(x, 0, z),
            new THREE.Quaternion().setFromEuler(
              new THREE.Euler(
                lean(gx + gz * 3, 0.12),
                hash(gx, gz, seed + 3) * Math.PI * 2,
                lean(gx * 5 + gz, 0.12),
                'YXZ',
              ),
            ),
            new THREE.Vector3(scale, scale * (0.8 + hash(gx, gz, seed + 4) * 0.4), scale),
          ),
        );
      }
    }
  });
  const batches: ScatterBatch[] = [];
  for (const [shape, matrices] of byShape) {
    const build = SHAPES[shape];
    if (!build || matrices.length === 0) continue;
    const sculpt = new Sculpt(1);
    build(sculpt);
    batches.push({
      shape,
      geometry: sculpt.build(),
      matrices,
      shadow: !shape.startsWith('caillou'),
    });
  }
  return batches;
}
