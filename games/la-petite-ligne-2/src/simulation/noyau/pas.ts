/**
 * Un pas de simulation: seul point d'entrée qui fait avancer le monde. L'hôte l'appelle à pas
 * fixe avec les commandes et les intentions des deux joueurs. Ordre d'un pas: intentions, horloge,
 * déplacements, puis les systèmes (voyage, briques et visée, sac, besoins, dialogues). Logique pure: ni DOM, ni horloge,
 * ni `Math.random`.
 */
import { createRandom, hashState, type RandomSource } from '@duo/sdk/sim';
import type { Content } from '../../donnees/charger';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import { SLICES, type Slice, type WorldState } from '../../etat/monde';
import { exhaustedIntentRefusal } from '../besoins/blocage';
import { postureOf } from '../briques/postures';
import { SIM_DT } from './constantes';
import { freePlayer } from './deblocage';
import { movePlayers, stopPlayer } from './deplacement';
import { revealLook } from '../regles/apparence';
import { lockedPieceOf } from '../regles/recompenses';
import { idleInput, type Intent, type StepInput } from './entrees';
import type { GameEvent } from './evenements';
import { advanceClock } from './horloge';
import { interruptPlayers, SYSTEMS, type SimContext } from './systemes';

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
  // Une sauvegarde peut rendre un personnage pris dans un meuble: il est dégagé sans un mot.
  const place = world.places[world.common.place];
  if (place !== undefined) {
    for (const player of [0, 1] as const)
      if (postureOf(place, player) === null) freePlayer(content, world, player);
  }
  return { content, world, random: createRandom(world.rng), events: [], revisions };
}

/** Intentions du noyau: outil en main, apparence, déblocage. */
function coreIntent(sim: SimContext, player: PlayerIndex, intent: Intent): void {
  const actor = sim.world.players[player];
  if (intent.type === 'select_slot') {
    if (intent.slot !== null && intent.slot >= actor.toolbar.length) return;
    if (actor.selected === intent.slot) return;
    actor.selected = intent.slot;
    sim.touch('players');
  } else if (intent.type === 'set_look') {
    const locked = lockedPieceOf(sim.world, sim.content.pieces, intent.look, player);
    if (locked !== null) {
      sim.emit({ type: 'refused', player, reason: 'piece-locked', target: locked });
      return;
    }
    actor.name = intent.name;
    actor.look = intent.look;
    if (intent.gender !== undefined) actor.gender = intent.gender;
    // Un personnage composé a un visage: il se montre, même si le dialogue qui a ouvert l'éditeur
    // s'est fermé entre-temps (l'effet `reveal_look` des données n'aurait alors jamais joué).
    revealLook(sim, player);
    sim.touch('players');
  } else if (intent.type === 'unstick') {
    // Debout et libre de ses gestes seulement: une place assise se quitte en marchant.
    if (sim.world.common.phase !== 'day' || actor.gesture !== null || actor.talk !== null) return;
    if (freePlayer(sim.content, sim.world, player)) {
      stopPlayer(sim, player);
      sim.emit({ type: 'unstuck', player });
    } else sim.emit({ type: 'refused', player, reason: 'not-stuck', target: null });
  }
}

/** Ce que reçoivent les systèmes: `events` recueille ce qui naît (ceux du pas par défaut). */
function contextOf(
  sim: Sim,
  inputs: readonly [StepInput, StepInput],
  events: GameEvent[] = sim.events,
): SimContext {
  return {
    world: sim.world,
    content: sim.content,
    dt: SIM_DT,
    random: sim.random,
    inputs,
    events,
    emit(event) {
      events.push(event);
    },
    touch(slice) {
      sim.revisions[slice] += 1;
    },
  };
}

/**
 * Pause de la plateforme, hors d'un pas: chaque système annule ce qui ne peut pas attendre
 * (`GameSystem.interrupt`). Rend les événements nés, à envoyer comme ceux d'un pas.
 */
export function interruptForPause(sim: Sim): GameEvent[] {
  const events: GameEvent[] = [];
  const idle = idleInput(0);
  interruptPlayers(contextOf(sim, [idle, idle], events), 'pause');
  return events;
}

export function step(
  sim: Sim,
  inputs: readonly [StepInput, StepInput],
  intents: readonly AuthoredIntent[],
): void {
  const { world } = sim;
  world.tick += 1;
  sim.events.length = 0;
  const context = contextOf(sim, inputs);
  for (const { player, intent } of intents) {
    // Faim ou sommeil à 0: les intentions de travail sont refusées, avec ce qu'il faut faire.
    const exhausted = exhaustedIntentRefusal(context, player, intent.type);
    if (exhausted !== null) {
      context.emit({ type: 'refused', player, reason: exhausted, target: null });
      continue;
    }
    coreIntent(context, player, intent);
    for (const system of SYSTEMS) system.intent?.(context, player, intent);
  }
  advanceClock(context);
  movePlayers(context);
  for (const system of SYSTEMS) system.step?.(context);
  const state = sim.random.getState();
  world.rng = [state[0], state[1], state[2], state[3]];
}

/** Empreinte de l'état, pour les tests de déterminisme. */
export function fingerprint(world: WorldState): string {
  return hashState(world);
}
