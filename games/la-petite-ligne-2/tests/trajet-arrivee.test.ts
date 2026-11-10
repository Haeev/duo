// Heure d'arrivée d'un trajet (décision du client: « on arrive toujours au matin » après le train
// de nuit). La règle est dans les données de l'effet `travel_to`; le moteur ne nomme aucun lieu.
import { describe, expect, it } from 'vitest';
import { loadContent, type Content } from '../src/donnees/charger';
import type { TripArrival } from '../src/donnees/schemas/trajet';
import type { GameEvent } from '../src/simulation/noyau/evenements';
import { createWorld } from '../src/simulation/noyau/monde';
import { createSim, type Sim } from '../src/simulation/noyau/pas';
import { gameDataFiles, MEMBERS, SEED } from './aides';
import { run, send } from './aides-noyau';

const PROLOGUE = 'train-de-nuit';
const QUEST = 'terminus';

/** Le jeu réel; `arrival` remplace la règle du dernier effet du prologue (exemplaire factice). */
function contentWith(arrival?: TripArrival | null): Content {
  const files = gameDataFiles();
  if (arrival !== undefined) {
    const quest = files[`lieux/${PROLOGUE}/quetes/${QUEST}.json`] as {
      chapters: { steps: { onDone: Record<string, unknown>[] }[] }[];
    };
    const effect = quest.chapters
      .flatMap((c) => c.steps)
      .flatMap((s) => s.onDone)
      .find((e) => e.type === 'travel_to');
    if (effect === undefined) throw new Error('départ du prologue absent');
    if (arrival === null) delete effect.arrival;
    else effect.arrival = arrival;
  }
  return loadContent(files);
}

/** Le prologue à sa dernière étape, à `minutes` du jour `day`, les deux joueurs à la porte. */
function atTheDoor(content: Content, minutes: number, day: number): Sim {
  const sim = createSim(content, createWorld(content, SEED, MEMBERS));
  run(sim, 0.2);
  const steps = content.places[PROLOGUE]?.quests[QUEST]?.chapters.flatMap((c) =>
    c.steps.map((s) => s.id),
  );
  if (steps === undefined) throw new Error('prologue absent');
  sim.world.progress.quests[QUEST] = {
    chapter: 'prologue',
    step: 'descendre',
    done: false,
    passed: steps.slice(0, -1),
  };
  const story = sim.world.common.story;
  if (story !== undefined) story.scene = null;
  sim.world.minutes = minutes;
  sim.world.common.day = day;
  const door = content.places[PROLOGUE]?.map.points.porte;
  if (door === undefined) throw new Error('porte absente');
  sim.world.players[0].body = { x: door.x - 0.3, y: door.y, facing: 0, speed: 0 };
  sim.world.players[1].body = { x: door.x + 0.3, y: door.y, facing: 0, speed: 0 };
  return sim;
}

/** Joue jusqu'à la descente sur le quai d'arrivée; renvoie les événements. */
function ride(sim: Sim): GameEvent[] {
  const events: GameEvent[] = [];
  for (
    let i = 0;
    i < 40 && (sim.world.common.place === PROLOGUE || sim.world.common.phase !== 'day');
    i++
  ) {
    const to = sim.world.common.travel?.to;
    if (sim.world.common.phase === 'travel' && to !== undefined)
      for (const p of [0, 1] as const)
        events.push(...send(sim, p, { type: 'place_loaded', place: to }));
    events.push(...run(sim, 1));
  }
  expect(sim.world.common.place).toBe('aubrune');
  expect(sim.world.common.phase).toBe('day');
  return events;
}

/** L'heure d'arrivée, à la descente près (une seconde de jeu: moins de deux minutes). */
function expectHour(sim: Sim, minute: number): void {
  expect(sim.world.minutes).toBeGreaterThanOrEqual(minute);
  expect(sim.world.minutes).toBeLessThan(minute + 2);
}

describe('heure d’arrivée d’un trajet', () => {
  it('train de nuit sans avoir dormi: le lendemain à 8 h, avec une nuit douce à bord', () => {
    const sim = atTheDoor(contentWith(), 23 * 60, 1);
    for (const p of sim.world.players)
      Object.assign(p.needs, { hunger: 90, sleep: 30, hygiene: 80 });
    const events = ride(sim);
    expect(sim.world.common.day).toBe(2);
    expectHour(sim, 8 * 60);
    expect(events).toContainEqual({ type: 'day_started', day: 2, slept: true });
    for (const p of sim.world.players) {
      // Sommeil de la couchette (85), faim et hygiène d'une nuit (moins 15 et moins 10).
      expect(p.needs.sleep).toBeGreaterThan(84);
      expect(p.needs.hunger).toBeGreaterThan(73);
      expect(p.needs.hunger).toBeLessThan(76);
      expect(p.needs.hygiene).toBeGreaterThan(69);
      expect(p.needs.hygiene).toBeLessThan(71);
    }
  });

  it('train de nuit après avoir dormi (réveil à 6 h): 8 h le même jour, la nuit n’est pas comptée deux fois', () => {
    const sim = atTheDoor(contentWith(), 6 * 60, 2);
    for (const p of sim.world.players)
      Object.assign(p.needs, { hunger: 80, sleep: 95, hygiene: 80 });
    const events = ride(sim);
    expect(sim.world.common.day).toBe(2);
    expectHour(sim, 8 * 60);
    expect(events.some((e) => e.type === 'day_started')).toBe(false);
    for (const p of sim.world.players) {
      expect(p.needs.sleep).toBeGreaterThan(94);
      expect(p.needs.hunger).toBeGreaterThan(79);
    }
  });

  it('train de nuit parti au milieu de la nuit (2 h): même arrivée, même nuit à bord', () => {
    const sim = atTheDoor(contentWith(), 2 * 60, 2);
    const events = ride(sim);
    expect(sim.world.common.day).toBe(3);
    expectHour(sim, 8 * 60);
    expect(events).toContainEqual({ type: 'day_started', day: 3, slept: true });
  });

  it('exemplaire factice: une heure fixe ou une durée déclarée dans les données, sans code', () => {
    const fixed = atTheDoor(contentWith({ kind: 'at', minute: 10 * 60 }), 23 * 60, 1);
    ride(fixed);
    expect(fixed.world.common.day).toBe(2);
    expectHour(fixed, 10 * 60);
    const hours = atTheDoor(contentWith({ kind: 'hours', hours: 3 }), 20 * 60, 1);
    ride(hours);
    expectHour(hours, 23 * 60);
    // Sans règle: `travel.clockHours` de `reglages.json`.
    const plain = contentWith(null);
    const sim = atTheDoor(plain, 12 * 60, 1);
    ride(sim);
    expectHour(sim, 12 * 60 + plain.settings.travel.clockHours * 60);
  });
});
