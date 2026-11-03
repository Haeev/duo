/**
 * L'invité (ADR 0007): il envoie ses commandes et ses intentions, reçoit
 * l'état de l'hôte, interpole les autres et prédit son propre déplacement pour
 * rester fluide, corrigé en douceur par les positions de l'hôte.
 */
import { movingAnimals } from '../etat/elevage';
import type { Net, NetChannel } from '@duo/sdk';
import type { ControlFrame, Intent } from '../etat/actions';
import type { GameMap } from '../etat/carte';
import type { Character, CharacterId, Vec2, WorldEvent, WorldState } from '../etat/types';
import type { Content } from '../donnees/types';
import { MOVE_DEADZONE, SIM_DT } from '../simulation/constantes';
import { standingSpot } from '../simulation/bancs';
import { type Sim, wrapWorld } from '../simulation/contexte';
import { blockersFor, walkStep } from '../simulation/deplacement';
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
/**
 * Pendant la marche, la correction se résorbe au plus à cette part de la vitesse de marche:
 * l'image avance alors entre 70 et 130 % de son pas, sans à-coup visible.
 */
const CORRECTION_WALK_SHARE = 0.3;
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
  /**
   * Prépare l'état à afficher pour l'heure `nowMs` (positions interpolées et prédites).
   * `alpha` (0 à 1) est l'avancement de la boucle vers le pas suivant: la prédiction est
   * interpolée entre ses deux derniers pas, comme l'hôte le fait pour les siens.
   */
  render(nowMs: number, alpha: number): WorldState | null;
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
  if (!c.created || c.crafting !== null || c.destination !== null || c.seat !== null) return false;
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
  // Prédiction de son propre personnage: position avant et après le dernier pas local, et
  // vitesse de ce pas (celle que l'hôte calcule de la même façon), lue par l'animation et le son.
  let predicted: Vec2 | null = null;
  const predictedPrev: Vec2 = { x: 0, y: 0 };
  let predictedSpeed = 0;
  const correction: Vec2 = { x: 0, y: 0 };
  let lastRender = 0;
  let predictedFacing: number | null = null;
  let latestTick = 0;
  let ack = -1;
  // Relevé d'un banc par la prédiction (commande `seq`), en attendant que l'hôte l'ait appliqué:
  // les états et positions plus anciens le montrent encore assis.
  let stoodAtSeq: number | null = null;
  const standSpot: Vec2 = { x: 0, y: 0 };

  /** Ce que l'hôte fait au même pas: assis, une direction relève devant la place (`standingSpot`). */
  function predictStandUp(c: Character, frame: ControlFrame): boolean {
    if (sim === null || c.seat === null || sim.world.phase !== 'day' || (c.status !== 'active' && c.status !== 'menu')) return false;
    if (Math.hypot(frame.moveX, frame.moveY) < MOVE_DEADZONE || !standingSpot(sim, c, standSpot)) return false;
    c.seat = null;
    if (c.action.kind === 'sit') c.action = { kind: 'idle', since: c.action.since, duration: 0, target: null };
    c.pos.x = standSpot.x;
    c.pos.y = standSpot.y;
    predicted = { x: standSpot.x, y: standSpot.y };
    correction.x = 0;
    correction.y = 0;
    stoodAtSeq = frame.seq;
    return true;
  }

  /** État reçu d'avant le lever prédit: on y garde le personnage debout. */
  function keepStanding(world: WorldState, acked: number): void {
    if (stoodAtSeq === null) return;
    if (acked >= stoodAtSeq) {
      stoodAtSeq = null;
      return;
    }
    const mine = world.characters.find((c) => c.id === localId);
    if (mine === undefined) return;
    mine.seat = null;
    if (mine.action.kind === 'sit') mine.action = { kind: 'idle', since: mine.action.since, duration: 0, target: null };
  }

  function localChar(): Character | null {
    return sim?.world.characters.find((c) => c.id === localId) ?? null;
  }

  function replay(from: Vec2): Vec2 {
    const pos = { x: from.x, y: from.y };
    if (sim === null) return pos;
    for (const f of pendingFrames) walkStep(blockersFor(sim, pos), pos, f.moveX, f.moveY, content.settings.movement.walkSpeed, SIM_DT);
    return pos;
  }

  const offWorld = channels.world.onMessage((message) => {
    const world = message.world;
    const mine = world.characters.find((c) => c.playerId === playerId);
    if (mine !== undefined) localId = mine.id;
    keepStanding(world, message.ack);
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
    // L'hôte ne l'a pas encore relevé: sa position est encore sur le banc, la prédiction garde la sienne.
    if (stoodAtSeq !== null && snap.ack < stoodAtSeq) return;
    if (!freeWalking(c, snap.tick) || predicted === null) {
      predicted = null;
      predictedFacing = null;
      return;
    }
    const next = replay(auth);
    // Le dernier pas garde sa longueur: avant et après se décalent ensemble, et la correction
    // reprend l'écart, résorbé ensuite en douceur dans `render`. L'image ne saute pas.
    const shiftX = next.x - predicted.x;
    const shiftY = next.y - predicted.y;
    predictedPrev.x += shiftX;
    predictedPrev.y += shiftY;
    correction.x -= shiftX;
    correction.y -= shiftY;
    if (Math.hypot(correction.x, correction.y) > SNAP_DISTANCE) {
      correction.x = 0;
      correction.y = 0;
    }
    predicted = next;
    // Plus aucun pas en attente: le cap de l'hôte fait foi (il tourne le personnage vers ce qu'il fait, sans marcher).
    if (pendingFrames.every((f) => f.moveX === 0 && f.moveY === 0)) predictedFacing = auth.f;
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
      predictStandUp(c, frame);
      if (!freeWalking(c, latestTick)) {
        predicted = null;
        return;
      }
      if (predicted === null) {
        if (!moving) return;
        // On repart de la position affichée: aucun reste d'une correction interrompue.
        predicted = { x: c.pos.x, y: c.pos.y };
        correction.x = 0;
        correction.y = 0;
      }
      predictedPrev.x = predicted.x;
      predictedPrev.y = predicted.y;
      const facing = walkStep(blockersFor(sim, predicted), predicted, frame.moveX, frame.moveY, content.settings.movement.walkSpeed, SIM_DT);
      if (facing !== null) predictedFacing = facing;
      predictedSpeed = Math.hypot(predicted.x - predictedPrev.x, predicted.y - predictedPrev.y) / SIM_DT;
    },
    render(nowMs, alpha) {
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
        for (const h of movingAnimals(world)) {
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
      // Son propre personnage: la prédiction interpolée entre ses deux derniers pas, corrigée en
      // douceur. La vitesse est celle du pas, pas celle de l'image: à 60 images par seconde pour
      // 30 pas, une vitesse par image vaudrait 0 une image sur deux (pas muets, marche hachée).
      const mine = world.characters.find((c) => c.id === localId);
      if (mine !== undefined && predicted !== null) {
        const walkSpeed = content.settings.movement.walkSpeed;
        const length = Math.hypot(correction.x, correction.y);
        if (length > 0) {
          let absorbed = length * (1 - Math.exp(-CORRECTION_DECAY * dtSeconds));
          if (predictedSpeed > 0) absorbed = Math.min(absorbed, CORRECTION_WALK_SHARE * walkSpeed * dtSeconds);
          const keep = 1 - absorbed / length;
          correction.x *= keep;
          correction.y *= keep;
        }
        const t = Math.max(0, Math.min(1, alpha));
        const x = predictedPrev.x + (predicted.x - predictedPrev.x) * t + correction.x;
        const y = predictedPrev.y + (predicted.y - predictedPrev.y) * t + correction.y;
        setMover(mine, x, y, predictedFacing ?? mine.facing, Math.min(walkSpeed, predictedSpeed));
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
