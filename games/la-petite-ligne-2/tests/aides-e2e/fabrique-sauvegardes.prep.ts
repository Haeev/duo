// Fabrique les sauvegardes de départ des parcours (lancé par `globalSetup` de Playwright, par
// Vitest car le contenu du jeu se charge par `import.meta.glob`). Parties posées directement à
// Aubrune (le départ réglé du jeu est la gare d'essai): avant la scène d'accueil, après elle, et
// acte 1 fini.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { createWorld } from '../../src/simulation/noyau/monde';
import { MEMBERS, SEED } from '../aides';
import { contentWith, wait } from '../aides-l3';
import { createSim } from '../../src/simulation/noyau/pas';
import type { WorldState } from '../../src/etat/monde';
import { FIXTURES } from './serveur';

type Json = Record<string, unknown>;

const version = (
  JSON.parse(readFileSync(join(import.meta.dirname, '../../package.json'), 'utf8')) as {
    version: string;
  }
).version;

function aubruneContent(): ReturnType<typeof contentWith> {
  return contentWith((files) => {
    const settings = files['commun/reglages.json'] as { start: Json };
    settings.start = { ...settings.start, place: 'aubrune', minute: 6 * 60 + 10 };
  });
}

function write(name: string, label: string, world: WorldState): void {
  mkdirSync(FIXTURES, { recursive: true });
  const save = {
    slot: 1,
    label,
    dataSchema: world.schema,
    gameVersion: version,
    moment: 'jour',
    savedAt: new Date().toISOString(),
    data: JSON.stringify(world),
  };
  writeFileSync(join(FIXTURES, `${name}.json`), JSON.stringify(save));
}

it('fabrique la sauvegarde « aubrune » (6 h 10, avant la scène d’accueil)', () => {
  write('aubrune', 'Aubrune, 6 h 10', createWorld(aubruneContent(), SEED, MEMBERS));
});

it('fabrique la sauvegarde « aubrune-apres-scene » (scène d’accueil lue, étape « lettre » en cours)', () => {
  const content = aubruneContent();
  const sim = createSim(content, createWorld(content, SEED, MEMBERS));
  // Les répliques passent au délai (ni l'une ni l'autre machine n'envoie de lecture ici).
  for (let i = 0; i < 40 && (i === 0 || (sim.world.common.story?.scene ?? null) !== null); i++)
    wait(sim, 3);
  expect(sim.world.common.story?.scene ?? null, 'la scène d’accueil est finie').toBeNull();
  expect(sim.world.progress.quests['le-train-de-5h12']?.passed).toEqual(['quai']);
  write('aubrune-apres-scene', 'Aubrune, après l’accueil', sim.world);
});

it('fabrique la sauvegarde « aubrune-acte2 » (acte 1 fini, acte 2 commencé par le moteur)', () => {
  const content = aubruneContent();
  const sim = createSim(content, createWorld(content, SEED, MEMBERS));
  const act1 = content.places.aubrune?.quests['le-train-de-5h12'];
  if (act1 === undefined) throw new Error('acte 1 absent');
  const steps = act1.chapters.flatMap((c) => c.steps.map((st) => st.id));
  sim.world.progress.quests['le-train-de-5h12'] = {
    chapter: act1.chapters.at(-1)?.id ?? '',
    step: steps.at(-1) ?? '',
    done: true,
    passed: steps,
  };
  wait(sim, 2);
  expect(sim.world.progress.quests['la-minute-d-ecart'], 'l’acte 2 démarre seul').toBeDefined();
  write('aubrune-acte2', 'Aubrune, acte 2', sim.world);
});
