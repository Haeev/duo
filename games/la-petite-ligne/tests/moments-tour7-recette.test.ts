// Recette du tour 7 (qa-testeur, 2026-11-01): la chevrette, le martin-pêcheur et la brume.
// M-24 pour les trois moments nouveaux (texte d'apogée à la fin du spectacle, récompense au
// début), reprises en plein moment (souvenirs identiques), et les bugs QA7-01 à QA7-03 de la
// recette QA du tour 7. Un bug sans correctif est un `it.fails`: la
// CI reste verte et le test échoue dès la correction (le passer alors en `it`).
import { describe, expect, it } from 'vitest';
import { cellIndex } from '../src/etat/carte';
import type { ControlFrame } from '../src/etat/actions';
import { actorPose, freezeState, momentDef, restPosition, sampleTrack, startlePose, type StartlePose } from '../src/etat/moments';
import type { CharacterId, MomentToday, Vec2, WorldEvent } from '../src/etat/types';
import { decodeSave, restoreWorld, snapshotOf } from '../src/sauvegarde/sauvegarde';
import { type Sim, character } from '../src/simulation/contexte';
import { SIM_HZ } from '../src/simulation/constantes';
import { placeCharacter } from '../src/simulation/deplacement';
import { newToday } from '../src/simulation/moments';
import { step } from '../src/simulation/pas';
import { contentAndMap, createRobot, newSim, play } from './aides';

const A = { id: 'membre-a', name: 'Camille', color: '#e07a5f' };
const B = { id: 'membre-b', name: 'Sacha', color: '#3d85c6' };
/** Corps d'un joueur (0,3 m) plus le rayon de la chevrette (0,4 m), moins une marge de dessin. */
const TOUCH = 0.6;

function readySim(seed = 5): Sim {
  const sim = newSim(seed);
  play(sim, createRobot(), (s) => s.world.phase === 'day' && s.world.clock.running && s.world.scene === null && s.world.scripts.length === 0, SIM_HZ * 600);
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

function place(sim: Sim, id: CharacterId, at: Vec2, lookAt: Vec2 | null = null): void {
  const c = character(sim, id);
  placeCharacter(sim, c, at);
  if (lookAt !== null) c.facing = Math.atan2(lookAt.y - at.y, lookAt.x - at.x);
}

const still = (seq: number): ControlFrame => ({ seq, moveX: 0, moveY: 0, actHeld: false });

function wait(sim: Sim, seconds: number, each?: () => void): WorldEvent[] {
  const events: WorldEvent[] = [];
  for (let i = 0; i < Math.round(seconds * SIM_HZ); i++) {
    step(sim, { controls: { p1: still(i), p2: still(i) }, intents: [] });
    events.push(...sim.events);
    each?.();
  }
  return events;
}

function point(sim: Sim, id: string): Vec2 {
  const p = sim.map.points[id];
  if (p === undefined) throw new Error(`point ${id} absent`);
  return p;
}

/** Les deux joueurs à leur place de spectateur du moment, immobiles. */
function spectators(sim: Sim, id: string): void {
  if (id === 'roe_deer') {
    const deer = point(sim, 'roe_deer_graze');
    place(sim, 'p1', { x: deer.x - 4, y: deer.y + 0.5 }, deer);
    place(sim, 'p2', { x: deer.x - 3.5, y: deer.y - 2 }, deer);
  } else if (id === 'kingfisher') {
    place(sim, 'p1', { x: 44.5, y: 37.5 });
    place(sim, 'p2', { x: 45.5, y: 36.5 });
  } else {
    const north = { x: 29.5, y: 38.5 };
    const south = { x: 29.5, y: 42.5 };
    place(sim, 'p1', north, south);
    place(sim, 'p2', south, north);
  }
}

const START: Readonly<Record<string, number>> = { roe_deer: 6 * 60 + 10, kingfisher: 9 * 60 + 10, mist: 6 * 60 + 10 };
const NEW = ['roe_deer', 'kingfisher', 'mist'] as const;

/** Jusqu'au début de l'apogée (au plus 40 s): les spectateurs immobiles. */
function untilClimax(sim: Sim, today: MomentToday): void {
  for (let i = 0; i < 40 * SIM_HZ && today.phase === 'waiting'; i++) step(sim, { controls: { p1: still(i), p2: still(i) }, intents: [] });
  expect(today.phase, 'apogée partie').toBe('climax');
}

/** Pose dessinée d'une bête de la chevrette pendant l'attente (arrivée, effarouchement), sinon celle de l'état. */
function drawn(sim: Sim, actorId: string): Vec2 | null {
  const today = sim.world.moments.today;
  if (today === null) return null;
  const def = momentDef(sim.content, today.id);
  const actor = def?.actors.find((a) => a.id === actorId);
  if (def === null || actor === undefined) return null;
  const rest = restPosition(sim.map, actor);
  if (today.phase === 'waiting') {
    const t = (sim.world.tick - today.phaseTick) / SIM_HZ;
    if (actor.arrive !== null && t < actor.arrive.seconds) return sampleTrack(actor.arrive.keyframes[actor.id] ?? [], t, rest);
    const freeze = def.watch.freeze ?? null;
    if (freeze !== null && freeze.actor === actor.id) {
      const state = freezeState(def, freeze, today, sim.world.tick, sim.world.seed);
      if (state.kind === 'startled') {
        const pose: StartlePose = { x: 0, y: 0, clip: '', clipTime: 0, walking: false };
        startlePose(freeze, rest, actor.idle, state.since, pose);
        return pose;
      }
    }
    return rest;
  }
  const pose = actorPose(sim.map, def, today, actorId);
  return pose === null || pose.opacity < 0.05 ? null : pose;
}

/** Distance minimale entre la chevrette (ou le faon) et un joueur, relevée à chaque pas. */
function closest(sim: Sim, out: { d: number }): () => void {
  return () => {
    for (const id of ['roe_deer', 'fawn']) {
      const p = drawn(sim, id);
      if (p === null) continue;
      for (const c of sim.world.characters) out.d = Math.min(out.d, Math.hypot(c.pos.x - p.x, c.pos.y - p.y));
    }
  };
}

describe('M-24: le texte d’apogée des moments du tour 7 part à la fin du spectacle, la récompense au début', () => {
  for (const id of NEW) {
    it(id, () => {
      const sim = readySim();
      const today = setMoment(sim, id, START[id] ?? 6 * 60);
      const def = momentDef(sim.content, id);
      if (def === null) throw new Error(`moment ${id} absent`);
      spectators(sim, id);
      wait(sim, 0.2);
      for (const c of sim.world.characters) c.heartToday.moment = false;
      untilClimax(sim, today);
      const text = (): number => character(sim, 'p1').notifications.filter((n) => n.key === def.texts.climax).length;
      expect(character(sim, 'p1').heartToday.moment, 'récompense au début').toBe(true);
      expect(text(), 'pas de texte au début').toBe(0);
      wait(sim, def.climax.seconds - 1);
      expect(text(), 'toujours rien pendant le spectacle').toBe(0);
      wait(sim, 1.2);
      expect(today.phase).toBe('after');
      expect(text(), 'le texte à la fin').toBe(1);
    });
  }
});

describe('reprise en plein moment du tour 7: les souvenirs ne bougent pas', () => {
  it('graine 123456 (martin-pêcheur, chevrette, brume): reprise en plein regard, en pleine apogée et à chaque aube, hôte et invité inversés', () => {
    let sim = newSim(123_456);
    let robot = createRobot();
    let swap = false;
    let day = sim.world.clock.day;
    const done = new Set<string>();
    const resumed: string[] = [];
    const again = (why: string): void => {
      const before = JSON.stringify(sim.world.memories);
      const snap = snapshotOf(sim);
      const { content, map } = contentAndMap();
      swap = !swap;
      sim = restoreWorld(content, map, decodeSave(JSON.parse(JSON.stringify(snap.data)) as unknown), snap.dataSchema, swap ? [B, A] : [A, B]);
      robot = createRobot();
      expect(JSON.stringify(sim.world.memories), `souvenirs après reprise (${why})`).toBe(before);
      resumed.push(why);
    };
    for (let ticks = 0; sim.world.phase !== 'ended' && ticks < SIM_HZ * 60 * 300; ticks++) {
      step(sim, robot.decide(sim));
      const w = sim.world;
      const t = w.moments.today;
      const key = `${t?.id ?? ''}:${String(w.clock.day)}`;
      if (t !== null && NEW.some((id) => id === t.id)) {
        const def = momentDef(sim.content, t.id);
        const freeze = def?.watch.freeze ?? null;
        if (def !== null && freeze !== null && t.phase === 'waiting' && freezeState(def, freeze, t, w.tick, w.seed).kind === 'look' && !done.has(`${key}:l`)) {
          done.add(`${key}:l`);
          again(`${t.id} en plein regard`);
          continue;
        }
        if (t.phase === 'climax' && t.elapsed > 1.5 && !done.has(`${key}:c`)) {
          done.add(`${key}:c`);
          again(`${t.id} en pleine apogée`);
          continue;
        }
      }
      if (w.clock.day !== day && w.phase === 'breakfast') {
        day = w.clock.day;
        again(`aube du jour ${String(day)}`);
      }
    }
    expect(sim.world.phase).toBe('ended');
    expect(resumed.filter((r) => r.includes('apogée'))).toEqual(['kingfisher en pleine apogée', 'roe_deer en pleine apogée', 'mist en pleine apogée', 'kingfisher en pleine apogée']);
    // Une ligne par moment, son nombre de passages et ses dates d'après l'historique.
    const seen = sim.world.moments.history.filter((h) => h.seen);
    const ids = sim.world.memories.moments.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of sim.world.memories.moments) {
      const days = seen.filter((h) => h.id === m.id).map((h) => h.day);
      expect([m.count, m.first, m.last], m.id).toEqual([days.length, Math.min(...days), Math.max(...days)]);
    }
    expect(new Set(seen.map((h) => h.id))).toEqual(new Set(ids));
  }, 300_000);
});

describe('QA7-01: une bête partie pendant l’apogée revient à l’heure du départ', () => {
  // Après une apogée réussie, `leaveNow` passe le moment d'ambiance en `left` à `present.to`: le
  // rendu rejoue alors le départ depuis la fin de l'apogée (la brume réapparaît et se dissipe
  // 20 s, le martin-pêcheur revient en (39 ; 40,3) et refile vers l'est en sifflant, la chevrette
  // ressort à la lisière). Attendu: rien ne revient, le moment s'éteint (`gone`).
  for (const id of NEW) {
    it(`${id}: après l’apogée, à l’heure du départ, le moment s’éteint sans rejouer de départ`, () => {
      const sim = readySim();
      const today = setMoment(sim, id, START[id] ?? 6 * 60);
      const def = momentDef(sim.content, id);
      if (def === null) throw new Error(`moment ${id} absent`);
      spectators(sim, id);
      untilClimax(sim, today);
      wait(sim, def.climax.seconds + 0.5);
      expect(today.phase).toBe('after');
      for (const a of def.actors) expect(actorPose(sim.map, def, today, a.id), `${a.id} parti pendant l’apogée`).toBeNull();
      sim.world.clock.minutes = def.present.to;
      wait(sim, 0.5);
      expect(today.phase, 'pas de départ rejoué').toBe('gone');
    });
  }
});

describe('QA7-02: la chevrette et son faon traversent un joueur', () => {
  it('apogée: un joueur à l’est du pré, dans l’anneau (61,5 ; 27,5), est traversé par les bonds vers la haie', () => {
    const sim = readySim();
    const today = setMoment(sim, 'roe_deer', 6 * 60 + 10);
    const deer = point(sim, 'roe_deer_graze');
    place(sim, 'p1', { x: 61.5, y: 27.5 }, deer);
    place(sim, 'p2', { x: 54.5, y: 27.5 }, deer);
    expect(sim.map.blocked[cellIndex(sim.map, 61, 27)], 'case libre').toBe(false);
    untilClimax(sim, today);
    const near = { d: 99 };
    wait(sim, 10, closest(sim, near));
    expect(near.d).toBeGreaterThanOrEqual(TOUCH);
  });

  it('effarouchée: elle recule dans le joueur posté derrière elle (59,6 ; 27,3), en boucle', () => {
    const sim = readySim();
    setMoment(sim, 'roe_deer', 6 * 60 + 10);
    wait(sim, 6);
    place(sim, 'p1', { x: 59.6, y: 27.3 });
    place(sim, 'p2', { x: 54.5, y: 27.5 });
    const near = { d: 99 };
    wait(sim, 30, closest(sim, near));
    expect(near.d).toBeGreaterThanOrEqual(TOUCH);
  });

  it('arrivée: elle sort de la haie à travers un joueur posé sur son trajet (60,5 ; 27,2)', () => {
    const sim = readySim();
    setMoment(sim, 'roe_deer', 6 * 60 + 1);
    place(sim, 'p1', { x: 60.5, y: 27.2 });
    place(sim, 'p2', { x: 50.5, y: 30.5 });
    const near = { d: 99 };
    wait(sim, 5.3, closest(sim, near));
    expect(near.d).toBeGreaterThanOrEqual(TOUCH);
  });
});

describe('QA7-03: le martin-pêcheur caché ne doit pas jouer son apogée', () => {
  it('effarouché (parti au ras de l’eau), il revient d’un coup sur son pieu si l’apogée part avant son retour', () => {
    const sim = readySim();
    const today = setMoment(sim, 'kingfisher', 9 * 60 + 10);
    place(sim, 'p1', { x: 45.5, y: 39.5 });
    place(sim, 'p2', { x: 45.5, y: 36.5 });
    wait(sim, 1);
    expect(today.shyUntil, 'il a filé').toBeGreaterThan(sim.world.tick);
    place(sim, 'p1', { x: 44.5, y: 37.5 });
    let shyAtClimax: number | null = null;
    for (let i = 0; i < 10 * SIM_HZ && shyAtClimax === null; i++) {
      const events = wait(sim, 1 / SIM_HZ);
      if (events.some((e) => e.type === 'moment_climax')) shyAtClimax = today.shyUntil - sim.world.tick;
    }
    expect(shyAtClimax, 'apogée partie').not.toBeNull();
    expect(shyAtClimax ?? 0, 'apogée seulement une fois revenu').toBeLessThanOrEqual(0);
  });
});
