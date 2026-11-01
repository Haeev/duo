// Sons des moments rares (tour 6): décodage quand le moment s'installe, sons datés de l'apogée
// joués une fois à leur instant et placés à leur bête, volée des oies qui suit l'oie de tête,
// grillons à -6 dB en attente puis à pleine force, musique atténuée pendant l'apogée.
import { createRandom } from '@duo/sdk/sim';
import { describe, expect, it } from 'vitest';
import soundsFile from '../../assets/son/sons.json';
import { newSim } from '../../tests/aides';
import { actorPose } from '../etat/moments';
import type { MomentToday } from '../etat/types';
import type { Sim } from '../simulation/contexte';
import { SIM_DT } from '../simulation/constantes';
import { newToday } from '../simulation/moments';
import { parseCatalogue } from './catalogue';
import type { SyncState } from './cerveau';
import type { LoopWish, SoundRequest } from './declencheurs';
import { MomentSounds } from './moments';
import { AUDIO_SETTINGS } from './reglages';

const catalogue = parseCatalogue(soundsFile);

function setup(id: string, phase: MomentToday['phase']): { sim: Sim; sounds: MomentSounds; today: MomentToday } {
  const sim = newSim(3);
  const def = sim.content.moments.find((m) => m.id === id);
  if (def === undefined) throw new Error(`moment ${id} absent`);
  const today = newToday(sim, def, def.mode === 'ambient' ? 'ambient' : 'quest');
  today.phase = phase;
  today.startTick = phase === 'climax' ? sim.world.tick : null;
  sim.world.moments.today = today;
  // Les moments ne sonnent qu'en journée (QA6-05).
  sim.world.phase = 'day';
  const sounds = new MomentSounds(catalogue, AUDIO_SETTINGS, sim.content, sim.map, createRandom(1));
  return { sim, sounds, today };
}

interface Frame {
  shots: SoundRequest[];
  loops: LoopWish[];
  syncs: SyncState[];
}

/** Joue la chorégraphie pas à pas; renvoie les sons de chaque image avec leur instant. */
function playClimax(sim: Sim, sounds: MomentSounds, today: MomentToday, seconds: number): { t: number; frame: Frame }[] {
  const out: { t: number; frame: Frame }[] = [];
  for (let t = 0; t <= seconds + 1e-9; t += SIM_DT) {
    today.elapsed = t;
    const frame: Frame = { shots: [], loops: [], syncs: [] };
    sounds.update(sim.world, t, frame.shots, frame.loops, frame.syncs);
    out.push({ t, frame });
  }
  return out;
}

describe('sons des moments rares', () => {
  it('décode les sons du moment du jour dès qu’il s’installe, et les libère quand il s’en va', () => {
    const { sim, sounds, today } = setup('heron', 'absent');
    sounds.update(sim.world, 0, [], [], []);
    const files = [...sounds.files()];
    expect(files.length).toBeGreaterThan(0);
    expect(files.every((f) => f.startsWith('moments/heron-'))).toBe(true);
    today.phase = 'gone';
    sounds.update(sim.world, 1, [], [], []);
    expect(sounds.files().size).toBe(0);
  });

  it('joue chaque son daté de l’apogée du héron une fois, à son instant, placé au héron', () => {
    const { sim, sounds, today } = setup('heron', 'climax');
    const def = sim.content.moments.find((m) => m.id === 'heron');
    if (def === undefined) throw new Error('héron absent');
    const frames = playClimax(sim, sounds, today, def.climax.seconds);
    const played = frames.flatMap(({ t, frame }) => frame.shots.map((s) => ({ t, s })));
    for (const [at, name] of def.climax.sounds) {
      const id = name.replaceAll('_', '-');
      const hits = played.filter((p) => p.s.sound === id);
      expect(hits, name).toHaveLength(1);
      const hit = hits[0];
      if (hit === undefined) continue;
      expect(hit.t).toBeGreaterThanOrEqual(at - 1e-9);
      expect(hit.t - at).toBeLessThan(SIM_DT + 1e-9);
      today.elapsed = hit.t;
      const pose = actorPose(sim.map, def, today, 'heron');
      expect(hit.s.at?.x).toBeCloseTo(pose?.x ?? Number.NaN, 6);
      expect(hit.s.at?.y).toBeCloseTo(pose?.y ?? Number.NaN, 6);
    }
    // La musique descend pendant l'apogée.
    expect(sounds.duckDb()).toBe(sim.content.settings.moments.musicDuckDb);
  });

  it('fait suivre l’oie de tête à la volée, puis la laisse finir', () => {
    const { sim, sounds, today } = setup('geese', 'climax');
    const def = sim.content.moments.find((m) => m.id === 'geese');
    if (def === undefined) throw new Error('oies absentes');
    const frames = playClimax(sim, sounds, today, def.climax.seconds);
    const flight = frames.flatMap(({ t, frame }) => frame.syncs.filter((s) => s.sound === 'geese-flight').map((s) => ({ t, s })));
    expect(flight.length).toBeGreaterThan(100);
    const start = def.climax.sounds.find(([, n]) => n === 'geese_flight')?.[0] ?? 0;
    const mid = flight.find((f) => f.t > start + 2);
    if (mid === undefined) throw new Error('volée absente');
    today.elapsed = mid.t;
    const leader = actorPose(sim.map, def, today, 'goose');
    expect(mid.s.at?.x).toBeCloseTo(leader?.x ?? Number.NaN, 6);
    expect(mid.s.expected).toBeCloseTo(mid.t - start, 6);
    expect(flight.at(-1)?.s.expected).toBeNull();
    // Les murmures des oies posées s'arrêtent à l'envol.
    expect(frames.some(({ frame }) => frame.loops.some((l) => l.sound === 'geese-rest'))).toBe(false);
  });

  it('les grillons: -6 dB en attente, pleine force en 4 s pendant l’apogée', () => {
    const { sim, sounds, today } = setup('glowworms', 'waiting');
    const loops: LoopWish[] = [];
    sounds.update(sim.world, 0, [], loops, []);
    expect(loops.find((l) => l.sound === 'crickets-night')?.gainDb).toBeCloseTo(-6, 6);
    today.phase = 'climax';
    today.phaseTick += 1;
    today.elapsed = 2;
    loops.length = 0;
    sounds.update(sim.world, 1, [], loops, []);
    expect(loops.find((l) => l.sound === 'crickets-night')?.gainDb).toBeCloseTo(-3, 6);
    today.elapsed = 5;
    loops.length = 0;
    sounds.update(sim.world, 2, [], loops, []);
    expect(loops.find((l) => l.sound === 'crickets-night')?.gainDb).toBeCloseTo(0, 6);
  });

  it('l’échelle lâchée fige aussi le son: rien ne rejoue pendant la pause', () => {
    const { sim, sounds, today } = setup('ladder', 'climax');
    const first: SoundRequest[] = [];
    for (let t = 0; t <= 2; t += SIM_DT) {
      today.elapsed = t;
      sounds.update(sim.world, t, first, [], []);
    }
    const steps = first.filter((s) => s.sound === 'ladder-step').length;
    expect(steps).toBeGreaterThanOrEqual(3);
    const paused: SoundRequest[] = [];
    for (let i = 0; i < 60; i += 1) sounds.update(sim.world, 2 + i * SIM_DT, paused, [], []);
    expect(paused).toEqual([]);
  });
});
