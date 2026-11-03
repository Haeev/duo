/**
 * Retour S04 (2026-11-02): Achille passait le ru à pied. Chaque trajet de chaque habitant, d'un
 * point de son emploi du temps à un autre, ne pose le pied sur aucune case d'eau infranchissable;
 * le ru se passe au pont, à la passerelle ou au ponceau, et au gué de pierres pour les seuls
 * habitants qui le sautent (`feel.steppingStoneVillagers`).
 */
import { describe, expect, it } from 'vitest';
import type { Vec2 } from '../src/etat/types';
import { villagerBlockers } from '../src/simulation/deplacement';
import { findPath } from '../src/simulation/grille';
import { POINT } from '../src/simulation/ids';
import { newSim } from './aides';

const SAMPLE = 0.05;

describe('trajets des habitants (S04)', () => {
  const sim = newSim();
  const { map } = sim;
  const stones = new Set<number>();
  for (const c of map.crossings) {
    if (c.kind !== 'ford') continue;
    for (let y = c.rect.y; y < c.rect.y + c.rect.h; y++) for (let x = c.rect.x; x < c.rect.x + c.rect.w; x++) stones.add(y * map.width + x);
  }

  it('la carte a un gué de pierres sur le ru', () => {
    expect(stones.size).toBeGreaterThan(0);
  });

  it('aucun trajet ne passe dans l\'eau, ni au gué de pierres pour qui ne le saute pas', () => {
    const bad: string[] = [];
    let routes = 0;
    for (const def of sim.content.villagers) {
      const hops = sim.content.settings.feel.steppingStoneVillagers.includes(def.id);
      // Hors du bourg (`offstage`), l'habitant disparaît et reparaît: aucun trajet à pied.
      const points = [...new Set(def.schedule.map((e) => e.point))].filter((p) => p !== POINT.offstage && map.points[p] !== undefined);
      const b = villagerBlockers(sim, def.id);
      for (const from of points) {
        for (const to of points) {
          const a = map.points[from];
          const c = map.points[to];
          if (from === to || a === undefined || c === undefined) continue;
          const path = findPath(b, a, c);
          if (path === null) {
            bad.push(`${def.id} ${from} -> ${to}: aucun chemin`);
            continue;
          }
          routes++;
          let prev: Vec2 = a;
          const wet = new Set<string>();
          for (const p of path) {
            const n = Math.max(1, Math.ceil(Math.hypot(p.x - prev.x, p.y - prev.y) / SAMPLE));
            for (let i = 0; i <= n; i++) {
              const cx = Math.floor(prev.x + ((p.x - prev.x) * i) / n);
              const cy = Math.floor(prev.y + ((p.y - prev.y) * i) / n);
              const k = cy * map.width + cx;
              // L'eau sous un sol posé (ponton) est franchissable sur la carte: seule l'eau bloquée compte.
              if (map.ground[k] === 'water' && map.blocked[k] === true) wet.add(`eau ${String(cx)},${String(cy)}`);
              if (!hops && stones.has(k)) wet.add(`gué de pierres ${String(cx)},${String(cy)}`);
            }
            prev = p;
          }
          if (wet.size > 0) bad.push(`${def.id} ${from} -> ${to}: ${[...wet].join(' ')}`);
        }
      }
    }
    expect(routes).toBeGreaterThan(100);
    expect(bad).toEqual([]);
  });
});
