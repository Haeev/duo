// Robot longue vie (tour 8, section 6.1): profil assidu (R2, chaque habitant chaque jour), 84 jours.
import { it } from 'vitest';
import { playAndCheck } from './commun';

it('assidu, graine 99: 84 jours, reprise à chaque aube, invariants I-01 à I-06 et I-08', () => {
  playAndCheck({ name: 'assidu-99', seed: 99, profile: 'assidu' });
});
