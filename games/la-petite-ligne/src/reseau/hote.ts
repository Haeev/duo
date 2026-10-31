/**
 * L'hôte fait autorité (ADR 0007, `host-authority`): il simule tout le monde,
 * applique les intentions des deux joueurs dans leur ordre d'arrivée et
 * envoie à l'invité l'état, les positions et les événements.
 */
import type { Net, NetChannel } from '@duo/sdk';
import type { ControlFrame, Intent } from '../etat/actions';
import type { CharacterId, WorldEvent } from '../etat/types';
import type { Sim } from '../simulation/contexte';
import { step } from '../simulation/pas';
import {
  CHANNEL,
  EventsMessageSchema,
  FastSnapshotSchema,
  GuestInputSchema,
  WorldMessageSchema,
  type EventsMessage,
  type FastSnapshot,
  type GuestInput,
  type WorldMessage,
} from './schemas';

/** Commandes de l'invité gardées d'avance au plus (au-delà, on rattrape le retard). */
const MAX_BUFFERED_FRAMES = 4;
/** Sans nouvelles de l'invité pendant ce nombre de pas (200 ms à 30 pas par seconde), ses commandes sont relâchées. */
const STALE_FRAMES = 6;
/** L'état complet part au plus tous les N pas (5 fois par seconde), et seulement s'il a changé. */
const WORLD_EVERY_TICKS = 6;
/** Au moins un état complet toutes les N pas, même sans changement (filet de sécurité). */
const WORLD_KEEPALIVE_TICKS = 90;

export interface HostChannels {
  input: NetChannel<GuestInput>;
  world: NetChannel<WorldMessage>;
  fast: NetChannel<FastSnapshot>;
  events: NetChannel<EventsMessage>;
}

export function openHostChannels(net: Net): HostChannels {
  return {
    input: net.channel(CHANNEL.guestInput, { mode: 'reliable', schema: GuestInputSchema }),
    world: net.channel(CHANNEL.world, { mode: 'latest', schema: WorldMessageSchema }),
    fast: net.channel(CHANNEL.fast, { mode: 'latest', schema: FastSnapshotSchema }),
    events: net.channel(CHANNEL.events, { mode: 'reliable', schema: EventsMessageSchema }),
  };
}

export interface Host {
  /** Intention du joueur de l'hôte (appliquée au prochain pas, à son rang d'arrivée). */
  queueLocal(intent: Intent): void;
  /** Un pas: commandes du joueur local, puis envoi à l'invité. Renvoie les événements du pas. */
  step(local: ControlFrame): readonly WorldEvent[];
  /** Envoie tout de suite l'état complet (après une reprise de partie). */
  sendWorld(): void;
  dispose(): void;
}

export function createHost(sim: Sim, channels: HostChannels, local: CharacterId, remote: CharacterId): Host {
  const pending: { by: CharacterId; intent: Intent }[] = [];
  const guestFrames: ControlFrame[] = [];
  let lastGuest: ControlFrame | null = null;
  let lastQueuedSeq = -1;
  let ack = -1;
  let stale = 0;
  let sentRevision = -1;
  let lastWorldTick = -WORLD_EVERY_TICKS;

  const unsubscribe = channels.input.onMessage((message) => {
    for (const f of message.frames) {
      if (f.seq <= lastQueuedSeq) continue;
      lastQueuedSeq = f.seq;
      guestFrames.push(f);
    }
    for (const intent of message.intents) pending.push({ by: remote, intent });
  });

  function nextGuestFrame(): ControlFrame | undefined {
    // Une commande déjà jouée d'avance (devinée, voir plus bas) est écartée à son arrivée.
    while ((guestFrames[0]?.seq ?? Number.POSITIVE_INFINITY) <= ack) guestFrames.shift();
    if (guestFrames.length > MAX_BUFFERED_FRAMES) guestFrames.splice(0, guestFrames.length - MAX_BUFFERED_FRAMES);
    const next = guestFrames.shift();
    if (next !== undefined) {
      lastGuest = next;
      ack = next.seq;
      stale = 0;
      return next;
    }
    stale += 1;
    if (lastGuest === null || stale > STALE_FRAMES) return undefined;
    // Commande en retard (gigue, réémission): on rejoue la dernière à sa place, et elle compte
    // pour le numéro suivant. Sinon l'invité ferait un pas de trop à chaque retard (la devinée,
    // puis la vraie), corrigé chez lui par un à-coup. Les numéros se suivent (`commandes.ts`).
    ack += 1;
    return { ...lastGuest, seq: ack };
  }

  function fastSnapshot(): FastSnapshot {
    const w = sim.world;
    return {
      tick: w.tick,
      ack,
      minutes: w.clock.minutes,
      characters: w.characters.map((c) => ({ id: c.id, x: c.pos.x, y: c.pos.y, f: c.facing, s: c.speed })),
      villagers: w.villagers.map((v) => ({ id: v.id, x: v.pos.x, y: v.pos.y, f: v.facing, s: v.speed })),
      hens: w.hens.map((h) => ({ id: h.id, x: h.pos.x, y: h.pos.y, f: h.facing, s: 0 })),
      beam: w.beam === null ? null : { x: w.beam.pos.x, y: w.beam.pos.y, f: w.beam.facing },
      train: w.train.progress,
    };
  }

  function sendWorld(): void {
    channels.world.send({ ack, world: sim.world });
    sentRevision = sim.world.revision;
    lastWorldTick = sim.world.tick;
  }

  return {
    queueLocal(intent) {
      pending.push({ by: local, intent });
    },
    step(localFrame) {
      const controls: Partial<Record<CharacterId, ControlFrame>> = { [local]: localFrame };
      const guest = nextGuestFrame();
      if (guest !== undefined) controls[remote] = guest;
      const intents = pending.splice(0, pending.length);
      step(sim, { controls, intents });
      const w = sim.world;
      if (sim.events.length > 0) channels.events.send({ tick: w.tick, events: [...sim.events] });
      channels.fast.send(fastSnapshot());
      const due = w.tick - lastWorldTick;
      if ((w.revision !== sentRevision && due >= WORLD_EVERY_TICKS) || due >= WORLD_KEEPALIVE_TICKS) sendWorld();
      return sim.events;
    },
    sendWorld,
    dispose() {
      unsubscribe();
    },
  };
}
