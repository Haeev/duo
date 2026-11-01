import { describe, expect, it } from 'vitest';
import type { MapProp } from '../etat/carte';
import {
  boxBlur,
  occludersOfProp,
  occlusionFromMask,
  rasterizeOccluders,
  type OcclusionGrid,
} from './occlusion';

const grid: OcclusionGrid = { originX: 0, originY: 0, width: 40, height: 40, texelsPerMeter: 4 };

function prop(model: string, category: string, rect: MapProp['rect']): MapProp {
  return { id: model, model, pos: { x: 5, y: 5 }, rotation: 0, rect, height: 1, category };
}

describe('occlusion cuite du sol', () => {
  it('donne une forme aux bâtiments, aux arbres et aux rochers, aucune aux sols ni aux clôtures', () => {
    expect(occludersOfProp(prop('station', 'batiment', { x: 2, y: 2, w: 4, h: 3 }))[0]?.kind).toBe('rect');
    const tree = occludersOfProp(prop('tree_oak_02', 'arbre', { x: 5, y: 5, w: 1, h: 1 }));
    expect(tree).toHaveLength(2);
    expect(tree.every((shape) => shape.kind === 'disc')).toBe(true);
    expect(occludersOfProp(prop('rock', 'decor', { x: 5, y: 5, w: 1, h: 1 }))).toHaveLength(1);
    expect(occludersOfProp(prop('platform', 'sol', { x: 0, y: 0, w: 30, h: 4 }))).toHaveLength(0);
    expect(occludersOfProp(prop('fence', 'decor', { x: 5, y: 5, w: 1, h: 1 }))).toHaveLength(0);
  });

  it('le flou garde la somme (aucune lumière inventée ni perdue loin des bords)', () => {
    const values = new Float32Array(grid.width * grid.height);
    values[20 * grid.width + 20] = 1;
    const blurred = boxBlur(values, grid.width, grid.height, 2);
    const sum = blurred.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  it('assombrit le pied d’un mur et s’éteint à quelques dizaines de centimètres', () => {
    const mask = rasterizeOccluders(grid, [{ kind: 'rect', x: 4, y: 4, w: 2, h: 2, weight: 1 }]);
    const occlusion = occlusionFromMask(mask, grid, 0.7);
    const at = (x: number, y: number): number =>
      occlusion[Math.floor(y * grid.texelsPerMeter) * grid.width + Math.floor(x * grid.texelsPerMeter)] ?? 0;
    expect(at(5, 5)).toBe(1);
    expect(at(6.1, 5)).toBeGreaterThan(0.5);
    expect(at(7.2, 5)).toBe(0);
    expect(at(6.1, 5)).toBeGreaterThan(at(6.5, 5));
  });
});
