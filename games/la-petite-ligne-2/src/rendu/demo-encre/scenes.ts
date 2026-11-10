/**
 * Essai « encre »: les deux scènes. Dehors, le coin de la halte d'Aubrune d'après le plan
 * (`docs/jeux/jeu-1/refonte/carte-aubrune/plan.json`); dedans, la pièce de la maison de Firmin.
 *
 * Repère: x vers l'est, z vers le sud, y vers le haut, en mètres. Dehors, l'origine est le point
 * (146, 94) du plan: la voie est à z = 3,5 (plan y 97,5), le quai de z = 5 à 9 (plan y 99 à 103).
 * Chaque élément posé dit pourquoi il est là.
 */
import * as THREE from 'three';

import type { ActorSpec } from './acteurs';
import {
  building,
  plankFloor,
  platform,
  platformSteps,
  windowLights,
  type BuildingSpec,
} from './bati';
import {
  bed,
  bench,
  chair,
  coalBucket,
  coatRack,
  crate,
  curtains,
  doormat,
  hangingPan,
  tableware,
  dresser,
  fence,
  oilLamp,
  picture,
  roomWall,
  rug,
  sack,
  shelf,
  stationClock,
  stove,
  streetLamp,
  table,
  TONE,
  track,
  wallLantern,
  windowFrame,
  woodpile,
  type WallOpening,
} from './decor';
import { at, GLOW, hex, LAYER, Sculpt } from './formes';
import {
  basket,
  boots,
  broom,
  cat,
  footing,
  hangingHerbs,
  kettle,
  longcaseClock,
  nightstand,
  rainBarrel,
  trunk,
} from './mobilier';
import type { Lamp, WindowLight } from './matiere';
import { scatter, type ScatterBatch } from './semis';
import { heightFunction, type HeightAt, type Rect, type TerrainSpec } from './terrain';
import type { GroundPlan } from './textures';
import { plant, type PlantBatch, type PlantSpot } from './vegetation';

export interface ScenePiece {
  readonly geometry: THREE.BufferGeometry;
  /** Projette une ombre. */
  readonly shadow: boolean;
  /** Jamais affichée: elle ne fait que de l'ombre (plafond). */
  readonly hidden?: boolean;
  /** Mur d'intérieur: normale vers le dehors; `full` s'efface côté caméra, `stub` le remplace. */
  readonly wall?: { readonly nx: number; readonly nz: number; readonly kind: 'full' | 'stub' };
}

export interface View {
  readonly x: number;
  readonly z: number;
  /** Largeur de vue au sol, en mètres, et lacet en degrés (0: le haut de l'écran est au nord). */
  readonly width: number;
  readonly yaw: number;
}

/** Tache d'ombre de contact: centre, hauteur au-dessus du terrain, demi-axes. */
export type ContactSpot = readonly [x: number, lift: number, z: number, rx: number, rz: number];

export interface SceneBuild {
  readonly pieces: readonly ScenePiece[];
  readonly contacts: readonly ContactSpot[];
  readonly lamps: readonly Lamp[];
  /** Dedans, c'est la lampe qui oriente les hachures; dehors, le soleil. */
  readonly keyLamp: boolean;
  /** Le terrain: ses données et sa fonction de hauteur (`null`: pas de sol dehors). */
  readonly terrain: { readonly spec: TerrainSpec; readonly height: HeightAt } | null;
  /** Petits volumes semés sur le sol, un appel de dessin instancié par forme. */
  readonly scatter: readonly ScatterBatch[];
  /** Arbres et buissons, un appel de dessin instancié par essence. */
  readonly plants: readonly PlantBatch[];
  /** Les personnages animés (corps de l'essai 4), et la place du joueur dans cette liste. */
  readonly cast: readonly ActorSpec[];
  readonly player: number;
  /** Fenêtres qui jettent leur lumière sur le sol quand elles sont éclairées. */
  readonly windows: readonly WindowLight[];
  /** Zone où flottent poussière et lucioles. */
  readonly air: Rect | null;
  /** Vue large, vue au zoom de jeu (18 m de large) et vue proche. */
  readonly view: View;
  readonly game: View;
  readonly close: View;
}

/** Taches d'ombre de contact: polygones à neuf côtés un peu cabossés, posés au ras du sol. */
export function contactPositions(spots: readonly ContactSpot[], height: HeightAt): number[] {
  const positions: number[] = [];
  spots.forEach(([x, lift, z, rx, rz], index) => {
    const ring: [number, number][] = [];
    for (let i = 0; i < 9; i += 1) {
      const angle = (i / 9) * Math.PI * 2;
      const wobble =
        0.82 + 0.3 * Math.abs((Math.sin(index * 12.9898 + i * 78.233) * 43758.5453) % 1);
      ring.push([x + Math.cos(angle) * rx * wobble, z + Math.sin(angle) * rz * wobble]);
    }
    const y = (px: number, pz: number): number => height(px, pz) + lift + 0.014;
    for (let i = 0; i < 9; i += 1) {
      const a = ring[i];
      const b = ring[(i + 1) % 9];
      if (!a || !b) continue;
      positions.push(x, y(x, z), z, b[0], y(b[0], b[1]), b[1], a[0], y(a[0], a[1]), a[1]);
    }
  });
  return positions;
}

export function contactGeometry(
  spots: readonly ContactSpot[],
  height: HeightAt,
): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(contactPositions(spots, height), 3),
  );
  return geometry;
}

/* -------------------------------------------------------------- Extérieur */

const HOUSE: BuildingSpec = {
  // Maison de Firmin (plan: 7 x 6 m, porte au sud): il sort, longe le sentier et traverse la voie.
  x: -1.5,
  z: -7,
  w: 7,
  d: 6,
  wallHeight: 4.7,
  roofRise: 2.1,
  wall: TONE.plaster,
  roof: TONE.tile,
  shutter: TONE.shutter,
  chimney: -2,
  openings: [
    { side: 's', kind: 'door', along: 0 },
    { side: 's', kind: 'window', along: -2.2 },
    { side: 's', kind: 'window', along: 2.2 },
    { side: 's', kind: 'window', along: -2.2, floor: 1 },
    { side: 's', kind: 'window', along: 0, floor: 1 },
    { side: 's', kind: 'window', along: 2.2, floor: 1 },
    { side: 'e', kind: 'window', along: 0 },
    { side: 'e', kind: 'window', along: 0, floor: 1 },
    { side: 'w', kind: 'window', along: 0 },
    { side: 'w', kind: 'window', along: 0, floor: 1 },
    { side: 'n', kind: 'window', along: 0 },
  ],
};

const HALT: BuildingSpec = {
  // La halte (plan: 10 x 6 m au bout est du quai, porte au sud sur la Grand-Route). Une seconde
  // porte donne à l'ouest, de plain-pied sur le quai: c'est par là que sortent les voyageurs.
  x: 10,
  z: 8,
  w: 10,
  d: 6,
  wallHeight: 3.3,
  roofRise: 1.9,
  wall: hex('#F1DDB8'),
  roof: hex('#CF8058'),
  shutter: TONE.enamel,
  chimney: 2.5,
  openings: [
    { side: 'w', kind: 'door', along: 0.4 },
    { side: 's', kind: 'door', along: 0 },
    { side: 's', kind: 'window', along: -3 },
    { side: 's', kind: 'window', along: 3 },
    { side: 'n', kind: 'window', along: -2.6 },
    { side: 'n', kind: 'window', along: 0 },
    { side: 'n', kind: 'window', along: 2.6 },
    { side: 'e', kind: 'window', along: 0 },
  ],
};

function footprint(spec: BuildingSpec): Rect {
  return {
    x0: spec.x - spec.w / 2,
    z0: spec.z - spec.d / 2,
    x1: spec.x + spec.w / 2,
    z1: spec.z + spec.d / 2,
  };
}

/** Anneau du joueur au sol, à la couleur de son profil (bible 2.10). */
function playerRing(s: Sculpt, x: number, y: number, z: number): void {
  s.group(at(x, y, z), () => {
    const ring = new THREE.RingGeometry(0.42, 0.52, 14);
    ring.rotateX(-Math.PI / 2);
    s.add(ring, at(0, 0.03, 0), { color: hex('#FC663F'), wobble: 0.012 });
  });
}

/** Le sol du coin de halte, tiré du plan: chemins de terre et bande de ballast. */
const GROUND: GroundPlan = {
  origin: [-45, -35],
  size: [90, 70],
  paths: [
    // Le chemin qui longe la voie côté nord (plan y 91 à 92): toutes les portes du nord y donnent.
    {
      points: [
        [-45, -2.2],
        [-20, -2.8],
        [-6, -2.5],
        [6, -2.7],
        [22, -2.3],
        [45, -2.8],
      ],
      width: 2.1,
    },
    // Le seuil de la maison, et le sentier qui descend à la traversée.
    {
      points: [
        [-1.5, -3.8],
        [-1.5, -2.6],
      ],
      width: 1.7,
    },
    {
      points: [
        [3.6, -2.6],
        [4.0, -0.5],
        [4.0, 1.5],
      ],
      width: 1.5,
    },
    // La Grand-Route, au sud du quai (plan y 107), et le pas de porte de la halte.
    {
      points: [
        [-45, 13.2],
        [0, 13],
        [45, 13.4],
      ],
      width: 4.2,
    },
    {
      points: [
        [10, 11.2],
        [10, 12],
      ],
      width: 2,
    },
  ],
  ballast: [{ x: -45, z: 1.85, w: 90, d: 3.3 }],
};

/**
 * Le relief du coin de halte. La voie et le quai tiennent le niveau 0 (une voie est posée à
 * plat); le pré ondule autour. Le fossé draine la plateforme de la voie côté nord, entre le
 * ballast et la barrière; il est comblé sous la traversée de service. La terre est remontée
 * contre le dos du quai (on y monte en pente douce depuis la Grand-Route); les charrettes ont
 * creusé deux ornières dans la Grand-Route; le sol est relevé de 5 cm contre les murs, dont le
 * pied s'enfonce.
 */
const TERRAIN: TerrainSpec = {
  plan: GROUND,
  rolling: 0.34,
  bumps: 0.07,
  flats: [
    { x0: -45, z0: 1.95, x1: 45, z1: 9, level: 0, margin: 1.5 },
    { x0: -25, z0: 8.7, x1: 5, z1: 9.3, level: 0.27, margin: 1.7 },
    { ...footprint(HOUSE), level: 0.05, margin: 1.5 },
    { ...footprint(HALT), level: 0.03, margin: 0.5 },
  ],
  pathDepth: 0.07,
  bank: 0.4,
  ruts: [
    { path: 3, offset: 0.78, depth: 0.05 },
    // Le chemin du nord: les roues de la charrette à bras du facteur et des brouettes.
    { path: 0, offset: 0.46, depth: 0.04 },
  ],
  ditches: [{ z: 1.45, x0: -45, x1: 45, halfWidth: 0.42, depth: 0.3, gaps: [[2.7, 5.3]] }],
  stepX: 0.6,
  fineZ: [-5, 3],
  stepZ: 0.2,
};

/**
 * Arbres et buissons, chacun à sa place pour une raison: le chêne d'ombre dans le pré de Firmin,
 * les pommiers à portée de main de la maison, les bouleaux au bord du fossé (ils aiment l'eau),
 * la haie de noisetiers le long de la barrière, l'églantier là où personne ne fauche (pignon,
 * pied de clôture).
 */
const PLANTS: readonly PlantSpot[] = [
  { species: 'chene', x: -11.8, z: -7.4, size: 1.08, yaw: 0.4 },
  { species: 'chene', x: 19.5, z: -6.2, size: 1.0, yaw: 2.1 },
  { species: 'chene', x: -22.5, z: -9.5, size: 1.15, yaw: 4.0 },
  { species: 'pommier', x: 6.4, z: -6.3, size: 1.0, yaw: 0.3 },
  { species: 'pommier', x: 10.2, z: -9.0, size: 0.9, yaw: 2.6 },
  { species: 'pommier', x: 13.6, z: -5.4, size: 0.95, yaw: 4.4 },
  { species: 'bouleau', x: -8.6, z: 0.05, size: 0.95, yaw: 0.8 },
  { species: 'bouleau', x: -15.2, z: -0.5, size: 1.05, yaw: 3.0 },
  { species: 'bouleau', x: 15.8, z: -0.3, size: 0.9, yaw: 5.1 },
  { species: 'noisetier', x: -5.4, z: 0.15, size: 1.0, yaw: 0.2 },
  { species: 'noisetier', x: -11.6, z: 0.2, size: 1.1, yaw: 1.7 },
  { species: 'noisetier', x: 12.4, z: 0.1, size: 1.05, yaw: 3.3 },
  { species: 'noisetier', x: -17.5, z: -4.6, size: 1.15, yaw: 4.6 },
  { species: 'eglantier', x: 2.75, z: -5.5, size: 1.0, yaw: 0.9 },
  { species: 'eglantier', x: 8.4, z: 0.3, size: 1.05, yaw: 2.4 },
  { species: 'eglantier', x: -2.2, z: 0.35, size: 0.9, yaw: 4.1 },
  { species: 'eglantier', x: -6.4, z: -8.6, size: 1.1, yaw: 5.5 },
];

const EXTERIOR_CAST: readonly ActorSpec[] = [
  // Gaston sur le banc de la façade, au soleil; Odette et la joueuse (Maëlle) qui parlent sur le
  // sentier de la traversée; Lou qui fait l'aller et retour sur le chemin; Basile qui attend le
  // train sur le quai.
  { who: 'gaston', expression: 'neutre', role: 'assis', x: 0.75, z: -3.5, heading: 0.1 },
  { who: 'odette', expression: 'parole', role: 'parle', x: 3.35, z: -1.25, heading: 0.3, phase: 2 },
  { who: 'maelle', expression: 'joie', role: 'repos', x: 4.75, z: -0.75, heading: -0.4, phase: 5 },
  {
    who: 'lou',
    expression: 'joie',
    role: 'marche',
    x: -7.2,
    z: -2.55,
    heading: 1.25,
    route: [
      [-12.5, -2.75],
      [-6, -2.5],
      [1.6, -2.5],
    ],
    phase: 4.9,
  },
  {
    who: 'basile',
    expression: 'reflexion',
    role: 'repos',
    x: -8.6,
    z: 6.6,
    heading: Math.PI,
    floor: 0.3,
    phase: 9,
  },
];

export function buildExterior(): SceneBuild {
  const decor = new Sculpt(1);
  const height = heightFunction(TERRAIN);

  // La voie (plan y 97,5), d'un bord à l'autre: c'est elle qui organise tout le lieu.
  track(decor, -45, 45, 3.5);
  // Quai de 30 x 4 m (plan x 121 à 151), 30 cm de haut: les quais de campagne étaient bas.
  platform(decor, -25, 5, 5, 9, 0.3);
  // Au bout ouest du quai, deux marches: c'est par là qu'on y monte en venant du chemin.
  platformSteps(decor, at(-25.44, 0, 7, 0), 2.4);
  // Traversée de service (plan x 150): platelage de planches au niveau du rail, au bout du quai.
  decor.group(at(4, 0, 0), () => {
    for (const [z, depth] of [
      [2.2, 0.9],
      [3.5, 1.28],
      [4.65, 0.62],
    ] as const) {
      const boards = Math.round(depth / 0.21);
      for (let i = 0; i < boards; i += 1) {
        decor.box(
          2.0,
          0.07,
          depth / boards - 0.015,
          at(0, 0.215, z - depth / 2 + ((i + 0.5) * depth) / boards, 0.01 * (i % 3) - 0.01),
          {
            color: i % 2 ? TONE.woodDark : TONE.woodOld,
            layer: LAYER.grain,
            grain: 'x',
            wobble: 0.01,
          },
        );
      }
    }
    // Rampes de terre calées par une planche, de chaque côté.
    decor.box(2.0, 0.06, 0.5, at(0, 0.1, 1.55, 0, 0.28, 0), {
      color: TONE.woodOld,
      layer: LAYER.grain,
      grain: 'x',
    });
  });
  // Barrière le long de la voie, côté pré, de l'autre côté du fossé: elle tient les bêtes et les
  // enfants hors des rails; elle s'ouvre devant la traversée.
  fence(decor, -45, 2.85, 0.85, height);
  fence(decor, 5.15, 45, 0.85, height);

  building(decor, HOUSE);
  building(decor, HALT);
  // Lanterne d'applique à droite de la porte: elle éclaire le seuil et le banc.
  wallLantern(decor, at(-0.35, 2.3, -4, 0));
  // Banc contre la façade sud, sous la fenêtre: au soleil, face à la voie, là où Gaston attend
  // son train sans quitter sa porte.
  bench(decor, at(0.75, 0.04, -3.56, 0), 1.5);
  // Bûches à l'abri du pignon ouest, près de la porte: le poêle est juste derrière le mur.
  woodpile(decor, at(-5.4, 0.04, -5.4, -Math.PI / 2));
  // Pendule du quai sur la halte (plan: arrêtée sur 5 h 12), lisible depuis tout le quai.
  stationClock(decor, at(5, 2.9, 6.3, -Math.PI / 2));

  // Sur le quai: le banc regarde la voie (on y attend le train), le réverbère est entre le banc
  // et la caisse et sa potence s'avance vers la bordure, qu'il éclaire.
  bench(decor, at(-10, 0.3, 8.35, Math.PI), 1.6);
  streetLamp(decor, at(-7.4, 0.3, 8.7, Math.PI));
  // Caisse de la commande du samedi (plan: 141; 101,5), là où s'arrête le fourgon.
  crate(decor, at(-5, 0.3, 7.6, 0.25));
  sack(decor, at(-4.15, 0.3, 8.05, 1));

  playerRing(decor, 4.75, height(4.75, -0.75), -0.75);

  const walls = [footprint(HOUSE), footprint(HALT)];
  return {
    pieces: [{ geometry: decor.build(), shadow: true }],
    contacts: [
      [-5.4, 0.01, -5.4, 0.45, 0.85],
      [-10, 0.3, 8.35, 0.95, 0.36],
      [-5, 0.3, 7.6, 0.62, 0.46],
      [-4.15, 0.3, 8.05, 0.34, 0.3],
      [-7.4, 0.3, 8.7, 0.3, 0.3],
      [0.75, 0.01, -3.5, 0.95, 0.4],
    ],
    lamps: [
      { x: -7.4, y: 3.3, z: 8.1, radius: 6.5, shadowFov: 122 },
      { x: -0.35, y: 2.3, z: -3.55, radius: 4.6, shadowFov: 126 },
      // La petite flaque que le joueur porte la nuit (bible 2.10): elle éclaire sans ombre.
      { x: 4.75, y: 1.3, z: -0.75, radius: 2.3 },
    ],
    keyLamp: false,
    terrain: { spec: TERRAIN, height },
    // Semis sur le pré et les chemins, hors des emprises: bâtiments, quai, traversée, bancs.
    scatter: scatter(
      { plan: GROUND, height, walls, ditches: TERRAIN.ditches },
      { x0: -25, z0: -14, x1: 25, z1: 15 },
      [
        ...walls,
        { x0: -26, z0: 4.7, x1: 5.2, z1: 9.4 },
        { x0: 2.8, z0: 1.3, x1: 5.2, z1: 5.2 },
        { x0: -6.2, z0: -6.4, x1: -4.9, z1: -4.4 },
        // Là où se tiennent les personnages: rien ne pousse sous leurs pieds.
        { x0: 2.8, z0: -1.8, x1: 5.3, z1: -0.2 },
        { x0: 0, z0: -3.9, x1: 1.6, z1: -2.6 },
      ],
    ),
    plants: plant(PLANTS, height),
    cast: EXTERIOR_CAST,
    player: 2,
    windows: [...windowLights(HOUSE), ...windowLights(HALT)],
    air: { x0: -13, z0: -10, x1: 15, z1: 5 },
    view: { x: -1.5, z: -2.8, width: 32, yaw: -16 },
    game: { x: 1.2, z: -1.9, width: 18, yaw: -16 },
    close: { x: 4.0, z: -1.15, width: 6.2, yaw: 30 },
  };
}

/* -------------------------------------------------------------- Intérieur */

const INTERIOR_CAST: readonly ActorSpec[] = [
  {
    who: 'gaston',
    expression: 'joie',
    role: 'assis',
    x: -1.6,
    z: 0.45,
    heading: Math.PI / 2 + 0.06,
    floor: 0,
  },
  {
    who: 'maelle',
    expression: 'joie',
    role: 'repos',
    x: 1.05,
    z: 1.35,
    heading: -0.75,
    floor: 0,
    phase: 3,
  },
];

const ROOM_W = 6.4;
const ROOM_D = 5.4;
const WALL_H = 2.6;
/** Le plancher est une marche au-dessus du jardin. */
const FLOOR_DROP = 0.2;

/** Le jardin autour de la maison: l'allée de la porte, qui rejoint le chemin au sud. */
const GARDEN: GroundPlan = {
  origin: [-20, -18],
  size: [40, 36],
  paths: [
    {
      points: [
        [0, 3.1],
        [0.2, 5.5],
        [-0.3, 8.6],
      ],
      width: 1.3,
    },
    {
      points: [
        [-20, 9.6],
        [0, 9.2],
        [20, 9.8],
      ],
      width: 2.1,
    },
  ],
  ballast: [],
};

const HOUSE_RECT: Rect = {
  x0: -ROOM_W / 2 - 0.3,
  z0: -ROOM_D / 2 - 0.3,
  x1: ROOM_W / 2 + 0.3,
  z1: ROOM_D / 2 + 0.3,
};

/** Le jardin est 20 cm sous le plancher; il ondule un peu et l'allée y est creusée. */
const GARDEN_TERRAIN: TerrainSpec = {
  plan: GARDEN,
  rolling: 0.22,
  bumps: 0.06,
  flats: [{ ...HOUSE_RECT, level: -FLOOR_DROP, margin: 2.5 }],
  pathDepth: 0.06,
  bank: 0.36,
  ruts: [],
  ditches: [],
  stepX: 0.5,
  fineZ: [3, 11],
  stepZ: 0.25,
};

/**
 * Ce qu'on voit du dehors autour de la pièce: le pommier de la cour, la haie de noisetiers qui
 * ferme le jardin côté chemin, l'églantier contre le pignon.
 */
const GARDEN_PLANTS: readonly PlantSpot[] = [
  { species: 'pommier', x: 6.6, z: -3.2, size: 0.95, yaw: 1.2 },
  { species: 'pommier', x: -7.2, z: 3.4, size: 0.85, yaw: 3.9 },
  { species: 'noisetier', x: -3.4, z: 7.6, size: 1.05, yaw: 0.5 },
  { species: 'noisetier', x: -5.3, z: 7.8, size: 0.95, yaw: 2.2 },
  { species: 'noisetier', x: 3.2, z: 7.7, size: 1.1, yaw: 4.4 },
  { species: 'noisetier', x: 5.4, z: 7.5, size: 0.9, yaw: 1.1 },
  { species: 'eglantier', x: 4.4, z: -1.6, size: 0.9, yaw: 2.0 },
  { species: 'eglantier', x: -4.6, z: -3.4, size: 1.0, yaw: 5.0 },
  { species: 'bouleau', x: -8.5, z: -5.5, size: 1.0, yaw: 0.7 },
  { species: 'chene', x: 9.5, z: 6.5, size: 0.95, yaw: 3.0 },
];

export function buildInterior(): SceneBuild {
  const room = new Sculpt(1);
  const pieces: ScenePiece[] = [];
  const height = heightFunction(GARDEN_TERRAIN);

  plankFloor(room, ROOM_W + 0.6, ROOM_D + 0.6);

  const door: WallOpening = { along: 0, width: 1.05, sill: 0, height: 2.05 };
  const window: WallOpening = { along: 0, width: 0.95, sill: 0.95, height: 1.25 };
  const walls: readonly {
    readonly nx: number;
    readonly nz: number;
    readonly matrix: THREE.Matrix4;
    readonly length: number;
    readonly openings: readonly WallOpening[];
  }[] = [
    {
      nx: 0,
      nz: 1,
      matrix: at(0, 0, ROOM_D / 2 + 0.15, 0),
      length: ROOM_W + 0.6,
      openings: [door, { ...window, along: -2.2 }, { ...window, along: 2.2 }],
    },
    {
      nx: 0,
      nz: -1,
      matrix: at(0, 0, -ROOM_D / 2 - 0.15, Math.PI),
      length: ROOM_W + 0.6,
      openings: [window],
    },
    {
      nx: 1,
      nz: 0,
      matrix: at(ROOM_W / 2 + 0.15, 0, 0, Math.PI / 2),
      length: ROOM_D,
      openings: [window],
    },
    {
      nx: -1,
      nz: 0,
      matrix: at(-ROOM_W / 2 - 0.15, 0, 0, -Math.PI / 2),
      length: ROOM_D,
      openings: [window],
    },
  ];
  walls.forEach((wall, index) => {
    const full = new Sculpt(40 + index * 20);
    const glass = new Sculpt(200 + index * 5);
    const stub = new Sculpt(230 + index * 5);
    roomWall(full, wall.matrix, wall.length, WALL_H, wall.openings, TONE.sage);
    roomWall(
      stub,
      wall.matrix,
      wall.length,
      0.3,
      wall.openings.filter((o) => o.sill === 0),
      null,
    );
    for (const opening of wall.openings) {
      if (opening.sill > 0) {
        windowFrame(full, wall.matrix, opening);
        curtains(
          full,
          wall.matrix.clone().multiply(at(opening.along, opening.sill, -0.15, Math.PI)),
          opening.width,
          opening.height,
          index % 2 === 0 ? TONE.poppy : TONE.chalk,
        );
        glass.group(wall.matrix.clone().multiply(at(opening.along, opening.sill, 0)), () => {
          glass.box(opening.width, opening.height, 0.02, at(0, opening.height / 2, 0.05), {
            color: TONE.glass,
            glow: GLOW.window,
            wobble: 0.002,
          });
        });
      } else {
        // La porte d'entrée, fermée: planches, barres et gros loquet, vue de dedans.
        full.group(wall.matrix.clone().multiply(at(opening.along, 0, 0)), () => {
          for (let i = 0; i < 5; i += 1) {
            full.box(0.2, 2.03, 0.06, at(-0.4 + i * 0.205, 1.02, -0.02 - (i % 2) * 0.008), {
              color: TONE.shutter,
              layer: LAYER.grain,
              grain: 'y',
              wobble: 0.005,
            });
          }
          full.box(0.95, 0.11, 0.035, at(0, 0.5, -0.07), { color: TONE.woodDark });
          full.box(0.95, 0.11, 0.035, at(0, 1.7, -0.07), { color: TONE.woodDark });
          full.box(0.2, 0.09, 0.06, at(-0.36, 1.1, -0.08), { color: TONE.iron });
        });
      }
    }
    if (index === 1) {
      // Mur du fond: l'étagère au-dessus du coin du poêle (au sec, à portée de main), un cadre.
      shelf(full, wall.matrix.clone().multiply(at(1.35, 1.55, -0.15, Math.PI)));
      picture(full, wall.matrix.clone().multiply(at(-1.0, 1.75, -0.15, Math.PI)), hex('#A9C7D9'));
      // Casseroles pendues au-dessus du poêle.
      hangingPan(full, wall.matrix.clone().multiply(at(2.75, 1.95, -0.15, Math.PI)));
      hangingPan(full, wall.matrix.clone().multiply(at(3.05, 1.85, -0.15, Math.PI)));
    }
    if (index === 2) {
      picture(full, wall.matrix.clone().multiply(at(1.6, 1.7, -0.15, Math.PI)), TONE.mustard);
    }
    if (index === 3) {
      // Patère à côté de la porte: on y pend la veste en rentrant.
      coatRack(full, wall.matrix.clone().multiply(at(1.75, 1.75, -0.15, Math.PI)), hex('#44618A'));
    }
    // Le pied du mur, vu du dehors: une assise de moellons du jardin jusqu'au plancher (la
    // pierre de seuil prend sa place devant la porte).
    footing(
      room,
      wall.matrix,
      wall.length + 0.6,
      FLOOR_DROP,
      wall.openings
        .filter((o) => o.sill === 0)
        .map((o) => [o.along - o.width / 2 - 0.2, o.along + o.width / 2 + 0.2] as const),
    );
    const side = { nx: wall.nx, nz: wall.nz };
    pieces.push({ geometry: full.build(), shadow: true, wall: { ...side, kind: 'full' } });
    pieces.push({ geometry: glass.build(), shadow: false, wall: { ...side, kind: 'full' } });
    pieces.push({ geometry: stub.build(), shadow: false, wall: { ...side, kind: 'stub' } });
  });

  // Plafond: jamais affiché, il met la pièce à l'ombre; le soleil n'entre que par les fenêtres.
  const ceiling = new Sculpt(250);
  ceiling.box(ROOM_W + 1.2, 0.2, ROOM_D + 1.2, at(0, WALL_H + 0.1, 0), { color: TONE.ink });
  pieces.push({ geometry: ceiling.build(), shadow: true, hidden: true });

  // Le poêle dans l'angle nord-ouest, tuyau dans le mur du fond; le seau à charbon à côté.
  stove(room, at(-2.45, 0, -2.2, 0));
  coalBucket(room, at(-1.7, 0, -2.4, 0.4));
  // Le buffet contre le mur du fond, à droite de la fenêtre: la vaisselle près de la table.
  dresser(room, at(1.7, 0, -2.4, 0));
  // Le lit le long du mur est, loin de la porte et du courant d'air, tête au nord.
  bed(room, at(2.6, 0, 1.25, 0), TONE.slate);
  // La table au milieu, sur le tapis, sous la lampe; trois chaises.
  rug(room, at(-0.5, 0, 0.45, 0.03));
  table(room, at(-0.5, 0, 0.45, 0.04));
  chair(room, at(-1.55, 0, 0.45, Math.PI / 2 + 0.06));
  chair(room, at(-0.2, 0, 1.25, Math.PI - 0.25), TONE.poppy);
  chair(room, at(-0.75, 0, -0.38, 0.12));
  oilLamp(room, at(-0.3, 0.785, 0.35, 0));
  tableware(room, at(-0.5, 0.785, 0.45, 0.04));
  // Bûches rangées contre le mur ouest, à deux pas du poêle; paillasson devant la porte.
  woodpile(room, at(-2.95, 0, -0.9, -Math.PI / 2));
  doormat(room, at(0, 0, 2.25, 0));
  // Près de la porte: les bottes du jardin et le balai dans l'angle; l'horloge contre le mur
  // est, face à la table, là où tout le monde la voit; la malle au pied du lit; le chevet.
  boots(room, at(0.95, 0, 2.35, 0.3));
  broom(room, at(-2.95, 0, 2.45, 0.8));
  longcaseClock(room, at(2.93, 0, -0.75, -Math.PI / 2));
  trunk(room, at(1.55, 0, 2.2, 0.06));
  nightstand(room, at(2.85, 0, -0.05, -Math.PI / 2));
  // Le chat dort sur l'édredon; la bouilloire chauffe; le panier de pommes attend près du buffet.
  cat(room, at(2.55, 0.56, 1.75, 0.8));
  kettle(room, at(-2.3, 0.86, -2.25, 0.9));
  basket(room, at(0.45, 0, -2.3, 0.4));
  sack(room, at(-0.95, 0, -2.45, 0.3));
  // Herbes du jardin mises à sécher sous la sablière du mur du fond.
  hangingHerbs(room, at(-0.2, WALL_H - 0.2, -ROOM_D / 2 + 0.02, 0));

  // Dehors: la pierre de seuil et sa marche, le tonneau sous la gouttière au coin sud-est, le
  // tas de bois à l'abri du pignon ouest, la barrière du jardin qui s'ouvre sur l'allée.
  room.group(at(0, -FLOOR_DROP, ROOM_D / 2 + 0.3), () => {
    room.box(1.5, 0.2, 0.5, at(0, 0.1, 0.22, 0.02), {
      color: TONE.stone,
      layer: LAYER.face,
      wobble: 0.02,
    });
    room.box(1.2, 0.1, 0.4, at(0.05, 0.03, 0.62, -0.03), {
      color: TONE.stoneDark,
      layer: LAYER.face,
      wobble: 0.02,
    });
  });
  rainBarrel(room, at(ROOM_W / 2 + 0.75, height(ROOM_W / 2 + 0.75, 3.2), 3.2, 0.4));
  woodpile(room, at(-ROOM_W / 2 - 0.75, height(-ROOM_W / 2 - 0.75, 0.6), 0.6, Math.PI / 2));
  bench(room, at(-2.2, height(-2.2, 3.35), 3.38, 0), 1.4);
  fence(room, -9, -0.9, 6.9, height);
  fence(room, 1.1, 9, 6.9, height);

  // Gaston à table; le joueur debout, qui vient d'entrer.
  playerRing(room, 1.05, 0, 1.35);

  pieces.push({ geometry: room.build(), shadow: true });

  const contacts: ContactSpot[] = [
    [-0.5, 0.045, 0.45, 0.85, 0.55],
    [-1.55, 0.045, 0.45, 0.36, 0.36],
    [-0.2, 0.045, 1.25, 0.34, 0.34],
    [-0.75, 0.045, -0.38, 0.34, 0.34],
    [1.05, 0, 1.35, 0.36, 0.26],
    [-2.45, 0, -2.2, 0.5, 0.45],
    [1.7, 0, -2.4, 0.95, 0.42],
    [2.6, 0, 1.25, 0.66, 1.2],
    [-1.7, 0, -2.4, 0.24, 0.24],
    [1.55, 0, 2.2, 0.55, 0.34],
    [2.93, 0, -0.75, 0.24, 0.32],
    [0.45, 0, -2.3, 0.26, 0.24],
  ];

  return {
    pieces,
    // Les taches sont données au-dessus du plancher; le terrain, lui, est une marche plus bas.
    contacts: contacts.map(([x, lift, z, rx, rz]) => [x, lift + FLOOR_DROP, z, rx, rz]),
    lamps: [
      // La lampe à pétrole de la table: c'est elle qui porte les ombres de la pièce.
      { x: -0.3, y: 1.15, z: 0.35, radius: 3.5, shadowFov: 150 },
      { x: -2.45, y: 0.42, z: -1.75, radius: 1.35 },
    ],
    keyLamp: true,
    terrain: { spec: GARDEN_TERRAIN, height },
    scatter: scatter(
      { plan: GARDEN, height, walls: [HOUSE_RECT], ditches: [] },
      { x0: -11, z0: -9, x1: 11, z1: 11 },
      [
        HOUSE_RECT,
        { x0: -0.9, z0: 2.9, x1: 0.9, z1: 4.2 },
        { x0: -3.1, z0: 2.9, x1: -1.3, z1: 3.9 },
        { x0: -4.6, z0: -0.4, x1: -3.4, z1: 1.6 },
        { x0: 3.4, z0: 2.6, x1: 4.5, z1: 3.8 },
      ],
    ),
    plants: plant(GARDEN_PLANTS, height),
    cast: INTERIOR_CAST,
    player: 1,
    windows: [],
    air: null,
    view: { x: 0.1, z: -0.5, width: 12.4, yaw: -28 },
    game: { x: 0.1, z: -0.5, width: 12.4, yaw: -28 },
    close: { x: -0.3, z: 0.3, width: 6.5, yaw: -28 },
  };
}
