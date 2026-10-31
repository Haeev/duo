import { describe, expect, it } from 'vitest';

import {
  buildNotes,
  buildVersionFile,
  extractChangelogSection,
  firstSentence,
  formatChecksums,
  hasForbiddenDash,
} from '../preparer-release.mjs';

const CHANGELOG = `# Journal des versions de Duo

Intro.

## [Non publié]

### Modifié

- Rien encore.

## [0.2.0] - 2026-11-20

Corrige la reconnexion après une mise en veille. Et autre chose.

### Corrigé

- La reconnexion.

## [0.1.0] - 2026-10-31

Première préversion.

### Ajouté

- Tout.

[0.2.0]: https://github.com/Haeev/duo/releases/tag/v0.2.0
`;

describe('extractChangelogSection', () => {
  it('extrait la section de la version, sans la suivante ni les liens', () => {
    expect(extractChangelogSection(CHANGELOG, '0.2.0')).toEqual({
      date: '2026-11-20',
      body: 'Corrige la reconnexion après une mise en veille. Et autre chose.\n\n### Corrigé\n\n- La reconnexion.',
    });
    expect(extractChangelogSection(CHANGELOG, '0.1.0')?.body).toBe(
      'Première préversion.\n\n### Ajouté\n\n- Tout.',
    );
  });

  it('ne confond pas deux versions proches et refuse une section absente', () => {
    expect(extractChangelogSection(CHANGELOG, '0.1')).toBeNull();
    expect(extractChangelogSection(CHANGELOG, '1.0.0')).toBeNull();
    expect(
      extractChangelogSection('## [0.3.0] - 2026-12-01\n\n## [0.2.0] - 2026-11-20\nx', '0.3.0'),
    ).toBeNull();
  });
});

describe('firstSentence', () => {
  it('donne la première phrase du premier paragraphe', () => {
    expect(firstSentence('Corrige la reconnexion.\nSuite. Encore.\n\n### Corrigé')).toBe(
      'Corrige la reconnexion.',
    );
    expect(firstSentence('### Ajouté\n\n- x')).toBe('- x');
    expect(firstSentence('Sans point final')).toBe('Sans point final');
  });
});

describe('contrôles et fichiers produits', () => {
  it('repère les tirets interdits', () => {
    expect(hasForbiddenDash(`a ${String.fromCharCode(0x2013)} b`)).toBe(true);
    expect(hasForbiddenDash('a - b')).toBe(false);
  });

  it('écrit les empreintes au format de sha256sum', () => {
    expect(formatChecksums([{ name: 'Duo-Windows.exe', size: 3, sha256: 'ab' }])).toBe(
      'ab  Duo-Windows.exe\n',
    );
  });

  it("produit duo-version.json selon le schéma de l'ADR 0011", () => {
    const mac = { name: 'Duo-macOS.dmg', size: 10, sha256: 'aa' };
    const windows = { name: 'Duo-Windows.exe', size: 20, sha256: 'bb' };
    expect(
      buildVersionFile({
        version: '0.1.0',
        date: '2026-10-31',
        summary: 'Démo.',
        repository: 'Haeev/duo',
        mac,
        windows,
      }),
    ).toEqual({
      schema: 1,
      version: '0.1.0',
      publishedAt: '2026-10-31',
      summary: 'Démo.',
      page: 'https://github.com/Haeev/duo/releases/tag/v0.1.0',
      guide: 'https://github.com/Haeev/duo/blob/main/docs/guides/installer-duo.md',
      requires: { darwin: '13.0', win32: '10.0' },
      files: { 'darwin-arm64': mac, 'win32-x64': windows },
    });
  });

  it('ajoute aux notes le guide de la version et les alertes à franchir', () => {
    const notes = buildNotes({ version: '0.1.0', body: 'Démo.', repository: 'Haeev/duo' });
    expect(notes.startsWith('Démo.\n')).toBe(true);
    expect(notes).toContain(
      'https://github.com/Haeev/duo/blob/v0.1.0/docs/guides/installer-duo.md',
    );
    expect(notes).toContain('« Ouvrir quand même »');
    expect(notes).toContain('« Exécuter quand même »');
    expect(hasForbiddenDash(notes)).toBe(false);
  });
});
