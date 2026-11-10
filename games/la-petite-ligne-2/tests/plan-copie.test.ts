import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Le jeu lit sa propre copie du plan (`donnees/lieux/aubrune/plan.json`): la publication ne
// récupère pas `docs/`. La source reste le plan du level designer; ce test garde les deux égaux
// quand la source est présente (poste de travail), et se tait sur la machine de publication.
const here = path.dirname(fileURLToPath(import.meta.url));
const copy = path.join(here, '..', 'donnees', 'lieux', 'aubrune', 'plan.json');
const source = path.join(
  here,
  '..',
  '..',
  '..',
  'docs',
  'jeux',
  'jeu-1',
  'refonte',
  'carte-aubrune',
  'plan.json',
);

describe('copie du plan d’Aubrune dans les données du jeu', () => {
  it('existe dans le paquet', () => {
    expect(existsSync(copy)).toBe(true);
  });

  it.skipIf(!existsSync(source))('est identique au plan du level designer', () => {
    expect(readFileSync(copy, 'utf8')).toBe(readFileSync(source, 'utf8'));
  });
});
