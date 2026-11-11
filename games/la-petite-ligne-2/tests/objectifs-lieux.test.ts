// Relevé mécanique des objectifs qui désignent un lieu (client, 11 novembre: « Dors à la pension »
// envoyait sur la place alors que les lits sont à l'étage de l'épicerie). Pour chaque étape des
// quêtes de chaque lieu, le repère (`target`) doit mener là où l'action se fait:
// - une étape finie par le sommeil vise un point au pied d'un lit;
// - une étape finie en atteignant un point vise ce point (ou un point dans son rayon);
// - une étape finie quand des objets sont récoltés vise un point près de l'un d'eux;
// - un point visé dans un intérieur s'atteint par ses portes depuis le dehors, et le repère du
//   coup d'œil mène d'abord à la porte d'entrée, pas à travers les murs.
import { describe, expect, it } from 'vitest';
import { doorChain } from '../src/simulation/lieux/traversee';
import { interiorAt } from '../src/simulation/lieux/portes';
import { storyOf } from '../src/simulation/quetes/faits';
import { glanceTarget } from '../src/simulation/quetes/lecture';
import { gameContent, newSim } from './aides';

const content = gameContent();

/** Distance au pied d'un lit: le point du repère tombe sur le lit ou juste à côté (m). */
const BED_REACH = 2;
/** Distance d'un point visé à l'un des objets à récolter de l'étape (m). */
const HARVEST_REACH = 6;

interface Spot {
  readonly where: string;
  readonly x: number;
  readonly y: number;
}

function steps(): {
  where: string;
  place: string;
  step: (typeof content.places)[string]['quests'][string]['chapters'][number]['steps'][number];
}[] {
  const out = [];
  for (const [place, data] of Object.entries(content.places))
    for (const quest of Object.values(data.quests))
      for (const chapter of quest.chapters)
        for (const step of chapter.steps)
          out.push({ where: `${place}/${quest.id}/${step.id}`, place, step });
  return out;
}

function targetSpot(
  place: string,
  target: { point: string } | { villager: string } | null,
): Spot | null {
  if (target === null || !('point' in target)) return null;
  const at = content.places[place]?.map.points[target.point];
  return at === undefined ? null : { where: target.point, x: at.x, y: at.y };
}

describe('objectifs et repères', () => {
  it('dormir: le repère est au pied d’un lit', () => {
    const wrong: string[] = [];
    let seen = 0;
    for (const { where, place, step } of steps()) {
      if (!step.done.some((c) => c.type === 'need_at_least' && c.need === 'sleep')) continue;
      seen++;
      const spot = targetSpot(place, step.target);
      const map = content.places[place]?.map;
      const near = map?.objects.some((o) => {
        const bricks = content.props[o.type]?.bricks ?? [];
        return (
          spot !== null &&
          bricks.some((b) => b.brick === 'sleep') &&
          Math.hypot(o.x - spot.x, o.y - spot.y) <= BED_REACH
        );
      });
      if (near !== true) wrong.push(`${where} (${spot?.where ?? 'pas de point'})`);
    }
    expect(seen).toBeGreaterThan(3);
    expect(wrong).toEqual([]);
  });

  it('atteindre un point: le repère est ce point, ou dans son rayon', () => {
    const wrong: string[] = [];
    for (const { where, place, step } of steps())
      for (const c of step.done) {
        if (c.type !== 'reach') continue;
        const goal = content.places[place]?.map.points[c.point];
        const spot = targetSpot(place, step.target);
        if (goal === undefined || spot === null) {
          wrong.push(`${where}: pas de point visé`);
          continue;
        }
        if (Math.hypot(goal.x - spot.x, goal.y - spot.y) > (c.radius ?? 2.5))
          wrong.push(`${where}: vise ${spot.where}, l'étape attend ${c.point}`);
      }
    expect(wrong).toEqual([]);
  });

  it('récolter des objets: le repère est près de l’un d’eux', () => {
    const wrong: string[] = [];
    for (const { where, place, step } of steps())
      for (const c of step.done) {
        if (c.type !== 'harvested') continue;
        const spot = targetSpot(place, step.target);
        const objects = content.places[place]?.map.objects.filter((o) => c.objects.includes(o.id));
        const near = objects?.some(
          (o) => spot !== null && Math.hypot(o.x - spot.x, o.y - spot.y) <= HARVEST_REACH,
        );
        if (near !== true) wrong.push(where);
      }
    expect(wrong).toEqual([]);
  });

  it('un point visé dans un intérieur s’atteint par ses portes, et le repère montre d’abord la porte', () => {
    const wrong: string[] = [];
    for (const { where, place, step } of steps()) {
      const data = content.places[place];
      const spot = targetSpot(place, step.target);
      if (data === undefined || spot === null || interiorAt(data, spot.x, spot.y) === null)
        continue;
      const outside = Object.values(data.map.points).find(
        (p) => interiorAt(data, p.x, p.y) === null,
      );
      if (outside === undefined) continue;
      const chain = doorChain(data, outside.x, outside.y, spot.x, spot.y);
      if (chain === null || chain.length === 0) wrong.push(`${where}: ${spot.where} sans porte`);
    }
    expect(wrong).toEqual([]);
    // « Dors à la pension », suivi depuis la place: le repère est la porte de l'épicerie.
    const sim = newSim(content);
    const aubrune = content.places.aubrune;
    const pl = aubrune?.map.points.pl;
    if (aubrune === undefined || pl === undefined) throw new Error('Aubrune');
    sim.world.common.place = 'aubrune';
    sim.world.progress.quests['le-train-de-5h12'] = {
      chapter: 'logement-fourni',
      step: 'nuit-pension',
      done: false,
      passed: ['quai', 'lettre', 'maison', 'pension', 'pompe', 'souper'],
    };
    storyOf(sim.world).tracked[0] = 'le-train-de-5h12';
    sim.world.players[0].body.x = pl.x;
    sim.world.players[0].body.y = pl.y;
    const glance = glanceTarget(sim.world, content, 0);
    const bed = aubrune.map.points['pension-lit-a'];
    const hop = bed === undefined ? undefined : doorChain(aubrune, pl.x, pl.y, bed.x, bed.y)?.[0];
    expect(hop?.door).toBe('porte-epicerie-epicerie-rdc');
    expect(glance?.step).toBe('nuit-pension');
    expect(glance?.target).toMatchObject({ x: hop?.fromX, y: hop?.fromY });
    expect(glance?.objective).toContain('15 h');
  });
});
