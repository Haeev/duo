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
    // Jour 3 à midi sur deux semaines (jours 1 à 15).
    expect(snap.progress).toBeGreaterThan(0.15);
    expect(snap.progress).toBeLessThan(0.2);
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

  /** Une sauvegarde de l'ancienne version (format 1, une semaine): champs de la semaine 2 retirés. */
  function asVersion1(world: unknown, ended: boolean): Record<string, unknown> {
    const w = JSON.parse(JSON.stringify(world)) as Record<string, unknown>;
    delete w.orderIndex;
    delete w.orderHistory;
    if (ended) {
      // L'ancienne version finissait la démo au départ du jour 8, sans la quête ni le drapeau de la semaine 2.
      w.phase = 'ended';
      w.ending = { days: 8, linesDone: 4, linesTotal: 4, furniturePlaced: 3, keyFound: true };
      w.quests = (w.quests as { id: string }[]).filter((q) => q.id !== 'second_order');
      w.flags = (w.flags as string[]).filter((f) => f !== 'week1_over');
      w.letters = (w.letters as { id: string }[]).filter((l) => l.id !== 'coop_order_2');
      const clock = w.clock as Record<string, unknown>;
      clock.running = false;
      clock.stoppedBy = 'ended';
    }
    return w;
  }

  it('reprend une sauvegarde de l’ancienne version finie au jour 8: la semaine 2 se joue jusqu’au bout', () => {
    const sim = newSim(42);
    play(sim, createRobot(), (s) => s.world.orderHistory.length === 1 && s.world.scene === null && s.world.scripts.length === 0, MAX_TICKS);
    expect(sim.world.clock.day).toBe(8);
    const old = asVersion1(sim.world, true);
    const { content, map } = contentAndMap();
    const restored = restoreWorld(content, map, old, 1, [A, B]);
    const w = restored.world;
    expect(w.phase).toBe('day');
    expect(w.ending).toBeNull();
    expect(w.orderIndex).toBe(1);
    expect(w.orderHistory).toEqual([{ linesDone: 4, linesTotal: 4, complete: true, amount: 540 }]);
    // Les effets durables de l'échéance du jour 8 que l'ancienne version n'avait pas: quête, drapeau.
    expect(w.quests.find((q) => q.id === 'second_order')?.status).toBe('active');
    play(restored, createRobot(), (s) => s.world.phase === 'ended', MAX_TICKS);
    expect(w.clock.day).toBe(15);
    expect(w.orderHistory.map((o) => o.complete)).toEqual([true, true]);
    expect(snapshotOf(restored).dataSchema).toBe(2);
  });

  it('reprend une sauvegarde de l’ancienne version en cours de semaine 1, et la fin vient au jour 15', () => {
    const sim = newSim(7);
    play(sim, createRobot(), (s) => s.world.clock.day === 4 && s.world.phase === 'day', MAX_TICKS);
    const { content, map } = contentAndMap();
    const restored = restoreWorld(content, map, asVersion1(sim.world, false), 1, [A, B]);
    expect(restored.world.orderIndex).toBe(0);
    expect(restored.world.orderHistory).toEqual([]);
    play(restored, createRobot(), (s) => s.world.phase === 'ended', MAX_TICKS);
    expect(restored.world.clock.day).toBe(15);
    expect(restored.world.orderHistory.map((o) => o.amount)[0]).toBe(540);
  });
});
