import { createRandom } from '@duo/sdk/sim';
import { describe, expect, it } from 'vitest';
import soundsFile from '../../assets/son/sons.json';
import { parseCatalogue } from './catalogue';
import { type BedWish, MUSIC, type MomentRules, type MusicCommand, MusicDirector, type MusicMoment, chooseBed, playTimeBeforeRest, positionOf } from './musique';

const catalogue = parseCatalogue(soundsFile);
const RULES: MomentRules = { dayStart: 360, afternoonFrom: 780, veilleeFrom: 1140, lastDay: { day: 8, end: 960 } };
const H = 60;

function moment(over: Partial<MusicMoment>): MusicMoment {
  return {
    phase: 'day',
    day: 2,
    minutes: 9 * H,
    veillee: false,
    localStatus: 'active',
    nearSaturdaySpot: false,
    saturdayWindow: false,
    silence: null,
    hold: null,
    now: 0,
    ...over,
  };
}

function bed(over: Partial<MusicMoment>): string | null {
  const out: BedWish = { id: null, rest: false, fadeOut: null };
  return chooseBed(moment(over), RULES, catalogue.restingMusic, out).id;
}

describe('choix de la musique selon le moment', () => {
  it('écran titre, petit-déjeuner, matin, après-midi, veillée, nuit', () => {
    expect(bed({ phase: 'creation' })).toBe(MUSIC.title);
    expect(bed({ phase: 'breakfast', minutes: 6 * H })).toBe(MUSIC.breakfast);
    expect(bed({ minutes: 6 * H })).toBe(MUSIC.morning);
    expect(bed({ minutes: 12 * H + 59 })).toBe(MUSIC.morning);
    expect(bed({ minutes: 13 * H })).toBe(MUSIC.afternoon);
    expect(bed({ minutes: 18 * H + 59 })).toBe(MUSIC.afternoon);
    expect(bed({ minutes: 19 * H + 30, veillee: true })).toBe(MUSIC.veillee);
    expect(bed({ phase: 'night', minutes: 22 * H })).toBe(MUSIC.night);
  });

  it('dehors après 19 h, et couché: les ambiances seules', () => {
    expect(bed({ minutes: 19 * H + 1 })).toBeNull();
    expect(bed({ minutes: 20 * H, localStatus: 'sleeping' })).toBeNull();
  });

  it('chez celui qui prend encore son petit-déjeuner quand l autre est sorti', () => {
    expect(bed({ phase: 'day', minutes: 6 * H + 20, localStatus: 'breakfast' })).toBe(MUSIC.breakfast);
  });

  it('le samedi, train à quai: près du quai et sur la place seulement', () => {
    expect(bed({ day: 8, minutes: 11 * H, saturdayWindow: true, nearSaturdaySpot: true })).toBe(MUSIC.saturday);
    expect(bed({ day: 8, minutes: 11 * H, saturdayWindow: true, nearSaturdaySpot: false })).toBe(MUSIC.morning);
    expect(bed({ day: 8, minutes: 11 * H, saturdayWindow: false, nearSaturdaySpot: true })).toBe(MUSIC.morning);
  });

  it('se tait après le départ du dernier train, et pendant les silences des séquences', () => {
    expect(bed({ day: 8, minutes: 16 * H })).toBeNull();
    expect(bed({ day: 8, minutes: 10 * H, silence: { fadeOut: 1.5 } })).toBeNull();
    expect(bed({ phase: 'ended' })).toBeNull();
  });

  it('retient le petit-déjeuner jusqu à la fin du réveil (coq, air du matin)', () => {
    const hold = { music: MUSIC.breakfast, until: 3.5, fadeOut: 2.5 };
    expect(bed({ phase: 'breakfast', hold, now: 1 })).toBeNull();
    expect(bed({ phase: 'breakfast', hold, now: 3.6 })).toBe(MUSIC.breakfast);
  });
});

function run(director: MusicDirector, wish: BedWish, from: number, to: number, step = 0.1): { t: number; c: MusicCommand }[] {
  const log: { t: number; c: MusicCommand }[] = [];
  for (let t = from; t <= to + 1e-9; t += step) for (const c of director.update(wish, t)) log.push({ t, c });
  return log;
}

describe('directeur de la musique', () => {
  const options = {
    music: catalogue.music,
    restLoops: catalogue.rest.playLoops,
    restSeconds: catalogue.rest.silenceSeconds,
    crossfadeSeconds: catalogue.mix.crossfadeSeconds,
    prefetchSeconds: 12,
  };

  it('joue une boucle complète, se repose 40 à 80 s, puis revient en fondu', () => {
    const director = new MusicDirector({ ...options, random: createRandom(5) });
    const wish: BedWish = { id: MUSIC.morning, rest: true, fadeOut: null };
    const log = run(director, wish, 0, 400);
    const starts = log.filter((e) => e.c.kind === 'start');
    const stops = log.filter((e) => e.c.kind === 'stop');
    const def = catalogue.music.get(MUSIC.morning);
    if (def === undefined) throw new Error('halte-matin absente');
    const loopTime = playTimeBeforeRest(def, 1);
    expect(loopTime).toBeCloseTo(97 - 1.12);
    expect(starts[0]?.t).toBe(0);
    // Le fondu de sortie finit sur la fin de la boucle.
    const firstStop = stops[0];
    expect(firstStop).toBeDefined();
    if (firstStop?.c.kind !== 'stop') throw new Error('arrêt attendu');
    expect(firstStop.t + firstStop.c.fadeOut).toBeCloseTo(loopTime, 0);
    const second = starts[1];
    expect(second).toBeDefined();
    const silence = (second?.t ?? 0) - loopTime;
    expect(silence).toBeGreaterThanOrEqual(40 - 0.11);
    expect(silence).toBeLessThanOrEqual(80 + 0.11);
    if (second?.c.kind !== 'start') throw new Error('départ attendu');
    expect(second.c.fadeIn).toBe(2.5);
    expect(second.c.offset).toBeCloseTo(1.12);
    // Décodage demandé avant la fin du repos.
    expect(log.some((e) => e.c.kind === 'prefetch' && e.t < second.t)).toBe(true);
  });

  it('passe du matin à l après-midi à la même position de lecture', () => {
    const director = new MusicDirector({ ...options, random: createRandom(1) });
    director.update({ id: MUSIC.morning, rest: true, fadeOut: null }, 0);
    const commands = director.update({ id: MUSIC.afternoon, rest: true, fadeOut: null }, 30);
    const start = commands.find((c) => c.kind === 'start');
    expect(commands.find((c) => c.kind === 'stop')).toEqual({ kind: 'stop', id: MUSIC.morning, fadeOut: 2.5 });
    expect(start).toEqual({ kind: 'start', id: MUSIC.afternoon, offset: 1.12 + 30, fadeIn: 2.5, at: 30 });
  });

  it('pendant un repos du matin, 13 h ne relance rien: l après-midi viendra après le silence', () => {
    const director = new MusicDirector({ ...options, random: createRandom(2) });
    run(director, { id: MUSIC.morning, rest: true, fadeOut: null }, 0, 100);
    expect(director.resting()).toBe(true);
    expect(director.update({ id: MUSIC.afternoon, rest: true, fadeOut: null }, 100.1)).toEqual([]);
    const later = run(director, { id: MUSIC.afternoon, rest: true, fadeOut: null }, 100.2, 200);
    expect(later.find((e) => e.c.kind === 'start')?.c).toMatchObject({ id: MUSIC.afternoon });
  });

  it('un autre moment interrompt le repos (la veillée commence)', () => {
    const director = new MusicDirector({ ...options, random: createRandom(2) });
    run(director, { id: MUSIC.afternoon, rest: true, fadeOut: null }, 0, 100);
    expect(director.resting()).toBe(true);
    expect(director.update({ id: MUSIC.veillee, rest: false, fadeOut: null }, 101)).toEqual([
      { kind: 'start', id: MUSIC.veillee, offset: 1.12, fadeIn: 2.5, at: 101 },
    ]);
  });

  it('change de musique en fondu et garde la fanfare demandée entre deux images', () => {
    const director = new MusicDirector({ ...options, random: createRandom(3) });
    director.update({ id: MUSIC.morning, rest: true, fadeOut: null }, 0);
    director.once(MUSIC.fanfare, 5);
    const commands = director.update({ id: null, rest: false, fadeOut: 1.5 }, 5);
    expect(commands).toEqual([
      { kind: 'once', id: MUSIC.fanfare, at: 5 },
      { kind: 'stop', id: MUSIC.morning, fadeOut: 1.5 },
    ]);
    expect(director.current()).toBeNull();
  });

  it('calcule la position dans la boucle', () => {
    const def = catalogue.music.get(MUSIC.morning);
    if (def === undefined) throw new Error('halte-matin absente');
    expect(positionOf(def, { startedAt: 0, offset: 1.12 }, 10)).toBeCloseTo(11.12);
    // Après la fin de boucle (97 s), on reprend à 1 s.
    expect(positionOf(def, { startedAt: 0, offset: 1.12 }, 96)).toBeCloseTo(1.12);
  });
});
