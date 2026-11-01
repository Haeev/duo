// Robots d'été (tour 8, section 6.1): profils assidu (R2) et glouton (arbres), et une partie au
// rythme de 0,8 s par minute dès le jour 24 (D1, T8-26), jusqu'au samedi 43.
import { describe, it } from 'vitest';
import { contentAndMap } from '../aides';
import { playSummer } from './aides-ete';
import { expectSummer, writeSummer } from './verifier-ete';

describe("robots d'été, profils et rythme", () => {
  it('profil assidu (chaque habitant chaque jour), graine 99', () => {
    const run = playSummer({ seed: 99, profile: 'assidu' });
    writeSummer(run, 'assidu-99');
    expectSummer(run, 'assidu');
  });

  it('profil glouton (tous les arbres debout chaque jour), graine 2026', () => {
    const run = playSummer({ seed: 2026, profile: 'glouton' });
    writeSummer(run, 'glouton-2026');
    expectSummer(run, 'glouton');
  });

  it('D1 à 0,8 s par minute dès le jour 24: la partie va au samedi 43 sans blocage, graine 5', () => {
    const content = structuredClone(contentAndMap().content);
    content.settings.clock.schedule = [
      { fromDay: 1, secondsPerGameMinute: 0.35 },
      { fromDay: 24, secondsPerGameMinute: 0.8 },
    ];
    const run = playSummer({ seed: 5, content });
    writeSummer(run, 'rythme-08-5');
    expectSummer(run, 'rythme 0,8 s');
  });
});
