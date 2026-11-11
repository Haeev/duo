// Gestes à deux (cahier R12): les deux sur le même arbre ou au même établi, dans la fenêtre de
// `RULES.together`, rapportent 50 % de plus; seul, ou trop espacés, le butin reste le même.
import { describe, expect, it } from 'vitest';
import { loadContent } from '../src/donnees/charger';
import type { PlayerIndex } from '../src/donnees/schemas/communs';
import { jobAt } from '../src/simulation/fabrication/index';
import { stationOf } from '../src/simulation/fabrication/plans';
import type { Sim } from '../src/simulation/noyau/pas';
import { RULES } from '../src/simulation/regles/reglages';
import { act, wait } from './aides-l3';
import { put, run, SOUTH } from './aides-noyau';
import { dataFiles, newSim } from './aides';

/** Le chêne d'essai donne toujours 4 bûches: le compte se lit sans aléa. */
function oakContent(): ReturnType<typeof loadContent> {
  const files = dataFiles() as Record<string, { loot: { min: number; max: number }[] }>;
  const oak = files['commun/ressources/chene.json'];
  if (oak?.loot[0] === undefined) throw new Error('chêne absent');
  oak.loot[0].min = 4;
  oak.loot[0].max = 4;
  return loadContent(files);
}
const content = oakContent();

function count(sim: Sim, item: string, player: PlayerIndex): number {
  const state = sim.world.players[player];
  return [...state.toolbar, ...(state.bag?.slots ?? [])].reduce(
    (sum, stack) => sum + (stack?.item === item ? stack.count : 0),
    0,
  );
}

function axe(sim: Sim, player: PlayerIndex): void {
  sim.world.players[player].toolbar[0] = { item: 'hache', count: 1 };
  sim.world.players[player].selected = 0;
}

/** Coupe le chêne: chaque tour, chacun des joueurs donnés frappe une fois. */
function chop(sim: Sim, players: readonly PlayerIndex[]): number {
  for (let round = 0; round < 12; round++) {
    for (const p of players) {
      act(sim, p, { type: 'act' });
      run(sim, 1.2);
    }
    if ((sim.world.places[sim.world.common.place]?.objects.chene?.harvest?.back ?? null) !== null)
      break;
  }
  return count(sim, 'buche', 0) + count(sim, 'buche', 1);
}

function twoAtTheOak(): Sim {
  const sim = newSim(content);
  axe(sim, 0);
  axe(sim, 1);
  put(sim, 0, 3.5, 35.4, SOUTH);
  put(sim, 1, 3.5, 37.6, -Math.PI / 2);
  run(sim, 0.1);
  return sim;
}

describe('gestes à deux', () => {
  it('deux joueurs sur un chêne donnent 1,5 fois plus de bûches', () => {
    const alone = newSim(content);
    axe(alone, 0);
    put(alone, 0, 3.5, 35.4, SOUTH);
    run(alone, 0.1);
    expect(chop(alone, [0])).toBe(4);

    const duo = twoAtTheOak();
    expect(chop(duo, [0, 1])).toBe(4 * RULES.together.lootFactor);
  });

  it('hors de la fenêtre, l’aide ne compte pas: un coup de l’autre, puis seul trop longtemps', () => {
    const sim = twoAtTheOak();
    act(sim, 1, { type: 'act' });
    run(sim, 1.2 + RULES.together.windowSeconds);
    expect(chop(sim, [0])).toBe(4);
  });

  it('à deux au même établi: l’ouvrage rapporte 1,5 fois plus', () => {
    const sim = newSim(content);
    const bench = stationOf(sim, 'etabli-de-gare');
    if (bench === null) throw new Error('établi absent');
    for (const p of [0, 1] as const) {
      sim.world.players[p].body.x = bench.x + (p === 0 ? -0.2 : 0.2);
      sim.world.players[p].body.y = bench.y + 1;
    }
    sim.world.players[0].toolbar[0] = { item: 'pierre', count: 2 };
    act(sim, 0, {
      type: 'craft_start',
      target: 'etabli-de-gare',
      plan: 'pierre-a-aiguiser',
      variant: 0,
    });
    for (let i = 0; i < 10 && jobAt(sim.world, 'etabli-de-gare') !== null; i++) {
      for (const p of [0, 1] as const)
        act(sim, p, { type: 'craft_strike', target: 'etabli-de-gare' });
      wait(sim, 1);
    }
    // Le plan donne 2 pierres à aiguiser; à deux, 3.
    expect(count(sim, 'pierre-a-aiguiser', 0)).toBe(3);
  });
});
