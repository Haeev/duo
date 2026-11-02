// Robot longue vie du tour 10 (T10-23): duos médians « la maison d'abord », jusqu'au jour 64.
// Cellier et chambre finis avant le jour 64 dans au moins 7 graines sur 8; l'état reste sous la
// borne à chaque aube. Graines réduites: `LPL_MAISON_GRAINES=3,7,42` (par défaut, les huit).
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import type { Sim } from '../../src/simulation/contexte';
import { SIM_HZ } from '../../src/simulation/constantes';
import { step } from '../../src/simulation/pas';
import { createRobot, newSim } from '../aides';
import { MAX_STATE_BYTES } from './bilan';
import { RUNS_FOLDER } from './commun';
import { houseFirst } from './maison';
import { longContent } from './partie';

const LAST_DAY = 64;
const SEEDS = (process.env.LPL_MAISON_GRAINES ?? '1,2,3,4,5,6,7,8').split(',').map(Number);

interface HouseRun {
  seed: number;
  ordered: Record<string, number>;
  built: Record<string, number>;
  maxBytes: number;
  day: number;
}

function playHouse(seed: number): HouseRun {
  const content = longContent({ lastDay: LAST_DAY });
  const sim: Sim = newSim(seed, content);
  const robot = houseFirst(createRobot({ stages: 'stay', profile: 'median' }));
  let maxBytes = 0;
  let day = sim.world.clock.day;
  const maxTicks = SIM_HZ * 60 * 60 * 60;
  for (let t = 0; t < maxTicks; t++) {
    if (sim.world.clock.day >= LAST_DAY && sim.world.clock.stoppedBy === 'ended') break;
    step(sim, robot.decide(sim));
    if (sim.world.clock.day !== day && sim.world.phase === 'breakfast') {
      day = sim.world.clock.day;
      maxBytes = Math.max(maxBytes, new TextEncoder().encode(JSON.stringify(sim.world)).length);
    }
  }
  return { seed, ordered: robot.log.ordered, built: robot.log.built, maxBytes, day: sim.world.clock.day };
}

it(`la maison d'abord: cellier et chambre avant le jour ${String(LAST_DAY)} (au moins 7 graines sur 8)`, () => {
  const runs = SEEDS.map(playHouse);
  mkdirSync(RUNS_FOLDER, { recursive: true });
  writeFileSync(`${RUNS_FOLDER}maison-tour10.json`, `${JSON.stringify(runs, null, 1)}\n`);
  const both = runs.filter((r) => r.built.room_cellar !== undefined && r.built.room_bedroom !== undefined).length;
  expect(both).toBeGreaterThanOrEqual(Math.ceil((runs.length * 7) / 8));
  for (const r of runs) expect(r.maxBytes, `graine ${String(r.seed)}`).toBeLessThan(MAX_STATE_BYTES);
});
