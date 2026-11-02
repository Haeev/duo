import { describe, expect, it } from 'vitest';
import manifest from '../../../duo-game.json';
import { releaseNotes } from '../notes-version';

const parts = (s: string): number[] => s.split('.').map(Number);
const newer = (a: string, b: string): boolean => {
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  return false;
};

describe('notes de version', () => {
  it('la première note décrit la version du manifeste: on ne publie pas sans ses notes', () => {
    expect(releaseNotes()[0]?.version).toBe(manifest.version);
  });

  it('les versions vont de la plus récente à la plus ancienne, sans doublon', () => {
    const versions = releaseNotes().map((n) => n.version);
    for (let i = 1; i < versions.length; i++)
      expect(newer(versions[i - 1] ?? '', versions[i] ?? '')).toBe(true);
  });

  it('un fichier mal formé est refusé', () => {
    expect(() =>
      releaseNotes({ version: 1, notes: [{ version: '1', titre: '', changements: [] }] }),
    ).toThrow();
  });
});
