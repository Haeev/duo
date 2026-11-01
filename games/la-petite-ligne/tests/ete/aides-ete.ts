/**
 * Robots d'été (tour 8, section 6): une partie jouée de bout en bout par les robots, qui restent à
 * la Halte au jour 15, avec sauvegarde et reprise à chaque aube. Relevés pour les tests longs
 * (`pnpm test:ete`) et pour le rapport du robot longue vie (qa-testeur).
 */
import { hashState } from '@duo/sdk/sim';
import type { Content } from '../../src/donnees/types';
import type { WorldState, Weather } from '../../src/etat/types';
import { restoreWorld, snapshotOf } from '../../src/sauvegarde/sauvegarde';
import type { Sim } from '../../src/simulation/contexte';
import { SIM_HZ } from '../../src/simulation/constantes';
import { step } from '../../src/simulation/pas';
import type { RobotProfile } from '../../src/simulation/robot';
import { createRobot, newSim } from '../aides';

const A = { id: 'membre-a', name: 'Camille', color: '#e07a5f' };
const B = { id: 'membre-b', name: 'Sacha', color: '#3d85c6' };
/** Blocage: l'heure de jeu n'avance plus pendant deux heures de simulation (L-01). */
const STALL_TICKS = SIM_HZ * 60 * 60 * 2;

export interface SummerRun {
  seed: number;
  profile: RobotProfile;
  /** Jour atteint, phase finale, étape ouverte à la fin. */
  day: number;
  phase: WorldState['phase'];
  stage: string | null;
  stalled: string | null;
  /** Aubes où l'état relu diffère de l'état sauvegardé (I-02). */
  resumeMismatches: number[];
  /** Octets de l'état à chaque aube (I-06). */
  bytesByDay: Record<number, number>;
  weather: Record<number, { weather: Weather; mist: boolean }>;
  /** Arbres debout à chaque aube (L-06). */
  treesByDay: Record<number, number>;
  orders: {
    number: number;
    day: number;
    linesDone: number;
    linesTotal: number;
    complete: boolean;
    amount: number;
  }[];
  /** Lignes des commandes générées tirées (L-05). */
  drawn: {
    number: number;
    train: number;
    lines: { item: string; count: number; share: number }[];
  }[];
  /** Répliques quotidiennes dites, par joueur: `[jour, identifiant]` (L-08). */
  dailyLines: Record<'p1' | 'p2', [number, string][]>;
  realMs: number;
}

/** Ce que `resume` remet à zéro chez un personnage (menus, visées, trajets, présence). */
const RESET_AT_RESUME = new Set([
  'titleReady',
  'endReady',
  'lastInputTick',
  'absent',
  'menu',
  'dialogue',
  'destination',
  'placement',
  'aim',
  'holding',
  'corner',
  'seat',
  'status',
  'action',
]);

/** L'état comparable avant et après une reprise (ce que `resume` remet à zéro est retiré). */
export function lasting(w: WorldState): unknown {
  const { characters, villagers, stages, ...rest } = structuredClone(w);
  return {
    ...rest,
    characters: characters.map((c) =>
      Object.fromEntries(Object.entries(c).filter(([k]) => !RESET_AT_RESUME.has(k))),
    ),
    villagers: villagers.map((v) => ({ ...v, talkingWith: [] })),
    stages: { passed: stages.passed, current: stages.current },
  };
}

export interface SummerOptions {
  seed: number;
  profile?: RobotProfile;
  content?: Content;
  /** Jusqu'où jouer (le jour 43 à 16 h, l'étape `summer_end`, par défaut). */
  until?: (sim: Sim) => boolean;
  maxTicks?: number;
}

export function playSummer(options: SummerOptions): SummerRun {
  const profile = options.profile ?? 'median';
  const t0 = Date.now();
  let sim = newSim(options.seed, options.content);
  let robot = createRobot({ stages: 'stay', profile });
  const until =
    options.until ??
    ((s: Sim): boolean => s.world.phase === 'ended' && s.world.stages.current === 'summer_end');
  const maxTicks = options.maxTicks ?? SIM_HZ * 60 * 60 * 30;
  const run: SummerRun = {
    seed: options.seed,
    profile,
    day: 0,
    phase: 'creation',
    stage: null,
    stalled: null,
    resumeMismatches: [],
    bytesByDay: {},
    weather: {},
    treesByDay: {},
    orders: [],
    drawn: [],
    dailyLines: { p1: [], p2: [] },
    realMs: 0,
  };
  let day = sim.world.clock.day;
  let ticks = 0;
  let lastTime = 0;
  let lastProgress = 0;
  while (!until(sim) && ticks < maxTicks) {
    step(sim, robot.decide(sim));
    ticks++;
    const w = sim.world;
    for (const e of sim.events) {
      if (e.type === 'order_drawn' && w.order.generated !== null) {
        run.drawn.push({
          number: e.number,
          train: e.train,
          lines: w.order.generated.lines.map((l) => ({ ...l })),
        });
      }
      if (e.type === 'talk') {
        const d = w.characters.find((c) => c.id === e.by)?.dialogue;
        if (d !== null && d !== undefined && sim.content.dialogues[d.dialogue]?.kind === 'daily')
          run.dailyLines[e.by].push([w.clock.day, d.dialogue]);
      }
    }
    const now = w.clock.day * 1440 + w.clock.minutes;
    if (now !== lastTime) {
      lastTime = now;
      lastProgress = ticks;
    } else if (w.phase !== 'ended' && ticks - lastProgress > STALL_TICKS) {
      run.stalled = `jour ${String(w.clock.day)}, ${String(Math.floor(w.clock.minutes))} min, ${String(w.clock.stoppedBy)}: ${robot.job('p1')} / ${robot.job('p2')}`;
      break;
    }
    if (w.clock.day !== day && w.phase === 'breakfast') {
      day = w.clock.day;
      run.bytesByDay[day] = JSON.stringify(w).length;
      run.weather[day] = { weather: w.weather, mist: w.morningMist };
      run.treesByDay[day] = w.trees.filter((t) => !t.felled).length;
      // Sauvegarde et reprise à chaque aube, en inversant hôte et invité (L-02).
      const snap = snapshotOf(sim);
      const before = hashState(lasting(snap.data));
      sim = restoreWorld(sim.content, sim.map, structuredClone(snap.data), snap.dataSchema, [B, A]);
      if (hashState(lasting(sim.world)) !== before) run.resumeMismatches.push(day);
      robot = createRobot({ stages: 'stay', profile });
    }
  }
  const w = sim.world;
  run.day = w.clock.day;
  run.phase = w.phase;
  run.stage = w.stages.current;
  run.orders = w.orderHistory.map((o) => ({ ...o }));
  run.realMs = Date.now() - t0;
  return run;
}
