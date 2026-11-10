/**
 * Brique `sleep`: se coucher. Seul, c'est une sieste (le temps ne saute pas). Quand les deux
 * joueurs sont couchés à partir de l'heure permise (`clock.sleepFrom`), la nuit saute jusqu'à
 * l'aube et chacun se réveille avec le sommeil de son lit (`wakeAt`).
 */
import type { Brick } from '../../donnees/schemas/briques';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import { wakeUp } from '../besoins/soins';
import { canSkipNight, skipToMorning } from '../noyau/horloge';
import { findProp } from '../noyau/obstacles';
import type { SimContext } from '../noyau/systemes';
import { freeSeat, postureOf, settle } from './postures';
import type { BrickBehaviour } from './types';

type SleepBrick = Extract<Brick, { brick: 'sleep' }>;

export const sleepBehaviour: BrickBehaviour<SleepBrick> = {
  verb: 'Se coucher',
  refuse(_look, _player, target) {
    return freeSeat(target.states.sleep) < 0 ? 'bed-taken' : null;
  },
  use(sim, player, target) {
    const def = sim.content.props[target.type];
    const places = target.states.sleep;
    const place = freeSeat(places);
    if (def === undefined || places === undefined || place < 0) return;
    settle(sim, player, target, def, places, place);
    const state = sim.world.places[sim.world.common.place];
    const other: PlayerIndex = player === 0 ? 1 : 0;
    const alone = state === undefined || postureOf(state, other)?.kind !== 'sleep';
    // « Ta moitié dort. Va te coucher pour passer au lendemain. » (cahier 4.11)
    if (alone && canSkipNight(sim.content.settings.clock, sim.world.minutes))
      sim.emit({ type: 'sleep_waiting', player });
  },
};

/** Sommeil au réveil dans le lit où ce joueur est couché, `null` s'il ne l'est pas. */
function wakeLevel(sim: SimContext, player: PlayerIndex): number | null {
  const { world, content } = sim;
  const place = content.places[world.common.place];
  const state = world.places[world.common.place];
  if (place === undefined || state === undefined) return null;
  const posture = postureOf(state, player);
  if (posture?.kind !== 'sleep') return null;
  const prop = findProp(place, state, posture.object);
  const bricks = prop === null ? undefined : content.props[prop.type]?.bricks;
  for (const brick of bricks ?? []) if (brick.brick === 'sleep') return brick.wakeAt;
  return null;
}

/** À chaque pas: les deux couchés à l'heure permise, la nuit saute. */
export function sleepThroughNight(sim: SimContext): void {
  if (sim.world.common.phase !== 'day') return;
  if (!canSkipNight(sim.content.settings.clock, sim.world.minutes)) return;
  const first = wakeLevel(sim, 0);
  if (first === null) return;
  const second = wakeLevel(sim, 1);
  if (second === null) return;
  // Sommeil du lit, faim et hygiène en baisse (cahier 4.4, lot L3).
  wakeUp(sim, 0, first);
  wakeUp(sim, 1, second);
  skipToMorning(sim);
}
