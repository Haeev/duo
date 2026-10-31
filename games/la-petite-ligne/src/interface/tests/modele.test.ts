import { describe, expect, it } from 'vitest';
import { NBSP } from '../typographie';
import {
  clockModel,
  dayLabel,
  formModel,
  letterModels,
  nextObjective,
  orderFullAmount,
  orderLines,
  partnerModel,
  purseModel,
  questModels,
  screenOf,
  splitAmount,
  staminaModel,
  toolbarModel,
} from '../modele';
import { apply, character, newSim, playUntil, started, uiContext } from './aides';

const FLAGS = { titleDone: true, sessionFinished: false, creationHold: false };
const plain = (s: string): string => s.replace(/[\u00a0\u202f]/g, ' ');

describe('écran courant', () => {
  it("commence par l'écran titre, puis la création, puis le jeu", () => {
    const sim = newSim();
    expect(screenOf(sim.world, 'p1', { ...FLAGS, titleDone: false }, false)).toBe('title');
    expect(screenOf(sim.world, 'p1', FLAGS, false)).toBe('creation');
    apply(sim, 'p1', { type: 'create_character', name: 'Camille', hair: 0, outfit: 0 });
    expect(screenOf(sim.world, 'p1', FLAGS, false)).toBe('creation');
    apply(sim, 'p2', { type: 'create_character', name: 'Sacha', hair: 1, outfit: 2 });
    expect(sim.world.phase).toBe('day');
    expect(screenOf(sim.world, 'p1', FLAGS, false)).toBeNull();
    expect(screenOf(sim.world, 'p1', { ...FLAGS, creationHold: true }, false)).toBe('creation');
  });

  it('montre la nuit, le petit-déjeuner de chacun et la fin', () => {
    const sim = started();
    playUntil(sim, (s) => s.world.phase === 'night');
    expect(screenOf(sim.world, 'p1', FLAGS, false)).toBe('night');
    apply(sim, 'p1', { type: 'night_choice', choice: 'continue' });
    apply(sim, 'p2', { type: 'night_choice', choice: 'continue' });
    expect(screenOf(sim.world, 'p1', FLAGS, false)).toBe('breakfast');
    apply(sim, 'p1', { type: 'start_day' });
    expect(screenOf(sim.world, 'p1', FLAGS, false)).toBeNull();
    expect(screenOf(sim.world, 'p2', FLAGS, false)).toBe('breakfast');
    expect(screenOf(sim.world, 'p1', { ...FLAGS, sessionFinished: true }, false)).toBe('session_end');
  });
});

describe('HUD', () => {
  it("donne le jour, la météo et l'heure, au pas de 10 minutes", () => {
    const sim = started();
    const ctx = uiContext();
    sim.world.clock.day = 5;
    sim.world.clock.minutes = 9 * 60 + 27;
    const clock = clockModel(sim.world, ctx);
    expect(clock.day).toBe('Mercredi, jour 5 · Soleil');
    expect(plain(clock.time)).toBe('9 h 20');
    expect(clock.weatherIcon).toBe('weather-sun');
    expect(dayLabel(ctx, 4)).toBe('Mardi, jour 4');
  });

  it("dit pourquoi l'horloge est arrêtée", () => {
    const sim = started();
    const ctx = uiContext();
    sim.world.clock.stoppedBy = 'scene';
    expect(clockModel(sim.world, ctx)).toMatchObject({ state: 'stopped' });
    expect(plain(clockModel(sim.world, ctx).status ?? '')).toBe("Scène à deux · l’horloge est arrêtée");
    sim.world.clock.stoppedBy = 'veillee';
    expect(clockModel(sim.world, ctx).state).toBe('evening');
    sim.world.clock.stoppedBy = 'both_busy';
    expect(clockModel(sim.world, ctx).state).toBe('stopped');
    sim.world.clock.stoppedBy = null;
    expect(clockModel(sim.world, ctx).status).toBeNull();
  });

  it("annonce le départ du train le dernier jour", () => {
    const sim = started();
    const ctx = uiContext();
    sim.world.clock.day = 8;
    sim.world.clock.minutes = 15 * 60;
    sim.world.train.phase = 'stopped';
    expect(plain(clockModel(sim.world, ctx).train ?? '')).toBe('Départ du train à 16 h');
    sim.world.clock.minutes = 11 * 60;
    expect(clockModel(sim.world, ctx).train).toBeNull();
  });

  it('montre la bourse avec la somme réservée par une proposition', () => {
    const sim = started();
    sim.world.purse = 94;
    sim.world.proposals.push({ id: 'o1', by: 'p2', purchase: { source: 'grocery', item: 'mattress', count: 1 }, price: 120 });
    expect(purseModel(sim.world)).toEqual({ amount: 214, reserved: 120 });
    expect(splitAmount('{amount} sous')).toEqual({ before: '', after: ' sous' });
  });

  it("montre l'endurance discrète, plus visible quand elle baisse", () => {
    const sim = started();
    const ctx = uiContext();
    const me = character(sim, 'p1');
    me.enduranceMax = 100;
    me.endurance = 72;
    expect(staminaModel(ctx, me)).toEqual({ ratio: 0.72, level: '', label: '' });
    me.endurance = 18;
    expect(staminaModel(ctx, me)).toMatchObject({ level: 'low', label: 'Fatigue' });
    me.endurance = 0;
    expect(staminaModel(ctx, me)).toMatchObject({ level: 'empty', label: "Plus d'énergie" });
  });

  it('donne le nom de la forme et l’expression du portrait', () => {
    const sim = started();
    const me = character(sim, 'p1');
    me.form = 'great';
    expect(formModel(uiContext(), me)).toMatchObject({ name: 'Pleine forme', expression: 'great' });
    me.form = 'okay';
    expect(formModel(uiContext(), me).expression).toBe('ok');
  });

  it("montre 10 cases de barre d'outils, l'outil en main et l'eau de l'arrosoir", () => {
    const sim = started();
    const me = character(sim, 'p1');
    const can = me.bag.findIndex((s) => s?.item === 'watering_can');
    me.selected = can;
    me.water = 7;
    const bar = toolbarModel(uiContext(), me);
    expect(bar.slots).toHaveLength(10);
    expect(bar.held).toBe('Arrosoir');
    expect(plain(bar.detail)).toBe('7 arrosages sur 10');
    expect(bar.slots[can]?.gauge).toBeCloseTo(0.7);
    me.water = 0;
    expect(toolbarModel(uiContext(), me).slots[can]?.unusable).toBe(true);
    me.selected = 9;
    expect(toolbarModel(uiContext(), me).held).toBe('Main libre');
  });

  it("dit ce que fait l'autre joueur, en mots", () => {
    const sim = started();
    const ctx = uiContext();
    const other = character(sim, 'p2');
    other.status = 'menu';
    other.menu = 'catalogue';
    expect(partnerModel(sim.world, ctx, null)?.activity).toBe('Regarde le catalogue');
    other.status = 'active';
    other.menu = null;
    other.action = { kind: 'chop', since: sim.world.tick, duration: 30, target: null };
    expect(partnerModel(sim.world, ctx, null)?.activity).toBe('Coupe du bois à la lisière');
    other.action = { kind: 'idle', since: 0, duration: 0, target: null };
    other.inHouse = true;
    expect(partnerModel(sim.world, ctx, null)?.activity).toBe('Dans la maisonnette');
    expect(plain(partnerModel(sim.world, ctx, 3)?.activity ?? '')).toBe('Fait une pause depuis 3 min');
    expect(partnerModel(sim.world, ctx, 3)?.state).toBe('away');
    other.status = 'sleeping';
    expect(partnerModel(sim.world, ctx, null)?.state).toBe('asleep');
  });
});

describe('commande et quêtes', () => {
  it('compte les lignes de la commande dans la caisse et dans le sac', () => {
    const sim = started();
    const ctx = uiContext();
    sim.world.crate.push({ item: 'radish', quality: 'ordinary', count: 12 }, { item: 'egg', quality: 'fine', count: 3 });
    character(sim, 'p1').bag[5] = { item: 'egg', quality: 'ordinary', count: 2 };
    const lines = orderLines(sim.world, ctx);
    expect(lines.map((l) => [l.item, l.inCrate, l.need, l.done])).toEqual([
      ['radish', 12, 12, true],
      ['lettuce', 0, 3, false],
      ['egg', 3, 6, false],
      ['plank', 0, 10, false],
    ]);
    expect(lines[2]?.inBag).toBe(2);
    expect(orderFullAmount(ctx)).toBe(540);
  });

  it('propose comme prochain objectif la trame, puis la commande à l’approche du train', () => {
    const sim = started();
    const ctx = uiContext();
    expect(nextObjective(sim.world, ctx)?.title).toBe('Le premier train');
    playUntil(sim, (s) => s.world.quests.some((q) => q.id === 'saturday_order'));
    sim.world.clock.day = 7;
    const goal = nextObjective(sim.world, ctx);
    expect(goal?.title).toBe('La commande du samedi');
    expect(goal?.lines.map((l) => plain(l.text))).toEqual(['Radis 0 sur 12', 'Laitues 0 sur 3', 'Œufs 0 sur 6', 'Planches 0 sur 10']);
    expect(plain(questModels(sim.world, ctx).find((q) => q.id === 'saturday_order')?.progress ?? '')).toBe('0 ligne sur 4');
  });

  it('remplace {order} dans les objectifs et donne la liste à cocher', () => {
    const sim = started();
    const ctx = uiContext();
    playUntil(sim, (s) => s.world.quests.some((q) => q.id === 'meet_village'));
    const quests = questModels(sim.world, ctx);
    const order = quests.find((q) => q.id === 'saturday_order');
    expect(plain(order?.text ?? '')).toContain('12 radis, 3 laitues, 6 œufs, 10 planches');
    const village = quests.find((q) => q.id === 'meet_village');
    expect(village?.lines.map((l) => l.text)).toEqual(['Firmin', 'Odette', 'Basile', 'Jeanne']);
  });

  it('range le courrier du plus récent au plus ancien, avec le non-lu', () => {
    const sim = started();
    const ctx = uiContext();
    sim.world.letters.push(
      { id: 'a', day: 1, title: 'Bienvenue', from: 'La coopérative de la ligne', text: 'Bonjour', read: ['p1'] },
      { id: 'b', day: 3, title: 'Un mot de Basile', from: 'Basile', text: "L'établi", read: [] },
    );
    const letters = letterModels(sim.world, ctx);
    expect(letters.map((l) => [l.id, l.day, l.unread])).toEqual([
      ['b', 'Lundi 3', true],
      ['a', 'Samedi 1', false],
    ]);
    expect(letters[0]?.text).toBe(`L’établi`);
  });
});

describe('typographie des modèles', () => {
  it('pose les espaces insécables dans les textes affichés', () => {
    const sim = started();
    sim.world.clock.minutes = 16 * 60;
    expect(clockModel(sim.world, uiContext()).time).toBe(`16${NBSP}h${NBSP}00`);
  });
});
