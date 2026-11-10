/**
 * Rendu encré: les textures de traits, dessinées par script au démarrage du rendu (aucune image
 * dans le dépôt). Chaque couche est un carreau de 4 m qui se répète sans raccord, avec quatre
 * canaux: R = le trait d'encre (planches cernées une à une, dalles, tuiles, touffes d'herbe,
 * hachures), G = les taches du second ton peint, B et A = la pente du relief (pierres qui
 * dépassent, planches bombées, tuiles en rangs), tirée d'une carte de hauteur dessinée avec le
 * trait. La matière penche la normale selon cette pente avant de choisir le ton: un joint tombe
 * dans l'ombre, une arête tournée vers le soleil prend le ton clair. La couleur ne vient jamais
 * de la texture: elle est donnée par la pièce.
 */
import * as THREE from 'three';

import { LAYER, LAYER_COUNT } from './couches';

const SIZE = 512;

type Random = () => number;

function mulberry(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Point = readonly [number, number];

interface Pen {
  readonly ctx: CanvasRenderingContext2D;
  readonly random: Random;
}

function canvas2d(width: number, height: number): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canevas 2D indisponible');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#fff';
  ctx.fillStyle = '#fff';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  return ctx;
}

/** Trace le chemin d'une ligne brisée (sans la peindre). */
function trace(ctx: CanvasRenderingContext2D, points: readonly Point[]): void {
  points.forEach(([x, y], i) => {
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
}

/** Répète un dessin sur les huit carreaux voisins: ce qui sort d'un bord rentre par l'autre. */
function tiled(ctx: CanvasRenderingContext2D, draw: () => void): void {
  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      ctx.save();
      ctx.translate(dx * SIZE, dy * SIZE);
      draw();
      ctx.restore();
    }
  }
}

/**
 * Trait de plume: la ligne tremble, s'épaissit au milieu et s'affine aux bouts. Les points sont
 * tirés une fois, puis rejoués sur les carreaux voisins.
 */
function stroke(pen: Pen, points: readonly Point[], width: number, shake = 1.2): void {
  const { ctx, random } = pen;
  const path: [number, number, number][] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    if (!a || !b) continue;
    const steps = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 9));
    for (let s = i === 0 ? 0 : 1; s <= steps; s += 1) {
      const t = s / steps;
      path.push([
        a[0] + (b[0] - a[0]) * t + (random() - 0.5) * shake,
        a[1] + (b[1] - a[1]) * t + (random() - 0.5) * shake,
        0.75 + random() * 0.5,
      ]);
    }
  }
  tiled(ctx, () => {
    for (let i = 0; i < path.length - 1; i += 1) {
      const a = path[i];
      const b = path[i + 1];
      if (!a || !b) continue;
      const along = (i + 0.5) / (path.length - 1);
      const taper = 0.45 + 0.55 * Math.sin(Math.PI * Math.min(1, Math.max(0, along)));
      ctx.lineWidth = Math.max(0.8, width * taper * a[2]);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    }
  });
}

/** Tache pleine aux bords anguleux (le second ton, posé comme au pinceau plat). */
function blot(pen: Pen, x: number, y: number, rx: number, ry: number, corners = 7): void {
  const { ctx, random } = pen;
  const turn = random() * Math.PI;
  const points: Point[] = [];
  for (let i = 0; i < corners; i += 1) {
    const angle = (i / corners) * Math.PI * 2;
    const r = 0.6 + random() * 0.55;
    const px = Math.cos(angle) * rx * r;
    const py = Math.sin(angle) * ry * r;
    points.push([
      x + px * Math.cos(turn) - py * Math.sin(turn),
      y + px * Math.sin(turn) + py * Math.cos(turn),
    ]);
  }
  tiled(ctx, () => {
    ctx.beginPath();
    trace(ctx, points);
    ctx.closePath();
    ctx.fill();
  });
}

function outline(pen: Pen, points: readonly Point[], width: number, gap = 0.12): void {
  // Un contour fermé dessiné côté par côté, avec parfois un côté laissé ouvert: la main se lève.
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    if (!a || !b || pen.random() < gap) continue;
    stroke(pen, [a, b], width, 1.4);
  }
}

/** Remplit un polygone d'un niveau de hauteur (0 creux, 0,5 nu, 1 saillie). */
function raise(pen: Pen, points: readonly Point[], level: number): void {
  const grey = Math.round(level * 255);
  pen.ctx.fillStyle = `rgb(${grey},${grey},${grey})`;
  tiled(pen.ctx, () => {
    pen.ctx.beginPath();
    trace(pen.ctx, points);
    pen.ctx.closePath();
    pen.ctx.fill();
  });
}

function rect(x: number, y: number, w: number, h: number): Point[] {
  return [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ];
}

/** Creuse ou relève un trait dans la carte de hauteur. */
function groove(pen: Pen, points: readonly Point[], width: number, level: number): void {
  const grey = Math.round(level * 255);
  pen.ctx.strokeStyle = `rgb(${grey},${grey},${grey})`;
  stroke(pen, points, width, 1);
}

type Painter = (ink: Pen, paint: Pen, relief: Pen) => void;

const PAINTERS: Record<number, Painter> = {
  [LAYER.plain]: (ink, paint) => {
    for (let i = 0; i < 5; i += 1) {
      const x = ink.random() * SIZE;
      const y = ink.random() * SIZE;
      stroke(ink, [[x, y] as const, [x + 6 + ink.random() * 10, y + ink.random() * 4] as const], 2);
    }
    for (let i = 0; i < 4; i += 1)
      blot(paint, paint.random() * SIZE, paint.random() * SIZE, 70, 40);
  },

  [LAYER.wood]: (ink, paint, relief) => {
    // Planches de 25 cm le long de u, cernées une à une, avec leurs abouts, leur fil et des noeuds.
    const rows = 16;
    const pitch = SIZE / rows;
    for (let row = 0; row < rows; row += 1) {
      const y = row * pitch;
      // Planches désaffleurées: chacune a sa hauteur, le joint est un creux.
      raise(relief, rect(0, y + 3, SIZE, pitch - 6), 0.4 + relief.random() * 0.35);
      groove(relief, [[0, y] as const, [SIZE, y] as const], 5, 0.05);
      stroke(ink, [[0, y] as const, [SIZE, y] as const], 3.4, 1.6);
      let x = ink.random() * 200;
      while (x < SIZE) {
        stroke(
          ink,
          [[x, y + 2] as const, [x + (ink.random() - 0.5) * 4, y + pitch - 2] as const],
          3,
        );
        x += 190 + ink.random() * 260;
      }
      for (let i = 0; i < 3; i += 1) {
        const gx = ink.random() * SIZE;
        const gy = y + 7 + ink.random() * (pitch - 14);
        const length = 24 + ink.random() * 70;
        stroke(
          ink,
          [[gx, gy] as const, [gx + length, gy + (ink.random() - 0.5) * 3] as const],
          1.7,
        );
      }
      if (ink.random() < 0.3) {
        const kx = ink.random() * SIZE;
        const ky = y + pitch / 2;
        outline(
          ink,
          [
            [kx - 5, ky],
            [kx, ky - 4],
            [kx + 6, ky],
            [kx, ky + 4],
          ],
          1.6,
          0,
        );
      }
      if (paint.random() < 0.32) {
        tiled(paint.ctx, () => {
          paint.ctx.fillRect(0, y + 2, SIZE, pitch - 4);
        });
      }
    }
  },

  [LAYER.wall]: (ink, paint, relief) => {
    for (let i = 0; i < 7; i += 1) {
      const x = relief.random() * SIZE;
      const y = relief.random() * SIZE;
      const r = 50 + relief.random() * 60;
      const level = relief.random() < 0.5 ? 0.62 : 0.4;
      raise(
        relief,
        [
          [x - r, y - r * 0.5],
          [x + r * 0.2, y - r * 0.7],
          [x + r, y],
          [x + r * 0.4, y + r * 0.6],
          [x - r * 0.7, y + r * 0.5],
        ],
        level,
      );
    }
    // Enduit: presque nu. Quelques pierres qui affleurent par groupes, des fissures, des coups de pinceau.
    for (let group = 0; group < 4; group += 1) {
      let x = ink.random() * SIZE;
      const y = ink.random() * SIZE;
      const stones = 1 + Math.floor(ink.random() * 3);
      for (let i = 0; i < stones; i += 1) {
        const w = 34 + ink.random() * 30;
        const h = 18 + ink.random() * 10;
        const stone: Point[] = [
          [x, y],
          [x + w, y + (ink.random() - 0.5) * 5],
          [x + w - 2, y + h],
          [x + 3, y + h + (ink.random() - 0.5) * 5],
        ];
        raise(relief, stone, 0.95);
        outline(ink, stone, 2.6, 0.2);
        x += w + 6;
      }
    }
    for (let i = 0; i < 3; i += 1) {
      let x = ink.random() * SIZE;
      let y = ink.random() * SIZE;
      const points: Point[] = [[x, y]];
      for (let s = 0; s < 4; s += 1) {
        x += (ink.random() - 0.5) * 26;
        y += 14 + ink.random() * 18;
        points.push([x, y]);
      }
      groove(relief, points, 5, 0.1);
      stroke(ink, points, 2);
    }
    for (let i = 0; i < 9; i += 1) {
      const x = ink.random() * SIZE;
      const y = ink.random() * SIZE;
      stroke(
        ink,
        [[x, y] as const, [x + 10 + ink.random() * 18, y + (ink.random() - 0.5) * 4] as const],
        1.8,
      );
    }
    for (let i = 0; i < 5; i += 1)
      blot(paint, paint.random() * SIZE, paint.random() * SIZE, 90, 46);
  },

  [LAYER.slab]: (ink, paint, relief) => {
    raise(relief, rect(0, 0, SIZE, SIZE), 0.15);
    // Dalles de 67 cm de large, de longueurs inégales, à joints croisés. Chaque dalle a son propre
    // contour, rentré de 3 points: deux dalles voisines ne partagent pas leur trait.
    const rows = 6;
    const pitch = SIZE / rows;
    for (let row = 0; row < rows; row += 1) {
      const y = row * pitch;
      let x = ink.random() * 90;
      const start = x;
      while (x < start + SIZE - 40) {
        const w = Math.min(100 + ink.random() * 90, start + SIZE - x);
        const inset = 3.5;
        const skew = (): number => (ink.random() - 0.5) * 5;
        const corners: Point[] = [
          [x + inset + skew(), y + inset + skew()],
          [x + w - inset + skew(), y + inset + skew()],
          [x + w - inset + skew(), y + pitch - inset + skew()],
          [x + inset + skew(), y + pitch - inset + skew()],
        ];
        raise(relief, corners, 0.5 + relief.random() * 0.45);
        outline(ink, corners, 3, 0.06);
        if (ink.random() < 0.22) {
          const cx = x + w * (0.25 + ink.random() * 0.5);
          stroke(
            ink,
            [
              [cx, y + inset] as const,
              [cx + (ink.random() - 0.5) * 22, y + pitch * 0.5] as const,
              [cx + (ink.random() - 0.5) * 30, y + pitch * (0.7 + ink.random() * 0.25)] as const,
            ],
            1.8,
          );
        }
        if (paint.random() < 0.3) {
          const px = x;
          tiled(paint.ctx, () => {
            paint.ctx.fillRect(px + 2, y + 2, w - 4, pitch - 4);
          });
        }
        x += w;
      }
    }
  },

  [LAYER.roof]: (ink, paint, relief) => {
    // Tuiles plates en rangs de 32 cm le long de u, décalées d'un rang à l'autre; le bas de chaque
    // tuile est marqué, pas ses côtés entiers: de loin on lit des rangs, de près des tuiles.
    const rows = 12;
    const pitch = SIZE / rows;
    const tile = SIZE / 14;
    for (let row = 0; row < rows; row += 1) {
      const y = row * pitch;
      // Chaque rang monte vers son bord bas, puis retombe d'un coup sur le rang suivant.
      for (let band = 0; band < 4; band += 1) {
        raise(relief, rect(0, y + (band * pitch) / 4, SIZE, pitch / 4 + 1), 0.2 + band * 0.25);
      }
      stroke(ink, [[0, y] as const, [SIZE, y] as const], 3.2, 2.2);
      const shift = (row % 2) * (tile / 2) + (ink.random() - 0.5) * 6;
      for (let i = 0; i < 14; i += 1) {
        const x = i * tile + shift;
        if (ink.random() < 0.8)
          stroke(
            ink,
            [
              [x, y] as const,
              [x + (ink.random() - 0.5) * 3, y + pitch * (0.45 + ink.random() * 0.5)] as const,
            ],
            2.4,
          );
        groove(relief, [[x, y + 3] as const, [x, y + pitch - 2] as const], 4, 0.25);
        if (paint.random() < 0.24) {
          tiled(paint.ctx, () => {
            paint.ctx.fillRect(x + 2, y + 2, tile - 3, pitch - 3);
          });
        }
      }
    }
  },

  [LAYER.leaf]: (ink, paint, relief) => {
    for (let i = 0; i < 16; i += 1) {
      const x = relief.random() * SIZE;
      const y = relief.random() * SIZE;
      const r = 26 + relief.random() * 34;
      raise(
        relief,
        [
          [x - r, y],
          [x - r * 0.4, y - r * 0.8],
          [x + r * 0.7, y - r * 0.6],
          [x + r, y + r * 0.2],
          [x, y + r * 0.8],
        ],
        i % 3 === 0 ? 0.15 : 0.9,
      );
    }
    // Feuillage: des accents courbes par paquets, jamais un semis régulier.
    for (let cluster = 0; cluster < 15; cluster += 1) {
      const cx = ink.random() * SIZE;
      const cy = ink.random() * SIZE;
      const count = 2 + Math.floor(ink.random() * 4);
      for (let i = 0; i < count; i += 1) {
        const x = cx + (ink.random() - 0.5) * 80;
        const y = cy + (ink.random() - 0.5) * 60;
        const w = 12 + ink.random() * 16;
        stroke(
          ink,
          [
            [x - w, y - 3] as const,
            [x - w * 0.3, y + 6] as const,
            [x + w * 0.4, y + 5] as const,
            [x + w, y - 5] as const,
          ],
          3,
          1,
        );
      }
    }
    for (let i = 0; i < 9; i += 1)
      blot(paint, paint.random() * SIZE, paint.random() * SIZE, 60, 34);
  },

  [LAYER.bark]: (ink, paint, relief) => {
    for (let i = 0; i < 26; i += 1) {
      const x = ink.random() * SIZE;
      const y = ink.random() * SIZE;
      const length = 40 + ink.random() * 120;
      const points: Point[] = [
        [x, y],
        [x + length * 0.5, y + (ink.random() - 0.5) * 10],
        [x + length, y + (ink.random() - 0.5) * 10],
      ];
      groove(
        relief,
        points.map(([px, py]) => [px, py + 7] as const),
        9,
        0.95,
      );
      groove(relief, points, 5, 0.05);
      stroke(ink, points, 2.8);
    }
    for (let i = 0; i < 6; i += 1)
      blot(paint, paint.random() * SIZE, paint.random() * SIZE, 80, 22);
  },

  [LAYER.hatch]: (ink, paint) => {
    // Hachures à 45 degrés. R: serrées (ombre propre). G: lâches et courtes (ombre portée).
    const draw = (pen: Pen, spacing: number, width: number, keep: number, reach: number): void => {
      for (let c = -SIZE; c < SIZE; c += spacing) {
        let t = pen.random() * 60;
        while (t < SIZE) {
          const length = reach * (0.5 + pen.random());
          if (pen.random() < keep) {
            const jitter = (pen.random() - 0.5) * 3;
            stroke(
              pen,
              [
                [t, t + c + jitter] as const,
                [t + length, t + length + c + jitter + (pen.random() - 0.5) * 4] as const,
              ],
              width * (0.7 + pen.random() * 0.6),
              0.8,
            );
          }
          t += length + 10 + pen.random() * 26;
        }
      }
    };
    draw(ink, 16, 3.6, 0.92, 150);
    draw(paint, 32, 3.2, 0.7, 80);
  },

  [LAYER.grass]: (ink, paint) => {
    // Touffes: trois à six brins en éventail, groupées par deux ou trois, avec de grands vides.
    for (let clump = 0; clump < 13; clump += 1) {
      const cx = ink.random() * SIZE;
      const cy = ink.random() * SIZE;
      const tufts = 1 + Math.floor(ink.random() * 3);
      for (let t = 0; t < tufts; t += 1) {
        const x = cx + (ink.random() - 0.5) * 90;
        const y = cy + (ink.random() - 0.5) * 70;
        const lean = (ink.random() - 0.5) * 0.9;
        const blades = 3 + Math.floor(ink.random() * 4);
        for (let b = 0; b < blades; b += 1) {
          const angle = -Math.PI / 2 + lean + (b / (blades - 1) - 0.5) * 1.3;
          const length = 16 + ink.random() * 22;
          const bx = x + (b - blades / 2) * 3.5;
          stroke(
            ink,
            [
              [bx, y] as const,
              [bx + Math.cos(angle) * length * 0.6, y + Math.sin(angle) * length * 0.6] as const,
              [bx + Math.cos(angle + 0.25) * length, y + Math.sin(angle + 0.25) * length] as const,
            ],
            3.3,
            0.7,
          );
        }
      }
    }
    for (let i = 0; i < 6; i += 1)
      blot(paint, paint.random() * SIZE, paint.random() * SIZE, 85, 50);
  },

  [LAYER.dirt]: (ink, paint, relief) => {
    for (let i = 0; i < 16; i += 1) {
      const x = ink.random() * SIZE;
      const y = ink.random() * SIZE;
      const r = 5 + ink.random() * 9;
      const pebble: Point[] = [
        [x - r, y],
        [x - r * 0.3, y - r * 0.7],
        [x + r, y - r * 0.2],
        [x + r * 0.6, y + r * 0.7],
        [x - r * 0.4, y + r * 0.8],
      ];
      raise(relief, pebble, 1);
      outline(ink, pebble, 2.4, 0.25);
    }
    for (let i = 0; i < 14; i += 1) {
      const x = ink.random() * SIZE;
      const y = ink.random() * SIZE;
      stroke(
        ink,
        [[x, y] as const, [x + 14 + ink.random() * 30, y + (ink.random() - 0.5) * 8] as const],
        2.2,
      );
    }
    for (let i = 0; i < 7; i += 1)
      blot(paint, paint.random() * SIZE, paint.random() * SIZE, 100, 36);
  },

  [LAYER.ballast]: (ink, paint, relief) => {
    raise(relief, rect(0, 0, SIZE, SIZE), 0.2);
    // Cailloux anguleux, serrés mais pas tous dessinés.
    for (let gy = 0; gy < 15; gy += 1) {
      for (let gx = 0; gx < 15; gx += 1) {
        if (ink.random() < 0.42) continue;
        const x = (gx + 0.5 + (ink.random() - 0.5) * 0.7) * (SIZE / 15);
        const y = (gy + 0.5 + (ink.random() - 0.5) * 0.7) * (SIZE / 15);
        const r = 7 + ink.random() * 8;
        const corners: Point[] = [];
        const count = 4 + Math.floor(ink.random() * 2);
        const turn = ink.random() * 6;
        for (let i = 0; i < count; i += 1) {
          const angle = turn + (i / count) * Math.PI * 2;
          const reach = r * (0.7 + ink.random() * 0.5);
          corners.push([x + Math.cos(angle) * reach, y + Math.sin(angle) * reach * 0.8]);
        }
        raise(relief, corners, 0.6 + relief.random() * 0.4);
        outline(ink, corners, 2.3, 0.2);
        if (paint.random() < 0.3) blot(paint, x, y, r, r * 0.8, 5);
      }
    }
  },

  [LAYER.grain]: (ink, paint, relief) => {
    // Une planche: de longues veines le long de u, qui s'écartent autour des noeuds.
    for (let i = 0; i < 9; i += 1) {
      const y = ink.random() * SIZE;
      let x = ink.random() * SIZE;
      const points: Point[] = [[x, y]];
      const drift = (ink.random() - 0.5) * 0.25;
      const length = 3 + Math.floor(ink.random() * 5);
      for (let k = 0; k < length; k += 1) {
        x += 50 + ink.random() * 30;
        points.push([x, y + drift * (k + 1) * 40 + Math.sin(k * 1.3 + i) * 9]);
      }
      stroke(ink, points, 2.2, 1);
      groove(relief, points, 4, 0.2);
    }
    for (let i = 0; i < 4; i += 1) {
      const x = ink.random() * SIZE;
      const y = ink.random() * SIZE;
      const r = 6 + ink.random() * 7;
      const knot: Point[] = [
        [x - r * 1.5, y],
        [x - r * 0.4, y - r * 0.7],
        [x + r * 1.4, y],
        [x - r * 0.3, y + r * 0.7],
      ];
      outline(ink, knot, 2.2, 0);
      raise(relief, knot, 0.2);
    }
    for (let i = 0; i < 5; i += 1)
      blot(paint, paint.random() * SIZE, paint.random() * SIZE, 150, 22);
  },

  [LAYER.face]: (ink, paint, relief) => {
    // Une pierre: éclats, piqûres et une ou deux fissures; l'appareil est en volume.
    for (let i = 0; i < 12; i += 1) {
      const x = ink.random() * SIZE;
      const y = ink.random() * SIZE;
      const r = 7 + ink.random() * 14;
      const chip: Point[] = [
        [x - r, y],
        [x, y - r * 0.6],
        [x + r, y + r * 0.1],
        [x + r * 0.2, y + r * 0.7],
      ];
      raise(relief, chip, 0.05);
      outline(ink, chip, 2.2, 0.45);
    }
    for (let i = 0; i < 5; i += 1) {
      let x = ink.random() * SIZE;
      let y = ink.random() * SIZE;
      const points: Point[] = [[x, y]];
      for (let k = 0; k < 3; k += 1) {
        x += 16 + ink.random() * 26;
        y += (ink.random() - 0.5) * 40;
        points.push([x, y]);
      }
      groove(relief, points, 5, 0.05);
      stroke(ink, points, 2);
    }
    for (let i = 0; i < 14; i += 1) {
      const x = ink.random() * SIZE;
      const y = ink.random() * SIZE;
      stroke(
        ink,
        [[x, y] as const, [x + 3 + ink.random() * 7, y + ink.random() * 4] as const],
        2.2,
      );
    }
    for (let i = 0; i < 6; i += 1)
      blot(paint, paint.random() * SIZE, paint.random() * SIZE, 70, 44);
  },
};

/** Flou en boîte, répété trois fois, qui boucle aux bords: il transforme les marches en pentes. */
function blurWrapped(field: Float32Array, radius: number): void {
  const scratch = new Float32Array(field.length);
  const span = radius * 2 + 1;
  for (let pass = 0; pass < 3; pass += 1) {
    for (const horizontal of [true, false]) {
      for (let line = 0; line < SIZE; line += 1) {
        let sum = 0;
        const index = (i: number): number => {
          const j = ((i % SIZE) + SIZE) % SIZE;
          return horizontal ? line * SIZE + j : j * SIZE + line;
        };
        for (let i = -radius; i <= radius; i += 1) sum += field[index(i)] ?? 0;
        for (let i = 0; i < SIZE; i += 1) {
          scratch[index(i)] = sum / span;
          sum += (field[index(i + radius + 1)] ?? 0) - (field[index(i - radius)] ?? 0);
        }
      }
      field.set(scratch);
    }
  }
}

/** Rayon du flou de la carte de hauteur par couche, en points: la largeur des chanfreins. */
const BEVEL: Record<number, number> = {
  [LAYER.wall]: 2,
  [LAYER.leaf]: 4,
  [LAYER.bark]: 2,
};

/** Les couches de traits, en tableau de textures (R trait, G second ton, B et A pente du relief). */
export function createInkLayers(): THREE.DataArrayTexture {
  const data = new Uint8Array(SIZE * SIZE * 4 * LAYER_COUNT);
  const height = new Float32Array(SIZE * SIZE);
  for (let layer = 0; layer < LAYER_COUNT; layer += 1) {
    const ink = { ctx: canvas2d(SIZE, SIZE), random: mulberry(1000 + layer * 17) };
    const paint = { ctx: canvas2d(SIZE, SIZE), random: mulberry(2000 + layer * 31) };
    const relief = { ctx: canvas2d(SIZE, SIZE), random: mulberry(3000 + layer * 13) };
    relief.ctx.fillStyle = 'rgb(128,128,128)';
    relief.ctx.fillRect(0, 0, SIZE, SIZE);
    PAINTERS[layer]?.(ink, paint, relief);
    const inkPixels = ink.ctx.getImageData(0, 0, SIZE, SIZE).data;
    const paintPixels = paint.ctx.getImageData(0, 0, SIZE, SIZE).data;
    const reliefPixels = relief.ctx.getImageData(0, 0, SIZE, SIZE).data;
    for (let i = 0; i < SIZE * SIZE; i += 1) height[i] = (reliefPixels[i * 4] ?? 128) / 255;
    blurWrapped(height, BEVEL[layer] ?? 1);
    const offset = layer * SIZE * SIZE * 4;
    const wrap = (i: number): number => ((i % SIZE) + SIZE) % SIZE;
    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        const i = y * SIZE + x;
        const du = (height[y * SIZE + wrap(x + 1)] ?? 0) - (height[y * SIZE + wrap(x - 1)] ?? 0);
        const dv = (height[wrap(y + 1) * SIZE + x] ?? 0) - (height[wrap(y - 1) * SIZE + x] ?? 0);
        data[offset + i * 4] = inkPixels[i * 4] ?? 0;
        data[offset + i * 4 + 1] = paintPixels[i * 4] ?? 0;
        data[offset + i * 4 + 2] = Math.max(0, Math.min(255, Math.round(128 + du * 420)));
        data[offset + i * 4 + 3] = Math.max(0, Math.min(255, Math.round(128 + dv * 420)));
      }
    }
  }
  const texture = new THREE.DataArrayTexture(data, SIZE, SIZE, LAYER_COUNT);
  texture.format = THREE.RGBAFormat;
  texture.type = THREE.UnsignedByteType;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

/** Bruit lisse à trois canaux indépendants, répétable: bords tremblés, taches, épaisseur du trait. */
export function createNoise(size = 128, cells = 16): THREE.DataTexture {
  const random = mulberry(4242);
  const data = new Uint8Array(size * size * 4);
  for (let channel = 0; channel < 3; channel += 1) {
    const coarse = Array.from({ length: cells * cells }, () => random());
    const fine = Array.from({ length: cells * cells * 4 }, () => random());
    const sample = (grid: number[], n: number, x: number, y: number): number => {
      const x0 = Math.floor(x);
      const y0 = Math.floor(y);
      const fx = x - x0;
      const fy = y - y0;
      const sx = fx * fx * (3 - 2 * fx);
      const sy = fy * fy * (3 - 2 * fy);
      const g = (ix: number, iy: number): number =>
        grid[(((iy % n) + n) % n) * n + (((ix % n) + n) % n)] ?? 0;
      const top = g(x0, y0) + (g(x0 + 1, y0) - g(x0, y0)) * sx;
      const bottom = g(x0, y0 + 1) + (g(x0 + 1, y0 + 1) - g(x0, y0 + 1)) * sx;
      return top + (bottom - top) * sy;
    };
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const u = (x / size) * cells;
        const v = (y / size) * cells;
        const value =
          sample(coarse, cells, u, v) * 0.68 + sample(fine, cells * 2, u * 2, v * 2) * 0.32;
        data[(y * size + x) * 4 + channel] = Math.round(value * 255);
      }
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** Ce que le plan du lieu dit du sol: des chemins (polylignes larges) et des bandes (rectangles). */
export interface GroundPlan {
  /** Emprise du sol, en mètres: coin nord-ouest et taille. */
  readonly origin: readonly [number, number];
  readonly size: readonly [number, number];
  readonly paths: readonly { readonly points: readonly Point[]; readonly width: number }[];
  readonly ballast: readonly {
    readonly x: number;
    readonly z: number;
    readonly w: number;
    readonly d: number;
  }[];
}
