import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { newSim, createRobot } from '../aides';
import { step } from '../../src/simulation/pas';
it('p42', () => {
  const sim = newSim(42);
  const robot = createRobot();
  const out: string[] = [];
  const seen = new Set<string>();
  let lastJobs = '';
  while (sim.world.phase !== 'ended' && sim.world.tick < 30 * 60 * 120) {
    step(sim, robot.decide(sim));
    for (const q of sim.world.quests) { const k = `${q.id}:${q.status}:${q.step}`; if (!seen.has(k)) { seen.add(k); out.push(`j${sim.world.clock.day} ${Math.floor(sim.world.clock.minutes)} ${k}`); } }
    if (sim.world.clock.day >= 9 && sim.world.tick % 900 === 0) { const j = `j${sim.world.clock.day} ${Math.floor(sim.world.clock.minutes)} ${robot.job('p1')} / ${robot.job('p2')}`; if (j.split(' ').slice(2).join(' ') !== lastJobs) { out.push(j); lastJobs = j.split(' ').slice(2).join(' '); } }
  }
  out.push(`FIN ${JSON.stringify(sim.world.orderHistory)} crate=${JSON.stringify(sim.world.crate)}`);
  writeFileSync('/tmp/dev3d-s2/p42.txt', out.join('\n'));
}, 600000);
