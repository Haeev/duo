/**
 * Déroulé de la scène du trajet, logique pure testée dans Node: à partir du seul temps écoulé
 * (`tripSeconds` de la simulation), où sont le train, le décor et les deux personnages. L'hôte et
 * l'invité calculent donc la même image au même pas.
 *
 * Repère de la scène: x le long de la voie (le train roule vers l'est, +x), y vers le sud (le quai
 * et la caméra), comme la carte d'un lieu. Le train s'arrête à x = 0 (avant de la locomotive);
 * quand il roule, c'est le décor qui défile vers l'ouest sous lui (`worldX`): les personnages à
 * bord ne bougent pas, aucun lissage ne les laisse en arrière.
 */
import { TRIP_SETTINGS, type TripSettings } from './reglages';

export type TripStage = 'arrive' | 'board' | 'ride' | 'alight';

export interface TripActor {
  x: number;
  y: number;
  /** Cap, convention de la simulation (0 vers l'est, PI/2 vers le sud). */
  facing: number;
  /** Vitesse de marche affichée (m/s): l'animation suit. */
  speed: number;
  /** Où il est: sur le quai de départ, dans le wagon, sur le quai d'arrivée. Un changement se pose d'un coup. */
  where: 'quay' | 'inside' | 'arrived';
}

export interface TripFrame {
  stage: TripStage;
  /** Avancement dans l'étape (0 à 1). */
  progress: number;
  /** Position du train sur la voie (m): négative tant qu'il entre en gare. */
  trainX: number;
  /** Décalage du décor (m): de 0 au départ à `-rideDistance` à l'arrivée. */
  worldX: number;
  /** Vitesse du train (m/s), pour la fumée. */
  trainSpeed: number;
  readonly players: [TripActor, TripActor];
  /** Largeur de vue de la caméra (m). */
  cameraWidth: number;
}

export function createTripFrame(): TripFrame {
  const actor = (): TripActor => ({ x: 0, y: 0, facing: 0, speed: 0, where: 'quay' });
  return {
    stage: 'arrive',
    progress: 0,
    trainX: 0,
    worldX: 0,
    trainSpeed: 0,
    players: [actor(), actor()],
    cameraWidth: TRIP_SETTINGS.camera.width,
  };
}

const PLAYERS = [0, 1] as const;
const NORTH = -Math.PI / 2;
const SOUTH = Math.PI / 2;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Marche de (fromX, fromY) à (toX, toY) sur la part [start, end] de l'étape; avant: à `from`, après: à `to`. */
function walk(
  actor: TripActor,
  u: number,
  start: number,
  end: number,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  stageSeconds: number,
): void {
  const k = clamp01((u - start) / Math.max(1e-6, end - start));
  actor.x = fromX + (toX - fromX) * k;
  actor.y = fromY + (toY - fromY) * k;
  const moving = k > 0 && k < 1;
  const distance = Math.hypot(toX - fromX, toY - fromY);
  actor.speed = moving ? distance / Math.max(1e-3, (end - start) * stageSeconds) : 0;
  if (moving) actor.facing = Math.atan2(toY - fromY, toX - fromX);
}

/** Milieu de la portière du wagon, sur la voie (m). */
export function doorX(settings: TripSettings = TRIP_SETTINGS): number {
  return settings.train.center - settings.train.door;
}

/**
 * L'image de la scène à `seconds` secondes d'une scène longue de `total` secondes. Au-delà de la
 * fin, tout reste à l'arrivée (on attend la machine de l'autre). Écrit dans `out`, sans allocation.
 */
export function tripFrame(
  seconds: number,
  total: number,
  out: TripFrame,
  settings: TripSettings = TRIP_SETTINGS,
): TripFrame {
  const { parts } = settings;
  const length = Math.max(0.1, total);
  const t = clamp01(seconds / length);
  const endArrive = parts.arrive;
  const endBoard = endArrive + parts.board;
  const endRide = endBoard + parts.ride;
  const door = doorX(settings);
  const s = settings.spots;
  out.trainX = 0;
  out.worldX = 0;
  out.trainSpeed = 0;
  out.cameraWidth = settings.camera.width;

  if (t < endArrive) {
    // Le train entre en gare en freinant (vitesse qui tombe à zéro au quai).
    const u = t / parts.arrive;
    out.stage = 'arrive';
    out.progress = u;
    out.trainX = -settings.approachDistance * (1 - u) * (1 - u);
    out.trainSpeed = (2 * settings.approachDistance * (1 - u)) / (parts.arrive * length);
    for (const i of PLAYERS) {
      const actor = out.players[i];
      const spot = s.quay[i];
      actor.x = door + spot.dx;
      actor.y = spot.y;
      actor.facing = NORTH;
      actor.speed = 0;
      actor.where = 'quay';
    }
    return out;
  }

  if (t < endBoard) {
    // Chacun marche jusqu'à la portière, puis se retrouve à sa fenêtre.
    const u = (t - endArrive) / parts.board;
    out.stage = 'board';
    out.progress = u;
    const stageSeconds = parts.board * length;
    for (const i of PLAYERS) {
      const actor = out.players[i];
      const spot = s.quay[i];
      const seat = s.inside[i];
      if (u < settings.boardWalk) {
        actor.where = 'quay';
        actor.facing = NORTH;
        walk(
          actor,
          u,
          0,
          settings.boardWalk,
          door + spot.dx,
          spot.y,
          door + Math.sign(spot.dx) * s.doorSpread,
          s.doorstep,
          stageSeconds,
        );
        continue;
      }
      actor.where = 'inside';
      actor.x = door + seat.dx;
      actor.y = seat.y;
      actor.facing = SOUTH;
      actor.speed = 0;
    }
    return out;
  }

  if (t < endRide) {
    // Le train roule: le décor défile, en douceur au départ et à l'arrivée.
    const u = (t - endBoard) / parts.ride;
    out.stage = 'ride';
    out.progress = u;
    const eased = u * u * (3 - 2 * u);
    out.worldX = -settings.rideDistance * eased;
    out.trainSpeed = (settings.rideDistance * 6 * u * (1 - u)) / (parts.ride * length);
    // La vue s'élargit pendant le trajet pour montrer le paysage, puis revient au quai.
    out.cameraWidth =
      settings.camera.width +
      (settings.camera.rideWidth - settings.camera.width) * Math.sin(Math.PI * u);
    for (const i of PLAYERS) {
      const actor = out.players[i];
      const seat = s.inside[i];
      actor.where = 'inside';
      actor.x = door + seat.dx;
      actor.y = seat.y;
      actor.facing = SOUTH;
      actor.speed = 0;
    }
    return out;
  }

  // Arrivée: le décor est au bout, on descend sur le quai d'arrivée.
  const u = (t - endRide) / parts.alight;
  out.stage = 'alight';
  out.progress = u;
  out.worldX = -settings.rideDistance;
  const stageSeconds = parts.alight * length;
  for (const i of PLAYERS) {
    const actor = out.players[i];
    const spot = s.quay[i];
    const seat = s.inside[i];
    if (u < settings.alightWait) {
      actor.where = 'inside';
      actor.x = door + seat.dx;
      actor.y = seat.y;
      actor.facing = SOUTH;
      actor.speed = 0;
      continue;
    }
    actor.where = 'arrived';
    actor.facing = SOUTH;
    walk(
      actor,
      u,
      settings.alightWait,
      settings.alightWait + settings.alightWalk,
      door + Math.sign(spot.dx) * s.doorSpread,
      s.doorstep,
      door + spot.dx * 1.6,
      spot.y + 1.2,
      stageSeconds,
    );
  }
  return out;
}
