// Limites de sol adoucies: frontière lissée déterministe, continue d'une tuile à l'autre, jamais
// à plus de `reach` de la grille, bords droits des sols construits, relief et ligne d'eau qui
// suivent la même frontière, et gabarit (un couple de natures de plus par une entrée de données).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as v from 'valibot';
import { describe, expect, it, vi } from 'vitest';
import { TILE_SIZE } from '../../src/donnees/carte';
import { MapSchema, type MapDef } from '../../src/donnees/schemas/lieu';
import { groundMapBytes } from '../../src/rendu/encre/sol';
import { EdgeField, type EdgeSource } from '../../src/rendu/lieu/lisieres';
import { EDGE_SETTINGS, type EdgeSettings } from '../../src/rendu/lieu/reglages-lisieres';
import { RELIEF_SETTINGS } from '../../src/rendu/lieu/reglages-relief';
import type { GroundLook } from '../../src/rendu/lieu/reglages-tuiles';
import { createRelief } from '../../src/rendu/lieu/relief';
import { reliefGround } from '../../src/rendu/lieu/relief-sol';
import { groundField } from '../../src/rendu/lieu/terrain-rendu';

const MAP = fileURLToPath(new URL('../../donnees/lieux/aubrune/carte.json', import.meta.url));
const map: MapDef = v.parse(MapSchema, JSON.parse(readFileSync(MAP, 'utf8')) as unknown);
const field = groundField(map);
const relief = createRelief(field, map);
const edges = relief.edges;

/** Le bief du moulin et son chemin: berges, chemin de terre, pré, bâtiment, passerelle. */
const MILL = { x0: 116, y0: 119, x1: 162, y1: 144 };

const nameAt = (x: number, y: number): string =>
  field.names[field.cells[Math.floor(y) * field.width + Math.floor(x)] ?? 0] ?? '';

/** Nature affichée au point (x, y): celle de la grille au point décalé. */
function shownAt(field_: EdgeField, x: number, y: number): string {
  field_.sample(x, y);
  return nameAt(x + field_.sx, y + field_.sy);
}

/** Un petit lieu factice: natures par lettres, une ligne par rangée. */
function sourceOf(
  rows: readonly string[],
  looks: Readonly<Record<string, GroundLook>>,
): EdgeSource {
  const names = Object.keys(looks);
  const width = rows[0]?.length ?? 0;
  const cells = new Uint8Array(width * rows.length);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++)
      cells[y * width + x] = names.findIndex((name) => name.startsWith(row.charAt(x)));
  });
  const fallback: GroundLook = { color: '#000000', surface: 'herbe' };
  const list = names.map((name) => looks[name] ?? fallback);
  return {
    width,
    height: rows.length,
    names,
    looks: list,
    cells,
    straight: (index) => list[cells[index] ?? 0]?.surface === 'pave',
  };
}

describe('frontière lissée', () => {
  it('est déterministe: deux champs du même lieu sont identiques, sans hasard', () => {
    const random = vi.spyOn(Math, 'random');
    const again = createRelief(groundField(map), map).edges;
    expect(again.bytes).toEqual(edges.bytes);
    expect(random).not.toHaveBeenCalled();
    random.mockRestore();
  });

  it('ne s’écarte jamais de la grille de plus de `reach`, ni de 33 cm tremblé du trait compris', () => {
    let worst = 0;
    for (let i = 0; i < edges.bytes.length; i += 2) {
      const dx = (((edges.bytes[i] ?? 128) - 128) / 127) * edges.span;
      const dy = (((edges.bytes[i + 1] ?? 128) - 128) / 127) * edges.span;
      worst = Math.max(worst, Math.hypot(dx, dy));
    }
    // Un octet de marge pour l'arrondi; entre deux noeuds l'interpolation reste sous le plus grand.
    expect(worst).toBeLessThanOrEqual(EDGE_SETTINGS.reach + EDGE_SETTINGS.span / 127);
    expect(worst).toBeGreaterThan(EDGE_SETTINGS.reach * 0.8);
    expect(EDGE_SETTINGS.reach + EDGE_SETTINGS.ragged * Math.SQRT2).toBeLessThanOrEqual(0.33);
    // Mesure directe: tout point montré d'une autre nature que sa case est à moins de `reach`
    // d'une case de cette nature (on ne voit jamais de sol ferme loin dans l'eau, ni l'inverse).
    const reach = EDGE_SETTINGS.reach + 0.005;
    let moved = 0;
    for (let y = MILL.y0; y < MILL.y1; y += 0.07)
      for (let x = MILL.x0; x < MILL.x1; x += 0.07) {
        const shown = shownAt(edges, x, y);
        if (shown === nameAt(x, y)) continue;
        moved++;
        let near = false;
        for (let cy = Math.floor(y) - 1; cy <= Math.floor(y) + 1 && !near; cy++)
          for (let cx = Math.floor(x) - 1; cx <= Math.floor(x) + 1 && !near; cx++) {
            if (nameAt(cx, cy) !== shown) continue;
            const d = Math.hypot(Math.max(cx - x, 0, x - cx - 1), Math.max(cy - y, 0, y - cy - 1));
            near = d <= reach;
          }
        expect(near, `${shown} en ${x.toFixed(2)}, ${y.toFixed(2)}`).toBe(true);
      }
    // La frontière a bien bougé: des milliers de points ont changé de nature.
    expect(moved).toBeGreaterThan(2000);
  });

  it('ne se replie pas: le point lu avance toujours avec le point affiché', () => {
    const e = 0.02;
    let least = Infinity;
    for (let y = MILL.y0; y < MILL.y1; y += 0.11)
      for (let x = MILL.x0; x < MILL.x1; x += 0.11) {
        edges.sample(x, y);
        const ax = edges.sx;
        const ay = edges.sy;
        edges.sample(x + e, y);
        const bx = edges.sx;
        const by = edges.sy;
        edges.sample(x, y + e);
        // Déterminant du jacobien de p + décalage(p): positif tant que rien ne se retourne.
        const det =
          (1 + (bx - ax) / e) * (1 + (edges.sy - ay) / e) - ((by - ay) / e) * ((edges.sx - ax) / e);
        least = Math.min(least, det);
      }
    expect(least).toBeGreaterThan(0.15);
  });

  it('est continue d’une tuile à l’autre: de part et d’autre d’un bord de tuile, le même décalage', () => {
    // Le champ est celui du lieu: la tuile n'y est pour rien. On le vérifie le long des bords de
    // tuile qui croisent le bief, et dans la hauteur du sol.
    let steps = 0;
    for (const edge of [TILE_SIZE * 4, TILE_SIZE * 5])
      for (let t = 100; t < 160; t += 0.13) {
        for (const [ax, ay, bx, by] of [
          [edge - 1e-4, t, edge + 1e-4, t],
          [t, edge - 1e-4, t, edge + 1e-4],
        ] as const) {
          edges.sample(ax, ay);
          const sx = edges.sx;
          const sy = edges.sy;
          edges.sample(bx, by);
          expect(Math.abs(edges.sx - sx)).toBeLessThan(0.002);
          expect(Math.abs(edges.sy - sy)).toBeLessThan(0.002);
          if (
            relief.isSoft(Math.floor(ax), Math.floor(ay)) &&
            relief.isSoft(Math.floor(bx), Math.floor(by))
          )
            expect(Math.abs(relief.heightAt(ax, ay) - relief.heightAt(bx, by))).toBeLessThan(0.004);
          steps++;
        }
      }
    expect(steps).toBeGreaterThan(1000);
  });

  it('laisse droits les sols construits: rien ne bouge dans un dallage, un bâtiment, ni le long de la voie', () => {
    let built = 0;
    for (let y = 60; y < 170; y++)
      for (let x = 120; x < 280; x++) {
        const name = nameAt(x, y);
        const rigid = relief.profileAt(x, y)?.edge === 'rigide';
        if (!rigid && name !== 'voie') continue;
        built++;
        for (const [px, py] of [
          [x + 0.02, y + 0.02],
          [x + 0.5, y + 0.98],
          [x + 0.98, y + 0.5],
        ] as const) {
          edges.sample(px, py);
          // Dans un sol rigide: aucun décalage. Dans le ballast: la case lue reste du ballast.
          if (rigid)
            expect(Math.hypot(edges.sx, edges.sy), `${name} ${String(x)},${String(y)}`).toBe(0);
          else expect(shownAt(edges, px, py)).toBe('voie');
        }
      }
    expect(built).toBeGreaterThan(2000);
  });

  it('rabote les coins d’un escalier et coupe l’angle d’un carré', () => {
    const water: GroundLook = { color: '#4d8aa0', surface: 'eau', water: true };
    const grass: GroundLook = { color: '#a3b865', surface: 'herbe' };
    const calm: EdgeSettings = { ...EDGE_SETTINGS, waves: [] };
    // Un escalier d'un mètre par marche entre pré et eau: sur la grille, ses coins sont à 25 cm
    // (sur chaque axe) de la diagonale qui passe par le milieu des marches.
    const rows = Array.from({ length: 14 }, (_, y) =>
      Array.from({ length: 14 }, (_, x) => (x + y < 13 ? 'p' : 'e')).join(''),
    );
    const stairs = new EdgeField(sourceOf(rows, { pre: grass, eau: water }), calm);
    const grassAt = (x: number, y: number): boolean => {
      stairs.sample(x, y);
      return Math.floor(x + stairs.sx) + Math.floor(y + stairs.sy) < 13;
    };
    let worst = 0;
    for (let t = 3; t < 10.5; t += 0.05) {
      // Où la frontière affichée coupe la normale à la diagonale, au point (t, 13,5 - t).
      let s = -0.4;
      while (s < 0.4 && grassAt(t + s, 13.5 - t + s)) s += 0.005;
      worst = Math.max(worst, Math.abs(s));
    }
    expect(worst).toBeLessThan(0.17);
    expect(worst).toBeGreaterThan(0.02);
    // Un grand carré d'eau dans un pré: son angle est coupé (le point à 10 cm dans l'angle est
    // montré en pré), ses côtés droits ne bougent pas en leur milieu.
    const pond = new EdgeField(
      sourceOf(
        Array.from({ length: 16 }, (_, y) =>
          Array.from({ length: 16 }, (_, x) =>
            x >= 4 && x < 12 && y >= 4 && y < 12 ? 'e' : 'p',
          ).join(''),
        ),
        { pre: grass, eau: water },
      ),
      calm,
    );
    const wetAt = (x: number, y: number): boolean => {
      pond.sample(x, y);
      const cx = Math.floor(x + pond.sx);
      const cy = Math.floor(y + pond.sy);
      return cx >= 4 && cx < 12 && cy >= 4 && cy < 12;
    };
    expect(wetAt(4.1, 4.1)).toBe(false);
    expect(wetAt(11.9, 11.9)).toBe(false);
    expect(wetAt(4.3, 4.3)).toBe(true);
    expect(wetAt(8, 4.03)).toBe(true);
    expect(wetAt(8, 3.97)).toBe(false);
  });
});

describe('relief et teinte suivent la même frontière', () => {
  it('pose la berge sur la frontière affichée, pas sur le bord des cases', () => {
    const level = RELIEF_SETTINGS.water.level;
    let toWater = 0;
    let toLand = 0;
    let checked = 0;
    for (let y = MILL.y0; y < MILL.y1; y += 0.09)
      for (let x = MILL.x0; x < MILL.x1; x += 0.09) {
        const cx = Math.floor(x);
        const cy = Math.floor(y);
        if (!relief.isSoft(cx, cy)) continue;
        // Loin de tout sol rigide (une passerelle remonte la terre jusqu'à elle).
        let rigid = false;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) if (!relief.isSoft(cx + dx, cy + dy)) rigid = true;
        if (rigid) continue;
        const h = relief.heightAt(x, y);
        const shown = shownAt(edges, x, y);
        const own = nameAt(x, y);
        const where = `${x.toFixed(2)}, ${y.toFixed(2)}`;
        checked++;
        // Bien sous l'eau: la case lue est de l'eau.
        if (h < level - 0.12) expect(shown, where).toBe('eau');
        // La mi-pente (entre -0,40 et -0,30 selon la nature de la rive) est sur la frontière
        // affichée: un point d'une case d'eau montré en terre est déjà sur la berge, un point
        // d'une case de terre montré en eau est déjà sous la mi-pente.
        if (shown !== 'eau' && own === 'eau') {
          toLand++;
          expect(h, where).toBeGreaterThan(-0.41);
        }
        if (shown === 'eau' && own !== 'eau') {
          toWater++;
          expect(h, where).toBeLessThan(level + 0.01);
        }
      }
    expect(checked).toBeGreaterThan(20000);
    // La ligne a quitté la grille, dans les deux sens.
    expect(toLand).toBeGreaterThan(300);
    expect(toWater).toBeGreaterThan(300);
  });

  it('marque l’eau dans la carte du sol (frange claire, terre de la berge)', () => {
    const data = groundMapBytes(field, '#6e5a42');
    const water = field.names.indexOf('eau');
    const at = field.cells.indexOf(water);
    expect((data[at * 4 + 3] ?? 0) & 32).toBe(32);
    const pre = field.cells.indexOf(field.names.lastIndexOf('pre'));
    expect((data[pre * 4 + 3] ?? 0) & 32).toBe(0);
  });

  it('donne un maillage sans fente là où la frontière a bougé', () => {
    const steps = reliefGround(relief, { x0: 128, y0: 124, x1: 144, y1: 140 });
    let step = steps.next();
    while (step.done !== true) step = steps.next();
    const geometry = step.value;
    if (geometry === null) throw new Error('sol vide');
    const position = geometry.getAttribute('position');
    const ink = geometry.getAttribute('aInk');
    // Sommets du sol souple (nature « sol ») rangés par place: une seule hauteur par place.
    const heights = new Map<string, number>();
    let shared = 0;
    for (let i = 0; i < position.count; i++) {
      if (ink.getZ(i) !== 5) continue;
      const key = `${position.getX(i).toFixed(3)}:${position.getZ(i).toFixed(3)}`;
      const known = heights.get(key);
      if (known === undefined) heights.set(key, position.getY(i));
      else if (
        relief.isSoft(Math.floor(position.getX(i) - 1e-6), Math.floor(position.getZ(i) - 1e-6))
      ) {
        shared++;
        expect(Math.abs(known - position.getY(i)), key).toBeLessThan(1e-6);
      }
    }
    expect(shared).toBeGreaterThan(500);
  });
});

describe('gabarit: un couple de natures de plus', () => {
  const looks: Readonly<Record<string, GroundLook>> = {
    pre: { color: '#a3b865', surface: 'herbe' },
    tourbe: { color: '#4a3b2c', surface: 'bois' },
    dalle: { color: '#bfae92', surface: 'pave' },
  };
  // Un carré de tourbe dans un pré, un dallage à côté.
  const rows = [
    'pppppppppppp',
    'pppppppppppp',
    'ppttttpppddp',
    'ppttttpppddp',
    'ppttttpppddp',
    'ppttttpppddp',
    'pppppppppppp',
    'pppppppppppp',
  ];
  const moved = (field_: EdgeField): number => {
    let count = 0;
    for (const byte of field_.bytes) if (byte !== 128) count++;
    return count;
  };

  it('ne lisse rien pour un couple absent, et lisse par une seule entrée de données', () => {
    const source = sourceOf(rows, looks);
    expect(moved(new EdgeField(source))).toBe(0);
    const settings: EdgeSettings = {
      ...EDGE_SETTINGS,
      pairs: [
        ...EDGE_SETTINGS.pairs,
        { pourquoi: 'la tourbe déborde sur le pré (essai)', a: ['tourbe'], b: ['surface:herbe'] },
      ],
    };
    const smoothed = new EdgeField(source, settings);
    expect(moved(smoothed)).toBeGreaterThan(40);
    // Le coin du carré de tourbe est arrondi: son angle est montré en pré.
    smoothed.sample(2.06, 2.06);
    expect(Math.floor(2.06 + smoothed.sx) < 2 || Math.floor(2.06 + smoothed.sy) < 2).toBe(true);
    // Le dallage n'a pas bougé d'un pouce.
    for (let y = 2; y <= 6; y += 0.25)
      for (let x = 9; x <= 11; x += 0.25) {
        smoothed.sample(x, y);
        expect(Math.hypot(smoothed.sx, smoothed.sy)).toBe(0);
      }
  });

  it('refuse un écart qui dépasserait la demi-case, avec la raison', () => {
    const source = sourceOf(rows, looks);
    expect(() => new EdgeField(source, { ...EDGE_SETTINGS, reach: 0.6, span: 0.6 })).toThrow(
      /reach/,
    );
  });
});
