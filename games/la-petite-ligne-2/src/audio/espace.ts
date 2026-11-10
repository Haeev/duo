/**
 * Écoute placée simple, en 2D: le niveau suit la distance au personnage de ce joueur, le
 * panoramique suit l'écart latéral dans le repère de l'écran (donc le lacet de la caméra).
 * Pas de `PannerNode`: un gain et un `StereoPannerNode` suffisent à une vue de dessus.
 */
import type { Tuning } from './schemas';

export type SpaceTuning = Tuning['space'];

export interface Placement {
  /** Gain linéaire de 0 à 1 (modèle inverse), 0 au-delà de la portée. */
  readonly gain: number;
  /** De -1 (gauche) à 1 (droite). */
  readonly pan: number;
  readonly audible: boolean;
}

/** Gain linéaire pour une distance (m): plein niveau sous `refDistance`, puis modèle inverse. */
export function distanceGain(space: SpaceTuning, distance: number): number {
  const d = Math.max(distance, space.refDistance);
  return space.refDistance / (space.refDistance + space.rolloff * (d - space.refDistance));
}

/**
 * Place une source par rapport à l'oreille. `yaw`: direction du haut de l'écran au sol, comme
 * `cameraYaw()` du rendu; la droite de l'écran est donc (cos yaw, sin yaw).
 */
export function place(
  space: SpaceTuning,
  listener: { readonly x: number; readonly y: number },
  source: { readonly x: number; readonly y: number },
  yaw: number,
): Placement {
  const dx = source.x - listener.x;
  const dy = source.y - listener.y;
  const distance = Math.hypot(dx, dy);
  if (distance > space.cullDistance) return { gain: 0, pan: 0, audible: false };
  const lateral = dx * Math.cos(yaw) + dy * Math.sin(yaw);
  const pan = Math.max(-1, Math.min(1, lateral / space.panWidth)) * space.panAmount;
  return { gain: distanceGain(space, distance), pan, audible: true };
}

export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}
