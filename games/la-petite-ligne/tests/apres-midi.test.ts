// Quêtes d'après-midi des jours creux (gauntlet, tours 4 et 5): la cueillette de pissenlits du jour 6
// jouée pas à pas sur la vraie carte, avec une graine qui tire cette variante (les robots jouent toutes
// les variantes dans `endurance.test.ts` et `robot.test.ts`).
import { describe, expect, it } from 'vitest';
import { distance } from '../src/simulation/contexte';
import { SIM_HZ } from '../src/simulation/constantes';
import { variantOf } from '../src/simulation/conditions';
import { createRobot, newSim, play } from './aides';

describe('pissenlits du jour 6', () => {
  it('cinq pissenlits aux points du bord du bois; les robots en apportent trois à Odette, la quête se termine', () => {
    // Graine 42: variante 0 du jour 6 (`afternoon_d6`), la cueillette.
    const sim = newSim(42);
    expect(variantOf(42, 'afternoon_d6', 2)).toBe(0);
    const robot = createRobot();
    play(sim, robot, (s) => s.world.quests.some((q) => q.id === 'odette_dandelions'), SIM_HZ * 60 * 60);
    expect(sim.world.clock.day).toBe(6);
    const flowers = sim.world.groundItems.filter((g) => g.item === 'dandelion');
    expect(flowers).toHaveLength(5);
    for (const id of ['forage_edge_01', 'forage_edge_02', 'forage_edge_03', 'forage_edge_04', 'forage_edge_05']) {
      const at = sim.map.points[id];
      expect(at, id).toBeDefined();
      expect(flowers.some((g) => at !== undefined && distance(g.pos, at) < 0.01), `pissenlit à ${id}`).toBe(true);
    }
    play(sim, robot, (s) => s.world.quests.some((q) => q.id === 'odette_dandelions' && q.status === 'done') || s.world.clock.day > 6, SIM_HZ * 60 * 60);
    expect(sim.world.quests.find((q) => q.id === 'odette_dandelions')?.status).toBe('done');
    expect(sim.world.clock.day).toBe(6);
  });
});
