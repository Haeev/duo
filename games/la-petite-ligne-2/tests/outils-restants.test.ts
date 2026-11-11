// Outils restants (cahier 4.5, CA-18): marteau forgé (4 coups, 9 émoussé, manche neuf), filet
// renforcé (portée 1,5 m lue dans sa fiche, troué: une prise sur deux s'échappe, ficelle) et
// canne fine réparée avec une bobine de fil.
import { describe, expect, it } from 'vitest';
import type { PlayerIndex } from '../src/donnees/schemas/communs';
import { swingNet } from '../src/simulation/collections/insectes';
import { jobAt } from '../src/simulation/fabrication/index';
import { stationOf } from '../src/simulation/fabrication/plans';
import type { Intent } from '../src/simulation/noyau/entrees';
import type { Sim } from '../src/simulation/noyau/pas';
import { act, contextOf, wait } from './aides-l3';
import { gameContent, newSim } from './aides';

const content = gameContent();
const BENCH = 'etabli-de-gare';
const FORGE = 'forge-d-essai';

function standAt(sim: Sim, player: PlayerIndex, target: string): void {
  const station = stationOf(sim, target);
  if (station === null) throw new Error(`poste absent: ${target}`);
  sim.world.players[player].body.x = station.x;
  sim.world.players[player].body.y = station.y + 1;
}

function refusals(sim: Sim, i: Intent): string[] {
  return act(sim, 0, i).flatMap((e) => (e.type === 'refused' ? [e.reason] : []));
}

/** Coups de marteau pour une table de chevet (36 points), marteau en case 0. */
function strikesForTable(sim: Sim): number {
  const me = sim.world.players[0];
  me.toolbar[1] = { item: 'planche', count: 3 };
  me.selected = 0;
  act(sim, 0, { type: 'craft_start', target: BENCH, plan: 'table-de-chevet-campagne', variant: 0 });
  let strikes = 0;
  for (let i = 0; i < 20 && jobAt(sim.world, BENCH) !== null; i++) {
    act(sim, 0, { type: 'craft_strike', target: BENCH });
    strikes += 1;
    wait(sim, 1.6);
  }
  return strikes;
}

describe('outils restants', () => {
  it('marteau: 6 coups de base, forgé 4, émoussé 9, réparé à l’établi par un manche neuf', () => {
    const sim = newSim(content);
    const me = sim.world.players[0];
    standAt(sim, 0, BENCH);
    me.toolbar[0] = { item: 'marteau', count: 1 };
    expect(strikesForTable(sim)).toBe(6);
    standAt(sim, 0, FORGE);
    me.money = 3000;
    me.toolbar[2] = { item: 'planche', count: 1 };
    expect(refusals(sim, { type: 'craft_tool', target: FORGE, slot: 0, job: 'upgrade' })).toEqual(
      [],
    );
    expect(me.toolbar[0]).toEqual({ item: 'marteau-forge', count: 1, wear: 100 });
    standAt(sim, 0, BENCH);
    expect(strikesForTable(sim)).toBe(4);
    me.toolbar[0] = { item: 'marteau-forge', count: 1, wear: 0 };
    expect(strikesForTable(sim)).toBe(9);
    me.toolbar[2] = null;
    expect(refusals(sim, { type: 'craft_tool', target: BENCH, slot: 0, job: 'repair' })).toEqual([
      'missing-materials',
    ]);
    me.toolbar[2] = { item: 'planche', count: 1 };
    expect(refusals(sim, { type: 'craft_tool', target: BENCH, slot: 0, job: 'repair' })).toEqual(
      [],
    );
    expect(me.toolbar[0]).toEqual({ item: 'marteau-forge', count: 1, wear: 100 });
    expect(strikesForTable(sim)).toBe(4);
  });

  it('filet: portée lue dans la fiche (1 m de base, 1,5 m renforcé), troué il laisse filer', () => {
    const sim = newSim(content);
    const me = sim.world.players[0];
    me.body = { x: 10, y: 20, facing: 0, speed: 0 };
    const place = sim.world.places[sim.world.common.place];
    if (place === undefined) throw new Error('lieu absent');
    const swing = (item: string, wear?: number): boolean => {
      me.toolbar[0] = wear === undefined ? { item, count: 1 } : { item, count: 1, wear };
      me.selected = 0;
      place.insects = {
        list: [{ id: 0, s: 'papillon-citron', z: 'essai', x: 11.3, y: 20 }],
        next: 1,
        at: 0,
      };
      return swingNet(contextOf(sim), 0, place) !== null;
    };
    expect(swing('filet')).toBe(false);
    expect(swing('filet-renforce', 80)).toBe(true);
    let caught = 0;
    for (let i = 0; i < 40; i++) if (swing('filet-renforce', 0)) caught += 1;
    expect(caught).toBeGreaterThan(8);
    expect(caught).toBeLessThan(32);
    // Raccommodé à l'établi avec une ficelle: il retient tout.
    standAt(sim, 0, BENCH);
    me.toolbar[0] = { item: 'filet-renforce', count: 1, wear: 0 };
    me.toolbar[1] = { item: 'ficelle', count: 1 };
    expect(refusals(sim, { type: 'craft_tool', target: BENCH, slot: 0, job: 'repair' })).toEqual(
      [],
    );
    expect(me.toolbar[0]).toEqual({ item: 'filet-renforce', count: 1, wear: 80 });
  });

  it('canne fine: réparée à la forge avec une bobine de fil neuf, refusée sans', () => {
    const sim = newSim(content);
    const me = sim.world.players[0];
    standAt(sim, 0, FORGE);
    me.toolbar[0] = { item: 'canne-fine', count: 1, wear: 0 };
    expect(refusals(sim, { type: 'craft_tool', target: FORGE, slot: 0, job: 'repair' })).toEqual([
      'missing-materials',
    ]);
    me.toolbar[1] = { item: 'bobine-de-fil', count: 1 };
    expect(refusals(sim, { type: 'craft_tool', target: FORGE, slot: 0, job: 'repair' })).toEqual(
      [],
    );
    expect(me.toolbar[0]).toEqual({ item: 'canne-fine', count: 1, wear: 60 });
    expect(me.toolbar[1]).toBeNull();
  });
});
