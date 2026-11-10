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
import { at, GLOW, hex, LAYER, Sculpt } from './formes';
import { outside, pathDistance, type HeightAt, type Rect } from './terrain';
import type { GroundPlan } from '../encre/textures';

/**
 * Natures de sol: herbe du pré, terre du chemin, bord du chemin, ballast, fond du fossé, et
 * pied de mur (la bande de 45 cm contre une façade, que la faux n'atteint pas).
 */
export type Soil = 'herbe' | 'terre' | 'bord' | 'ballast' | 'fosse' | 'mur';

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
  // Pierres: aucune n'est une boîte. Chacune est un galet à facettes fortement cabossé, avec
  // ses proportions; elles sont à demi enterrées (leur centre est sous le sol) et le semis les
  // tourne et les étire encore. Trois gabarits, plus une pierre moussue et une dalle affleurante.
  'pierre-ronde': (s) => {
    s.blob(
      0.2,
      0.15,
      0.16,
      at(0, 0.02, 0),
      { color: TONE.stone, layer: LAYER.face, wobble: 0.05 },
      1,
    );
  },
  'pierre-plate': (s) => {
    s.blob(
      0.26,
      0.085,
      0.19,
      at(0, 0.0, 0, 0, 0.12, 0.08),
      { color: hex('#D2C6AC'), layer: LAYER.face, wobble: 0.045 },
      1,
    );
  },
  // Pierre dressée, plus haute que large, fendue: un éclat posé contre elle.
  'pierre-haute': (s) => {
    s.blob(
      0.13,
      0.2,
      0.11,
      at(0, 0.06, 0, 0, 0.15, 0.2),
      { color: TONE.stoneDark, layer: LAYER.face, wobble: 0.04 },
      0,
    );
    s.blob(
      0.09,
      0.06,
      0.07,
      at(0.14, 0.0, 0.05, 0.6),
      { color: hex('#C9BDA6'), layer: LAYER.face, wobble: 0.025 },
      0,
    );
  },
  // Pierre moussue: la mousse coiffe le côté nord et déborde sur le sol.
  'pierre-moussue': (s) => {
    s.blob(
      0.24,
      0.17,
      0.2,
      at(0, 0.02, 0),
      { color: hex('#B9AE98'), layer: LAYER.face, wobble: 0.055 },
      1,
    );
    s.newId();
    const moss = { color: hex('#7E9547'), wobble: 0.03 } as const;
    s.blob(0.17, 0.07, 0.13, at(-0.04, 0.15, -0.06, 0.4, 0.2, 0), moss, 0);
    s.blob(0.1, 0.05, 0.09, at(-0.18, 0.04, -0.1, 1.1), moss, 0);
  },
  caillou: (s) => {
    s.blob(0.08, 0.05, 0.065, at(0, 0.012, 0), { color: hex('#C9BDA6'), wobble: 0.022 }, 0);
  },
  // Gravillons: deux grains de tailles inégales, pour la matière du chemin vue de près.
  gravillon: (s) => {
    for (const [x, z, r, tone] of [
      [0, 0, 0.034, '#BFB29A'],
      [0.07, 0.03, 0.022, '#D6CBB4'],
    ] as const) {
      s.blob(r, r * 0.6, r * 0.85, at(x, 0.004, z, x * 9), { color: hex(tone), wobble: 0.007 }, 0);
    }
  },
  'caillou-ballast': (s) => {
    s.blob(
      0.075,
      0.05,
      0.06,
      at(0, 0.02, 0, 0, 0.3, 0.2),
      { color: hex('#CFC6B4'), wobble: 0.022 },
      0,
    );
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
          glow: GLOW.stem,
          wobble: 0.004,
        },
      );
    }
  },
  // Herbe haute des endroits jamais fauchés (pied de mur, fossé): sept brins longs, quelques
  // épis; elle monte à mi-mollet et cache le raccord du mur et du sol.
  'herbe-haute': (s) => {
    for (let i = 0; i < 7; i += 1) {
      const angle = (i / 7) * Math.PI * 2 + 0.2;
      const height = 0.42 + (i % 4) * 0.09;
      const spread = 0.04 + (i % 3) * 0.03;
      const blade = new THREE.CylinderGeometry(0.005, 0.05, height, 3, 1, true);
      s.add(
        blade,
        at(
          Math.cos(angle) * spread,
          height * 0.47,
          Math.sin(angle) * spread,
          angle,
          0.2 + (i % 3) * 0.09,
          0,
        ),
        {
          color: i % 3 === 0 ? hex('#7E9547') : i % 3 === 1 ? hex('#97AB55') : hex('#B4BC68'),
          glow: GLOW.stem,
          wobble: 0.004,
        },
      );
    }
    for (const [x, z, h] of [
      [0.03, 0.02, 0.66],
      [-0.05, 0.04, 0.58],
    ] as const) {
      s.blob(
        0.022,
        0.07,
        0.022,
        at(x, h, z, 0, 0.15, 0.1),
        { color: hex('#C9B77A'), glow: GLOW.stem, wobble: 0.003 },
        0,
      );
    }
  },
  // Jonc du fossé: des tiges raides et sombres, une massette brune sur les plus hautes.
  jonc: (s) => {
    for (let i = 0; i < 6; i += 1) {
      const angle = i * 1.1 + 0.3;
      const height = 0.55 + (i % 3) * 0.16;
      s.cyl(
        0.008,
        0.016,
        height,
        3,
        at(Math.cos(angle) * 0.07, height / 2, Math.sin(angle) * 0.07, angle, 0.08 + i * 0.012, 0),
        { color: i % 2 ? hex('#5F7340') : hex('#6F8548'), glow: GLOW.stem, wobble: 0.002 },
      );
      if (i % 3 === 0) {
        s.blob(
          0.026,
          0.075,
          0.026,
          at(Math.cos(angle) * 0.1, height + 0.02, Math.sin(angle) * 0.1),
          { color: hex('#6B4A33'), glow: GLOW.stem, wobble: 0.003 },
          0,
        );
      }
    }
  },
  // Coquelicot: quatre pétales froissés en coupe autour d'un coeur noir, un bouton penché, une
  // feuille découpée au pied. De vraies petites fleurs, pas des pastilles.
  coquelicot: (s) => {
    const stem = { color: hex('#5F7340'), glow: GLOW.stem, wobble: 0.002 } as const;
    s.cyl(0.01, 0.014, 0.36, 3, at(0, 0.18, 0, 0, 0.1, 0.06), stem);
    s.cyl(0.008, 0.01, 0.22, 3, at(0.05, 0.11, 0.03, 0, -0.3, -0.35), stem);
    s.blob(0.018, 0.03, 0.018, at(0.09, 0.22, 0.06), { ...stem, color: hex('#6F8548') }, 0);
    s.newId();
    for (let i = 0; i < 4; i += 1) {
      const angle = (i / 4) * Math.PI * 2 + 0.3;
      s.blob(
        0.06,
        0.012,
        0.05,
        at(
          0.02 + Math.cos(angle) * 0.045,
          0.385 + (i % 2) * 0.008,
          0.03 + Math.sin(angle) * 0.045,
          -angle,
          0,
          0.55,
        ),
        { color: i % 2 ? TONE.poppy : hex('#D6553F'), glow: GLOW.stem, wobble: 0.01 },
        0,
      );
    }
    s.blob(0.02, 0.016, 0.02, at(0.02, 0.38, 0.03), { color: TONE.ink, glow: GLOW.stem }, 0);
  },
  // Marguerite: sept pétales étroits en étoile autour d'un coeur bombé, deux fleurs par pied.
  marguerite: (s) => {
    const stem = { color: hex('#5F7340'), glow: GLOW.stem, wobble: 0.002 } as const;
    for (const [x, z, h, tilt] of [
      [0, 0, 0.3, 0.05],
      [0.07, -0.04, 0.22, -0.2],
    ] as const) {
      s.cyl(0.009, 0.012, h, 3, at(x, h / 2, z, 0, tilt, 0.05), stem);
      s.newId();
      for (let i = 0; i < 6; i += 1) {
        const angle = (i / 6) * Math.PI * 2;
        // Pétale: une lame à trois pans, effilée, couchée en étoile et un peu relevée.
        s.add(
          new THREE.CylinderGeometry(0.003, 0.014, 0.055, 3, 1, true),
          at(
            x + Math.cos(angle) * 0.04,
            h + 0.014,
            z + Math.sin(angle) * 0.04,
            -angle,
            0,
            -Math.PI / 2 + 0.25,
          ),
          { color: TONE.chalk, glow: GLOW.stem, wobble: 0.002 },
        );
      }
      s.blob(
        0.022,
        0.016,
        0.022,
        at(x, h + 0.022, z),
        { color: TONE.mustard, glow: GLOW.stem, wobble: 0.003 },
        0,
      );
      s.newId();
    }
  },
};

/** Les lignes de densité de l'essai: un nouveau petit décor s'ajoute ici, sans autre code. */
export const RULES: readonly ScatterRule[] = [
  { shape: 'pierre-ronde', soil: 'bord', density: 1.2, scale: [0.35, 1.25] },
  { shape: 'pierre-plate', soil: 'bord', density: 0.8, scale: [0.4, 1.3] },
  { shape: 'pierre-haute', soil: 'bord', density: 0.35, scale: [0.5, 1.2] },
  { shape: 'pierre-moussue', soil: 'bord', density: 0.25, scale: [0.6, 1.5] },
  { shape: 'touffe', soil: 'bord', density: 2.4, scale: [0.7, 1.4] },
  { shape: 'herbe-haute', soil: 'bord', density: 0.45, scale: [0.6, 0.95] },
  { shape: 'caillou', soil: 'terre', density: 0.9, scale: [0.5, 1.7], patchy: 0.35 },
  { shape: 'gravillon', soil: 'terre', density: 1.3, scale: [0.6, 1.5], patchy: 0.3 },
  { shape: 'touffe', soil: 'herbe', density: 0.42, scale: [0.8, 1.5], patchy: 0.55 },
  { shape: 'coquelicot', soil: 'herbe', density: 0.22, scale: [0.8, 1.2], patchy: 0.62 },
  { shape: 'marguerite', soil: 'herbe', density: 0.3, scale: [0.8, 1.2], patchy: 0.6 },
  { shape: 'pierre-moussue', soil: 'herbe', density: 0.025, scale: [0.9, 2.2] },
  { shape: 'pierre-ronde', soil: 'herbe', density: 0.02, scale: [0.7, 1.6] },
  { shape: 'caillou-ballast', soil: 'ballast', density: 3.2, scale: [0.6, 1.5] },
  { shape: 'herbe-haute', soil: 'mur', density: 5.5, scale: [0.75, 1.25] },
  { shape: 'herbe-haute', soil: 'fosse', density: 2.6, scale: [0.8, 1.3] },
  { shape: 'jonc', soil: 'fosse', density: 1.3, scale: [0.8, 1.3], patchy: 0.4 },
  { shape: 'herbe-haute', soil: 'herbe', density: 0.12, scale: [0.8, 1.2], patchy: 0.6 },
];

/** Ce que le semis doit savoir du lieu: son plan, son relief, ses murs et ses fossés. */
export interface ScatterSite {
  readonly plan: GroundPlan;
  readonly height: HeightAt;
  /** Emprises des bâtiments: l'herbe haute pousse contre leurs murs. */
  readonly walls: readonly Rect[];
  /** Fossés: axe en z, demi-largeur, étendue en x, passages comblés. */
  readonly ditches: readonly {
    readonly z: number;
    readonly halfWidth: number;
    readonly x0: number;
    readonly x1: number;
    readonly gaps: readonly (readonly [number, number])[];
  }[];
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

function soilAt(site: ScatterSite, x: number, z: number): Soil | null {
  const plan = site.plan;
  for (const band of plan.ballast) {
    if (x > band.x && x < band.x + band.w && z > band.z - 0.1 && z < band.z + band.d + 0.1) {
      return z > band.z + 0.15 && z < band.z + band.d - 0.15 ? 'ballast' : null;
    }
  }
  for (const ditch of site.ditches) {
    if (Math.abs(z - ditch.z) < ditch.halfWidth * 0.8 && x > ditch.x0 && x < ditch.x1) {
      return ditch.gaps.some(([g0, g1]) => x > g0 - 0.6 && x < g1 + 0.6) ? null : 'fosse';
    }
  }
  const distance = pathDistance(plan, x, z);
  if (distance < -0.22) return 'terre';
  if (distance < 0.16) return 'bord';
  for (const wall of site.walls) {
    const gap = outside(wall, x, z);
    if (gap > 0.04 && gap < 0.45) return distance > 0.35 ? 'mur' : null;
  }
  return distance > 0.4 ? 'herbe' : null;
}

export interface ScatterBatch {
  readonly shape: string;
  readonly geometry: THREE.BufferGeometry;
  readonly matrices: readonly THREE.Matrix4[];
  /** Seules les pierres et les touffes projettent une ombre: celle d'une fleur serait plus fine qu'un texel. */
  readonly shadow: boolean;
}

/** Sème les règles sur `area`, hors des emprises `keepOut` (bâtiments, quai, meubles). */
export function scatter(
  site: ScatterSite,
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
        if (soilAt(site, x, z) !== rule.soil) continue;
        if (keepOut.some((r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1)) continue;
        if (rule.patchy && patches(x, z, seed) < rule.patchy) continue;
        const scale = rule.scale[0] + (rule.scale[1] - rule.scale[0]) * hash(gx, gz, seed + 2);
        list.push(
          new THREE.Matrix4().compose(
            new THREE.Vector3(x, site.height(x, z) - 0.015, z),
            new THREE.Quaternion().setFromEuler(
              new THREE.Euler(
                lean(gx + gz * 3, 0.12),
                hash(gx, gz, seed + 3) * Math.PI * 2,
                lean(gx * 5 + gz, 0.12),
                'YXZ',
              ),
            ),
            // Chaque pièce est étirée à sa façon: deux pierres du même gabarit ne se ressemblent pas.
            new THREE.Vector3(
              scale * (0.8 + hash(gx, gz, seed + 5) * 0.45),
              scale * (0.7 + hash(gx, gz, seed + 4) * 0.6),
              scale * (0.8 + hash(gx, gz, seed + 6) * 0.45),
            ),
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
      shadow: shape.startsWith('pierre') || shape === 'touffe' || shape === 'herbe-haute',
    });
  }
  return batches;
}
