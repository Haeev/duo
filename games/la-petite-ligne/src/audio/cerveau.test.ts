// Le robot de la simulation joue toute la démo à deux; le cerveau du son l'écoute à chaque pas.
// On vérifie le plan de lecture de bout en bout: musiques par moment, séquences du train calées
// sur la simulation, réveil et coucher, effets de chaque action.
import { createRandom } from '@duo/sdk/sim';
import { beforeAll, describe, expect, it } from 'vitest';
import soundsFile from '../../assets/son/sons.json';
import { createRobot, newSim } from '../../tests/aides';
import type { TrainPhase } from '../etat/types';
import { SIM_DT, SIM_HZ } from '../simulation/constantes';
import { step } from '../simulation/pas';
import { AudioBrain } from './cerveau';
import { parseCatalogue } from './catalogue';
import { MUSIC } from './musique';
import { AUDIO_SETTINGS } from './reglages';

interface Entry {
  t: number;
  day: number;
  minutes: number;
  train: TrainPhase;
  kind: 'shot' | 'start' | 'stop' | 'once' | 'loop';
  id: string;
  placed: boolean;
}

interface Run {
  log: Entry[];
  /** Temps de la première image de chaque phase du train, par jour. */
  trainAt: Map<string, number>;
  mornings: number[];
  ambienceSeen: Map<string, number>;
  maxBedTracks: number;
  ended: boolean;
}

const MAX_TICKS = SIM_HZ * 60 * 120;
const AFTER_END_SECONDS = 5;
/** Le robot passe les écrans en un pas; des joueurs y restent un moment (création, petit-déjeuner, nuit). */
const SCREEN_DWELL_SECONDS = 8;
const SCREEN_INTENTS = new Set(['create_character', 'start_day', 'night_choice']);

function playDemo(): Run {
  const catalogue = parseCatalogue(soundsFile);
  const sim = newSim();
  const robot = createRobot();
  const brain = new AudioBrain({ catalogue, settings: AUDIO_SETTINGS, content: sim.content, map: sim.map, random: createRandom(99) });
  const run: Run = { log: [], trainAt: new Map(), mornings: [], ambienceSeen: new Map(), maxBedTracks: 0, ended: false };
  const playing = new Set<string>();
  let t = 0;
  let endedAt: number | null = null;
  let screen = '';
  let screenSince = 0;
  for (let tick = 0; tick < MAX_TICKS; tick += 1) {
    if (endedAt !== null && t - endedAt > AFTER_END_SECONDS) break;
    const decision = robot.decide(sim);
    const me = sim.world.characters.find((c) => c.id === 'p1');
    const onScreen = `${sim.world.phase}:${me?.status ?? ''}:${sim.world.clock.day}`;
    if (onScreen !== screen) {
      screen = onScreen;
      screenSince = t;
    }
    if (t - screenSince < SCREEN_DWELL_SECONDS) {
      decision.intents = decision.intents.filter((a) => !SCREEN_INTENTS.has(a.intent.type));
    }
    step(sim, decision);
    t += SIM_DT;
    const w = sim.world;
    if (sim.events.some((e) => e.type === 'morning')) run.mornings.push(t);
    const key = `${w.clock.day}:${w.train.phase}`;
    if (!run.trainAt.has(key)) run.trainAt.set(key, t);
    const frame = brain.update({ world: w, local: 'p1', events: sim.events, dt: SIM_DT, alpha: 1, gameTime: t, musicTime: t, yaw: AUDIO_SETTINGS.listener.defaultYaw });
    const base = { t, day: w.clock.day, minutes: w.clock.minutes, train: w.train.phase };
    for (const shot of frame.shots) run.log.push({ ...base, kind: 'shot', id: shot.sound, placed: shot.at !== null });
    for (const loop of frame.loops) run.log.push({ ...base, kind: 'loop', id: loop.sound, placed: loop.at !== null });
    for (const c of frame.music) {
      if (c.kind === 'prefetch') continue;
      run.log.push({ ...base, kind: c.kind, id: c.id, placed: false });
      if (c.kind === 'start') playing.add(c.id);
      if (c.kind === 'stop') playing.delete(c.id);
    }
    run.maxBedTracks = Math.max(run.maxBedTracks, playing.size);
    for (const [id, gain] of frame.ambience) if (gain > 0) run.ambienceSeen.set(id, (run.ambienceSeen.get(id) ?? 0) + 1);
    if (w.phase === 'ended' && endedAt === null) {
      endedAt = t;
      run.ended = true;
    }
  }
  return run;
}

describe('le son de toute la démo, joué par le robot', () => {
  let run: Run;
  // Toute la démo: plusieurs secondes quand les fichiers de test tournent en parallèle.
  beforeAll(() => {
    run = playDemo();
  }, 120_000);

  const shots = (id: string, day?: number): Entry[] => run.log.filter((e) => e.kind === 'shot' && e.id === id && (day === undefined || e.day === day));
  const music = (kind: Entry['kind'], id: string): Entry[] => run.log.filter((e) => e.kind === kind && e.id === id);

  it('va jusqu au bout de la démo', () => {
    expect(run.ended).toBe(true);
    // Deux semaines: un matin par jour après le premier, jusqu'au train du jour 15.
    expect(run.mornings).toHaveLength(14);
  });

  it('écran titre, puis les musiques de chaque moment', () => {
    const starts = run.log.filter((e) => e.kind === 'start');
    expect(starts[0]?.id).toBe(MUSIC.title);
    for (const id of [MUSIC.breakfast, MUSIC.morning, MUSIC.afternoon, MUSIC.veillee, MUSIC.night, MUSIC.saturday]) {
      expect(music('start', id).length, id).toBeGreaterThan(0);
    }
    // Jamais plus de deux musiques de fond à la fois (le temps d'un fondu enchaîné).
    expect(run.maxBedTracks).toBeLessThanOrEqual(2);
  });

  it('chaque matin: le coq, l air du réveil, puis le petit-déjeuner à 3,5 s', () => {
    const breakfasts = music('start', MUSIC.breakfast);
    for (const m of run.mornings) {
      expect(shots('wake-rooster').some((e) => Math.abs(e.t - m) < 0.1)).toBe(true);
      expect(shots('wake').some((e) => Math.abs(e.t - (m + 1.6)) < 0.1)).toBe(true);
      const b = breakfasts.find((e) => e.t >= m && e.t < m + 10);
      expect(b, `petit-déjeuner après le matin à ${m}`).toBeDefined();
      expect((b?.t ?? 0) - m).toBeGreaterThanOrEqual(3.5 - 0.05);
    }
  });

  it('chaque soir couché: l endormissement, puis la musique de nuit', () => {
    expect(shots('sleep').length).toBeGreaterThanOrEqual(7);
    expect(music('start', MUSIC.night).length).toBeGreaterThanOrEqual(7);
  });

  it('samedi 8: sifflet et approche avant 10 h, arrêt du train sur le jet de vapeur, puis la fanfare une fois', () => {
    const stoppedAt = run.trainAt.get('8:stopped');
    const arrivingAt = run.trainAt.get('8:arriving');
    expect(stoppedAt).toBeDefined();
    expect(arrivingAt).toBeDefined();
    const whistle = [...shots('train-whistle', 8), ...shots('train-whistle-far', 8)].sort((a, b) => a.t - b.t)[0];
    expect(whistle).toBeDefined();
    expect(whistle?.minutes ?? 0).toBeLessThan(600);
    expect((arrivingAt ?? 0) - (whistle?.t ?? 0)).toBeCloseTo(12.3, 0);
    const order = ['train-approach', 'station-bell', 'train-brake', 'train-steam'].map((id) => shots(id, 8)[0]?.t ?? Number.NaN);
    expect(order.every((x, i) => i === 0 || x > (order[i - 1] ?? 0))).toBe(true);
    const steam = shots('train-steam', 8)[0];
    expect(Math.abs((steam?.t ?? 0) - (stoppedAt ?? 0))).toBeLessThanOrEqual(SIM_DT * 1.5);
    // Une fanfare par arrivée du train (jours 8 et 15): celle du jour 8 une seule fois.
    const fanfares = music('once', MUSIC.fanfare).filter((e) => e.day === 8);
    expect(fanfares).toHaveLength(1);
    expect((fanfares[0]?.t ?? 0) - (steam?.t ?? 0)).toBeCloseTo(0.3, 1);
    // La musique de fond s'efface avant la fanfare.
    const stopsBefore = run.log.filter((e) => e.kind === 'stop' && e.day === 8 && e.t <= (fanfares[0]?.t ?? 0) && e.t > (whistle?.t ?? 0));
    expect(stopsBefore.length).toBeGreaterThan(0);
  });

  it('la locomotive tourne au ralenti à quai, et se tait au départ', () => {
    const idle = run.log.filter((e) => e.kind === 'loop' && e.id === 'train-idle-loop');
    expect(idle.some((e) => e.day === 1)).toBe(true);
    expect(idle.some((e) => e.day === 8)).toBe(true);
    expect(idle.every((e) => e.train === 'stopped')).toBe(true);
  });

  it('les deux départs (jours 1 et 8): cloche, sifflet de Firmin, sifflet, et le train s ébranle à 16 h', () => {
    for (const day of [1, 8]) {
      const departingAt = run.trainAt.get(`${day}:departing`);
      expect(departingAt, `départ du jour ${day}`).toBeDefined();
      const depart = shots('train-depart', day)[0];
      expect(depart).toBeDefined();
      expect(Math.abs((depart?.t ?? 0) - (departingAt ?? 0))).toBeLessThanOrEqual(SIM_DT * 1.5);
      expect((depart?.t ?? 0) - (shots('station-bell', day).at(-1)?.t ?? 0)).toBeCloseTo(4.6, 0);
      expect(shots('guard-whistle', day)).toHaveLength(1);
    }
  });

  it('l air de fin, une fois, à l écran de fin', () => {
    const fin = music('once', MUSIC.ending);
    expect(fin).toHaveLength(1);
  });

  it('chaque action P0 a son son (demo.md 4.2)', () => {
    const expected = [
      'step-grass',
      'step-path',
      'step-stone',
      'step-wood',
      'hoe',
      'sow',
      'water',
      'water-fill',
      'harvest',
      'axe-chop',
      'tree-crack',
      'tree-fall',
      'saw-end',
      'hammer',
      'build-done',
      'furniture-place',
      'door-open',
      'door-close',
      'eat',
      'hen',
      'crate-deposit',
      'coins',
      'journal-new',
      'duo-hop',
      'duo-done',
      'pickup',
      'bag',
      'notify',
      'order-stamp',
    ];
    const missing = expected.filter((id) => shots(id).length === 0);
    expect(missing).toEqual([]);
    const loops = new Set(run.log.filter((e) => e.kind === 'loop').map((e) => e.id));
    for (const id of ['saw-loop', 'duo-carry-loop', 'train-idle-loop']) expect(loops.has(id), id).toBe(true);
    // Au moins un motif d'habitant à l'ouverture d'une conversation.
    expect(run.log.some((e) => e.kind === 'shot' && e.id.startsWith('talk-'))).toBe(true);
  });

  it('les sons du monde sont placés, ceux de l interface non', () => {
    for (const id of ['hoe', 'harvest', 'axe-chop', 'door-open', 'hen']) expect(shots(id).every((e) => e.placed), id).toBe(true);
    for (const id of ['coins', 'journal-new', 'notify', 'sleep']) expect(shots(id).every((e) => !e.placed), id).toBe(true);
  });

  it('les ambiances du matin, du soir et de la pluie du jour 4 ont sonné', () => {
    for (const id of ['river', 'wind', 'birds-morning', 'crickets', 'village', 'rain', 'rain-roof']) {
      expect(run.ambienceSeen.get(id) ?? 0, id).toBeGreaterThan(0);
    }
  });
});
