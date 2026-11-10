// Brique `gather`: cueillir au pommier de la gare d'essai, stock épuisé puis revenu.
import { describe, expect, it } from 'vitest';
import { aimOf } from '../src/simulation/briques/visee';
import type { GameEvent } from '../src/simulation/noyau/evenements';
import type { Sim } from '../src/simulation/noyau/pas';
import { gameContent, newSim } from './aides';
import { put, run, send, SOUTH } from './aides-noyau';

const content = gameContent();

function pick(sim: Sim): GameEvent[] {
  return [...send(sim, 0, { type: 'act' }), ...run(sim, 1)];
}

function apples(sim: Sim): number {
  const state = sim.world.players[0];
  return [...state.toolbar, ...(state.bag?.slots ?? [])].reduce(
    (sum, stack) => sum + (stack?.item === 'pomme' ? stack.count : 0),
    0,
  );
}

describe('brique gather', () => {
  it('cueille trois pommes, refuse la quatrième, puis le pommier se recharge', () => {
    const sim = newSim(content);
    put(sim, 0, 10.5, 21.4, SOUTH);
    run(sim, 0.1);
    expect(aimOf(sim, 0)).toMatchObject({ id: 'pommier', verb: 'Cueillir', refusal: null });
    for (let i = 0; i < 3; i++)
      expect(pick(sim)).toContainEqual(
        expect.objectContaining({ type: 'item_gained', item: 'pomme', count: 1 }),
      );
    expect(apples(sim)).toBe(3);
    expect(aimOf(sim, 0)?.refusal).toBe('not-yet-back');
    sim.world.minutes += 241;
    run(sim, 0.1);
    expect(aimOf(sim, 0)?.refusal).toBeNull();
    pick(sim);
    expect(apples(sim)).toBe(4);
  });
});
