// Recette du tour 6 (qa-testeur, 2026-10-31), bug QA6-05: une boucle de moment (les grillons des
// vers luisants) reste demandée à pleine force sur l'écran de nuit quand les deux se couchent
// avant la fin du moment (22 h 07 pour les robots, moment présent jusqu'à 23 h 30). La simulation
// ne fait plus avancer les moments hors de la journée, et le cerveau audio lit encore `after`.
// `it.fails` tant que le bug n'est pas corrigé: passer en `it` après la correction.
import { createRandom } from '@duo/sdk/sim';
import { describe, expect, it } from 'vitest';
import soundsFile from '../../assets/son/sons.json';
import { newSim } from '../../tests/aides';
import type { MomentToday, WorldState } from '../etat/types';
import { newToday } from '../simulation/moments';
import { parseCatalogue } from './catalogue';
import type { SyncState } from './cerveau';
import type { LoopWish, SoundRequest } from './declencheurs';
import { MomentSounds } from './moments';
import { AUDIO_SETTINGS } from './reglages';

const catalogue = parseCatalogue(soundsFile);

function loopsAt(phase: WorldState['phase'], momentPhase: MomentToday['phase']): LoopWish[] {
  const sim = newSim(3);
  const def = sim.content.moments.find((m) => m.id === 'glowworms');
  if (def === undefined) throw new Error('vers luisants absents');
  const today = newToday(sim, def, 'ambient');
  today.phase = momentPhase;
  sim.world.moments.today = today;
  sim.world.phase = phase;
  sim.world.clock.minutes = 22 * 60 + 7;
  const sounds = new MomentSounds(catalogue, AUDIO_SETTINGS, sim.content, sim.map, createRandom(1));
  const loops: LoopWish[] = [];
  const shots: SoundRequest[] = [];
  const syncs: SyncState[] = [];
  for (let i = 0; i < 3; i++) {
    loops.length = 0;
    sounds.update(sim.world, i * 0.1, shots, loops, syncs);
  }
  return loops;
}

describe('sons des moments hors de la journée', () => {
  it('en journée, après l’apogée des vers luisants, les grillons restent (référence)', () => {
    expect(loopsAt('day', 'after').map((l) => l.sound)).toContain('crickets-night');
  });

  it('QA6-05: sur l’écran de nuit, aucune boucle de moment n’est demandée', () => {
    expect(loopsAt('night', 'after')).toEqual([]);
    expect(loopsAt('night', 'waiting')).toEqual([]);
  });
});
