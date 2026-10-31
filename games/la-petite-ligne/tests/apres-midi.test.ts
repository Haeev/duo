// Quêtes d'après-midi des jours creux (gauntlet, tour 4): la cueillette de pissenlits du jour 6 jouée
// pas à pas sur la vraie carte (la semaine 1 des robots ne change pas); les trois de la semaine 2
// (colis d'Odette, chevesne de Firmin, carnet de Jeanne) sont jouées par les robots (`robot.test.ts`).
import { describe, expect, it } from 'vitest';
import type { Intent } from '../src/etat/actions';
import type { Sim } from '../src/simulation/contexte';
import { character, distance } from '../src/simulation/contexte';
import { SIM_HZ } from '../src/simulation/constantes';
import { placeCharacter } from '../src/simulation/deplacement';
import { step } from '../src/simulation/pas';
import { countInBag } from '../src/simulation/sac';
import { createRobot, newSim, play } from './aides';

function act(sim: Sim, intent: Intent, ticks = 20): void {
  step(sim, { controls: {}, intents: [{ by: 'p1', intent }] });
  for (let i = 0; i < ticks; i++) step(sim, { controls: {}, intents: [] });
}

describe('pissenlits du jour 6', () => {
  it('cinq pissenlits au bord du bois, trois apportés à Odette: la quête se termine', () => {
    const sim = newSim(7);
    play(sim, createRobot(), (s) => s.world.clock.day === 6 && s.world.clock.minutes >= 12 * 60 + 30 && s.world.scene === null && s.world.phase === 'day', SIM_HZ * 60 * 60);
    expect(sim.world.quests.find((q) => q.id === 'odette_dandelions')?.status).toBe('active');
    const c = character(sim, 'p1');
    const flowers = sim.world.groundItems.filter((g) => g.item === 'dandelion');
    expect(flowers).toHaveLength(5);
    for (const id of ['forage_edge_01', 'forage_edge_02', 'forage_edge_03', 'forage_edge_04', 'forage_edge_05']) {
      const at = sim.map.points[id];
      expect(at, id).toBeDefined();
      expect(flowers.some((g) => at !== undefined && distance(g.pos, at) < 0.01), `pissenlit à ${id}`).toBe(true);
    }
    for (const g of flowers.slice(0, 3)) {
      placeCharacter(sim, c, { x: g.pos.x + 0.6, y: g.pos.y });
      act(sim, { type: 'move_to', target: { kind: 'ground_item', groundItem: g.id }, act: true });
    }
    expect(countInBag(c, 'dandelion')).toBe(3);
    const odette = sim.world.villagers.find((v) => v.id === 'odette');
    if (odette === undefined) throw new Error('Odette absente');
    for (let i = 0; i < SIM_HZ * 600 && !odette.visible; i++) step(sim, { controls: {}, intents: [] });
    expect(odette.visible).toBe(true);
    placeCharacter(sim, c, { x: odette.pos.x + 1, y: odette.pos.y });
    act(sim, { type: 'give', to: 'odette', item: 'dandelion', quality: 'ordinary', count: 3 });
    expect(sim.world.quests.find((q) => q.id === 'odette_dandelions')?.status).toBe('done');
  });
});
