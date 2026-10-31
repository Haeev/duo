/**
 * L'invité (ADR 0007): il envoie ses commandes et ses intentions, reçoit
 * l'état de l'hôte, interpole les autres et prédit son propre déplacement pour
 * rester fluide, corrigé en douceur par les positions de l'hôte.
 */
import type { Net, NetChannel } from '@duo/sdk';
import type { ControlFrame, Intent } from '../etat/actions';
import type { GameMap } from '../etat/carte';
import type { Character, CharacterId, Vec2, WorldEvent, WorldState } from '../etat/types';
import type { Content } from '../donnees/types';
import { SIM_DT } from '../simulation/constantes';
import { type Sim, wrapWorld } from '../simulation/contexte';
import { refreshBlockers, walkStep } from '../simulation/deplacement';
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

/** Retard d'affichage des autres (en pas): deux instantanés et la gigue (ADR 0007: 50 à 250 ms). */
const INTERPOLATION_DELAY_TICKS = 4;
/** Instantanés gardés pour l'interpolation. */
const SNAPSHOTS_KEPT = 32;
/** Retour de la correction de prédiction vers zéro (par seconde). */
const CORRECTION_DECAY = 10;
/** Au-delà de cet écart (m), on se recale d'un coup (téléportation, fondu). */
const SNAP_DISTANCE = 2;

export interface GuestChannels {
  input: NetChannel<GuestInput>;
  world: NetChannel<WorldMessage>;
  fast: NetChannel<FastSnapshot>;
  events: NetChannel<EventsMessage>;
}

export function openGuestChannels(net: Net): GuestChannels {
  return {
    input: net.channel(CHANNEL.guestInput, { mode: 'reliable', schema: GuestInputSchema }),
    world: net.channel(CHANNEL.world, { mode: 'latest', schema: WorldMessageSchema }),
    fast: net.channel(CHANNEL.fast, { mode: 'latest', schema: FastSnapshotSchema }),
    events: net.channel(CHANNEL.events, { mode: 'reliable', schema: EventsMessageSchema }),
  };
}

export interface Guest {
  /** Le premier état est arrivé. */
  ready(): boolean;
  /** Personnage de ce joueur (d'après l'identifiant stable). */
  localCharacter(): CharacterId;
  queueIntent(intent: Intent): void;
  /** Un pas local: envoie les commandes et prédit son déplacement. */
  step(frame: ControlFrame): void;
  /** Prépare l'état à afficher pour l'heure `nowMs` (positions interpolées et prédites). */
  render(nowMs: number): WorldState | null;
  onEvent(listener: (event: WorldEvent) => void): () => void;
  /** Tick de l'hôte le plus récent reçu. */
  hostTick(): number;
  dispose(): void;
}

interface Received {
  snap: FastSnapshot;
  at: number;
}

function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return a + d * t;
}

/** Le personnage marche librement (ce que la prédiction sait reproduire). */
function freeWalking(c: Character, tick: number): boolean {
  if (!c.created || c.crafting !== null || c.destination !== null) return false;
  if (c.status !== 'active' && c.status !== 'menu') return false;
  return !(c.action.duration > 0 && tick < c.action.since + c.action.duration);
}

export function createGuest(
  content: Content,
  map: GameMap,
  channels: GuestChannels,
  playerId: string,
  now: () => number,
): Guest {
  let sim: Sim | null = null;
  let localId: CharacterId = 'p2';
  const snapshots: Received[] = [];
  const pendingFrames: ControlFrame[] = [];
  const outbox: Intent[] = [];
  const listeners = new Set<(event: WorldEvent) => void>();
  let predicted: Vec2 | null = null;
  const correction: Vec2 = { x: 0, y: 0 };
  let lastRender = 0;
  let lastDisplay: Vec2 | null = null;
  let predictedFacing: number | null = null;
  let latestTick = 0;
  let ack = -1;

  function localChar(): Character | null {
    return sim?.world.characters.find((c) => c.id === localId) ?? null;
  }

  function replay(from: Vec2): Vec2 {
    const pos = { x: from.x, y: from.y };
    if (sim === null) return pos;
    const b = refreshBlockers(sim);
    for (const f of pendingFrames) walkStep(b, pos, f.moveX, f.moveY, content.settings.movement.walkSpeed, SIM_DT);
    return pos;
  }

  const offWorld = channels.world.onMessage((message) => {
    const world = message.world;
    const mine = world.characters.find((c) => c.playerId === playerId);
    if (mine !== undefined) localId = mine.id;
    if (sim === null) sim = wrapWorld(content, map, world);
    else {
      sim.world = world;
      sim.runtime.dynamicDirty = true;
    }
  });

  const offFast = channels.fast.onMessage((snap) => {
    snapshots.push({ snap, at: now() });
    if (snapshots.length > SNAPSHOTS_KEPT) snapshots.shift();
    latestTick = Math.max(latestTick, snap.tick);
    ack = Math.max(ack, snap.ack);
    while (pendingFrames.length > 0 && (pendingFrames[0]?.seq ?? Number.POSITIVE_INFINITY) <= ack) pendingFrames.shift();
    const c = localChar();
    const auth = snap.characters.find((x) => x.id === localId);
    if (c === null || auth === undefined) return;
    if (!freeWalking(c, snap.tick) || predicted === null) {
      predicted = null;
      predictedFacing = null;
      return;
    }
    const before = { x: predicted.x + correction.x, y: predicted.y + correction.y };
    const next = replay(auth);
    correction.x = before.x - next.x;
    correction.y = before.y - next.y;
    if (Math.hypot(correction.x, correction.y) > SNAP_DISTANCE) {
      correction.x = 0;
      correction.y = 0;
    }
    predicted = next;
  });

  const offEvents = channels.events.onMessage((message) => {
    for (const event of message.events) for (const l of listeners) l(event);
  });

  function setMover(target: { pos: Vec2; prev: Vec2; facing: number; speed?: number }, x: number, y: number, f: number, s: number | null): void {
    target.pos.x = x;
    target.pos.y = y;
    target.prev.x = x;
    target.prev.y = y;
    target.facing = f;
    if (s !== null && target.speed !== undefined) target.speed = s;
  }

  return {
    ready() {
      return sim !== null;
    },
    localCharacter() {
      return localId;
    },
    queueIntent(intent) {
      outbox.push(intent);
    },
    step(frame) {
      pendingFrames.push(frame);
      channels.input.send({ frames: [frame], intents: outbox.splice(0, outbox.length) });
      const c = localChar();
      if (sim === null || c === null) return;
      const moving = Math.hypot(frame.moveX, frame.moveY) > 0;
      if (!freeWalking(c, latestTick)) {
        predicted = null;
        return;
      }
      if (predicted === null) {
        if (!moving) return;
        predicted = { x: c.pos.x, y: c.pos.y };
      }
      const facing = walkStep(refreshBlockers(sim), predicted, frame.moveX, frame.moveY, content.settings.movement.walkSpeed, SIM_DT);
      if (facing !== null) predictedFacing = facing;
    },
    render(nowMs) {
      if (sim === null) return null;
      const world = sim.world;
      const dtSeconds = lastRender === 0 ? 0 : (nowMs - lastRender) / 1000;
      lastRender = nowMs;
      const last = snapshots[snapshots.length - 1];
      if (last !== undefined) {
        const stepMs = SIM_DT * 1000;
        const renderTick = last.snap.tick + (nowMs - last.at) / stepMs - INTERPOLATION_DELAY_TICKS;
        let a = last;
        let b = last;
        for (let i = snapshots.length - 1; i > 0; i--) {
          const later = snapshots[i];
          const earlier = snapshots[i - 1];
          if (later === undefined || earlier === undefined) continue;
          if (earlier.snap.tick <= renderTick) {
            a = earlier;
            b = later;
            break;
          }
          a = earlier;
          b = earlier;
        }
        const span = b.snap.tick - a.snap.tick;
        const t = span <= 0 ? 0 : Math.max(0, Math.min(1, (renderTick - a.snap.tick) / span));
        const lerp = (p: number, q: number): number => p + (q - p) * t;
        for (const c of world.characters) {
          const pa = a.snap.characters.find((x) => x.id === c.id);
          const pb = b.snap.characters.find((x) => x.id === c.id);
          if (pa === undefined || pb === undefined) continue;
          setMover(c, lerp(pa.x, pb.x), lerp(pa.y, pb.y), lerpAngle(pa.f, pb.f, t), lerp(pa.s, pb.s));
        }
        for (const v of world.villagers) {
          const pa = a.snap.villagers.find((x) => x.id === v.id);
          const pb = b.snap.villagers.find((x) => x.id === v.id);
          if (pa === undefined || pb === undefined) continue;
          setMover(v, lerp(pa.x, pb.x), lerp(pa.y, pb.y), lerpAngle(pa.f, pb.f, t), lerp(pa.s, pb.s));
        }
        for (const h of world.hens) {
          const pa = a.snap.hens.find((x) => x.id === h.id);
          const pb = b.snap.hens.find((x) => x.id === h.id);
          if (pa === undefined || pb === undefined) continue;
          setMover(h, lerp(pa.x, pb.x), lerp(pa.y, pb.y), lerpAngle(pa.f, pb.f, t), null);
        }
        if (world.beam !== null && a.snap.beam !== null && b.snap.beam !== null) {
          setMover(world.beam, lerp(a.snap.beam.x, b.snap.beam.x), lerp(a.snap.beam.y, b.snap.beam.y), lerpAngle(a.snap.beam.f, b.snap.beam.f, t), null);
        }
        world.train.progress = lerp(a.snap.train, b.snap.train);
        world.train.prevProgress = world.train.progress;
        world.clock.minutes = lerp(a.snap.minutes, b.snap.minutes);
      }
      // Son propre personnage: la prédiction, corrigée en douceur.
      const mine = world.characters.find((c) => c.id === localId);
      if (mine !== undefined && predicted !== null) {
        const decay = Math.exp(-CORRECTION_DECAY * dtSeconds);
        correction.x *= decay;
        correction.y *= decay;
        const x = predicted.x + correction.x;
        const y = predicted.y + correction.y;
        const moved = lastDisplay === null ? 0 : Math.hypot(x - lastDisplay.x, y - lastDisplay.y);
        const speed = dtSeconds > 0 ? Math.min(content.settings.movement.walkSpeed, moved / dtSeconds) : 0;
        setMover(mine, x, y, predictedFacing ?? mine.facing, speed);
        lastDisplay = { x, y };
      } else {
        lastDisplay = null;
      }
      return world;
    },
    onEvent(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    hostTick() {
      return latestTick;
    },
    dispose() {
      offWorld();
      offFast();
      offEvents();
      listeners.clear();
    },
  };
}
