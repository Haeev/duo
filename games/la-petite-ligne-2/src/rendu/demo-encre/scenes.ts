/**
 * Essai « encre »: les deux scènes. Dehors, le coin de la halte d'Aubrune d'après le plan
 * (`docs/jeux/jeu-1/refonte/carte-aubrune/plan.json`); dedans, la pièce de la maison de Firmin.
 *
 * Repère: x vers l'est, z vers le sud, y vers le haut, en mètres. Dehors, l'origine est le point
 * (146, 94) du plan: la voie est à z = 3,5 (plan y 97,5), le quai de z = 5 à 9 (plan y 99 à 103).
 * Chaque élément posé dit pourquoi il est là.
 */
import * as THREE from 'three';

import { building, plankFloor, platform, type BuildingSpec } from './bati';
import {
  bed,
  bench,
  bush,
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
  tree,
  wallLantern,
  windowFrame,
  woodpile,
  type WallOpening,
} from './decor';
import type { FigurineSpec } from './figurines';
import { at, GLOW, hex, LAYER, Sculpt } from './formes';
import type { Lamp } from './matiere';
import { scatter, type ScatterBatch } from './semis';
import { character, type CharacterSpec } from './personnages';
import type { GroundPlan } from './textures';

export interface ScenePiece {
  readonly geometry: THREE.BufferGeometry;
  /** Projette une ombre. */
  readonly shadow: boolean;
  /** Jamais affichée: elle ne fait que de l'ombre (plafond). */
  readonly hidden?: boolean;
  /** Mur d'intérieur: normale vers le dehors; `full` s'efface côté caméra, `stub` le remplace. */
  readonly wall?: { readonly nx: number; readonly nz: number; readonly kind: 'full' | 'stub' };
  readonly characters?: boolean;
}

export interface View {
  readonly x: number;
  readonly z: number;
  /** Largeur de vue au sol, en mètres, et lacet en degrés (0: le haut de l'écran est au nord). */
  readonly width: number;
  readonly yaw: number;
}

export interface SceneBuild {
  readonly pieces: readonly ScenePiece[];
  readonly contacts: THREE.BufferGeometry;
  readonly lamps: readonly Lamp[];
  /** Dedans, c'est la lampe qui oriente les hachures; dehors, le soleil. */
  readonly keyLamp: boolean;
  readonly ground: GroundPlan | null;
  /** Petits volumes semés sur le sol, un appel de dessin instancié par forme. */
  readonly scatter: readonly ScatterBatch[];
  /** Les personnages riggés de l'essai 3, aux mêmes places que les personnages sculptés. */
  readonly cast: readonly FigurineSpec[];
  readonly view: View;
  readonly close: View;
}

/* ------------------------------------------------------------- Habitants */

const PLAYER: CharacterSpec = {
  height: 1.72,
  girth: 1,
  stoop: 0,
  skin: hex('#EFC7A6'),
  hair: hex('#3E5578'),
  top: hex('#D4A33E'),
  bottom: hex('#2C3B57'),
  accent: hex('#C5443D'),
  shoes: hex('#4F3626'),
  skirt: 0.2,
  headwear: 'casquette',
  scarf: true,
  bag: true,
  ring: hex('#FC663F'),
};

/** Le chef de halte: âgé, mince, voûté, uniforme bleu, képi à bandeau rouge, moustache blanche. */
const OLD_STATIONMASTER: CharacterSpec = {
  height: 1.68,
  girth: 0.9,
  stoop: 0.16,
  skin: hex('#E0AE86'),
  hair: hex('#E9E5DC'),
  top: hex('#44618A'),
  bottom: hex('#2C3B57'),
  accent: hex('#C5443D'),
  shoes: hex('#3A3331'),
  skirt: 0.22,
  headwear: 'kepi',
  moustache: true,
};

/** L'épicière: ronde, robe coquelicot, grand tablier clair, chignon. */
const GROCER: CharacterSpec = {
  height: 1.62,
  girth: 1.32,
  stoop: 0,
  skin: hex('#A9744D'),
  hair: hex('#8C4A2E'),
  top: hex('#C5443D'),
  bottom: hex('#8F3B34'),
  accent: hex('#F3EDE0'),
  shoes: hex('#4F3626'),
  skirt: 0.62,
  apron: hex('#F3EDE0'),
  headwear: 'chignon',
};

/** La petite: 1,30 m, blouse canard, couettes rousses à rubans, panier. */
const CHILD: CharacterSpec = {
  height: 1.3,
  girth: 0.92,
  stoop: 0,
  skin: hex('#F6DCC8'),
  hair: hex('#AE5F2E'),
  top: hex('#2F6E73'),
  bottom: hex('#F3EDE0'),
  accent: hex('#D4A33E'),
  shoes: hex('#5E4233'),
  skirt: 0.5,
  headwear: 'couettes',
  basket: true,
};

/** Taches d'ombre de contact: polygones à neuf côtés un peu cabossés, posés au ras du sol. */
function contactGeometry(
  spots: readonly (readonly [x: number, y: number, z: number, rx: number, rz: number])[],
): THREE.BufferGeometry {
  const positions: number[] = [];
  spots.forEach(([x, y, z, rx, rz], index) => {
    const ring: [number, number][] = [];
    for (let i = 0; i < 9; i += 1) {
      const angle = (i / 9) * Math.PI * 2;
      const wobble =
        0.82 + 0.3 * Math.abs((Math.sin(index * 12.9898 + i * 78.233) * 43758.5453) % 1);
      ring.push([x + Math.cos(angle) * rx * wobble, z + Math.sin(angle) * rz * wobble]);
    }
    for (let i = 0; i < 9; i += 1) {
      const a = ring[i];
      const b = ring[(i + 1) % 9];
      if (!a || !b) continue;
      positions.push(x, y + 0.012, z, b[0], y + 0.012, b[1], a[0], y + 0.012, a[1]);
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
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

/** Anneau du joueur au sol, à la couleur de son profil (bible 2.10). */
function playerRing(s: Sculpt, x: number, y: number, z: number): void {
  s.group(at(x, y, z), () => {
    const ring = new THREE.RingGeometry(0.42, 0.52, 14);
    ring.rotateX(-Math.PI / 2);
    s.add(ring, at(0, 0.02, 0), { color: hex('#FC663F'), wobble: 0.012 });
  });
}

const EXTERIOR_CAST: readonly FigurineSpec[] = [
  {
    body: 'costaud',
    atlas: 'gaston',
    hair: 'court',
    expression: 0,
    pose: 'assis',
    time: 0.2,
    x: 0.75,
    z: -3.62,
    heading: 0.1,
  },
  {
    body: 'femme',
    atlas: 'maelle',
    hair: 'carre',
    expression: 1,
    pose: 'parle',
    time: 0.4,
    x: 3.35,
    z: -1.25,
    heading: 1.05,
  },
  {
    body: 'femme',
    atlas: 'lou',
    hair: 'court',
    expression: 1,
    pose: 'repos',
    time: 1.1,
    x: 4.75,
    z: -0.75,
    heading: -1.2,
    height: 1.6,
  },
  {
    body: 'homme',
    atlas: 'basile',
    hair: 'court',
    expression: 0,
    pose: 'marche',
    time: 0.3,
    x: -7.2,
    z: -2.55,
    heading: 1.25,
  },
];

const INTERIOR_CAST: readonly FigurineSpec[] = [
  {
    body: 'costaud',
    atlas: 'gaston',
    hair: 'court',
    expression: 1,
    pose: 'assis',
    time: 0.2,
    x: -1.6,
    z: 0.45,
    heading: Math.PI / 2 + 0.06,
  },
  {
    body: 'femme',
    atlas: 'lou',
    hair: 'court',
    expression: 1,
    pose: 'repos',
    time: 1.1,
    x: 1.05,
    z: 1.35,
    heading: -0.75,
    height: 1.6,
  },
];

export function buildExterior(sculptedPeople: boolean): SceneBuild {
  const decor = new Sculpt(1);
  const people = new Sculpt(120);

  // La voie (plan y 97,5), d'un bord à l'autre: c'est elle qui organise tout le lieu.
  track(decor, -45, 45, 3.5);
  // Quai de 30 x 4 m (plan x 121 à 151), 30 cm de haut: les quais de campagne étaient bas.
  platform(decor, -25, 5, 5, 9, 0.3);
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
  // Barrière le long de la voie, côté pré: elle tient les bêtes et les enfants hors des rails;
  // elle s'ouvre devant la traversée.
  fence(decor, -45, 2.85, 1.2);
  fence(decor, 5.15, 45, 1.2);

  building(decor, HOUSE);
  building(decor, HALT);
  // Lanterne d'applique à droite de la porte: elle éclaire le seuil et le banc.
  wallLantern(decor, at(-0.35, 2.3, -4, 0));
  // Banc contre la façade sud, sous la fenêtre: au soleil, face à la voie, là où le chef de
  // halte attend son train sans quitter sa porte.
  bench(decor, at(0.75, 0, -3.56, 0), 1.5);
  // Bûches à l'abri du pignon ouest, près de la porte: le poêle est juste derrière le mur.
  woodpile(decor, at(-5.4, 0, -5.4, -Math.PI / 2));
  // Pendule du quai sur la halte (plan: arrêtée sur 5 h 12), lisible depuis tout le quai.
  stationClock(decor, at(5, 2.9, 6.3, -Math.PI / 2));

  // Sur le quai: le banc regarde la voie (on y attend le train), le réverbère est entre le banc
  // et la caisse et sa potence s'avance vers la bordure, qu'il éclaire.
  bench(decor, at(-10, 0.3, 8.35, Math.PI), 1.6);
  streetLamp(decor, at(-7.4, 0.3, 8.7, Math.PI));
  // Caisse de la commande du samedi (plan: 141; 101,5), là où s'arrête le fourgon.
  crate(decor, at(-5, 0.3, 7.6, 0.25));
  sack(decor, at(-4.15, 0.3, 8.05, 1));

  // Arbres du pré de Firmin (ombre l'été) et haie basse le long de la barrière.
  tree(decor, -11.5, -7.2, 1.15, 1);
  tree(decor, 9.5, -8.6, 1.0, 2);
  tree(decor, -14.5, -0.4, 0.8, 3);
  tree(decor, 19, -6, 1.1, 4);
  tree(decor, -22, -9, 1.2, 5);
  tree(decor, 15.5, -1.2, 0.75, 6);
  bush(decor, -6.6, 0.3, 1.0, 1);
  bush(decor, 9.0, 0.35, 1.1, 2);
  bush(decor, 3.2, -5.3, 0.9, 3);
  bush(decor, -9.4, 0.2, 0.8, 4);
  bush(decor, 12.6, -4.6, 1.0, 5);
  bush(decor, -17, -4.4, 1.1, 6);

  // Le chef de halte sur son banc; l'épicière et le joueur qui parlent sur le sentier de la
  // traversée; la petite qui rentre du bourg par le chemin, son panier au bras.
  if (sculptedPeople) {
    character(people, OLD_STATIONMASTER, 'assis', 0.75, -3.55, 0.1, 0, 0.47);
    character(people, GROCER, 'parle', 3.35, -1.25, 1.05);
    character(people, PLAYER, 'debout', 4.75, -0.75, -1.2);
    character(people, CHILD, 'marche', -7.2, -2.55, 1.25);
  } else {
    playerRing(people, 4.75, 0, -0.75);
  }

  const contacts = contactGeometry([
    [0.75, 0, -3.45, 0.95, 0.42],
    [3.35, 0, -1.25, 0.42, 0.3],
    [4.75, 0, -0.75, 0.36, 0.26],
    [-7.2, 0, -2.55, 0.3, 0.2],
    [-5.4, 0, -5.4, 0.45, 0.85],
    [-10, 0.3, 8.35, 0.95, 0.36],
    [-5, 0.3, 7.6, 0.62, 0.46],
    [-4.15, 0.3, 8.05, 0.34, 0.3],
    [-7.4, 0.3, 8.7, 0.3, 0.3],
  ]);

  const ground = GROUND;
  return {
    pieces: [
      { geometry: decor.build(), shadow: true },
      { geometry: people.build(), shadow: true, characters: true },
    ],
    contacts,
    lamps: [
      { x: -7.4, y: 3.3, z: 8.1, radius: 6.5 },
      { x: -0.35, y: 2.3, z: -3.55, radius: 4.6 },
      // La petite flaque que le joueur porte la nuit (bible 2.10).
      { x: 4.75, y: 1.3, z: -0.75, radius: 2.3 },
    ],
    keyLamp: false,
    ground,
    // Semis sur le pré et les chemins, hors des emprises: maison, quai et halte, traversée,
    // seuil de la porte, bancs.
    scatter: scatter(ground, { x0: -30, z0: -18, x1: 30, z1: 16 }, [
      { x0: -5.3, z0: -10.3, x1: 2.3, z1: -3.2 },
      { x0: -26, z0: 4.7, x1: 15.6, z1: 11.6 },
      { x0: 2.8, z0: 1.3, x1: 5.2, z1: 5.2 },
      { x0: -6.2, z0: -6.4, x1: -4.9, z1: -4.4 },
      // Là où se tiennent les personnages: rien ne pousse sous leurs pieds.
      { x0: 2.8, z0: -1.8, x1: 5.3, z1: -0.2 },
      { x0: -7.8, z0: -3.1, x1: -6.6, z1: -2.0 },
      { x0: 0, z0: -3.6, x1: 1.6, z1: -2.6 },
    ]),
    cast: EXTERIOR_CAST,
    view: { x: -1.5, z: -2.8, width: 32, yaw: -16 },
    close: { x: 3.9, z: -1.7, width: 8.5, yaw: -16 },
  };
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

/* -------------------------------------------------------------- Intérieur */

const ROOM_W = 6.4;
const ROOM_D = 5.4;
const WALL_H = 2.6;

export function buildInterior(sculptedPeople: boolean): SceneBuild {
  const room = new Sculpt(1);
  const people = new Sculpt(150);
  const pieces: ScenePiece[] = [];

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
  // Le dehors, deviné autour de la maison: un sol d'herbe, que la vignette laisse dans l'ombre.
  room.group(at(0, -0.12, 0), () => {
    room.box(60, 0.1, 60, at(0, -0.05, 0), {
      color: hex('#7C8C48'),
      layer: LAYER.grass,
      wobble: 0,
    });
  });

  // Firmin à table; le joueur debout, qui vient d'entrer.
  if (sculptedPeople) {
    character(people, OLD_STATIONMASTER, 'assis', -1.52, 0.45, Math.PI / 2 + 0.06, 0, 0.5);
    character(people, PLAYER, 'debout', 1.05, 1.35, -0.75);
  } else {
    playerRing(people, 1.05, 0, 1.35);
  }

  pieces.push({ geometry: room.build(), shadow: true });
  pieces.push({ geometry: people.build(), shadow: true, characters: true });

  const contacts = contactGeometry([
    [-0.5, 0.045, 0.45, 0.85, 0.55],
    [-1.55, 0.045, 0.45, 0.36, 0.36],
    [-0.2, 0.045, 1.25, 0.34, 0.34],
    [-0.75, 0.045, -0.38, 0.34, 0.34],
    [1.05, 0, 1.35, 0.36, 0.26],
    [-2.45, 0, -2.2, 0.5, 0.45],
    [1.7, 0, -2.4, 0.95, 0.42],
    [2.6, 0, 1.25, 0.66, 1.2],
    [-1.7, 0, -2.4, 0.24, 0.24],
  ]);

  return {
    pieces,
    contacts,
    lamps: [
      { x: -0.3, y: 1.15, z: 0.35, radius: 3.5 },
      { x: -2.45, y: 0.42, z: -1.75, radius: 1.35 },
    ],
    keyLamp: true,
    ground: null,
    scatter: [],
    cast: INTERIOR_CAST,
    view: { x: 0.1, z: -0.5, width: 12.4, yaw: -28 },
    close: { x: -0.3, z: 0.3, width: 6.5, yaw: -28 },
  };
}
