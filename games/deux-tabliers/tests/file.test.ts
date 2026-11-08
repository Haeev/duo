// File à la caisse (correctifs du 2026-11-08), tests courts: personne ne bloque la file, les
// clients en file gardent leurs distances, le tirage des clients ne répète pas le même modèle.
import { createRandom } from '@duo/sdk';
import { describe, expect, it } from 'vitest';
import { eveningNotes } from '../src/branchement/interface';
import { ctxOf, deliver } from '../src/clientele';
import { hostWalkers, spawnGroup } from '../src/clientele/clients';
import { loadContent } from '../src/donnees/charger';
import { DATA_FILES } from '../src/donnees/fichiers';
import { IDLE_INPUT } from '../src/simulation/entrees';
import type { GameEvent } from '../src/simulation/evenements';
import { createWorld } from '../src/simulation/monde';
import { stepWorld, type QueuedIntent } from '../src/simulation/pas';
import type { SimContext } from '../src/simulation/systemes';

const DT = 1 / 60;

function openCafe(): {
  step: (intents?: QueuedIntent[]) => void;
  sim: SimContext;
  world: ReturnType<typeof createWorld>;
  events: GameEvent[];
} {
  // Sans la prise en main des premiers jours (`warmup`, testée par `premier-jour.test.ts`): ce
  // fichier vérifie d'autres règles sur des chiffres relevés avec l'affluence pleine dès le mardi.
  const content = loadContent({
    ...DATA_FILES,
    'clientele/regles.json': {
      ...(DATA_FILES['clientele/regles.json'] as Record<string, unknown>),
      warmup: [],
    },
  });
  const world = createWorld(content, ['a', 'b']);
  const random = createRandom(11);
  const events: GameEvent[] = [];
  const step = (intents: QueuedIntent[] = []): void => {
    stepWorld(content, world, [IDLE_INPUT, IDLE_INPUT], intents, DT, random, (e) => events.push(e));
  };
  step();
  for (const topic of ['next-day', 'open'] as const)
    step([
      { player: 0, intent: { type: 'clientele-vote', topic, yes: true } },
      { player: 1, intent: { type: 'clientele-vote', topic, yes: true } },
    ]);
  expect(world.clientele.phase).toBe('service');
  // Rien d'autre n'entre: le test pose lui-même ses clients.
  world.clientele.arrivals = [];
  world.clientele.expected = [];
  const sim: SimContext = {
    world,
    content,
    dt: DT,
    random,
    inputs: [IDLE_INPUT, IDLE_INPUT],
    emit: (e) => events.push(e),
  };
  return { step, sim, world, events };
}

describe('Deux Tabliers, file à la caisse', () => {
  it('une habituée pas servie laisse passer les suivants, attend au zinc, puis revient', () => {
    const { step, sim, world } = openCafe();
    const ctx = ctxOf(sim);
    const item = world.clientele.slate[0]?.[0] ?? 'espresso';
    const simone = spawnGroup(ctx, {
      profile: 'voisins',
      size: 1,
      items: [item],
      regular: 'simone',
    });
    const others = [0, 1].map(() =>
      spawnGroup(ctx, { profile: 'teletravail', size: 1, items: [item] }),
    );
    const rules = sim.content.clientele.rules.queue;
    let sawOtherAtRegister = false;
    let sawSimoneAside = false;
    for (let i = 0; i < 60 * (rules.stepAsideSeconds + 25); i++) {
      step();
      const at = world.clientele.groups.find((g) => g.stage === 'register');
      if (at !== undefined && at.id !== simone.id) sawOtherAtRegister = true;
      if (sawOtherAtRegister && simone.stage === 'queue') {
        const w = hostWalkers(world).get(simone.id);
        // Au zinc (places debout de `regles.json`), pas dans la file.
        if (w !== undefined && w.z < 10.4) sawSimoneAside = true;
      }
    }
    expect(sawOtherAtRegister).toBe(true);
    expect(sawSimoneAside).toBe(true);
    // On sert la tête de file à chaque fois: tout le monde passe, Simone comprise.
    for (let i = 0; i < 60 * 240; i++) {
      const at = world.clientele.groups.find((g) => g.stage === 'register');
      step(
        at !== undefined && i % 120 === 0
          ? [{ player: 0, intent: { type: 'clientele-take-order' } }]
          : [],
      );
      if ([simone, ...others].every((g) => g.paid !== null || g.stage === 'leaving')) break;
    }
    expect(simone.paid).not.toBeNull();
  }, 30_000);

  it('les clients en file restent à 0,6 m au moins les uns des autres', () => {
    const { step, sim, world } = openCafe();
    const ctx = ctxOf(sim);
    const item = world.clientele.slate[0]?.[0] ?? 'espresso';
    for (const size of [1, 2, 1]) spawnGroup(ctx, { profile: 'voisins', size, items: [item] });
    for (let i = 0; i < 60 * 25; i++) step();
    const spacing = sim.content.clientele.rules.queue.spacing;
    // Tous arrêtés à leur rang: le premier de chaque groupe, puis les suivants deux par deux.
    const people: { x: number; z: number }[] = [];
    for (const g of world.clientele.groups) {
      const w = hostWalkers(world).get(g.id);
      if (w === undefined) continue;
      expect(w.path.length).toBe(0);
      const a = (w.yawDeg * Math.PI) / 180;
      for (let k = 0; k < g.size; k++) {
        const back = k === 0 ? 0 : spacing * Math.ceil(k / 2);
        const side = k === 0 ? 0 : k % 2 === 1 ? 0.3 : -0.3;
        people.push({
          x: w.x + Math.sin(a) * back + Math.cos(a) * side,
          z: w.z + Math.cos(a) * back - Math.sin(a) * side,
        });
      }
    }
    expect(people.length).toBe(4);
    for (let i = 0; i < people.length; i++)
      for (let j = i + 1; j < people.length; j++) {
        const p = people[i];
        const q = people[j];
        if (p === undefined || q === undefined) continue;
        expect(Math.hypot(p.x - q.x, p.z - q.z)).toBeGreaterThanOrEqual(spacing - 0.01);
      }
  }, 30_000);
});

describe('Deux Tabliers, bilan du soir', () => {
  it('« Ce qu’on retient »: habitués servis, ce qui a plu et ce qui a manqué', () => {
    const { step, sim, world } = openCafe();
    const ctx = ctxOf(sim);
    const item = world.clientele.slate[0]?.[0] ?? 'espresso';
    const simone = spawnGroup(ctx, {
      profile: 'voisins',
      size: 1,
      items: [item],
      regular: 'simone',
    });
    for (let i = 0; i < 60 * 40 && simone.paid === null; i++)
      step(
        simone.stage === 'register' && i % 60 === 0
          ? [{ player: 0, intent: { type: 'clientele-take-order' } }]
          : [],
      );
    expect(simone.paid).not.toBeNull();
    expect(deliver(sim, simone.id)).toBeNull();
    // Une file pleine: le groupe suivant n'entre pas.
    for (let i = 0; i < 5; i++) spawnGroup(ctx, { profile: 'voisins', size: 1, items: [item] });
    world.clientele.arrivals = [[world.clientele.serviceSec, 'voisins', 2, false]];
    step();
    world.clientele.today.liked = { quality: 3, latteArt: 1 };
    const notes = eveningNotes(sim.content.clientele, world.clientele);
    expect(notes.regulars.length).toBe(1);
    expect(notes.regulars[0]).toMatch(/^Visite de Simone à \d+ h \d\d : /);
    expect(notes.liked).toEqual([
      '3 clients ont trouvé leur tasse parfaite.',
      '1 client a aimé le dessin sur la mousse.',
    ]);
    expect(notes.missed.map((m) => m.text)).toContain(
      '1 groupe n’est pas entré : la file allait jusqu’à la porte.',
    );
  }, 30_000);
});

describe('Deux Tabliers, allure des clients', () => {
  it('dix clients du même profil à la suite: pas deux fois la même allure de suite', () => {
    const { sim } = openCafe();
    const ctx = ctxOf(sim);
    const rules = sim.content.clientele.rules;
    for (const profile of ['voisins', 'flaneurs', 'presses']) {
      const looks = Array.from(
        { length: 10 },
        () => spawnGroup(ctx, { profile, size: 1, items: ['espresso'] }).look,
      );
      const allowed = rules.looks.filter((l) => l.profiles.includes(profile)).map((l) => l.model);
      for (const look of looks) expect(allowed).toContain(look);
      // Trois allures pour ces profils: chaque fenêtre de trois entrées les a toutes.
      for (let i = 2; i < looks.length; i++)
        expect(new Set(looks.slice(i - 2, i + 1)).size).toBe(3);
    }
  });
});
