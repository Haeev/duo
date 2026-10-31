// Le robot joue à deux avec les mêmes intentions que des joueurs: il prouve que la démo se finit.
import { describe, expect, it } from 'vitest';
import { hash } from '../src/simulation/empreinte';
import { step } from '../src/simulation/pas';
import { SIM_HZ } from '../src/simulation/constantes';
import { createRobot, newSim, play } from './aides';

/** Une démo complète dure au plus quelques heures de jeu réel: borne de sécurité. */
const MAX_TICKS = SIM_HZ * 60 * 120;

describe('robot', () => {
  it('joue la première journée: arrivée, poutre, toit et porte, boîte en fer, coucher', () => {
    const sim = newSim();
    const robot = createRobot();
    play(sim, robot, (s) => s.world.clock.day >= 2, MAX_TICKS);
    const w = sim.world;
    expect(w.clock.day).toBe(2);
    expect(w.phase).toBe('breakfast');
    const done = (id: string): boolean => w.quests.some((q) => q.id === id && q.status === 'done');
    expect(done('first_train')).toBe(true);
    expect(w.constructions.filter((k) => k.id.startsWith('house_')).map((k) => k.status)).toEqual(['done', 'done', 'done']);
    expect(w.characters.every((c) => c.created)).toBe(true);
    // La boîte en fer a été ramassée: l'énigme a démarré et chacun a sa carte.
    expect(w.quests.some((q) => q.id === 'emile_riddle')).toBe(true);
    expect(w.letters.some((l) => l.id === 'coop_welcome')).toBe(true);
  });

  it("joue toute la démo jusqu'au train du samedi, sans blocage (D-01)", () => {
    const sim = newSim();
    const robot = createRobot();
    const ticks = play(sim, robot, (s) => s.world.phase === 'ended', MAX_TICKS);
    const w = sim.world;
    expect(w.phase).toBe('ended');
    expect(ticks).toBeLessThan(MAX_TICKS);
    expect(w.clock.day).toBe(8);
    expect(w.orderResult).toEqual({ linesDone: 4, linesTotal: 4, complete: true, amount: 540 });
    expect(w.ending?.days).toBe(8);
    expect(w.ending?.linesDone).toBe(4);
    expect(w.ending?.furniturePlaced).toBeGreaterThan(0);
    for (const quest of ['first_train', 'roof', 'first_sprouts', 'meet_village', 'saturday_order', 'hens', 'planks', 'welcome_supper']) {
      expect(w.quests.find((q) => q.id === quest)?.status, quest).toBe('done');
    }
    expect(w.letters.map((l) => l.id)).toEqual(expect.arrayContaining(['coop_welcome', 'basile_workbench', 'coop_catalogue_reminder', 'coop_recap', 'coop_vergers']));
    // L'état se transmet en un message de 64 Kio au plus (ADR 0007).
    expect(JSON.stringify(w).length).toBeLessThan(64 * 1024);
  });

  it("ne bloque jamais la fin sans l'énigme d'Émile: la scène finale a lieu, la remise reste fermée (D-08)", () => {
    const sim = newSim(99);
    const robot = createRobot({ riddle: false });
    play(sim, robot, (s) => s.world.phase === 'ended', MAX_TICKS);
    expect(sim.world.phase).toBe('ended');
    expect(sim.world.ending?.keyFound).toBe(false);
    expect(sim.world.worldStates.handcar_shed).toBe('closed');
    expect(sim.world.dialoguesDone).toEqual(expect.arrayContaining(['firmin_end_vergers']));
    expect(sim.world.dialoguesDone).not.toContain('firmin_end_key');
  });

  it('est déterministe: même graine, même monde (empreinte)', () => {
    const run = (): string => {
      const sim = newSim(42);
      const robot = createRobot();
      for (let i = 0; i < SIM_HZ * 120; i++) step(sim, robot.decide(sim));
      return hash(sim.world);
    };
    expect(run()).toBe(run());
  });
});
