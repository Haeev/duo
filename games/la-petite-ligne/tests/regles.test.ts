// Règles de la démo, une par une, sur la vraie carte et le vrai contenu.
import { describe, expect, it } from 'vitest';
import type { AuthoredIntent } from '../src/etat/actions';
import type { CharacterId } from '../src/etat/types';
import type { Sim } from '../src/simulation/contexte';
import { character } from '../src/simulation/contexte';
import { placeCharacter } from '../src/simulation/deplacement';
import { payOrder } from '../src/simulation/economie';
import { morning } from '../src/simulation/horloge';
import { step } from '../src/simulation/pas';
import { gardenCellAt, harvest, sow, till, water } from '../src/simulation/potager';
import { addStack, addToBag, countInBag } from '../src/simulation/sac';
import { newSim } from './aides';

/** Monde au jour 1, les deux personnages créés, scène d'arrivée passée. */
function started(): Sim {
  const sim = newSim();
  const intents: AuthoredIntent[] = [
    { by: 'p1', intent: { type: 'create_character', name: 'Camille', hair: 0, outfit: 0 } },
    { by: 'p2', intent: { type: 'create_character', name: 'Sacha', hair: 1, outfit: 1 } },
  ];
  step(sim, { controls: {}, intents });
  for (let i = 0; i < 40 && sim.world.scene !== null; i++) {
    const scene = sim.world.scene;
    const next: AuthoredIntent[] = (['p1', 'p2'] as CharacterId[]).map((by) => ({
      by,
      intent: scene.choices.length > 0 ? { type: 'dialogue_choice', choice: scene.choices[0]?.id ?? '' } : { type: 'dialogue_next' },
    }));
    step(sim, { controls: {}, intents: next });
  }
  return sim;
}

function act(sim: Sim, by: CharacterId, intent: AuthoredIntent['intent']): void {
  step(sim, { controls: {}, intents: [{ by, intent }] });
}

describe('règles', () => {
  it("démarre au jour 1 à 10 h, scène d'arrivée jouée, courrier et 200 sous", () => {
    const sim = started();
    expect(sim.world.phase).toBe('day');
    expect(sim.world.clock.day).toBe(1);
    expect(Math.floor(sim.world.clock.minutes)).toBe(600);
    expect(sim.world.purse).toBe(200);
    expect(sim.world.quests.find((q) => q.id === 'first_train')?.status).toBe('done');
    expect(sim.world.letters[0]?.text).toContain('12 radis, 3 laitues, 6 œufs, 10 planches');
  });

  it('potager: une culture arrosée pousse au matin et donne « belle »; sans eau, elle attend', () => {
    const sim = started();
    const c = character(sim, 'p1');
    addToBag(sim, c, 'radish_seed', 'ordinary', 2);
    const [a, b] = sim.world.garden;
    if (a === undefined || b === undefined) throw new Error('potager vide');
    for (const g of [a, b]) {
      till(sim, c, g);
      sow(sim, c, g, 'radish_seed');
    }
    water(sim, c, a);
    morning(sim);
    expect(a.crop?.days).toBe(1);
    expect(b.crop?.days).toBe(0);
    expect(b.crop?.wateredEveryDay).toBe(false);
    water(sim, c, a);
    morning(sim);
    expect(a.crop?.ripe).toBe(true);
    harvest(sim, c, a);
    expect(countInBag(c, 'radish', 'fine')).toBe(3);
    expect(gardenCellAt(sim, a.cell)?.soil).toBe('tilled');
  });

  it("gros achat: à partir de 100 sous, la somme est réservée et attend l'accord de l'autre (EC-04)", () => {
    const sim = started();
    const counter = sim.map.points.grocery_counter;
    if (counter === undefined) throw new Error('comptoir absent');
    sim.world.clock.minutes = 9 * 60;
    for (let i = 0; i < 20; i++) step(sim, { controls: {}, intents: [] });
    placeCharacter(sim, character(sim, 'p1'), counter);
    act(sim, 'p1', { type: 'buy', item: 'mattress', count: 1 });
    expect(sim.world.proposals).toHaveLength(1);
    expect(sim.world.purse).toBe(80);
    const proposal = sim.world.proposals[0];
    act(sim, 'p2', { type: 'proposal_answer', proposal: proposal?.id ?? '', accept: false });
    expect(sim.world.purse).toBe(200);
    expect(countInBag(character(sim, 'p1'), 'mattress')).toBe(0);
    act(sim, 'p1', { type: 'buy', item: 'mattress', count: 1 });
    act(sim, 'p2', { type: 'proposal_answer', proposal: sim.world.proposals[0]?.id ?? '', accept: true });
    expect(countInBag(character(sim, 'p1'), 'mattress')).toBe(1);
    expect(sim.world.purse).toBe(80);
    // La bourse n'est jamais négative (EC-01).
    sim.world.purse = 3;
    act(sim, 'p1', { type: 'buy', item: 'nail', count: 2 });
    expect(sim.world.purse).toBe(3);
    expect(character(sim, 'p1').notifications.at(-1)?.text).toBe('Il manque 1 sous.');
  });

  it('commande complète: 540 sous au départ du train (EC-08)', () => {
    const sim = started();
    for (const line of sim.content.settings.order.lines) addStack(sim.world.crate, line.item, 'ordinary', line.count);
    addStack(sim.world.crate, 'carrot', 'ordinary', 2);
    payOrder(sim);
    expect(sim.world.orderResult).toEqual({ linesDone: 4, linesTotal: 4, complete: true, amount: 540 + 2 * 16 });
  });

  it("veillée: dès 19 h, les deux dans la maison arrêtent l'horloge; minuit ramène à la maison", () => {
    const sim = started();
    sim.world.clock.minutes = 19 * 60 + 1;
    const inside = sim.map.house.spawn;
    placeCharacter(sim, character(sim, 'p1'), inside);
    placeCharacter(sim, character(sim, 'p2'), inside);
    step(sim, { controls: {}, intents: [] });
    expect(sim.world.clock.veillee).toBe(true);
    expect(sim.world.clock.stoppedBy).toBe('veillee');
    const before = sim.world.clock.minutes;
    for (let i = 0; i < 30; i++) step(sim, { controls: {}, intents: [] });
    expect(sim.world.clock.minutes).toBe(before);
    // L'un ressort: l'horloge repart, jusqu'à minuit.
    const out = sim.map.points.house_door;
    if (out === undefined) throw new Error('porte absente');
    placeCharacter(sim, character(sim, 'p2'), { x: out.x, y: out.y + 1 });
    sim.world.clock.minutes = 24 * 60 - 0.01;
    step(sim, { controls: {}, intents: [] });
    step(sim, { controls: {}, intents: [] });
    expect(character(sim, 'p2').inHouse).toBe(true);
    expect(character(sim, 'p2').midnightReturn).toBe(true);
  });

  it('construction: à deux, un élément se bâtit deux fois plus vite (MA-03)', () => {
    const solo = started();
    const duo = started();
    const door = solo.map.points.house_door;
    if (door === undefined) throw new Error('porte absente');
    for (const s of [solo, duo]) {
      for (const k of s.world.constructions) if (k.id === 'house_door') k.status = 'ghost';
      s.world.constructions = s.world.constructions.filter((k) => k.id !== 'house_roof');
      placeCharacter(s, character(s, 'p1'), door);
      placeCharacter(s, character(s, 'p2'), door);
    }
    const held = { seq: 1, moveX: 0, moveY: 0, actHeld: true };
    const idle = { seq: 1, moveX: 0, moveY: 0, actHeld: false };
    let soloTicks = 0;
    while (solo.world.constructions.find((k) => k.id === 'house_door')?.status !== 'done' && soloTicks < 2000) {
      step(solo, { controls: { p1: held, p2: idle }, intents: [] });
      soloTicks++;
    }
    let duoTicks = 0;
    while (duo.world.constructions.find((k) => k.id === 'house_door')?.status !== 'done' && duoTicks < 2000) {
      step(duo, { controls: { p1: held, p2: held }, intents: [] });
      duoTicks++;
    }
    expect(duoTicks).toBeLessThan(soloTicks * 0.6);
    expect(duoTicks).toBeGreaterThan(soloTicks * 0.4);
  });

  it("absence: sans entrée pendant 3 minutes, l'horloge attend le joueur; sa moindre entrée la relance (PA-04)", () => {
    const sim = started();
    const limit = sim.content.settings.absence.minutes * 60 * 30;
    const moving = { seq: 1, moveX: 0, moveY: 0, actHeld: false };
    // p1 bouge sans cesse, p2 ne touche à rien.
    for (let i = 0; i < limit + 5; i++) step(sim, { controls: { p1: { ...moving, moveX: i % 60 < 30 ? 1 : -1 } }, intents: [] });
    expect(character(sim, 'p2').absent).toBe(true);
    expect(character(sim, 'p1').absent).toBe(false);
    expect(sim.world.clock.stoppedBy).toBe('absence');
    expect(character(sim, 'p1').notifications.at(-1)?.key).toBe('clock_waits');
    const frozen = sim.world.clock.minutes;
    step(sim, { controls: {}, intents: [] });
    expect(sim.world.clock.minutes).toBe(frozen);
    act(sim, 'p2', { type: 'cycle_slot', delta: 1 });
    step(sim, { controls: {}, intents: [] });
    expect(character(sim, 'p2').absent).toBe(false);
    expect(sim.world.clock.minutes).toBeGreaterThan(frozen);
  });

  it('repère: une épingle par joueur, visible 15 s chez les deux (GE-07)', () => {
    const sim = started();
    act(sim, 'p1', { type: 'pin', x: 20.5, y: 20.5 });
    expect(character(sim, 'p1').pin?.pos).toEqual({ x: 20.5, y: 20.5 });
    act(sim, 'p1', { type: 'pin', x: 22, y: 21 });
    expect(character(sim, 'p1').pin?.pos).toEqual({ x: 22, y: 21 });
    for (let i = 0; i < sim.content.settings.feel.pinSeconds * 30 + 2; i++) step(sim, { controls: {}, intents: [] });
    expect(character(sim, 'p1').pin).toBeNull();
  });

  it('pêche: lancer sur l’eau, ferrer pendant la touche, le poisson va au sac (CN-05)', () => {
    const sim = started();
    const c = character(sim, 'p1');
    const ford = sim.map.points.river_ford;
    if (ford === undefined) throw new Error('gué absent');
    // Une case d'eau à portée de lancer depuis un point libre près du gué.
    let water: { x: number; y: number } | null = null;
    for (let cy = 0; cy < sim.map.height && water === null; cy++) {
      for (let cx = 0; cx < sim.map.width && water === null; cx++) {
        const d = Math.hypot(cx + 0.5 - ford.x, cy + 0.5 - ford.y);
        if (sim.map.ground[cy * sim.map.width + cx] === 'water' && d < 4) water = { x: cx + 0.5, y: cy + 0.5 };
      }
    }
    if (water === null) throw new Error('pas d’eau près du gué');
    placeCharacter(sim, c, ford);
    c.facing = Math.atan2(water.y - ford.y, water.x - ford.x);
    const rodSlot = c.bag.findIndex((s) => s?.item === 'fishing_rod');
    expect(rodSlot).toBeGreaterThanOrEqual(0);
    act(sim, 'p1', { type: 'select_slot', slot: rodSlot });
    act(sim, 'p1', { type: 'act' });
    expect(c.fishing?.phase).toBe('waiting');
    for (let i = 0; i < 30 * 16 && c.fishing?.phase !== 'bite'; i++) step(sim, { controls: {}, intents: [] });
    expect(c.fishing?.phase).toBe('bite');
    act(sim, 'p1', { type: 'act' });
    expect(c.fishing).toBeNull();
    expect(['gudgeon', 'chub', 'trout'].reduce((n, fish) => n + countInBag(c, fish), 0)).toBe(1);
    // Trop tard: le poisson s'échappe, et on le dit.
    act(sim, 'p1', { type: 'act' });
    for (let i = 0; i < 30 * 20 && c.fishing !== null; i++) step(sim, { controls: {}, intents: [] });
    expect(c.fishing).toBeNull();
    const last = c.notifications.at(-1);
    expect(last?.key).toBe('fish_escaped');
    expect(last?.text).toBe("Il s'est échappé.");
  });

  it('aménagement: le fantôme du meuble dit pourquoi il ne tient pas (texte de textes.json)', () => {
    const sim = started();
    const c = character(sim, 'p1');
    addToBag(sim, c, 'table', 'ordinary', 1);
    const room = sim.map.house.room;
    // Contre le mur ouest, face au mur: la table sortirait de la pièce.
    placeCharacter(sim, c, { x: room.x + 0.5, y: room.y + 1.5 });
    c.facing = Math.PI;
    act(sim, 'p1', { type: 'hold_furniture', item: 'table' });
    expect(c.placement?.valid).toBe(false);
    expect(c.placement?.blocked).toBe(sim.content.texts.messages.placement_outside);
  });
});
