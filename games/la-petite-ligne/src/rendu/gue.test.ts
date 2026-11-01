import { describe, expect, it } from 'vitest';
import { loadMap } from '../donnees/carte';
import { MAP_FILES } from '../donnees/cartes-fichiers';
import { findPath } from '../simulation/grille';
import { isFord } from './champs';
import { layFordStones, type FordStone } from './gue';
import { RENDER_SETTINGS } from './reglages';

const map = loadMap(MAP_FILES).map;
const S = RENDER_SETTINGS.terrain.fordStones;
const cells: { cx: number; cy: number }[] = [];
for (let cy = 0; cy < map.height; cy += 1) {
  for (let cx = 0; cx < map.width; cx += 1) {
    if (isFord(map, cx, cy)) cells.push({ cx, cy });
  }
}
const stones = layFordStones(map, cells, 1);
const passage = stones.filter((s) => s.kind === 'passage').sort((a, b) => a.y - b.y);
const scatter = stones.filter((s) => s.kind !== 'passage');
const radius = (s: FordStone): number => (s.size * (1 + s.depth)) / 4;
const minX = Math.min(...cells.map((c) => c.cx));
const maxX = Math.max(...cells.map((c) => c.cx)) + 1;
const minY = Math.min(...cells.map((c) => c.cy));
const maxY = Math.max(...cells.map((c) => c.cy)) + 1;

/** x de la ligne de passage à la hauteur y (entre ses deux pierres voisines). */
function lineAt(y: number): number {
  const first = passage[0];
  const last = passage[passage.length - 1];
  if (first === undefined || last === undefined) return Number.NaN;
  if (y <= first.y) return first.x;
  for (let i = 1; i < passage.length; i += 1) {
    const a = passage[i - 1];
    const b = passage[i];
    if (a !== undefined && b !== undefined && y <= b.y)
      return a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y);
  }
  return last.x;
}

describe('pierres du gué', () => {
  it('la carte a un gué d’une seule pièce', () => {
    expect(cells.length).toBeGreaterThan(10);
  });

  it('une ligne de passage de 8 à 10 grandes pierres au pas, d’une rive à l’autre', () => {
    expect(passage.length).toBeGreaterThanOrEqual(8);
    expect(passage.length).toBeLessThanOrEqual(10);
    for (const s of passage) {
      expect(s.size).toBeGreaterThanOrEqual(S.passage.size[0]);
      expect(s.size).toBeLessThanOrEqual(S.passage.size[1]);
    }
    for (let i = 1; i < passage.length; i += 1) {
      const a = passage[i - 1];
      const b = passage[i];
      if (a === undefined || b === undefined) throw new Error('pierre');
      const step = Math.hypot(b.x - a.x, b.y - a.y);
      expect(step).toBeGreaterThan(S.passage.pitch[0] - S.passage.jitter);
      expect(step).toBeLessThan(S.passage.pitch[1] + 2 * S.passage.jitter);
    }
    // Du bord nord au bord sud du gué: on n'y saute jamais plus d'un pas.
    expect((passage[0]?.y ?? 99) - minY).toBeLessThan(S.passage.pitch[1]);
    expect(maxY - (passage[passage.length - 1]?.y ?? -99)).toBeLessThan(S.passage.pitch[1]);
  });

  it('la ligne part du bout du chemin nord et arrive au bout du chemin sud', () => {
    // Le chemin s'arrête au haut de la berge, une rangée avant le gué.
    const pathXs = (cy: number): number[] => {
      const xs: number[] = [];
      for (let cx = minX; cx < maxX; cx += 1)
        if (map.ground[cy * map.width + cx] === 'path') xs.push(cx + 0.5);
      return xs;
    };
    const north = pathXs(minY - 2);
    const south = pathXs(maxY + 1);
    expect(north.length).toBeGreaterThan(0);
    expect(south.length).toBeGreaterThan(0);
    for (const s of passage) {
      expect(s.x).toBeGreaterThan(Math.min(...north, ...south) - 0.5);
      expect(s.x).toBeLessThan(Math.max(...north, ...south) + 0.5);
    }
  });

  it('la simulation traverse sur la ligne: trajet d’un chemin à l’autre, et place du pêcheur', () => {
    const route = findPath(
      { map, dynamic: new Uint8Array(map.width * map.height) },
      { x: 18.5, y: minY - 2.5 },
      { x: 18.5, y: maxY + 1.5 },
    );
    expect(route).not.toBeNull();
    // Le trajet est une suite de segments droits: on le suit tous les 10 cm dans le gué.
    const points = [{ x: 18.5, y: minY - 2.5 }, ...(route ?? [])];
    let checked = 0;
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1];
      const b = points[i];
      if (a === undefined || b === undefined) continue;
      const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 0.1);
      for (let k = 0; k <= steps; k += 1) {
        const x = a.x + ((b.x - a.x) * k) / steps;
        const y = a.y + ((b.y - a.y) * k) / steps;
        if (y <= minY || y >= maxY) continue;
        expect(Math.abs(x - lineAt(y))).toBeLessThan(0.3);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(30);
    const ford = map.points.river_ford;
    if (ford === undefined) throw new Error('river_ford');
    expect(Math.abs(ford.x - lineAt(ford.y))).toBeLessThan(0.3);
  });

  it('15 à 20 pierres dispersées, sans chevauchement, plus nombreuses à l’aval, rien sur la place du héron', () => {
    expect(scatter.length).toBeGreaterThanOrEqual(15);
    expect(scatter.length).toBeLessThanOrEqual(20);
    const downstream = scatter.filter((s) => s.x > lineAt(s.y)).length;
    expect(downstream).toBeGreaterThan(scatter.length - downstream);
    for (const [i, a] of stones.entries()) {
      for (const b of stones.slice(i + 1)) {
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(radius(a) + radius(b));
      }
      expect(a.x - radius(a)).toBeGreaterThan(minX);
      expect(a.x + radius(a)).toBeLessThan(maxX);
    }
    const heron = map.points.heron_stand;
    if (heron === undefined) throw new Error('heron_stand');
    for (const s of scatter)
      expect(Math.hypot(s.x - heron.x, s.y - heron.y)).toBeGreaterThan(S.scatter.clearRadius);
  });

  it('pas de grille: jamais plus de trois pierres dispersées alignées', () => {
    for (const [i, a] of scatter.entries()) {
      for (const b of scatter.slice(i + 1)) {
        const length = Math.hypot(b.x - a.x, b.y - a.y);
        const near = scatter.filter(
          (c) =>
            Math.abs((b.x - a.x) * (a.y - c.y) - (a.x - c.x) * (b.y - a.y)) / length <
            S.scatter.alignTolerance,
        );
        expect(near.length).toBeLessThanOrEqual(3);
      }
    }
  });
});
