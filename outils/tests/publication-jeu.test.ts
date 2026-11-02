import { describe, expect, it } from 'vitest';

import {
  bumpVersion,
  compareVersions,
  entryFromToolLine,
  mergeCatalogue,
  packageUrl,
  parseTag,
  replaceVersionField,
} from '../publication-jeu.mjs';

const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);

function toolLine(version: string, sha256 = SHA_A): Record<string, unknown> {
  return {
    id: 'la-petite-ligne',
    version,
    fichier: `la-petite-ligne-${version}.duogame`,
    taille: 1234,
    sha256,
    manifeste: {
      nom: 'La Petite Ligne',
      description: 'Démo.',
      mode: 'coop',
      duree: [30, 75],
      sdk: '1.0',
    },
  };
}

describe('tags et versions', () => {
  it('lit un tag de jeu, identifiant à tirets compris', () => {
    expect(parseTag('jeu-la-petite-ligne-v0.2.0')).toEqual({
      id: 'la-petite-ligne',
      version: '0.2.0',
    });
    expect(parseTag('jeu-a-v2-v1.0.0-rc.1')).toEqual({ id: 'a-v2', version: '1.0.0-rc.1' });
    expect(parseTag('v0.2.0')).toBeNull();
    expect(parseTag('jeu-La-Ligne-v1.0.0')).toBeNull();
    expect(parseTag('jeu-x-v1.0')).toBeNull();
  });

  it('compare et monte selon SemVer', () => {
    expect(compareVersions('0.10.0', '0.9.9')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0-rc.1', '1.0.0')).toBeLessThan(0);
    expect(compareVersions('1.0.0-rc.2', '1.0.0-rc.10')).toBeLessThan(0);
    expect(bumpVersion('0.1.9', 'patch')).toBe('0.1.10');
    expect(bumpVersion('0.1.9', 'minor')).toBe('0.2.0');
    expect(bumpVersion('0.1.9', 'major')).toBe('1.0.0');
    expect(() => bumpVersion('0.1.0', 'micro')).toThrow();
  });

  it('remplace la seule version du fichier, mise en forme gardée', () => {
    const text = '{\n  "schema": 1,\n  "version": "0.1.0",\n  "sdk": "1.0"\n}\n';
    expect(replaceVersionField(text, '0.2.0')).toBe(text.replace('0.1.0', '0.2.0'));
  });
});

describe('catalogue', () => {
  const autre = {
    id: 'autre-jeu',
    version: '2.0.0',
    manifeste: {},
    taille: 1,
    url: 'x',
    sha256: SHA_B,
  };

  it('construit l’entrée avec l’adresse de la release', () => {
    const entry = entryFromToolLine(toolLine('0.2.0'));
    expect(entry.url).toBe(
      'https://github.com/Haeev/duo/releases/download/jeu-la-petite-ligne-v0.2.0/la-petite-ligne-0.2.0.duogame',
    );
    expect(entry.url).toBe(packageUrl('la-petite-ligne', '0.2.0'));
    expect(Object.keys(entry)).toEqual(['id', 'version', 'manifeste', 'taille', 'url', 'sha256']);
    expect(() => entryFromToolLine({ ...toolLine('0.2.0'), sha256: 'zz' })).toThrow();
  });

  it('crée le catalogue, remplace l’entrée du jeu et garde les autres', () => {
    const first = mergeCatalogue(null, entryFromToolLine(toolLine('0.1.0')));
    expect(first.schema).toBe(1);
    const next = mergeCatalogue(
      { ...first, jeux: [...first.jeux, autre] },
      entryFromToolLine(toolLine('0.2.0', SHA_B)),
    );
    expect(next.jeux.map((game) => `${game.id} ${game.version}`)).toEqual([
      'autre-jeu 2.0.0',
      'la-petite-ligne 0.2.0',
    ]);
  });

  it('refuse un retour en arrière et une version republiée autrement', () => {
    const current = mergeCatalogue(null, entryFromToolLine(toolLine('0.2.0')));
    expect(() => mergeCatalogue(current, entryFromToolLine(toolLine('0.1.0')))).toThrow(
      /plus récente/,
    );
    expect(() => mergeCatalogue(current, entryFromToolLine(toolLine('0.2.0', SHA_B)))).toThrow(
      /autre empreinte/,
    );
    expect(mergeCatalogue(current, entryFromToolLine(toolLine('0.2.0')))).toEqual(current);
    expect(() =>
      mergeCatalogue({ schema: 2, jeux: [] }, entryFromToolLine(toolLine('0.2.0'))),
    ).toThrow();
  });
});
