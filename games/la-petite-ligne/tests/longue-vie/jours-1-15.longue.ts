// Robot longue vie, I-07 (tour 8, section 6.4): avec le contenu du robot longue vie (limite au jour
// 84), les aubes des jours 2 à 15 sont celles d'une partie sans les systèmes du tour 8, même graine,
// sauvegarde et reprise à chaque aube comprises. Graine 1 (T8-04 couvre déjà la graine du robot).
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import type { Content } from '../../src/donnees/types';
import type { WorldState } from '../../src/etat/types';
import { restoreWorld, snapshotOf } from '../../src/sauvegarde/sauvegarde';
import { SIM_HZ } from '../../src/simulation/constantes';
import { step } from '../../src/simulation/pas';
import { createRobot, newSim } from '../aides';
import { RUNS_FOLDER } from './commun';
import { longContent } from './partie';

const A = { id: 'membre-a', name: 'Camille', color: '#e07a5f' };
const B = { id: 'membre-b', name: 'Sacha', color: '#3d85c6' };
const HOUR = 60;

/** Le contenu sans les systèmes du tour 8 (comme `suite-etapes.test.ts`, T8-04). */
function withoutTour8(content: Content): Content {
  const c = structuredClone(content);
  c.settings.clock.lastDay = { day: 15, end: 16 * HOUR };
  c.settings.stages = [{ id: 'demo', day: 15, time: 16 * HOUR, texts: 'demo' }];
  c.settings.order.generated = null;
  c.settings.train.repeatEveryDays = 0;
  c.settings.economy.catalogue.repeatWeekly = null;
  c.settings.moments.festivalDays = [16, 23];
  return c;
}

function comparable(w: WorldState): unknown {
  const copy = structuredClone(w) as Partial<WorldState>;
  delete copy.weatherLog;
  delete copy.morningMist;
  delete copy.stages;
  delete copy.orderTotals;
  delete copy.order;
  delete copy.letterVariants;
  delete copy.content;
  return copy;
}

function dawns(content: Content): unknown[] {
  let sim = newSim(1, content);
  let robot = createRobot({ stages: 'stay' });
  const out: unknown[] = [];
  let day = sim.world.clock.day;
  for (let t = 0; t < SIM_HZ * 60 * 60 * 20 && out.length < 14; t++) {
    step(sim, robot.decide(sim));
    if (sim.world.clock.day !== day && sim.world.phase === 'breakfast') {
      day = sim.world.clock.day;
      out.push(comparable(sim.world));
      const snap = snapshotOf(sim);
      sim = restoreWorld(sim.content, sim.map, structuredClone(snap.data), snap.dataSchema, [B, A]);
      robot = createRobot({ stages: 'stay' });
    }
  }
  return out;
}

it('I-07: graine 1, aubes des jours 2 à 15 identiques à une partie sans les systèmes nouveaux', () => {
  const content = longContent();
  const now = dawns(content);
  const before = dawns(withoutTour8(content));
  const differing = now.map((d, i) => (JSON.stringify(d) === JSON.stringify(before[i]) ? null : i + 2)).filter((d) => d !== null);
  mkdirSync(RUNS_FOLDER, { recursive: true });
  writeFileSync(`${RUNS_FOLDER}../i07.json`, `${JSON.stringify({ dawns: now.length, differing })}\n`);
  expect(now).toHaveLength(14);
  expect(differing, 'aubes qui diffèrent').toEqual([]);
});
