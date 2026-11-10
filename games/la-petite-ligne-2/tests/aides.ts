/** Aides communes des tests: contenu du jeu, partie neuve, données fabriquées. */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContent, type Content } from '../src/donnees/charger';
import { createWorld, type Member } from '../src/simulation/noyau/monde';
import { createSim, type Sim } from '../src/simulation/noyau/pas';

const DATA_DIR = fileURLToPath(new URL('../donnees/', import.meta.url));

function walk(dir: string, out: string[]): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (name.endsWith('.json')) out.push(path);
  }
  return out;
}

/** Les fichiers de `donnees/` tels quels (le vrai départ du jeu: le prologue du train de nuit). */
export function gameDataFiles(): Record<string, unknown> {
  const files: Record<string, unknown> = {};
  for (const path of walk(DATA_DIR, [])) {
    files[relative(DATA_DIR, path).split(sep).join('/')] = JSON.parse(
      readFileSync(path, 'utf8'),
    ) as unknown;
  }
  return files;
}

/**
 * Départ des tests: la gare d'essai à 10 h (lieux d'essai, `donnees/lieux/essai-*`), où se jouent
 * les règles sans l'histoire. Le jeu, lui, part du prologue (`gameDataFiles`).
 */
export const TEST_START = { place: 'essai-gare', minute: 600 } as const;

/**
 * Les fichiers de `donnees/`, lus sur le disque, départ réglé sur `TEST_START`: une copie neuve à
 * chaque appel, modifiable par le test.
 */
export function dataFiles(): Record<string, unknown> {
  const files = gameDataFiles();
  const settings = files['commun/reglages.json'] as { start: Record<string, unknown> };
  settings.start = { ...settings.start, ...TEST_START };
  return files;
}

export const MEMBERS: readonly [Member, Member] = [
  { id: 'membre-a', name: 'Ada' },
  { id: 'membre-b', name: 'Bob' },
];
export const SEED = 7;

export function gameContent(): Content {
  return loadContent(dataFiles());
}

export function newSim(content: Content = gameContent(), seed: number = SEED): Sim {
  return createSim(content, createWorld(content, seed, MEMBERS));
}
