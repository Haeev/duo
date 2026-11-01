// Robot longue vie (tour 8, section 6.1, T8-26): 84 jours, profil médian, graine 1.
import { it } from 'vitest';
import { playAndCheck } from './commun';

it('médian, graine 1: 84 jours, reprise à chaque aube, invariants I-01 à I-06 et I-08', () => {
  playAndCheck({ name: 'median-1', seed: 1 });
});
