// Recette du tour 7 (qa-testeur, 2026-11-01), bug QA7-05: la rumeur du bourg ne lit pas les
// conditions de saison (`season_is`, ajoutées au tour 7): en automne, elle promet des moments du
// printemps (oies, mésanges) ou du printemps et de l'été (chevrette, vers luisants), impossibles
// avant la fin de l'hiver qui suit (S-13: « seulement sur un moment possible d'ici la fin de la
// saison suivante »). Sans effet sur la démo (jours 1 à 15, printemps). `it.fails` tant que le bug
// n'est pas corrigé: passé en `it` après la correction (`possibleBefore` lit `season_is`).
import { describe, expect, it } from 'vitest';
import type { Content } from '../../donnees/types';
import { contentAndMap, newSim } from '../../../tests/aides';
import { rumorMoment } from '../modele-souvenirs';

/** Contenu sans fin au jour 15, comme au long cours (S-14, 372 journées). */
function longContent(): Content {
  const content = structuredClone(contentAndMap().content);
  content.settings.clock.lastDay.day = 400;
  return content;
}

describe('rumeur du bourg et saisons (S-13, au long cours)', () => {
  it('au printemps de la démo, la rumeur reste possible (référence)', () => {
    const content = contentAndMap().content;
    for (let seed = 1; seed <= 40; seed++) {
      const sim = newSim(seed, content);
      sim.world.clock.day = 3;
      for (const viewer of ['p1', 'p2'] as const) expect(rumorMoment(sim.world, content, viewer)).not.toBeNull();
    }
  });

  it('QA7-05: en automne (jours 43 à 63), aucune rumeur sur un moment du printemps ou de l’été seulement', () => {
    const content = longContent();
    const impossible = new Set(['geese', 'tits', 'roe_deer', 'glowworms']);
    const promised: string[] = [];
    for (let seed = 1; seed <= 40; seed++) {
      const sim = newSim(seed, content);
      sim.world.flags.push('nest_box_straight');
      for (const day of [45, 50, 55, 60]) {
        sim.world.clock.day = day;
        for (const viewer of ['p1', 'p2'] as const) {
          const def = rumorMoment(sim.world, content, viewer);
          if (def !== null && impossible.has(def.id)) promised.push(`graine ${String(seed)}, jour ${String(day)}, ${viewer}: ${def.id}`);
        }
      }
    }
    expect(promised).toEqual([]);
  });
});
