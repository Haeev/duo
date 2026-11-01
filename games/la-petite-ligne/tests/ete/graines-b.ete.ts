// Robots d'été (tour 8, T8-06, T8-16, T8-20): réglages livrés, profil médian, jusqu'au samedi 43.
import { describe, it } from 'vitest';
import { playSummer } from './aides-ete';
import { expectSummer, writeSummer } from './verifier-ete';

describe("robots d'été, graines de l'endurance", () => {
  for (const seed of [3, 7, 42]) {
    it(`graine ${String(seed)}: du jour 1 au samedi 43, reprise à chaque aube`, () => {
      const run = playSummer({ seed });
      writeSummer(run, `median-${String(seed)}`);
      expectSummer(run, 'médian');
    });
  }
});
