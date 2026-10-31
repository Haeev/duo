// Visée devant le joueur près du potager (contre-recette du 2026-10-31, 9.5): la porte en chantier
// touche le potager au nord, le poulailler est juste à l'est. Bêche en main, Espace bêche la case
// visée; un chantier ne se bâtit que s'il est dans le regard.
import { describe, expect, it } from 'vitest';
import type { AuthoredIntent, ControlFrame } from '../src/etat/actions';
import type { Vec2, WorldEvent } from '../src/etat/types';
import type { Sim } from '../src/simulation/contexte';
import { character } from '../src/simulation/contexte';
import { SIM_HZ } from '../src/simulation/constantes';
import { placeCharacter } from '../src/simulation/deplacement';
import { step } from '../src/simulation/pas';
import { gardenCellAt } from '../src/simulation/potager';
import { createRobot, newSim, play } from './aides';

/** Jour 1, scène d'arrivée finie; Sacha au comptoir, loin; Camille, bêche en main, à `at`, tournée vers `facing`. */
function camilleAt(at: Vec2, facing: number): Sim {
  const sim = newSim(5);
  play(sim, createRobot(), (s) => s.world.phase === 'day' && s.world.clock.running && s.world.scene === null, SIM_HZ * 600);
  const counter = sim.map.points.grocery_counter;
  if (counter === undefined) throw new Error('comptoir absent');
  placeCharacter(sim, character(sim, 'p2'), counter);
  const c = character(sim, 'p1');
  placeCharacter(sim, c, at);
  c.facing = facing;
  const hoe = c.bag.findIndex((s) => s?.item === 'hoe');
  if (hoe < 0) throw new Error('bêche absente du sac');
  c.selected = hoe;
  for (const g of sim.world.garden) {
    g.soil = 'grass';
    g.crop = null;
  }
  step(sim, { controls: {}, intents: [] });
  return sim;
}

/** Espace pressé puis tenu une seconde. */
function pressAndHold(sim: Sim): WorldEvent[] {
  const events: WorldEvent[] = [];
  const held = (seq: number): ControlFrame => ({ seq, moveX: 0, moveY: 0, actHeld: true });
  const press: AuthoredIntent[] = [{ by: 'p1', intent: { type: 'act' } }];
  for (let i = 0; i < SIM_HZ; i++) {
    step(sim, { controls: { p1: held(i + 1) }, intents: i === 0 ? press : [] });
    events.push(...sim.events);
  }
  return events;
}

describe('visée près du potager', () => {
  it('au sud de la porte en chantier, regard vers le potager: Espace bêche la case, la porte attend', () => {
    // Sur la deuxième rangée du potager, face au nord: la case (8, 28) devant, la porte à 2 m.
    const sim = camilleAt({ x: 8.5, y: 29.5 }, -Math.PI / 2);
    expect(sim.world.constructions.find((k) => k.id === 'house_door')?.status).toBe('ghost');
    expect(character(sim, 'p1').aim).toMatchObject({ cell: { cx: 8, cy: 28 }, verb: 'till' });
    const events = pressAndHold(sim);
    expect(events.filter((e) => e.type === 'tilled')).toEqual([{ type: 'tilled', by: 'p1', cell: { cx: 8, cy: 28 } }]);
    expect(events.some((e) => e.type === 'build_progress')).toBe(false);
    expect(gardenCellAt(sim, { cx: 8, cy: 28 })?.soil).toBe('tilled');
  });

  it('à l’est du potager, dos au poulailler en chantier: Espace ne lance pas le poulailler', () => {
    const coop = sim0().map.points.chicken_coop;
    if (coop === undefined) throw new Error('poulailler absent');
    // À 2 m à l'ouest du point du poulailler (à portée du chantier), tournée vers le potager.
    const sim = camilleAt({ x: coop.x - 2, y: coop.y }, Math.PI);
    expect(sim.world.constructions.find((k) => k.id === 'chicken_coop')?.status).toBe('ghost');
    expect(character(sim, 'p1').aim?.verb).not.toBe('build');
    const events = pressAndHold(sim);
    expect(events.some((e) => e.type === 'build_progress')).toBe(false);
  });

  it('face au poulailler en chantier: Espace tenu le bâtit toujours', () => {
    const coop = sim0().map.points.chicken_coop;
    if (coop === undefined) throw new Error('poulailler absent');
    const sim = camilleAt({ x: coop.x - 2, y: coop.y }, 0);
    expect(character(sim, 'p1').aim?.verb).toBe('build');
    const events = pressAndHold(sim);
    expect(events.some((e) => e.type === 'build_progress' && e.construction === 'chicken_coop')).toBe(true);
  });
});

function sim0(): Sim {
  return newSim(5);
}
