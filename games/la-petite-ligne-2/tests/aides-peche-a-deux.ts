// Aides des essais de la pêche à deux: deux joueurs qui se parlent bien (la canne tient pendant
// les élans, l'épuisette plonge dans le couloir de la remontée), joués pas à pas par les gestes.
import type { PlayerIndex } from '../src/donnees/schemas/communs';
import { SIM_DT } from '../src/simulation/noyau/constantes';
import { idleInput } from '../src/simulation/noyau/entrees';
import { step, type AuthoredIntent, type Sim } from '../src/simulation/noyau/pas';
import { pairPhase, type Lane } from '../src/simulation/peche/a-deux';
import { FISHING } from '../src/simulation/peche/reglages';

/** Canne en main (dernière case de la barre), tourné vers `facing`, à cette place. */
export function rodInHand(
  sim: Sim,
  player: PlayerIndex,
  at: { x: number; y: number; facing: number },
): void {
  const state = sim.world.players[player];
  const slot = state.toolbar.length - 1;
  state.toolbar[slot] = { item: 'canne', count: 1 };
  state.selected = slot;
  state.body = { x: at.x, y: at.y, facing: at.facing, speed: 0 };
}

export interface PairPlayOptions {
  /** Plongeons faits exprès dans le mauvais couloir avant le bon. */
  readonly wrongNets?: number;
  /** La canne ne tient jamais (le poisson ne se fatigue pas). */
  readonly slack?: boolean;
  /** Durée maximale jouée (s). */
  readonly seconds?: number;
}

/**
 * Joue la ligne de `angler` jusqu'à sa fin (prise, ou poisson parti): l'autre joueur tient
 * l'épuisette. Rend les événements nés.
 */
export function playPair(
  sim: Sim,
  angler: PlayerIndex,
  options: PairPlayOptions = {},
): Sim['events'] {
  const netter: PlayerIndex = angler === 0 ? 1 : 0;
  const events: Sim['events'] = [];
  let down = false;
  let wrong = options.wrongNets ?? 0;
  let netAt: number | null = -1;
  const limit = Math.ceil((options.seconds ?? FISHING.pair.maxSeconds + 30) / SIM_DT);
  for (let i = 0; i < limit; i++) {
    const line = sim.world.places[sim.world.common.place]?.fishing?.lines[angler] ?? null;
    if (line === null) break;
    const intents: AuthoredIntent[] = [];
    const pair = line.pair;
    if (pair !== undefined) {
      const phase = pairPhase(line, pair, sim.world.tick * SIM_DT);
      const want = options.slack !== true && (pair.tired !== null || phase.kind === 'pull');
      if (want !== down) {
        down = want;
        intents.push({ player: angler, intent: { type: 'fish_hold', down } });
      }
      // On plonge une fois par remontée, une fois la canne tenue.
      if (phase.kind === 'rise' && pair.down && phase.into > 0.3 && netAt !== pair.tired) {
        netAt = pair.tired;
        const lane: Lane = wrong > 0 ? (phase.side === 1 ? -1 : 1) : phase.side;
        if (wrong > 0) wrong--;
        intents.push({ player: netter, intent: { type: 'fish_net', lane } });
      }
    }
    step(sim, [idleInput(sim.world.tick), idleInput(sim.world.tick)], intents);
    events.push(...sim.events);
  }
  return events;
}
