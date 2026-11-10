// Fabrique les sauvegardes de départ des parcours (lancé par `globalSetup` de Playwright, par
// Vitest car le contenu du jeu se charge par `import.meta.glob`). Le jeu part du prologue (train
// de nuit): la gare d'essai (parcours des règles), le prologue à sa dernière étape, et des
// parties posées à Aubrune: avant la scène d'accueil, après elle, et acte 1 fini.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { createWorld } from '../../src/simulation/noyau/monde';
import { gameDataFiles, MEMBERS, SEED } from '../aides';
import { loadContent } from '../../src/donnees/charger';
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

it('fabrique la sauvegarde « essai-gare » (partie neuve à la gare d’essai, 10 h)', () => {
  // Le jeu part du prologue; les parcours des règles partent d'ici (`startDuo` par défaut).
  write(
    'essai-gare',
    'Gare d’essai, 10 h',
    createWorld(
      contentWith(() => undefined),
      SEED,
      MEMBERS,
    ),
  );
});

it('fabrique la sauvegarde « train-de-nuit-porte » (prologue joué jusqu’à la porte du wagon)', () => {
  // Le vrai départ du jeu (prologue), avancé par la simulation jusqu'à la dernière étape.
  const content = loadContent(gameDataFiles());
  const sim = createSim(content, createWorld(content, SEED, MEMBERS));
  wait(sim, 0.5);
  expect(sim.world.common.place).toBe('train-de-nuit');
  const terminus = content.places['train-de-nuit']?.quests.terminus;
  const steps = terminus?.chapters.flatMap((c) => c.steps.map((st) => st.id)) ?? [];
  sim.world.progress.quests.terminus = {
    chapter: 'prologue',
    step: 'descendre',
    done: false,
    passed: steps.slice(0, -1),
  };
  // La scène du compartiment est passée, la nuit aussi: réveil à 6 h, dans le compartiment (loin de la porte).
  const story = sim.world.common.story;
  if (story !== undefined) story.scene = null;
  sim.world.minutes = 6 * 60;
  const room = content.places['train-de-nuit']?.map.points.compartiment ?? { x: 5, y: 4 };
  sim.world.players[0].body = { x: room.x - 0.6, y: room.y, facing: 0, speed: 0 };
  sim.world.players[1].body = { x: room.x + 0.6, y: room.y, facing: 0, speed: 0 };
  wait(sim, 0.5);
  expect(sim.world.common.place).toBe('train-de-nuit');
  expect(sim.world.common.story?.departure, 'pas encore de départ').toBeUndefined();
  write('train-de-nuit-porte', 'Train de nuit, la porte', sim.world);
});

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
