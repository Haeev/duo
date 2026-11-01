// Robot longue vie (tour 8, section 6.1): profil glouton (tous les arbres debout chaque jour), 84 jours.
import { it } from 'vitest';
import { playAndCheck } from './commun';

it('glouton, graine 2026: 84 jours, reprise à chaque aube, invariants I-01 à I-06 et I-08', () => {
  playAndCheck({ name: 'glouton-2026', seed: 2026, profile: 'glouton' });
});
