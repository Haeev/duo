// Tour 10, lot L3 (docs/jeux/jeu-1/tour-10-conception.md, sections 1.4 à 1.8 et 2.3; ADR 0016):
// portes et heures des intérieurs, porter à deux, emplois du temps d'Achille, de Solange et de
// Jeanne (T10-05), la panière (T10-06), le guichet du fournil (T10-07), la première coupe et le
// salon (T10-08 à T10-10), le chocolat chaud, les souhaits et les départs un par journée (T10-27).
import { dialogueDone } from '../src/etat/dialogues-faits';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { AuthoredIntent, ControlFrame, Intent } from '../src/etat/actions';
import type { Beam, CharacterId, QuestState, WorldEvent } from '../src/etat/types';
import { catalogueOffers } from '../src/etat/catalogue';
import { decodeSave, restoreWorld } from '../src/sauvegarde/sauvegarde';
import { TOWN, townDays } from '../src/simulation/bourg';
import { HEN_DROP, deliverWeeklyItem } from '../src/simulation/catalogue';
import { inRect } from '../src/etat/carte';
import { atSalonChair, bakeryBoughtToday, firstCutFree } from '../src/etat/interieurs';
import { type Sim, character } from '../src/simulation/contexte';
import { blockersFor, placeCharacter, refreshBlockers } from '../src/simulation/deplacement';
import { isBlockedCell } from '../src/simulation/grille';
import { placeVillagers } from '../src/simulation/habitants';
import { morning } from '../src/simulation/horloge';
import { step } from '../src/simulation/pas';
import { countInBag } from '../src/simulation/sac';
import { SIM_HZ } from '../src/simulation/constantes';
import { contentAndMap, createRobot, newSim, play } from './aides';

const A = { id: 'membre-a', name: 'Camille', color: '#e07a5f' };
const B = { id: 'membre-b', name: 'Sacha', color: '#3d85c6' };
const H = 60;
/** Jours de la semaine (le jour 1 est un samedi), après la démo et l'été (monde de référence du jour 25). */
const TUESDAY = 25;
const SATURDAY = 29;
const SUNDAY = 30;
const MONDAY = 31;
const AUTUMN_MONDAY = 45;

/** Monde au jour 1, les deux personnages créés, scène d'arrivée passée (comme `regles.test.ts`). */
function started(): Sim {
  const sim = newSim();
  step(sim, {
    controls: {},
    intents: [
      { by: 'p1', intent: { type: 'create_character', name: 'Camille', hair: 0, outfit: 0 } },
      { by: 'p2', intent: { type: 'create_character', name: 'Sacha', hair: 1, outfit: 1 } },
    ],
  });
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

function done(sim: Sim, id: string): void {
  const steps = sim.content.quests.find((q) => q.id === id)?.steps.length ?? 0;
  const state: QuestState = { id, status: 'done', step: steps, checklist: [], baselines: {}, startedDay: 1 };
  sim.world.quests = sim.world.quests.filter((q) => q.id !== id);
  sim.world.quests.push(state);
}

/** Monde réel de l'été (sauvegarde de format 6 du mardi 25), avancé à la main à ce jour et cette heure. */
function summer(day: number, minutes: number, weather: 'sunny' | 'rain' = 'sunny'): Sim {
  const { content, map } = contentAndMap();
  const file = new URL('./donnees/sauvegardes/format-6-ete-jour-25.json', import.meta.url);
  const raw = JSON.parse(readFileSync(fileURLToPath(file), 'utf8')) as { dataSchema: number; data: unknown };
  const sim = restoreWorld(content, map, decodeSave(raw.data), raw.dataSchema, [A, B]);
  const w = sim.world;
  w.phase = 'day';
  w.clock.day = day;
  w.clock.minutes = minutes;
  w.weather = weather;
  w.stages.passed = day > 43 ? ['demo', 'summer_end'] : ['demo'];
  const train = day + ((7 - ((day - 1) % 7)) % 7 || 7);
  if (w.order.generated !== null) w.order.generated.train = train;
  for (const q of w.quests) if (q.id === 'weekly_order') q.train = train;
  w.moments.today = null;
  w.scene = null;
  w.scripts = [];
  w.beam = null;
  for (const c of w.characters) {
    c.status = 'active';
    c.menu = null;
    c.dialogue = null;
    c.seat = null;
    c.notifications = [];
  }
  return sim;
}

/** Le bourg de la rue Haute en place (habitants arrivés, panière faite, salon ouvert), à ce jour et cette heure. */
function town(day: number, minutes: number, weather: 'sunny' | 'rain' = 'sunny', flags: string[] = []): Sim {
  const sim = summer(day, minutes, weather);
  const w = sim.world;
  w.flags.push(TOWN.achilleHere, TOWN.solangeHere, TOWN.letterSent, TOWN.bakeryOpen, TOWN.salonOpen, ...flags);
  done(sim, TOWN.basketQuest);
  done(sim, TOWN.cutQuest);
  for (const c of w.characters) {
    c.status = 'active';
    c.menu = null;
    c.dialogue = null;
  }
  w.scene = null;
  placeVillagers(sim);
  return sim;
}

function at(sim: Sim, id: string): { x: number; y: number } {
  const p = sim.map.points[id];
  if (p === undefined) throw new Error(`point ${id} absent`);
  return p;
}

function walk(sim: Sim, frames: Partial<Record<CharacterId, [number, number, boolean?]>>, seconds: number, intents: AuthoredIntent[] = []): WorldEvent[] {
  const events: WorldEvent[] = [];
  let seq = 0;
  for (let i = 0; i < Math.round(seconds * SIM_HZ); i++) {
    const controls: Partial<Record<CharacterId, ControlFrame>> = {};
    for (const [id, f] of Object.entries(frames) as [CharacterId, [number, number, boolean?]][]) {
      controls[id] = { seq: ++seq, moveX: f[0], moveY: f[1], actHeld: f[2] ?? false };
    }
    sim.events = [];
    step(sim, { controls, intents: i === 0 ? intents : [] });
    events.push(...sim.events);
  }
  return events;
}

function send(sim: Sim, by: CharacterId, intent: Intent): WorldEvent[] {
  sim.events = [];
  step(sim, { controls: {}, intents: [{ by, intent }] });
  return [...sim.events];
}

function said(sim: Sim, id: CharacterId, key: string): boolean {
  return character(sim, id).notifications.some((n) => n.key === key);
}

function where(sim: Sim, villager: string): string {
  const v = sim.world.villagers.find((x) => x.id === villager);
  return v === undefined ? 'absent' : `${v.target}:${v.visible ? 'vu' : 'caché'}`;
}

function scheduleAt(day: number, minutes: number, weather: 'sunny' | 'rain' = 'sunny'): Record<string, string> {
  const sim = town(day, minutes, weather);
  return { achille: where(sim, 'achille'), solange: where(sim, 'solange'), jeanne: where(sim, 'jeanne') };
}

describe('portes et heures des intérieurs (T10-12, ADR 0016)', () => {
  it("une porte hors des heures est bloquée de dehors: le loquet et la ligne des heures, une fois", () => {
    const sim = town(TUESDAY, 19 * H + 30);
    const c = character(sim, 'p1');
    placeCharacter(sim, c, { x: 31.5, y: 30.5 });
    const events = walk(sim, { p1: [-1, 0] }, 3);
    expect(c.inside).toBeNull();
    expect(c.pos.x).toBeGreaterThan(30.6);
    expect(said(sim, 'p1', 'door_closed_grocery')).toBe(true);
    expect(events.filter((e) => e.type === 'door_locked')).toHaveLength(1);
    expect(isBlockedCell(refreshBlockers(sim), 30, 30)).toBe(true);
  });

  it('dans les heures, on entre en marchant: la porte s’entend, avec son bâtiment', () => {
    const sim = town(TUESDAY, 10 * H);
    const c = character(sim, 'p1');
    placeCharacter(sim, c, { x: 31.5, y: 30.5 });
    const events = walk(sim, { p1: [-1, 0] }, 2);
    expect(c.inside).toBe('grocery');
    expect(events).toContainEqual({ type: 'door', by: 'p1', entering: true, building: 'grocery' });
  });

  it("à la fermeture, qui est dedans n'est jamais déplacé, l'habitant le dit, et la sortie reste permise", () => {
    const sim = town(TUESDAY, 19 * H - 0.5);
    const c = character(sim, 'p1');
    const inside = at(sim, 'grocery_inside');
    placeCharacter(sim, c, inside);
    walk(sim, {}, 1);
    expect(sim.world.clock.minutes).toBeGreaterThan(19 * H);
    expect(c.pos).toEqual(inside);
    expect(said(sim, 'p1', 'closing_inside_grocery')).toBe(true);
    // La porte est fermée pour qui est dehors, passable pour qui est dedans.
    expect(isBlockedCell(refreshBlockers(sim), 30, 30)).toBe(true);
    expect(isBlockedCell(blockersFor(sim, c.pos), 30, 30)).toBe(false);
    placeCharacter(sim, c, { x: 29.5, y: 30.5 });
    walk(sim, { p1: [1, 0] }, 2);
    expect(c.inside).toBeNull();
    expect(c.pos.x).toBeGreaterThan(31);
  });

  it('dans l’embrasure quand la porte ferme: on finit de passer, sans accroc', () => {
    const sim = town(TUESDAY, 19 * H - 0.5);
    const c = character(sim, 'p1');
    placeCharacter(sim, c, { x: 30.5, y: 30.5 });
    walk(sim, { p1: [1, 0] }, 1.5);
    expect(c.pos.x).toBeGreaterThan(31.2);
  });

  it('le salon suit ses jours: fermé le lundi et le samedi avant 10 h 45, ouvert le mardi à 10 h', () => {
    const blocked = (day: number, minutes: number): boolean => isBlockedCell(refreshBlockers(town(day, minutes)), 74, 28);
    expect(blocked(TUESDAY, 10 * H)).toBe(false);
    expect(blocked(TUESDAY, 13 * H)).toBe(true);
    expect(blocked(MONDAY, 10 * H)).toBe(true);
    expect(blocked(SATURDAY, 10 * H + 30)).toBe(true);
    expect(blocked(SATURDAY, 11 * H)).toBe(false);
  });

  it('les habitants ont leurs clés: Solange entre chez elle avant l’ouverture', () => {
    const sim = town(TUESDAY, 8 * H + 50);
    const solange = sim.world.villagers.find((v) => v.id === 'solange');
    expect(solange?.target).toBe('salon_counter');
    if (solange === undefined) return;
    solange.pos = { x: 76.5, y: 28.5 };
    sim.world.clock.minutes = 9 * H + 5;
    sim.runtime.villagerPaths = {};
    walk(sim, {}, 6);
    expect(solange.inside).toBe('salon');
  });

  it('on ne passe pas une porte en portant à deux: la charge bute, le message une fois', () => {
    const sim = town(TUESDAY, 10 * H);
    const [a, b] = sim.world.characters;
    if (a === undefined || b === undefined) throw new Error('deux joueurs');
    const beam: Beam = {
      item: TOWN.basketItem,
      purpose: 'basket',
      construction: null,
      contents: null,
      to: { x: 25, y: 30.5 },
      route: null,
      leg: 0,
      pos: { x: 32.6, y: 30.5 },
      prev: { x: 32.6, y: 30.5 },
      facing: 0,
      carried: false,
      holders: [],
    };
    sim.world.beam = beam;
    placeCharacter(sim, a, { x: 32.0, y: 30.5 });
    placeCharacter(sim, b, { x: 33.2, y: 30.5 });
    walk(sim, { p1: [-1, 0, true], p2: [-1, 0, true] }, 4);
    expect(a.pos.x).toBeGreaterThanOrEqual(31);
    expect(a.inside).toBeNull();
    const told = sim.world.characters.flatMap((c) => c.notifications).filter((n) => n.key === 'no_door_carry');
    expect(told).toHaveLength(2);
  });
});

describe('pièces bâties dans les collisions (demande du lot L4)', () => {
  it('le cellier bâti: ses murs bloquent, la fenêtre devenue porte s’ouvre, et l’on y est « chez soi »', () => {
    const sim = town(TUESDAY, 10 * H);
    const before = refreshBlockers(sim);
    expect(isBlockedCell(before, 5, 24)).toBe(true);
    expect(isBlockedCell(before, 2, 24)).toBe(false);
    sim.world.rooms.room_cellar = { ordered: 20, crate: [], elementsBuilt: [], beamPlaced: false, builtDay: 24, work: null };
    sim.runtime.dynamicDirty = true;
    const after = refreshBlockers(sim);
    expect(isBlockedCell(after, 5, 24)).toBe(false);
    expect(isBlockedCell(after, 2, 24)).toBe(true);
    const c = character(sim, 'p1');
    placeCharacter(sim, c, at(sim, 'house_spawn'));
    placeCharacter(sim, c, { x: 6.5, y: 24.5 });
    walk(sim, { p1: [-1, 0] }, 2);
    expect(c.pos.x).toBeLessThan(5);
    expect(c.inside).toBe('house');
  });
});

describe('« chez soi » et « à l’abri »: les règles qui changent de sens (ADR 0016, revue 13.4)', () => {
  it('bancs du dehors: dans la mercerie, à 1,5 m du banc de la rue Haute derrière le mur, on ne s’assoit pas', () => {
    const sim = town(TUESDAY, 10 * H);
    const c = character(sim, 'p1');
    placeCharacter(sim, c, { x: 73.6, y: 30.6 });
    expect(c.inside).toBe('salon');
    walk(sim, {}, 0.1, [{ by: 'p1', intent: { type: 'move_to', target: { kind: 'ground', x: 75.2, y: 31 }, act: true } }]);
    expect(c.seat).toBeNull();
  });

  it('bêche: on ne creuse pas le sol d’un intérieur (à l’abri), ni chez soi', () => {
    const sim = town(TUESDAY, 10 * H);
    const c = character(sim, 'p1');
    c.bag[0] = { item: 'hoe', quality: 'ordinary', count: 1 };
    c.selected = 0;
    placeCharacter(sim, c, at(sim, 'grocery_inside'));
    c.facing = Math.PI;
    walk(sim, {}, 0.05);
    expect(c.aim?.verb ?? null).not.toBe('dig');
    placeCharacter(sim, c, { x: 47.5, y: 32.5 });
    walk(sim, {}, 0.05);
    expect(c.aim?.verb).toBe('dig');
  });

  it('minuit: qui est chez Odette rentre à la maisonnette; qui est chez soi y reste', () => {
    const sim = town(TUESDAY, 24 * H - 0.2);
    const [a, b] = sim.world.characters;
    if (a === undefined || b === undefined) throw new Error('deux joueurs');
    placeCharacter(sim, a, at(sim, 'grocery_inside'));
    placeCharacter(sim, b, at(sim, 'house_spawn'));
    walk(sim, {}, 1);
    expect(a.inside).toBe('house');
    expect(a.midnightReturn).toBe(true);
    expect(b.midnightReturn).toBe(false);
  });

  it('veillée: les deux chez Odette à 19 h 30 ne lancent pas la veillée; les deux chez soi, si', () => {
    const shop = town(TUESDAY, 18 * H + 50);
    for (const c of shop.world.characters) placeCharacter(shop, c, at(shop, 'grocery_inside'));
    walk(shop, {}, 0.1);
    expect(shop.world.clock.veillee).toBe(false);
    const home = town(TUESDAY, 19 * H + 30);
    for (const c of home.world.characters) placeCharacter(home, c, at(home, 'house_spawn'));
    walk(home, {}, 0.1);
    expect(home.world.clock.veillee).toBe(true);
  });

  it('aménagement: on ne pose un meuble que chez soi, pas dans la boutique d’Odette', () => {
    const sim = town(TUESDAY, 10 * H);
    const c = character(sim, 'p1');
    c.bag[1] = { item: 'chair', quality: 'ordinary', count: 1 };
    placeCharacter(sim, c, at(sim, 'grocery_inside'));
    send(sim, 'p1', { type: 'hold_furniture', item: 'chair' });
    expect(c.placement).toBeNull();
    placeCharacter(sim, c, at(sim, 'house_spawn'));
    send(sim, 'p1', { type: 'hold_furniture', item: 'chair' });
    expect(c.placement).not.toBeNull();
  });
});

describe('emplois du temps de la rue Haute (T10-05)', () => {
  it('Achille un mardi: guichet, panière, pétrin, banc, sieste, gué; pluie: sous l’auvent', () => {
    expect(scheduleAt(TUESDAY, 7 * H).achille).toBe('bakery_window:vu');
    expect(scheduleAt(TUESDAY, 9 * H + 10).achille).toBe('grocery_door:vu');
    expect(scheduleAt(TUESDAY, 10 * H).achille).toBe('bakery_window:vu');
    expect(scheduleAt(TUESDAY, 12 * H + 30).achille).toBe('upper_street_bench:vu');
    expect(scheduleAt(TUESDAY, 14 * H).achille).toBe('bakery_window:caché');
    expect(scheduleAt(TUESDAY, 18 * H).achille).toBe('fishing_ford_north:vu');
    expect(scheduleAt(TUESDAY, 18 * H, 'rain').achille).toBe('bakery_window:vu');
    expect(scheduleAt(TUESDAY, 20 * H).achille).toBe('bakery_window:caché');
  });

  it('Achille le samedi au train, le lundi au ponton (chez lui s’il pleut) puis à la tonnelle', () => {
    expect(scheduleAt(SATURDAY, 10 * H + 30).achille).toBe('train_stop:vu');
    expect(scheduleAt(SATURDAY, 7 * H).achille).toBe('bakery_window:vu');
    expect(scheduleAt(MONDAY, 9 * H).achille).toBe('fishing_pontoon:vu');
    expect(scheduleAt(MONDAY, 9 * H, 'rain').achille).toBe('bakery_window:caché');
    expect(scheduleAt(MONDAY, 13 * H).achille).toBe('grocery_terrace:vu');
    expect(scheduleAt(SUNDAY, 7 * H).achille).toBe('bakery_window:vu');
  });

  it('Solange: salon du mardi au samedi, quai le samedi matin, berge et mise en plis le dimanche, couture le lundi', () => {
    expect(scheduleAt(TUESDAY, 10 * H).solange).toBe('salon_counter:vu');
    expect(scheduleAt(TUESDAY, 13 * H).solange).toBe('salon_counter:caché');
    expect(scheduleAt(SATURDAY, 10 * H + 20).solange).toBe('train_stop:vu');
    expect(scheduleAt(SATURDAY, 11 * H).solange).toBe('salon_counter:vu');
    expect(scheduleAt(SUNDAY, 11 * H).solange).toBe('riverbank:vu');
    expect(scheduleAt(SUNDAY, 15 * H).solange).toBe('grocery_table:vu');
    expect(scheduleAt(MONDAY, 12 * H).solange).toBe('salon_window:vu');
    expect(scheduleAt(TUESDAY, 18 * H + 15).solange).toBe('village_square:vu');
    expect(scheduleAt(TUESDAY, 18 * H + 45).solange).toBe('lucie_house_door:vu');
    expect(scheduleAt(TUESDAY, 21 * H).solange).toBe('salon_counter:caché');
  });

  it("Jeanne rentre avec Solange chez Lucie à 18 h 30, monte à l'école l'automne, et ne sort plus par la route des hameaux", () => {
    expect(scheduleAt(TUESDAY, 18 * H + 45, 'rain').jeanne).toBe('lucie_house_door:caché');
    expect(scheduleAt(AUTUMN_MONDAY, 9 * H).jeanne).toBe('school_gate:caché');
    for (const day of [TUESDAY, SATURDAY, SUNDAY, MONDAY, AUTUMN_MONDAY, AUTUMN_MONDAY + 1]) {
      for (const weather of ['sunny', 'rain'] as const) {
        for (let m = 6 * H; m < 24 * H; m += 15) expect(scheduleAt(day, m, weather).jeanne, `jour ${String(day)}, ${String(m)}`).not.toMatch(/^village_exit/);
      }
    }
  }, 120_000);
});

describe('la panière d’Achille (T10-06) et les départs un par journée (T10-27)', () => {
  it('partie neuve: la panière au jour 4 (un mardi), la lettre le lendemain, les souhaits aux jours 10 et 12', () => {
    const sim = newSim();
    expect(townDays(sim.world)).toEqual({ basket: 4, letter: 5, achilleWish: 10, solangeWish: 12 });
    expect((4 - 1) % 7).toBe(3);
  });

  it('partie reprise: un départ par jour, jamais la panière un lundi, ni le jour des plans de Basile', () => {
    // Sans lettre des plans: le dimanche 30, dès le jour même; le lundi 31, le mardi.
    expect(townDays({ upperStreetSince: 31 })).toEqual({ basket: 32, letter: 33, achilleWish: 34, solangeWish: 35 });
    expect(townDays({ upperStreetSince: 30 })).toEqual({ basket: 30, letter: 31, achilleWish: 32, solangeWish: 33 });
    // Reprise au jour 25, après le jour 23: les plans de Basile le 25, la panière le 26.
    expect(townDays({ upperStreetSince: 25 }, 23)).toEqual({ basket: 26, letter: 27, achilleWish: 28, solangeWish: 29 });
    // Reprise au jour 30 (dimanche): les plans le 30, la panière le lundi refusée, le mardi 32.
    expect(townDays({ upperStreetSince: 30 }, 23)).toEqual({ basket: 32, letter: 33, achilleWish: 34, solangeWish: 35 });
    expect(townDays({ upperStreetSince: 12 }, 23)).toEqual({ basket: 12, letter: 13, achilleWish: 14, solangeWish: 15 });
  });

  it("la quête démarre à l'aube du jour 4 et se finit seulement en portant la panière à deux jusqu'à la porte d'Odette", () => {
    const sim = started();
    // La poutre du toit portée (une seule charge à la fois): la panière peut paraître.
    sim.world.beam = null;
    sim.world.clock.day = 3;
    sim.world.phase = 'night';
    morning(sim);
    expect(sim.world.flags).toContain(TOWN.achilleHere);
    for (const id of ['p1', 'p2'] as const) send(sim, id, { type: 'start_day' });
    expect(sim.world.quests.find((q) => q.id === TOWN.basketQuest)?.status).toBe('active');
    expect(said(sim, 'p1', 'achille_late')).toBe(true);
    // Monter au fournil et parler à Achille.
    const achille = sim.world.villagers.find((v) => v.id === 'achille');
    expect(achille?.target).toBe('bakery_window');
    const c = character(sim, 'p1');
    if (achille === undefined) return;
    achille.pos = { ...at(sim, 'bakery_door') };
    placeCharacter(sim, c, { x: achille.pos.x, y: achille.pos.y + 1 });
    send(sim, 'p1', { type: 'move_to', target: { kind: 'villager', villager: 'achille' }, act: true });
    for (let i = 0; i < 10 && c.dialogue !== null; i++) send(sim, 'p1', { type: 'dialogue_next' });
    walk(sim, {}, 0.2);
    expect(dialogueDone(sim.world.dialoguesDone, 'achille_basket_ask')).toBe(true);
    const load = (): Beam | null => sim.world.beam;
    expect(load()?.purpose).toBe('basket');
    // Seul, on ne la soulève pas.
    const beam = load();
    if (beam === null) return;
    placeCharacter(sim, c, { x: beam.pos.x + 0.6, y: beam.pos.y });
    walk(sim, { p1: [0, 1, true] }, 1);
    expect(load()?.carried).toBe(false);
    // À deux, posée devant la porte d'Odette: quête finie, deux pains chauds chacun, guichet ouvert.
    beam.pos = { x: at(sim, 'grocery_door').x + 2.5, y: at(sim, 'grocery_door').y };
    const [a, b] = sim.world.characters;
    if (a === undefined || b === undefined) return;
    placeCharacter(sim, a, { x: beam.pos.x - 0.6, y: beam.pos.y });
    placeCharacter(sim, b, { x: beam.pos.x + 0.6, y: beam.pos.y });
    walk(sim, { p1: [-1, 0, true], p2: [-1, 0, true] }, 3);
    expect(sim.world.quests.find((q) => q.id === TOWN.basketQuest)?.status).toBe('done');
    expect(sim.world.flags).toContain(TOWN.bakeryOpen);
    for (const x of [a, b]) expect(countInBag(x, TOWN.warmBread)).toBeGreaterThanOrEqual(2);
  });

  it('personne avant 11 h: Achille descend seul, le dit, et la quête reste ouverte (jamais le lundi)', () => {
    const sim = started();
    sim.world.clock.day = 4;
    sim.world.flags.push(TOWN.achilleHere);
    sim.world.clock.minutes = 11 * H - 0.5;
    walk(sim, {}, 1);
    const q = sim.world.quests.find((x) => x.id === TOWN.basketQuest);
    expect(q?.status).toBe('active');
    expect(sim.world.characters.every((c) => c.notifications.some((n) => n.key === 'villager_says' && n.text.includes('descendue seul')))).toBe(true);
    expect(sim.world.villagers.find((v) => v.id === 'achille')?.target).toBe('grocery_door');
  });

  it("une partie reprise au jour 25 (format 6, d'avant la rue Haute): la panière le jour même, puis la lettre, puis les souhaits, un par jour", () => {
    const { content, map } = contentAndMap();
    const file = new URL('./donnees/sauvegardes/format-6-ete-jour-25.json', import.meta.url);
    const raw = JSON.parse(readFileSync(fileURLToPath(file), 'utf8')) as { dataSchema: number; data: unknown };
    const sim = restoreWorld(content, map, decodeSave(raw.data), raw.dataSchema, [A, B]);
    const since = sim.world.upperStreetSince;
    expect(since).toBeGreaterThanOrEqual(25);
    const days = townDays(sim.world, sim.content.settings.rooms?.opensFromDay ?? null);
    const starts = new Map<number, string[]>();
    const robot = createRobot({ stages: 'stay' });
    let day = sim.world.clock.day;
    let flags = new Set(sim.world.flags);
    play(
      sim,
      robot,
      (s) => {
        if (s.world.clock.day !== day) {
          day = s.world.clock.day;
          const fresh = s.world.flags.filter((f) => !flags.has(f) && [TOWN.achilleHere, TOWN.letterSent, TOWN.achilleWish, TOWN.solangeWish].includes(f as never));
          if (s.world.letters.some((l) => l.id === 'basile_rooms' && l.day === day)) fresh.push('basile_rooms');
          if (fresh.length > 0) starts.set(day, fresh);
          flags = new Set(s.world.flags);
        }
        return s.world.clock.day > days.solangeWish + 1;
      },
      SIM_HZ * 60 * 60 * 3,
    );
    expect(sim.world.quests.find((q) => q.id === TOWN.basketQuest)?.status).toBe('done');
    expect(sim.world.quests.find((q) => q.id === TOWN.cutQuest)?.status).toBe('done');
    // Chaque nouveauté a sa journée.
    for (const fresh of starts.values()) expect(fresh).toHaveLength(1);
    expect([...starts.values()].flat()).toEqual(expect.arrayContaining([TOWN.letterSent, TOWN.achilleWish, TOWN.solangeWish]));
  }, 900_000);
});

describe('le guichet du fournil (T10-07)', () => {
  function window(day: number, minutes: number): Sim {
    const sim = town(day, minutes);
    const c = character(sim, 'p1');
    placeCharacter(sim, c, { x: 70.5, y: 21.6 });
    const achille = sim.world.villagers.find((v) => v.id === 'achille');
    if (achille?.visible === true) achille.pos = { x: 70.5, y: 20.9 };
    return sim;
  }

  it('pain chaud de 6 h à 9 h, pain jusqu’à midi, 5 sous, quatre au plus par joueur et par jour', () => {
    const sim = window(TUESDAY, 7 * H);
    const c = character(sim, 'p1');
    const purse = sim.world.purse;
    for (let i = 0; i < 5; i++) send(sim, 'p1', { type: 'bakery_buy', item: 'bread' });
    expect(countInBag(c, TOWN.warmBread)).toBe(4);
    expect(sim.world.purse).toBe(purse - 20);
    expect(said(sim, 'p1', 'bakery_cap_bread')).toBe(true);
    const late = window(TUESDAY, 10 * H);
    send(late, 'p1', { type: 'bakery_buy', item: 'bread' });
    expect(countInBag(character(late, 'p1'), TOWN.bread)).toBeGreaterThanOrEqual(1);
    expect(countInBag(character(late, 'p1'), TOWN.warmBread)).toBe(0);
  });

  it('jamais pendant les sorties d’Achille, ni le lundi, ni l’après-midi; la brioche seulement le dimanche', () => {
    const away = window(TUESDAY, 9 * H + 10);
    send(away, 'p1', { type: 'bakery_buy', item: 'bread' });
    expect(said(away, 'p1', 'bakery_away')).toBe(true);
    const monday = window(MONDAY, 7 * H);
    send(monday, 'p1', { type: 'bakery_buy', item: 'bread' });
    expect(said(monday, 'p1', 'bakery_closed')).toBe(true);
    const nap = window(TUESDAY, 14 * H);
    send(nap, 'p1', { type: 'bakery_buy', item: 'bread' });
    expect(said(nap, 'p1', 'bakery_asleep')).toBe(true);
    const tuesday = window(TUESDAY, 7 * H);
    send(tuesday, 'p1', { type: 'bakery_buy', item: 'brioche' });
    expect(countInBag(character(tuesday, 'p1'), TOWN.brioche)).toBe(0);
    const sunday = window(SUNDAY, 7 * H);
    send(sunday, 'p1', { type: 'bakery_buy', item: 'brioche' });
    expect(countInBag(character(sunday, 'p1'), TOWN.brioche)).toBe(1);
  });

  it('à midi, tout pain chaud devient du pain: sacs, coffre et sol', () => {
    const sim = window(TUESDAY, 12 * H - 0.5);
    const c = character(sim, 'p1');
    c.bag[5] = { item: TOWN.warmBread, quality: 'ordinary', count: 2 };
    sim.world.cellar.push({ item: TOWN.warmBread, quality: 'ordinary', count: 1 }, { item: TOWN.bread, quality: 'ordinary', count: 3 });
    sim.world.groundItems.push({ id: 'g-test', item: TOWN.warmBread, quality: 'ordinary', count: 1, pos: { x: 40, y: 30 } });
    walk(sim, {}, 1);
    expect(countInBag(c, TOWN.warmBread)).toBe(0);
    expect(countInBag(c, TOWN.bread)).toBe(2);
    expect(sim.world.cellar.filter((s) => s.item === TOWN.bread || s.item === TOWN.warmBread)).toEqual([{ item: TOWN.bread, quality: 'ordinary', count: 4 }]);
    expect(sim.world.groundItems.find((g) => g.id === 'g-test')?.item).toBe(TOWN.bread);
  });
});

describe('le salon de Solange (T10-08 à T10-10)', () => {
  function salon(day = TUESDAY, minutes = 10 * H): Sim {
    const sim = town(day, minutes);
    for (const c of sim.world.characters) placeCharacter(sim, c, at(sim, 'salon_inside'));
    walk(sim, {}, 0.1);
    return sim;
  }

  function sitChair(sim: Sim, id: CharacterId): void {
    placeCharacter(sim, character(sim, id), { x: 70.5, y: 30.5 });
    send(sim, id, { type: 'menu', menu: 'salon' });
  }

  it('15 coupes, 8 couleurs, 4 barbes; 15, 10 et 20 sous; « Garder ma coiffure » gratuit; un seul au fauteuil', () => {
    const sim = salon();
    const c = character(sim, 'p1');
    sitChair(sim, 'p1');
    expect(c.menu).toBe('salon');
    sitChair(sim, 'p2');
    expect(character(sim, 'p2').menu).toBeNull();
    expect(said(sim, 'p2', 'salon_chair_taken')).toBe(true);
    const purse = sim.world.purse;
    const a = { ...c.appearance };
    send(sim, 'p1', { type: 'haircut', hair: a.hair, hairColor: a.hairColor, beard: a.beard });
    expect(sim.world.purse).toBe(purse);
    sitChair(sim, 'p1');
    send(sim, 'p1', { type: 'haircut', hair: 15, hairColor: 0, beard: 0 });
    expect(c.menu).toBe('salon');
    send(sim, 'p1', { type: 'haircut', hair: 14, hairColor: a.hairColor, beard: a.beard });
    expect(sim.world.purse).toBe(purse - 15);
    sitChair(sim, 'p1');
    send(sim, 'p1', { type: 'haircut', hair: 14, hairColor: 7, beard: a.beard });
    expect(sim.world.purse).toBe(purse - 25);
    sitChair(sim, 'p1');
    send(sim, 'p1', { type: 'haircut', hair: 2, hairColor: 3, beard: 3 });
    expect(sim.world.purse).toBe(purse - 45);
    expect(c.appearance).toMatchObject({ hair: 2, hairColor: 3, beard: 3 });
  });

  it("une proposition depuis le banc s'affiche chez celui qui est au fauteuil seulement; il décide", () => {
    const sim = salon();
    send(sim, 'p2', { type: 'hair_offer', hair: 5, hairColor: 4, beard: 0 });
    expect(character(sim, 'p1').hairOffer).toBeNull();
    sitChair(sim, 'p1');
    placeCharacter(sim, character(sim, 'p2'), { x: 72.5, y: 29.6 });
    send(sim, 'p2', { type: 'hair_offer', hair: 5, hairColor: 4, beard: 0 });
    expect(character(sim, 'p1').hairOffer).toEqual({ by: 'p2', hair: 5, hairColor: 4, beard: 0 });
    expect(character(sim, 'p2').hairOffer).toBeNull();
    send(sim, 'p1', { type: 'menu', menu: null });
    expect(character(sim, 'p1').hairOffer).toBeNull();
    expect(character(sim, 'p1').appearance.hair).not.toBe(5);
  });

  it('coupe remarquée: une fois par changement, à moins de 4 m, hors menus; Cœur +10 aux deux', () => {
    const sim = salon();
    sitChair(sim, 'p1');
    const [a, b] = sim.world.characters;
    if (a === undefined || b === undefined) return;
    placeCharacter(sim, b, { x: 92, y: 30 });
    const before = [a.needs.heart, b.needs.heart];
    send(sim, 'p1', { type: 'haircut', hair: 6, hairColor: 2, beard: 1 });
    walk(sim, {}, 0.2);
    expect(a.hairNoticedBy).toBeNull();
    b.menu = 'notebook';
    placeCharacter(sim, b, { x: a.pos.x + 1, y: a.pos.y });
    walk(sim, {}, 0.2);
    expect(a.hairNoticedBy).toBeNull();
    b.menu = null;
    b.status = 'active';
    walk(sim, {}, 0.2);
    expect(a.hairNoticedBy).toBe('p2');
    expect(said(sim, 'p2', 'hair_noticed')).toBe(true);
    // +10 chacun (le Cœur monte aussi un peu près de l'autre, lot L4: au moins +10).
    expect(a.needs.heart).toBeGreaterThanOrEqual(Math.min(100, (before[0] ?? 0) + 10));
    expect(b.needs.heart).toBeGreaterThanOrEqual(Math.min(100, (before[1] ?? 0) + 10));
    expect(a.needs.heart).toBeLessThan(Math.min(100, (before[0] ?? 0) + 11));
    walk(sim, {}, 0.5);
    expect(b.notifications.filter((n) => n.key === 'hair_noticed')).toHaveLength(1);
  });

  it('première coupe (T10-08): la lettre jamais un dimanche ni un lundi; gratuite pour chacun; le miroir avec les deux, après le fauteuil', () => {
    // La lettre attend le mardi: panière finie le vendredi 7, samedi 8 (salon ouvert): elle part.
    const sim = started();
    done(sim, TOWN.basketQuest);
    sim.world.flags.push(TOWN.achilleHere);
    const letterDays: number[] = [];
    for (const day of [8, 9, 10, 11]) {
      sim.world.clock.day = day - 1;
      sim.world.flags = sim.world.flags.filter((f) => f !== TOWN.letterSent);
      sim.world.letters = sim.world.letters.filter((l) => l.id !== TOWN.letter);
      sim.world.phase = 'night';
      morning(sim);
      if (sim.world.flags.includes(TOWN.letterSent)) letterDays.push(day);
    }
    expect(letterDays).toEqual([8, 11]);
    // Au salon: entrer, chacun au fauteuil (gratuit), puis la scène à deux.
    const s = town(TUESDAY, 10 * H);
    s.world.quests = s.world.quests.filter((q) => q.id !== TOWN.cutQuest);
    s.world.flags = s.world.flags.filter((f) => f !== TOWN.salonOpen);
    walk(s, {}, 0.1);
    expect(s.world.quests.find((q) => q.id === TOWN.cutQuest)?.status).toBe('active');
    for (const c of s.world.characters) placeCharacter(s, c, at(s, 'salon_inside'));
    walk(s, {}, 0.1);
    const purse = s.world.purse;
    sitChair(s, 'p1');
    send(s, 'p1', { type: 'haircut', hair: 7, hairColor: 5, beard: 2 });
    expect(s.world.purse).toBe(purse);
    expect(s.world.scene).toBeNull();
    sitChair(s, 'p2');
    const p2 = character(s, 'p2').appearance;
    send(s, 'p2', { type: 'haircut', hair: p2.hair, hairColor: p2.hairColor, beard: p2.beard });
    for (const c of s.world.characters) placeCharacter(s, c, at(s, 'salon_inside'));
    walk(s, {}, 0.2);
    expect(s.world.scene?.dialogue).toBe('solange_mirror');
    for (let i = 0; i < 12 && s.world.scene !== null; i++) {
      const scene = s.world.scene;
      for (const id of ['p1', 'p2'] as const) {
        send(s, id, scene.choices.length > 0 ? { type: 'dialogue_choice', choice: 'suits' } : { type: 'dialogue_next' });
      }
    }
    walk(s, {}, 0.2);
    expect(dialogueDone(s.world.dialoguesDone, 'solange_mirror')).toBe(true);
    expect(s.world.quests.find((q) => q.id === TOWN.cutQuest)?.status).toBe('done');
    expect(s.world.flags).toContain(TOWN.salonOpen);
  });
});

describe("demandes de l'interface (lot L6)", () => {
  it('rideaux à une fenêtre: un verbe de visée, et Espace les ferme puis les rouvre', () => {
    const sim = town(TUESDAY, 10 * H);
    const c = character(sim, 'p1');
    sim.world.furniture.push({ id: 'f-rideaux', item: 'curtains', cell: { cx: 10, cy: 25 }, rotation: 2, placedBy: 'p1', window: 'window_1' });
    placeCharacter(sim, c, { x: 9.5, y: 24.5 });
    c.facing = Math.atan2(25.5 - 24.5, 10.5 - 9.5);
    walk(sim, {}, 0.05);
    expect(c.aim?.verb).toBe('curtains');
    send(sim, 'p1', { type: 'act' });
    expect(sim.world.furniture.find((f) => f.id === 'f-rideaux')?.closed).toBe(true);
    send(sim, 'p1', { type: 'act' });
    expect(sim.world.furniture.find((f) => f.id === 'f-rideaux')?.closed).toBeUndefined();
  });

  it('salon: au fauteuil on choisit pour soi; sur le banc, le même panneau propose à l’autre, qui répond', () => {
    const sim = town(TUESDAY, 10 * H);
    const [a, b] = sim.world.characters;
    if (a === undefined || b === undefined) return;
    for (const c of [a, b]) placeCharacter(sim, c, at(sim, 'salon_inside'));
    placeCharacter(sim, a, { x: 70.5, y: 30.5 });
    walk(sim, {}, 0.1);
    send(sim, 'p1', { type: 'menu', menu: 'salon' });
    expect(atSalonChair(a)).toBe(true);
    placeCharacter(sim, b, { x: 72.5, y: 29.6 });
    send(sim, 'p2', { type: 'menu', menu: 'salon' });
    expect(b.menu).toBe('salon');
    expect(atSalonChair(b)).toBe(false);
    send(sim, 'p2', { type: 'hair_offer', hair: 9, hairColor: 2, beard: 1 });
    expect(a.hairOffer?.hair).toBe(9);
    // Qui est sur le banc ne coupe rien.
    send(sim, 'p2', { type: 'haircut', hair: 3, hairColor: 3, beard: 0 });
    expect(b.appearance.hair).not.toBe(3);
    send(sim, 'p1', { type: 'hair_offer_answer', accept: false });
    expect(a.hairOffer).toBeNull();
    expect(firstCutFree(sim.world, 'p1')).toBe(false);
    expect(bakeryBoughtToday(sim.world, 'p1')).toEqual({ bread: 0, brioche: 0 });
  });

  it('pendant la sieste, le carnet s’ouvre et se ferme sans réveiller', () => {
    const sim = town(TUESDAY, 13 * H);
    const c = character(sim, 'p1');
    c.status = 'sleeping';
    c.needs.napStart = TUESDAY * 24 * H + 13 * H;
    send(sim, 'p1', { type: 'menu', menu: 'notebook' });
    expect(c.menu).toBe('notebook');
    expect(c.status).toBe('sleeping');
    send(sim, 'p1', { type: 'menu', menu: null });
    expect(c.menu).toBeNull();
  });
});

describe('retouches de la carte (décisions du manager)', () => {
  it('la poule commandée arrive là où la cage est dessinée, hors de la clôture et de tout obstacle', () => {
    const sim = town(TUESDAY, 10 * H);
    const before = sim.world.hens.length;
    sim.world.hens = sim.world.hens.slice(0, Math.min(before, 2));
    deliverWeeklyItem(sim, 'hen_extra', 'p1');
    const hen = sim.world.hens.at(-1);
    const coop = at(sim, 'chicken_coop');
    expect(hen?.pos).toEqual({ x: coop.x + HEN_DROP.x, y: coop.y + HEN_DROP.y });
    if (hen === undefined) return;
    expect(isBlockedCell(refreshBlockers(sim), Math.floor(hen.pos.x), Math.floor(hen.pos.y))).toBe(false);
    const fence = sim.map.props.find((p) => p.id === 'fence_15');
    if (fence !== undefined && fence.rect !== null) expect(inRect(fence.rect, hen.pos.x, hen.pos.y)).toBe(false);
  });

  it("Odette se tient derrière son guichet (elle y entre par la porte); on lui parle et on achète depuis la place du client", () => {
    const sim = town(TUESDAY, 6 * H + 50);
    const odette = sim.world.villagers.find((v) => v.id === 'odette');
    if (odette === undefined) throw new Error('Odette');
    // 7 h: elle quitte sa porte et passe la porte de la boutique jusqu'à son guichet.
    walk(sim, {}, 30);
    const counter = at(sim, 'grocery_inside_counter');
    expect(odette.target).toBe('grocery_inside_counter');
    expect(odette.pos).toEqual(counter);
    expect(odette.inside).toBe('grocery');
    const c = character(sim, 'p1');
    placeCharacter(sim, c, at(sim, 'grocery_customer'));
    c.facing = Math.atan2(counter.y - c.pos.y, counter.x - c.pos.x);
    send(sim, 'p1', { type: 'move_to', target: { kind: 'villager', villager: 'odette' }, act: true });
    expect(c.dialogue?.villager ?? (c.status === 'dialogue' ? 'odette' : null)).toBe('odette');
    send(sim, 'p1', { type: 'dialogue_close' });
    c.status = 'active';
    c.dialogue = null;
    const purse = sim.world.purse;
    const customer = at(sim, 'grocery_customer');
    send(sim, 'p1', { type: 'move_to', target: { kind: 'ground', x: customer.x, y: customer.y }, act: true });
    expect(c.menu).toBe('shop');
    send(sim, 'p1', { type: 'buy', item: 'radish_seed', count: 1 });
    expect(sim.world.purse).toBeLessThan(purse);
  });
});

describe('chocolat chaud, souhaits et création (sections 1.5, 1.6, 2.2)', () => {
  it("chocolat chaud à la petite table: l'automne ou la pluie, jusqu'à 18 h, une tasse par jour, 5 sous", () => {
    const sim = town(AUTUMN_MONDAY, 15 * H);
    const c = character(sim, 'p1');
    placeCharacter(sim, c, { x: 26.5, y: 29.5 });
    walk(sim, {}, 0.1);
    const purse = sim.world.purse;
    send(sim, 'p1', { type: 'move_to', target: { kind: 'ground', x: 26.5, y: 30.5 }, act: true });
    expect(sim.world.purse).toBe(purse - 5);
    expect(sim.world.countersToday.p1[TOWN.chocolate]).toBe(1);
    send(sim, 'p1', { type: 'move_to', target: { kind: 'ground', x: 26.5, y: 30.5 }, act: true });
    expect(sim.world.purse).toBe(purse - 5);
    const summer = town(TUESDAY, 15 * H);
    placeCharacter(summer, character(summer, 'p1'), { x: 26.5, y: 29.5 });
    send(summer, 'p1', { type: 'move_to', target: { kind: 'ground', x: 26.5, y: 30.5 }, act: true });
    expect(summer.world.countersToday.p1[TOWN.chocolate]).toBeUndefined();
    const rain = town(TUESDAY, 15 * H, 'rain');
    placeCharacter(rain, character(rain, 'p1'), { x: 26.5, y: 29.5 });
    send(rain, 'p1', { type: 'move_to', target: { kind: 'ground', x: 26.5, y: 30.5 }, act: true });
    expect(rain.world.countersToday.p1[TOWN.chocolate]).toBe(1);
  });

  it('souhaits: le sablier et le peigne paraissent au catalogue une fois le souhait entendu', () => {
    const sim = town(TUESDAY, 10 * H, 'sunny', [TOWN.achilleWish, TOWN.solangeWish]);
    const offers = (): string[] => catalogueOffers(sim.content.settings, sim.content, sim.world).map((o) => o.item);
    expect(offers()).not.toContain('hourglass');
    sim.world.dialoguesDone.push('achille_wish', 'solange_wish');
    expect(offers()).toEqual(expect.arrayContaining(['hourglass', 'horn_comb']));
  });

  it('création: couleur des cheveux et barbe appliquées, coupes de la création seulement (12)', () => {
    const sim = newSim();
    step(sim, {
      controls: {},
      intents: [
        { by: 'p1', intent: { type: 'create_character', name: 'Camille', hair: 14, outfit: 0, hairColor: 6, beard: 3 } },
        { by: 'p2', intent: { type: 'create_character', name: 'Sacha', hair: 4, outfit: 1, hairColor: 99 } },
      ],
    });
    expect(character(sim, 'p1').appearance).toMatchObject({ hair: 11, hairColor: 6, beard: 3 });
    expect(character(sim, 'p2').appearance).toMatchObject({ hair: 4, hairColor: 7, beard: 0 });
  });
});
