// Sauvegarde du monde: JSON complet, reprise quelle que soit la machine qui héberge (SV-04).
import { describe, expect, it } from 'vitest';
import { restoreWorld, SaveError, snapshotOf } from '../src/sauvegarde/sauvegarde';
import { hashState as hash } from '@duo/sdk/sim';
import { SIM_HZ } from '../src/simulation/constantes';
import { contentAndMap, createRobot, newSim, play } from './aides';

const A = { id: 'membre-a', name: 'Camille', color: '#e07a5f' };
const B = { id: 'membre-b', name: 'Sacha', color: '#3d85c6' };
const MAX_TICKS = SIM_HZ * 60 * 120;

describe('sauvegarde', () => {
  it("se relit à l'identique, même quand c'est l'autre machine qui héberge, et la démo se finit", () => {
    const sim = newSim();
    const robot = createRobot();
    play(sim, robot, (s) => s.world.clock.day === 3 && s.world.clock.minutes >= 12 * 60, MAX_TICKS);
    const snap = snapshotOf(sim);
    expect(snap.label).toMatch(/lundi, jour 3, 12 h/);
    expect(snap.progress).toBeGreaterThan(0.2);
    const json = JSON.stringify(snap.data);
    expect(json.length).toBeLessThan(1024 * 1024);
    const { content, map } = contentAndMap();
    // Sacha héberge cette fois: chacun retrouve quand même son personnage.
    const restored = restoreWorld(content, map, JSON.parse(json) as unknown, snap.dataSchema, [B, A]);
    // Tout ce qui compte est retrouvé; seuls les menus, visées et trajets en cours sont remis à zéro (SV-02).
    const lasting = (w: typeof snap.data): Record<string, unknown> => ({
      clock: w.clock,
      purse: w.purse,
      garden: w.garden,
      trees: w.trees,
      quests: w.quests,
      counters: w.counters,
      furniture: w.furniture,
      cellar: w.cellar,
      crate: w.crate,
      letters: w.letters,
      rng: w.rng,
      bags: w.characters.map((c) => [c.playerId, c.bag, c.needs, c.endurance, c.pos, c.envie]),
    });
    expect(hash(lasting(restored.world))).toBe(hash(lasting(snap.data)));
    expect(restored.world.characters.find((c) => c.playerId === A.id)?.id).toBe('p1');
    expect(restored.world.characters.find((c) => c.playerId === B.id)?.id).toBe('p2');
    play(restored, createRobot(), (s) => s.world.phase === 'ended', MAX_TICKS);
    expect(restored.world.phase).toBe('ended');
    expect(restored.world.orderResult?.complete).toBe(true);
  });

  it("donne le personnage libre à un joueur dont l'identifiant a changé (machine réinstallée)", () => {
    const sim = newSim();
    const { content, map } = contentAndMap();
    const nouveau = { id: 'membre-c', name: 'Camille', color: '#e07a5f' };
    const restored = restoreWorld(content, map, structuredClone(sim.world), 1, [nouveau, B]);
    expect(restored.world.characters.map((c) => c.playerId)).toEqual(['membre-c', 'membre-b']);
  });

  it("refuse une sauvegarde d'une version plus récente et une sauvegarde abîmée", () => {
    const sim = newSim();
    const { content, map } = contentAndMap();
    expect(() => restoreWorld(content, map, structuredClone(sim.world), 99, [A, B])).toThrow(SaveError);
    expect(() => restoreWorld(content, map, { tick: 'abc' }, 1, [A, B])).toThrow(SaveError);
  });
});
