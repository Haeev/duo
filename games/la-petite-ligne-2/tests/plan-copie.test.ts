import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Le jeu lit ses propres copies des fichiers de conception dont il a besoin: la publication ne
// récupère pas `docs/`. La source reste dans `docs/`; ce test garde chaque copie égale à sa
// source quand celle-ci est présente (poste de travail), et se tait sur la machine de publication.
const here = path.dirname(fileURLToPath(import.meta.url));
const pkg = path.join(here, '..');
const refonte = path.join(pkg, '..', '..', 'docs', 'jeux', 'jeu-1', 'refonte');

const COPIES: readonly { name: string; copy: string; source: string }[] = [
  {
    name: 'plan d’Aubrune',
    copy: path.join(pkg, 'donnees', 'lieux', 'aubrune', 'plan.json'),
    source: path.join(refonte, 'carte-aubrune', 'plan.json'),
  },
  {
    name: 'nuancier de la bible 0.2',
    copy: path.join(pkg, 'assets-src', 'interface-encre', 'nuancier-v02.json'),
    source: path.join(refonte, 'planches', 'source', 'nuancier-v02.json'),
  },
];

describe('copies des fichiers de conception dans le paquet du jeu', () => {
  for (const { name, copy, source } of COPIES) {
    it(`${name}: la copie existe dans le paquet`, () => {
      expect(existsSync(copy)).toBe(true);
    });

    it.skipIf(!existsSync(source))(`${name}: la copie est identique à sa source`, () => {
      expect(readFileSync(copy, 'utf8')).toBe(readFileSync(source, 'utf8'));
    });
  }
});
