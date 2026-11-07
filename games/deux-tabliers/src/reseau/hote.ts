/**
 * L'hôte fait autorité (ADR 0007): il simule tout, joue les entrées de l'invité dans l'ordre
 * de leurs numéros (une entrée en retard est devinée: la dernière connue, sans avancer l'`ack`),
 * applique les intentions dans leur ordre d'arrivée et diffuse l'état par domaines.
 */
import type { Net, NetChannel, RandomSource } from '@duo/sdk';
import type { Content } from '../donnees/charger';
import type { PlayerIndex, World } from '../etat/monde';
import type { Intent, StepInput } from '../simulation/entrees';
import type { GameEvent } from '../simulation/evenements';
import { walk } from '../simulation/deplacement';
import { stepWorld, type QueuedIntent } from '../simulation/pas';
import {
  CHANNEL,
  CoreSchema,
  DOMAINS,
  EventsSchema,
  GuestInputSchema,
  MovesSchema,
  packPlayer,
  type Core,
  type Events,
  type Moves,
} from './schemas';
import { createEventHub, type GameView, type Pose } from './vue';
import { createClienteleHostNet } from '../clientele/reseau';

/** Au-delà de ce retard (en pas), l'hôte joue deux entrées de l'invité par pas pour le rattraper. */
const CATCH_UP_QUEUE = 4;
/** Tous les domaines repartent au moins toutes les deux secondes (invité relancé, message perdu). */
const RESEND_TICKS = 120;

export interface Host {
  readonly view: GameView;
  readonly world: World;
  step(local: StepInput, intents: readonly Intent[], dt: number): void;
  beforeFrame(alpha: number): void;
  dispose(): void;
}

export function createHost(net: Net, content: Content, world: World, random: RandomSource): Host {
  const guestInput = net.channel(CHANNEL.guestInput, {
    mode: 'reliable',
    schema: GuestInputSchema,
  });
  const moves = net.channel(CHANNEL.moves, { mode: 'latest', schema: MovesSchema });
  const core = net.channel(CHANNEL.core, { mode: 'latest', schema: CoreSchema });
  const events = net.channel(CHANNEL.events, { mode: 'reliable', schema: EventsSchema });
  // Un domaine part en entier quand son JSON change (technique 5.3).
  const domainSender = <T>(
    channel: NetChannel<{ tick: number; state: T }>,
    read: () => T,
  ): { send(force: boolean): void } => {
    let last = '';
    return {
      send(force) {
        const state = read();
        const json = JSON.stringify(state);
        if (!force && json === last) return;
        channel.send({ tick: world.tick, state });
        last = json;
      },
    };
  };
  const [serviceDomain, clienteleDomain, arrangementDomain] = DOMAINS;
  const domains = [
    domainSender(
      net.channel(serviceDomain.channel, { mode: 'latest', schema: serviceDomain.schema }),
      () => world.service,
    ),
    domainSender(
      net.channel(clienteleDomain.channel, { mode: 'latest', schema: clienteleDomain.schema }),
      () => world.clientele,
    ),
    domainSender(
      net.channel(arrangementDomain.channel, { mode: 'latest', schema: arrangementDomain.schema }),
      () => world.arrangement,
    ),
  ];
  const hub = createEventHub();
  // Canal 7: positions des clients debout (chantier clientèle).
  const customers = createClienteleHostNet(net, world, content.settings.net.movesEvery);

  const pendingInputs: StepInput[] = [];
  const pendingIntents: QueuedIntent[] = [];
  let lastGuest: StepInput | null = null;
  let ack = 0;
  let lastCore = '';
  let outbox: GameEvent[] = [];

  const unsubscribe = guestInput.onMessage((message) => {
    for (const input of message.inputs)
      if (input.seq > ack && !pendingInputs.some((i) => i.seq === input.seq))
        pendingInputs.push(input);
    for (const intent of message.intents) pendingIntents.push({ player: 1, intent });
  });

  // Poses du pas précédent et du pas courant, pour interpoler l'affichage.
  const previous: [Pose, Pose] = [poseOf(world, 0), poseOf(world, 1)];
  const shown: [Pose, Pose] = [poseOf(world, 0), poseOf(world, 1)];

  const emit = (event: GameEvent): void => {
    outbox.push(event);
    hub.emit(event);
  };

  const nextGuestInput = (): StepInput => {
    const input = pendingInputs.shift();
    if (input !== undefined) {
      ack = input.seq;
      lastGuest = input;
      return input;
    }
    // Entrée devinée: on continue le dernier geste connu, sans avancer `ack`.
    return (
      lastGuest ?? {
        seq: 0,
        moveX: 0,
        moveZ: 0,
        fast: false,
        yawDeg: world.players[1].yawDeg,
        pitchDeg: world.players[1].pitchDeg,
        actHeld: false,
      }
    );
  };

  const sendState = (force: boolean): void => {
    const coreMessage: Core = {
      tick: world.tick,
      objects: world.objects,
      nextObjectId: world.nextObjectId,
      furniture: world.furniture,
      uses: [world.players[0].use, world.players[1].use],
    };
    const coreJson = JSON.stringify([coreMessage.objects, coreMessage.furniture, coreMessage.uses]);
    if (force || coreJson !== lastCore) {
      core.send(coreMessage);
      lastCore = coreJson;
    }
    for (const d of domains) d.send(force);
  };

  const view: GameView = {
    content,
    local: 0,
    world: () => world,
    pose: (player: PlayerIndex) => shown[player],
    onEvent: (listener) => hub.on(listener),
  };

  return {
    view,
    world,
    step(local, intents, dt) {
      copyPose(previous[0], world, 0);
      copyPose(previous[1], world, 1);
      for (const intent of intents) pendingIntents.push({ player: 0, intent });
      let guest = nextGuestInput();
      if (pendingInputs.length > CATCH_UP_QUEUE) {
        // Rattrapage: l'avatar de l'invité joue une entrée de plus pendant ce pas.
        walk(content, world, world.players[1], guest, dt);
        guest = nextGuestInput();
      }
      const queued = pendingIntents.splice(0, pendingIntents.length);
      stepWorld(content, world, [local, guest], queued, dt, random, emit);
      if (world.tick % content.settings.net.movesEvery === 0) {
        const message: Moves = {
          tick: world.tick,
          ack,
          players: [packPlayer(world.players[0]), packPlayer(world.players[1])],
        };
        moves.send(message);
      }
      customers.afterStep();
      if (world.tick % content.settings.net.domainsEvery === 0)
        sendState(world.tick % RESEND_TICKS === 0);
      if (outbox.length > 0) {
        const message: Events = { events: outbox };
        events.send(message);
        outbox = [];
      }
    },
    beforeFrame(alpha) {
      for (const i of [0, 1] as const) lerpPose(shown[i], previous[i], poseOf(world, i), alpha);
    },
    dispose() {
      unsubscribe();
    },
  };
}

function poseOf(world: World, i: PlayerIndex): Pose {
  const p = world.players[i];
  return { x: p.x, z: p.z, yawDeg: p.yawDeg, pitchDeg: p.pitchDeg };
}

function copyPose(target: Pose, world: World, i: PlayerIndex): void {
  const p = world.players[i];
  target.x = p.x;
  target.z = p.z;
  target.yawDeg = p.yawDeg;
  target.pitchDeg = p.pitchDeg;
}

/** Interpolation d'une pose, le cap par le plus court chemin. */
export function lerpPose(out: Pose, a: Pose, b: Pose, t: number): void {
  out.x = a.x + (b.x - a.x) * t;
  out.z = a.z + (b.z - a.z) * t;
  let d = b.yawDeg - a.yawDeg;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  out.yawDeg = a.yawDeg + d * t;
  out.pitchDeg = a.pitchDeg + (b.pitchDeg - a.pitchDeg) * t;
}
