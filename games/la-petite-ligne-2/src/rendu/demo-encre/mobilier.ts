/**
 * Essai « encre »: les objets posés qui font qu'une pièce est habitée (passe 3). Même règle que
 * `decor.ts`: chaque fonction décrit un objet autour de son pied (y = 0 au sol, face vers +z),
 * avec des cotes réelles, en morceaux épais; on le pose par une matrice, et la scène dit pourquoi
 * il est là.
 */
import * as THREE from 'three';

import { lean, TONE } from './decor';
import { at, GLOW, hex, LAYER, type Rgb, type Sculpt } from './formes';

/** Horloge comtoise de 2,05 m: caisse de bois, tête vitrée, cadran émaillé, lentille de laiton. */
export function longcaseClock(s: Sculpt, matrix: THREE.Matrix4): void {
  s.group(matrix, () => {
    const wood = { color: TONE.woodDark, layer: LAYER.grain, grain: 'y', wobble: 0.008 } as const;
    s.box(0.5, 0.16, 0.3, at(0, 0.08, 0), wood);
    s.box(0.4, 1.3, 0.24, at(0, 0.8, 0), wood);
    s.box(0.52, 0.5, 0.3, at(0, 1.7, 0), wood);
    s.box(0.6, 0.07, 0.36, at(0, 1.985, 0, 0, 0, 0.01), { color: TONE.woodOld, wobble: 0.006 });
    s.box(0.44, 0.06, 0.28, at(0, 1.44, 0), { color: TONE.woodOld, wobble: 0.006 });
    s.newId();
    // Cadran: un disque d'émail, deux aiguilles (il est 5 h 12, comme à la pendule du quai).
    s.cyl(0.19, 0.19, 0.03, 10, at(0, 1.72, 0.15, 0, Math.PI / 2, 0), { color: TONE.chalk });
    s.box(0.025, 0.12, 0.012, at(-0.02, 1.68, 0.172, 0, 0, 0.5), { color: TONE.ink });
    s.box(0.02, 0.16, 0.012, at(0.05, 1.76, 0.172, 0, 0, -1.25), { color: TONE.ink });
    s.newId();
    // Lucarne de la lentille: on voit le balancier de laiton.
    s.box(0.2, 0.5, 0.02, at(0, 0.9, 0.125), { color: TONE.glass, wobble: 0.003 });
    s.cyl(0.07, 0.07, 0.02, 8, at(0.03, 0.78, 0.14, 0, Math.PI / 2, 0), { color: TONE.brass });
    s.box(0.014, 0.3, 0.012, at(0.015, 0.95, 0.14, 0, 0, 0.08), { color: TONE.brass });
  });
}

/** Malle de voyage de 90 cm: douves, cornières de fer, poignées de cuir, couvercle bombé. */
export function trunk(s: Sculpt, matrix: THREE.Matrix4): void {
  s.group(matrix, () => {
    for (let i = 0; i < 4; i += 1) {
      s.box(0.9, 0.105, 0.5, at(0, 0.06 + i * 0.108, 0, 0, 0, lean(i, 0.006)), {
        color: i % 2 ? TONE.woodOld : hex('#7D6245'),
        layer: LAYER.grain,
        grain: 'x',
        wobble: 0.008,
      });
    }
    s.box(0.94, 0.09, 0.54, at(0, 0.48, 0), {
      color: TONE.woodDark,
      layer: LAYER.grain,
      grain: 'x',
      wobble: 0.012,
    });
    s.box(0.8, 0.05, 0.42, at(0, 0.54, 0), { color: TONE.woodOld, wobble: 0.012 });
    s.newId();
    for (const x of [-0.3, 0.3]) {
      s.box(0.07, 0.56, 0.56, at(x, 0.28, 0), { color: TONE.iron, wobble: 0.006 });
    }
    s.box(0.12, 0.12, 0.03, at(0, 0.4, 0.265), { color: TONE.brass });
    for (const x of [-0.47, 0.47]) {
      s.box(0.03, 0.05, 0.2, at(x, 0.3, 0), { color: hex('#6B4A33') });
    }
  });
}

/** Chat roulé en boule: il dort là où il fait chaud (devant le poêle, sur l'édredon). */
export function cat(s: Sculpt, matrix: THREE.Matrix4, coat: Rgb = hex('#C98A4B')): void {
  s.group(matrix, () => {
    s.blob(0.2, 0.11, 0.16, at(0, 0.1, 0), { color: coat, wobble: 0.02 });
    s.blob(0.085, 0.075, 0.08, at(0.15, 0.13, 0.09), { color: coat, wobble: 0.008 }, 0);
    for (const dz of [-0.035, 0.045]) {
      s.cyl(0.004, 0.03, 0.06, 3, at(0.16, 0.21, 0.09 + dz, 0, 0, 0.1), { color: coat });
    }
    // La queue ramenée contre le flanc, le bout blanc.
    const tail = [
      new THREE.Vector3(-0.17, 0.06, -0.04),
      new THREE.Vector3(-0.2, 0.05, 0.1),
      new THREE.Vector3(-0.05, 0.05, 0.18),
      new THREE.Vector3(0.1, 0.05, 0.17),
    ] as const;
    s.limb(tail[0], tail[1], 0.035, 0.032, 5, { color: coat, wobble: 0.004 });
    s.limb(tail[1], tail[2], 0.032, 0.028, 5, { color: coat, wobble: 0.004 });
    s.limb(tail[2], tail[3], 0.028, 0.02, 5, { color: TONE.chalk, wobble: 0.004 });
  });
}

/** Paire de bottes de caoutchouc posées près de la porte, l'une couchée. */
export function boots(s: Sculpt, matrix: THREE.Matrix4): void {
  s.group(matrix, () => {
    const rubber = { color: hex('#4E6B4A'), wobble: 0.008 } as const;
    s.cyl(0.07, 0.065, 0.36, 6, at(0, 0.2, 0), rubber);
    s.box(0.13, 0.08, 0.27, at(0, 0.04, 0.06), rubber);
    s.cyl(0.07, 0.065, 0.36, 6, at(0.22, 0.07, 0.1, 0.4, Math.PI / 2 - 0.05, 0), rubber);
    s.box(0.13, 0.27, 0.08, at(0.2, 0.13, -0.11, 0.4, 0, 0), rubber);
  });
}

/** Balai de bouleau appuyé dans un angle: manche de 1,3 m, brins liés. */
export function broom(s: Sculpt, matrix: THREE.Matrix4): void {
  s.group(matrix, () => {
    s.limb(new THREE.Vector3(0, 0.3, 0), new THREE.Vector3(0.12, 1.5, -0.2), 0.018, 0.016, 5, {
      color: TONE.wood,
      wobble: 0.004,
    });
    for (let i = 0; i < 6; i += 1) {
      const angle = i * 1.05;
      s.limb(
        new THREE.Vector3(0, 0.34, 0),
        new THREE.Vector3(Math.cos(angle) * 0.1 - 0.03, 0.0, Math.sin(angle) * 0.1 + 0.04),
        0.03,
        0.012,
        4,
        { color: i % 2 ? hex('#B79A5E') : hex('#A2854F'), wobble: 0.006 },
      );
    }
    s.cyl(0.04, 0.04, 0.05, 6, at(0, 0.33, 0), { color: TONE.woodOld });
  });
}

/** Panier d'osier plein: pommes ou légumes du potager, une anse. */
export function basket(s: Sculpt, matrix: THREE.Matrix4, load: Rgb = TONE.poppy): void {
  s.group(matrix, () => {
    s.cyl(0.21, 0.16, 0.2, 8, at(0, 0.1, 0), {
      color: hex('#C29A5B'),
      layer: LAYER.wood,
      grain: 'x',
      wobble: 0.012,
    });
    s.cyl(0.225, 0.225, 0.035, 8, at(0, 0.2, 0), { color: hex('#A9814A'), wobble: 0.008 });
    for (const [x, z, r] of [
      [0.06, 0.03, 0.065],
      [-0.07, 0.05, 0.06],
      [0, -0.08, 0.062],
      [-0.02, 0.0, 0.058],
    ] as const) {
      s.blob(r, r * 0.9, r, at(x, 0.23 + r * 0.3, z), { color: load, wobble: 0.008 }, 0);
    }
    // L'anse: trois tronçons d'osier.
    const a = new THREE.Vector3(-0.2, 0.2, 0);
    const b = new THREE.Vector3(-0.1, 0.4, 0);
    const c = new THREE.Vector3(0.1, 0.4, 0);
    const d = new THREE.Vector3(0.2, 0.2, 0);
    const handle = { color: hex('#A9814A'), wobble: 0.003 } as const;
    s.limb(a, b, 0.014, 0.014, 4, handle);
    s.limb(b, c, 0.014, 0.014, 4, handle);
    s.limb(c, d, 0.014, 0.014, 4, handle);
  });
}

/** Bouilloire d'émail posée sur le poêle. */
export function kettle(s: Sculpt, matrix: THREE.Matrix4): void {
  s.group(matrix, () => {
    s.cyl(0.09, 0.12, 0.14, 8, at(0, 0.07, 0), { color: TONE.enamel, wobble: 0.005 });
    s.cyl(0.04, 0.06, 0.035, 8, at(0, 0.155, 0), { color: TONE.enamel });
    s.blob(0.02, 0.02, 0.02, at(0, 0.185, 0), { color: TONE.ink }, 0);
    s.limb(new THREE.Vector3(0.09, 0.07, 0), new THREE.Vector3(0.2, 0.15, 0), 0.03, 0.014, 5, {
      color: TONE.enamel,
      wobble: 0.003,
    });
    s.limb(new THREE.Vector3(-0.08, 0.14, 0), new THREE.Vector3(0, 0.25, 0), 0.012, 0.012, 4, {
      color: TONE.iron,
    });
    s.limb(new THREE.Vector3(0, 0.25, 0), new THREE.Vector3(0.08, 0.14, 0), 0.012, 0.012, 4, {
      color: TONE.iron,
    });
  });
}

/** Chevet: petite table à tiroir, un livre et un bougeoir dessus. */
export function nightstand(s: Sculpt, matrix: THREE.Matrix4): void {
  s.group(matrix, () => {
    const wood = { color: TONE.wood, layer: LAYER.grain, grain: 'y', wobble: 0.008 } as const;
    for (const [x, z] of [
      [-0.17, -0.14],
      [0.17, -0.14],
      [-0.17, 0.14],
      [0.17, 0.14],
    ] as const) {
      s.box(0.05, 0.5, 0.05, at(x, 0.25, z, 0, 0, lean(x + z, 0.02)), wood);
    }
    s.box(0.4, 0.16, 0.34, at(0, 0.44, 0), { ...wood, grain: 'x' });
    s.box(0.46, 0.04, 0.4, at(0, 0.54, 0, 0.02), { color: TONE.woodDark, wobble: 0.008 });
    s.blob(0.02, 0.02, 0.02, at(0, 0.44, 0.18), { color: TONE.brass }, 0);
    s.newId();
    s.box(0.2, 0.035, 0.14, at(-0.07, 0.58, 0.02, 0.3), { color: TONE.brick, wobble: 0.004 });
    s.box(0.19, 0.02, 0.13, at(-0.07, 0.605, 0.02, 0.3), { color: TONE.chalk, wobble: 0.003 });
    s.newId();
    s.cyl(0.06, 0.07, 0.02, 8, at(0.12, 0.57, -0.06), { color: TONE.brass });
    s.cyl(0.018, 0.02, 0.12, 6, at(0.12, 0.64, -0.06), { color: TONE.chalk });
    s.blob(0.016, 0.03, 0.016, at(0.12, 0.72, -0.06), { color: TONE.mustard, glow: GLOW.flame }, 0);
  });
}

/** Bouquets d'herbes sèches pendus à une poutre, la tête en bas. Dos au mur (-z). */
export function hangingHerbs(s: Sculpt, matrix: THREE.Matrix4): void {
  s.group(matrix, () => {
    const tones: readonly Rgb[] = [hex('#8FA44E'), hex('#B79A5E'), hex('#A58CA8'), hex('#7E9547')];
    for (let i = 0; i < 4; i += 1) {
      const x = (i - 1.5) * 0.24 + lean(i, 0.03);
      const length = 0.26 + (i % 2) * 0.08;
      s.cyl(0.006, 0.006, 0.1, 3, at(x, -0.05, 0.05), { color: TONE.linen });
      s.cyl(0.03, 0.075, length, 5, at(x, -0.1 - length / 2, 0.05, i, 0, lean(i + 4, 0.08)), {
        color: tones[i] ?? TONE.leaf,
        wobble: 0.012,
      });
    }
  });
}

/** Tonneau à eau de pluie sous la descente de gouttière: douves, deux cercles de fer, eau sombre. */
export function rainBarrel(s: Sculpt, matrix: THREE.Matrix4): void {
  s.group(matrix, () => {
    s.cyl(0.36, 0.31, 0.45, 9, at(0, 0.225, 0), {
      color: TONE.woodOld,
      layer: LAYER.wood,
      grain: 'y',
      wobble: 0.012,
    });
    s.cyl(0.33, 0.36, 0.42, 9, at(0, 0.66, 0), {
      color: TONE.woodOld,
      layer: LAYER.wood,
      grain: 'y',
      wobble: 0.012,
    });
    s.cyl(0.3, 0.3, 0.02, 9, at(0, 0.84, 0), { color: TONE.glass, wobble: 0.004 });
    s.newId();
    for (const y of [0.2, 0.68]) {
      s.cyl(0.372, 0.365, 0.05, 9, at(0, y, 0), { color: TONE.iron, wobble: 0.006 });
    }
  });
}

/**
 * Soubassement vu du dehors: une assise de moellons qui dépasse du mur, du sol du jardin jusqu'au
 * niveau du plancher. Repère du mur: x le long, +z vers le dehors; `drop` est la hauteur du
 * plancher au-dessus du jardin.
 */
export function footing(
  s: Sculpt,
  matrix: THREE.Matrix4,
  length: number,
  drop: number,
  skip: readonly (readonly [number, number])[],
): void {
  const stones: readonly Rgb[] = [TONE.stone, hex('#D2C6AC'), TONE.stoneDark, hex('#C9BDA6')];
  s.group(matrix, () => {
    let x = -length / 2 - 0.2;
    let k = 0;
    while (x < length / 2 + 0.2) {
      const width = Math.min(0.36 + (lean(k * 3.1, 0.5) + 0.5) * 0.4, length / 2 + 0.22 - x);
      const centre = x + width / 2;
      if (width > 0.08 && !skip.some(([a, b]) => centre > a && centre < b)) {
        const high = drop + 0.3 + lean(k, 0.03);
        s.box(
          width - 0.02,
          high,
          0.22,
          at(centre, high / 2 - drop - 0.12, 0.21 + lean(k + 7, 0.02)),
          {
            color: stones[k % stones.length] ?? TONE.stone,
            layer: LAYER.face,
            wobble: 0.016,
          },
        );
      }
      x += width;
      k += 1;
    }
  });
}
