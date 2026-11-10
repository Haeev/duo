/**
 * L'hôte fait autorité (ADR 0007): il simule, applique les intentions des deux joueurs dans leur
 * ordre d'arrivée et envoie à l'invité les tranches qui ont changé, le canal rapide et les
 * événements. Version du socle: le lot L1 y reprend la file des commandes de l'invité de l'ancien
 * jeu (coussin contre la gigue, rattrapage, commande devinée).
 */
import type { Logger, Net, NetChannel } from '@duo/sdk';
import type { PlayerIndex } from '../donnees/schemas/communs';
import { SLICES, type Slice } from '../etat/monde';
import { idleInput, type Intent, type StepInput } from '../simulation/noyau/entrees';
import type { GameEvent } from '../simulation/noyau/evenements';
import { step, type AuthoredIntent, type Sim } from '../simulation/noyau/pas';
import {
  BUDGET_BYTES,
  CHANNEL,
  EventsSchema,
  FastSchema,
  GuestInputSchema,
  SLICE_EVERY_TICKS,
  SLICE_KEEPALIVE_TICKS,
  SLICE_SCHEMAS,
  type SliceMessage,
} from './canaux';
import { byteLength, fastMessage, sliceMessage } from './tranches';

export interface Host {
  /** Intention du joueur de cette machine (appliquée au prochain pas, à son rang d'arrivée). */
  queueLocal(intent: Intent): void;
  /** Un pas: commandes du joueur local, simulation, envois. Renvoie les événements du pas. */
  step(local: StepInput): readonly GameEvent[];
  /** Envoie tout l'état tout de suite (départ, reprise de la liaison). */
  sendAll(): void;
  dispose(): void;
}

type SliceChannels = { readonly [S in Slice]: NetChannel<SliceMessage<S>> };

export function createHost(sim: Sim, net: Net, log: Logger, local: PlayerIndex): Host {
  const remote: PlayerIndex = local === 0 ? 1 : 0;
  const input = net.channel(CHANNEL.guestInput, { mode: 'reliable', schema: GuestInputSchema });
  const fast = net.channel(CHANNEL.fast, { mode: 'latest', schema: FastSchema });
  const events = net.channel(CHANNEL.events, { mode: 'reliable', schema: EventsSchema });
  const slices: SliceChannels = {
    common: net.channel(CHANNEL.common, { mode: 'latest', schema: SLICE_SCHEMAS.common }),
    players: net.channel(CHANNEL.players, { mode: 'latest', schema: SLICE_SCHEMAS.players }),
    progress: net.channel(CHANNEL.progress, { mode: 'latest', schema: SLICE_SCHEMAS.progress }),
    place: net.channel(CHANNEL.place, { mode: 'latest', schema: SLICE_SCHEMAS.place }),
  };
  const sent: Record<Slice, { revision: number; tick: number }> = {
    common: { revision: -1, tick: 0 },
    players: { revision: -1, tick: 0 },
    progress: { revision: -1, tick: 0 },
    place: { revision: -1, tick: 0 },
  };
  const pending: AuthoredIntent[] = [];
  const guestInputs: StepInput[] = [];
  let lastGuest = idleInput(0);
  let ack = -1;

  const unsubscribe = input.onMessage((message) => {
    for (const frame of message.inputs) if (frame.seq > ack) guestInputs.push(frame);
    for (const intent of message.intents) pending.push({ player: remote, intent });
  });

  /**
   * Jamais d'exception pour une taille: un message hors budget est refusé et journalisé, la
   * partie continue (l'ancien jeu s'arrêtait des deux côtés au-delà de 64 Kio).
   */
  function fits(channel: keyof typeof BUDGET_BYTES, message: unknown): boolean {
    const bytes = byteLength(message);
    if (bytes <= BUDGET_BYTES[channel]) return true;
    log.error('message hors budget, non envoyé', { channel, bytes, budget: BUDGET_BYTES[channel] });
    return false;
  }

  function sendSlice(slice: Slice): void {
    // Un cas par tranche: chaque canal garde le type exact de son message.
    switch (slice) {
      case 'common': {
        const message = sliceMessage(sim.world, 'common');
        if (fits(slice, message)) slices.common.send(message);
        break;
      }
      case 'players': {
        const message = sliceMessage(sim.world, 'players');
        if (fits(slice, message)) slices.players.send(message);
        break;
      }
      case 'progress': {
        const message = sliceMessage(sim.world, 'progress');
        if (fits(slice, message)) slices.progress.send(message);
        break;
      }
      case 'place': {
        const message = sliceMessage(sim.world, 'place');
        if (fits(slice, message)) slices.place.send(message);
        break;
      }
    }
    sent[slice] = { revision: sim.revisions[slice], tick: sim.world.tick };
  }

  function sendFast(): void {
    const message = fastMessage(sim.world, sim.content, ack);
    if (fits('fast', message)) fast.send(message);
  }

  return {
    queueLocal(intent) {
      pending.push({ player: local, intent });
    },
    step(localInput) {
      const next = guestInputs.shift();
      if (next !== undefined) {
        lastGuest = next;
        ack = next.seq;
      }
      const inputs: [StepInput, StepInput] = local === 0 ? [localInput, lastGuest] : [lastGuest, localInput];
      step(sim, inputs, pending.splice(0, pending.length));
      const tick = sim.world.tick;
      if (sim.events.length > 0) {
        const message = { tick, events: [...sim.events] };
        if (fits('events', message)) events.send(message);
      }
      sendFast();
      for (const slice of SLICES) {
        const due = tick - sent[slice].tick;
        const changed = sim.revisions[slice] !== sent[slice].revision;
        if ((changed && due >= SLICE_EVERY_TICKS[slice]) || due >= SLICE_KEEPALIVE_TICKS) sendSlice(slice);
      }
      return sim.events;
    },
    sendAll() {
      sendFast();
      for (const slice of SLICES) sendSlice(slice);
    },
    dispose() {
      unsubscribe();
    },
  };
}
