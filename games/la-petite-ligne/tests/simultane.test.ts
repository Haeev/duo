// Actions simultanées (qa-testeur, recette de la démo du 2026-10-31): les deux joueurs récoltent la
// même case au même pas. Premier reçu servi, l'autre lit « Déjà pris » (SI-01, SI-02, demo.md 2.1).
import { describe, expect, it } from 'vitest';
import type { AuthoredIntent, ClickTarget } from '../src/etat/actions';
import type { WorldEvent } from '../src/etat/types';
import type { Sim } from '../src/simulation/contexte';
import { character, secondsToTicks } from '../src/simulation/contexte';
import { SIM_HZ } from '../src/simulation/constantes';
import { placeCharacter } from '../src/simulation/deplacement';
import { step } from '../src/simulation/pas';
import { dropAt } from '../src/simulation/sac';
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
  return runTimed(sim, intents, ticks).map((x) => x.event);
}

/** Comme `run`, avec le pas de chaque événement. */
function runTimed(sim: Sim, intents: AuthoredIntent[], ticks: number): { tick: number; event: WorldEvent }[] {
  const events: { tick: number; event: WorldEvent }[] = [];
  step(sim, { controls: {}, intents });
  events.push(...sim.events.map((event) => ({ tick: sim.world.tick, event })));
  for (let i = 0; i < ticks; i++) {
    step(sim, { controls: {}, intents: [] });
    events.push(...sim.events.map((event) => ({ tick: sim.world.tick, event })));
  }
  return events;
}

function cellTarget(sim: Sim): ClickTarget {
  const cell = sim.world.garden[11];
  if (cell === undefined) throw new Error('potager incomplet');
  return { kind: 'ground', x: cell.cell.cx + 0.5, y: cell.cell.cy + 0.5 };
}

/** Même mise en place, la case vide, et trois œufs posés dessus, que les deux regardent. */
function readyToPickUp(): { sim: Sim; id: string } {
  const sim = readyToHarvest();
  const cell = sim.world.garden[11];
  if (cell === undefined) throw new Error('potager incomplet');
  cell.crop = null;
  dropAt(sim, cell.cell.cx + 0.5, cell.cell.cy + 0.5, 'egg', 'ordinary', 3);
  const id = sim.world.groundItems.at(-1)?.id;
  if (id === undefined) throw new Error('œufs absents');
  return { sim, id };
}

function expectOnePickup(sim: Sim, events: WorldEvent[]): void {
  expect(events.filter((e) => e.type === 'picked_up'), 'un seul ramassage').toHaveLength(1);
  const taken = events.filter((e) => e.type === 'already_taken');
  expect(taken, '« Déjà pris » chez l’autre').toHaveLength(1);
  const eggs = sim.world.characters.map((c) => c.bag.reduce((n, s) => n + (s !== null && s.item === 'egg' ? s.count : 0), 0));
  expect(eggs.filter((n) => n > 0), 'les œufs dans un seul sac').toHaveLength(1);
  const loser = sim.world.characters.find((c) => c.id === taken[0]?.by);
  expect(loser?.notifications.some((n) => n.key === 'already_taken')).toBe(true);
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

  // Bug LPL-R03 de la recette du 2026-10-31 (corrigé): au clic, l'autre joueur n'avait aucun retour.
  it('clic chez les deux au même pas: une seule récolte, « Déjà pris » pour l’autre', () => {
    const sim = readyToHarvest();
    const target = cellTarget(sim);
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

  it('clic lointain: « Déjà pris » à l’arrivée, même plus de 1,5 s après la récolte de l’autre', () => {
    const sim = readyToHarvest();
    const cell = sim.world.garden[11];
    if (cell === undefined) throw new Error('potager incomplet');
    // Sacha à 7 m à l'ouest, sur l'herbe libre du potager: 2 s de marche.
    placeCharacter(sim, character(sim, 'p2'), { x: cell.cell.cx - 6.5, y: cell.cell.cy + 0.5 });
    const target = cellTarget(sim);
    const timed = runTimed(
      sim,
      [
        { by: 'p2', intent: { type: 'move_to', target, act: true } },
        { by: 'p1', intent: { type: 'move_to', target, act: true } },
      ],
      SIM_HZ * 4,
    );
    const events = timed.map((x) => x.event);
    expectFirstServed(sim, events);
    const harvested = timed.find((x) => x.event.type === 'harvested');
    const taken = timed.find((x) => x.event.type === 'already_taken');
    expect(harvested?.event.type === 'harvested' && harvested.event.by).toBe('p1');
    expect(taken?.event.type === 'already_taken' && taken.event.by).toBe('p2');
    // La fenêtre compte depuis le clic, pas depuis l'arrivée.
    const window = secondsToTicks(sim.content.settings.feel.alreadyTakenSeconds);
    expect((taken?.tick ?? 0) - (harvested?.tick ?? 0)).toBeGreaterThan(window);
  });

  it('clic sur une case récoltée par l’autre bien avant le clic: aucun « Déjà pris »', () => {
    const sim = readyToHarvest();
    const target = cellTarget(sim);
    run(sim, [{ by: 'p1', intent: { type: 'move_to', target, act: true } }], SIM_HZ * 3);
    const events = run(sim, [{ by: 'p2', intent: { type: 'move_to', target, act: true } }], SIM_HZ);
    expect(events.filter((e) => e.type === 'already_taken')).toHaveLength(0);
  });

  it('ramassage au clic chez les deux au même pas: « Déjà pris » pour l’autre', () => {
    const { sim, id } = readyToPickUp();
    const target: ClickTarget = { kind: 'ground_item', groundItem: id };
    const events = run(
      sim,
      [
        { by: 'p1', intent: { type: 'move_to', target, act: true } },
        { by: 'p2', intent: { type: 'move_to', target, act: true } },
      ],
      SIM_HZ,
    );
    expectOnePickup(sim, events);
  });

  it('ramassage avec Espace chez les deux au même pas: « Déjà pris » pour l’autre', () => {
    const { sim } = readyToPickUp();
    const events = run(
      sim,
      [
        { by: 'p1', intent: { type: 'act' } },
        { by: 'p2', intent: { type: 'act' } },
      ],
      SIM_HZ,
    );
    expectOnePickup(sim, events);
  });
});
