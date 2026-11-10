/**
 * Essai « encre »: le bâti. Le relief est d'abord dans la géométrie: soubassement en pierres qui
 * dépassent une à une, chaînes d'angle, encadrements et tableaux de fenêtre, linteaux de bois,
 * volets en planches épaisses, chevrons sous le débord, tuiles en rangs désaffleurés, faîtières,
 * gouttière et descente; dalles et planches posées une à une. Chaque morceau prend ainsi son ton
 * (dessus clair, flanc à l'ombre) et la passe d'encrage le cerne d'un trait fin. Une même
 * fonction, pilotée par une fiche (`BuildingSpec`), fait la maison et la halte.
 */
import * as THREE from 'three';

import { lean, TONE } from './decor';
import { at, GLOW, hex, LAYER, type Rgb, type Sculpt } from './formes';
import type { WindowLight } from './matiere';

/** Tirage reproductible entre 0 et 1. */
function rand(seed: number): number {
  return lean(seed, 0.5) + 0.5;
}

type Side = 'n' | 's' | 'e' | 'w';

export interface Opening {
  readonly side: Side;
  readonly kind: 'door' | 'window';
  /** Position le long du mur, en mètres depuis son milieu (vu de dehors, vers la droite). */
  readonly along: number;
  /** 0: rez-de-chaussée, 1: étage. */
  readonly floor?: 0 | 1;
}

export interface BuildingSpec {
  /** Centre de l'emprise, largeur (est-ouest) et profondeur (nord-sud), en mètres. */
  readonly x: number;
  readonly z: number;
  readonly w: number;
  readonly d: number;
  /** Hauteur des murs sous l'égout et hauteur du faîte au-dessus. */
  readonly wallHeight: number;
  readonly roofRise: number;
  readonly wall: Rgb;
  readonly roof: Rgb;
  readonly shutter: Rgb;
  readonly openings: readonly Opening[];
  /** Cheminée: position le long du faîte, depuis le milieu. */
  readonly chimney?: number;
}

const STONES: readonly Rgb[] = [TONE.stone, hex('#D2C6AC'), TONE.stoneDark, hex('#C9BDA6')];
const TILES: readonly Rgb[] = [TONE.tile, hex('#CF8058'), hex('#E09A70'), TONE.tileDark];

/** Repère d'un mur: x le long du mur (vers la droite vu de dehors), y en haut, +z vers le dehors. */
function wallFrame(spec: BuildingSpec, side: Side): { matrix: THREE.Matrix4; length: number } {
  switch (side) {
    case 's':
      return { matrix: at(spec.x, 0, spec.z + spec.d / 2, 0), length: spec.w };
    case 'n':
      return { matrix: at(spec.x, 0, spec.z - spec.d / 2, Math.PI), length: spec.w };
    case 'e':
      return { matrix: at(spec.x + spec.w / 2, 0, spec.z, Math.PI / 2), length: spec.d };
    case 'w':
      return { matrix: at(spec.x - spec.w / 2, 0, spec.z, -Math.PI / 2), length: spec.d };
  }
}

/** Porte de 2,05 m: piédroits de pierre, linteau de bois, vantail en planches, pentures, marche. */
export function door(s: Sculpt, matrix: THREE.Matrix4, leaf: Rgb): void {
  s.group(matrix, () => {
    for (const sign of [-1, 1]) {
      for (let i = 0; i < 5; i += 1) {
        const wide = i % 2 === 0 ? 0.3 : 0.2;
        s.box(
          wide,
          0.42,
          0.26,
          at(sign * (0.56 + wide / 2), 0.21 + i * 0.43, 0.02 + rand(i + sign) * 0.03),
          {
            color: STONES[(i + (sign > 0 ? 1 : 0)) % STONES.length] ?? TONE.stone,
            layer: LAYER.face,
            wobble: 0.014,
          },
        );
      }
    }
    s.box(1.9, 0.26, 0.3, at(0, 2.3, 0.05, 0, 0, 0.012), {
      color: TONE.woodDark,
      layer: LAYER.grain,
      grain: 'x',
      wobble: 0.02,
    });
    s.box(1.6, 0.17, 0.6, at(0, 0.085, 0.32, 0.02, 0, 0), {
      color: TONE.stone,
      layer: LAYER.face,
      wobble: 0.025,
    });
    s.newId();
    for (let i = 0; i < 5; i += 1) {
      s.box(0.215, 2.06, 0.07, at(-0.44 + i * 0.22, 1.19, 0.03 + rand(i * 3) * 0.015), {
        color: leaf,
        layer: LAYER.grain,
        grain: 'y',
        wobble: 0.006,
      });
    }
    for (const y of [0.5, 1.8]) {
      s.box(0.95, 0.12, 0.035, at(-0.03, y, 0.09, 0, 0, lean(y, 0.01)), {
        color: TONE.iron,
        wobble: 0.006,
      });
    }
    s.box(0.1, 0.24, 0.08, at(0.36, 1.12, 0.1), { color: TONE.brass });
  });
}

/**
 * Fenêtre: tableau creusé (la vitre est 14 cm derrière l'encadrement), appui débordant, linteau
 * de bois, petits bois, volets de planches épaisses rabattus contre le mur avec leurs barres.
 */
export function windowUnit(
  s: Sculpt,
  matrix: THREE.Matrix4,
  shutter: Rgb,
  width = 0.95,
  height = 1.25,
): void {
  s.group(matrix, () => {
    s.box(width + 0.5, 0.13, 0.3, at(0, -0.065, 0.1), {
      color: TONE.stoneDark,
      layer: LAYER.face,
      wobble: 0.015,
    });
    s.box(width + 0.56, 0.2, 0.24, at(0, height + 0.1, 0.06, 0, 0, 0.01), {
      color: TONE.woodDark,
      layer: LAYER.grain,
      grain: 'x',
      wobble: 0.016,
    });
    for (const sign of [-1, 1]) {
      s.box(0.12, height, 0.2, at(sign * (width / 2 + 0.06), height / 2, 0.05), {
        color: TONE.stone,
        layer: LAYER.face,
        wobble: 0.01,
      });
    }
    s.newId();
    s.box(width, height, 0.04, at(0, height / 2, -0.03), {
      color: TONE.glass,
      glow: GLOW.window,
      wobble: 0.003,
    });
    s.newId();
    s.box(0.07, height, 0.05, at(0, height / 2, 0.0), { color: TONE.chalk, wobble: 0.004 });
    s.box(width, 0.06, 0.05, at(0, height * 0.55, 0.0), { color: TONE.chalk, wobble: 0.004 });
    for (const sign of [-1, 1]) {
      s.newId();
      const cx = sign * (width * 0.75 + 0.2);
      for (let i = 0; i < 3; i += 1) {
        s.box(
          width / 6 + 0.012,
          height + 0.06,
          0.07,
          at(
            cx + (i - 1) * (width / 6 + 0.016),
            height / 2,
            0.05 + rand(i + sign * 5) * 0.012,
            0,
            0,
            sign * 0.01,
          ),
          {
            color: shutter,
            layer: LAYER.grain,
            grain: 'y',
            wobble: 0.005,
          },
        );
      }
      for (const y of [0.22, 0.8]) {
        s.box(width / 2 + 0.02, 0.09, 0.035, at(cx, height * y, 0.105), {
          color: TONE.iron,
          wobble: 0.004,
        });
      }
    }
  });
}

function openingNear(
  spec: BuildingSpec,
  side: Side,
  along: number,
  kind: Opening['kind'],
): boolean {
  return spec.openings.some(
    (o) =>
      o.side === side &&
      o.kind === kind &&
      (o.floor ?? 0) === 0 &&
      Math.abs(o.along - along) < 0.85,
  );
}

export function building(s: Sculpt, spec: BuildingSpec): void {
  const { w, d, wallHeight: h, roofRise: rise } = spec;
  const pitch = Math.atan2(rise, d / 2);
  const slope = Math.hypot(d / 2, rise) + 0.45;
  /** Pose sur un pan: `run` mètres sous le faîte le long de la pente, `lift` au-dessus du pan. */
  const onSlope = (x: number, sign: number, run: number, lift: number, tilt = 0): THREE.Matrix4 =>
    at(
      x,
      h + rise - Math.sin(pitch) * run + Math.cos(pitch) * lift,
      sign * (Math.cos(pitch) * run + Math.sin(pitch) * lift),
      0,
      sign * (pitch + tilt),
      0,
    );

  s.group(at(spec.x, 0, spec.z), () => {
    s.prism(
      [
        [-d / 2, 0],
        [d / 2, 0],
        [d / 2, h],
        [0, h + rise],
        [-d / 2, h],
      ],
      w,
      at(0, 0, 0, Math.PI / 2),
      { color: spec.wall, layer: LAYER.wall, wobble: 0.03 },
    );
    // Sablière: la poutre qui porte les chevrons, visible sous le débord.
    for (const sign of [-1, 1]) {
      s.box(w + 0.1, 0.16, 0.14, at(0, h - 0.06, sign * (d / 2 + 0.04)), {
        color: TONE.woodDark,
        layer: LAYER.grain,
        grain: 'x',
        wobble: 0.012,
      });
    }

    // Toit: une volige sombre, puis les tuiles en rangs; chaque rang relève son bord bas.
    s.newId();
    for (const sign of [-1, 1]) {
      s.box(w + 0.7, 0.07, slope, onSlope(0, sign, slope / 2, 0.035), {
        color: TONE.woodDark,
        wobble: 0.01,
      });
      const rows = Math.ceil(slope / 0.34);
      for (let row = 0; row < rows; row += 1) {
        let x = -w / 2 - 0.42;
        let k = 0;
        while (x < w / 2 + 0.42) {
          const seed = row * 31 + k * 7 + sign * 3;
          const width = Math.min(0.55 + rand(seed) * 0.9, w / 2 + 0.44 - x);
          const run = Math.min(slope - 0.2, row * 0.34 + 0.22 + lean(seed + 1, 0.025));
          s.box(
            width - 0.012,
            0.075,
            0.44,
            onSlope(x + width / 2, sign, run, 0.13 + rand(seed + 2) * 0.02, -0.13),
            {
              color: TILES[Math.floor(rand(seed + 3) * TILES.length)] ?? TONE.tile,
              layer: LAYER.roof,
              grain: 'x',
              wobble: 0.012,
            },
          );
          x += width;
          k += 1;
        }
      }
      // Chevrons: ils dépassent du mur et portent le débord.
      for (let x = -w / 2 + 0.25; x <= w / 2 - 0.2; x += 0.72) {
        s.box(0.1, 0.13, 0.62, onSlope(x + lean(x, 0.04), sign, slope - 0.3, -0.06), {
          color: TONE.woodDark,
          layer: LAYER.grain,
          grain: 'z',
          wobble: 0.008,
        });
      }
    }
    // Faîtières demi-rondes, une tous les 42 cm.
    s.newId();
    for (let x = -w / 2 - 0.3; x <= w / 2 + 0.3; x += 0.42) {
      s.cyl(
        0.17,
        0.19,
        0.44,
        6,
        at(x, h + rise + 0.2 + lean(x, 0.012), 0, 0, lean(x + 1, 0.03), Math.PI / 2),
        {
          color: TILES[Math.floor(rand(x * 5) * 3)] ?? TONE.tile,
          wobble: 0.01,
        },
      );
    }
    // Gouttière de zinc côté sud et sa descente au coin sud-est.
    s.newId();
    s.box(
      w + 0.86,
      0.1,
      0.14,
      at(0, h + rise - Math.sin(pitch) * (slope + 0.03) + 0.02, Math.cos(pitch) * (slope + 0.05)),
      { color: TONE.steel, topColor: TONE.iron, wobble: 0.008 },
    );
    const gutterY = h + rise - Math.sin(pitch) * slope;
    s.cyl(0.05, 0.05, gutterY - 0.1, 6, at(w / 2 + 0.08, gutterY / 2 + 0.05, d / 2 + 0.09), {
      color: TONE.steel,
      wobble: 0.006,
    });
    s.box(0.14, 0.07, 0.42, at(w / 2 + 0.08, gutterY - 0.04, d / 2 + 0.26), { color: TONE.steel });

    if (spec.chimney !== undefined) {
      s.newId();
      const cz = -d * 0.16;
      const top = h + rise + 0.95;
      s.box(0.66, 1.9, 0.66, at(spec.chimney, top - 0.95, cz), {
        color: spec.wall,
        layer: LAYER.wall,
        wobble: 0.03,
      });
      for (let i = 0; i < 4; i += 1) {
        const a = (i * Math.PI) / 2;
        s.box(
          0.5,
          0.2,
          0.2,
          at(spec.chimney + Math.sin(a) * 0.27, top - 0.05, cz + Math.cos(a) * 0.27, a),
          { color: STONES[i] ?? TONE.stone, layer: LAYER.face, wobble: 0.015 },
        );
      }
      s.box(0.86, 0.1, 0.86, at(spec.chimney, top + 0.1, cz, 0.05), {
        color: TONE.stoneDark,
        layer: LAYER.face,
        wobble: 0.02,
      });
      s.cyl(0.13, 0.16, 0.34, 6, at(spec.chimney, top + 0.3, cz), {
        color: TONE.tileDark,
        wobble: 0.01,
      });
    }
  });

  for (const side of ['s', 'n', 'e', 'w'] as const) {
    const frame = wallFrame(spec, side);
    s.group(frame.matrix, () => {
      const half = frame.length / 2;
      // Soubassement: deux assises de moellons qui dépassent du mur de 5 à 11 cm.
      for (let course = 0; course < 2; course += 1) {
        let x = -half - 0.06 + (course === 1 ? -0.2 : 0);
        let k = 0;
        while (x < half + 0.04) {
          const seed = course * 97 + k * 13 + side.charCodeAt(0);
          const length = Math.min(0.34 + rand(seed) * 0.4, half + 0.07 - x);
          const out = 0.05 + rand(seed + 1) * 0.06;
          if (!openingNear(spec, side, x + length / 2, 'door') && length > 0.08) {
            s.box(length - 0.02, 0.27, 0.2, at(x + length / 2, 0.14 + course * 0.28, out - 0.1), {
              color: STONES[Math.floor(rand(seed + 2) * STONES.length)] ?? TONE.stone,
              layer: LAYER.face,
              wobble: 0.016,
            });
          }
          x += length;
          k += 1;
        }
      }
      // Chaîne d'angle: pierres de taille alternées, longues puis courtes, au coin droit du mur.
      for (let i = 0; i * 0.36 + 0.6 < h - 0.2; i += 1) {
        const long = i % 2 === 0;
        s.box(
          long ? 0.56 : 0.34,
          0.33,
          long ? 0.4 : 0.62,
          at(
            half - (long ? 0.21 : 0.1),
            0.76 + i * 0.36,
            long ? -0.13 : -0.24,
            0,
            0,
            lean(i + half, 0.012),
          ),
          {
            color: STONES[(i + side.charCodeAt(0)) % STONES.length] ?? TONE.stone,
            layer: LAYER.face,
            wobble: 0.014,
          },
        );
      }
      // Pierres mises à nu là où l'enduit est tombé: en bas des murs et près des angles.
      for (let patch = 0; patch < 3; patch += 1) {
        const seed = patch * 41 + side.charCodeAt(0) * 3;
        const px = (rand(seed) - 0.5) * (frame.length - 1.6);
        const py = 0.8 + rand(seed + 1) * 0.5 + (patch === 2 ? h - 1.9 : 0);
        if (openingNear(spec, side, px, 'door') || openingNear(spec, side, px, 'window')) continue;
        for (let i = 0; i < 4; i += 1) {
          const row = i >> 1;
          s.box(
            0.3 + rand(seed + i) * 0.16,
            0.2,
            0.1,
            at(px + (i % 2) * 0.42 + row * 0.18, py + row * 0.22, rand(seed + i + 9) * 0.02),
            {
              color: STONES[(i + patch) % STONES.length] ?? TONE.stone,
              layer: LAYER.face,
              wobble: 0.016,
            },
          );
        }
      }
    });
  }

  for (const opening of spec.openings) {
    const frame = wallFrame(spec, opening.side);
    const matrix = frame.matrix.clone().multiply(at(opening.along, 0, 0));
    if (opening.kind === 'door') door(s, matrix, spec.shutter);
    else if (opening.floor === 1)
      windowUnit(s, matrix.multiply(at(0, 3.3, 0)), spec.shutter, 0.8, 0.95);
    else windowUnit(s, matrix.multiply(at(0, 0.95, 0)), spec.shutter);
  }
}

/**
 * Fenêtres du rez-de-chaussée d'un bâtiment, pour la lumière qu'elles jettent dehors la nuit:
 * milieu de l'appui sur le nu du mur, taille, normale vers le dehors.
 */
export function windowLights(spec: BuildingSpec): WindowLight[] {
  const lights: WindowLight[] = [];
  const origin = new THREE.Vector3();
  const outward = new THREE.Vector3();
  for (const opening of spec.openings) {
    if (opening.kind !== 'window' || (opening.floor ?? 0) !== 0) continue;
    const frame = wallFrame(spec, opening.side);
    origin.set(opening.along, 0.95, 0).applyMatrix4(frame.matrix);
    outward.set(0, 0, 1).transformDirection(frame.matrix);
    lights.push({
      x: origin.x,
      sill: origin.y,
      z: origin.z,
      width: 0.95,
      height: 1.25,
      nx: outward.x,
      nz: outward.z,
    });
  }
  return lights;
}

/**
 * Bout de quai: deux marches de pierre pour monter du chemin (le quai fait 30 cm: une marche de
 * 15 cm, puis le quai). Repère: pied des marches à l'origine, on monte vers +x, largeur le long de z.
 */
export function platformSteps(s: Sculpt, matrix: THREE.Matrix4, width: number): void {
  s.group(matrix, () => {
    let z = -width / 2;
    let k = 0;
    while (z < width / 2 - 0.05) {
      const length = Math.min(0.55 + rand(k * 7 + 3) * 0.5, width / 2 - z);
      s.box(
        0.42,
        0.17,
        length - 0.02,
        at(0.2, 0.075 + lean(k, 0.006), z + length / 2, lean(k + 1, 0.01)),
        {
          color: STONES[k % STONES.length] ?? TONE.stone,
          layer: LAYER.face,
          wobble: 0.01,
        },
      );
      z += length;
      k += 1;
    }
  });
}

/**
 * Quai: un massif et, dessus, des dalles posées une à une (rangs de 67 cm, longueurs inégales,
 * désaffleurées de quelques millimètres); la bordure côté voie (-z) est en pierres plus hautes.
 */
export function platform(
  s: Sculpt,
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  height: number,
): void {
  s.group(at(0, 0, 0), () => {
    s.box(
      x1 - x0 - 0.1,
      height - 0.06,
      z1 - z0 - 0.1,
      at((x0 + x1) / 2, (height - 0.06) / 2, (z0 + z1) / 2),
      { color: TONE.stoneDark, layer: LAYER.wall },
    );
    const rows = Math.round((z1 - z0) / 0.67);
    const depth = (z1 - z0) / rows;
    for (let row = 0; row < rows; row += 1) {
      const edge = row === 0 || row === rows - 1;
      let x = x0;
      let k = 0;
      while (x < x1 - 0.05) {
        const seed = row * 53 + k * 11;
        const length = Math.min((edge ? 0.9 : 0.6) + rand(seed) * 0.7, x1 - x);
        const thick = edge ? height : 0.09;
        // Bordure: la pierre de rive côté voie déborde de 6 cm et dépasse de 2 cm, en nez de marche.
        const nose = row === 0 ? 0.06 : 0;
        s.box(
          length - 0.022,
          thick,
          depth - 0.022 + nose,
          at(
            x + length / 2,
            height - thick / 2 + lean(seed + 1, 0.007) + (row === 0 ? 0.02 : 0),
            z0 + (row + 0.5) * depth - nose / 2,
            lean(seed + 2, 0.008),
            lean(seed + 3, 0.004),
            lean(seed + 4, 0.004),
          ),
          {
            color: STONES[Math.floor(rand(seed + 5) * STONES.length)] ?? TONE.stone,
            layer: LAYER.face,
            wobble: 0.008,
          },
        );
        x += length;
        k += 1;
      }
    }
  });
}

/** Plancher: des planches de 17 à 21 cm posées une à une le long de x, aboutées, désaffleurées. */
export function plankFloor(s: Sculpt, w: number, d: number): void {
  const woods: readonly Rgb[] = [TONE.wood, hex('#CC9C60'), hex('#DDB277'), hex('#C39258')];
  s.group(at(0, 0, 0), () => {
    s.box(w, 0.1, d, at(0, -0.07, 0), { color: TONE.ink });
    let z = -d / 2;
    let row = 0;
    while (z < d / 2 - 0.02) {
      const width = Math.min(0.17 + rand(row * 3.3) * 0.04, d / 2 - z);
      let x = -w / 2;
      let k = 0;
      while (x < w / 2 - 0.02) {
        const seed = row * 29 + k * 5;
        const length = Math.min(1.6 + rand(seed) * 2.6, w / 2 - x);
        s.box(
          length - 0.012,
          0.05,
          width - 0.012,
          at(x + length / 2, -0.025 + lean(seed + 1, 0.004), z + width / 2, lean(seed + 2, 0.003)),
          {
            color: woods[Math.floor(rand(seed + 3) * woods.length)] ?? TONE.wood,
            layer: LAYER.grain,
            grain: 'x',
            wobble: 0.003,
          },
        );
        x += length;
        k += 1;
      }
      z += width;
      row += 1;
    }
  });
}
