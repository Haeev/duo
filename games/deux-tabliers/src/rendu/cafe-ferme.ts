/**
 * Le café fermé depuis trois ans (démo v0.3, sections 3.4 et 5.6): vitrines passées au blanc de Meudon
 * (A2), taches de poussière et feuilles mortes au sol (A6), salle assombrie tant que les vitrines sont
 * blanches (D15), poussière en suspension dans la lumière des vitrines (A9).
 *
 * Rendu seulement: le code du jeu dit où en est chaque vitre et chaque tache (`setPaneWhitewash`,
 * `setDustAmount` ou `syncInstallation`), ce module l'affiche. Par défaut tout est propre: une partie
 * sans installation (v0.2) ne voit rien.
 *
 * Aucun programme de plus (budget de 12, technique 3.6): chaque effet emprunte un programme déjà compilé
 * par la coque cuite, à réglages identiques (même clé de programme de Three.js 0.187).
 * - Badigeon et feuilles: programme du feuillage de la place (`dt_feuillage`: `MeshBasicMaterial`,
 *   texture, couleurs de sommets RGBA, découpe `alphaTest` 0,5, une face, normales). L'alpha de la
 *   texture du badigeon est l'ordre d'effacement à l'éponge; l'alpha du sommet (× 0,5 / seuil) règle
 *   le seuil de chaque vitre dans un seul maillage: on efface en arcs sans uniforme par vitre.
 * - Poussière et grains en suspension: programme du verre de la coque (`MeshBasicMaterial` transparent,
 *   sans texture, deux faces en une passe). La tache est faite de voiles superposés aux bords irréguliers;
 *   les grains sont des carrés tournés vers la caméra, en mélange additif (le mode de mélange n'entre pas
 *   dans la clé).
 * - Salle plus sombre: intensité des cartes de lumière de la coque et des lumières de la scène, des
 *   uniformes.
 *
 * Textures générées par script: `assets-src/effets/blanc_meudon.py` et `feuilles_mortes.py`.
 */
import type { Light } from 'three';
import {
  AdditiveBlending,
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  type Material,
  type Object3D,
  type PerspectiveCamera,
  type Scene,
  type Texture,
} from 'three';
import { textureUrl, type ModelLibrary } from './modeles';

// -----------------------------------------------------------------------------------------------
// Données publiques

/**
 * Vitres blanchies, par identifiant du plan `village` (`donnees/adresses/village.json`): vitrine ouest
 * (celle de l'inscription « À LOUER »), vitrine centre, porte vitrée (ses deux battants), petite fenêtre
 * au-dessus de la file.
 */
export const WHITEWASH_PANES = ['window-2', 'window-3', 'porte-entree', 'window-4'] as const;
export type PaneId = (typeof WHITEWASH_PANES)[number];

/** Une tache de poussière au sol, au plan (x vers l'est, z vers le sud), en mètres. */
export interface DustSpot {
  readonly x: number;
  readonly z: number;
}

/**
 * Les sept taches de la démo v0.3 (section 12, `poussiere` x 7), dans l'ordre de leur index dans
 * `world.installation.dust`. Les feuilles mortes ne viennent que près de la porte (sous le rideau).
 */
export const DUST_SPOTS: readonly DustSpot[] = [
  { x: 5.0, z: 11.4 },
  { x: 6.6, z: 10.4 },
  { x: 8.2, z: 11.6 },
  { x: 9.6, z: 10.8 },
  { x: 9.4, z: 12.0 },
  { x: 8.6, z: 8.2 },
  { x: 6.4, z: 8.6 },
];

/** Ce que lit `syncInstallation`: les vitres encore blanches, les taches encore là (index). */
export interface InstallationLook {
  readonly panes: readonly string[];
  readonly dust: readonly number[];
}

export interface ClosedCafeOptions {
  /** Variante légère: moins de grains en suspension (le reste coûte déjà presque rien). */
  readonly light?: boolean;
  /** Taches à dessiner (par défaut `DUST_SPOTS`). */
  readonly spots?: readonly DustSpot[];
}

export interface ClosedCafe {
  /**
   * Blanc d'une vitre: 1 blanchie, 0 propre; l'effacement suit en arcs de l'éponge (un peu moins
   * d'une seconde pour passer de 1 à 0, sauf `immediate`). Identifiant inconnu: ignoré.
   */
  setPaneWhitewash(id: string, t: number, immediate?: boolean): void;
  /** Poussière d'une tache (index de `spots`): 1 sale, 0 balayée. Index inconnu: ignoré. */
  setDustAmount(index: number, t: number, immediate?: boolean): void;
  /**
   * Raccourci pour l'état du monde: vitres listées blanchies, les autres propres; taches listées
   * sales, les autres balayées. `undefined` ou `null` (partie sans installation): tout propre.
   */
  syncInstallation(look: InstallationLook | null | undefined): void;
  /** Lumière de la salle affichée (D15): de 0,6 (vitrines blanches) à 1. */
  roomLight(): number;
  /** Chaque image, après la caméra: fondus, grains, lumière de la salle. */
  update(dt: number, camera: PerspectiveCamera): void;
  dispose(): void;
}

// -----------------------------------------------------------------------------------------------
// Réglages

/**
 * Cases de l'atlas `blanc_meudon.png` (2048 x 1024: moitié gauche vue de la place, moitié droite vue
 * de la salle), en pixels de chaque moitié. À garder identique à `VITRES` de `blanc_meudon.py`. Les
 * cotes du verre se lisent dans `shell_village_glass`; `x0`, `x1` ne servent qu'à reconnaître la vitre.
 */
export const PANE_CELLS: readonly {
  readonly id: PaneId;
  readonly x0: number;
  readonly x1: number;
  readonly cell: readonly [number, number, number, number];
}[] = [
  { id: 'window-2', x0: 4.46, x1: 6.34, cell: [0, 0, 1024, 640] },
  { id: 'window-3', x0: 6.56, x1: 8.44, cell: [0, 640, 512, 384] },
  { id: 'porte-entree', x0: 8.95, x1: 9.32, cell: [512, 640, 128, 384] },
  { id: 'porte-entree', x0: 9.48, x1: 9.85, cell: [640, 640, 128, 384] },
  { id: 'window-4', x0: 10.26, x1: 10.74, cell: [768, 640, 256, 384] },
];
const ATLAS_W = 2048;
const ATLAS_H = 1024;
/** Couches du badigeon derrière le verre (côté salle): vue de la place, puis vue de la salle. */
const OUTER_OFFSET = 0.002;
const INNER_OFFSET = 0.006;
/** Seuil de découpe du programme du feuillage (`alphaTest` de `dt_feuillage`). */
const CUTOFF = 0.5;

/** Secondes pour passer de 1 à 0 quand l'état saute (fin du geste): vitre, tache. */
const WIPE_SECONDS = 0.9;
const SWEEP_SECONDS = 0.7;

/** D15: × 0,85 par vitre blanchie, jamais sous 0,6. */
const ROOM_LIGHT_PER_PANE = 0.85;
const ROOM_LIGHT_MIN = 0.6;

/** Lumière de la salle pour une somme de blanc des vitres (deux vitres à moitié: 1). */
export function roomLightFor(whiteSum: number): number {
  return Math.max(ROOM_LIGHT_MIN, ROOM_LIGHT_PER_PANE ** Math.max(0, whiteSum));
}
/** La coque cuite: matériaux de la rue, jamais assombris. */
const OUTDOOR_PREFIX = 'street_';
/** Façade (plan z 12,5 à 13): la caméra en deçà est dans la salle; fondu sur 50 cm. */
const FACADE_INSIDE_Z = 12.4;
const FACADE_OUTSIDE_Z = 12.9;

/** Poussière: couleur affichée (grise et chaude, sur le parquet sombre), opacité au cœur. */
const DUST_COLOR = new Color('#a39a8c');
const DUST_LAYER_OPACITY = 0.07;
const DUST_CLUMPS = 60;
const DUST_SPECKS = 70;
const DUST_RADIUS = 0.36;
/** Feuilles: lumière de la salle sur leur couleur (programme sans lumière), taille, distance à la porte. */
const LEAF_LIGHT = 0.4;
const LEAF_SIZE = 0.13;
const DOOR = { x: 9.4, z: 12.5 } as const;
const LEAF_REACH = 3.2;
const LEAF_MAX = 9;

/** Grains en suspension: boîte devant les vitrines, taille à l'écran, nombre. */
const MOTES_BOX = { x0: 4.5, x1: 9.9, y0: 0.35, y1: 2.3, z0: 10.2, z1: 12.75 } as const;
const MOTES = 90;
const MOTES_LIGHT = 30;
const MOTE_PIXELS = 2.2;
const MOTE_COLOR = new Color('#fff1d8');
const MOTE_OPACITY = 0.55;

// -----------------------------------------------------------------------------------------------

const clamp01 = (v: number): number => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));
const smooth = (a: number, b: number, x: number): number => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Petit générateur à graine fixe (mêmes taches chez les deux joueurs). */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Fade {
  shown: number;
  target: number;
}

const approach = (f: Fade, dt: number, seconds: number): boolean => {
  if (f.shown === f.target) return false;
  const step = dt / seconds;
  f.shown =
    f.shown < f.target ? Math.min(f.target, f.shown + step) : Math.max(f.target, f.shown - step);
  return true;
};

// -----------------------------------------------------------------------------------------------
// A2: badigeon

interface PaneQuad {
  readonly id: PaneId;
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
  readonly z: number;
  readonly cell: readonly [number, number, number, number];
}

/** Rectangles des vitres lus dans le maillage du verre de la coque (repère du monde). */
function readPanes(glass: Mesh): PaneQuad[] {
  const geometry = glass.geometry;
  const pos = geometry.getAttribute('position');
  glass.updateWorldMatrix(true, false);
  const p = new Vector3();
  const quads: PaneQuad[] = [];
  for (const c of PANE_CELLS) {
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    let z = 0;
    let n = 0;
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i).applyMatrix4(glass.matrixWorld);
      if (p.x < c.x0 - 0.05 || p.x > c.x1 + 0.05) continue;
      x0 = Math.min(x0, p.x);
      x1 = Math.max(x1, p.x);
      y0 = Math.min(y0, p.y);
      y1 = Math.max(y1, p.y);
      z += p.z;
      n++;
    }
    if (n > 0) quads.push({ id: c.id, x0, x1, y0, y1, z: z / n, cell: c.cell });
  }
  return quads;
}

/**
 * Un seul maillage pour toutes les vitres et les deux côtés: quatre sommets par couche. Couleur des
 * sommets: blanc (la texture porte la couleur affichée); alpha: seuil de la vitre (`paneAlpha`).
 */
function whitewashGeometry(quads: readonly PaneQuad[]): BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const index: number[] = [];
  for (const q of quads) {
    const [cx, cy, cw, ch] = q.cell;
    for (const side of ['outer', 'inner'] as const) {
      const z = q.z - (side === 'outer' ? OUTER_OFFSET : INNER_OFFSET);
      const nz = side === 'outer' ? 1 : -1;
      const half = side === 'outer' ? 0 : ATLAS_W / 2;
      const base = positions.length / 3;
      // Coins: bas gauche, bas droite, haut droite, haut gauche (x croissant = lecture de la place).
      const corners: readonly (readonly [number, number, number, number])[] = [
        [q.x0, q.y0, 0, 1],
        [q.x1, q.y0, 1, 1],
        [q.x1, q.y1, 1, 0],
        [q.x0, q.y1, 0, 0],
      ];
      for (const [x, y, u, v] of corners) {
        positions.push(x, y, z);
        normals.push(0, 0, nz);
        // Un demi-texel en retrait: les cases voisines ne débordent pas au filtrage.
        uvs.push((half + cx + 0.5 + u * (cw - 1)) / ATLAS_W, (cy + 0.5 + v * (ch - 1)) / ATLAS_H);
      }
      // Face vers +z (place) ou vers -z (salle): sens des triangles selon le côté.
      if (side === 'outer') index.push(base, base + 1, base + 2, base, base + 2, base + 3);
      else index.push(base, base + 2, base + 1, base, base + 3, base + 2);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  g.setAttribute(
    'color',
    new BufferAttribute(new Float32Array((positions.length / 3) * 4).fill(1), 4),
  );
  g.setIndex(index);
  return g;
}

/**
 * Alpha de sommet pour une vitre blanchie à `t`: un texel reste si `ordre × alpha ≥ 0,5`, soit
 * `ordre ≥ seuil` avec un seuil de 0,02 (tout le badigeon, sauf l'inscription) à 1 (rien).
 */
const paneAlpha = (t: number): number => CUTOFF / (0.02 + 0.98 * (1 - clamp01(t)));

// -----------------------------------------------------------------------------------------------
// A6: taches et feuilles

/**
 * Une tache: des amas de toutes tailles, plus denses vers le cœur, et des grains épars. Tout est
 * dessiné d'une couleur et d'une opacité (programme du verre): la densité vient du recouvrement des
 * formes. Allongée dans le sens où l'air l'a poussée (`windAngle`, depuis la porte).
 */
function dustGeometry(rand: () => number, windAngle: number): BufferGeometry {
  const positions: number[] = [];
  const index: number[] = [];
  const cos = Math.cos(windAngle);
  const sin = Math.sin(windAngle);
  const blob = (
    cx: number,
    cz: number,
    radius: number,
    stretch: number,
    segments: number,
  ): void => {
    const phases = [rand() * 6.3, rand() * 6.3, rand() * 6.3];
    const center = positions.length / 3;
    positions.push(cx * cos - cz * sin, 0, cx * sin + cz * cos);
    for (let s = 0; s < segments; s++) {
      const a = (s / segments) * Math.PI * 2;
      const wobble =
        1 +
        0.24 * Math.sin(a * 3 + (phases[0] ?? 0)) +
        0.13 * Math.sin(a * 5 + (phases[1] ?? 0)) +
        0.08 * Math.sin(a * 9 + (phases[2] ?? 0));
      const lx = cx + Math.cos(a) * radius * wobble * stretch;
      const lz = cz + Math.sin(a) * radius * wobble;
      positions.push(lx * cos - lz * sin, 0, lx * sin + lz * cos);
      index.push(center, center + (s === segments - 1 ? 1 : s + 2), center + s + 1);
    }
  };
  const gauss = (): number => (rand() + rand() + rand() - 1.5) / 1.5;
  const stretch = 1.25 + 0.35 * rand();
  // Amas de toutes tailles, plus serrés vers le cœur: le bord de la tache s'effiloche (un voile d'un
  // seul tenant montrerait son contour net).
  for (let i = 0; i < DUST_CLUMPS; i++) {
    const r = 0.025 + 0.11 * rand() * rand();
    blob(
      gauss() * DUST_RADIUS * 0.7 * stretch,
      gauss() * DUST_RADIUS * 0.6,
      r,
      1 + 0.6 * rand(),
      12,
    );
  }
  // Grains: petits triangles, chacun trois fois (plus opaques que les amas).
  for (let i = 0; i < DUST_SPECKS; i++) {
    const cx = gauss() * DUST_RADIUS * 0.95 * stretch;
    const cz = gauss() * DUST_RADIUS * 0.85;
    const r = 0.004 + 0.006 * rand();
    const a0 = rand() * 6.3;
    for (let k = 0; k < 3; k++) {
      const base = positions.length / 3;
      for (let c = 0; c < 3; c++) {
        const a = a0 + (c * Math.PI * 2) / 3;
        const lx = cx + Math.cos(a) * r;
        const lz = cz + Math.sin(a) * r;
        positions.push(lx * cos - lz * sin, 0, lx * sin + lz * cos);
      }
      index.push(base, base + 2, base + 1);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setAttribute(
    'normal',
    new Float32BufferAttribute(
      positions.map((_, i) => (i % 3 === 1 ? 1 : 0)),
      3,
    ),
  );
  g.setIndex(index);
  return g;
}

interface Leaf {
  readonly spot: number;
  /** Rang de 0 à 1: la feuille part quand la poussière de sa tache passe sous ce rang. */
  readonly rank: number;
}

/** Feuilles des taches proches de la porte, couchées à plat, une case de l'atlas chacune. */
function leavesGeometry(
  spots: readonly DustSpot[],
  rand: () => number,
): { geometry: BufferGeometry; leaves: Leaf[] } {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const index: number[] = [];
  const leaves: Leaf[] = [];
  spots.forEach((spot, s) => {
    const reach = 1 - Math.hypot(spot.x - DOOR.x, spot.z - DOOR.z) / LEAF_REACH;
    const count = Math.round(LEAF_MAX * Math.max(0, reach));
    for (let i = 0; i < count; i++) {
      const r = DUST_RADIUS * 0.9 * Math.sqrt(rand());
      const a = rand() * Math.PI * 2;
      const cx = spot.x + Math.cos(a) * r;
      const cz = spot.z + Math.sin(a) * r;
      const size = LEAF_SIZE * (0.75 + 0.5 * rand());
      const turn = rand() * Math.PI * 2;
      const cell = Math.floor(rand() * 8);
      const u0 = (cell % 4) / 4;
      const v0 = Math.floor(cell / 4) / 2;
      // Feuilles l'une sur l'autre: un millimètre de plus chacune.
      const y = 0.004 + 0.001 * leaves.length;
      const base = positions.length / 3;
      const shade = LEAF_LIGHT * (0.85 + 0.3 * rand());
      for (const [lx, lz, u, v] of [
        [-0.5, -0.5, 0, 0],
        [0.5, -0.5, 1, 0],
        [0.5, 0.5, 1, 1],
        [-0.5, 0.5, 0, 1],
      ] as const) {
        const x = (lx * Math.cos(turn) - lz * Math.sin(turn)) * size;
        const z = (lx * Math.sin(turn) + lz * Math.cos(turn)) * size;
        positions.push(cx + x, y, cz + z);
        normals.push(0, 1, 0);
        uvs.push(u0 + (u * 0.25 * 127) / 128 + 0.5 / 512, v0 + (v * 0.5 * 127) / 128 + 0.5 / 256);
        colors.push(shade, shade * 0.97, shade * 0.93, 1);
      }
      // Face vers le haut.
      index.push(base, base + 2, base + 1, base, base + 3, base + 2);
      leaves.push({ spot: s, rank: rand() });
    }
  });
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  g.setAttribute('color', new Float32BufferAttribute(colors, 4));
  g.setIndex(index);
  return { geometry: g, leaves };
}

// -----------------------------------------------------------------------------------------------
// A9: grains en suspension

interface Mote {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  phase: number;
}

// -----------------------------------------------------------------------------------------------

export function createClosedCafe(
  scene: Scene,
  models: ModelLibrary,
  options: ClosedCafeOptions = {},
): ClosedCafe {
  const spots = options.spots ?? DUST_SPOTS;
  const root = new Group();
  root.name = 'cafe-ferme';
  scene.add(root);
  const owned: { dispose(): void }[] = [];
  const loader = new TextureLoader();
  let disposed = false;

  const loadTexture = (file: string): Texture | null => {
    const url = textureUrl(file);
    if (url === undefined) return null;
    const t = loader.load(url);
    t.flipY = false;
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  };

  // --- A2: vitres ------------------------------------------------------------------------------
  const panes = new Map<string, Fade>(WHITEWASH_PANES.map((id) => [id, { shown: 0, target: 0 }]));
  let quads: PaneQuad[] = [];
  let whitewash: Mesh | null = null;
  let whitewashTexture: Texture | null = null;
  let whitewashMaterial: MeshBasicMaterial | null = null;
  let panesDirty = true;
  let interior: { material: MeshBasicMaterial; base: number }[] | null = null;
  let shellRoot: Object3D | null = null;

  void models.gltf('shell_village').then((src) => {
    if (src === null || disposed) return;
    shellRoot = src.scene;
    const glass = src.scene.getObjectByName('shell_village_glass');
    if (glass instanceof Mesh) quads = readPanes(glass as Mesh);
    panesDirty = true;
  });

  /** Le badigeon n'existe (texture de 11 Mo en mémoire graphique) que tant qu'une vitre est blanche. */
  const ensureWhitewash = (): Mesh | null => {
    if (whitewash !== null || quads.length === 0) return whitewash;
    whitewashTexture = loadTexture('blanc_meudon.png');
    if (whitewashTexture === null) return null;
    whitewashMaterial = new MeshBasicMaterial({
      name: 'dt_blanc_meudon',
      map: whitewashTexture,
      vertexColors: true,
      alphaTest: CUTOFF,
    });
    whitewash = new Mesh(whitewashGeometry(quads), whitewashMaterial);
    whitewash.name = 'blanc_meudon';
    root.add(whitewash);
    return whitewash;
  };
  const dropWhitewash = (): void => {
    if (whitewash === null) return;
    root.remove(whitewash);
    whitewash.geometry.dispose();
    whitewashMaterial?.dispose();
    whitewashTexture?.dispose();
    whitewash = null;
    whitewashMaterial = null;
    whitewashTexture = null;
  };
  const writePanes = (): void => {
    const any = [...panes.values()].some((f) => f.shown > 0);
    if (!any) {
      dropWhitewash();
      return;
    }
    const mesh = ensureWhitewash();
    if (mesh === null) return;
    const color = mesh.geometry.getAttribute('color') as BufferAttribute;
    quads.forEach((q, i) => {
      const a = paneAlpha(panes.get(q.id)?.shown ?? 0);
      for (let k = 0; k < 8; k++) color.setW(i * 8 + k, a);
    });
    color.needsUpdate = true;
  };

  // --- A6: poussière et feuilles --------------------------------------------------------------
  const rand = seeded(0x0d57);
  const dust = spots.map((spot, i) => {
    const material = new MeshBasicMaterial({
      name: 'dt_poussiere',
      color: DUST_COLOR.clone(),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: DoubleSide,
      // Une passe, le programme du verre de la coque (voir `singlePassGlass`).
      forceSinglePass: true,
    });
    const wind = Math.atan2(spot.z - DOOR.z, spot.x - DOOR.x);
    const mesh = new Mesh(dustGeometry(seeded(0x5eed + i * 7919), wind), material);
    mesh.name = `poussiere-${String(i)}`;
    mesh.position.set(spot.x, 0.003, spot.z);
    mesh.renderOrder = 1;
    mesh.visible = false;
    root.add(mesh);
    owned.push(mesh.geometry, material);
    return { mesh, material, fade: { shown: 0, target: 0 } };
  });
  const leafTexture = loadTexture('feuilles_mortes.png');
  const leafBuild = leavesGeometry(spots, rand);
  const leafMaterial = new MeshBasicMaterial({
    name: 'dt_feuilles_mortes',
    map: leafTexture,
    vertexColors: true,
    alphaTest: CUTOFF,
  });
  const leafMesh = new Mesh(leafBuild.geometry, leafMaterial);
  leafMesh.name = 'feuilles_mortes';
  leafMesh.visible = false;
  root.add(leafMesh);
  owned.push(leafBuild.geometry, leafMaterial);
  if (leafTexture !== null) owned.push(leafTexture);
  let dustDirty = true;
  const writeDust = (light: number): void => {
    let anyLeaf = false;
    const color = leafBuild.geometry.getAttribute('color') as BufferAttribute;
    for (const [i, leaf] of leafBuild.leaves.entries()) {
      const amount = dust[leaf.spot]?.fade.shown ?? 0;
      const on = leaf.rank < amount;
      anyLeaf ||= on;
      for (let k = 0; k < 4; k++) color.setW(i * 4 + k, on ? 1 : 0);
    }
    color.needsUpdate = true;
    leafMesh.visible = anyLeaf && leafTexture !== null;
    leafMaterial.color.setScalar(light);
    for (const d of dust) {
      const t = d.fade.shown;
      d.mesh.visible = t > 0;
      d.material.opacity = DUST_LAYER_OPACITY * t;
      d.material.color.copy(DUST_COLOR).multiplyScalar(light);
      // Le balai pousse la tache: elle rétrécit un peu en s'effaçant.
      d.mesh.scale.setScalar(0.65 + 0.35 * t);
    }
  };

  // --- D15: lumière de la salle -----------------------------------------------------------------
  const lights: { light: Light; base: number }[] = [];
  let lightsFound = false;
  let room = 1;
  let shownRoom = -1;
  let shownInside = -1;
  const collectInterior = (): void => {
    if (interior !== null || shellRoot === null) return;
    const found: { material: MeshBasicMaterial; base: number }[] = [];
    const seen = new Set<Material>();
    shellRoot.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      const m = o.material as Material;
      if (seen.has(m) || !(m instanceof MeshBasicMaterial) || m.lightMap === null) return;
      seen.add(m);
      if (m.name.startsWith(OUTDOOR_PREFIX)) return;
      found.push({ material: m, base: m.lightMapIntensity });
    });
    // La coque n'est pas encore cuite (matériaux d'origine): on réessaiera à l'image suivante.
    if (found.length > 0) interior = found;
  };
  const collectLights = (): void => {
    if (lightsFound) return;
    scene.traverse((o) => {
      if (
        o instanceof HemisphereLight ||
        o instanceof AmbientLight ||
        o instanceof DirectionalLight
      )
        lights.push({ light: o, base: o.intensity });
    });
    lightsFound = true;
  };

  // --- A9: grains -------------------------------------------------------------------------------
  const moteCount = options.light === true ? MOTES_LIGHT : MOTES;
  const motes: Mote[] = [];
  const moteRand = seeded(0x3a7e);
  const box = MOTES_BOX;
  for (let i = 0; i < moteCount; i++) {
    motes.push({
      x: box.x0 + moteRand() * (box.x1 - box.x0),
      y: box.y0 + moteRand() * (box.y1 - box.y0),
      z: box.z0 + moteRand() * (box.z1 - box.z0),
      vx: (moteRand() - 0.5) * 0.02,
      vy: (moteRand() - 0.3) * 0.012,
      vz: (moteRand() - 0.5) * 0.02,
      phase: moteRand() * Math.PI * 2,
    });
  }
  const motePositions = new Float32Array(moteCount * 12);
  const moteGeometry = new BufferGeometry();
  moteGeometry.setAttribute('position', new BufferAttribute(motePositions, 3));
  moteGeometry.setAttribute(
    'normal',
    new BufferAttribute(
      new Float32Array(moteCount * 12).map((_, i) => (i % 3 === 2 ? 1 : 0)),
      3,
    ),
  );
  const moteIndex: number[] = [];
  for (let i = 0; i < moteCount; i++) {
    const b = i * 4;
    moteIndex.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  moteGeometry.setIndex(moteIndex);
  const moteMaterial = new MeshBasicMaterial({
    name: 'dt_grains',
    color: MOTE_COLOR,
    transparent: true,
    opacity: MOTE_OPACITY,
    depthWrite: false,
    side: DoubleSide,
    forceSinglePass: true,
    blending: AdditiveBlending,
  });
  const moteMesh = new Mesh(moteGeometry, moteMaterial);
  moteMesh.name = 'grains';
  moteMesh.frustumCulled = false;
  moteMesh.renderOrder = 3;
  moteMesh.visible = false;
  root.add(moteMesh);
  owned.push(moteGeometry, moteMaterial);
  const right = new Vector3();
  const up = new Vector3();
  let clock = 0;

  /** Blanc de la vitre devant un point de la salle (x), 0 hors des vitres. */
  const paneAt = (x: number): number => {
    for (const c of PANE_CELLS)
      if (x >= c.x0 - 0.1 && x <= c.x1 + 0.1) return panes.get(c.id)?.shown ?? 0;
    return 0;
  };

  const updateMotes = (dt: number, camera: PerspectiveCamera, amount: number): void => {
    moteMesh.visible = amount > 0.01;
    if (!moteMesh.visible) return;
    clock += dt;
    right.setFromMatrixColumn(camera.matrixWorld, 0);
    up.setFromMatrixColumn(camera.matrixWorld, 1);
    const cam = camera.position;
    const perPixel = (2 * Math.tan((camera.fov * Math.PI) / 360)) / 768;
    motes.forEach((m, i) => {
      // Dérive lente, un peu de montée près des vitres chauffées par le jour, rebond dans la boîte.
      m.x += m.vx * dt;
      m.y += (m.vy + 0.004 * Math.sin(clock * 0.3 + m.phase)) * dt;
      m.z += m.vz * dt;
      if (m.x < box.x0 || m.x > box.x1) m.vx = -m.vx;
      if (m.y < box.y0 || m.y > box.y1) m.vy = -m.vy;
      if (m.z < box.z0 || m.z > box.z1) m.vz = -m.vz;
      m.x = Math.min(box.x1, Math.max(box.x0, m.x));
      m.y = Math.min(box.y1, Math.max(box.y0, m.y));
      m.z = Math.min(box.z1, Math.max(box.z0, m.z));
      const near = smooth(box.z0, box.z1 - 0.2, m.z);
      const twinkle = 0.55 + 0.45 * Math.sin(clock * 1.7 + m.phase * 3);
      const bright = amount * near * twinkle * (0.35 + 0.65 * paneAt(m.x));
      const d = Math.hypot(m.x - cam.x, m.y - cam.y, m.z - cam.z);
      // Taille constante à l'écran; la clarté (couleur unique) passe par la surface du carré.
      const half =
        d < 0.4 || bright < 0.02 ? 0 : 0.5 * MOTE_PIXELS * perPixel * d * Math.sqrt(bright);
      // Quatre coins (sans allouer): -r-u, +r-u, +r+u, -r+u.
      for (let c = 0; c < 4; c++) {
        const sr = c === 1 || c === 2 ? half : -half;
        const su = c >= 2 ? half : -half;
        const o = i * 12 + c * 3;
        motePositions[o] = m.x + right.x * sr + up.x * su;
        motePositions[o + 1] = m.y + right.y * sr + up.y * su;
        motePositions[o + 2] = m.z + right.z * sr + up.z * su;
      }
    });
    (moteGeometry.getAttribute('position') as BufferAttribute).needsUpdate = true;
  };

  // -----------------------------------------------------------------------------------------------

  const setPane = (id: string, t: number, immediate = false): void => {
    const f = panes.get(id);
    if (f === undefined) return;
    f.target = clamp01(t);
    if (immediate && f.shown !== f.target) {
      f.shown = f.target;
      panesDirty = true;
    }
  };
  const setDust = (index: number, t: number, immediate = false): void => {
    const d = dust[index];
    if (d === undefined) return;
    d.fade.target = clamp01(t);
    if (immediate && d.fade.shown !== d.fade.target) {
      d.fade.shown = d.fade.target;
      dustDirty = true;
    }
  };

  return {
    setPaneWhitewash: setPane,
    setDustAmount: setDust,
    syncInstallation(look) {
      for (const id of WHITEWASH_PANES) setPane(id, look?.panes.includes(id) === true ? 1 : 0);
      spots.forEach((_, i) => {
        setDust(i, look?.dust.includes(i) === true ? 1 : 0);
      });
    },
    roomLight: () => room,
    update(dt, camera) {
      const step = Math.min(0.1, Math.max(0, dt));
      for (const f of panes.values()) if (approach(f, step, WIPE_SECONDS)) panesDirty = true;
      for (const d of dust) if (approach(d.fade, step, SWEEP_SECONDS)) dustDirty = true;
      if (panesDirty && quads.length > 0) {
        panesDirty = false;
        writePanes();
      }
      // D15: × 0,85 par vitre blanchie (partiellement: à proportion), de 0,6 à 1.
      let white = 0;
      for (const f of panes.values()) white += f.shown;
      room = roomLightFor(white);
      collectInterior();
      collectLights();
      const inside = 1 - smooth(FACADE_INSIDE_Z, FACADE_OUTSIDE_Z, camera.position.z);
      if (room !== shownRoom || dustDirty) {
        dustDirty = false;
        writeDust(room);
      }
      if (room !== shownRoom && interior !== null) {
        for (const e of interior) e.material.lightMapIntensity = e.base * room;
      }
      // Meubles et personnages: lumières de la scène assombries tant que l'on est dans la salle.
      if (room !== shownRoom || inside !== shownInside) {
        const k = 1 + (room - 1) * inside;
        for (const l of lights) l.light.intensity = l.base * k;
        shownInside = inside;
      }
      if (interior !== null) shownRoom = room;
      let amount = 0;
      for (const f of panes.values()) amount += f.shown;
      for (const d of dust) amount += d.fade.shown;
      updateMotes(step, camera, amount / (panes.size + dust.length));
    },
    dispose() {
      disposed = true;
      dropWhitewash();
      if (interior !== null) for (const e of interior) e.material.lightMapIntensity = e.base;
      for (const l of lights) l.light.intensity = l.base;
      scene.remove(root);
      for (const d of owned) d.dispose();
    },
  };
}
