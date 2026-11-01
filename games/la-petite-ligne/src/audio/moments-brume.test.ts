// Recette du tour 7 (qa-testeur, 2026-11-01), bug QA7-04: la boucle `mist-ambience` monte à
// pleine force à l'apogée (voulu, `climaxRampMs`), puis reste demandée à pleine force pendant
// tout l'état d'après, alors que la brume s'est levée et n'est plus dessinée (`after` de la brume:
// `at: null`), jusqu'à 8 h 30 (environ 45 s de jeu). Attendu: plus de boucle de brume une fois
// la brume levée. `it.fails` tant que le bug n'est pas corrigé: passer en `it` après la correction.
import { createRandom } from '@duo/sdk/sim';
import { describe, expect, it } from 'vitest';
import soundsFile from '../../assets/son/sons.json';
import { newSim } from '../../tests/aides';
import type { MomentToday } from '../etat/types';
import { newToday } from '../simulation/moments';
import { parseCatalogue } from './catalogue';
import type { SyncState } from './cerveau';
import type { LoopWish, SoundRequest } from './declencheurs';
import { MomentSounds } from './moments';
import { AUDIO_SETTINGS } from './reglages';

const catalogue = parseCatalogue(soundsFile);

function mistLoops(phase: MomentToday['phase'], elapsed: number): LoopWish[] {
  const sim = newSim(1);
  const def = sim.content.moments.find((m) => m.id === 'mist');
  if (def === undefined) throw new Error('brume absente');
  const today = newToday(sim, def, 'ambient');
  today.phase = phase;
  today.elapsed = elapsed;
  today.startTick = phase === 'waiting' ? null : 0;
  sim.world.moments.today = today;
  sim.world.phase = 'day';
  sim.world.clock.minutes = 7 * 60;
  const sounds = new MomentSounds(catalogue, AUDIO_SETTINGS, sim.content, sim.map, createRandom(1));
  const loops: LoopWish[] = [];
  const shots: SoundRequest[] = [];
  const syncs: SyncState[] = [];
  for (let i = 0; i < 3; i++) {
    loops.length = 0;
    sounds.update(sim.world, i * 0.1, shots, loops, syncs);
  }
  return loops.filter((l) => l.sound === 'mist-ambience');
}

describe('boucle de la brume (tour 7)', () => {
  it('attente à -6 dB, puis pleine force en 3 s au début de l’apogée (son.md)', () => {
    expect(mistLoops('waiting', 0).map((l) => l.gainDb)).toEqual([-6]);
    expect(mistLoops('climax', 1.5)[0]?.gainDb).toBeCloseTo(-3, 6);
    expect(mistLoops('climax', 3)[0]?.gainDb).toBeCloseTo(0, 6);
  });

  it('QA7-04: la brume levée (état d’après), sa boucle n’est plus demandée', () => {
    expect(mistLoops('after', 0)).toEqual([]);
  });
});
