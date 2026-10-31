import { it } from 'vitest';
import { createRobot, newSim } from './aides';
import { step } from '../src/simulation/pas';

it('essai', () => {
  const sim = newSim();
  const robot = createRobot();
  let lastDay = 0;
  let lastLog = 0;
  const maxTicks = Number(process.env.ESSAI_TICKS ?? 3000);
  const t0 = performance.now();
  let i = 0;
  for (; i < maxTicks; i++) {
    step(sim, robot.decide(sim));
    const w = sim.world;
    if (w.clock.day !== lastDay || i - lastLog > 30 * 20) {
      lastDay = w.clock.day;
      lastLog = i;
      const h = Math.floor(w.clock.minutes / 60);
      const mn = Math.floor(w.clock.minutes % 60);
      const c1 = w.characters[0];
      const c2 = w.characters[1];
      console.info(`t=${(i / 30).toFixed(0)}s ms=${((performance.now() - t0) / (i + 1)).toFixed(2)} j${w.clock.day} ${h}h${mn} ${w.phase} ${w.clock.stoppedBy} | p1 ${robot.job('p1')} ${c1?.status} (${c1?.pos.x.toFixed(1)},${c1?.pos.y.toFixed(1)}) | p2 ${robot.job('p2')} ${c2?.status} (${c2?.pos.x.toFixed(1)},${c2?.pos.y.toFixed(1)}) | ${w.purse} sous | ${w.quests.map((q) => q.id + ':' + q.step + (q.status === 'done' ? 'D' : '')).join(',')}`);
    }
    if (w.clock.day === 3 && w.clock.minutes > 600 && w.clock.minutes < 601) {
      console.info('JEANNE', JSON.stringify(w.villagers.find((v) => v.id === 'jeanne')), JSON.stringify(w.quests.find((q) => q.id === 'meet_village')));
    }
    if (w.phase === 'ended') break;
  }
  console.info('COMPTEURS', JSON.stringify(sim.world.counters.duo));
  console.info('ms par pas', ((performance.now() - t0) / i).toFixed(3), JSON.stringify(sim.world.ending), JSON.stringify(sim.world.orderResult));
});
