/**
 * L'invité (ADR 0007): il envoie ses entrées et ses intentions, reçoit l'état de l'hôte, prédit
 * son propre déplacement (même fonction `walk` que l'hôte) et interpole l'avatar de l'hôte.
 * Correction de prédiction: résorbée en douceur, au plus à 30 % de la vitesse de marche
 * (technique 5.2), jamais d'un coup sauf au-delà de 2 m.
 */
import type { Net, NetChannel } from '@duo/sdk';
import type { Content } from '../donnees/charger';
import type { PlayerIndex, World } from '../etat/monde';
import { isCarrying } from '../amenagement/port';
import { walk } from '../simulation/deplacement';
import type { Intent, StepInput } from '../simulation/entrees';
import {
  CHANNEL,
  CoreSchema,
  DOMAINS,
  EventsSchema,
  GuestInputSchema,
  MovesSchema,
  unpackPlayer,
  type GuestInput,
  type Moves,
} from './schemas';
import { lerpPose } from './hote';
import { createEventHub, type GameView, type Pose } from './vue';

/** Pas par message d'entrées (30 messages par seconde à 60 Hz). */
const STEPS_PER_MESSAGE = 2;
const CORRECTION_WALK_SHARE = 0.3;
const SNAP_DISTANCE = 2;
const MOVES_KEPT = 16;

export interface Guest {
  readonly view: GameView;
  /** Un premier état complet est arrivé. */
  ready(): boolean;
  step(local: StepInput, intents: readonly Intent[], dt: number): void;
  /** Avant chaque image: `nowMs` horloge locale, `frameDt` en secondes. */
  beforeFrame(nowMs: number, frameDt: number): void;
  dispose(): void;
}

interface Received {
  atMs: number;
  pose: Pose;
}

export function createGuest(net: Net, content: Content, world: World, now: () => number): Guest {
  const input = net.channel(CHANNEL.guestInput, { mode: 'reliable', schema: GuestInputSchema });
  const moves = net.channel(CHANNEL.moves, { mode: 'latest', schema: MovesSchema });
  const core = net.channel(CHANNEL.core, { mode: 'latest', schema: CoreSchema });
  const events = net.channel(CHANNEL.events, { mode: 'reliable', schema: EventsSchema });
  const hub = createEventHub();
  const me: PlayerIndex = 1;
  let haveCore = false;
  let haveMoves = false;
  let lastDt = 1 / 60;

  const pending: StepInput[] = [];
  let outInputs: StepInput[] = [];
  let outIntents: Intent[] = [];
  const hostTrack: Received[] = [];
  // Écart d'affichage entre l'ancienne prédiction et la nouvelle, résorbé peu à peu.
  const offset = { x: 0, z: 0 };
  const shown: [Pose, Pose] = [poseOf(world, 0), poseOf(world, 1)];

  const onMoves = (m: Moves): void => {
    haveMoves = true;
    const host = unpackPlayer(m.players[0]);
    hostTrack.push({ atMs: now(), pose: host });
    if (hostTrack.length > MOVES_KEPT) hostTrack.shift();
    world.players[0].x = host.x;
    world.players[0].z = host.z;
    world.players[0].yawDeg = host.yawDeg;
    world.players[0].pitchDeg = host.pitchDeg;
    // Réconciliation: on repart de la position de l'hôte et on rejoue les entrées pas encore prises.
    const self = world.players[me];
    const beforeX = self.x + offset.x;
    const beforeZ = self.z + offset.z;
    const server = unpackPlayer(m.players[1]);
    self.x = server.x;
    self.z = server.z;
    while (pending.length > 0 && (pending[0]?.seq ?? Infinity) <= m.ack) pending.shift();
    for (const i of pending) walk(content, world, self, i, lastDt);
    offset.x = beforeX - self.x;
    offset.z = beforeZ - self.z;
    if (Math.hypot(offset.x, offset.z) > SNAP_DISTANCE) {
      offset.x = 0;
      offset.z = 0;
    }
  };

  const unsubscribers = [
    moves.onMessage(onMoves),
    core.onMessage((c) => {
      haveCore = true;
      world.objects = c.objects;
      world.nextObjectId = c.nextObjectId;
      world.furniture = c.furniture;
      world.players[0].use = c.uses[0];
      world.players[1].use = c.uses[1];
    }),
    events.onMessage((e) => {
      for (const event of e.events) hub.emit(event);
    }),
    ...DOMAINS.map((d) =>
      (
        net.channel(d.channel, { mode: 'latest', schema: d.schema }) as NetChannel<{
          tick: number;
          state: World[typeof d.key];
        }>
      ).onMessage((m) => {
        Object.assign(world, { [d.key]: m.state });
      }),
    ),
  ];

  const view: GameView = {
    content,
    local: me,
    world: () => world,
    pose: (player) => shown[player],
    onEvent: (listener) => hub.on(listener),
  };

  return {
    view,
    ready: () => haveCore && haveMoves,
    step(local, intents, dt) {
      lastDt = dt;
      pending.push(local);
      outInputs.push(local);
      outIntents.push(...intents);
      walk(content, world, world.players[me], local, dt);
      if (outInputs.length >= STEPS_PER_MESSAGE || outIntents.length > 0) {
        const message: GuestInput = { inputs: outInputs, intents: outIntents.slice(0, 8) };
        input.send(message);
        outInputs = [];
        outIntents = outIntents.slice(8);
      }
    },
    beforeFrame(nowMs, frameDt) {
      // Correction résorbée à 30 % de la vitesse de marche au plus. En portant à deux, la position
      // vient de la charge (non prédite, technique 5.7): on la rejoint au double de son allure.
      const len = Math.hypot(offset.x, offset.z);
      if (len > 0) {
        const speed = isCarrying(world, world.players[me])
          ? content.arrangement.carry.maxSpeed * 2
          : content.settings.player.walkSpeed * CORRECTION_WALK_SHARE;
        const step = Math.min(len, speed * frameDt);
        offset.x -= (offset.x / len) * step;
        offset.z -= (offset.z / len) * step;
      }
      const self = world.players[me];
      shown[1].x = self.x + offset.x;
      shown[1].z = self.z + offset.z;
      shown[1].yawDeg = self.yawDeg;
      shown[1].pitchDeg = self.pitchDeg;
      interpolateHost(shown[0], hostTrack, nowMs - content.settings.net.interpolationMs);
    },
    dispose() {
      for (const u of unsubscribers) u();
    },
  };
}

/** Pose de l'hôte à l'heure `at`, entre les deux instantanés qui l'encadrent. */
function interpolateHost(out: Pose, track: readonly Received[], at: number): void {
  const last = track[track.length - 1];
  if (last === undefined) return;
  for (let i = track.length - 1; i > 0; i--) {
    const b = track[i];
    const a = track[i - 1];
    if (a === undefined || b === undefined) continue;
    if (a.atMs <= at) {
      const t = b.atMs > a.atMs ? Math.min(1, (at - a.atMs) / (b.atMs - a.atMs)) : 1;
      lerpPose(out, a.pose, b.pose, t);
      return;
    }
  }
  const first = track[0] ?? last;
  lerpPose(out, first.pose, first.pose, 0);
}

function poseOf(world: World, i: PlayerIndex): Pose {
  const p = world.players[i];
  return { x: p.x, z: p.z, yawDeg: p.yawDeg, pitchDeg: p.pitchDeg };
}
