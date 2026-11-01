// Recette du tour 8 (qa-testeur): critères T8 qui n'avaient pas de test. T8-10, semer selon la
// saison (sections 2.3, 8.4 et 9): bogue QA8-01, corrigé (les `it.fails` sont passés en `it`).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Content } from '../src/donnees/types';
import type { Cell } from '../src/etat/types';
import type { Sim } from '../src/simulation/contexte';
import { character } from '../src/simulation/contexte';
import { verbOf, perform } from '../src/simulation/agir';
import { morning } from '../src/simulation/horloge';
import { gardenCellAt, till, water } from '../src/simulation/potager';
import { addToBag, countInBag } from '../src/simulation/sac';
import { contentAndMap, newSim } from './aides';

const HOUR = 60;

/** Le contenu livré, limite de la partie portée au jour 84 (comme le robot longue vie). */
function longer(): Content {
  const c = structuredClone(contentAndMap().content);
  c.settings.clock.lastDay = { day: 84, end: 16 * HOUR };
  return c;
}

/** Une case bêchée du potager, un sachet de graines en main, au jour donné. */
function readyToSow(day: number, seed: string): { sim: Sim; cell: Cell } {
  const sim = newSim(7, longer());
  sim.world.clock.day = day;
  const c = character(sim, 'p1');
  const g = sim.world.garden[0];
  if (g === undefined) throw new Error('potager vide');
  addToBag(sim, c, 'hoe', 'ordinary', 1);
  till(sim, c, g);
  addToBag(sim, c, seed, 'ordinary', 2);
  c.selected = c.bag.findIndex((s) => s?.item === seed);
  return { sim, cell: g.cell };
}

function trySow(sim: Sim, cell: Cell): void {
  const c = character(sim, 'p1');
  const target = { kind: 'cell' as const, cell, pos: { x: cell.cx + 0.5, y: cell.cy + 0.5 } };
  const verb = verbOf(sim, c, target);
  if (verb !== null) perform(sim, c, target, verb);
}

describe('T8-10: semer selon la saison (QA8-01)', () => {
  it('QA8-01: radis, laitue et carotte se sèment au printemps, en été et en automne (cultures.json, section 8.4)', () => {
    const raw = JSON.parse(readFileSync(fileURLToPath(new URL('../donnees/cultures.json', import.meta.url)), 'utf8')) as {
      crops: { id: string; seasons: unknown }[];
    };
    for (const id of ['radish', 'lettuce', 'carrot']) {
      expect(raw.crops.find((c) => c.id === id)?.seasons, id).toEqual(['spring', 'summer', 'autumn']);
    }
  });

  it('QA8-01: le message `sow_out_of_season` existe (section 8.4)', () => {
    const { content } = contentAndMap();
    expect(Object.hasOwn(content.texts.messages, 'sow_out_of_season')).toBe(true);
  });

  it('QA8-01: en hiver (jour 64), semer est refusé, la graine reste dans le sac (section 9)', () => {
    const { sim, cell } = readyToSow(64, 'radish_seed');
    trySow(sim, cell);
    expect(gardenCellAt(sim, cell)?.crop ?? null).toBeNull();
    expect(countInBag(character(sim, 'p1'), 'radish_seed')).toBe(2);
  });

  it('au printemps (jour 20), semer marche toujours (témoin du test précédent)', () => {
    const { sim, cell } = readyToSow(20, 'radish_seed');
    trySow(sim, cell);
    expect(gardenCellAt(sim, cell)?.crop?.crop).toBe('radish');
    expect(countInBag(character(sim, 'p1'), 'radish_seed')).toBe(1);
  });

  it('une carotte semée le jour 41 et arrosée chaque jour mûrit le jour 45 (limite portée au jour 84)', () => {
    const { sim, cell } = readyToSow(41, 'carrot_seed');
    trySow(sim, cell);
    const c = character(sim, 'p1');
    const g = gardenCellAt(sim, cell);
    if (g === null) throw new Error('case absente');
    expect(g.crop?.crop).toBe('carrot');
    for (let day = 41; day < 45; day++) {
      expect(g.crop?.ripe, `jour ${String(day)}`).toBe(false);
      c.water = 10;
      water(sim, c, g);
      morning(sim);
    }
    expect(sim.world.clock.day).toBe(45);
    expect(g.crop?.ripe).toBe(true);
  });
});
