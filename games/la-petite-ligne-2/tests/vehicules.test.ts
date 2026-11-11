// Véhicules de voie (`simulation/vehicules/`): la draisine d'Aubrune. Sortie de la remise, montée,
// pompage en alternance, à l'unisson, seul; frein et descente; bout de voie et verrous d'histoire;
// refus et rangement d'office devant un train; égalité de l'hôte et de l'invité; sauvegarde et
// reprise; véhicule factice ajouté par les seules données. Tests courts, graine fixe.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import type { Content } from '../src/donnees/charger';
import type { PlayerIndex } from '../src/donnees/schemas/communs';
import { PlaceSlowSchema, slowOfPlace } from '../src/etat/lieu';
import { DATA_SCHEMA, type WorldState } from '../src/etat/monde';
import type { RailVehicleState } from '../src/etat/vehicules';
import { restoreWorld, snapshotOf } from '../src/sauvegarde/sauvegarde';
import { aimOf } from '../src/simulation/briques/visee';
import { calendarOf } from '../src/simulation/monde/calendrier';
import type { VehiclePose } from '../src/simulation/monde/trains';
import { SIM_HZ } from '../src/simulation/noyau/constantes';
import { canWalk } from '../src/simulation/noyau/deplacement';
import { idleInput, type StepInput } from '../src/simulation/noyau/entrees';
import type { GameEvent } from '../src/simulation/noyau/evenements';
import { bodyCollides, isBlockedCell } from '../src/simulation/noyau/grille';
import { currentBlockers } from '../src/simulation/noyau/obstacles';
import { createSim, step, type Sim } from '../src/simulation/noyau/pas';
import { remember } from '../src/simulation/regles/memoire';
import { riddenBy } from '../src/simulation/vehicules/places';
import { strokeQuality } from '../src/simulation/vehicules/pompe';
import { lineOf, poseVehicle } from '../src/simulation/vehicules/voie';
import { stripComments } from '../outils/nouveau';
import { referenceSave } from './aides-sauvegarde';
import { contentWith, contextOf } from './aides-l3';
import { MEMBERS, newSim } from './aides';

type Json = Record<string, unknown>;
const AUBRUNE = 'aubrune';
const TRACK_Y = 97.5;
/** Point de pose: la traversée de service `trav`, sur la ligne. */
const LAUNCH_X = 214;

function aubrune(edit?: (files: Record<string, Json>) => void): Content {
  return contentWith((files) => {
    const settings = files['commun/reglages.json'] as { start: Json };
    settings.start = { ...settings.start, place: AUBRUNE, minute: 600 };
    edit?.(files);
  });
}

const content = aubrune();
const SATURDAY = Array.from({ length: 7 }, (_, i) => i + 1).find(
  (day) => calendarOf(content, day).weekday === 'saturday',
);

function place(world: WorldState): WorldState['places'][string] {
  const state = world.places[AUBRUNE];
  if (state === undefined) throw new Error('Aubrune sans état');
  return state;
}

function vehicle(sim: Sim, id = 'draisine'): RailVehicleState {
  const state = place(sim.world).vehicles?.[id];
  if (state === undefined) throw new Error(`véhicule ${id} sans état`);
  return state;
}

function put(sim: Sim, player: PlayerIndex, x: number, y: number, facing: number): void {
  Object.assign(sim.world.players[player].body, { x, y, facing, speed: 0 });
}

/** Un pas: commandes tenues de chacun, appuis de la touche d'action de ces joueurs. */
function tick(
  sim: Sim,
  presses: readonly PlayerIndex[] = [],
  held: readonly [Partial<StepInput>, Partial<StepInput>] = [{}, {}],
): GameEvent[] {
  step(
    sim,
    [
      { ...idleInput(sim.world.tick), ...held[0] },
      { ...idleInput(sim.world.tick), ...held[1] },
    ],
    presses.map((player) => ({ player, intent: { type: 'act' } })),
  );
  return [...sim.events];
}

function hold(
  sim: Sim,
  seconds: number,
  held: readonly [Partial<StepInput>, Partial<StepInput>] = [{}, {}],
): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < Math.round(seconds * SIM_HZ); i++) events.push(...tick(sim, [], held));
  return events;
}

/** Aubrune après la suite des lettres: la clé tournée, les deux joueurs devant la porte de la remise. */
function keyed(world: Content = content, minutes = 600): Sim {
  const sim = newSim(world);
  sim.world.minutes = minutes;
  remember(contextOf(sim), 'aubrune.draisine.sortie', true, 'duo');
  put(sim, 0, 219.3, 92.5, 0);
  put(sim, 1, 218.4, 93.4, 0);
  return sim;
}

/** Sortie par le joueur 0, puis chacun monte de son côté. */
function aboard(world: Content = content, minutes = 600, id = 'draisine'): Sim {
  const sim = keyed(world, minutes);
  expect(aimOf(sim, 0)?.id).toBe(`remise-${id}`);
  tick(sim, [0]);
  expect(vehicle(sim, id).out).toBe(true);
  put(sim, 0, LAUNCH_X + 0.9, 98.6, -Math.PI / 2);
  put(sim, 1, LAUNCH_X - 0.9, 98.6, -Math.PI / 2);
  tick(sim, [0, 1]);
  expect(vehicle(sim, id).riders).toEqual([0, 1]);
  return sim;
}

type Mode = 'alternate' | 'unison' | 'solo';

/** Coups déjà donnés dans chaque partie: l'alternance se poursuit d'un appel à l'autre. */
const strokes = new WeakMap<Sim, { count: number; next: number }>();

/**
 * Pompe pendant `seconds`: un coup tous les `gap` secondes (alternés, ensemble, ou un seul joueur).
 * `untilStopped`: s'arrête de pomper dès que le véhicule, parti, s'est arrêté (bout de voie).
 */
function pump(
  sim: Sim,
  seconds: number,
  mode: Mode,
  gap = 0.45,
  untilStopped: string | null = null,
): GameEvent[] {
  const events: GameEvent[] = [];
  const steps = Math.round(seconds * SIM_HZ);
  let beat = strokes.get(sim);
  if (beat === undefined) {
    beat = { count: 0, next: sim.world.tick };
    strokes.set(sim, beat);
  }
  let moved = false;
  for (let i = 0; i < steps; i++) {
    let presses: PlayerIndex[] = [];
    if (sim.world.tick >= beat.next) {
      presses = mode === 'unison' ? [0, 1] : mode === 'solo' ? [0] : [beat.count % 2 === 0 ? 0 : 1];
      beat.count += 1;
      beat.next = sim.world.tick + Math.round(gap * SIM_HZ);
    }
    events.push(...tick(sim, presses));
    if (untilStopped === null) continue;
    const speed = vehicle(sim, untilStopped).speed;
    if (speed > 1) moved = true;
    else if (moved && speed === 0) break;
  }
  return events;
}

function poseOf(c: Content, world: WorldState, id = 'draisine'): VehiclePose {
  const out: VehiclePose = { model: '', x: 0, y: 0, yaw: 0, front: 0, back: 0 };
  const where = c.places[AUBRUNE];
  const def = where?.vehicles[id];
  if (where === undefined || def === undefined) throw new Error('fiche absente');
  expect(poseVehicle(where, def, world.places[AUBRUNE]?.vehicles?.[id], out)).toBe(true);
  return out;
}

describe('la draisine: remise, montée, descente', () => {
  it('dort dans sa remise: sans la clé la porte ne dit rien, avec elle on la sort sur la voie', () => {
    const locked = newSim(content);
    put(locked, 0, 219.3, 92.5, 0);
    expect(aimOf(locked, 0)).toBeNull();
    // Dans la remise: au-delà de la porte (x 220), dans le bâtiment (x 220 à 226, y 90 à 95).
    const asleep = poseOf(content, locked.world);
    expect(asleep.x).toBeGreaterThan(221.3);
    expect(asleep.x).toBeLessThan(224.7);
    expect(asleep.y).toBeGreaterThan(90.9);
    expect(asleep.y).toBeLessThan(94.1);

    const sim = keyed();
    expect(aimOf(sim, 0)).toMatchObject({
      kind: 'vehicle',
      id: 'remise-draisine',
      verb: 'Sortir la draisine',
      refusal: null,
    });
    const events = tick(sim, [0]);
    expect(events).toContainEqual({ type: 'vehicle_out', vehicle: 'draisine', player: 0 });
    // Posée au point prévu (la traversée `trav`), sur l'axe de la voie, à l'arrêt de la halte.
    const out = poseOf(content, sim.world);
    expect(out.x).toBeCloseTo(LAUNCH_X, 5);
    expect(out.y).toBeCloseTo(TRACK_Y, 5);
    expect(vehicle(sim)).toMatchObject({
      out: true,
      speed: 0,
      stop: 'halte',
      riders: [null, null],
    });
    // À l'arrêt on la contourne: sa rangée est prise, les rangées voisines restent libres.
    const blocked = currentBlockers(sim.content, sim.world);
    if (blocked === null) throw new Error('obstacles absents');
    expect(isBlockedCell(blocked, 214, 97)).toBe(true);
    expect(isBlockedCell(blocked, 214, 96)).toBe(false);
    expect(isBlockedCell(blocked, 214, 98)).toBe(false);
    // Vide, à son point de pose: la porte de la remise la rentre.
    expect(aimOf(sim, 0)).toMatchObject({ id: 'remise-draisine', verb: 'Rentrer la draisine' });
    expect(tick(sim, [0])).toContainEqual({
      type: 'vehicle_in',
      vehicle: 'draisine',
      reason: 'player',
    });
    expect(vehicle(sim).out).toBe(false);
  });

  it('chacun monte de son côté du balancier, face à face; on ne descend qu’à l’arrêt', () => {
    const sim = keyed();
    tick(sim, [0]);
    put(sim, 0, LAUNCH_X + 0.9, 98.6, -Math.PI / 2);
    put(sim, 1, LAUNCH_X - 0.9, 98.6, -Math.PI / 2);
    expect(aimOf(sim, 0)).toMatchObject({ id: 'vehicule-draisine', verb: 'Monter', refusal: null });
    expect(tick(sim, [0])).toContainEqual({
      type: 'vehicle_seat',
      vehicle: 'draisine',
      player: 0,
      seat: 0,
    });
    tick(sim, [1]);
    expect(vehicle(sim).riders).toEqual([0, 1]);
    const [a, b] = sim.world.players;
    // Le joueur 0 à l'avant (vers l'est) regarde l'arrière; le joueur 1 à l'arrière regarde l'avant.
    expect(a.body.x).toBeCloseTo(LAUNCH_X + 0.85, 5);
    expect(b.body.x).toBeCloseTo(LAUNCH_X - 0.85, 5);
    expect(a.body.y).toBeCloseTo(TRACK_Y, 5);
    expect(Math.cos(a.body.facing)).toBeCloseTo(-1, 5);
    expect(Math.cos(b.body.facing)).toBeCloseTo(1, 5);
    // À bord: ni marche ni cible, la touche d'action est le balancier.
    expect(canWalk(sim.world, 0)).toBe(false);
    expect(aimOf(sim, 0)).toBeNull();

    // En route, une direction ne fait pas descendre.
    pump(sim, 3, 'alternate');
    expect(vehicle(sim).speed).toBeGreaterThan(1);
    hold(sim, 0.3, [{ moveY: 1 }, {}]);
    expect(vehicle(sim).riders).toEqual([0, 1]);
    // Frein (touche de course): arrêt en moins de trois secondes, puis une direction fait descendre.
    hold(sim, 3, [{ run: true }, {}]);
    expect(vehicle(sim).speed).toBe(0);
    hold(sim, 0.1);
    const at = poseOf(content, sim.world);
    hold(sim, 0.1, [{ moveY: 1 }, {}]);
    expect(vehicle(sim).riders).toEqual([null, 1]);
    expect(riddenBy(place(sim.world), 0)).toBeNull();
    expect(canWalk(sim.world, 0)).toBe(true);
    // Posé à côté du gabarit, sur une case libre, sans coût: ni besoins ni endurance touchés.
    const blocked = currentBlockers(sim.content, sim.world);
    if (blocked === null) throw new Error('obstacles absents');
    expect(Math.abs(a.body.y - at.y)).toBeGreaterThan(1);
    expect(bodyCollides(blocked, a.body.x, a.body.y, 0.3)).toBe(false);
    expect(a.stamina).toBe(newSim(content).world.players[0].stamina);
  });
});

describe('la draisine: le balancier', () => {
  it('justesse d’un coup: pleine au battement, nulle si l’on martèle, un fond si l’on traîne', () => {
    const drive = content.places[AUBRUNE]?.vehicles.draisine?.drive;
    if (drive === undefined) throw new Error('fiche absente');
    expect(strokeQuality(drive, 0.45)).toBe(1);
    expect(strokeQuality(drive, 0.32)).toBe(1);
    expect(strokeQuality(drive, 0.58)).toBe(1);
    expect(strokeQuality(drive, 0.12)).toBeLessThan(0.15);
    expect(strokeQuality(drive, 1.2)).toBe(drive.offBeat);
  });

  it('en alternance au battement elle prend de la vitesse, plus vite que la course', () => {
    const sim = aboard();
    const before = sim.world.players.map((p) => ({ ...p.needs, stamina: p.stamina }));
    const events = pump(sim, 12, 'alternate');
    const state = vehicle(sim);
    expect(events.filter((e) => e.type === 'vehicle_started')).toHaveLength(1);
    expect(state.speed).toBeGreaterThan(7);
    expect(state.speed).toBeLessThanOrEqual(8);
    expect(state.speed).toBeGreaterThan(sim.content.settings.movement.runSpeed * 2);
    expect(state.lever.rhythm).toBeGreaterThan(0.9);
    expect(state.s - LAUNCH_X).toBeGreaterThan(50);
    // Les deux joueurs suivent leur place, sans courir: aucune endurance dépensée.
    expect(sim.world.players[0].body.x - sim.world.players[1].body.x).toBeCloseTo(1.7, 5);
    expect(sim.world.players[0].body.x).toBeCloseTo(state.s + 0.85, 5);
    sim.world.players.forEach((p, i) => {
      expect(p.stamina).toBeGreaterThanOrEqual(before[i]?.stamina ?? 0);
    });
    // Sans pomper elle ralentit d'elle-même, sans s'arrêter net.
    const fast = state.speed;
    hold(sim, 2);
    expect(vehicle(sim).speed).toBeLessThan(fast - 0.8);
    expect(vehicle(sim).speed).toBeGreaterThan(4);
  });

  it('un rythme approximatif avance quand même, moins vite', () => {
    const sloppy = aboard();
    pump(sloppy, 12, 'alternate', 0.8);
    const speed = vehicle(sloppy).speed;
    expect(speed).toBeGreaterThan(1.2);
    expect(speed).toBeLessThan(5);
  });

  it('à l’unisson elle n’avance pas: le balancier se bloque', () => {
    const sim = aboard();
    const events = pump(sim, 6, 'unison', 0.9);
    expect(events.some((e) => e.type === 'vehicle_stroke' && e.kind === 'jam')).toBe(true);
    expect(vehicle(sim).speed).toBeLessThan(0.05);
    expect(Math.abs(vehicle(sim).s - LAUNCH_X)).toBeLessThan(0.3);
    expect(vehicle(sim).lever.rhythm).toBe(0);
  });

  it('seul elle n’avance pas: ni à deux à bord quand un seul pompe, ni seul à bord', () => {
    const sim = aboard();
    const events = pump(sim, 6, 'solo', 0.45);
    expect(events.filter((e) => e.type === 'vehicle_stroke' && e.kind === 'same').length).toBe(12);
    expect(Math.abs(vehicle(sim).s - LAUNCH_X)).toBeLessThan(0.5);
    expect(vehicle(sim).speed).toBe(0);

    const alone = keyed();
    tick(alone, [0]);
    put(alone, 0, LAUNCH_X + 0.9, 98.6, -Math.PI / 2);
    tick(alone, [0]);
    expect(vehicle(alone).riders).toEqual([0, null]);
    const tried = pump(alone, 3, 'solo', 0.45);
    expect(tried.every((e) => e.type !== 'vehicle_stroke' || e.kind === 'alone')).toBe(true);
    expect(vehicle(alone).s).toBe(LAUNCH_X);
  });

  it('à l’arrêt, la touche de frein inverse le sens de marche', () => {
    const sim = aboard();
    expect(vehicle(sim).dir).toBe(1);
    const events = hold(sim, 0.1, [{}, { run: true }]);
    expect(events).toContainEqual({ type: 'vehicle_turned', vehicle: 'draisine', dir: -1 });
    hold(sim, 0.1);
    pump(sim, 4, 'alternate');
    expect(vehicle(sim).s).toBeLessThan(LAUNCH_X - 5);
  });
});

describe('la draisine: la voie', () => {
  it('s’arrête d’elle-même devant la grille fermée, repart en arrière; grille ouverte, elle suit la courbe jusqu’au tunnel', () => {
    const sim = aboard();
    const events = pump(sim, 30, 'alternate', 0.45, 'draisine');
    const state = vehicle(sim);
    // Verrou v8 (la grille de la Compagnie, x 296 à 303): tampon avant à 50 cm de la grille.
    expect(state.speed).toBe(0);
    expect(state.s).toBeCloseTo(296 - 1.3 - 0.5, 1);
    expect(events).toContainEqual({
      type: 'vehicle_stopped',
      vehicle: 'draisine',
      stop: null,
      end: true,
    });
    // Elle a freiné d'elle-même, sans à-coup: jamais au-delà de la butée.
    expect(state.dir).toBe(-1);
    pump(sim, 3, 'alternate');
    expect(vehicle(sim).s).toBeLessThan(290);

    const open = aboard();
    remember(contextOf(open), 'aubrune.verrou.v8', true, 'duo');
    pump(open, 40, 'alternate', 0.45, 'draisine');
    const line = lineOf(content.places[AUBRUNE] ?? never(), draisine());
    expect(vehicle(open)).toMatchObject({ speed: 0, stop: 'tunnel', dir: -1 });
    expect(vehicle(open).s).toBeCloseTo(line?.to ?? 0, 1);
    // Dans la courbe de l'est, devant le portail muré (362, 52): hors de l'axe droit, tournée.
    const pose = poseOf(content, open.world);
    expect(pose.y).toBeLessThan(60);
    expect(pose.x).toBeGreaterThan(355);
    expect(Math.hypot(pose.x - 362, pose.y - 52)).toBeGreaterThan(3.5);
    expect(Math.abs(Math.sin(pose.yaw))).toBeLessThan(0.5);
  });

  it('cède la voie à un passant: freine en douceur, attend sans choc, repart au coup de timbre', () => {
    const sim = aboard();
    const def = draisine();
    const at = LAUNCH_X + 45;
    // Un habitant planté sur la voie, tenu à sa place à chaque pas tant qu'il y est.
    let walker = true;
    const keep = (): void => {
      const villagers = place(sim.world).villagers;
      if (!walker) {
        delete villagers['passant-essai'];
        return;
      }
      villagers['passant-essai'] = {
        met: [false, false],
        talkingWith: null,
        body: { x: at, y: TRACK_Y, facing: 0, speed: 0 },
      };
    };
    const events: GameEvent[] = [];
    let beat = 0;
    let worst = 0;
    let last = vehicle(sim).speed;
    for (let i = 0; i < 16 * SIM_HZ; i++) {
      keep();
      const presses: PlayerIndex[] =
        i < 9 * SIM_HZ && i % Math.round(0.45 * SIM_HZ) === 0 ? [beat++ % 2 === 0 ? 0 : 1] : [];
      events.push(...tick(sim, presses));
      const speed = vehicle(sim).speed;
      // Le dernier pas avant l'arrêt (moins de 0,5 m/s) arrondit à zéro: il ne compte pas.
      if (speed > 0.5) worst = Math.max(worst, (last - speed) * SIM_HZ);
      last = speed;
      // Le tampon avant ne touche jamais le passant (rayon 0,3 m).
      expect(vehicle(sim).s + def.body.front).toBeLessThan(at - 0.3);
    }
    const state = vehicle(sim);
    expect(state.speed).toBe(0);
    expect(at - 0.3 - (state.s + def.body.front)).toBeGreaterThan(1);
    // Freinage doux: jamais plus que le freinage de la fiche (avec la roue libre).
    expect(worst).toBeLessThan(def.speed.endBrake + def.speed.roll + def.speed.drag * 8 + 0.1);
    // Pas un « arrêt »: ni événement, ni effets d'arrêt.
    expect(events.some((e) => e.type === 'vehicle_stopped')).toBe(false);
    expect(events.some((e) => e.type === 'vehicle_bell')).toBe(false);
    walker = false;
    const after: GameEvent[] = [];
    for (let i = 0; i < 2 * SIM_HZ; i++) {
      keep();
      after.push(...tick(sim));
    }
    expect(after.filter((e) => e.type === 'vehicle_bell')).toHaveLength(1);
    expect(vehicle(sim).speed).toBeGreaterThan(1);
    expect(vehicle(sim).s + def.body.front).toBeGreaterThan(at - 0.3);
  });

  it('les arrêts posent les faits de la suite: aller au passage de l’Église, retour à la halte', () => {
    const sim = aboard();
    const fact = (key: string): unknown => sim.world.progress.memory[key]?.v;
    // Aller: 45 m vers l'est, frein avant le passage (repère à x 259,5, rayon 5 m).
    let guard = 0;
    while (vehicle(sim).s < 252 && guard++ < 400) pump(sim, 0.45, 'alternate');
    hold(sim, 4, [{ run: true }, {}]);
    expect(vehicle(sim).stop).toBe('eglise');
    expect(fact('aubrune.draisine.aller')).toBe(true);
    expect(fact('aubrune.draisine.retour')).toBeUndefined();
    // Retour: on inverse le sens, on pompe, on freine à la halte.
    hold(sim, 0.1);
    hold(sim, 0.1, [{ run: true }, {}]);
    hold(sim, 0.1);
    expect(vehicle(sim).dir).toBe(-1);
    guard = 0;
    while (vehicle(sim).s > 221 && guard++ < 400) pump(sim, 0.45, 'alternate');
    hold(sim, 4, [{}, { run: true }]);
    expect(vehicle(sim).stop).toBe('halte');
    expect(fact('aubrune.draisine.retour')).toBe(true);
  });
});

function never(): never {
  throw new Error('contenu absent');
}

function draisine(
  c: Content = content,
): NonNullable<Content['places'][string]>['vehicles'][string] {
  return c.places[AUBRUNE]?.vehicles.draisine ?? never();
}

describe('la draisine et les trains', () => {
  /** Un samedi après l'acte 2: le train du samedi entre à 9 h 56 et s'arrête à 10 h 04. */
  function saturday(minutes: number): Sim {
    const sim = keyed(content, minutes);
    sim.world.common.day = SATURDAY ?? 6;
    remember(contextOf(sim), 'aubrune.acte2.fini', true, 'duo');
    return sim;
  }

  it('refuse de sortir et de partir quand un train est à quai ou annoncé', () => {
    for (const minutes of [580, 600, 700, 885]) {
      const sim = saturday(minutes);
      expect(aimOf(sim, 0), `à ${String(minutes)}`).toMatchObject({
        id: 'remise-draisine',
        refusal: 'train-due',
      });
      expect(tick(sim, [0])).toContainEqual({
        type: 'refused',
        player: 0,
        reason: 'train-due',
        target: 'remise-draisine',
      });
      expect(place(sim.world).vehicles?.draisine?.out ?? false).toBe(false);
    }
    // Après son départ (14 h 48), la voie est rendue.
    expect(aimOf(saturday(890), 0)).toMatchObject({ refusal: null });
    // Déjà sortie quand il s'annonce: on ne monte plus.
    const out = saturday(570);
    tick(out, [0]);
    out.world.minutes = 580;
    put(out, 0, LAUNCH_X + 0.9, 98.6, -Math.PI / 2);
    expect(aimOf(out, 0)).toMatchObject({ id: 'vehicule-draisine', refusal: 'train-due' });
  });

  it('en balade: un avertissement quand le train s’annonce, puis rangée d’office, sans dommage', () => {
    const sim = saturday(570);
    tick(sim, [0]);
    put(sim, 0, LAUNCH_X + 0.9, 98.6, -Math.PI / 2);
    put(sim, 1, LAUNCH_X - 0.9, 98.6, -Math.PI / 2);
    tick(sim, [0, 1]);
    pump(sim, 4, 'alternate');
    // L'annonce tombe 20 minutes de jeu avant l'entrée du train (9 h 36).
    sim.world.minutes = 575.95;
    const warned = pump(sim, 1, 'alternate');
    expect(warned.filter((e) => e.type === 'vehicle_warning')).toHaveLength(1);
    expect(vehicle(sim).out).toBe(true);
    expect(vehicle(sim).speed).toBeGreaterThan(2);
    // Le train entre (9 h 56): la draisine est rentrée, les deux joueurs posés à côté de la voie.
    const needs = sim.world.players.map((p) => ({ ...p.needs }));
    sim.world.minutes = 595.98;
    const events = pump(sim, 0.5, 'alternate');
    expect(events).toContainEqual({ type: 'vehicle_in', vehicle: 'draisine', reason: 'train' });
    expect(vehicle(sim)).toMatchObject({ out: false, speed: 0, riders: [null, null] });
    const blocked = currentBlockers(sim.content, sim.world);
    if (blocked === null) throw new Error('obstacles absents');
    sim.world.players.forEach((p, i) => {
      expect(riddenBy(place(sim.world), i as PlayerIndex)).toBeNull();
      expect(bodyCollides(blocked, p.body.x, p.body.y, 0.3)).toBe(false);
      // Hors de l'axe de la voie: à côté du gabarit, ou sur la case libre voisine (mobilier du quai).
      expect(Math.abs(p.body.y - TRACK_Y)).toBeGreaterThanOrEqual(0.99);
      expect(p.needs.hunger).toBeCloseTo(needs[i]?.hunger ?? 0, 1);
    });
    expect(canWalk(sim.world, 0)).toBe(true);
  });
});

describe('la draisine: réseau et sauvegarde', () => {
  it('donne la même pose, la même cible et les mêmes obstacles chez l’hôte et chez l’invité', () => {
    const sim = aboard();
    pump(sim, 5, 'alternate');
    // L'invité ne reçoit que l'état: ni graine, ni aléa, ni ce que l'hôte garde hors de l'état.
    const guest = structuredClone(sim.world);
    guest.seed = 0;
    guest.rng = [1, 2, 3, 4];
    expect(poseOf(content, guest)).toEqual(poseOf(content, sim.world));
    expect(canWalk(guest, 1)).toBe(false);
    expect(aimOf({ content, world: guest }, 1)).toBeNull();
    // L'état du véhicule part avec la tranche lente du lieu, et passe son schéma chez l'invité.
    const slow = v.parse(
      PlaceSlowSchema,
      JSON.parse(JSON.stringify(slowOfPlace(place(sim.world)))),
    );
    expect(slow.vehicles?.draisine).toEqual(vehicle(sim));
    expect(JSON.stringify(slow.vehicles).length).toBeLessThan(260);

    // À l'arrêt, un joueur descendu: même cible « Monter », mêmes cases prises.
    hold(sim, 4, [{ run: true }, {}]);
    hold(sim, 0.1);
    hold(sim, 0.1, [{}, { moveY: 1 }]);
    // Descendu, il tourne le dos à la draisine: il se retourne vers elle.
    sim.world.players[1].body.facing = -Math.PI / 2;
    tick(sim);
    const parked = structuredClone(sim.world);
    const hostAim = aimOf(sim, 1);
    expect(hostAim).toMatchObject({ id: 'vehicule-draisine', verb: 'Monter' });
    expect(aimOf({ content, world: parked }, 1)).toEqual(hostAim);
    const mine = Uint8Array.from(currentBlockers(content, sim.world)?.props ?? []);
    const theirs = Uint8Array.from(currentBlockers(content, parked)?.props ?? []);
    expect(theirs).toEqual(mine);
    expect(mine.some((cell) => cell === 1)).toBe(true);
  });

  it('se reprend où elle était: posée sur la voie à l’arrêt, joueurs descendus; ou rangée', () => {
    const sim = aboard();
    pump(sim, 5, 'alternate');
    const at = vehicle(sim).s;
    expect(vehicle(sim).speed).toBeGreaterThan(3);
    const saved = JSON.parse(JSON.stringify(snapshotOf(sim.world))) as { data: unknown };
    const restored = restoreWorld(content, { dataSchema: DATA_SCHEMA, data: saved.data }, MEMBERS);
    if (!restored.ok) throw new Error(restored.reason);
    const resumed = createSim(content, restored.world);
    expect(vehicle(resumed)).toMatchObject({
      out: true,
      s: at,
      speed: 0,
      brake: false,
      riders: [null, null],
    });
    const blocked = currentBlockers(content, resumed.world);
    if (blocked === null) throw new Error('obstacles absents');
    for (const player of resumed.world.players) {
      expect(bodyCollides(blocked, player.body.x, player.body.y, 0.3)).toBe(false);
      expect(Math.hypot(player.body.x - at, player.body.y - TRACK_Y)).toBeLessThan(4);
    }
    expect(canWalk(resumed.world, 0)).toBe(true);
    // On y remonte comme avant.
    put(resumed, 0, at + 0.9, 98.6, -Math.PI / 2);
    expect(aimOf(resumed, 0)).toMatchObject({ id: 'vehicule-draisine', refusal: null });

    // Rangée: elle le reste.
    const garaged = keyed();
    tick(garaged, [0]);
    tick(garaged, [0]);
    const again = restoreWorld(
      content,
      { dataSchema: DATA_SCHEMA, data: JSON.parse(JSON.stringify(garaged.world)) as unknown },
      MEMBERS,
    );
    if (!again.ok) throw new Error(again.reason);
    expect(again.world.places[AUBRUNE]?.vehicles?.draisine?.out).toBe(false);
  });

  it('migration: une sauvegarde d’avant la draisine se relit, la draisine dans sa remise', () => {
    // Le champ `vehicles` du lieu est facultatif: le format ne monte pas, aucune migration à écrire.
    const old = referenceSave(DATA_SCHEMA);
    expect(JSON.stringify(old.data)).not.toContain('"vehicles"');
    const base = contentWith(() => undefined);
    const restored = restoreWorld(base, old, MEMBERS);
    if (!restored.ok) throw new Error(restored.reason);
    for (const state of Object.values(restored.world.places))
      expect(state.vehicles).toBeUndefined();
    // Une partie d'Aubrune sans le champ: la draisine est à la remise, prête à sortir.
    const sim = keyed();
    const stripped = JSON.parse(JSON.stringify(sim.world)) as WorldState;
    delete stripped.places[AUBRUNE]?.vehicles;
    const back = restoreWorld(content, { dataSchema: DATA_SCHEMA, data: stripped }, MEMBERS);
    if (!back.ok) throw new Error(back.reason);
    const resumed = createSim(content, back.world);
    put(resumed, 0, 219.3, 92.5, 0);
    expect(aimOf(resumed, 0)).toMatchObject({ id: 'remise-draisine', verb: 'Sortir la draisine' });
    expect(poseOf(content, resumed.world).x).toBeGreaterThan(221);
  });
});

describe('véhicule de voie: gabarit', () => {
  it('un véhicule factice ajouté par un seul fichier sort, se monte et roule, sans une ligne de moteur', () => {
    const path = fileURLToPath(new URL('../donnees/_gabarits/vehicule.jsonc', import.meta.url));
    const sheet = JSON.parse(stripComments(readFileSync(path, 'utf8'))) as Json;
    sheet.id = 'velorail';
    const world = aubrune((files) => {
      files['lieux/aubrune/vehicules/velorail.json'] = sheet;
    });
    expect(Object.keys(world.places[AUBRUNE]?.vehicles ?? {}).sort()).toEqual([
      'draisine',
      'velorail',
    ]);
    // Sans la clé de la draisine: seule la porte du vélorail répond (il sort sans condition).
    const sim = newSim(world);
    put(sim, 0, 219.3, 92.5, 0);
    expect(aimOf(sim, 0)).toMatchObject({ id: 'remise-velorail', verb: 'Sortir le vélorail' });
    tick(sim, [0]);
    put(sim, 0, LAUNCH_X + 0.9, 98.6, -Math.PI / 2);
    put(sim, 1, LAUNCH_X - 0.9, 98.6, -Math.PI / 2);
    tick(sim, [0, 1]);
    expect(vehicle(sim, 'velorail').riders).toEqual([0, 1]);
    pump(sim, 60, 'alternate', 0.45, 'velorail');
    // Ses butées à lui (le passage `pnh` moins 4 m), sa vitesse de pointe à lui (6 m/s).
    const state = vehicle(sim, 'velorail');
    expect(state.speed).toBe(0);
    expect(state.s).toBeGreaterThan(280);
    expect(state.s).toBeLessThanOrEqual(287.5 + 1e-6);
    expect(sim.world.progress.memory['exemple.vehicule.aller']).toBeUndefined();
    expect(place(sim.world).vehicles?.draisine).toBeUndefined();
  });

  it('refuse une fiche dont la voie, un point ou un arrêt ne tient pas sur la carte', () => {
    const broken = (edit: (sheet: Json) => void): string => {
      try {
        aubrune((files) => {
          const sheet = structuredClone(files['lieux/aubrune/vehicules/draisine.json'] ?? {});
          sheet.id = 'faux';
          edit(sheet);
          files['lieux/aubrune/vehicules/faux.json'] = sheet;
        });
      } catch (error) {
        return String(error);
      }
      return '';
    };
    expect(broken((s) => (s.track = 'nulle-part'))).toMatch(/voie inconnue « nulle-part »/);
    expect(broken((s) => (s.launch = { point: 'inconnu' }))).toMatch(/point inconnu « inconnu »/);
    expect(broken((s) => (s.launch = { point: 'portail', shift: 30 }))).toMatch(/hors des butées/);
    expect(broken(() => undefined)).toBe('');
  });
});
