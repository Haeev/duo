// Le robot joue à deux avec les mêmes intentions que des joueurs: il prouve que la démo se finit.
import { describe, expect, it } from 'vitest';
import { hash } from '../src/simulation/empreinte';
import { step } from '../src/simulation/pas';
import { SIM_HZ } from '../src/simulation/constantes';
import { contentAndMap, createRobot, fullOrderAmount, newSim, play } from './aides';

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
    expect(w.quests.find((q) => q.id === 'emile_riddle')?.status).toBe('active');
    expect(w.letters.some((l) => l.id === 'coop_welcome')).toBe(true);
  });

  it('finit la semaine 1 comme avant au départ du jour 8, puis la partie continue', () => {
    const sim = newSim();
    const robot = createRobot();
    play(sim, robot, (s) => s.world.clock.day === 9 && s.world.phase === 'day', MAX_TICKS);
    const w = sim.world;
    expect(w.phase).toBe('day');
    expect(w.ending).toBeNull();
    expect(w.orderHistory).toEqual([{ linesDone: 4, linesTotal: 4, complete: true, amount: 540 }]);
    // Au matin du jour 9, la caisse est rouverte pour la commande du train suivant.
    expect(w.orderIndex).toBe(1);
    expect(w.orderResult).toBeNull();
    expect(w.crate).toEqual([]);
    expect(w.quests.find((q) => q.id === 'saturday_order')?.status).toBe('done');
    expect(w.quests.find((q) => q.id === 'second_order')?.status).toBe('active');
    expect(w.letters.map((l) => l.id)).toEqual(expect.arrayContaining(['coop_recap', 'coop_order_2']));
  });

  it("joue toute la démo jusqu'au train du jour 15, les deux commandes complètes, sans blocage (D-01)", () => {
    const sim = newSim();
    const robot = createRobot();
    const ticks = play(sim, robot, (s) => s.world.phase === 'ended', MAX_TICKS);
    const w = sim.world;
    const { content } = contentAndMap();
    expect(w.phase).toBe('ended');
    expect(ticks).toBeLessThan(MAX_TICKS);
    expect(w.clock.day).toBe(15);
    expect(w.orderHistory.map((o) => o.complete)).toEqual([true, true]);
    expect(w.orderHistory[0]?.amount).toBe(540);
    expect(w.orderResult?.amount).toBeGreaterThanOrEqual(fullOrderAmount(content, 1));
    expect(w.ending?.days).toBe(15);
    // Gestes à deux de la semaine 2: la draisine poussée, le colis lourd du catalogue porté à la maison.
    expect(w.flags).toContain('handcar_pushed');
    const heavy = Object.values(content.items).filter((d) => d.carriedByTwo && d.shop === 'catalogue').map((d) => d.id);
    expect(heavy.length).toBeGreaterThan(0);
    expect(w.heavyDeliveries).toEqual([]);
    const delivered = heavy.some((id) => w.cellar.some((st) => st.item === id) || w.furniture.some((f) => f.item === id) || w.characters.some((c) => c.bag.some((b) => b?.item === id)));
    expect(delivered, 'un colis lourd porté à deux').toBe(true);
    expect(w.ending?.orders).toEqual(content.settings.order.trains.map((o) => ({ linesDone: o.lines.length, linesTotal: o.lines.length })));
    expect(w.ending?.linesDone).toBe(content.settings.order.trains.reduce((n, o) => n + o.lines.length, 0));
    expect(w.ending?.furniturePlaced).toBeGreaterThan(0);
    expect(w.ending?.keyFound).toBe(true);
    expect(w.worldStates.handcar_shed).toBe('open');
    const weekTwo = ['second_order', 'handcar', 'emile_riddle_2', 'odette_fry', 'basile_omelette', 'lucie_note', 'firmin_flowers', 'odette_parcels', 'firmin_chub', 'jeanne_notebook'];
    for (const quest of ['first_train', 'roof', 'first_sprouts', 'meet_village', 'saturday_order', 'hens', 'planks', 'welcome_supper', ...weekTwo]) {
      expect(w.quests.find((q) => q.id === quest)?.status, quest).toBe('done');
    }
    expect(w.letters.map((l) => l.id)).toEqual(expect.arrayContaining(['coop_welcome', 'basile_workbench', 'coop_catalogue_reminder', 'coop_recap', 'coop_vergers']));
    // L'état se transmet en un message de 64 Kio au plus (ADR 0007).
    expect(JSON.stringify(w).length).toBeLessThan(64 * 1024);
  });

  it("ne bloque jamais la fin sans l'énigme d'Émile: la scène finale a lieu, sans la clé (D-08)", () => {
    const sim = newSim(99);
    const robot = createRobot({ riddle: false });
    play(sim, robot, (s) => s.world.phase === 'ended', MAX_TICKS);
    expect(sim.world.phase).toBe('ended');
    expect(sim.world.ending?.keyFound).toBe(false);
    // La remise s'ouvre quand même au jour 12 (rattrapage de la semaine 2), mais sans la scène de la clé.
    expect(sim.world.worldStates.handcar_shed).toBe('open');
    expect(sim.world.quests.find((q) => q.id === 'handcar')?.status).toBe('done');
    expect(sim.world.dialoguesDone).toEqual(expect.arrayContaining(['basile_force_lock', 'basile_handcar_scene']));
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
