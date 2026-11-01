// Moments du tour 7 joués dans la démo (docs/jeux/jeu-1/tour-07-conception.md, fiches 1.4.7 à
// 1.4.9 et critères M-17, M-18): la chevrette aux aguets (« un, deux, trois, soleil »), le
// martin-pêcheur timide, la brume de l'Aubrune (un sur chaque rive, face à face), et les règles
// de tirage qui ne valent qu'après la démo (sans effet sur elle).
import { describe, expect, it } from 'vitest';
import type { ControlFrame } from '../src/etat/actions';
import {
  freezeState,
  momentDef,
  startlePose,
  startleTicks,
  type StartlePose,
} from '../src/etat/moments';
import type { Character, CharacterId, MomentToday, Vec2, WorldEvent } from '../src/etat/types';
import { type Sim, character } from '../src/simulation/contexte';
import { SIM_HZ } from '../src/simulation/constantes';
import { evaluateAll, NO_CONTEXT } from '../src/simulation/conditions';
import { placeCharacter } from '../src/simulation/deplacement';
import {
  cooldownOf,
  dailyChanceOf,
  drawWeight,
  newToday,
  seasonPool,
} from '../src/simulation/moments';
import { step } from '../src/simulation/pas';
import { createRobot, demoLastDay, newSim, play } from './aides';
import { createRandom } from '@duo/sdk/sim';
import soundsFile from '../assets/son/sons.json';
import { parseCatalogue } from '../src/audio/catalogue';
import type { SoundRequest } from '../src/audio/declencheurs';
import { MomentSounds } from '../src/audio/moments';
import { AUDIO_SETTINGS } from '../src/audio/reglages';

/** Jour 1, arrivée finie, les deux libres et dehors. */
function readySim(seed = 5): Sim {
  const sim = newSim(seed);
  play(
    sim,
    createRobot(),
    (s) =>
      s.world.phase === 'day' &&
      s.world.clock.running &&
      s.world.scene === null &&
      s.world.scripts.length === 0,
    SIM_HZ * 600,
  );
  sim.world.beam = null;
  for (const c of sim.world.characters) {
    c.status = 'active';
    c.menu = null;
    c.dialogue = null;
    c.seat = null;
    c.action = { kind: 'idle', since: sim.world.tick, duration: 0, target: null };
  }
  return sim;
}

function setMoment(sim: Sim, id: string, minutes: number): MomentToday {
  const def = momentDef(sim.content, id);
  if (def === null) throw new Error(`moment ${id} absent`);
  sim.world.clock.minutes = minutes;
  const today = newToday(sim, def, 'ambient');
  today.phase = 'waiting';
  today.phaseTick = sim.world.tick;
  sim.world.moments.today = today;
  return today;
}

function place(sim: Sim, id: CharacterId, at: Vec2, lookAt: Vec2 | null = null): Character {
  const c = character(sim, id);
  placeCharacter(sim, c, at);
  if (lookAt !== null) c.facing = Math.atan2(lookAt.y - at.y, lookAt.x - at.x);
  return c;
}

const still = (seq: number): ControlFrame => ({ seq, moveX: 0, moveY: 0, actHeld: false });

function wait(
  sim: Sim,
  seconds: number,
  controls: (i: number) => Partial<Record<CharacterId, ControlFrame>> = (i) => ({
    p1: still(i),
    p2: still(i),
  }),
): WorldEvent[] {
  const events: WorldEvent[] = [];
  for (let i = 0; i < Math.round(seconds * SIM_HZ); i++) {
    step(sim, { controls: controls(i), intents: [] });
    events.push(...sim.events);
  }
  return events;
}

const climaxes = (events: WorldEvent[]): WorldEvent[] =>
  events.filter((e) => e.type === 'moment_climax');

function pointOf(sim: Sim, id: string): Vec2 {
  const p = sim.map.points[id];
  if (p === undefined) throw new Error(`point ${id} absent`);
  return p;
}

/** Pas jusqu'au début du prochain regard de la chevrette (depuis maintenant). */
function ticksToLook(sim: Sim, today: MomentToday): number {
  const def = momentDef(sim.content, today.id);
  const freeze = def?.watch.freeze ?? null;
  if (def === null || freeze === null) throw new Error('chevrette sans « freeze »');
  for (let k = 0; k < SIM_HZ * 60; k++) {
    if (freezeState(def, freeze, today, sim.world.tick + k, sim.world.seed).kind === 'look')
      return k;
  }
  throw new Error('aucun regard en 60 s');
}

describe('la chevrette du pré: « un, deux, trois, soleil » (M-17)', () => {
  it('les deux figés entre 3 et 5,5 m pendant un regard entier: l’apogée part à la fin du regard, pas avant', () => {
    const sim = readySim();
    const today = setMoment(sim, 'roe_deer', 6 * 60 + 10);
    const deer = pointOf(sim, 'roe_deer_graze');
    place(sim, 'p1', { x: deer.x - 4, y: deer.y + 0.5 }, deer);
    place(sim, 'p2', { x: deer.x - 3.5, y: deer.y - 2 }, deer);
    const before = ticksToLook(sim, today);
    expect(before, 'le premier regard vient après l’arrivée (5,3 s)').toBeGreaterThan(5.3 * SIM_HZ);
    expect(
      climaxes(wait(sim, (before + 30) / SIM_HZ)),
      'pas d’apogée pendant qu’elle broute ni à mi-regard',
    ).toEqual([]);
    expect(climaxes(wait(sim, 1.2))).toHaveLength(1);
  });

  it('bouger pendant un regard l’effarouche: elle recule de 1,5 m au plus, jamais au-delà de x 61,2, et revient', () => {
    const sim = readySim();
    const today = setMoment(sim, 'roe_deer', 6 * 60 + 10);
    const def = momentDef(sim.content, 'roe_deer');
    const freeze = def?.watch.freeze ?? null;
    if (def === null || freeze === null) throw new Error('chevrette absente');
    const deer = pointOf(sim, 'roe_deer_graze');
    place(sim, 'p1', { x: deer.x - 4, y: deer.y + 0.5 }, deer);
    place(sim, 'p2', { x: deer.x - 9, y: deer.y - 1 }, deer);
    wait(sim, (ticksToLook(sim, today) + 10) / SIM_HZ);
    const events = wait(sim, 0.5, (i) => ({
      p1: still(i),
      p2: { seq: i, moveX: 0, moveY: 1, actHeld: false },
    }));
    expect(climaxes(events)).toEqual([]);
    expect(today.shyUntil, 'effarouchée').toBeGreaterThan(sim.world.tick);
    const pose: StartlePose = { x: 0, y: 0, clip: '', clipTime: 0, walking: false };
    let farthest = 0;
    for (let k = 0; k <= startleTicks(freeze); k++) {
      startlePose(freeze, { x: deer.x, y: deer.y, z: 0 }, 'deer_graze', k, pose);
      expect(pose.x, 'jamais au-delà de x 61,2').toBeLessThanOrEqual(61.2 + 1e-9);
      farthest = Math.max(farthest, Math.hypot(pose.x - deer.x, pose.y - deer.y));
    }
    expect(farthest).toBeCloseTo(1.5, 6);
    expect(Math.hypot(pose.x - deer.x, pose.y - deer.y), 'revenue à son point').toBeLessThan(1e-6);
    // Elle ne s'enfuit jamais: après l'effarouchement, elle broute et regarde de nouveau, puis l'apogée reste possible.
    wait(sim, (today.shyUntil - sim.world.tick) / SIM_HZ + 0.1);
    expect(freezeState(def, freeze, today, sim.world.tick, sim.world.seed).kind).toBe('graze');
    expect(today.phase).toBe('waiting');
  });

  it('passer sous 3 m l’effarouche aussi, même quand elle broute', () => {
    const sim = readySim();
    const today = setMoment(sim, 'roe_deer', 6 * 60 + 10);
    const deer = pointOf(sim, 'roe_deer_graze');
    place(sim, 'p1', { x: deer.x - 2.5, y: deer.y }, deer);
    place(sim, 'p2', { x: deer.x - 4, y: deer.y - 2 }, deer);
    wait(sim, 0.2);
    expect(today.shyUntil).toBeGreaterThan(sim.world.tick);
  });
});

describe('le martin-pêcheur du ponton', () => {
  it('immobiles à 2,5 à 5,5 m du pieu pendant 3 s, sans avoir à le regarder: l’apogée part', () => {
    const sim = readySim();
    setMoment(sim, 'kingfisher', 9 * 60 + 10);
    place(sim, 'p1', { x: 44.5, y: 37.5 });
    place(sim, 'p2', { x: 45.5, y: 36.5 });
    character(sim, 'p1').facing = 0;
    character(sim, 'p2').facing = Math.PI;
    expect(climaxes(wait(sim, 2.8))).toEqual([]);
    expect(climaxes(wait(sim, 0.4))).toHaveLength(1);
  });

  it('un joueur à moins de 2,5 m le fait filer (timidité), sans apogée', () => {
    const sim = readySim();
    const today = setMoment(sim, 'kingfisher', 9 * 60 + 10);
    place(sim, 'p1', { x: 45.5, y: 39.5 });
    place(sim, 'p2', { x: 45.5, y: 36.5 });
    expect(climaxes(wait(sim, 4))).toEqual([]);
    expect(today.shyUntil).toBeGreaterThan(sim.world.tick);
  });
});

describe('la brume de l’Aubrune (M-18)', () => {
  const NORTH = { x: 29.5, y: 38.5 };
  const SOUTH = { x: 29.5, y: 42.5 };

  it('un sur chaque rive, tournés l’un vers l’autre, immobiles 3 s: l’apogée part', () => {
    const sim = readySim();
    setMoment(sim, 'mist', 6 * 60 + 10);
    place(sim, 'p1', NORTH, SOUTH);
    place(sim, 'p2', SOUTH, NORTH);
    expect(climaxes(wait(sim, 2.8))).toEqual([]);
    expect(climaxes(wait(sim, 0.4))).toHaveLength(1);
  });

  it('rien sur la même rive, ni sans se faire face', () => {
    const sim = readySim();
    setMoment(sim, 'mist', 6 * 60 + 10);
    place(sim, 'p1', NORTH, SOUTH);
    place(sim, 'p2', { x: 31.5, y: 38.5 }, SOUTH);
    expect(climaxes(wait(sim, 5)), 'même rive').toEqual([]);
    place(sim, 'p2', SOUTH, { x: 29.5, y: 46 });
    expect(climaxes(wait(sim, 5)), 'p2 tourne le dos').toEqual([]);
  });

  it('ne sort que le lendemain d’une pluie (météo de la veille), au printemps de la démo', () => {
    const sim = newSim(1);
    const def = momentDef(sim.content, 'mist');
    if (def === null) throw new Error('brume absente');
    const weather = sim.content.settings.weatherByDay;
    for (let day = 2; day <= weather.length; day++) {
      sim.world.clock.day = day;
      sim.world.weather = weather[day - 1] ?? 'sunny';
      const expected = weather[day - 2] === 'rain' && sim.world.weather !== 'rain';
      expect(evaluateAll(sim, def.availableWhen, NO_CONTEXT), `jour ${String(day)}`).toBe(expected);
    }
  });
});

describe('règles de tirage du tour 7: sans effet sur la démo', () => {
  it('jusqu’au jour 23: chance 0,5, fenêtre de 7 jours, poids d’origine; dès le jour 24: réserve, 10 jours, coup de pouce', () => {
    const sim = newSim(1);
    const s = sim.content.settings.moments;
    const kingfisher = momentDef(sim.content, 'kingfisher');
    if (kingfisher === null) throw new Error('martin-pêcheur absent');
    for (let day = 1; day <= demoLastDay(sim.content); day++) {
      sim.world.clock.day = day;
      expect(dailyChanceOf(sim)).toBe(s.dailyChance);
      expect(cooldownOf(sim, kingfisher)).toBe(s.cooldownDays);
      expect(drawWeight(sim, kingfisher)).toBe(kingfisher.weight);
    }
    sim.world.clock.day = 24;
    expect(cooldownOf(sim, kingfisher)).toBe(s.cooldownDaysLong);
    expect(drawWeight(sim, kingfisher)).toBe(kingfisher.weight * s.unseenWeightFactor);
    // Été (jours 22 à 42): héron, renard, vers luisants, chevrette, martin-pêcheur, brume, et les étoiles
    // (tour 9; le salut, moment du train, ne compte pas); `seasonPoolFull` à 7 depuis le tour 9.
    expect(seasonPool(sim)).toBe(7);
    expect(dailyChanceOf(sim)).toBeCloseTo(s.dailyChance * Math.min(1, 7 / s.seasonPoolFull), 9);
  });
});

describe('sons datés de l’attente (tour 7)', () => {
  it('la chevrette effarouchée: coup de sabot puis aboiement, une fois chacun, placés à elle', () => {
    const sim = readySim();
    const today = setMoment(sim, 'roe_deer', 6 * 60 + 10);
    const deer = pointOf(sim, 'roe_deer_graze');
    place(sim, 'p1', { x: deer.x - 2.5, y: deer.y });
    place(sim, 'p2', { x: deer.x - 6, y: deer.y });
    const catalogue = parseCatalogue(soundsFile);
    const sounds = new MomentSounds(
      catalogue,
      AUDIO_SETTINGS,
      sim.content,
      sim.map,
      createRandom(1),
    );
    const shots: SoundRequest[] = [];
    for (let i = 0; i < SIM_HZ * 2; i++) {
      step(sim, { controls: { p1: still(i), p2: still(i) }, intents: [] });
      sounds.update(sim.world, i / SIM_HZ, shots, [], []);
    }
    expect(today.shyUntil).toBeGreaterThan(sim.world.tick);
    expect(shots.map((s) => s.sound)).toEqual(['deer-stamp', 'roe-bark']);
    expect(shots[0]?.at).toMatchObject({ x: deer.x, y: deer.y });
  });

  it('le martin-pêcheur: chaque plongeon manqué siffle puis fait plouf, et il siffle en filant', () => {
    const sim = readySim();
    setMoment(sim, 'kingfisher', 9 * 60 + 5);
    place(sim, 'p1', { x: 40, y: 34 });
    place(sim, 'p2', { x: 41, y: 34 });
    const sounds = new MomentSounds(
      parseCatalogue(soundsFile),
      AUDIO_SETTINGS,
      sim.content,
      sim.map,
      createRandom(1),
    );
    const shots: SoundRequest[] = [];
    for (let i = 0; i < SIM_HZ * 60; i++) {
      step(sim, { controls: { p1: still(i), p2: still(i) }, intents: [] });
      sounds.update(sim.world, i / SIM_HZ, shots, [], []);
    }
    const names = shots.map((s) => s.sound);
    expect(names.length).toBeGreaterThanOrEqual(4);
    for (let i = 0; i < names.length; i += 2)
      expect([names[i], names[i + 1]]).toEqual(['kf-whistle', 'kf-dive']);
    shots.length = 0;
    place(sim, 'p1', { x: 45.5, y: 39.5 });
    for (let i = 0; i < 3; i++) {
      step(sim, { controls: { p1: still(i), p2: still(i) }, intents: [] });
      sounds.update(sim.world, 60 + i / SIM_HZ, shots, [], []);
    }
    expect(shots.map((s) => s.sound)).toEqual(['kf-whistle']);
  });
});
