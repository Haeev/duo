/**
 * Essai « encre »: la végétation. Un feuillage n'est pas un polyèdre: c'est un empilement de
 * touffes, chacune une calotte bombée dont le bord est découpé en dents de feuilles inégales,
 * avec quelques feuilles détachées qui flottent devant la silhouette. Les normales d'une touffe
 * rayonnent de son coeur: l'ombre y dessine une masse ronde, pas des facettes; le nuanceur
 * dentelle le bord de l'ombre, noircit le dessous et fait bouger le tout au vent.
 *
 * Gabarit: une essence = une fonction de `SPECIES` (tronc, branches, touffes), décrite autour de
 * son pied à l'échelle 1. La scène ne donne que des emplacements (`PlantSpot`); chaque essence
 * part en un seul appel de dessin instancié, quel que soit le nombre de pieds.
 */
import * as THREE from 'three';

import { lean, TONE } from './decor';
import { at, GLOW, hex, LAYER, type Rgb, Sculpt } from './formes';
import type { HeightAt } from './terrain';

export type Species = 'chene' | 'bouleau' | 'pommier' | 'noisetier' | 'eglantier';

export interface PlantSpot {
  readonly species: Species;
  readonly x: number;
  readonly z: number;
  /** Échelle (1: la taille de l'essence) et cap en radians. */
  readonly size: number;
  readonly yaw: number;
}

export interface PlantBatch {
  readonly species: Species;
  readonly geometry: THREE.BufferGeometry;
  readonly matrices: readonly THREE.Matrix4[];
}

function rnd(seed: number): number {
  const s = Math.sin(seed * 78.233 + 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

interface TuftOptions {
  readonly tone: Rgb;
  /** Tons des petites touffes (à défaut, celui de la grande). */
  readonly tones?: readonly Rgb[];
  /** Segments du pourtour, hauteur du bombé (1: demi-sphère), longueur des dents (part du rayon). */
  readonly segments?: number;
  readonly dome?: number;
  readonly teeth?: number;
  /** Feuilles détachées autour du bord. */
  readonly loose?: number;
  /** Petites touffes posées sur la grande, qui la découpent en festons (0: une calotte seule). */
  readonly sprigs?: number;
}

/**
 * Une masse de feuillage: une grande touffe et, posées sur son pourtour et son sommet, des
 * touffes plus petites qui débordent. Chacune a son propre coeur d'ombre et son propre numéro
 * de morceau: l'ombre et le trait fin dessinent des festons, pas une boule.
 */
export function tuft(
  s: Sculpt,
  x: number,
  y: number,
  z: number,
  r: number,
  seed: number,
  options: TuftOptions,
): void {
  // La grande touffe est le fond de la masse, un ton plus sourd: les petites, plus claires,
  // se détachent dessus comme des paquets de feuilles au soleil.
  const deep: Rgb = [options.tone[0] * 0.74, options.tone[1] * 0.8, options.tone[2] * 0.78];
  cap(s, x, y, z, r, seed, { ...options, tone: deep, segments: (options.segments ?? 9) + 3 });
  const sprigs = options.sprigs ?? (r > 0.9 ? 5 : r > 0.6 ? 4 : 3);
  const tones = options.tones ?? [options.tone];
  for (let k = 0; k < sprigs; k += 1) {
    const top = k === sprigs - 1 && sprigs > 3;
    const angle =
      (k / (top ? 1 : sprigs - (sprigs > 3 ? 1 : 0))) * Math.PI * 2 + rnd(seed * 3.9 + k) * 0.9;
    const reach = top ? 0.25 : 0.62 + rnd(seed * 6.1 + k * 2.7) * 0.2;
    const size = r * (top ? 0.6 : 0.46 + rnd(seed * 4.3 + k * 1.9) * 0.16);
    cap(
      s,
      x + Math.cos(angle) * reach * r,
      y + r * (top ? 0.42 : 0.02 + rnd(seed * 8.7 + k * 3.1) * 0.26),
      z + Math.sin(angle) * reach * r,
      size,
      seed * 17 + k * 5 + 1,
      {
        ...options,
        tone: tones[(k + 1) % tones.length] ?? options.tone,
        segments: 8,
        teeth: (options.teeth ?? 0.34) * 0.8,
        loose: k % 2,
      },
    );
  }
}

/**
 * Une touffe de rayon `r` posée en (x, y, z): calotte à trois rangs cabossés, jupe de dents qui
 * retombent, feuilles détachées. `seed` fixe sa forme.
 */
function cap(
  s: Sculpt,
  x: number,
  y: number,
  z: number,
  r: number,
  seed: number,
  options: TuftOptions,
): void {
  const n = options.segments ?? 9;
  const dome = options.dome ?? 0.72;
  const teeth = options.teeth ?? 0.34;
  const positions: number[] = [];
  const rings: THREE.Vector3[][] = [];
  // Rangs de la calotte: (rayon, hauteur) en parts du rayon; le dernier est le bord.
  const profile: readonly (readonly [number, number])[] = [
    [0.5, 0.86],
    [0.88, 0.42],
    [1.0, -0.04],
  ];
  profile.forEach(([pr, py], ringIndex) => {
    const ring: THREE.Vector3[] = [];
    for (let i = 0; i < n; i += 1) {
      const angle = ((i + ringIndex * 0.5) / n) * Math.PI * 2;
      const k = 0.86 + rnd(seed * 7.1 + ringIndex * 31 + i * 3.7) * 0.3;
      ring.push(
        new THREE.Vector3(
          Math.cos(angle) * pr * k,
          py * dome + (rnd(seed + ringIndex * 17 + i * 5.3) - 0.5) * 0.12,
          Math.sin(angle) * pr * k,
        ),
      );
    }
    rings.push(ring);
  });
  const top = new THREE.Vector3((rnd(seed) - 0.5) * 0.2, dome, (rnd(seed + 1) - 0.5) * 0.2);
  const heart = new THREE.Vector3(0, 0.1, 0);
  const normal = new THREE.Vector3();
  const edge = new THREE.Vector3();
  const middle = new THREE.Vector3();
  /** Ajoute un triangle, tourné vers le dehors de la touffe (`keep`: sens donné gardé). */
  const push = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, keep = false): void => {
    normal.crossVectors(edge.subVectors(b, a), middle.subVectors(c, a));
    middle.copy(a).add(b).add(c).divideScalar(3).sub(heart);
    if (keep || normal.dot(middle) >= 0)
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    else positions.push(a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z);
  };
  const first = rings[0] ?? [];
  for (let i = 0; i < n; i += 1) {
    const a = first[i];
    const b = first[(i + 1) % n];
    if (a && b) push(top, b, a);
  }
  for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex += 1) {
    const upper = rings[ringIndex] ?? [];
    const lower = rings[ringIndex + 1] ?? [];
    for (let i = 0; i < n; i += 1) {
      // Les rangs sont décalés d'un demi-pas: chaque point du haut tombe entre deux du bas.
      const u0 = upper[i];
      const u1 = upper[(i + 1) % n];
      const l0 = lower[i];
      const l1 = lower[(i + 1) % n];
      const lPrev = lower[(i + n - 1) % n];
      if (!u0 || !u1 || !l0 || !l1 || !lPrev) continue;
      push(u0, l0, lPrev);
      push(u0, u1, l0);
    }
  }
  // Dents du bord: une feuille par segment, pointe poussée dehors et vers le bas, de longueur
  // très inégale (une sur trois est longue), plus une petite dent intercalée.
  const rim = rings[rings.length - 1] ?? [];
  for (let i = 0; i < n; i += 1) {
    const a = rim[i];
    const b = rim[(i + 1) % n];
    if (!a || !b) continue;
    // Une dent manque de temps en temps: le bord respire, il ne fait pas la scie.
    if (rnd(seed * 4.7 + i * 3.3) < 0.22) continue;
    const long = rnd(seed * 3.3 + i * 9.1) > 0.68 ? 1.8 : 1;
    const reach = 1 + teeth * long * (0.6 + rnd(seed * 5.7 + i * 2.3) * 0.7);
    const mid = new THREE.Vector3().lerpVectors(a, b, 0.3 + rnd(seed + i * 4.1) * 0.4);
    const tip = new THREE.Vector3(mid.x * reach, mid.y - teeth * (0.35 + rnd(seed + i) * 0.5), 0);
    tip.z = mid.z * reach;
    push(a, tip, b);
    const next = rim[(i + 2) % n];
    if (next && rnd(seed * 2.9 + i * 6.7) > 0.4) {
      const before = new THREE.Vector3().lerpVectors(b, a, 0.2);
      const after = new THREE.Vector3().lerpVectors(b, next, 0.28);
      const point = new THREE.Vector3(
        b.x * (1 + teeth * 0.7),
        b.y - teeth * 0.55,
        b.z * (1 + teeth * 0.7),
      );
      push(before, point, after);
    }
  }
  // Feuilles détachées: de petits losanges qui flottent juste devant le bord.
  const loose = options.loose ?? 3;
  for (let k = 0; k < loose; k += 1) {
    const angle = rnd(seed * 11.3 + k * 4.9) * Math.PI * 2;
    const reach = 1.22 + rnd(seed + k * 8.3) * 0.34;
    const centre = new THREE.Vector3(
      Math.cos(angle) * reach,
      -0.1 + rnd(seed * 1.7 + k) * 0.5,
      Math.sin(angle) * reach,
    );
    const size = 0.1 + rnd(seed + k * 2.1) * 0.07;
    const along = new THREE.Vector3(-Math.sin(angle), 0.5, Math.cos(angle)).normalize();
    const across = new THREE.Vector3(Math.cos(angle), 0.3, Math.sin(angle)).normalize();
    const p0 = centre.clone().addScaledVector(along, size * 1.5);
    const p1 = centre.clone().addScaledVector(across, size * 0.62);
    const p2 = centre.clone().addScaledVector(along, -size * 1.5);
    const p3 = centre.clone().addScaledVector(across, -size * 0.62);
    push(p0, p1, p3, true);
    push(p1, p2, p3, true);
    // L'envers, pour qu'on la voie de partout.
    push(p0, p3, p1, true);
    push(p1, p3, p2, true);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const squash = 0.8 + rnd(seed * 9.7) * 0.3;
  const matrix = at(x, y, z, rnd(seed * 13.1) * 6.3, lean(seed, 0.12), lean(seed + 3, 0.12));
  matrix.multiply(new THREE.Matrix4().makeScale(r, r * squash, r * (0.9 + rnd(seed) * 0.2)));
  s.add(geometry, matrix, {
    color: options.tone,
    layer: LAYER.leaf,
    glow: GLOW.leaf,
    wobble: 0,
    // Le coeur est sous la calotte: les normales du bord regardent un peu vers le bas.
    round: [0, 0.12, 0],
  });
}

/** Tronc noueux: une suite de tronçons coudés, un noeud à chaque coude, des racines à fleur de sol. */
function trunk(
  s: Sculpt,
  points: readonly (readonly [number, number, number, number])[],
  bark: Rgb,
  seed: number,
  layer: number = LAYER.bark,
): void {
  const options = { color: bark, layer, glow: GLOW.stem, wobble: 0.03 } as const;
  const base = points[0];
  if (!base) return;
  const roots = 4;
  for (let i = 0; i < roots; i += 1) {
    const angle = (i / roots) * Math.PI * 2 + seed;
    const reach = base[3] * (2.1 + rnd(seed + i) * 0.9);
    s.limb(
      new THREE.Vector3(base[0], base[3] * 1.1, base[2]),
      new THREE.Vector3(Math.cos(angle) * reach, -0.08, Math.sin(angle) * reach),
      base[3] * 0.62,
      base[3] * 0.2,
      5,
      options,
    );
  }
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    if (!a || !b) continue;
    s.limb(
      new THREE.Vector3(a[0], a[1], a[2]),
      new THREE.Vector3(b[0], b[1], b[2]),
      a[3],
      b[3],
      7,
      {
        ...options,
        wobble: a[3] * 0.14,
      },
    );
    // Le noeud du coude: un bourrelet plus gros que le tronc.
    if (i > 0) {
      s.blob(a[3] * 1.22, a[3] * 0.9, a[3] * 1.22, at(a[0], a[1], a[2], seed + i), options, 0);
    }
  }
}

function branch(
  s: Sculpt,
  from: readonly [number, number, number],
  to: readonly [number, number, number],
  radius: number,
  bark: Rgb,
  layer: number = LAYER.bark,
): void {
  // Deux tronçons: la branche part presque droit, puis se relève vers sa touffe.
  const a = new THREE.Vector3(...from);
  const c = new THREE.Vector3(...to);
  const b = new THREE.Vector3().lerpVectors(a, c, 0.55);
  b.y -= a.distanceTo(c) * 0.12;
  const options = { color: bark, layer, glow: GLOW.stem, wobble: radius * 0.2 } as const;
  s.limb(a, b, radius, radius * 0.7, 5, options);
  s.limb(b, c, radius * 0.7, radius * 0.4, 5, options);
}

const LEAF = {
  oak: [hex('#8FAE52'), hex('#7C9C48'), hex('#A3BD5E')],
  birch: [hex('#B4C66A'), hex('#A1B75B'), hex('#C4D07A')],
  apple: [hex('#7FA049'), hex('#6F9145'), hex('#93AF55')],
  hazel: [hex('#88A64E'), hex('#76964A'), hex('#9DB65A')],
  rose: [hex('#7B9A50'), hex('#6A8A49'), hex('#8DA858')],
} as const satisfies Record<string, readonly Rgb[]>;

function toneOf(tones: readonly Rgb[], index: number): Rgb {
  return tones[index % tones.length] ?? TONE.leaf;
}

/** Les essences, décrites autour de leur pied (y = 0 au sol), à l'échelle 1. */
const SPECIES: Record<Species, (s: Sculpt) => void> = {
  // Chêne du pré: tronc court et trapu, fourche basse, houppier large en neuf touffes. C'est
  // l'arbre d'ombre: on le plante seul, là où l'on s'assoit l'été.
  chene: (s) => {
    const bark = TONE.woodOld;
    trunk(
      s,
      [
        [0, 0, 0, 0.36],
        [0.14, 0.9, 0.06, 0.31],
        [-0.08, 1.8, -0.05, 0.27],
        [0.05, 2.7, 0.04, 0.2],
      ],
      bark,
      1,
    );
    branch(s, [-0.08, 1.8, -0.05], [1.5, 3.1, 0.6], 0.15, bark);
    branch(s, [-0.08, 1.8, -0.05], [-1.5, 3.2, -0.5], 0.14, bark);
    branch(s, [0.05, 2.7, 0.04], [0.3, 3.4, -1.5], 0.12, bark);
    branch(s, [0.05, 2.7, 0.04], [-0.5, 3.3, 1.4], 0.12, bark);
    // Une branche morte, cassée court: le chêne est vieux.
    branch(s, [0.14, 0.9, 0.06], [0.75, 1.5, -0.4], 0.09, bark);
    const masses: readonly (readonly [number, number, number, number])[] = [
      [0.1, 4.55, 0, 1.75],
      [1.75, 3.45, 0.7, 1.3],
      [-1.7, 3.6, -0.6, 1.35],
      [0.4, 3.6, -1.75, 1.25],
      [-0.6, 3.35, 1.65, 1.2],
      [1.2, 3.9, -1.0, 1.0],
      [-1.3, 3.9, 0.9, 1.05],
      [2.3, 2.75, -0.5, 0.75],
      [-2.2, 2.85, 0.6, 0.8],
    ];
    masses.forEach(([x, y, z, r], i) => {
      tuft(s, x, y, z, r, 10 + i, {
        tone: toneOf(LEAF.oak, i),
        tones: LEAF.oak,
        segments: r > 1.1 ? 10 : 8,
      });
    });
  },
  // Bouleau: fût blanc marqué de noir, mince et un peu penché, petites touffes claires étagées
  // qui laissent voir le tronc. Il pousse en lisière et au bord du fossé (il aime l'eau).
  bouleau: (s) => {
    const bark = hex('#E9E3D2');
    trunk(
      s,
      [
        [0, 0, 0, 0.17],
        [0.1, 1.5, 0.03, 0.14],
        [0.02, 3.1, -0.06, 0.11],
        [0.16, 4.7, 0.02, 0.08],
        [0.1, 6.0, 0, 0.05],
      ],
      bark,
      2,
      LAYER.wood,
    );
    // Les marques noires de l'écorce: des bagues courtes et épaisses.
    s.newId();
    for (const [y, r, turn] of [
      [0.5, 0.185, 0.4],
      [1.2, 0.16, 2.1],
      [2.2, 0.14, 4.0],
      [3.4, 0.115, 1.2],
      [4.3, 0.1, 3.1],
    ] as const) {
      s.box(r * 1.5, 0.09, r * 1.1, at(0.06, y, 0, turn, 0, 0.1), {
        color: TONE.ink,
        glow: GLOW.stem,
        wobble: 0.01,
      });
    }
    branch(s, [0.02, 3.1, -0.06], [0.95, 3.9, 0.35], 0.05, bark, LAYER.wood);
    branch(s, [0.02, 3.1, -0.06], [-0.9, 4.1, -0.3], 0.05, bark, LAYER.wood);
    branch(s, [0.16, 4.7, 0.02], [0.7, 5.3, -0.6], 0.04, bark, LAYER.wood);
    const masses: readonly (readonly [number, number, number, number])[] = [
      [0.1, 6.2, 0, 0.9],
      [1.0, 4.1, 0.4, 0.85],
      [-0.95, 4.35, -0.35, 0.8],
      [0.75, 5.45, -0.65, 0.75],
      [-0.55, 5.4, 0.6, 0.8],
      [0.2, 3.3, -0.85, 0.6],
      [-0.35, 3.0, 0.75, 0.55],
    ];
    masses.forEach(([x, y, z, r], i) => {
      tuft(s, x, y, z, r, 40 + i, {
        tone: toneOf(LEAF.birch, i),
        tones: LEAF.birch,
        sprigs: 3,
        segments: 8,
        dome: 0.9,
        teeth: 0.5,
        loose: 4,
      });
    });
  },
  // Pommier de verger: bas, tordu, penché par le vent d'ouest, houppier plat, quelques pommes.
  // On le plante près des maisons, à portée de main.
  pommier: (s) => {
    const bark = hex('#7A6248');
    trunk(
      s,
      [
        [0, 0, 0, 0.24],
        [0.22, 0.6, 0.1, 0.21],
        [0.05, 1.2, -0.1, 0.19],
        [0.4, 1.75, 0.05, 0.15],
      ],
      bark,
      3,
    );
    branch(s, [0.05, 1.2, -0.1], [-1.15, 2.0, -0.4], 0.1, bark);
    branch(s, [0.4, 1.75, 0.05], [1.4, 2.2, 0.5], 0.09, bark);
    branch(s, [0.4, 1.75, 0.05], [0.5, 2.3, -1.1], 0.08, bark);
    const masses: readonly (readonly [number, number, number, number])[] = [
      [0.35, 2.85, 0, 1.25],
      [1.5, 2.35, 0.55, 0.95],
      [-1.25, 2.3, -0.45, 1.0],
      [0.55, 2.45, -1.25, 0.9],
      [-0.3, 2.25, 1.15, 0.85],
    ];
    masses.forEach(([x, y, z, r], i) => {
      tuft(s, x, y, z, r, 70 + i, {
        tone: toneOf(LEAF.apple, i),
        tones: LEAF.apple,
        dome: 0.6,
        teeth: 0.3,
      });
    });
    s.newId();
    for (let i = 0; i < 9; i += 1) {
      const angle = i * 2.4 + 0.5;
      const reach = 0.9 + rnd(i * 3.1) * 1.0;
      s.blob(
        0.085,
        0.08,
        0.085,
        at(0.35 + Math.cos(angle) * reach, 2.05 + rnd(i * 5.7) * 0.5, Math.sin(angle) * reach),
        { color: i % 3 === 0 ? TONE.mustard : TONE.poppy, glow: GLOW.stem, wobble: 0.01 },
        0,
      );
    }
  },
  // Noisetier taillé en haie: trois touffes basses et serrées, des rejets qui dépassent.
  noisetier: (s) => {
    const bark = hex('#6E5A42');
    for (let i = 0; i < 5; i += 1) {
      const angle = i * 1.26 + 0.3;
      s.limb(
        new THREE.Vector3(Math.cos(angle) * 0.12, 0, Math.sin(angle) * 0.12),
        new THREE.Vector3(Math.cos(angle) * 0.5, 0.75 + rnd(i) * 0.3, Math.sin(angle) * 0.5),
        0.045,
        0.025,
        4,
        { color: bark, glow: GLOW.stem, wobble: 0.01 },
      );
    }
    const masses: readonly (readonly [number, number, number, number])[] = [
      [0, 0.72, 0, 0.72],
      [0.62, 0.5, 0.2, 0.55],
      [-0.55, 0.48, -0.25, 0.5],
      [0.1, 0.45, 0.6, 0.45],
      [-0.1, 0.5, -0.62, 0.42],
    ];
    masses.forEach(([x, y, z, r], i) => {
      tuft(s, x, y, z, r, 100 + i, {
        tone: toneOf(LEAF.hazel, i),
        tones: LEAF.hazel,
        segments: 8,
        dome: 0.85,
        teeth: 0.42,
        loose: 2,
      });
    });
  },
  // Églantier: ronces arquées, feuillage clairsemé, fleurs roses. Il s'installe au pied des
  // clôtures et le long du fossé, là où personne ne fauche.
  eglantier: (s) => {
    const bark = hex('#5F6B3C');
    const canes: readonly (readonly [number, number, number])[] = [
      [0.9, 0.5, 0.15],
      [-0.8, 0.6, 0.3],
      [0.2, 0.75, -0.85],
      [-0.3, 0.45, 0.9],
      [0.75, 0.35, -0.6],
    ];
    canes.forEach(([x, y, z], i) => {
      const mid = new THREE.Vector3(x * 0.55, y + 0.35, z * 0.55);
      const options = { color: bark, glow: GLOW.stem, wobble: 0.006 } as const;
      s.limb(new THREE.Vector3(x * 0.05, 0, z * 0.05), mid, 0.03, 0.022, 4, options);
      s.limb(mid, new THREE.Vector3(x, y * 0.55, z), 0.022, 0.012, 4, options);
      tuft(s, x * 0.6, y + 0.25, z * 0.6, 0.36 + rnd(i) * 0.12, 130 + i, {
        tone: toneOf(LEAF.rose, i),
        sprigs: 2,
        segments: 7,
        dome: 0.8,
        teeth: 0.55,
        loose: 2,
      });
    });
    s.newId();
    for (let i = 0; i < 8; i += 1) {
      const angle = i * 2.1 + 0.9;
      const reach = 0.35 + rnd(i * 2.7) * 0.5;
      s.blob(
        0.07,
        0.035,
        0.07,
        at(Math.cos(angle) * reach, 0.72 + rnd(i * 4.3) * 0.35, Math.sin(angle) * reach, 0, 0.5),
        { color: i % 4 === 0 ? TONE.chalk : TONE.rose, glow: GLOW.stem, wobble: 0.008 },
        0,
      );
    }
  },
};

/** Fabrique un appel instancié par essence présente, chaque pied posé à la hauteur du terrain. */
export function plant(spots: readonly PlantSpot[], height: HeightAt): PlantBatch[] {
  const bySpecies = new Map<Species, THREE.Matrix4[]>();
  spots.forEach((spot, index) => {
    const list = bySpecies.get(spot.species) ?? [];
    bySpecies.set(spot.species, list);
    list.push(
      new THREE.Matrix4().compose(
        new THREE.Vector3(spot.x, height(spot.x, spot.z) - 0.02, spot.z),
        new THREE.Quaternion().setFromEuler(
          new THREE.Euler(lean(index * 3 + 1, 0.04), spot.yaw, lean(index * 5 + 2, 0.04), 'YXZ'),
        ),
        new THREE.Vector3(spot.size, spot.size * (0.94 + rnd(index * 7.7) * 0.12), spot.size),
      ),
    );
  });
  const batches: PlantBatch[] = [];
  for (const [species, matrices] of bySpecies) {
    const sculpt = new Sculpt(20 + batches.length * 9);
    sculpt.group(at(0, 0, 0), () => {
      SPECIES[species](sculpt);
    });
    batches.push({ species, geometry: sculpt.build(), matrices });
  }
  return batches;
}
