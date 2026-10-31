import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { loadContent } from '../../src/donnees/contenu';
import { CONTENT_FILES } from '../../src/donnees/fichiers';
import { createWorld } from '../../src/simulation/monde';
import { step } from '../../src/simulation/pas';
import { createRobot } from '../../src/simulation/robot';
import { contentAndMap } from '../aides';
import { countInBag, countInStacks } from '../../src/simulation/sac';

function weekTwoQuests(raw: unknown): unknown {
  const q = structuredClone(raw) as { quests: Record<string, unknown>[] };
  const first = q.quests.find((x) => x.id === 'saturday_order') as any;
  const step0 = first.steps[0];
  step0.onDeadline = step0.onDeadline.filter((e: any) => e.type !== 'end_demo');
  step0.onDeadline.push({ type: 'start_quest', quest: 'second_order' });
  const second = structuredClone(first);
  second.id = 'second_order';
  second.title = 'La deuxième commande';
  second.steps[0].conditions = [{ type: 'order_complete', day: 15 }];
  second.steps[0].deadline = { day: 15, time: '16:00' };
  second.steps[0].onDeadline = [{ type: 'pay_order' }, { type: 'end_demo' }];
  q.quests.push(second);
  return q;
}

it('probe', () => {
  const seeds = (process.env.SEEDS ?? '1').split(',').map(Number);
  const out: string[] = [];
  const content = loadContent({ ...CONTENT_FILES, quetes: weekTwoQuests(CONTENT_FILES.quetes) });
  const { map } = contentAndMap();
  for (const seed of seeds) {
    const sim = createWorld(content, map, seed, [{ id: 'a', name: 'Camille', color: '#e07a5f' }, { id: 'b', name: 'Sacha', color: '#3d85c6' }]);
    const robot = createRobot();
    let ticks = 0;
    let lastDay = 0;
    while (sim.world.phase !== 'ended' && ticks < 30 * 60 * 70) {
      step(sim, robot.decide(sim));
      ticks++;
      if (sim.world.clock.day !== lastDay && sim.world.phase === 'day') {
        lastDay = sim.world.clock.day;
        const bag = (i: string) => sim.world.characters.reduce((n, c) => n + countInBag(c, i), 0);
        out.push(`s${seed} j${lastDay} t${ticks} idx${sim.world.orderIndex} crate=${JSON.stringify(sim.world.crate.map((s) => s.item + ':' + s.count))} carrot=${bag('carrot')} egg=${bag('egg')} ome=${bag('omelette')} trout=${bag('trout')} lettuce=${bag('lettuce')} jobs=${robot.job('p1')}/${robot.job('p2')}`);
      }
    }
    for (const c of sim.world.characters) out.push(`${c.id} status=${c.status} pos=${c.pos.x.toFixed(1)},${c.pos.y.toFixed(1)} inHouse=${c.inHouse} bed=${c.bedId} menu=${c.menu} action=${c.action.kind} dest=${JSON.stringify(c.destination)} placement=${c.placement !== null} sel=${c.bag[c.selected]?.item}`);
    out.push(`furniture=${JSON.stringify(sim.world.furniture.map((f) => f.id + ':' + f.item + '@' + f.cell.cx + ',' + f.cell.cy))} scene=${sim.world.scene?.dialogue} scripts=${sim.world.scripts.length}`);
    out.push(`s${seed} FIN phase=${sim.world.phase} day=${sim.world.clock.day} ticks=${ticks} hist=${JSON.stringify(sim.world.orderHistory)} ending=${JSON.stringify(sim.world.ending)} jobs=${robot.job('p1')}/${robot.job('p2')} minutes=${sim.world.clock.minutes} stop=${sim.world.clock.stoppedBy}`);
  }
  writeFileSync(process.env.OUT ?? 'probe.txt', out.join('\n'));
}, 600_000);
