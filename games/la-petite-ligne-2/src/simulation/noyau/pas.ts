/**
 * Un pas de simulation: seul point d'entrée qui fait avancer le monde. L'hôte l'appelle à pas
 * fixe avec les commandes et les intentions des deux joueurs. Logique pure: ni DOM, ni horloge,
 * ni `Math.random`.
 */
import { createRandom, hashState, type RandomSource } from '@duo/sdk/sim';
import type { Content } from '../../donnees/charger';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import { SLICES, type Slice, type WorldState } from '../../etat/monde';
import { MINUTES_PER_DAY, SIM_DT } from './constantes';
import type { Intent, StepInput } from './entrees';
import type { GameEvent } from './evenements';
import { SYSTEMS, type SimContext } from './systemes';

export interface AuthoredIntent {
  readonly player: PlayerIndex;
  readonly intent: Intent;
}

/** La simulation de l'hôte: l'état, le contenu et ce qui ne se sauvegarde pas. */
export interface Sim {
  readonly content: Content;
  readonly world: WorldState;
  readonly random: RandomSource;
  /** Événements nés au dernier pas. */
  readonly events: GameEvent[];
  /** Révision de chaque tranche lente: elle monte quand un système appelle `touch`. */
  readonly revisions: Record<Slice, number>;
}

export function createSim(content: Content, world: WorldState): Sim {
  const revisions = Object.fromEntries(SLICES.map((slice) => [slice, 0])) as Record<Slice, number>;
  return { content, world, random: createRandom(world.rng), events: [], revisions };
}

/** L'horloge: le temps passe pendant le jour et la nuit jouable; le jour change à l'aube. */
function advanceClock(sim: Sim, dt: number): void {
  const { world, content } = sim;
  if (world.common.phase !== 'day') return;
  const { secondsPerHour, dayStart } = content.settings.clock;
  const before = world.minutes;
  let minutes = before + (dt * 60) / secondsPerHour;
  if (minutes >= MINUTES_PER_DAY) minutes -= MINUTES_PER_DAY;
  world.minutes = minutes;
  if (before < dayStart && minutes >= dayStart) {
    world.common.day += 1;
    sim.revisions.common += 1;
  }
}

export function step(
  sim: Sim,
  inputs: readonly [StepInput, StepInput],
  intents: readonly AuthoredIntent[],
): void {
  const { world } = sim;
  world.tick += 1;
  sim.events.length = 0;
  const context: SimContext = {
    world,
    content: sim.content,
    dt: SIM_DT,
    random: sim.random,
    inputs,
    emit(event) {
      sim.events.push(event);
    },
    touch(slice) {
      sim.revisions[slice] += 1;
    },
  };
  for (const { player, intent } of intents)
    for (const system of SYSTEMS) system.intent?.(context, player, intent);
  advanceClock(sim, SIM_DT);
  for (const system of SYSTEMS) system.step?.(context);
  const state = sim.random.getState();
  world.rng = [state[0], state[1], state[2], state[3]];
}

/** Empreinte de l'état, pour les tests de déterminisme. */
export function fingerprint(world: WorldState): string {
  return hashState(world);
}
