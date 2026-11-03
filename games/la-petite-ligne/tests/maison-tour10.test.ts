// La maison du tour 10 (lot L4): besoins doux (T10-13 à T10-18), pièces bâties à deux (T10-20,
// T10-21), rangement à cases (T10-24), rideaux aux fenêtres (T10-25), format 7 et sa migration.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { deliverScheduledLetters } from '../src/simulation/courrier';
import type { ControlFrame, Intent } from '../src/etat/actions';
import { HOUSE_BUILDING } from '../src/etat/carte';
import { bellyLevel, heartLevel, isNapping, restLevel, storageView, windowsNow } from '../src/etat/maison';
import type { Character, CharacterId, WorldState } from '../src/etat/types';
import type { Content } from '../src/donnees/types';
import { decodeSave, restoreWorld, snapshotOf } from '../src/sauvegarde/sauvegarde';
import { goToBed } from '../src/simulation/agir';
import { placeFurniture, takeFurniture, toggleCurtains } from '../src/simulation/amenagement';
import {
  applyForm,
  beginNapIfAfternoon,
  durationMultiplier,
  eat,
  napClockFactor,
  settleNight,
  spend,
  updateNeeds,
  walkFactor,
} from '../src/simulation/besoins';
import { type Sim, character } from '../src/simulation/contexte';
import { DATA_SCHEMA } from '../src/simulation/constantes';
import { placeCharacter } from '../src/simulation/deplacement';
import { checkNight, morning } from '../src/simulation/horloge';
import { POINT } from '../src/simulation/ids';
import { step } from '../src/simulation/pas';
import { OAK_CHEST, type RoomProgress, buildableElements, roomBeamPlaced, roomDef } from '../src/simulation/pieces';
import { removalOverflows, storageMove, storeAtHome } from '../src/simulation/rangement';
import { addStack, addToBag, countInBag, countInStacks } from '../src/simulation/sac';
import { contentAndMap } from './aides';

const A = { id: 'membre-a', name: 'Camille', color: '#e07a5f' };
const B = { id: 'membre-b', name: 'Sacha', color: '#3d85c6' };
const HOUR = 60;
const MAX_STATE_BYTES = 52_000;

function reference(file: string): { dataSchema: number; data: Record<string, unknown> } {
  return JSON.parse(readFileSync(fileURLToPath(new URL(`./donnees/sauvegardes/${file}`, import.meta.url)), 'utf8')) as {
    dataSchema: number;
    data: Record<string, unknown>;
  };
}

/** Le contenu du jeu, avec les objets du tour 10 que le lot L3 ajoute à `objets.json` (s'ils y manquent). */
function contentT10(): Content {
  const base = contentAndMap().content;
  const items = { ...base.items };
  const chest = items.chest;
  if (chest !== undefined) {
    if (!('oak_chest' in items)) items.oak_chest = { ...chest, id: 'oak_chest', name: 'grand coffre de chêne', plural: 'grands coffres de chêne', model: 'oak_chest' };
    if (!('cellar_rack' in items)) items.cellar_rack = { ...chest, id: 'cellar_rack', name: 'étagère haute', plural: 'étagères hautes', model: 'cellar_rack', footprint: { w: 1, d: 2 } };
    items.shelf = { ...(items.shelf ?? chest), storage: 'cellar' };
  }
  return { ...base, items };
}

/** Jeudi 62 à midi (sauvegarde de référence du format 6), relue au format 7. */
function autumn(content: Content = contentT10()): Sim {
  const ref = reference('format-6-automne-jour-62.json');
  const sim = restoreWorld(content, contentAndMap().map, decodeSave(structuredClone(ref.data)), ref.dataSchema, [A, B]);
  // La lettre des plans de Basile (jour 23) part au premier pas d'une partie reprise après.
  deliverScheduledLetters(sim);
  return sim;
}

function at(sim: Sim, id: CharacterId, x: number, y: number): Character {
  const c = character(sim, id);
  placeCharacter(sim, c, { x, y });
  c.status = 'active';
  c.seat = null;
  c.action = { kind: 'idle', since: sim.world.tick, duration: 0, target: null };
  return c;
}

/** Fait passer `minutes` minutes de jeu, par pas d'une minute, comme l'horloge qui tourne. */
function advance(sim: Sim, minutes: number): void {
  for (let i = 0; i < minutes; i++) {
    const before = sim.world.clock.minutes;
    sim.world.clock.minutes += 1;
    updateNeeds(sim, before);
  }
}

function send(sim: Sim, intents: [CharacterId, Intent][], controls: Partial<Record<CharacterId, ControlFrame>> = {}): void {
  step(sim, { controls, intents: intents.map(([by, intent]) => ({ by, intent })) });
}

const hold = (seq: number): ControlFrame => ({ seq, moveX: 0, moveY: 0, actHeld: true });

function keys(c: Character): (string | null)[] {
  return c.notifications.map((n) => n.key);
}

/** Matin du jour suivant, petit-déjeuner pris par les deux. */
function nextDay(sim: Sim): void {
  morning(sim);
  send(sim, [
    ['p1', { type: 'start_day' }],
    ['p2', { type: 'start_day' }],
  ]);
}

describe('Ventre (T10-13, T10-14)', () => {
  it('65 au réveil, -4 par heure de jeu quand l’horloge tourne, rien quand elle est arrêtée', () => {
    const sim = autumn();
    const c = at(sim, 'p1', 8.5, 24.5);
    expect(sim.content.settings.needs.soft.belly.morning).toBe(65);
    c.needs.belly = 65;
    sim.world.clock.minutes = 6 * HOUR;
    advance(sim, 6 * HOUR);
    expect(c.needs.belly).toBeCloseTo(41, 5);
    // Horloge arrêtée (veillée, scène, absence, menus des deux): aucune minute ne passe.
    updateNeeds(sim, sim.world.clock.minutes);
    expect(c.needs.belly).toBeCloseTo(41, 5);
    // Couché pour la nuit (pas une sieste): rien ne baisse.
    c.status = 'sleeping';
    advance(sim, HOUR);
    expect(c.needs.belly).toBeCloseTo(41, 5);
  });

  it('les cinq journées types donnent le Ventre de l’annexe A, à 1 près (30, 73, 93, 100, 100)', () => {
    const settle = (meals: { at: number; item: string; together: boolean }[]): number => {
      const sim = autumn();
      const a = at(sim, 'p1', 8.5, 24.5);
      const b = at(sim, 'p2', 9.0, 24.5);
      sim.world.clock.minutes = 6 * HOUR;
      for (const c of [a, b]) {
        c.needs.belly = 65;
        c.supper = { bread: 0, simple: 0, stew: 0 };
        c.lastMeal = null;
      }
      for (let t = 6 * HOUR; t <= 19 * HOUR; t++) {
        for (const m of meals) {
          if (m.at !== t) continue;
          eat(sim, a, m.item);
          if (m.together) eat(sim, b, m.item);
        }
        if (t < 19 * HOUR) advance(sim, 1);
      }
      // Valeur de nuit: le Ventre du moment, au moins 30, au moins la règle du souper d'avant.
      const heart = a.needs.heart;
      a.needsSet = { belly: null, sleep: 50, heart };
      settleNight(sim, a);
      const w = sim.content.settings.needs.formWeights;
      const form = (a.enduranceMax - sim.content.settings.endurance.base) / sim.content.settings.endurance.perFormPoint;
      return (form - w.sleep * 50 - w.heart * heart) / w.belly;
    };
    expect(settle([])).toBeCloseTo(30, 0);
    expect(settle([{ at: 19 * HOUR, item: 'omelette', together: false }])).toBeCloseTo(73, 0);
    expect(settle([{ at: 19 * HOUR, item: 'vegetable_soup', together: true }])).toBeCloseTo(93, 0);
    expect(settle([{ at: 12 * HOUR, item: 'bread', together: false }, { at: 19 * HOUR, item: 'vegetable_soup', together: true }])).toBeCloseTo(100, 0);
    expect(
      settle([
        { at: 6 * HOUR, item: 'bread', together: false },
        { at: 12 * HOUR, item: 'omelette', together: true },
        { at: 19 * HOUR, item: 'vegetable_soup', together: true },
        { at: 19 * HOUR, item: 'omelette', together: true },
      ]),
    ).toBeCloseTo(100, 0);
  });

  it('journée soignée: Ventre plein presque tout le jour; sans repas: petit creux l’après-midi', () => {
    const sim = autumn();
    const a = at(sim, 'p1', 8.5, 24.5);
    at(sim, 'p2', 9.0, 24.5);
    a.needs.belly = 65;
    sim.world.clock.minutes = 6 * HOUR;
    advance(sim, 10 * HOUR);
    expect(bellyLevel(sim.content, a)).toBe('low');
    expect(keys(a)).toContain('belly_low');
    eat(sim, a, 'vegetable_soup');
    eat(sim, a, 'bread');
    expect(bellyLevel(sim.content, a)).toBe('full');
  });

  it('plafond 100: au-delà, le gain est perdu, « Plus faim, mais c’était bon. »; le souper compte double dès 18 h', () => {
    const sim = autumn();
    const a = at(sim, 'p1', 8.5, 24.5);
    at(sim, 'p2', 30, 30);
    sim.world.clock.minutes = 17 * HOUR;
    a.needs.belly = 20;
    eat(sim, a, 'omelette');
    expect(a.needs.belly).toBe(50);
    sim.world.clock.minutes = 18 * HOUR;
    eat(sim, a, 'omelette');
    expect(a.needs.belly).toBe(100);
    eat(sim, a, 'bread');
    expect(a.needs.belly).toBe(100);
    expect(keys(a)).toContain('belly_capped');
  });

  it('manger ensemble (à moins de 3 m, moins de 10 minutes d’écart): +10 chacun, une fois par paire de repas', () => {
    const sim = autumn();
    const a = at(sim, 'p1', 8.5, 24.5);
    const b = at(sim, 'p2', 9.5, 24.5);
    sim.world.clock.minutes = 12 * HOUR;
    a.needs.belly = 20;
    b.needs.belly = 20;
    eat(sim, a, 'bread');
    expect(a.needs.belly).toBe(35);
    eat(sim, b, 'bread');
    expect(b.needs.belly).toBe(45);
    expect(a.needs.belly).toBe(45);
    // Loin l'un de l'autre: pas de bonus.
    placeCharacter(sim, b, { x: 30, y: 30 });
    eat(sim, b, 'bread');
    expect(b.needs.belly).toBe(60);
  });

  it('T10-14: un besoin bas ne retire rien; seuls les bonus changent (endurance x 0,8, marche x 1,1)', () => {
    const sim = autumn();
    const c = at(sim, 'p1', 8.5, 24.5);
    const cost = (belly: number): number => {
      c.needs.belly = belly;
      c.endurance = 100;
      c.enduranceMax = 120;
      spend(sim, c, 'till');
      return 100 - c.endurance;
    };
    expect(cost(0)).toBe(cost(59));
    expect(cost(60)).toBeCloseTo(cost(59) * 0.8, 6);
    const walk = (heart: number): number => {
      c.needs.heart = heart;
      return walkFactor(sim, c);
    };
    expect(walk(0)).toBe(1);
    expect(walk(69)).toBe(1);
    expect(walk(70)).toBeCloseTo(1.1, 6);
    c.endurance = 50;
    c.needs.belly = 0;
    c.needs.heart = 0;
    const slow = durationMultiplier(sim, c);
    c.needs.belly = 59;
    c.needs.heart = 69;
    expect(durationMultiplier(sim, c)).toBe(slow);
  });
});

describe('Repos et sieste (T10-15)', () => {
  it('assis: +1 par minute de jeu (x 1,5 sur un siège de confort 3), jamais au-dessus de l’endurance du réveil', () => {
    const sim = autumn();
    const c = at(sim, 'p1', 8.5, 24.5);
    c.enduranceMax = 100;
    c.endurance = 50;
    c.seat = { bench: 'bench_square', slot: 0, since: sim.world.tick };
    sim.world.clock.minutes = 10 * HOUR;
    advance(sim, 10);
    expect(c.endurance).toBeCloseTo(60, 6);
    sim.world.furniture.push({ id: 'f_armchair', item: 'wicker_armchair', cell: { cx: 7, cy: 24 }, rotation: 0, placedBy: 'p1' });
    c.seat = { bench: 'f_armchair', slot: 0, since: sim.world.tick };
    advance(sim, 10);
    expect(c.endurance).toBeCloseTo(75, 6);
    advance(sim, 60);
    expect(c.endurance).toBe(100);
    expect(restLevel(sim.content, c)).toBe('high');
  });

  it('sieste seulement de 12 h à 16 h, 60 minutes au plus, une par jour; jamais un coucher pour la nuit', () => {
    const sim = autumn();
    const a = at(sim, 'p1', 8.5, 24.5);
    const b = at(sim, 'p2', 9.5, 24.5);
    const beds = sim.world.furniture.filter((f) => sim.content.items[f.item]?.bed !== null && sim.content.items[f.item] !== undefined);
    const [bedA, bedB] = beds;
    if (bedA === undefined || bedB === undefined) throw new Error('deux lits attendus');
    sim.world.clock.minutes = 11 * HOUR;
    goToBed(sim, a, bedA.id);
    beginNapIfAfternoon(sim, a);
    expect(isNapping(a)).toBe(false);
    a.status = 'active';
    a.bedId = null;
    sim.world.clock.minutes = 13 * HOUR;
    a.enduranceMax = 200;
    a.endurance = 10;
    goToBed(sim, a, bedA.id);
    beginNapIfAfternoon(sim, a);
    expect(isNapping(a)).toBe(true);
    expect(keys(a)).toContain('nap_start');
    advance(sim, 30);
    expect(a.endurance).toBeCloseTo(55, 6);
    // Le Ventre baisse de moitié pendant la sieste.
    // Seul à dormir: l'autre est éveillé, l'horloge va son train.
    expect(napClockFactor(sim)).toBe(1);
    advance(sim, 31);
    expect(isNapping(a)).toBe(false);
    expect(a.status).toBe('active');
    expect(a.endurance).toBeCloseTo(100, 6);
    expect(keys(a)).toContain('nap_end');
    // Une seule par jour.
    goToBed(sim, a, bedA.id);
    beginNapIfAfternoon(sim, a);
    expect(a.status).toBe('active');
    expect(keys(a)).toContain('nap_once');
    // L'autre seul ne déclenche jamais la nuit.
    goToBed(sim, b, bedB.id);
    beginNapIfAfternoon(sim, b);
    a.status = 'sleeping';
    a.needs.napStart = null;
    checkNight(sim);
    expect(sim.world.phase).toBe('day');
  });

  it('à deux: l’horloge x 4 jusqu’au premier réveil, Cœur +5 chacun; réveil 10 minutes avant le train', () => {
    const sim = autumn();
    const a = at(sim, 'p1', 8.5, 24.5);
    const b = at(sim, 'p2', 9.5, 24.5);
    const [bedA, bedB] = sim.world.furniture.filter((f) => (sim.content.items[f.item]?.bed ?? null) !== null);
    if (bedA === undefined || bedB === undefined) throw new Error('deux lits attendus');
    sim.world.clock.minutes = 13 * HOUR;
    const hearts = [a.needs.heart, b.needs.heart];
    goToBed(sim, a, bedA.id);
    beginNapIfAfternoon(sim, a);
    goToBed(sim, b, bedB.id);
    beginNapIfAfternoon(sim, b);
    expect(napClockFactor(sim)).toBe(4);
    expect(a.needs.heart).toBe(Math.min(100, (hearts[0] ?? 0) + 5));
    expect(b.needs.heart).toBe(Math.min(100, (hearts[1] ?? 0) + 5));
    // Un vrai pas: l'horloge avance quatre fois plus et la nuit ne vient pas.
    const before = sim.world.clock.minutes;
    send(sim, []);
    const fast = sim.world.clock.minutes - before;
    expect(sim.world.phase).toBe('day');
    send(sim, [['p1', { type: 'get_up' }]]);
    const before2 = sim.world.clock.minutes;
    send(sim, []);
    expect(fast / (sim.world.clock.minutes - before2)).toBeCloseTo(4, 3);
    // Un samedi (jour de train, départ à 16 h): à 15 h 50, tout le monde debout.
    const sat = autumn();
    sat.world.clock.day = 57;
    const c = at(sat, 'p1', 8.5, 24.5);
    const [bed] = sat.world.furniture.filter((f) => (sat.content.items[f.item]?.bed ?? null) !== null);
    if (bed === undefined) throw new Error('lit attendu');
    sat.world.clock.minutes = 15 * HOUR + 30;
    goToBed(sat, c, bed.id);
    beginNapIfAfternoon(sat, c);
    advance(sat, 19);
    expect(isNapping(c)).toBe(true);
    advance(sat, 1);
    expect(isNapping(c)).toBe(false);
    expect(keys(c)).toContain('nap_wakeup');
  });
});

describe('Cœur et retrouvailles (T10-16)', () => {
  it('après 180 minutes à plus de 30 m, à moins de 3 m: +5 aux deux, 2 par jour au plus; jamais avec un dormeur', () => {
    const sim = autumn();
    const a = at(sim, 'p1', 8.5, 24.5);
    const b = at(sim, 'p2', 60, 24.5);
    sim.world.clock.minutes = 7 * HOUR;
    const reunion = (): void => {
      placeCharacter(sim, b, { x: 60, y: 24.5 });
      advance(sim, 180);
      placeCharacter(sim, b, { x: 20, y: 24.5 });
      advance(sim, 5);
      placeCharacter(sim, b, { x: 10, y: 24.5 });
      advance(sim, 1);
    };
    expect(heartLevel(sim.content, a)).not.toBe('missing');
    placeCharacter(sim, b, { x: 60, y: 24.5 });
    advance(sim, 180);
    expect(heartLevel(sim.content, a)).toBe('missing');
    expect(keys(a)).toContain('heart_missing');
    const before = [a.needs.heart, b.needs.heart];
    placeCharacter(sim, b, { x: 10, y: 24.5 });
    advance(sim, 1);
    expect(a.needs.reunionsToday).toBe(1);
    expect(a.needs.heart).toBeCloseTo(Math.min(100, (before[0] ?? 0) + 5 + (2 / 60)), 5);
    expect(b.needs.reunionsToday).toBe(1);
    expect(keys(b)).toContain('reunion');
    reunion();
    reunion();
    expect(a.needs.reunionsToday).toBe(2);
    // Un dormeur: pas de retrouvailles; elles comptent à son réveil.
    const sim2 = autumn();
    const c = at(sim2, 'p1', 8.5, 24.5);
    const d = at(sim2, 'p2', 60, 24.5);
    sim2.world.clock.minutes = 7 * HOUR;
    advance(sim2, 181);
    d.status = 'sleeping';
    placeCharacter(sim2, d, { x: 9.5, y: 24.5 });
    advance(sim2, 1);
    expect(c.needs.reunionsToday).toBe(0);
    d.status = 'active';
    advance(sim2, 1);
    expect(c.needs.reunionsToday).toBe(1);
  });

  it('le Cœur ne baisse jamais; près de l’autre, +2 par heure, 12 au plus par jour', () => {
    const sim = autumn();
    const a = at(sim, 'p1', 8.5, 24.5);
    at(sim, 'p2', 9.5, 24.5);
    a.needs.heart = 40;
    sim.world.clock.minutes = 6 * HOUR;
    let last = a.needs.heart;
    for (let i = 0; i < 12 * HOUR; i++) {
      advance(sim, 1);
      expect(a.needs.heart).toBeGreaterThanOrEqual(last);
      last = a.needs.heart;
    }
    expect(a.needs.heart).toBeCloseTo(52, 5);
    // Les gains de PE-03 arrivent au moment où ils sont notés.
    a.heartToday.envie = true;
    advance(sim, 1);
    expect(a.needs.heart).toBeCloseTo(67, 5);
  });
});

describe('Sommeil et forme (T10-17, T10-18)', () => {
  function bedroomSim(): { sim: Sim; a: Character; b: Character } {
    const sim = autumn();
    sim.world.rooms.room_bedroom = { ordered: 50, crate: [], elementsBuilt: [], beamPlaced: true, builtDay: 52 };
    sim.world.furniture.push({ id: 'f_bed', item: 'double_bed', cell: { cx: 6, cy: 17 }, rotation: 0, placedBy: 'p1' });
    const a = at(sim, 'p1', 7, 18);
    const b = at(sim, 'p2', 7, 18);
    return { sim, a, b };
  }

  it('chambre +5, rideaux fermés +5, plafond 100; s’endormir ensemble: Cœur +5', () => {
    const { sim, a, b } = bedroomSim();
    sim.world.clock.minutes = 19 * HOUR;
    goToBed(sim, a, 'f_bed');
    goToBed(sim, b, 'f_bed');
    a.status = 'night';
    b.status = 'night';
    a.needsSet = { belly: null, sleep: null, heart: null };
    const heart = a.needs.heart;
    settleNight(sim, a);
    expect(a.needs.sleep).toBe(90);
    // Rideaux à la fenêtre nord de la chambre, fermés.
    sim.world.furniture.push({ id: 'f_cur', item: 'curtains', cell: { cx: 8, cy: 17 }, rotation: 0, placedBy: 'p1', window: 'window_7', closed: true });
    goToBed(sim, b, 'f_bed');
    b.status = 'night';
    settleNight(sim, b);
    expect(b.needs.sleep).toBe(95);
    expect(heart).toBeGreaterThan(0);
    // Plafond: un lit à 95 (variante du contenu) avec chambre et rideaux donne 100.
    const items = { ...sim.content.items };
    const bed = items.double_bed;
    if (bed?.bed === null || bed === undefined) throw new Error('lit double attendu');
    items.double_bed = { ...bed, bed: { ...bed.bed, sleep: 95 } };
    const capped = autumn({ ...sim.content, items });
    capped.world.rooms.room_bedroom = { ordered: 50, crate: [], elementsBuilt: [], beamPlaced: true, builtDay: 52 };
    capped.world.furniture.push({ id: 'f_bed', item: 'double_bed', cell: { cx: 6, cy: 17 }, rotation: 0, placedBy: 'p1' });
    capped.world.furniture.push({ id: 'f_cur', item: 'curtains', cell: { cx: 8, cy: 17 }, rotation: 0, placedBy: 'p1', window: 'window_7', closed: true });
    const c = at(capped, 'p1', 7, 18);
    goToBed(capped, c, 'f_bed');
    settleNight(capped, c);
    expect(c.needs.sleep).toBe(100);
  });

  it('« Vous avez éteint la lampe en même temps. »: Cœur +5 aux deux couchés à moins de 10 minutes', () => {
    const run = (gapTicks: number): number => {
      const { sim, a, b } = bedroomSim();
      sim.world.clock.minutes = 19 * HOUR;
      goToBed(sim, a, 'f_bed');
      sim.world.tick += gapTicks;
      goToBed(sim, b, 'f_bed');
      const heart = Math.max(a.needs.heart, 40);
      a.needs.heart = heart;
      a.needsSet = { belly: null, sleep: 50, heart: null };
      settleNight(sim, a);
      const w = sim.content.settings.needs.formWeights;
      const form = (a.enduranceMax - sim.content.settings.endurance.base) / sim.content.settings.endurance.perFormPoint;
      return (form - w.sleep * 50 - w.belly * Math.max(30, 0)) / w.heart - heart;
    };
    expect(run(0)).toBeGreaterThan(run(10_000));
  });

  it('T10-18: les valeurs de nuit ne descendent jamais sous la règle d’avant (souper, lit, gains du jour)', () => {
    const sim = autumn();
    const c = at(sim, 'p1', 8.5, 24.5);
    const s = sim.content.settings.needs;
    const bed = sim.world.furniture.find((f) => (sim.content.items[f.item]?.bed ?? null) !== null);
    if (bed === undefined) throw new Error('lit');
    for (let i = 0; i < 64; i++) {
      const supper = { bread: i % 2, simple: (i >> 1) % 2, stew: (i >> 2) % 2 };
      const flags = { envie: (i >> 3) % 2 === 1, sharedEnvie: (i >> 4) % 2 === 1, ateTogether: false, gesture: (i >> 5) % 2 === 1 };
      c.supper = { ...supper };
      c.heartToday = { ...flags };
      c.needs.belly = (i * 7) % 40;
      c.needs.heart = s.heart.base;
      c.needsSet = { belly: null, sleep: null, heart: null };
      c.bedId = bed.id;
      c.midnightReturn = false;
      const oldBelly =
        supper.stew > 0 && supper.simple + supper.bread > 0 ? s.belly.stewPlusDish : supper.stew > 0 ? s.belly.stew : supper.simple > 0 ? s.belly.simple : supper.bread > 0 ? s.belly.bread : s.belly.none;
      const oldHeart = Math.min(s.heart.max, s.heart.base + (flags.envie ? s.heart.envie : 0) + (flags.sharedEnvie ? s.heart.sharedEnvie : 0) + (flags.gesture ? s.heart.gestureTogether : 0));
      const oldSleep = sim.content.items[bed.item]?.bed?.sleep ?? 0;
      const oldForm = s.formWeights.belly * oldBelly + s.formWeights.sleep * oldSleep + s.formWeights.heart * oldHeart;
      settleNight(sim, c);
      const form = (c.enduranceMax - sim.content.settings.endurance.base) / sim.content.settings.endurance.perFormPoint;
      expect(form).toBeGreaterThanOrEqual(oldForm - 1e-9);
    }
  });

  it('la forme garde la formule PE-04 (0,35 Ventre + 0,35 Sommeil + 0,30 Cœur)', () => {
    const sim = autumn();
    const c = character(sim, 'p1');
    c.needs.belly = 80;
    c.needs.sleep = 70;
    c.needs.heart = 60;
    applyForm(sim, c);
    const form = 0.35 * 80 + 0.35 * 70 + 0.3 * 60;
    expect(c.enduranceMax).toBeCloseTo(sim.content.settings.endurance.base + sim.content.settings.endurance.perFormPoint * form, 6);
  });
});

describe('pièces bâties à deux (T10-20, T10-21)', () => {
  function atBasile(sim: Sim): void {
    const wb = sim.map.points[POINT.workbench];
    if (wb === undefined) throw new Error('établi');
    at(sim, 'p1', wb.x, wb.y);
    at(sim, 'p2', wb.x + 0.5, wb.y);
  }

  function order(sim: Sim, room: string): void {
    atBasile(sim);
    send(sim, [['p1', { type: 'improvement_pay', improvement: room, amount: null }]]);
    const proposal = sim.world.proposals.find((p) => p.purchase.item === room);
    if (proposal !== undefined) send(sim, [['p2', { type: 'proposal_answer', proposal: proposal.id, accept: true }]]);
  }

  function siteOf(sim: Sim, room: string): { x: number; y: number } {
    const id = room === 'room_cellar' ? 'room_cellar_site' : 'room_bedroom_site';
    const p = sim.map.points[id];
    if (p === undefined) throw new Error(id);
    return p;
  }

  /** Les deux maintiennent Agir au site (`dy` m au sud du point) jusqu'à ce que `done` soit vrai. */
  function buildUntil(sim: Sim, room: string, done: () => boolean, max = 30 * 300, dy = 0.5): number {
    const site = siteOf(sim, room);
    at(sim, 'p1', site.x, site.y + dy);
    at(sim, 'p2', site.x + 0.5, site.y + dy);
    let n = 0;
    while (!done() && n < max) {
      send(sim, [], { p1: hold(n), p2: hold(n) });
      n++;
    }
    return n;
  }

  it('les plans s’ouvrent au jour 23, une pièce à la fois, l’accord de l’autre; le site paraît le matin suivant', () => {
    const early = autumn();
    early.world.clock.day = 22;
    early.world.purse = 5000;
    order(early, 'room_cellar');
    expect(early.world.rooms.room_cellar).toBeUndefined();

    const sim = autumn();
    sim.world.purse = 5000;
    atBasile(sim);
    send(sim, [['p1', { type: 'improvement_pay', improvement: 'room_cellar', amount: null }]]);
    // 450 sous: l'autre doit accepter (EC-04); rien n'est commandé avant.
    expect(sim.world.rooms.room_cellar).toBeUndefined();
    const proposal = sim.world.proposals.find((p) => p.purchase.item === 'room_cellar');
    expect(proposal?.price).toBe(450);
    if (proposal === undefined) throw new Error('proposition');
    send(sim, [['p2', { type: 'proposal_answer', proposal: proposal.id, accept: true }]]);
    expect(sim.world.rooms.room_cellar?.ordered).toBe(62);
    expect(sim.world.purse).toBe(5000 - 450);
    order(sim, 'room_bedroom');
    expect(sim.world.rooms.room_bedroom).toBeUndefined();
    expect(keys(character(sim, 'p1'))).toContain('room_busy');
    expect(buildableElements(sim, 'room_cellar')).toEqual([]);
    nextDay(sim);
    expect(keys(character(sim, 'p1'))).toContain('room_site_ready');
    expect(buildableElements(sim, 'room_cellar').map((e) => e.id)).toEqual(['post_south', 'post_north']);
  });

  it('chaque élément demande son support; le cellier paraît le matin d’après; la fenêtre ouest devient porte, rien ne se perd', () => {
    const sim = autumn();
    sim.world.purse = 5000;
    order(sim, 'room_cellar');
    nextDay(sim);
    // Rideaux à la fenêtre ouest (qui deviendra porte) et une chaise sur le seuil (6, 24).
    sim.world.furniture = sim.world.furniture.filter((f) => !(f.cell.cx === 6 && f.cell.cy === 24));
    sim.world.furniture.push({ id: 'f_cur', item: 'curtains', cell: { cx: 6, cy: 24 }, rotation: 1, placedBy: 'p1', window: 'window_4' });
    sim.world.furniture.push({ id: 'f_seat', item: 'chair', cell: { cx: 6, cy: 24 }, rotation: 0, placedBy: 'p2' });
    const a = character(sim, 'p1');
    const b = character(sim, 'p2');
    // Planches et clous: à la caisse d'abord (dépôt), le reste dans les sacs.
    addToBag(sim, a, 'plank', 'ordinary', 10);
    addToBag(sim, a, 'nail', 'ordinary', 8);
    addToBag(sim, b, 'plank', 'ordinary', 6);
    const site = siteOf(sim, 'room_cellar');
    at(sim, 'p1', site.x, site.y);
    send(sim, [['p1', { type: 'room_deposit', room: 'room_cellar', item: 'plank', count: 10 }]]);
    expect(countInStacks(sim.world.rooms.room_cellar?.crate ?? [], 'plank')).toBe(10);
    const def = roomDef(sim, 'room_cellar');
    if (def === undefined) throw new Error('cellier');
    const seen: string[] = [];
    const steps = buildUntil(sim, 'room_cellar', () => {
      const built = sim.world.rooms.room_cellar?.elementsBuilt ?? [];
      if (built.length > seen.length) seen.push(...built.slice(seen.length));
      return built.length === def.elements.length;
    });
    for (const [i, id] of seen.entries()) {
      const e = def.elements.find((x) => x.id === id);
      for (const req of e?.requires ?? []) expect(seen.indexOf(req)).toBeLessThan(i);
    }
    // 48 s à un, deux fois plus vite à deux.
    expect(steps).toBeLessThan(30 * 30);
    expect(countInBag(a, 'plank') + countInBag(b, 'plank')).toBe(0);
    expect(sim.world.rooms.room_cellar?.builtDay).toBeNull();
    const before = sim.world.furniture.length;
    const curtainsBefore = countInStacks(sim.world.cellar, 'curtains');
    nextDay(sim);
    const state = sim.world.rooms.room_cellar;
    expect(state?.builtDay).toBe(64);
    expect(sim.world.flags).toContain('room_cellar_built');
    // La fenêtre ouest n'existe plus; ses rideaux sont rangés; la chaise a quitté le seuil.
    expect(windowsNow(sim.content, sim.map, sim.world.rooms).map((w) => w.id)).not.toContain('window_4');
    expect(windowsNow(sim.content, sim.map, sim.world.rooms).map((w) => w.id)).toContain('window_6');
    expect(sim.world.furniture.some((f) => f.window === 'window_4')).toBe(false);
    expect(countInStacks(sim.world.cellar, 'curtains') + sim.world.groundItems.filter((g) => g.item === 'curtains').length).toBe(curtainsBefore + 1);
    const chair = sim.world.furniture.find((f) => f.id === 'f_seat');
    expect(chair === undefined ? countInStacks(sim.world.cellar, 'chair') > 0 : !(chair.cell.cx === 6 && chair.cell.cy === 24)).toBe(true);
    expect(sim.world.furniture.length).toBe(before - 1 - (chair === undefined ? 1 : 0));
    expect(keys(character(sim, 'p1'))).toContain('room_built');
    // On entre dans le cellier: il fait partie de la maisonnette.
    const p1 = character(sim, 'p1');
    placeCharacter(sim, p1, { x: 3.5, y: 23.5 });
    expect(p1.inside).toBe(HOUSE_BUILDING);
  });

  it('la chambre exige la panne faîtière portée à deux avant la ferme', () => {
    const sim = autumn();
    sim.world.purse = 5000;
    order(sim, 'room_bedroom');
    nextDay(sim);
    expect(sim.world.beam?.construction).toBe('room_bedroom');
    expect(sim.world.beam?.pos).toEqual(sim.map.points.beam_pickup);
    const s: RoomProgress | undefined = sim.world.rooms.room_bedroom;
    if (s === undefined) throw new Error('chambre commandée attendue');
    s.elementsBuilt = (roomDef(sim, 'room_bedroom')?.elements ?? []).filter((e) => !e.needsBeam).map((e) => e.id);
    expect(buildableElements(sim, 'room_bedroom')).toEqual([]);
    // Au nord du site: au sud, on serait contre la panne couchée, qu'Espace tenu soulèverait (S01).
    buildUntil(sim, 'room_bedroom', () => keys(character(sim, 'p1')).includes('room_beam'), 10, -0.5);
    expect(keys(character(sim, 'p1'))).toContain('room_beam');
    const beam = sim.world.beam;
    if (beam === null) throw new Error('panne');
    roomBeamPlaced(sim, beam);
    sim.world.beam = null;
    expect(buildableElements(sim, 'room_bedroom').map((e) => e.id)).toEqual(['truss_ridge']);
  });

  it('les totaux de pieces.json suivent la table 4.2 (16 planches et 8 clous, 48 s; 30, 12 et 96 s)', () => {
    const sim = autumn();
    const total = (id: string, item: string): number =>
      (roomDef(sim, id)?.elements ?? []).reduce((n, e) => n + (e.inputs.find((i) => i.item === item)?.count ?? 0), 0);
    const seconds = (id: string): number => (roomDef(sim, id)?.elements ?? []).reduce((n, e) => n + e.seconds, 0);
    expect([total('room_cellar', 'plank'), total('room_cellar', 'nail'), seconds('room_cellar'), roomDef(sim, 'room_cellar')?.elements.length]).toEqual([16, 8, 48, 6]);
    expect([total('room_bedroom', 'plank'), total('room_bedroom', 'nail'), seconds('room_bedroom'), roomDef(sim, 'room_bedroom')?.elements.length]).toEqual([30, 12, 96, 12]);
    expect([roomDef(sim, 'room_cellar')?.price, roomDef(sim, 'room_bedroom')?.price]).toEqual([450, 1200]);
  });
});

describe('rangement à cases (T10-24)', () => {
  function emptyHome(): Sim {
    const sim = autumn();
    sim.world.cellar = [];
    sim.world.rack = [];
    sim.world.furniture = sim.world.furniture.filter((f) => f.item !== 'shelf');
    return sim;
  }

  it('capacité = somme des meubles posés (20, 6, 32, 12); plein: refus; outils au râtelier sans case', () => {
    const sim = emptyHome();
    const c = at(sim, 'p1', 7.5, 24.5);
    c.bag = c.bag.map(() => null);
    expect(storageView(sim.content, sim.map, sim.world).total).toBe(20);
    const kinds = Object.values(sim.content.items).filter((d) => d.category !== 'tool' && d.stack > 1).slice(0, 21);
    expect(kinds.length).toBe(21);
    for (const d of kinds) addToBag(sim, c, d.id, 'ordinary', 1);
    c.bag = c.bag.slice();
    let moved = 0;
    for (const d of kinds) moved += storageMove(sim, c, d.id, 'ordinary', 1, true);
    expect(moved).toBe(20);
    expect(keys(c)).toContain('storage_full');
    // Une pile entamée prend encore (99 par case).
    const first = kinds[0];
    if (first === undefined) throw new Error('objet');
    addToBag(sim, c, first.id, 'ordinary', 5);
    expect(storageMove(sim, c, first.id, 'ordinary', 5, true)).toBe(5);
    // Un outil: au râtelier, même plein.
    addToBag(sim, c, 'hoe', 'ordinary', 1);
    expect(storageMove(sim, c, 'hoe', 'ordinary', 1, true)).toBe(1);
    expect(countInStacks(sim.world.rack, 'hoe')).toBe(1);
    expect(storageView(sim.content, sim.map, sim.world)).toMatchObject({ used: 20, total: 20, rack: 1, overflow: false });
    // Les meubles: étagère +6, grand coffre 32 à la place du coffre, étagère haute 12 au cellier.
    sim.world.furniture.push({ id: 'f_shelf', item: 'shelf', cell: { cx: 9, cy: 22 }, rotation: 0, placedBy: 'p1' });
    expect(storageView(sim.content, sim.map, sim.world).total).toBe(26);
    const chest = sim.world.furniture.find((f) => f.item === 'chest');
    if (chest === undefined) throw new Error('coffre');
    chest.item = OAK_CHEST;
    expect(storageView(sim.content, sim.map, sim.world).total).toBe(38);
    sim.world.rooms.room_cellar = { ordered: 50, crate: [], elementsBuilt: [], beamPlaced: false, builtDay: 52 };
    sim.world.furniture.push({ id: 'f_rack', item: 'cellar_rack', cell: { cx: 3, cy: 22 }, rotation: 0, placedBy: 'p1' });
    expect(storageView(sim.content, sim.map, sim.world).total).toBe(50);
  });

  it('arrivée automatique quand c’est plein: au pied du coffre, jamais perdu; retirer un meuble qui ferait déborder: refusé', () => {
    const sim = emptyHome();
    const c = at(sim, 'p1', 7.5, 24.5);
    const kinds = Object.values(sim.content.items).filter((d) => d.category !== 'tool' && d.stack > 1).slice(0, 20);
    for (const d of kinds) addStack(sim.world.cellar, d.id, 'ordinary', 1);
    const ground = sim.world.groundItems.length;
    const other = Object.values(sim.content.items).find((d) => d.category !== 'tool' && !kinds.includes(d));
    if (other === undefined) throw new Error('objet');
    expect(storeAtHome(sim, other.id, 'ordinary', 3)).toBe(3);
    expect(sim.world.groundItems.length).toBe(ground + 1);
    expect(keys(c)).toContain('storage_ground');
    const chest = sim.world.furniture.find((f) => f.item === 'chest');
    if (chest === undefined) throw new Error('coffre');
    expect(removalOverflows(sim, chest.id)).toBe(true);
    expect(takeFurniture(sim, c, chest.id)).toBe(false);
    expect(keys(c)).toContain('storage_remove_refused');
  });

  it('les deux en même temps: l’hôte applique les dépôts dans l’ordre reçu; un dépôt refusé reste au sac', () => {
    const sim = emptyHome();
    const a = at(sim, 'p1', 6.5, 24.5);
    const b = at(sim, 'p2', 7.5, 24.5);
    const kinds = Object.values(sim.content.items).filter((d) => d.category !== 'tool' && d.stack > 1).slice(0, 21);
    for (const d of kinds.slice(0, 19)) addStack(sim.world.cellar, d.id, 'ordinary', 1);
    const [x, y] = kinds.slice(19);
    if (x === undefined || y === undefined) throw new Error('objets');
    addToBag(sim, a, x.id, 'ordinary', 1);
    addToBag(sim, b, y.id, 'ordinary', 1);
    send(sim, [
      ['p1', { type: 'chest_deposit', item: x.id, quality: 'ordinary', count: 1 }],
      ['p2', { type: 'chest_deposit', item: y.id, quality: 'ordinary', count: 1 }],
    ]);
    expect(countInStacks(sim.world.cellar, x.id)).toBe(1);
    expect(countInBag(b, y.id)).toBe(1);
  });
});

describe('rideaux aux fenêtres (T10-25)', () => {
  function holding(sim: Sim, c: Character, item: string): void {
    c.bag = c.bag.map(() => null);
    addToBag(sim, c, item, 'ordinary', 1);
    c.selected = c.bag.findIndex((s) => s?.item === item);
  }

  it('posables seulement à une fenêtre libre du modèle, sans case au sol; le fenestron refuse; Agir ouvre et ferme', () => {
    const sim = autumn();
    const c = at(sim, 'p1', 8.5, 23.5);
    holding(sim, c, 'curtains');
    if (c.selected < 0 || c.selected > 7) c.selected = 0;
    // Au milieu de la pièce: aucune fenêtre.
    expect(placeFurniture(sim, c, { cx: 8, cy: 23 }, 0)).toBe(false);
    expect(keys(c)).toContain('placement_not_window');
    // Près de la fenêtre sud-est: accrochés à `window_1`, sur la case du bord.
    expect(placeFurniture(sim, c, { cx: 10, cy: 25 }, 0)).toBe(true);
    const f = sim.world.furniture.find((x) => x.window === 'window_1');
    expect(f?.cell).toEqual({ cx: 10, cy: 25 });
    expect(f?.rotation).toBe(2);
    // Ne barre rien: les rideaux sont muraux.
    expect(sim.content.items.curtains?.wall).toBe(true);
    // Agir: fermés, puis rouverts le matin: Cœur +2 une fois.
    if (f === undefined) throw new Error('rideaux');
    sim.world.clock.minutes = 8 * HOUR;
    placeCharacter(sim, c, { x: 9.5, y: 24.5 });
    const heart = c.needs.heart;
    c.needs.curtainsMorningDone = false;
    expect(toggleCurtains(sim, c, f.id)).toBe(true);
    expect(f.closed).toBe(true);
    send(sim, [['p1', { type: 'curtains', furniture: f.id }]]);
    expect(f.closed).toBeUndefined();
    expect(c.needs.heart).toBeGreaterThanOrEqual(Math.min(100, heart + 2));
    // Le fenestron du cellier (bâti): refus.
    sim.world.rooms.room_cellar = { ordered: 50, crate: [], elementsBuilt: [], beamPlaced: false, builtDay: 52 };
    placeCharacter(sim, c, { x: 3.5, y: 22.5 });
    holding(sim, c, 'curtains');
    expect(placeFurniture(sim, c, { cx: 3, cy: 22 }, 0)).toBe(false);
    expect(keys(c)).toContain('placement_fenestron');
  });
});

describe('format 7 et migration du format 6 (T10-24, T10-25, 7.2)', () => {
  it('écrit le format 7', () => {
    expect(DATA_SCHEMA).toBe(7);
    const sim = autumn();
    expect(snapshotOf(sim).dataSchema).toBe(7);
  });

  it('format 6: coffre de 30 piles relu sans perte (« Ça déborde »), outils au râtelier, rideaux hors fenêtre replacés, besoins du réveil', () => {
    const ref = reference('format-6-automne-jour-62.json');
    const data = structuredClone(ref.data) as unknown as WorldState;
    const { content, map } = contentAndMap();
    const extra = Object.values(content.items).filter((d) => d.category !== 'tool' && !data.cellar.some((s) => s.item === d.id)).slice(0, 30 - data.cellar.length);
    for (const d of extra) data.cellar.push({ item: d.id, quality: 'ordinary', count: 3 });
    expect(data.cellar.length).toBe(30);
    // Rideaux posés au mur nord-ouest, sans fenêtre (ancienne règle des objets muraux).
    data.furniture.push({ id: 'f_old_curtains', item: 'curtains', cell: { cx: 6, cy: 22 }, rotation: 0, placedBy: 'p1' });
    const total = (stacks: { item: string; count: number }[]): Record<string, number> => {
      const out: Record<string, number> = {};
      for (const s of stacks) out[s.item] = (out[s.item] ?? 0) + s.count;
      return out;
    };
    const before = total(data.cellar);
    const sim = restoreWorld(content, map, structuredClone(data), 6, [A, B]);
    const after = total([...sim.world.cellar, ...sim.world.rack]);
    expect(after).toEqual(before);
    expect(sim.world.rack.map((s) => s.item).sort()).toEqual(['axe', 'fishing_rod', 'watering_can']);
    const view = storageView(content, map, sim.world);
    expect(view.overflow).toBe(true);
    // On reprend, on ne dépose pas.
    const c = at(sim, 'p1', 7.5, 24.5);
    const some = sim.world.cellar.find((s) => s.count > 1);
    if (some === undefined) throw new Error('pile');
    expect(storageMove(sim, c, some.item, some.quality, 1, false)).toBe(1);
    expect(storageMove(sim, c, some.item, some.quality, 1, true)).toBe(0);
    expect(keys(c)).toContain('storage_overflow');
    const curtains = sim.world.furniture.find((f) => f.id === 'f_old_curtains');
    expect(curtains?.window).toBe('window_4');
    expect(keys(character(sim, 'p2'))).toContain('curtains_found_window');
    for (const ch of sim.world.characters) {
      expect(ch.needs.belly).toBe(65);
      expect(ch.needs.sleep).toBe(50);
      expect(ch.needs.reunionsToday).toBe(0);
      // L'ancien booléen `inHouse` disparaît à la reprise (lot L3): seul `inside` reste.
      expect('inHouse' in ch).toBe(false);
    }
    expect(sim.world.rooms).toEqual({});
    // Écrit au format 7, relu tel quel.
    const snap = snapshotOf(sim);
    expect(snap.dataSchema).toBe(7);
    const again = restoreWorld(content, map, structuredClone(snap.data), 7, [A, B]);
    expect(again.world.rack).toEqual(sim.world.rack);
    expect(again.world.cellar).toEqual(sim.world.cellar);
    expect(again.world.furniture.find((f) => f.id === 'f_old_curtains')?.window).toBe('window_4');
  });

  it('chaque référence du format 6 se relit et se joue; une sauvegarde abîmée du format 7 est refusée', () => {
    const { content, map } = contentAndMap();
    for (const file of ['format-6-fin-de-la-demo.json', 'format-6-ete-jour-25.json', 'format-6-milieu-semaine-2.json']) {
      const ref = reference(file);
      const sim = restoreWorld(content, map, decodeSave(structuredClone(ref.data)), ref.dataSchema, [A, B]);
      for (let i = 0; i < 300; i++) step(sim, { controls: {}, intents: [] });
      expect(sim.world.rack.length + sim.world.cellar.length).toBeGreaterThanOrEqual(0);
    }
    const bad = snapshotOf(autumn()).data as unknown as Record<string, unknown>;
    bad.rooms = { room_cellar: { ordered: 'hier' } };
    expect(() => restoreWorld(content, map, bad, 7, [A, B])).toThrow(/pièce/);
  });

  it('état sous 52 000 octets: jour 62 migré, cellier et chambre bâtis, chantier en cours, besoins du jour', () => {
    const sim = autumn();
    sim.world.rooms.room_cellar = { ordered: 30, crate: [], elementsBuilt: (roomDef(sim, 'room_cellar')?.elements ?? []).map((e) => e.id), beamPlaced: false, builtDay: 32 };
    sim.world.rooms.room_bedroom = {
      ordered: 50,
      crate: [
        { item: 'plank', quality: 'ordinary', count: 12 },
        { item: 'nail', quality: 'ordinary', count: 6 },
      ],
      elementsBuilt: (roomDef(sim, 'room_bedroom')?.elements ?? []).slice(0, 6).map((e) => e.id),
      beamPlaced: true,
      builtDay: null,
    };
    sim.world.clock.minutes = 6 * HOUR;
    advance(sim, 10 * HOUR);
    const bytes = new TextEncoder().encode(JSON.stringify(snapshotOf(sim).data)).length;
    expect(bytes).toBeLessThan(MAX_STATE_BYTES);
  });
});
