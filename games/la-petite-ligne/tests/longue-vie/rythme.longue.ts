// Robot longue vie (tour 8, section 7.1, T8-26): 0,8 s par minute de jeu dès le jour 24 (D1),
// 84 jours sans blocage, graine 5.
import { it } from 'vitest';
import { playAndCheck } from './commun';

it('rythme de 0,8 s dès le jour 24, graine 5: 84 jours sans blocage, invariants I-01 à I-06 et I-08', () => {
  playAndCheck({ name: 'rythme-08-5', seed: 5, slowFrom: 24 });
});
