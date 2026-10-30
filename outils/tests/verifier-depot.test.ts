import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  checkDependencyRules,
  checkText,
  isBinaryPath,
  isOutsideCodeChecks,
  parseWorkspacePatterns,
  verifyRepository,
} from '../verifier-depot.mjs';

// Assemblés par morceaux, comme dans le script, pour que ce fichier passe le contrôle.
const EM_DASH = String.fromCharCode(0x2014);
const EN_DASH = String.fromCharCode(0x2013);
const DEBUG_PRINT = 'console' + '.log("x");';
const BREAKPOINT = 'debug' + 'ger;';
const MARKER = 'TO' + 'DO';

describe('checkText', () => {
  it('signale les deux tirets interdits avec leur position', () => {
    const issues = checkText('docs/a.md', `Titre\nun ${EM_DASH} deux ${EN_DASH} trois`);
    expect(issues.map(({ rule, line, column }) => ({ rule, line, column }))).toEqual([
      { rule: 'tirets', line: 2, column: 4 },
      { rule: 'tirets', line: 2, column: 11 },
    ]);
  });

  it('cherche les tirets partout, y compris dans design/', () => {
    expect(checkText('design/notes.txt', EM_DASH)).toHaveLength(1);
  });

  it('accepte le trait d’union et un texte propre', () => {
    expect(checkText('docs/a.md', 'un trait-d-union, et rien d’autre')).toEqual([]);
  });

  it('signale affichage de débogage et point d’arrêt dans le code', () => {
    const issues = checkText('apps/duo/src/a.ts', `const a = 1;\n${DEBUG_PRINT}\n  ${BREAKPOINT}\n`);
    expect(issues.map(({ rule, line }) => ({ rule, line }))).toEqual([
      { rule: 'debogage', line: 2 },
      { rule: 'debogage', line: 3 },
    ]);
  });

  it('ne prend pas le mot du point d’arrêt dans une chaîne pour un point d’arrêt', () => {
    expect(checkText('a.ts', `const word = '${'debug' + 'ger'}';`)).toEqual([]);
  });

  it('exige une référence de ticket sur les marqueurs de tâche', () => {
    const issues = checkText('packages/sdk/src/a.ts', `// ${MARKER} finir\n// ${MARKER}(#12) finir\n`);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ rule: 'marqueurs', line: 1, column: 4 });
  });

  it('laisse de côté le code des sources d’assets, de design/ et le Python', () => {
    const code = `${DEBUG_PRINT}\n// ${MARKER}\n`;
    expect(checkText('games/deux-astres/assets-src/gen.mjs', code)).toEqual([]);
    expect(checkText('design/identite/outil.js', code)).toEqual([]);
    expect(checkText('outils/gen.py', `# ${MARKER}\n`)).toEqual([]);
    expect(isOutsideCodeChecks('games/deux-astres/assets-src/x.js')).toBe(true);
  });

  it('ne cherche pas le code dans la documentation Markdown', () => {
    expect(checkText('docs/guide.md', `${DEBUG_PRINT} et ${MARKER}`)).toEqual([]);
  });
});

describe('isBinaryPath', () => {
  it('reconnaît les binaires déclarés dans .gitattributes', () => {
    for (const file of ['a.png', 'b.GLB', 'c.ogg', 'd.m4a', 'e.wav', 'f.woff2', 'g.icns', 'h.ico']) {
      expect(isBinaryPath(file)).toBe(true);
    }
    expect(isBinaryPath('a.ts')).toBe(false);
  });
});

describe('checkDependencyRules', () => {
  const base = { dependencies: {}, devDependencies: {} };

  it('refuse un jeu qui dépend d’un autre jeu ou de l’application', () => {
    const issues = checkDependencyRules([
      { ...base, dir: 'apps/duo', name: 'duo' },
      { ...base, dir: 'games/a', name: '@duo-jeux/a', dependencies: { '@duo-jeux/b': 'workspace:*' } },
      { ...base, dir: 'games/b', name: '@duo-jeux/b', devDependencies: { duo: 'workspace:*' } },
    ]);
    expect(issues.map((issue) => issue.file)).toEqual(['games/a/package.json', 'games/b/package.json']);
  });

  it('refuse une application qui dépend d’un jeu', () => {
    const issues = checkDependencyRules([
      { ...base, dir: 'apps/duo', name: 'duo', dependencies: { '@duo-jeux/a': 'workspace:*' } },
      { ...base, dir: 'games/a', name: '@duo-jeux/a' },
    ]);
    expect(issues).toHaveLength(1);
  });

  it('limite @duo/protocol à valibot', () => {
    const ok = { ...base, dir: 'packages/protocol', name: '@duo/protocol', dependencies: { valibot: '1.5.0' } };
    expect(checkDependencyRules([ok])).toEqual([]);
    expect(
      checkDependencyRules([{ ...ok, dependencies: { valibot: '1.5.0', ws: '8.22.0' } }]),
    ).toHaveLength(1);
  });

  it('accepte un jeu qui dépend du SDK', () => {
    expect(
      checkDependencyRules([
        { ...base, dir: 'packages/sdk', name: '@duo/sdk' },
        { ...base, dir: 'games/a', name: '@duo-jeux/a', dependencies: { '@duo/sdk': 'workspace:*' } },
      ]),
    ).toEqual([]);
  });
});

describe('parseWorkspacePatterns', () => {
  it('lit la liste packages et s’arrête à la clé suivante', () => {
    const yaml = "# x\npackages:\n  - apps/*\n  - 'games/_essais/*' # essais\n  - outils\ncatalog:\n  vite: 8.3.5\n";
    expect(parseWorkspacePatterns(yaml)).toEqual(['apps/*', 'games/_essais/*', 'outils']);
  });
});

describe('verifyRepository', () => {
  let root = '';

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('parcourt un dossier sans Git et ignore node_modules et les binaires', () => {
    root = mkdtempSync(path.join(tmpdir(), 'duo-verifier-'));
    mkdirSync(path.join(root, 'node_modules', 'x'), { recursive: true });
    mkdirSync(path.join(root, 'src'));
    writeFileSync(path.join(root, 'node_modules', 'x', 'a.md'), EM_DASH);
    writeFileSync(path.join(root, 'image.png'), EM_DASH);
    writeFileSync(path.join(root, 'donnees.dat'), Buffer.from([0, 1, 2, 0xe2, 0x80, 0x94]));
    writeFileSync(path.join(root, 'src', 'a.ts'), `export const a = '${EN_DASH}';\n`);
    writeFileSync(path.join(root, 'propre.md'), 'rien à signaler\n');

    const { issues, fileCount } = verifyRepository(root);
    expect(fileCount).toBe(2);
    expect(issues.map((issue) => issue.file)).toEqual(['src/a.ts']);
  });
});
