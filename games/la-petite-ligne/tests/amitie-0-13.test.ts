// 0.13, lot H2 (`docs/jeux/jeu-1/v0-13-habitants.md`, sections 6 et 9.1): liens d'amitié, gains
// et paliers, cadeaux selon les goûts (HB-12, HB-13), anniversaires, ce que lira le carnet (lot H3),
// le lien qui ne baisse jamais (HB-11, sur une démo de robots), les habitants écrits sans leurs
// valeurs par défaut, la reprise des sauvegardes et le même état chez l'hôte et chez l'invité.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { startLocalDuo } from '@duo/sdk-dev';
import { describe, expect, it } from 'vitest';
import manifest from '../duo-game.json';
import { loadContent } from '../src/donnees/contenu';
import { CONTENT_FILES } from '../src/donnees/fichiers';
import type { Content, QuestDef } from '../src/donnees/types';
import type { ControlFrame } from '../src/etat/actions';
import { bondLevel, tasteOf } from '../src/etat/amitie';
import { fillVillagerDefaults, readVillager, writeVillager, writtenWorld } from '../src/etat/habitants-ecrits';
import { isBirthday } from '../src/etat/planning';
import type { Character, VillagerState, WorldState } from '../src/etat/types';
import { birthdayView, bondView, tastesView } from '../src/etat/voisins';
import { decodeSave, restoreWorld, snapshotOf } from '../src/sauvegarde/sauvegarde';
import { createSession, type GameAction } from '../src/session';
import { addBond, BIRTHDAY_CHOICE, questBond } from '../src/simulation/amitie';
import { evaluateAll, NO_CONTEXT } from '../src/simulation/conditions';
import { DATA_SCHEMA, SIM_DT, SIM_HZ } from '../src/simulation/constantes';
import { type Sim, character } from '../src/simulation/contexte';
import { dialogueChoice, dialogueNext, talkTo } from '../src/simulation/dialogues';
import { runEffects } from '../src/simulation/effets';
import { placeVillagers, updateVillagers } from '../src/simulation/habitants';
import { morning } from '../src/simulation/horloge';
import { applyIntent } from '../src/simulation/intentions';
import { step } from '../src/simulation/pas';
import { addToBag, countInBag } from '../src/simulation/sac';
import { revealHabit } from '../src/simulation/voisins';
import { contentAndMap, createRobot, newSim, SEED } from './aides';

const A = { id: 'membre-a', name: 'Camille', color: '#e07a5f' };
const B = { id: 'membre-b', name: 'Sacha', color: '#3d85c6' };

const { content } = contentAndMap();
const bonds = content.settings.bonds;

/** Le jour de la partie de l'anniversaire de cet habitant (première année). */
function birthdayDay(c: Content, villager: string): number {
  for (let d = 1; d <= 84; d++) if (isBirthday(c, villager, d)) return d;
  throw new Error(`pas d'anniversaire pour ${villager}`);
}

/** Un jour en cours (beau temps), les deux joueurs dehors, les habitants à leur poste. */
function daySim(day = 2, minutes = 10 * 60, c: Content = content): Sim {
  const sim = newSim(SEED, c);
  const w = sim.world;
  w.phase = 'day';
  w.clock.day = day;
  w.clock.minutes = minutes;
  w.clock.running = false;
  w.weather = 'sunny';
  w.scene = null;
  for (const ch of w.characters) {
    ch.created = true;
    ch.status = 'active';
    ch.inside = null;
    ch.pos = { x: 5, y: 60 };
  }
  placeVillagers(sim);
  return sim;
}

function villager(sim: Sim, id: string): VillagerState {
  const v = sim.world.villagers.find((x) => x.id === id);
  if (v === undefined) throw new Error(`${id} absent`);
  return v;
}

/** Fait tourner les habitants (plannings, observation, anniversaires) pendant `seconds` secondes. */
function run(sim: Sim, seconds: number): void {
  for (let i = 0; i < Math.round(seconds * SIM_HZ); i++) {
    sim.world.tick += 1;
    updateVillagers(sim, SIM_DT);
  }
}

/** Un objet dans le sac de ce joueur, et lui à côté de l'habitant (visible), pour l'intention `gift`. */
function nextTo(sim: Sim, c: Character, id: string): void {
  const v = villager(sim, id);
  v.visible = true;
  c.pos = { x: v.pos.x + 1, y: v.pos.y };
}

function gift(sim: Sim, who: 'p1' | 'p2', id: string, item: string): void {
  applyIntent(sim, who, { type: 'gift', villager: id, item });
}

/** Les choix proposés dans la conversation en cours de ce joueur. */
function choicesOf(c: Character): string[] {
  return c.dialogue?.choices.map((x) => x.id) ?? [];
}

/** Écoute la conversation en cours jusqu'au bout. */
function finish(sim: Sim, c: Character): void {
  for (let i = 0; i < 50 && c.dialogue !== null; i++) dialogueNext(sim, c);
}

/** Qui parle, réplique par réplique, dans la conversation en cours de ce joueur. */
function linesOf(c: Character): string[] {
  return c.dialogue?.lines.map((l) => l.speaker) ?? [];
}

/** Les quêtes et rencontres de cet habitant déjà dites: il ne reste que son quotidien. */
function onlyDaily(sim: Sim, id: string): void {
  for (const d of Object.values(sim.content.dialogues)) {
    if (d.villager !== id || d.kind === 'daily') continue;
    sim.world.dialoguesDone.push(`${d.id}@p1`, `${d.id}@p2`);
  }
}

describe('goûts des données (lot H2)', () => {
  it('lit les goûts de habitants-0-13.json: adore, aime, déteste avec sa réplique; le reste lui est égal', () => {
    const leon = content.villagers.find((v) => v.id === 'leon');
    expect(leon?.tastes.loves).toEqual(['brioche', 'hot_chocolate']);
    expect(leon?.tastes.dislikes.find((d) => d.item === 'lettuce')?.reply).toBe('Les lapins, c\'est chez nous.');
    expect(tasteOf(content, 'leon', 'brioche')).toBe('loves');
    expect(tasteOf(content, 'leon', 'chub')).toBe('likes');
    expect(tasteOf(content, 'leon', 'lettuce')).toBe('dislikes');
    expect(tasteOf(content, 'leon', 'radish')).toBe('neutral');
    // Les six de la démo n'ont pas encore de goûts (lot H4): tout leur est égal.
    expect(tasteOf(content, 'firmin', 'brioche')).toBe('neutral');
  });

  it('refuse un goût qui cite un objet inconnu', () => {
    const files = structuredClone(CONTENT_FILES);
    const raw = files.habitants013 as { villagers: { id: string; tastes?: { adore: string[] } }[] } | undefined;
    const leon = raw?.villagers.find((v) => v.id === 'leon');
    if (leon?.tastes === undefined) throw new Error('goûts de Léon absents');
    leon.tastes.adore.push('licorne');
    expect(() => loadContent(files)).toThrow(/leon\.tastes: objet inconnu « licorne »/);
  });
});

describe('niveaux et gains (section 6.1, 6.2)', () => {
  it('six niveaux aux seuils de la conception; un niveau passé se lit chez les deux, une lanterne de plus', () => {
    expect(bonds.levels).toEqual([0, 100, 250, 450, 700, 1000]);
    expect([0, 99, 100, 249, 250, 450, 699, 700, 999, 1000].map((b) => bondLevel(bonds, b))).toEqual([0, 0, 1, 1, 2, 3, 3, 4, 4, 5]);
    const sim = daySim();
    addBond(sim, 'odette', 90, 'p1');
    expect(sim.events.filter((e) => e.type === 'bond_level')).toEqual([]);
    addBond(sim, 'odette', 20, 'p1');
    expect(sim.world.bonds.odette).toBe(110);
    expect(sim.events).toContainEqual({ type: 'bond_level', villager: 'odette', level: 1 });
    for (const c of sim.world.characters) {
      expect(c.notifications.at(-1)?.key).toBe('bond_level_up');
      expect(c.notifications.at(-1)?.text).toBe('Avec Odette: Connaissance. Une lanterne de plus s\'allume.');
    }
    // Plafond et jamais de perte.
    addBond(sim, 'odette', 5000, null);
    expect(sim.world.bonds.odette).toBe(1000);
    expect(character(sim, 'p2').notifications.at(-1)?.key).toBe('bond_level_up_family');
    addBond(sim, 'odette', -300, null);
    expect(sim.world.bonds.odette).toBe(1000);
    // Un identifiant qui n'est pas un habitant n'écrit rien.
    addBond(sim, 'licorne', 50, null);
    expect('licorne' in sim.world.bonds).toBe(false);
  });

  it('parler: +10 à la première conversation du jour de chaque joueur, rien de plus le même jour, de nouveau le lendemain', () => {
    const sim = daySim();
    onlyDaily(sim, 'basile');
    const [p1, p2] = sim.world.characters;
    if (p1 === undefined || p2 === undefined) throw new Error('deux joueurs');
    expect(talkTo(sim, p1, 'basile')).toBe(true);
    expect(sim.world.bonds.basile).toBe(10);
    while (p1.dialogue !== null) dialogueNext(sim, p1);
    talkTo(sim, p1, 'basile');
    expect(sim.world.bonds.basile, 'deuxième conversation du jour').toBe(10);
    talkTo(sim, p2, 'basile');
    expect(sim.world.bonds.basile, 'les deux joueurs: +20').toBe(20);
    sim.world.clock.day += 1;
    sim.world.countersToday = { duo: {}, p1: {}, p2: {} };
    p1.dialogue = null;
    p1.status = 'active';
    talkTo(sim, p1, 'basile');
    expect(sim.world.bonds.basile).toBe(30);
    expect(sim.events.filter((e) => e.type === 'bond_gain').map((e) => e.amount)).toEqual([10, 10, 10]);
  });

  it('quêtes: +60 au donneur d\'une quête finie, +100 pour une étape d\'histoire, rien de plus si la quête donne elle-même le lien', () => {
    const sim = daySim();
    const first = content.quests.find((q) => q.id === 'first_train');
    const weekly = content.quests.find((q) => q.id === 'weekly_order');
    if (first === undefined || weekly === undefined) throw new Error('quêtes de la démo');
    questBond(sim, first, 'p1');
    expect(sim.world.bonds.firmin).toBe(bonds.gains.quest);
    questBond(sim, weekly, 'p1');
    expect(sim.world.bonds.firmin, 'la commande de chaque semaine ne compte pas').toBe(bonds.gains.quest);
    const story: QuestDef = { ...first, id: 'leon_story_1', giver: 'leon', story: { villager: 'leon', step: 1 }, completionEffects: [] };
    questBond(sim, story, 'p2');
    expect(sim.world.bonds.leon).toBe(100);
    expect(sim.world.storyDone.leon).toEqual(['leon_story_1']);
    const explicit: QuestDef = { ...story, id: 'leon_story_2', completionEffects: [{ type: 'add_bond', villager: 'leon', amount: 100 }, { type: 'add_bond', villager: 'firmin', amount: 50 }] };
    runEffects(sim, explicit.completionEffects, 'p1');
    questBond(sim, explicit, 'p1');
    expect(sim.world.bonds.leon).toBe(200);
    expect(sim.world.bonds.firmin, 'croisement: +50 par l\'effet').toBe(bonds.gains.quest + 50);
    expect(sim.world.storyDone.leon).toEqual(['leon_story_1', 'leon_story_2']);
  });

  it('toutes ses habitudes connues: +50, une seule fois', () => {
    const sim = daySim(24);
    const leon = content.villagers.find((v) => v.id === 'leon');
    if (leon === undefined) throw new Error('Léon');
    const before = sim.world.bonds.leon ?? 0;
    const ids = leon.habits.map((h) => h.id);
    sim.world.habits.known.leon = ids.slice(1);
    const counted = ids.filter((h) => h !== ids[0]);
    expect(counted.length).toBeGreaterThan(3);
    const first = ids[0];
    if (first === undefined) throw new Error('habitudes de Léon');
    // Les habitudes d'une quête pas faite ne comptent pas: on les connaît toutes « possibles ».
    expect(revealHabit(sim, { villager: 'leon', habit: first }, 'heard', 'p1', 'jeanne')).toBe(true);
    expect(sim.world.bonds.leon).toBe(before + bonds.gains.allHabits);
    expect(sim.world.flags).toContain('bond_all_habits:leon');
    sim.world.habits.known.leon = ids.slice(1);
    revealHabit(sim, { villager: 'leon', habit: first }, 'heard', 'p1', 'jeanne');
    expect(sim.world.bonds.leon, 'une fois').toBe(before + bonds.gains.allHabits);
  });

  it('bond_at_least: la condition d\'une quête suit le niveau; l\'annonce en marche s\'ouvre à Voisinage par les gains', () => {
    const sim = daySim();
    onlyDaily(sim, 'basile');
    const cond = [{ type: 'bond_at_least' as const, villager: 'basile', level: 2 }];
    expect(evaluateAll(sim, cond, NO_CONTEXT)).toBe(false);
    for (let day = 0; day < 13; day++) {
      sim.world.countersToday = { duo: {}, p1: {}, p2: {} };
      for (const c of sim.world.characters) {
        c.dialogue = null;
        c.status = 'active';
        talkTo(sim, c, 'basile');
      }
    }
    expect(sim.world.bonds.basile).toBe(260);
    expect(evaluateAll(sim, cond, NO_CONTEXT)).toBe(true);
    expect(sim.world.bonds.basile).toBeGreaterThanOrEqual(content.settings.habits.announce.bondAtLeast);
  });
});

describe('cadeaux (section 6.2, HB-12, HB-13)', () => {
  it('adore +60, aime +30, autre +10: un par habitant, par joueur et par jour; le goût s\'écrit au carnet', () => {
    const sim = daySim(10, 15 * 60);
    const [p1, p2] = sim.world.characters;
    if (p1 === undefined || p2 === undefined) throw new Error('deux joueurs');
    for (const c of [p1, p2]) for (const item of ['brioche', 'chub', 'radish']) addToBag(sim, c, item, 'ordinary', 2);
    nextTo(sim, p1, 'leon');
    nextTo(sim, p2, 'leon');
    gift(sim, 'p1', 'leon', 'brioche');
    expect(sim.world.bonds.leon).toBe(60);
    expect(countInBag(p1, 'brioche')).toBe(1);
    expect(tastesView(sim.world, 'leon').loves).toEqual(['brioche']);
    expect(p1.notifications.some((n) => n.key === 'taste_found_loves' && n.text === 'Au carnet: Léon adore qu\'on lui offre une brioche.')).toBe(true);
    expect(p2.notifications.some((n) => n.key === 'taste_found_loves')).toBe(true);
    // Le même jour, le même joueur: refusé gentiment, rien ne quitte le sac.
    gift(sim, 'p1', 'leon', 'chub');
    expect(sim.world.bonds.leon).toBe(60);
    expect(countInBag(p1, 'chub')).toBe(2);
    expect(p1.notifications.at(-1)?.key).toBe('gift_already_today');
    // L'autre joueur peut offrir le sien.
    gift(sim, 'p2', 'leon', 'chub');
    expect(sim.world.bonds.leon).toBe(90);
    // Le lendemain, un objet qui lui est égal: +10, gardé au carnet sans notification.
    sim.world.clock.day += 1;
    sim.world.countersToday = { duo: {}, p1: {}, p2: {} };
    const before = p1.notifications.length;
    gift(sim, 'p1', 'leon', 'radish');
    expect(sim.world.bonds.leon).toBe(100);
    expect(tastesView(sim.world, 'leon')).toEqual({ loves: ['brioche'], likes: ['chub'], dislikes: [], neutral: ['radish'] });
    expect(p1.notifications.slice(before).some((n) => n.key?.startsWith('taste_found') === true)).toBe(false);
    expect(sim.events.filter((e) => e.type === 'gift_offered').map((e) => [e.by, e.item, e.taste, e.gain])).toEqual([
      ['p1', 'brioche', 'loves', 60],
      ['p2', 'chub', 'likes', 30],
      ['p1', 'radish', 'neutral', 10],
    ]);
    expect(sim.world.counters.duo['gift:leon']).toBe(3);
  });

  it('HB-12: un cadeau qu\'il n\'aime pas revient au sac avec sa réplique, « N\'aime pas » au carnet, et le cadeau du jour reste à faire', () => {
    const sim = daySim(10, 15 * 60);
    const p1 = character(sim, 'p1');
    addToBag(sim, p1, 'lettuce', 'ordinary', 1);
    addToBag(sim, p1, 'brioche', 'ordinary', 1);
    nextTo(sim, p1, 'leon');
    gift(sim, 'p1', 'leon', 'lettuce');
    expect(countInBag(p1, 'lettuce'), 'revenu au sac').toBe(1);
    expect(sim.world.bonds.leon ?? 0).toBe(0);
    expect(tastesView(sim.world, 'leon').dislikes).toEqual(['lettuce']);
    expect(p1.notifications.some((n) => n.key === 'villager_says' && n.text.includes('Les lapins, c\'est chez nous.'))).toBe(true);
    expect(character(sim, 'p2').notifications.some((n) => n.key === 'taste_found_dislikes')).toBe(true);
    expect(sim.events).toContainEqual(expect.objectContaining({ type: 'gift_offered', item: 'lettuce', taste: 'dislikes', gain: 0, returned: true }));
    gift(sim, 'p1', 'leon', 'brioche');
    expect(sim.world.bonds.leon).toBe(60);
  });

  it('HB-13: le jour de son anniversaire, un cadeau adoré donne +120 et il dit que c\'est son anniversaire (au carnet)', () => {
    const day = birthdayDay(content, 'leon');
    const sim = daySim(day, 10 * 60);
    const p1 = character(sim, 'p1');
    addToBag(sim, p1, 'hot_chocolate', 'ordinary', 1);
    nextTo(sim, p1, 'leon');
    expect(birthdayView(content, sim.world, 'leon')).toEqual({ kind: 'unknown' });
    gift(sim, 'p1', 'leon', 'hot_chocolate');
    expect(sim.world.bonds.leon).toBe(120);
    expect(sim.events).toContainEqual(expect.objectContaining({ type: 'gift_offered', taste: 'loves', gain: 120, birthday: true }));
    expect(p1.notifications.some((n) => n.key === 'villager_says' && n.text.includes('Et le jour de mon anniversaire, en plus !'))).toBe(true);
    expect(birthdayView(content, sim.world, 'leon')).toEqual({ kind: 'known', season: 'summer', day: 3 });
  });

  it('intention refusée: loin de lui, outil, objet absent du sac, la nuit', () => {
    const sim = daySim(10, 15 * 60);
    const p1 = character(sim, 'p1');
    addToBag(sim, p1, 'brioche', 'ordinary', 1);
    const v = villager(sim, 'leon');
    v.visible = true;
    p1.pos = { x: v.pos.x + content.settings.ranges.talk + 1, y: v.pos.y };
    gift(sim, 'p1', 'leon', 'brioche');
    nextTo(sim, p1, 'leon');
    const tool = Object.values(content.items).find((i) => i.category === 'tool');
    if (tool === undefined) throw new Error('un outil');
    addToBag(sim, p1, tool.id, 'ordinary', 1);
    gift(sim, 'p1', 'leon', tool.id);
    gift(sim, 'p1', 'leon', 'omelette');
    sim.world.phase = 'night';
    gift(sim, 'p1', 'leon', 'brioche');
    expect(sim.world.bonds.leon ?? 0).toBe(0);
    expect(countInBag(p1, 'brioche')).toBe(1);
    expect(sim.events.some((e) => e.type === 'gift_offered')).toBe(false);
  });

  it('une rumeur (effet reveal_taste) écrit le goût au carnet sans cadeau', () => {
    const sim = daySim();
    runEffects(sim, [{ type: 'reveal_taste', villager: 'nour', item: 'warm_bread' }], 'p2');
    expect(tastesView(sim.world, 'nour').loves).toEqual(['warm_bread']);
    expect(sim.world.bonds.nour ?? 0).toBe(0);
  });
});

describe('anniversaires (section 6.2)', () => {
  it('« Bon anniversaire ! »: le choix paraît ce jour-là si on le sait, +20 une fois par joueur', () => {
    const day = birthdayDay(content, 'leon');
    const sim = daySim(day, 10 * 60);
    onlyDaily(sim, 'leon');
    const [p1, p2] = sim.world.characters;
    if (p1 === undefined || p2 === undefined) throw new Error('deux joueurs');
    talkTo(sim, p1, 'leon');
    expect(choicesOf(p1), 'pas su: pas de choix').not.toContain(BIRTHDAY_CHOICE);
    p1.dialogue = null;
    p1.status = 'active';
    sim.world.habits.known.leon = ['birthday'];
    talkTo(sim, p1, 'leon');
    expect(choicesOf(p1)).toContain(BIRTHDAY_CHOICE);
    expect(content.texts.messages.birthday_wish).toBe('Bon anniversaire !');
    const talked = sim.world.bonds.leon ?? 0;
    dialogueChoice(sim, p1, BIRTHDAY_CHOICE);
    expect(sim.world.bonds.leon).toBe(talked + bonds.gains.birthdayWish);
    expect(linesOf(p1).slice(-2)).toEqual(['p1', 'leon']);
    finish(sim, p1);
    talkTo(sim, p1, 'leon');
    expect(choicesOf(p1), 'une fois par joueur').not.toContain(BIRTHDAY_CHOICE);
    talkTo(sim, p2, 'leon');
    expect(choicesOf(p2)).toContain(BIRTHDAY_CHOICE);
    // Le lendemain, plus de choix.
    const next = daySim(day + 1, 10 * 60);
    next.world.habits.known.leon = ['birthday'];
    onlyDaily(next, 'leon');
    const q = character(next, 'p1');
    talkTo(next, q, 'leon');
    expect(choicesOf(q)).not.toContain(BIRTHDAY_CHOICE);
  });

  it('être là à son habitude d\'anniversaire, à moins de 10 m pendant 30 s: +20, une fois ce jour-là', () => {
    const day = birthdayDay(content, 'leon');
    const sim = daySim(day, 14 * 60 + 10);
    run(sim, 1);
    const v = villager(sim, 'leon');
    // Il rejoint le banc du quai; on attend qu'il y soit.
    for (let i = 0; i < 120 && (sim.runtime.villagerPaths.leon?.path.length ?? 0) > 0; i++) run(sim, 1);
    expect(v.visible).toBe(true);
    const p1 = character(sim, 'p1');
    p1.pos = { x: v.pos.x + 6, y: v.pos.y };
    const before = sim.world.bonds.leon ?? 0;
    run(sim, 20);
    expect(sim.world.bonds.leon ?? 0, 'pas encore 30 s').toBe(before);
    run(sim, 11);
    expect(sim.world.bonds.leon).toBe(before + bonds.gains.birthdayPresence);
    expect(p1.notifications.at(-1)?.key).toBe('birthday_attended');
    expect(character(sim, 'p2').notifications.some((n) => n.key === 'birthday_attended'), 'seulement qui était là').toBe(false);
    run(sim, 40);
    expect(sim.world.bonds.leon).toBe(before + bonds.gains.birthdayPresence);
  });
});

describe('ce que lira le carnet (lot H3)', () => {
  it('lanternes: niveau, nom, seuil suivant, la lanterne suivante par quarts', () => {
    const sim = daySim();
    expect(bondView(content, sim.world, 'odette')).toEqual({ bond: 0, level: 0, levelKey: 'bond_level_0', next: 100, quarters: 0 });
    sim.world.bonds.odette = 330;
    expect(bondView(content, sim.world, 'odette')).toEqual({ bond: 330, level: 2, levelKey: 'bond_level_2', next: 450, quarters: 1 });
    sim.world.bonds.odette = 449;
    expect(bondView(content, sim.world, 'odette').quarters).toBe(3);
    expect(content.texts.messages.bond_level_2).toBe('Voisinage');
    sim.world.bonds.odette = 1000;
    expect(bondView(content, sim.world, 'odette')).toMatchObject({ level: 5, next: null, quarters: 4 });
  });

  it('anniversaire: « ? » tant qu\'aucune habitude d\'anniversaire n\'est au carnet, rien sans habitude écrite', () => {
    const sim = daySim();
    expect(birthdayView(content, sim.world, 'nour')).toEqual({ kind: 'unknown' });
    sim.world.habits.known.nour = ['birthday'];
    expect(birthdayView(content, sim.world, 'nour')).toEqual({ kind: 'known', season: 'spring', day: 7 });
    expect(birthdayView(content, sim.world, 'licorne')).toEqual({ kind: 'none' });
  });
});

describe('HB-11: le lien ne baisse jamais (démo jouée par les robots)', () => {
  it('graine 42: jusqu\'à la fin de la démo, aucun lien ne baisse, et les robots en gagnent', () => {
    const sim = newSim(42);
    const robot = createRobot({ riddle: true });
    let last: Record<string, number> = {};
    for (let ticks = 0; sim.world.phase !== 'ended' && ticks < SIM_HZ * 60 * 120; ticks++) {
      step(sim, robot.decide(sim));
      if (ticks % SIM_HZ !== 0) continue;
      for (const [id, b] of Object.entries(sim.world.bonds)) expect(b, `${id} au tick ${String(ticks)}`).toBeGreaterThanOrEqual(last[id] ?? 0);
      last = { ...sim.world.bonds };
    }
    expect(sim.world.phase).toBe('ended');
    expect(sim.world.bonds.firmin ?? 0).toBeGreaterThanOrEqual(250);
    expect(Object.values(sim.world.bonds).every((b) => b <= bonds.max)).toBe(true);
  });
});

describe('habitants écrits sans leurs valeurs par défaut', () => {
  it('un habitant immobile, hors du bourg, sans conversation n\'écrit que six champs; la lecture retrouve tout', () => {
    const sim = daySim();
    for (const v of sim.world.villagers) {
      const written = writeVillager(v);
      expect(readVillager(JSON.parse(JSON.stringify(written)) as typeof written)).toEqual(v);
    }
    const v = villager(sim, 'firmin');
    v.prev = { ...v.pos };
    v.speed = 0;
    v.visible = false;
    v.talkingWith = [];
    v.met = false;
    v.inside = null;
    expect(Object.keys(writeVillager(v)).sort()).toEqual(['activity', 'facing', 'id', 'pos', 'target', 'visible']);
    v.visible = true;
    expect(Object.keys(writeVillager(v)).sort()).toEqual(['activity', 'facing', 'id', 'pos', 'target']);
    v.met = true;
    v.talkingWith = ['p2'];
    v.inside = 'grocery';
    v.speed = 1.2;
    v.prev = { x: v.pos.x - 0.1, y: v.pos.y };
    expect(readVillager(writeVillager(v))).toEqual(v);
  });

  it('une sauvegarde écrite sans défauts se relit telle quelle; une ancienne (habitants complets) aussi', () => {
    const sim = daySim();
    villager(sim, 'odette').met = true;
    const snap = snapshotOf(sim);
    expect(snap.data.villagers.some((v) => 'prev' in v || 'talkingWith' in v)).toBe(false);
    const again = restoreWorld(content, sim.map, decodeSave(JSON.stringify(snap.data)), snap.dataSchema, [A, B]);
    // `inside` se déduit de la position à la reprise (tour 10): il n'est pas comparé ici.
    expect(again.world.villagers.map((v) => [v.id, v.met, v.visible, v.target, v.pos])).toEqual(sim.world.villagers.map((v) => [v.id, v.met, v.visible, v.target, v.pos]));
    expect(fillVillagerDefaults({ villagers: [{ id: 'x', pos: { x: 1, y: 2 } }] })).toEqual({
      villagers: [{ id: 'x', pos: { x: 1, y: 2 }, prev: { x: 1, y: 2 }, speed: 0, visible: true, talkingWith: [], met: false, inside: null }],
    });
  });

  it('l\'état transmis à la fin d\'une journée de démo: environ 1,5 Ko de moins avec 21 habitants', () => {
    const file = fileURLToPath(new URL('./donnees/sauvegardes/format-14-fin-de-la-demo.json', import.meta.url));
    const raw = JSON.parse(readFileSync(file, 'utf8')) as { data: WorldState };
    const full = Buffer.byteLength(JSON.stringify(raw.data.villagers), 'utf8');
    const written = Buffer.byteLength(JSON.stringify(writtenWorld(raw.data).villagers), 'utf8');
    expect(raw.data.villagers).toHaveLength(21);
    expect(full - written).toBeGreaterThan(1200);
  });
});

describe('sauvegarde: format 14 sans nouveau format', () => {
  it.each([
    ['format-14-ete-jour-25.json', 14],
    ['format-14-fin-de-la-demo.json', 14],
    ['format-13-ete-jour-25.json', 13],
  ])('%s se charge, garde liens et goûts au format en cours, et se relit à l\'identique', (name, schema) => {
    const { map } = contentAndMap();
    const file = fileURLToPath(new URL(`./donnees/sauvegardes/${name}`, import.meta.url));
    const raw = JSON.parse(readFileSync(file, 'utf8')) as { data: unknown };
    const sim = restoreWorld(content, map, decodeSave(structuredClone(raw.data)), schema, [A, B]);
    expect(DATA_SCHEMA).toBe(14);
    sim.world.tastesKnown.leon = { brioche: 'loves', lettuce: 'dislikes' };
    addBond(sim, 'leon', 75, 'p1');
    const snap = snapshotOf(sim);
    expect(snap.dataSchema).toBe(DATA_SCHEMA);
    const again = restoreWorld(content, map, decodeSave(JSON.stringify(snap.data)), snap.dataSchema, [A, B]);
    expect(again.world.bonds).toEqual(sim.world.bonds);
    expect(again.world.tastesKnown).toEqual(sim.world.tastesKnown);
    expect(again.world.storyDone).toEqual(sim.world.storyDone);
    expect(again.world.villagers.map((v) => ({ ...v, talkingWith: [] }))).toEqual(sim.world.villagers.map((v) => ({ ...v, talkingWith: [] })));
  });

  it('une partie de la 0.12 garde ses ventes « Doux » au marché dans le lien de départ', () => {
    const { map } = contentAndMap();
    const file = fileURLToPath(new URL('./donnees/sauvegardes/format-13-ete-jour-25.json', import.meta.url));
    const raw = JSON.parse(readFileSync(file, 'utf8')) as { data: WorldState };
    const data = structuredClone(raw.data);
    data.counters.duo['market_bond:basile'] = 6;
    const base = restoreWorld(content, map, decodeSave(structuredClone(raw.data)), 13, [A, B]);
    const sim = restoreWorld(content, map, decodeSave(data), 13, [A, B]);
    expect(sim.world.bonds.basile).toBe((base.world.bonds.basile ?? 0) + 6);
  });

  it('une sauvegarde aux goûts abîmés est refusée', () => {
    const sim = daySim();
    const data = JSON.parse(JSON.stringify(snapshotOf(sim).data)) as Record<string, unknown>;
    data.tastesKnown = { leon: { brioche: 'adore' } };
    expect(() => restoreWorld(content, sim.map, data, DATA_SCHEMA, [A, B])).toThrow(/sauvegarde: amitié invalide/);
  });
});

describe('réseau: même amitié chez les deux machines', () => {
  it("l'invité offre, l'hôte applique; l'invité voit le même lien, le même goût, les mêmes habitants", async () => {
    const duo = await startLocalDuo<GameAction>({
      manifest,
      conditions: { latencyMs: 0, jitterMs: 0, spikeProbability: 0 },
      seed: 5,
    });
    try {
      await duo.start();
      const { map } = contentAndMap();
      const clock = { now: 0 };
      const host = createSession({ duo: duo.hostGame, content, map, now: () => clock.now });
      const guest = createSession({ duo: duo.guestGame, content, map, now: () => clock.now });
      let seq = 0;
      const idle = (): ControlFrame => ({ seq: (seq += 1), moveX: 0, moveY: 0, actHeld: false });
      const tick = async (): Promise<void> => {
        host.step(idle());
        guest.step(idle());
        clock.now += SIM_DT * 1000;
        host.beforeFrame(1);
        guest.beforeFrame(1);
        await new Promise((resolve) => setTimeout(resolve, 0));
      };
      for (let i = 0; i < 20; i++) await tick();
      const sim = host.hostSim();
      if (sim === null) throw new Error('hôte sans monde');
      const w = sim.world;
      w.phase = 'day';
      w.clock.day = 10;
      w.clock.minutes = 15 * 60;
      w.clock.running = false;
      w.scene = null;
      for (const c of w.characters) {
        c.created = true;
        c.status = 'active';
        c.inside = null;
        c.pos = { x: 5, y: 60 };
      }
      placeVillagers(sim);
      const guestId = guest.view.localCharacter();
      const me = character(sim, guestId);
      // Firmin, à sa cloche de 8 h à 18 h; ses goûts ne sont pas encore écrits (lot H4): tout lui est égal.
      addToBag(sim, me, 'radish', 'ordinary', 1);
      addToBag(sim, me, 'brioche', 'ordinary', 1);
      for (let i = 0; i < 3; i++) await tick();
      nextTo(sim, me, 'firmin');
      guest.view.send({ type: 'gift', villager: 'firmin', item: 'radish' });
      guest.view.send({ type: 'gift', villager: 'firmin', item: 'brioche' });
      for (let i = 0; i < 2 * SIM_HZ; i++) await tick();
      expect(w.bonds.firmin).toBe(10);
      expect(countInBag(me, 'brioche'), 'un cadeau par jour').toBe(1);
      const seen = guest.view.world();
      expect(seen.bonds).toEqual(w.bonds);
      expect(seen.tastesKnown).toEqual(w.tastesKnown);
      expect(seen.tastesKnown.firmin).toEqual({ radish: 'neutral' });
      const fields = (v: Pick<Readonly<VillagerState>, 'id' | 'visible' | 'target' | 'activity' | 'met' | 'inside'> & { readonly talkingWith: readonly string[] }): unknown => [v.id, v.visible, v.target, v.activity, v.talkingWith, v.met, v.inside];
      expect(seen.villagers.map(fields)).toEqual(w.villagers.map(fields));
      expect(seen.villagers.every((v) => typeof v.prev.x === 'number' && Array.isArray(v.talkingWith))).toBe(true);
      const mine = seen.characters.find((c) => c.id === guestId)?.notifications.map((n) => n.key);
      expect(mine).toEqual(me.notifications.map((n) => n.key));
      host.dispose();
      guest.dispose();
    } finally {
      duo.dispose();
    }
  });
});

describe('aube', () => {
  it('les cadeaux et les conversations du jour se remettent à zéro à l\'aube', () => {
    const sim = daySim(10, 15 * 60);
    const p1 = character(sim, 'p1');
    addToBag(sim, p1, 'brioche', 'ordinary', 2);
    nextTo(sim, p1, 'leon');
    gift(sim, 'p1', 'leon', 'brioche');
    morning(sim);
    sim.world.phase = 'day';
    p1.status = 'active';
    nextTo(sim, p1, 'leon');
    gift(sim, 'p1', 'leon', 'brioche');
    expect(sim.world.bonds.leon).toBe(120);
  });
});
