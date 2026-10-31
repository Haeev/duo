import { createRandom } from '@duo/sdk/sim';
import { describe, expect, it } from 'vitest';
import { VariantPicker, drawVariation } from './variantes';

describe('variantes (aléa à graine)', () => {
  it('ne répète jamais deux fois de suite la même variante, et les sert toutes', () => {
    const picker = new VariantPicker(createRandom(7));
    let previous = -1;
    const seen = new Set<number>();
    for (let i = 0; i < 400; i += 1) {
      const index = picker.pick('step-grass', 4, true);
      expect(index).not.toBe(previous);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(4);
      seen.add(index);
      previous = index;
    }
    expect(seen.size).toBe(4);
  });

  it('suit chaque son séparément', () => {
    const picker = new VariantPicker(createRandom(3));
    const a = picker.pick('hoe', 3, true);
    picker.pick('sow', 3, true);
    expect(picker.pick('hoe', 3, true)).not.toBe(a);
  });

  it('est reproductible: même graine, même suite', () => {
    const run = (): number[] => {
      const picker = new VariantPicker(createRandom(20261031));
      return Array.from({ length: 50 }, () => picker.pick('harvest', 3, true));
    };
    expect(run()).toEqual(run());
  });

  it('un son « single » ou à un fichier garde sa seule variante', () => {
    const picker = new VariantPicker(createRandom(1));
    expect(picker.pick('water-empty', 1, false)).toBe(0);
    expect(picker.pick('notify', 2, false)).toBe(0);
  });

  it('borne la hauteur et le niveau, et laisse justes les tintements', () => {
    const random = createRandom(11);
    const out = { rate: 1, gainDb: 0 };
    for (let i = 0; i < 200; i += 1) {
      drawVariation(random, 0.06, 1.5, out);
      expect(Math.abs(out.rate - 1)).toBeLessThanOrEqual(0.06);
      expect(Math.abs(out.gainDb)).toBeLessThanOrEqual(1.5);
    }
    drawVariation(random, 0, 0, out);
    expect(out).toEqual({ rate: 1, gainDb: 0 });
  });
});
