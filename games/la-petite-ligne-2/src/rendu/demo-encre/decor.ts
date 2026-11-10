/**
 * Essai « encre »: les gabarits de décor. Chaque fonction décrit un objet autour de son pied
 * (y = 0 au sol, face vers +z) avec des cotes réelles; on le pose par une matrice. Les objets
 * sont trapus: planches de 5 cm, pieds larges, ferrures grossies (bible 0.2, section 3.5).
 * Couleurs: tons clairs du nuancier 0.2; le second ton et l'ombre viennent de la matière.
 */
import * as THREE from 'three';

import { at, GLOW, hex, LAYER, type Rgb, type Sculpt } from './formes';

export const TONE = {
  ink: hex('#231A17'),
  plaster: hex('#F5E6C6'),
  plasterInside: hex('#F1DDB8'),
  tile: hex('#D98C62'),
  tileDark: hex('#AD6244'),
  wood: hex('#D7A86A'),
  woodDark: hex('#A87A46'),
  woodOld: hex('#8C6F4E'),
  stone: hex('#DED3BC'),
  stoneDark: hex('#B6A890'),
  leaf: hex('#9DBB5B'),
  leafDark: hex('#7FA049'),
  shutter: hex('#8DB0AE'),
  glass: hex('#3C5560'),
  iron: hex('#4A4D52'),
  steel: hex('#8C8E91'),
  brass: hex('#C8A150'),
  linen: hex('#D9CAAE'),
  chalk: hex('#F3EDE0'),
  poppy: hex('#C5443D'),
  brick: hex('#8F3B34'),
  mustard: hex('#D4A33E'),
  sage: hex('#96A98C'),
  slate: hex('#587F8E'),
  rose: hex('#CC9C96'),
  enamel: hex('#44618A'),
} as const;

/** Tirage reproductible pour les petits écarts de pose (un objet un peu de guingois). */
export function lean(seed: number, amount: number): number {
  const s = Math.sin(seed * 91.7 + 13.1) * 43758.5453;
  return (s - Math.floor(s) - 0.5) * 2 * amount;
}

/** Lanterne d'applique: potence et cage vitrée. Rend la position de la flamme (repère du mur). */
export function wallLantern(s: Sculpt, matrix: THREE.Matrix4): void {
  s.group(matrix, () => {
    s.box(0.06, 0.06, 0.42, at(0, 0.3, 0.2), { color: TONE.iron });
    s.box(0.05, 0.3, 0.05, at(0, 0.16, 0.03), { color: TONE.iron });
    s.cyl(0.02, 0.17, 0.14, 4, at(0, 0.22, 0.38, Math.PI / 4), { color: TONE.iron });
    s.newId();
    s.box(0.2, 0.26, 0.2, at(0, 0.02, 0.38), {
      color: TONE.brass,
      glow: GLOW.flame,
      wobble: 0.004,
    });
    s.newId();
    s.box(0.24, 0.04, 0.24, at(0, -0.12, 0.38), { color: TONE.iron });
  });
}

/** Banc de 1,5 m: assise à 45 cm, dossier à 85 cm, pieds en planche épaisse. */
export function bench(s: Sculpt, matrix: THREE.Matrix4, length = 1.5): void {
  s.group(matrix, () => {
    for (const sign of [-1, 1]) {
      s.box(0.09, 0.45, 0.44, at(sign * (length / 2 - 0.16), 0.22, 0, 0, 0, sign * 0.03), {
        color: TONE.woodDark,
        layer: LAYER.wood,
        grain: 'y',
      });
      s.box(0.08, 0.5, 0.09, at(sign * (length / 2 - 0.16), 0.66, -0.2, 0, -0.14, 0), {
        color: TONE.woodDark,
        layer: LAYER.wood,
        grain: 'y',
      });
    }
    for (let i = 0; i < 3; i += 1) {
      s.box(
        length,
        0.055,
        0.135,
        at(0, 0.47, -0.15 + i * 0.15, lean(i + length, 0.012), 0, lean(i + 3, 0.008)),
        {
          color: TONE.wood,
          layer: LAYER.wood,
          grain: 'x',
        },
      );
    }
    for (let i = 0; i < 2; i += 1) {
      s.box(
        length,
        0.13,
        0.05,
        at(0, 0.64 + i * 0.19, -0.2 - i * 0.03, 0, -0.14, lean(i + 7, 0.012)),
        {
          color: TONE.wood,
          layer: LAYER.wood,
          grain: 'x',
        },
      );
    }
  });
}

/** Réverbère de 3,3 m, potence tournée vers +z. La flamme est à (0, 3,05, 0,55). */
export function streetLamp(s: Sculpt, matrix: THREE.Matrix4): void {
  s.group(matrix, () => {
    s.box(0.36, 0.3, 0.36, at(0, 0.15, 0), { color: TONE.stoneDark, layer: LAYER.wall });
    s.cyl(0.055, 0.085, 3.0, 6, at(0, 1.8, 0, 0, 0, 0.012), { color: TONE.iron });
    s.cyl(0.1, 0.1, 0.1, 6, at(0, 1.2, 0), { color: TONE.iron });
    s.box(0.07, 0.07, 0.7, at(0, 3.3, 0.28), { color: TONE.iron });
    s.box(0.05, 0.05, 0.5, at(0, 3.1, 0.2, 0, 0.75, 0), { color: TONE.iron });
    s.cyl(0.03, 0.24, 0.18, 4, at(0, 3.28, 0.55, Math.PI / 4), { color: TONE.iron });
    s.newId();
    s.cyl(0.17, 0.11, 0.3, 4, at(0, 3.05, 0.55, Math.PI / 4), {
      color: TONE.brass,
      glow: GLOW.flame,
      wobble: 0.004,
    });
    s.newId();
    s.box(0.2, 0.05, 0.2, at(0, 2.88, 0.55), { color: TONE.iron });
  });
}

/** Caisse de livraison de 90 x 60 x 55 cm: planches, cornières et étiquette. */
export function crate(s: Sculpt, matrix: THREE.Matrix4): void {
  s.group(matrix, () => {
    s.box(0.9, 0.5, 0.6, at(0, 0.27, 0), {
      color: TONE.wood,
      layer: LAYER.wood,
      grain: 'x',
      wobble: 0.02,
    });
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        s.box(0.1, 0.56, 0.1, at(sx * 0.42, 0.28, sz * 0.27), {
          color: TONE.woodDark,
          layer: LAYER.wood,
          grain: 'y',
        });
      }
    }
    s.box(0.98, 0.06, 0.68, at(0, 0.56, 0.01, 0.04, 0, 0.03), {
      color: TONE.wood,
      layer: LAYER.wood,
      grain: 'x',
      wobble: 0.015,
    });
    s.box(0.1, 0.07, 0.7, at(-0.25, 0.6, 0.01, 0.04, 0, 0.03), { color: TONE.iron });
    s.box(0.1, 0.07, 0.7, at(0.25, 0.6, 0.01, 0.04, 0, 0.03), { color: TONE.iron });
    s.newId();
    s.box(0.3, 0.2, 0.02, at(0.1, 0.3, 0.31, 0, 0, -0.06), { color: TONE.chalk, wobble: 0.004 });
  });
}

/** Sac de toile ficelé, posé contre la caisse. */
export function sack(s: Sculpt, matrix: THREE.Matrix4): void {
  s.group(matrix, () => {
    s.blob(0.26, 0.3, 0.22, at(0, 0.27, 0), { color: TONE.linen, wobble: 0.03 });
    s.cyl(0.1, 0.05, 0.14, 5, at(0.02, 0.6, 0), { color: TONE.linen });
    s.box(0.14, 0.04, 0.14, at(0.01, 0.53, 0), { color: TONE.woodOld });
  });
}

/** Barrière de bois: poteaux tous les 2 m environ, deux lisses, le tout un peu de travers. */
export function fence(s: Sculpt, x0: number, x1: number, z: number): void {
  const spans = Math.max(1, Math.round((x1 - x0) / 2.1));
  const step = (x1 - x0) / spans;
  s.group(at(0, 0, z), () => {
    for (let i = 0; i <= spans; i += 1) {
      const x = x0 + i * step;
      s.box(
        0.15,
        1.2,
        0.15,
        at(
          x,
          0.58 + lean(x, 0.04),
          lean(x + 1, 0.03),
          lean(x, 0.2),
          lean(x + 2, 0.04),
          lean(x + 3, 0.05),
        ),
        {
          color: TONE.woodDark,
          layer: LAYER.wood,
          grain: 'y',
          wobble: 0.02,
        },
      );
      if (i === spans) break;
      for (const y of [0.45, 0.92]) {
        s.box(
          step + 0.2,
          0.11,
          0.05,
          at(x + step / 2, y + lean(x + y, 0.03), 0.09, 0, 0, lean(x * 3 + y, 0.035)),
          {
            color: TONE.wood,
            layer: LAYER.wood,
            grain: 'x',
            wobble: 0.015,
          },
        );
      }
    }
  });
}

/**
 * Arbre: tronc coudé à pans, deux branches, houppier en cinq grandes masses cabossées, chacune
 * hérissée de petites touffes qui découpent sa silhouette. Le dessous des masses est un noir
 * plein: vu d'en haut, c'est lui qui détache une masse de la suivante.
 */
export function tree(s: Sculpt, x: number, z: number, size: number, seed: number): void {
  const under = hex('#2B3320');
  s.group(at(x, 0, z, lean(seed, 3)), () => {
    const bark = { color: TONE.woodOld, layer: LAYER.bark, wobble: 0.03 } as const;
    const a = new THREE.Vector3(0, 0, 0);
    const b = new THREE.Vector3(0.18 * size, 1.5 * size, 0.05);
    const c = new THREE.Vector3(-0.1 * size, 3.0 * size, -0.12);
    // Empattement: trois racines qui sortent de terre.
    for (let i = 0; i < 3; i += 1) {
      const angle = i * 2.1 + seed;
      s.limb(
        new THREE.Vector3(0, 0.35 * size, 0),
        new THREE.Vector3(Math.cos(angle) * 0.75 * size, -0.05, Math.sin(angle) * 0.75 * size),
        0.2 * size,
        0.07 * size,
        5,
        bark,
      );
    }
    s.limb(a, b, 0.36 * size, 0.25 * size, 6, bark);
    s.limb(b, c, 0.25 * size, 0.17 * size, 6, bark);
    s.limb(
      b,
      new THREE.Vector3(1.1 * size, 2.7 * size, 0.5 * size),
      0.14 * size,
      0.08 * size,
      5,
      bark,
    );
    s.limb(
      c,
      new THREE.Vector3(-1.0 * size, 3.9 * size, -0.4 * size),
      0.13 * size,
      0.07 * size,
      5,
      bark,
    );
    const masses: readonly (readonly [number, number, number, number])[] = [
      [0, 4.7, 0, 1.7],
      [1.4, 3.7, 0.6, 1.25],
      [-1.35, 4.0, -0.5, 1.3],
      [0.3, 3.8, -1.35, 1.15],
      [-0.5, 3.55, 1.25, 1.1],
    ];
    masses.forEach(([mx, my, mz, r], i) => {
      s.newId();
      const tone = i % 2 === 0 ? TONE.leaf : TONE.leafDark;
      s.blob(
        r * size,
        r * size * 0.66,
        r * size * 0.95,
        at(mx * size, my * size, mz * size, lean(seed + i, 3)),
        {
          color: tone,
          bottomColor: under,
          layer: LAYER.leaf,
          wobble: 0.2 * size,
        },
      );
      // Touffes du pourtour: elles donnent au contour ses dents.
      const tufts = 7;
      for (let k = 0; k < tufts; k += 1) {
        const angle = (k / tufts) * Math.PI * 2 + lean(seed * 3 + i * 7 + k, 0.4);
        const reach = r * size * (0.82 + lean(seed + i + k * 3, 0.12));
        const rr = r * size * (0.3 + lean(seed * 5 + k + i, 0.08));
        s.blob(
          rr,
          rr * 0.6,
          rr,
          at(
            mx * size + Math.cos(angle) * reach,
            my * size - r * size * 0.12 + lean(k + i, 0.2) * size,
            mz * size + Math.sin(angle) * reach * 0.95,
            angle,
          ),
          {
            color: k % 3 === 0 ? TONE.leafDark : tone,
            bottomColor: under,
            layer: LAYER.leaf,
            wobble: 0.07 * size,
          },
          0,
        );
      }
    });
  });
}

/** Buisson: deux ou trois masses basses. */
export function bush(s: Sculpt, x: number, z: number, size: number, seed: number): void {
  s.group(at(x, 0, z, lean(seed, 3)), () => {
    const under = hex('#2B3320');
    s.blob(0.75 * size, 0.55 * size, 0.65 * size, at(0, 0.45 * size, 0), {
      color: TONE.leafDark,
      bottomColor: under,
      layer: LAYER.leaf,
      wobble: 0.12,
    });
    s.newId();
    s.blob(0.55 * size, 0.42 * size, 0.5 * size, at(0.6 * size, 0.34 * size, 0.2 * size, 1), {
      color: TONE.leaf,
      bottomColor: under,
      layer: LAYER.leaf,
      wobble: 0.1,
    });
    s.newId();
    s.blob(0.45 * size, 0.36 * size, 0.45 * size, at(-0.5 * size, 0.3 * size, -0.25 * size, 2), {
      color: TONE.leaf,
      bottomColor: under,
      layer: LAYER.leaf,
      wobble: 0.1,
    });
    for (let k = 0; k < 6; k += 1) {
      const angle = k * 1.05 + seed;
      s.blob(
        0.24 * size,
        0.2 * size,
        0.24 * size,
        at(
          Math.cos(angle) * 0.75 * size,
          (0.3 + lean(k + seed, 0.15)) * size,
          Math.sin(angle) * 0.62 * size,
          angle,
        ),
        {
          color: k % 2 ? TONE.leaf : TONE.leafDark,
          bottomColor: under,
          layer: LAYER.leaf,
          wobble: 0.05,
        },
        0,
      );
    }
  });
}

/** Voie: deux rails à l'écartement normal (1,435 m) sur traverses de 2,5 m tous les 62 cm. */
export function track(s: Sculpt, x0: number, x1: number, z: number): void {
  s.newId();
  for (let x = x0; x <= x1; x += 0.62) {
    s.box(0.24, 0.13, 2.5 + lean(x, 0.08), at(x, 0.065, z + lean(x + 5, 0.04), lean(x, 0.035)), {
      color: TONE.woodOld,
      layer: LAYER.wood,
      grain: 'z',
      wobble: 0.015,
    });
  }
  s.newId();
  for (const sign of [-1, 1]) {
    s.box(x1 - x0, 0.13, 0.075, at((x0 + x1) / 2, 0.19, z + sign * 0.755), {
      color: TONE.steel,
      topColor: hex('#C9CBCC'),
      wobble: 0.003,
    });
  }
}

/** Tas de bûches contre un mur: trois rangs, pour le poêle. */
export function woodpile(s: Sculpt, matrix: THREE.Matrix4): void {
  s.group(matrix, () => {
    for (let row = 0; row < 3; row += 1) {
      for (let i = 0; i < 6 - row; i += 1) {
        const x = (i - (5 - row) / 2) * 0.24;
        s.cyl(
          0.11,
          0.11,
          0.5 + lean(row * 7 + i, 0.06),
          6,
          at(x, 0.11 + row * 0.2, lean(i + row, 0.03), 0, Math.PI / 2, lean(i, 0.2)),
          {
            color: row === 1 && i % 2 === 0 ? TONE.wood : TONE.woodDark,
            topColor: TONE.wood,
            layer: LAYER.bark,
            grain: 'y',
          },
        );
      }
    }
  });
}

/** Pendule de quai sur potence, arrêtée sur 5 h 12 (plan: point d'intérêt 3). */
export function stationClock(s: Sculpt, matrix: THREE.Matrix4): void {
  s.group(matrix, () => {
    s.box(0.07, 0.07, 0.6, at(0, 0.36, 0.3), { color: TONE.iron });
    s.cyl(0.36, 0.36, 0.2, 8, at(0, 0, 0.6, 0, 0, Math.PI / 2), { color: TONE.iron });
    s.newId();
    for (const sign of [-1, 1]) {
      s.cyl(0.3, 0.3, 0.02, 8, at(sign * 0.105, 0, 0.6, 0, 0, Math.PI / 2), {
        color: TONE.chalk,
        wobble: 0.003,
      });
      // Petite aiguille entre 5 et 6, grande sur 12 minutes.
      s.box(0.02, 0.17, 0.045, at(sign * 0.12, -0.06, 0.6 - sign * 0.045, 0, sign * 0.55, 0), {
        color: TONE.ink,
        wobble: 0.002,
      });
      s.box(0.02, 0.25, 0.035, at(sign * 0.12, 0.03, 0.6 + sign * 0.11, 0, sign * 1.26, 0), {
        color: TONE.ink,
        wobble: 0.002,
      });
    }
  });
}

/* ------------------------------------------------------------------ Meubles */

export function table(s: Sculpt, matrix: THREE.Matrix4): void {
  s.group(matrix, () => {
    s.box(1.4, 0.07, 0.86, at(0, 0.745, 0, 0.012, 0, 0.008), {
      color: TONE.wood,
      layer: LAYER.wood,
      grain: 'x',
      wobble: 0.02,
    });
    s.box(1.14, 0.12, 0.6, at(0, 0.65, 0), { color: TONE.woodDark, layer: LAYER.wood, grain: 'x' });
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        s.cyl(
          0.055,
          0.04,
          0.7,
          4,
          at(sx * 0.56, 0.35, sz * 0.3, Math.PI / 4, sz * -0.05, sx * 0.05),
          { color: TONE.woodDark, layer: LAYER.wood, grain: 'y' },
        );
      }
    }
  });
}

export function chair(s: Sculpt, matrix: THREE.Matrix4, seat: Rgb = TONE.mustard): void {
  s.group(matrix, () => {
    for (const sx of [-1, 1]) {
      s.box(0.055, 0.45, 0.055, at(sx * 0.18, 0.225, 0.18, 0, 0.05, sx * 0.04), {
        color: TONE.woodDark,
        layer: LAYER.wood,
        grain: 'y',
      });
      s.box(0.055, 1.0, 0.055, at(sx * 0.18, 0.5, -0.19, 0, -0.07, sx * 0.02), {
        color: TONE.woodDark,
        layer: LAYER.wood,
        grain: 'y',
      });
    }
    s.box(0.46, 0.06, 0.44, at(0, 0.46, 0, 0.02, 0, 0), { color: seat, layer: LAYER.plain });
    s.box(0.4, 0.1, 0.035, at(0, 0.92, -0.225, 0, -0.07, 0.02), {
      color: TONE.woodDark,
      layer: LAYER.wood,
      grain: 'x',
    });
    s.box(0.4, 0.07, 0.03, at(0, 0.72, -0.21, 0, -0.07, -0.015), {
      color: TONE.woodDark,
      layer: LAYER.wood,
      grain: 'x',
    });
  });
}

/** Lit d'une personne (95 x 200 cm), tête vers -z: cadre, matelas, édredon rabattu, oreiller. */
export function bed(s: Sculpt, matrix: THREE.Matrix4, quilt: Rgb = TONE.slate): void {
  s.group(matrix, () => {
    s.box(1.05, 1.05, 0.09, at(0, 0.52, -1.0, 0, 0, 0.012), {
      color: TONE.woodDark,
      layer: LAYER.wood,
      grain: 'x',
      wobble: 0.02,
    });
    s.box(1.05, 0.62, 0.09, at(0, 0.31, 1.0, 0, 0, -0.01), {
      color: TONE.woodDark,
      layer: LAYER.wood,
      grain: 'x',
      wobble: 0.02,
    });
    for (const sx of [-1, 1]) {
      s.box(0.07, 0.2, 2.0, at(sx * 0.49, 0.32, 0), {
        color: TONE.woodDark,
        layer: LAYER.wood,
        grain: 'z',
      });
    }
    s.newId();
    s.box(0.9, 0.2, 1.9, at(0, 0.44, 0), { color: TONE.chalk, wobble: 0.02 });
    s.newId();
    s.box(0.98, 0.14, 1.25, at(0, 0.56, 0.33, 0, 0, 0.01), {
      color: quilt,
      layer: LAYER.plain,
      wobble: 0.03,
    });
    s.box(0.98, 0.07, 0.22, at(0, 0.64, -0.32), { color: TONE.chalk, wobble: 0.02 });
    s.newId();
    s.box(0.62, 0.14, 0.38, at(0.03, 0.6, -0.68, 0.06, 0, 0), { color: TONE.chalk, wobble: 0.035 });
  });
}

/** Buffet deux corps de 1,5 m: bas à deux portes, haut ouvert où l'on voit la vaisselle. */
export function dresser(s: Sculpt, matrix: THREE.Matrix4): void {
  s.group(matrix, () => {
    s.box(1.5, 0.9, 0.52, at(0, 0.5, 0), {
      color: TONE.wood,
      layer: LAYER.wood,
      grain: 'y',
      wobble: 0.02,
    });
    for (const sx of [-1, 1]) {
      s.cyl(0.06, 0.045, 0.1, 4, at(sx * 0.66, 0.05, 0.17, Math.PI / 4), { color: TONE.woodDark });
      s.cyl(0.06, 0.045, 0.1, 4, at(sx * 0.66, 0.05, -0.17, Math.PI / 4), { color: TONE.woodDark });
    }
    s.box(1.62, 0.07, 0.6, at(0, 0.98, 0.02, 0, 0, 0.006), {
      color: TONE.woodDark,
      layer: LAYER.wood,
      grain: 'x',
    });
    s.newId();
    for (const sx of [-1, 1]) {
      s.box(0.62, 0.66, 0.04, at(sx * 0.35, 0.52, 0.275, 0, 0, sx * 0.008), {
        color: TONE.shutter,
        layer: LAYER.wood,
        grain: 'y',
      });
      s.box(0.07, 0.1, 0.05, at(sx * 0.1, 0.56, 0.31), { color: TONE.brass });
      s.box(0.2, 0.06, 0.03, at(sx * 0.52, 0.74, 0.3), { color: TONE.iron });
    }
    s.newId();
    s.box(1.5, 0.95, 0.06, at(0, 1.49, -0.22), {
      color: TONE.woodDark,
      layer: LAYER.wood,
      grain: 'y',
    });
    for (const sx of [-1, 1]) {
      s.box(0.07, 0.95, 0.3, at(sx * 0.72, 1.49, -0.08), {
        color: TONE.wood,
        layer: LAYER.wood,
        grain: 'y',
      });
    }
    s.box(1.5, 0.05, 0.3, at(0, 1.5, -0.08), { color: TONE.wood, layer: LAYER.wood, grain: 'x' });
    s.box(1.62, 0.08, 0.36, at(0, 2.0, -0.07, 0, 0, -0.008), {
      color: TONE.woodDark,
      layer: LAYER.wood,
      grain: 'x',
    });
    // Vaisselle: assiettes debout au fond, pots et bol devant.
    s.newId();
    for (let i = 0; i < 4; i += 1) {
      s.cyl(0.13, 0.13, 0.025, 8, at(-0.5 + i * 0.3, 1.16, -0.14, 0, Math.PI / 2 - 0.2, 0), {
        color: i % 2 ? TONE.chalk : TONE.shutter,
        wobble: 0.004,
      });
    }
    s.newId();
    s.cyl(0.07, 0.09, 0.2, 6, at(-0.45, 1.63, -0.06), { color: TONE.poppy });
    s.cyl(0.09, 0.07, 0.14, 6, at(-0.15, 1.6, -0.06), { color: TONE.mustard });
    s.cyl(0.06, 0.08, 0.24, 6, at(0.3, 1.65, -0.06), { color: TONE.sage });
    s.box(0.2, 0.12, 0.14, at(0.52, 1.59, -0.06, 0.2), { color: TONE.chalk });
  });
}

/** Poêle de fonte sur pieds, tuyau coudé vers le mur du fond (-z), bouilloire. Foyer à (0, 0,4, 0,3). */
export function stove(s: Sculpt, matrix: THREE.Matrix4): void {
  s.group(matrix, () => {
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        s.cyl(
          0.05,
          0.035,
          0.16,
          4,
          at(sx * 0.24, 0.08, sz * 0.2, Math.PI / 4, sz * -0.12, sx * 0.12),
          { color: TONE.iron },
        );
      }
    }
    s.box(0.62, 0.66, 0.54, at(0, 0.48, 0), { color: TONE.iron, wobble: 0.02 });
    s.box(0.72, 0.07, 0.64, at(0, 0.84, 0), { color: hex('#5E6166'), wobble: 0.015 });
    s.box(0.66, 0.06, 0.58, at(0, 0.17, 0), { color: hex('#5E6166') });
    s.newId();
    s.box(0.34, 0.26, 0.04, at(0, 0.42, 0.28), { color: hex('#5E6166') });
    s.box(0.24, 0.14, 0.05, at(0, 0.42, 0.285), {
      color: TONE.mustard,
      glow: GLOW.flame,
      wobble: 0.003,
    });
    s.box(0.05, 0.05, 0.09, at(0.21, 0.52, 0.31), { color: TONE.brass });
    s.newId();
    s.cyl(0.085, 0.085, 1.25, 6, at(0.08, 1.5, -0.12), { color: hex('#5E6166'), wobble: 0.01 });
    s.cyl(0.085, 0.085, 0.5, 6, at(0.08, 2.1, -0.36, 0, Math.PI / 2, 0), {
      color: hex('#5E6166'),
      wobble: 0.01,
    });
    s.cyl(0.11, 0.11, 0.07, 6, at(0.08, 1.3, -0.12), { color: TONE.iron });
    s.newId();
    s.cyl(0.08, 0.13, 0.17, 6, at(-0.14, 0.96, 0.08), { color: TONE.enamel });
    s.box(0.04, 0.05, 0.16, at(-0.14, 0.98, 0.24, 0, -0.5, 0), { color: TONE.enamel });
    s.cyl(0.03, 0.03, 0.05, 5, at(-0.14, 1.07, 0.08), { color: TONE.ink });
  });
}

/** Tapis de 2,5 x 1,7 m: fond, bordure et deux bandes, franges aux petits côtés. */
export function rug(s: Sculpt, matrix: THREE.Matrix4): void {
  s.group(matrix, () => {
    s.box(2.5, 0.03, 1.7, at(0, 0.015, 0), { color: TONE.linen, wobble: 0.02 });
    s.box(2.26, 0.035, 1.46, at(0, 0.02, 0), { color: TONE.brick, wobble: 0.02 });
    s.box(1.9, 0.04, 1.1, at(0, 0.024, 0), { color: TONE.poppy, layer: LAYER.plain, wobble: 0.02 });
    for (const sz of [-1, 1]) {
      s.box(1.5, 0.045, 0.1, at(0, 0.027, sz * 0.36), { color: TONE.mustard, wobble: 0.01 });
    }
    for (let i = 0; i < 9; i += 1) {
      for (const sx of [-1, 1]) {
        s.box(0.14, 0.02, 0.05, at(sx * 1.3, 0.01, -0.72 + i * 0.18, lean(i * sx, 0.3)), {
          color: TONE.linen,
          wobble: 0.004,
        });
      }
    }
  });
}

/** Lampe à pétrole de table: pied de laiton, réservoir, verre. La flamme est à 0,3 m au-dessus du pied. */
export function oilLamp(s: Sculpt, matrix: THREE.Matrix4): void {
  s.group(matrix, () => {
    s.cyl(0.05, 0.1, 0.06, 6, at(0, 0.03, 0), { color: TONE.brass });
    s.cyl(0.09, 0.06, 0.12, 6, at(0, 0.12, 0), { color: TONE.brass });
    s.cyl(0.05, 0.05, 0.04, 6, at(0, 0.2, 0), { color: TONE.iron });
    s.newId();
    s.cyl(0.04, 0.075, 0.22, 6, at(0, 0.33, 0), {
      color: TONE.chalk,
      glow: GLOW.flame,
      wobble: 0.003,
    });
  });
}

/** Étagère murale de 1,3 m avec ses objets: livres, bocal, pot de fleurs, réveil. Dos au mur (-z). */
export function shelf(s: Sculpt, matrix: THREE.Matrix4): void {
  s.group(matrix, () => {
    s.box(1.3, 0.05, 0.24, at(0, 0, 0.12, 0, 0, 0.012), {
      color: TONE.woodDark,
      layer: LAYER.wood,
      grain: 'x',
    });
    for (const sx of [-1, 1]) {
      s.prism(
        [
          [0, 0],
          [0.2, 0],
          [0, -0.22],
        ],
        0.05,
        at(sx * 0.5, -0.02, 0, -Math.PI / 2),
        { color: TONE.woodDark },
      );
    }
    s.newId();
    const books: readonly (readonly [Rgb, number, number])[] = [
      [TONE.poppy, 0.26, 0],
      [TONE.enamel, 0.3, 0.02],
      [TONE.mustard, 0.22, -0.03],
      [TONE.sage, 0.28, 0.16],
    ];
    books.forEach(([color, height, tilt], i) => {
      s.box(
        0.055,
        height,
        0.17,
        at(-0.56 + i * 0.07 + (i === 3 ? 0.03 : 0), 0.025 + height / 2, 0.11, 0, 0, tilt),
        { color },
      );
    });
    s.newId();
    s.cyl(0.07, 0.07, 0.17, 6, at(-0.12, 0.11, 0.12), { color: TONE.glass });
    s.cyl(0.075, 0.075, 0.03, 6, at(-0.12, 0.21, 0.12), { color: TONE.brass });
    s.newId();
    s.cyl(0.09, 0.065, 0.13, 6, at(0.18, 0.09, 0.12), { color: TONE.tile });
    s.blob(
      0.13,
      0.12,
      0.11,
      at(0.18, 0.26, 0.12),
      { color: TONE.leaf, layer: LAYER.leaf, wobble: 0.03 },
      0,
    );
    s.newId();
    s.cyl(0.085, 0.085, 0.06, 8, at(0.47, 0.115, 0.13, 0, Math.PI / 2, 0), { color: TONE.brass });
    s.cyl(0.065, 0.065, 0.065, 8, at(0.47, 0.115, 0.135, 0, Math.PI / 2, 0), {
      color: TONE.chalk,
      wobble: 0.002,
    });
  });
}

/** Cadre accroché au mur (dos vers -z). */
export function picture(s: Sculpt, matrix: THREE.Matrix4, subject: Rgb): void {
  s.group(matrix, () => {
    s.box(0.5, 0.4, 0.04, at(0, 0, 0.02, 0, 0, 0.03), { color: TONE.woodDark });
    s.box(0.38, 0.28, 0.045, at(0, 0, 0.022, 0, 0, 0.03), {
      color: subject,
      layer: LAYER.plain,
      wobble: 0.004,
    });
  });
}

/** Seau à charbon et sa pelle, à côté du poêle. */
export function coalBucket(s: Sculpt, matrix: THREE.Matrix4): void {
  s.group(matrix, () => {
    s.cyl(0.17, 0.12, 0.3, 7, at(0, 0.15, 0), { color: TONE.steel, wobble: 0.015 });
    s.cyl(0.15, 0.15, 0.03, 7, at(0, 0.3, 0), { color: TONE.ink });
    s.box(0.03, 0.45, 0.03, at(0.1, 0.42, 0.02, 0, 0.1, -0.3), { color: TONE.woodDark });
  });
}

/** Patère avec un manteau pendu (dos vers -z). */
export function coatRack(s: Sculpt, matrix: THREE.Matrix4, coat: Rgb): void {
  s.group(matrix, () => {
    s.box(0.8, 0.1, 0.04, at(0, 0, 0.02), { color: TONE.woodDark, layer: LAYER.wood, grain: 'x' });
    for (const x of [-0.28, 0, 0.28])
      s.box(0.04, 0.04, 0.12, at(x, -0.01, 0.08, 0, -0.4, 0), { color: TONE.iron });
    s.newId();
    s.prism(
      [
        [-0.2, -0.95],
        [0.24, -0.98],
        [0.16, -0.05],
        [-0.14, -0.05],
      ],
      0.1,
      at(-0.28, 0, 0.1),
      { color: coat, wobble: 0.025 },
    );
  });
}

/** Paire de rideaux tirés de chaque côté d'une fenêtre, sous leur tringle (dos vers -z). */
export function curtains(
  s: Sculpt,
  matrix: THREE.Matrix4,
  width: number,
  height: number,
  cloth: Rgb,
): void {
  s.group(matrix, () => {
    s.cyl(0.02, 0.02, width + 0.5, 5, at(0, height + 0.12, 0.07, 0, 0, Math.PI / 2), {
      color: TONE.woodDark,
      wobble: 0.002,
    });
    for (const sign of [-1, 1]) {
      s.newId();
      // Trois plis par rideau: des prismes qui s'évasent vers le bas.
      for (let i = 0; i < 3; i += 1) {
        s.cyl(
          0.05,
          0.075,
          height + 0.2,
          4,
          at(
            sign * (width / 2 + 0.02 + i * 0.085),
            height / 2,
            0.06 + (i % 2) * 0.025,
            0.6,
            0,
            sign * 0.02,
          ),
          {
            color: i === 1 ? cloth : [cloth[0] * 0.9, cloth[1] * 0.9, cloth[2] * 0.9],
            wobble: 0.01,
          },
        );
      }
      s.box(0.3, 0.05, 0.1, at(sign * (width / 2 + 0.1), height * 0.42, 0.07), {
        color: TONE.mustard,
        wobble: 0.006,
      });
    }
  });
}

/** Couvert sur la table: deux assiettes, un bol, un pichet, un pain. Posé à la hauteur du plateau. */
export function tableware(s: Sculpt, matrix: THREE.Matrix4): void {
  s.group(matrix, () => {
    s.cyl(0.13, 0.09, 0.025, 8, at(-0.42, 0.013, 0.05), {
      color: TONE.chalk,
      topColor: hex('#E6DCC6'),
      wobble: 0.004,
    });
    s.cyl(0.13, 0.09, 0.025, 8, at(0.3, 0.013, 0.22), {
      color: TONE.chalk,
      topColor: hex('#E6DCC6'),
      wobble: 0.004,
    });
    s.newId();
    s.cyl(0.085, 0.055, 0.07, 7, at(-0.4, 0.06, 0.05), {
      color: TONE.enamel,
      topColor: TONE.linen,
      wobble: 0.004,
    });
    s.newId();
    s.cyl(0.06, 0.085, 0.2, 6, at(0.02, 0.1, -0.22), {
      color: TONE.tile,
      topColor: TONE.ink,
      wobble: 0.006,
    });
    s.box(0.03, 0.1, 0.07, at(0.02, 0.11, -0.31), { color: TONE.tile, wobble: 0.004 });
    s.newId();
    s.blob(
      0.16,
      0.07,
      0.09,
      at(0.42, 0.06, -0.16, 0.5),
      { color: hex('#C0803A'), wobble: 0.015 },
      0,
    );
  });
}

/** Paillasson tressé devant la porte. */
export function doormat(s: Sculpt, matrix: THREE.Matrix4): void {
  s.group(matrix, () => {
    for (let i = 0; i < 5; i += 1) {
      s.box(0.9, 0.035, 0.105, at(0, 0.018, -0.22 + i * 0.11, lean(i, 0.02)), {
        color: i % 2 ? TONE.woodOld : hex('#A88C6C'),
        layer: LAYER.grain,
        grain: 'x',
        wobble: 0.008,
      });
    }
  });
}

/** Casserole pendue à son clou (dos vers -z). */
export function hangingPan(s: Sculpt, matrix: THREE.Matrix4): void {
  s.group(matrix, () => {
    s.cyl(0.15, 0.13, 0.06, 8, at(0, -0.3, 0.05, 0, Math.PI / 2, 0), {
      color: TONE.iron,
      wobble: 0.004,
    });
    s.box(0.04, 0.26, 0.025, at(0, -0.06, 0.04), { color: TONE.iron, wobble: 0.003 });
    s.box(0.03, 0.03, 0.08, at(0, 0.06, 0.04), { color: TONE.brass });
  });
}

export interface WallOpening {
  /** Centre le long du mur (m), largeur, hauteur de l'appui et hauteur du vide. */
  readonly along: number;
  readonly width: number;
  readonly sill: number;
  readonly height: number;
}

/**
 * Mur intérieur avec ses vrais vides (le soleil passe par les fenêtres): repère du mur, x le
 * long, y en haut, +z vers le dehors. Le dessus est à l'encre: c'est la tranche d'un mur coupé.
 * Un lambris de 90 cm court au pied, côté pièce.
 */
export function roomWall(
  s: Sculpt,
  matrix: THREE.Matrix4,
  length: number,
  height: number,
  openings: readonly WallOpening[],
  panel: Rgb | null,
): void {
  const t = 0.3;
  s.group(matrix, () => {
    const piece = (x0: number, x1: number, y0: number, y1: number): void => {
      if (x1 - x0 < 0.02 || y1 - y0 < 0.02) return;
      s.box(x1 - x0, y1 - y0, t, at((x0 + x1) / 2, (y0 + y1) / 2, 0), {
        color: TONE.plasterInside,
        topColor: y1 >= height - 0.01 ? TONE.ink : TONE.stone,
        layer: LAYER.wall,
        wobble: 0.006,
      });
      if (panel && y0 < 0.9) {
        // Lambris: des planches debout de 16 cm, chacune un peu plus ou moins enfoncée.
        const top = Math.min(0.9, y1);
        const count = Math.max(1, Math.round((x1 - x0) / 0.16));
        const step = (x1 - x0) / count;
        for (let i = 0; i < count; i += 1) {
          const cx = x0 + (i + 0.5) * step;
          s.box(
            step - 0.008,
            top - y0,
            0.04,
            at(cx, (y0 + top) / 2, -t / 2 - 0.016 - lean(cx * 7, 0.006)),
            {
              color: panel,
              layer: LAYER.grain,
              grain: 'y',
              wobble: 0.003,
            },
          );
        }
      }
    };
    let cursor = -length / 2;
    for (const o of [...openings].sort((a, b) => a.along - b.along)) {
      const left = o.along - o.width / 2;
      const right = o.along + o.width / 2;
      piece(cursor, left, 0, height);
      piece(left, right, 0, Math.min(o.sill, height));
      piece(left, right, Math.min(o.sill + o.height, height), height);
      cursor = right;
    }
    piece(cursor, length / 2, 0, height);
    if (panel && height > 1) {
      // Pan de bois apparent: une sablière sous le plafond et un poteau tous les 1,6 m environ,
      // en saillie de 5 cm sur le plâtre (jamais devant une fenêtre).
      s.newId();
      s.box(length, 0.16, 0.08, at(0, height - 0.1, -t / 2 - 0.035, 0, 0, 0.003), {
        color: TONE.woodDark,
        layer: LAYER.grain,
        grain: 'x',
        wobble: 0.01,
      });
      const posts = Math.max(2, Math.round(length / 1.6));
      for (let i = 0; i <= posts; i += 1) {
        const px = -length / 2 + 0.25 + (i * (length - 0.5)) / posts;
        if (openings.some((o) => Math.abs(o.along - px) < o.width / 2 + 0.16)) continue;
        s.box(
          0.13,
          height - 1.08,
          0.07,
          at(
            px + lean(px, 0.02),
            0.96 + (height - 1.08) / 2,
            -t / 2 - 0.03,
            0,
            0,
            lean(px * 3, 0.012),
          ),
          {
            color: TONE.woodDark,
            layer: LAYER.grain,
            grain: 'y',
            wobble: 0.008,
          },
        );
      }
    }
    if (panel) {
      // Cimaise: la baguette qui coiffe le lambris, interrompue aux vides.
      s.newId();
      let from = -length / 2;
      for (const o of [...openings].sort((a, b) => a.along - b.along)) {
        if (o.sill < 0.9 && height > 0.9) {
          const to = o.along - o.width / 2;
          if (to - from > 0.05)
            s.box(to - from, 0.07, 0.06, at((from + to) / 2, 0.92, -t / 2 - 0.03), {
              color: TONE.woodDark,
              wobble: 0.004,
            });
          from = o.along + o.width / 2;
        }
      }
      if (height > 0.9 && length / 2 - from > 0.05)
        s.box(length / 2 - from, 0.07, 0.06, at((from + length / 2) / 2, 0.92, -t / 2 - 0.03), {
          color: TONE.woodDark,
          wobble: 0.004,
        });
    }
  });
}

/** Croisée d'une fenêtre vue de l'intérieur: dormant et petits bois, dans l'épaisseur du mur. */
export function windowFrame(s: Sculpt, matrix: THREE.Matrix4, o: WallOpening): void {
  s.group(matrix.clone().multiply(at(o.along, o.sill, 0)), () => {
    s.box(o.width, 0.07, 0.34, at(0, 0.035, 0), { color: TONE.woodDark });
    s.box(0.06, o.height, 0.08, at(0, o.height / 2, 0), { color: TONE.chalk, wobble: 0.004 });
    s.box(o.width, 0.05, 0.08, at(0, o.height * 0.55, 0), { color: TONE.chalk, wobble: 0.004 });
    s.box(0.06, o.height, 0.1, at(-o.width / 2 + 0.03, o.height / 2, 0), {
      color: TONE.chalk,
      wobble: 0.004,
    });
    s.box(0.06, o.height, 0.1, at(o.width / 2 - 0.03, o.height / 2, 0), {
      color: TONE.chalk,
      wobble: 0.004,
    });
    s.box(o.width, 0.06, 0.1, at(0, o.height - 0.03, 0), { color: TONE.chalk, wobble: 0.004 });
  });
}
