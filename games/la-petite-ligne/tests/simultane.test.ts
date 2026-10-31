// Actions simultanées (qa-testeur, recette de la démo du 2026-10-31): les deux joueurs récoltent la
// même case au même pas. Premier reçu servi, l'autre lit « Déjà pris » (SI-01, SI-02, demo.md 2.1).
import { describe, expect, it } from 'vitest';
import type { AuthoredIntent } from '../src/etat/actions';
import type { WorldEvent } from '../src/etat/types';
import type { Sim } from '../src/simulation/contexte';
import { SIM_HZ } from '../src/simulation/constantes';
import { step } from '../src/simulation/pas';
import { createRobot, newSim, play } from './aides';

/**
 * Monde au jour 1, scène d'arrivée finie, la case du coin sud-est du potager mûre, les deux
 * personnages à côté (au sud et à l'est, loin de la porte en chantier qui serait visée d'abord).
 */
function readyToHarvest(): Sim {
  const sim = newSim(5);
  play(sim, createRobot(), (s) => s.world.phase === 'day' && s.world.clock.running && s.world.scene === null, SIM_HZ * 600);
  const cell = sim.world.garden[11];
  if (cell === undefined) throw new Error('potager incomplet');
  cell.soil = 'tilled';
  cell.crop = { crop: 'radish', days: 2, stage: 'ripe', ripe: true, wateredEveryDay: false, sownDay: 1, sownBy: 'p1' };
  const { cx, cy } = cell.cell;
  const spots = [
    { x: cx + 0.5, y: cy + 1.5, facing: -Math.PI / 2 },
    { x: cx + 1.5, y: cy + 0.5, facing: Math.PI },
  ];
  sim.world.characters.forEach((c, i) => {
    const spot = spots[i] ?? spots[0];
    if (spot === undefined) return;
    c.pos = { x: spot.x, y: spot.y };
    c.prev = { x: spot.x, y: spot.y };
    c.facing = spot.facing;
    c.destination = null;
  });
  return sim;
}

function run(sim: Sim, intents: AuthoredIntent[], ticks: number): WorldEvent[] {
  const events: WorldEvent[] = [];
  step(sim, { controls: {}, intents });
  events.push(...sim.events);
  for (let i = 0; i < ticks; i++) {
    step(sim, { controls: {}, intents: [] });
    events.push(...sim.events);
  }
  return events;
}

function expectFirstServed(sim: Sim, events: WorldEvent[]): void {
  const harvested = events.filter((e) => e.type === 'harvested');
  expect(harvested, 'une seule récolte').toHaveLength(1);
  const taken = events.filter((e) => e.type === 'already_taken');
  expect(taken, '« Déjà pris » chez l’autre').toHaveLength(1);
  const radishes = sim.world.characters.map((c) =>
    c.bag.reduce((n, s) => n + (s !== null && s.item === 'radish' ? s.count : 0), 0),
  );
  expect(radishes.reduce((a, b) => a + b, 0), 'trois radis en tout, dans un seul sac').toBe(3);
  expect(radishes.filter((n) => n > 0)).toHaveLength(1);
  const loser = sim.world.characters.find((c) => c.id === taken[0]?.by);
  expect(loser?.notifications.some((n) => n.key === 'already_taken')).toBe(true);
}

describe('actions simultanées', () => {
  it('Espace chez les deux au même pas: une seule récolte, « Déjà pris » pour l’autre', () => {
    const sim = readyToHarvest();
    const events = run(
      sim,
      [
        { by: 'p1', intent: { type: 'act' } },
        { by: 'p2', intent: { type: 'act' } },
      ],
      SIM_HZ * 2,
    );
    expectFirstServed(sim, events);
  });

  // Bug LPL-R03 de la recette du 2026-10-31: au clic, `move_to` avec `act` ne passe pas par le
  // « Déjà pris » de `actFront` (agir.ts), l'autre joueur n'a aucun retour. `it.fails` garde la CI
  // verte tant que le bug est ouvert: une fois corrigé, ce test échoue, remplacer `it.fails` par `it`.
  it.fails('clic chez les deux au même pas: une seule récolte, « Déjà pris » pour l’autre', () => {
    const sim = readyToHarvest();
    const cell = sim.world.garden[11];
    if (cell === undefined) throw new Error('potager incomplet');
    const target = { kind: 'ground' as const, x: cell.cell.cx + 0.5, y: cell.cell.cy + 0.5 };
    const events = run(
      sim,
      [
        { by: 'p1', intent: { type: 'move_to', target, act: true } },
        { by: 'p2', intent: { type: 'move_to', target, act: true } },
      ],
      SIM_HZ * 2,
    );
    expectFirstServed(sim, events);
  });
});
