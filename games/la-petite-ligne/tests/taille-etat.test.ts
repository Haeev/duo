// Taille de l'état (QA8-02, I-06): ce qui grossissait sans borne après la démo est compacté ou
// rangé, sans changer ce que les règles en lisent. Et le robot glouton ne rachète plus de matelas
// pour un lit qu'il a déjà (QA8-04).
import { describe, expect, it } from 'vitest';
import type { Sim } from '../src/simulation/contexte';
import { character, point, wrapWorld } from '../src/simulation/contexte';
import { MINUTES_PER_DAY } from '../src/simulation/constantes';
import { foldOldHeard, pickDialogue } from '../src/simulation/dialogues';
import { compactEnvieHistory } from '../src/simulation/envies';
import { morning } from '../src/simulation/horloge';
import { ITEM, POINT } from '../src/simulation/ids';
import { pruneLetters, WEEKLY_LETTER_DAYS, WEEKLY_LETTER_MAX_DAYS } from '../src/simulation/semaine';
import { dropAt, countInStacks } from '../src/simulation/sac';
import { tidyGround } from '../src/simulation/rangement';
import { createRandom } from '@duo/sdk/sim';
import { contentAndMap, newSim, SEED } from './aides';

const { content, map } = contentAndMap();

function atDay(day: number): Sim {
  const sim = newSim(SEED);
  sim.world.phase = 'day';
  sim.world.clock.day = day;
  sim.world.clock.minutes = 11 * 60;
  return sim;
}

describe("historique des envies compacté (QA8-02)", () => {
  const ids = content.envies.filter((e) => e.kind === 'personal').map((e) => e.id);

  it('garde la fenêtre, « déjà reçue » et la moins récente de la fenêtre', () => {
    const rng = createRandom([7, 8, 9, 10]);
    for (let run = 0; run < 200; run++) {
      const window = 1 + rng.int(0, 9);
      const length = rng.int(0, 120);
      // Peu d'envies possibles: beaucoup de redites, le cas où la compaction retire le plus.
      const pool = ids.slice(0, 3 + rng.int(0, 20));
      const history = Array.from({ length }, () => rng.pick(pool));
      const compact = compactEnvieHistory(history, window);
      expect(compact.slice(-window)).toEqual(history.slice(-window));
      expect(new Set(compact)).toEqual(new Set(history));
      expect(compact.length).toBeLessThanOrEqual(pool.length + window);
      // Repli de `pickEnvies`: la moins récente parmi des envies toutes dans la fenêtre.
      const recent = [...new Set(history.slice(-window))];
      const oldest = (h: readonly string[]): string[] => {
        const min = Math.min(...recent.map((id) => h.lastIndexOf(id)));
        return recent.filter((id) => h.lastIndexOf(id) === min);
      };
      expect(oldest(compact)).toEqual(oldest(history));
    }
  });

  it('reste borné sur 84 jours de tirages', () => {
    const sim = newSim(SEED);
    for (let day = 1; day < 84; day++) morning(sim);
    for (const c of sim.world.characters) {
      expect(c.envieHistory.length).toBeLessThanOrEqual(42);
    }
  });
});

describe('mémoire des répliques compactée (QA8-02)', () => {
  it('les rangs remplacent les vieilles heures sans changer aucun tirage', () => {
    for (const day of [30, 45, 60, 84]) {
      const sim = atDay(day);
      const rng = createRandom([day, 2, 3, 4]);
      // Chaque réplique entendue à une heure tirée, parfois la même pour deux (égalités).
      const stamps = [1, 2, 3].map(() => (1 + rng.int(0, day - 1)) * MINUTES_PER_DAY + rng.int(0, 1000));
      for (const who of ['p1', 'p2'] as const) {
        for (const d of Object.values(content.dialogues)) {
          if (rng.float(0, 1) < 0.2) continue;
          sim.world.heard[who][d.id] = rng.float(0, 1) < 0.1 ? rng.pick(stamps) : (1 + rng.int(0, day - 1)) * MINUTES_PER_DAY + rng.int(0, 1000);
        }
      }
      const folded = wrapWorld(content, map, structuredClone(sim.world));
      foldOldHeard(folded);
      const changed = Object.keys(folded.world.heard.p1).filter((id) => folded.world.heard.p1[id] !== sim.world.heard.p1[id]);
      if (day > 30) expect(changed.length).toBeGreaterThan(0);
      for (let i = 0; i < 25; i++) {
        for (const v of content.villagers) {
          for (const who of ['p1', 'p2'] as const) {
            sim.rng.setState([i + 1, day, 3, 4]);
            folded.rng.setState([i + 1, day, 3, 4]);
            expect(pickDialogue(folded, v.id, who)?.id, `jour ${String(day)}, ${v.id}, ${who}`).toBe(pickDialogue(sim, v.id, who)?.id);
          }
        }
      }
      // Relancé le lendemain, le compactage ne change pas un ordre déjà compacté.
      const again = structuredClone(folded.world.heard);
      foldOldHeard(folded);
      expect(folded.world.heard).toEqual(again);
    }
  });

  it('ne touche rien pendant la démo', () => {
    const sim = atDay(15);
    sim.world.heard.p1.firmin_daily_rain = 2 * MINUTES_PER_DAY + 600;
    foldOldHeard(sim);
    expect(sim.world.heard.p1.firmin_daily_rain).toBe(2 * MINUTES_PER_DAY + 600);
  });
});

describe('courrier hebdomadaire borné (QA8-02)', () => {
  function letter(id: string, day: number, read: ('p1' | 'p2')[]): Sim['world']['letters'][number] {
    return { id, day, title: id, from: 'coop', text: '', read };
  }

  it('les vieilles lettres de la semaine partent, même lues par un seul; une récente non lue reste', () => {
    const sim = atDay(70);
    const old = 70 - WEEKLY_LETTER_DAYS - 1;
    sim.world.letters = [
      letter('basile_regrow', 16, ['p1']),
      letter(`coop_order_generated@${String(old)}`, old, ['p2']),
      letter(`coop_recap_generated@${String(old)}`, old, []),
      letter(`coop_order_generated@${String(70 - WEEKLY_LETTER_MAX_DAYS - 1)}`, 70 - WEEKLY_LETTER_MAX_DAYS - 1, []),
      letter('coop_order_generated@64', 64, []),
      letter('coop_order_generated@57', 57, ['p1']),
    ];
    pruneLetters(sim);
    expect(sim.world.letters.map((l) => l.id)).toEqual([
      'basile_regrow',
      `coop_recap_generated@${String(old)}`,
      'coop_order_generated@64',
      'coop_order_generated@57',
    ]);
  });
});

describe('rangement de la nuit (QA8-02)', () => {
  function nest(sim: Sim): { x: number; y: number } {
    const coop = point(sim, POINT.chickenCoop);
    return { x: coop.x + 0.5, y: coop.y - 0.6 };
  }

  it('après la démo, les tas tombés d’un sac rentrent au coffre; histoire, œufs au nid et cueillettes restent', () => {
    const sim = atDay(30);
    const at = character(sim, 'p1').pos;
    const corner = map.points.forage_edge_03;
    if (corner === undefined) throw new Error('coin absent');
    const egg = nest(sim);
    const before = (item: string): number => countInStacks(sim.world.cellar, item);
    const planks = before('plank');
    const mattresses = before('mattress');
    dropAt(sim, at.x, at.y, 'mattress', 'ordinary', 1);
    dropAt(sim, at.x + 2, at.y, 'plank', 'ordinary', 5);
    dropAt(sim, at.x + 2, at.y, 'plank', 'ordinary', 3);
    dropAt(sim, at.x + 3, at.y, 'trout', 'fine', 1);
    dropAt(sim, egg.x, egg.y, ITEM.egg, 'ordinary', 2);
    dropAt(sim, egg.x, egg.y, ITEM.egg, 'ordinary', 2);
    dropAt(sim, corner.x, corner.y, 'blackberry', 'ordinary', 2);
    dropAt(sim, at.x, at.y + 4, 'blackberry', 'ordinary', 1);
    dropAt(sim, at.x, at.y + 5, 'jeanne_notebook', 'ordinary', 1);
    // Même endroit, même objet: une seule pile.
    expect(sim.world.groundItems.filter((g) => g.item === 'plank')).toHaveLength(1);
    expect(sim.world.groundItems.filter((g) => g.item === ITEM.egg).map((g) => g.count)).toEqual([4]);
    tidyGround(sim);
    expect(sim.world.groundItems.map((g) => `${g.item}:${String(g.count)}`).sort()).toEqual(['blackberry:2', 'egg:4', 'jeanne_notebook:1']);
    expect(countInStacks(sim.world.cellar, 'mattress')).toBe(mattresses + 1);
    expect(countInStacks(sim.world.cellar, 'plank')).toBe(planks + 8);
    expect(countInStacks(sim.world.cellar, 'trout', 'fine')).toBe(1);
    expect(countInStacks(sim.world.cellar, 'blackberry')).toBe(1);
  });

  it('pendant la démo, rien ne bouge (jours 1 à 15 inchangés)', () => {
    const sim = atDay(10);
    const at = character(sim, 'p1').pos;
    dropAt(sim, at.x, at.y, 'plank', 'ordinary', 5);
    dropAt(sim, at.x, at.y, 'plank', 'ordinary', 3);
    tidyGround(sim);
    expect(sim.world.groundItems.filter((g) => g.item === 'plank').map((g) => g.count)).toEqual([5, 3]);
  });
});
