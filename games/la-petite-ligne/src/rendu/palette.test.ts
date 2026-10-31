import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CHARACTER_SLOTS, PALETTE_CELLS, PALETTE_GRID, paletteUv } from './palette';

const PALETTE_SOURCE = new URL('../../assets-src/modeles/palette.py', import.meta.url);

/** Noms des cases de la liste `WORLD` de palette.py, dans l'ordre. */
function worldNamesFromPython(source: string): string[] {
  const start = source.indexOf('WORLD = [');
  const end = source.indexOf('\n]', start);
  const block = source.slice(start, end);
  return [...block.matchAll(/^\s*\("([a-z_]+)",\s*"#/gm)].map((match) => match[1] ?? '');
}

describe('palette', () => {
  it('suit exactement la liste WORLD de palette.py (même ordre)', () => {
    const names = worldNamesFromPython(readFileSync(PALETTE_SOURCE, 'utf8'));
    expect(names.length).toBeGreaterThan(0);
    expect([...PALETTE_CELLS]).toEqual(names);
  });

  it('tient dans la grille de 16 x 16', () => {
    expect(PALETTE_CELLS.length).toBeLessThanOrEqual(PALETTE_GRID * PALETTE_GRID);
  });

  it('vise le centre des cases', () => {
    expect(paletteUv('grass')).toEqual({ u: 0.5 / PALETTE_GRID, v: 0.5 / PALETTE_GRID });
    expect(paletteUv('soil')).toEqual({ u: 0.5 / PALETTE_GRID, v: 1.5 / PALETTE_GRID });
  });

  it('suit les rôles des cases de personnage de palette.py', () => {
    const source = readFileSync(PALETTE_SOURCE, 'utf8');
    const line = /CHAR_SLOTS = \[([^\]]+)\]/.exec(source)?.[1] ?? '';
    const slots = [...line.matchAll(/"([a-z_]+)"/g)].map((match) => match[1] ?? '');
    expect([...CHARACTER_SLOTS]).toEqual(slots);
  });
});
