// Coquillages et rivière (cahier 4.7): les trouvailles de berge posées par le plan d'Aubrune se ramassent
// à la touche d'action, selon l'heure et la pluie, et repoussent. Placement: `controler_trouvailles.py`.
import { describe, expect, it } from 'vitest';
import type { PlayerIndex } from '../src/donnees/schemas/communs';
import { aimOf } from '../src/simulation/briques/visee';
import type { Sim } from '../src/simulation/noyau/pas';
import { contentWith } from './aides-l3';
import { newSim } from './aides';
import { put, run, send, SOUTH } from './aides-noyau';

/** Aubrune à 10 h, sous un seul temps toute l'année (la météo se recalcule à chaque pas). */
function start(weather: 'clear' | 'rain'): Sim {
  const content = contentWith((files) => {
    const settings = files['commun/reglages.json'] as { start: Record<string, unknown> };
    settings.start = { ...settings.start, place: 'aubrune', minute: 600 };
    const climate = files['lieux/aubrune/climat.json'] as {
      seasons: Record<string, { weights: Record<string, number> }>;
    };
    for (const season of Object.values(climate.seasons)) season.weights = { [weather]: 1 };
  });
  const sim = newSim(content);
  run(sim, 0.2);
  const story = sim.world.common.story;
  if (story !== undefined) story.scene = null;
  return sim;
}

function count(sim: Sim, item: string, player: PlayerIndex = 0): number {
  const state = sim.world.players[player];
  return [...state.toolbar, ...(state.bag?.slots ?? [])].reduce(
    (sum, stack) => sum + (stack?.item === item ? stack.count : 0),
    0,
  );
}

function pick(sim: Sim): void {
  send(sim, 0, { type: 'act' });
  run(sim, 1.6);
}

describe('trouvailles de berge d’Aubrune', () => {
  it('coquilles de la grève du gué: une par temps sec, rien de plus le jour même, de retour le lendemain', () => {
    const sim = start('clear');
    put(sim, 0, 187.5, 128.4, SOUTH);
    run(sim, 0.1);
    expect(aimOf(sim, 0)).toMatchObject({
      id: 'berge-coquilles-gue-1',
      verb: 'Ramasser',
      refusal: null,
    });
    pick(sim);
    expect(count(sim, 'coquille-de-riviere')).toBe(1);
    // Ramassée: la visée passe aux pierres plates voisines, la grève ne redonne rien aujourd'hui.
    pick(sim);
    expect(count(sim, 'coquille-de-riviere')).toBe(1);

    sim.world.common.day += 1;
    run(sim, 1 / 30);
    put(sim, 0, 187.5, 128.4, SOUTH);
    run(sim, 0.1);
    expect(aimOf(sim, 0)).toMatchObject({ id: 'berge-coquilles-gue-1', refusal: null });
  });

  it('après un jour de pluie, la grève en donne deux ou trois', () => {
    const sim = start('rain');
    expect(sim.world.common.weather).toBe('rain');
    // Le lendemain d'un jour de pluie (`rainedYesterday`): le premier jour n'a pas de veille.
    sim.world.common.day += 1;
    run(sim, 1 / 30);
    put(sim, 0, 190.5, 128.4, SOUTH);
    run(sim, 0.1);
    expect(aimOf(sim, 0)?.id).toBe('berge-coquilles-gue-2');
    pick(sim);
    expect(count(sim, 'coquille-de-riviere')).toBeGreaterThanOrEqual(2);
  });

  it('plumes du saule de l’aval: rien en pleine journée, une plume à l’aube', () => {
    const sim = start('clear');
    put(sim, 0, 264.5, 129.4, SOUTH);
    run(sim, 0.1);
    expect(aimOf(sim, 0)).toMatchObject({ id: 'berge-plumes-aval', refusal: 'nothing-now' });
    sim.world.minutes = 400;
    run(sim, 0.1);
    expect(aimOf(sim, 0)?.refusal).toBeNull();
    pick(sim);
    expect(count(sim, 'plume-de-heron') + count(sim, 'plume-de-martin-pecheur')).toBe(1);
  });
});
