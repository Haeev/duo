import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { BenchSeating, benchesOf } from '../src/etat/bancs';
import { SIM_HZ } from '../src/simulation/constantes';
import { step } from '../src/simulation/pas';
import { createRobot, newSim, play } from './aides';

it('sonde', () => {
  const sim = newSim(42);
  const robot = createRobot();
  play(sim, robot, (s) => s.world.clock.day === 3 && s.world.phase === 'day' && s.world.clock.minutes >= 7 * 60 + 58, SIM_HZ * 60 * 120);
  const lines: string[] = [];
  const seating = new BenchSeating();
  let n = 0;
  while (sim.world.clock.minutes < 8 * 60 + 12 && n < SIM_HZ * 600) {
    step(sim, robot.decide(sim));
    n++;
    const j = sim.world.villagers.find((v) => v.id === 'jeanne');
    if (j === undefined) continue;
    seating.update(benchesOf(sim.map), sim.content.settings.benches, sim.map.points, sim.world.characters, sim.world.villagers);
    const i = sim.world.villagers.indexOf(j);
    lines.push(`${sim.world.clock.minutes.toFixed(2)} vis=${j.visible} sp=${j.speed} (${j.pos.x.toFixed(2)},${j.pos.y.toFixed(2)}) seat=${seating.slot[i]} talk=${j.talkingWith.join("+")} path=${JSON.stringify(sim.runtime.villagerPaths.jeanne?.path)}`);
  }
  writeFileSync('/tmp/dg3d-t5/jeanne.txt', lines.join('\n'));
});
