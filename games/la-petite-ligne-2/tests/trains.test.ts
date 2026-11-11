// Trains des événements (`simulation/monde/trains.ts`): position selon l'heure, égalité de l'hôte
// et de l'invité, chargement en plein événement, emprise qui barre la voie et joueur dégagé, train
// factice ajouté par les seules données. Tests courts, graine fixe.
import { describe, expect, it } from 'vitest';
import { ContentError, type Content } from '../src/donnees/charger';
import { DATA_SCHEMA, type WorldState } from '../src/etat/monde';
import { restoreWorld, snapshotOf } from '../src/sauvegarde/sauvegarde';
import { calendarOf } from '../src/simulation/monde/calendrier';
import {
  crossingBellRinging,
  inTrainWay,
  levelCrossings,
  trainPoses,
  type TrainPose,
} from '../src/simulation/monde/trains';
import { isBlockedCell } from '../src/simulation/noyau/grille';
import { skipToMorning } from '../src/simulation/noyau/horloge';
import { currentBlockers } from '../src/simulation/noyau/obstacles';
import { createSim, type Sim } from '../src/simulation/noyau/pas';
import { remember } from '../src/simulation/regles/memoire';
import { contentWith, contextOf, wait } from './aides-l3';
import { MEMBERS, newSim } from './aides';

type Json = Record<string, unknown>;
const AUBRUNE = 'aubrune';
/** Rail du quai: la voie `ligne` d'Aubrune court à y = 97,5 devant le quai. */
const TRACK_Y = 97.5;

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

/** Aubrune un samedi après l'acte 2, à l'heure dite, joueurs posés sur le quai. */
function saturday(minutes: number, world?: Content): Sim {
  const sim = newSim(world ?? content);
  sim.world.common.day = SATURDAY ?? 6;
  sim.world.minutes = minutes;
  remember(contextOf(sim), 'aubrune.acte2.fini', true, 'duo');
  for (const p of [0, 1] as const) {
    sim.world.players[p].body.x = 200 + p;
    sim.world.players[p].body.y = 101.5;
  }
  return sim;
}

function poses(world: WorldState, c: Content = content): TrainPose[] {
  const pool: TrainPose[] = [];
  const count = trainPoses({ content: c, world }, AUBRUNE, world.minutes, pool);
  return pool.slice(0, count);
}

function only(world: WorldState): TrainPose {
  const list = poses(world).filter((p) => p.event === 'train-du-samedi');
  expect(list).toHaveLength(1);
  const pose = list[0];
  if (pose === undefined) throw new Error('pas de train');
  return pose;
}

describe('trains des événements', () => {
  it("arrive en ralentissant, s'arrête la voiture au droit du quai, repart en accélérant", () => {
    const sim = saturday(604);
    const stopped = only(sim.world);
    expect(stopped.phase).toBe('stopped');
    const [engine, coach, van] = stopped.vehicles;
    // La voiture des voyageurs centrée au point `quai` (x 204), sur l'axe de la voie.
    expect(coach?.x).toBeCloseTo(204, 5);
    expect(coach?.y).toBeCloseTo(TRACK_Y, 5);
    // Locomotive en tête, à l'est (vers +x), fourgon en queue; tampons contre tampons.
    expect(engine?.model).toBe('tank-engine');
    expect((engine?.x ?? 0) - (coach?.x ?? 0)).toBeCloseTo(6.46 + 4.61, 5);
    expect((coach?.x ?? 0) - (van?.x ?? 0)).toBeCloseTo(6.46 + 4.96, 5);
    expect(engine?.yaw).toBeCloseTo(Math.PI / 2, 5);
    // Tout le train dans l'emprise du quai et de la halte, le passage à niveau (x 182,5) libre.
    expect((van?.x ?? 0) - 4.96).toBeGreaterThan(185.5);

    // Arrivée: 8 minutes et 100 m, décélération constante (à mi-temps, il reste un quart).
    sim.world.minutes = 600;
    const half = only(sim.world);
    expect(half.phase).toBe('arriving');
    expect(stopped.head - half.head).toBeCloseTo(25, 5);
    sim.world.minutes = 603;
    expect(stopped.head - only(sim.world).head).toBeCloseTo(100 / 64, 5);
    // Départ: refoulé vers l'ouest, un quart du chemin à mi-temps.
    sim.world.minutes = 884;
    const leaving = only(sim.world);
    expect(leaving.phase).toBe('leaving');
    expect(stopped.head - leaving.head).toBeCloseTo(25, 5);
    // Hors de l'horaire, ou un autre jour, ou avant l'acte 2: aucun train.
    sim.world.minutes = 595;
    expect(poses(sim.world)).toHaveLength(0);
    sim.world.minutes = 889;
    expect(poses(sim.world)).toHaveLength(0);
    sim.world.minutes = 700;
    sim.world.common.day += 1;
    expect(poses(sim.world)).toHaveLength(0);
    const before = saturday(700);
    delete before.world.progress.memory['aubrune.acte2.fini'];
    expect(poses(before.world)).toHaveLength(0);
  });

  it("suit le tracé de la voie dans la courbe de l'est", () => {
    // Un train factice qui vient de l'est, par la courbe de la voie (x 304 à 362).
    const curved = aubrune((files) => {
      const event = structuredClone(
        files['lieux/aubrune/evenements/train-du-samedi.json'],
      ) as Json & { train: Json };
      event.id = 'train-de-la-courbe';
      event.train.comesFrom = 'end';
      event.train.leavesTo = 'end';
      event.train.arrival = { minutes: 8, distance: 150 };
      files['lieux/aubrune/evenements/train-de-la-courbe.json'] = event;
    });
    const sim = saturday(596.2, curved);
    const pose = poses(sim.world, curved).find((p) => p.event === 'train-de-la-courbe');
    expect(pose?.phase).toBe('arriving');
    // Le premier véhicule est encore dans la courbe: hors de l'axe droit, la caisse tournée.
    const head = pose?.vehicles[0];
    expect(head?.y ?? TRACK_Y).toBeLessThan(TRACK_Y - 0.5);
    const tilt = Math.abs(Math.sin(head?.yaw ?? 0));
    expect(tilt).toBeLessThan(0.999);
  });

  it("donne la même pose chez l'hôte et chez l'invité (rien que l'heure, le jour et les faits)", () => {
    const sim = saturday(601.37);
    // L'invité n'a ni la graine ni l'aléa: seulement ce que l'hôte lui transmet.
    const guest = structuredClone(sim.world);
    guest.seed = 0;
    guest.rng = [1, 2, 3, 4];
    expect(poses(guest)).toEqual(poses(sim.world));
    sim.world.minutes = 700;
    guest.minutes = 700;
    expect(poses(guest)).toEqual(poses(sim.world));
  });

  it('reprend une sauvegarde faite en plein événement: le train à quai, le joueur dégagé de la voie', () => {
    const sim = saturday(700);
    sim.world.players[0].body.x = 204;
    sim.world.players[0].body.y = TRACK_Y;
    const saved = JSON.parse(JSON.stringify(snapshotOf(sim.world))) as { data: unknown };
    const restored = restoreWorld(content, { dataSchema: DATA_SCHEMA, data: saved.data }, MEMBERS);
    if (!restored.ok) throw new Error(restored.reason);
    const resumed = createSim(content, restored.world);
    expect(only(resumed.world).phase).toBe('stopped');
    expect(poses(resumed.world)).toEqual(poses(sim.world));
    const body = resumed.world.players[0].body;
    expect(Math.abs(body.y - TRACK_Y)).toBeGreaterThan(1.7);
  });

  it('barre la voie sous le train, la rend libre après son départ, et après une nuit sautée', () => {
    const sim = saturday(700);
    const blocked = currentBlockers(sim.content, sim.world);
    if (blocked === null) throw new Error('obstacles absents');
    for (const x of [190, 204, 216]) expect(isBlockedCell(blocked, x, 97), `x ${x}`).toBe(true);
    // La bordure du quai reste libre: on y attend, on y monte.
    expect(isBlockedCell(blocked, 204, 99)).toBe(false);
    // Le passage à niveau du garde reste ouvert.
    expect(isBlockedCell(blocked, 182, 97)).toBe(false);
    sim.world.minutes = 900;
    const after = currentBlockers(sim.content, sim.world);
    expect(after === null ? true : isBlockedCell(after, 204, 97)).toBe(false);
    // Dormir saute au matin: plus de train, la voie est libre.
    sim.world.minutes = 700;
    skipToMorning(contextOf(sim));
    expect(poses(sim.world)).toHaveLength(0);
  });

  it('dégage sans dommage un joueur surpris sur la voie par le train qui arrive', () => {
    const sim = saturday(599.5);
    sim.world.players[1].body.x = 176;
    sim.world.players[1].body.y = TRACK_Y;
    const events = wait(sim, 0.2);
    // À 599,5 la rame entre: sa tête est à moins de 3 m du joueur (emprise allongée devant elle).
    expect(events.some((e) => e.type === 'unstuck' && e.player === 1)).toBe(true);
    const body = sim.world.players[1].body;
    expect(Math.abs(body.y - TRACK_Y)).toBeGreaterThan(1.7);
    expect(sim.world.players[1].needs.sleep).toBeGreaterThan(0);
  });

  it('pose un train factice ajouté par les seules données, et refuse une voie inconnue', () => {
    const fake = (track: string): Content =>
      aubrune((files) => {
        files['lieux/aubrune/evenements/train-factice.json'] = {
          schema: 1,
          id: 'train-factice',
          name: 'Train factice',
          kind: 'other',
          when: { type: 'weekly', weekday: 'monday', seasons: [] },
          days: 7,
          hours: { from: 720, to: 760 },
          conditions: [],
          announce: false,
          activates: { facts: [], shop: null, tune: null },
          train: {
            pourquoi: 'Un train de test, deux véhicules factices venus de la courbe.',
            consist: [
              { model: 'engin-factice', front: 3, back: 3 },
              { model: 'wagon-factice', front: 5, back: 5, reversed: true },
            ],
            track,
            comesFrom: 'end',
            leavesTo: 'start',
            stop: { point: 'quai', vehicle: 1, shift: 2 },
            arrival: { minutes: 4, distance: 60 },
            departure: { minutes: 4, distance: 60 },
          },
        };
      });
    const loaded = fake('ligne');
    const sim = saturday(730, loaded);
    const pose = poses(sim.world, loaded).find((p) => p.event === 'train-factice');
    expect(pose?.phase).toBe('stopped');
    // Venu de l'est: le wagon de queue est centré 2 m à l'ouest du point `quai`, tourné.
    expect(pose?.vehicles[1]?.x).toBeCloseTo(202, 5);
    expect(pose?.vehicles[1]?.model).toBe('wagon-factice');
    expect(pose?.vehicles[0]?.x).toBeCloseTo(202 - 5 - 3, 5);
    expect(Math.cos(pose?.vehicles[1]?.yaw ?? 0)).toBeCloseTo(0, 5);
    expect(() => fake('voie-perdue')).toThrow(ContentError);
  });

  it('trouve les passages à niveau de la carte: routes et rues, pas le chemin de planches du quai', () => {
    const place = content.places[AUBRUNE];
    if (place === undefined) throw new Error('Aubrune absent');
    const mids = levelCrossings(place).map((c) => Math.round(c.x * 2) / 2);
    // Le garde, la rue de l'Église, les Hameaux (`ouvrages` du plan); pas la traversée de service (214).
    expect(mids).toEqual([182.5, 259.5, 291.5]);
  });

  it("sonne dès l'approche, se tait quand la route est dégagée, et de même au départ", () => {
    const place = content.places[AUBRUNE];
    if (place === undefined) throw new Error('Aubrune absent');
    const sim = saturday(595.9);
    const ringing = (): boolean => crossingBellRinging(sim, place);
    const bells = (list: Sim['events']): boolean[] =>
      list.flatMap((e) => (e.type === 'crossing_bell' ? [e.ringing] : []));
    expect(ringing()).toBe(false);
    // Le freinage commence à 596 (8 minutes avant l'arrêt): la sonnerie part avec lui.
    expect(bells(wait(sim, 1))).toEqual([true]);
    // Elle sonne tant que la queue n'a pas passé la route, et se tait avant l'arrêt (604).
    sim.world.minutes = 600;
    expect(ringing()).toBe(true);
    sim.world.minutes = 603.5;
    expect(ringing()).toBe(false);
    expect(bells(wait(sim, 1))).toEqual([false]);
    // À quai, la route reste ouverte: aucune sonnerie.
    sim.world.minutes = 700;
    expect(ringing()).toBe(false);
    // Départ refoulé vers l'ouest à 880: la sonnerie part au démarrage, se tait quand il a passé.
    sim.world.minutes = 879.9;
    wait(sim, 0.1);
    expect(bells(wait(sim, 1))).toEqual([true]);
    sim.world.minutes = 887;
    expect(ringing()).toBe(false);
  });

  it("garde les habitants hors du chemin d'un train: ils passent ailleurs ou attendent, sans se figer", () => {
    // Un habitant dont le planning traverse la voie par la planche du quai (x 214) juste quand
    // la locomotive du samedi y est à l'arrêt: au nord (n2) jusqu'à 10 h 05, puis au quai est.
    const crossing = aubrune((files) => {
      const villager = files['lieux/aubrune/habitants/achille.json'] as { life: Json };
      const at = (point: string, from: number, to: number): Json => ({
        from,
        to,
        days: ['sat'],
        at: { point },
        activity: 'flaner',
        gesture: null,
      });
      // Deux lignes d'abord (la première qui convient l'emporte); le reste de sa vie suit.
      const schedule = villager.life.schedule as Json[];
      villager.life.schedule = [at('n2', 540, 605), at('quai-e', 605, 700), ...schedule];
    });
    const place = crossing.places[AUBRUNE];
    if (place === undefined) throw new Error('Aubrune absent');
    const sim = saturday(604.5, crossing);
    wait(sim, 1 / 30);
    const body = sim.world.places[AUBRUNE]?.villagers.achille?.body;
    if (body === undefined) throw new Error('habitant absent');
    expect(body.y).toBeLessThan(TRACK_Y - 2);
    let entered = 0;
    let inside = inTrainWay(sim, place, body.x, body.y, 0);
    // Une minute et demie de jeu réel: le temps de faire le tour par un passage à niveau.
    for (let k = 0; k < 2700; k++) {
      wait(sim, 1 / 30);
      const now = inTrainWay(sim, place, body.x, body.y, 0);
      if (now && !inside) entered += 1;
      inside = now;
    }
    expect(entered).toBe(0);
    // Il est arrivé de l'autre côté (pas figé au bord de la voie).
    expect(Math.hypot(body.x - 213.5, body.y - 102)).toBeLessThan(0.6);
  });
});
