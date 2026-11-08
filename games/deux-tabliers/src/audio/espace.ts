/**
 * Sons placés dans l'espace (champ `spatial` de `assets/son/sons.json`): atténuation calculée
 * ici (modèle `inverse` de Web Audio: ref / (ref + rolloff × (d - ref)), distance bornée à
 * `maxDistance`, rien au-delà de `cullBeyondM`) et panoramique doux selon le regard de qui écoute.
 * Pure: testée dans Node; le moteur (`sons.ts`) applique gain et panoramique.
 */
import type { Content } from '../donnees/charger';
import type { World } from '../etat/monde';
import type { GameEvent } from '../simulation/evenements';

export interface Spatial {
  readonly distanceModel?: string | undefined;
  readonly refDistance: number;
  readonly rolloffFactor: number;
  readonly maxDistance: number;
  readonly cullBeyondM?: number | undefined;
}

export interface Listener {
  x: number;
  z: number;
  /** Cap du regard (0 regarde le nord, -z), comme `yawDeg` des joueurs. */
  yawDeg: number;
}

export interface Placed {
  /** Gain d'atténuation (0 à 1); 0: trop loin, ne pas jouer. */
  gain: number;
  /** Panoramique (-1 gauche, 1 droite). */
  pan: number;
}

/** Panoramique au plus: un son à droite reste un peu dans l'oreille gauche (salle petite). */
const PAN_WIDTH = 0.75;

export function placeSound(
  s: Spatial,
  listener: Listener,
  x: number,
  z: number,
  out: Placed,
): Placed {
  const dx = x - listener.x;
  const dz = z - listener.z;
  const d = Math.hypot(dx, dz);
  if (s.cullBeyondM !== undefined && d > s.cullBeyondM) {
    out.gain = 0;
    out.pan = 0;
    return out;
  }
  const ref = Math.max(1e-3, s.refDistance);
  const dd = Math.max(ref, Math.min(s.maxDistance, d));
  out.gain =
    s.distanceModel === 'linear'
      ? Math.max(0, 1 - (s.rolloffFactor * (dd - ref)) / Math.max(1e-3, s.maxDistance - ref))
      : ref / (ref + s.rolloffFactor * (dd - ref));
  const yaw = (listener.yawDeg * Math.PI) / 180;
  // Droite de qui regarde vers (-sin, -cos): (cos, -sin).
  const side = d < 1e-3 ? 0 : (dx * Math.cos(yaw) - dz * Math.sin(yaw)) / d;
  // Tout près, le son est presque au centre (on est dessus).
  const near = Math.min(1, d / ref);
  out.pan = Math.max(-1, Math.min(1, side * PAN_WIDTH * near));
  return out;
}

function furnitureAt(world: World, id: string): [number, number] | null {
  const f = world.furniture.find((x) => x.id === id);
  return f === undefined ? null : [f.x, f.z];
}

function firstOfType(world: World, types: readonly string[]): [number, number] | null {
  for (const t of types) {
    const f = world.furniture.find((x) => x.type === t);
    if (f !== undefined) return [f.x, f.z];
  }
  return null;
}

/** Porte d'entrée (point `entrance` du plan). */
export function doorPoint(content: Content): [number, number] {
  const level = content.plan.levels[0] as unknown as
    { points?: Record<string, unknown> } | undefined;
  const raw = level?.points?.entrance;
  const p = Array.isArray(raw) && Array.isArray(raw[0]) ? (raw[0] as unknown[]) : raw;
  return Array.isArray(p) && typeof p[0] === 'number' && typeof p[1] === 'number'
    ? [p[0], p[1]]
    : [9.4, 16];
}

/**
 * Où se produit un événement: au poste (`furniture`), à la caisse (paiement, pourboire), à la
 * porte (un client entre, la livraison), sinon chez le joueur qui l'a fait; `null`: partout
 * (interface, annonces).
 */
export function eventPoint(
  content: Content,
  world: World,
  event: GameEvent,
): [number, number] | null {
  const e = event as { type: string; furniture?: unknown; player?: unknown };
  if (typeof e.furniture === 'string') return furnitureAt(world, e.furniture);
  switch (e.type) {
    case 'service-paid':
    case 'service-tip':
    case 'service-order-taken':
    case 'clientele-left':
    case 'clientele-purchased':
      return firstOfType(world, ['caisse']);
    case 'service-ticket-ready':
    case 'service-ticket-collected':
      return firstOfType(world, ['passe', 'rail-tickets']);
    case 'clientele-arrived':
    case 'clientele-delivery':
      return doorPoint(content);
    default:
      break;
  }
  if (e.player === 0 || e.player === 1) {
    const p = world.players[e.player];
    return [p.x, p.z];
  }
  return null;
}
