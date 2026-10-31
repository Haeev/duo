/**
 * Calculs de l'écoute placée, sans Web Audio (testés dans Node).
 *
 * Le `PannerNode` ne fait que le panoramique (distance neutre): la distance est
 * calculée ici, depuis le personnage, avec le modèle de `sons.json` (formules
 * de la spécification Web Audio) et le plancher `minGainDb`. L'oreille du
 * panoramique est posée un peu derrière le personnage (vers le bas de l'écran),
 * pour qu'un son tout proche ne bascule pas d'un coup d'une oreille à l'autre.
 */
import type { Rect } from '../etat/carte';
import type { Vec2 } from '../etat/types';
import type { SpatialDef } from './catalogue';
import { dbToGain } from './reglages';

/** Gain de distance d'un son placé (0 à 1), plancher compris. */
export function distanceGain(spatial: SpatialDef, distance: number): number {
  const ref = spatial.refDistance;
  let gain: number;
  switch (spatial.model) {
    case 'inverse': {
      const d = Math.max(distance, ref);
      gain = ref / (ref + spatial.rolloff * (d - ref));
      break;
    }
    case 'linear': {
      const d = Math.min(Math.max(distance, ref), spatial.maxDistance);
      const span = spatial.maxDistance - ref;
      gain = span <= 0 ? 1 : 1 - (spatial.rolloff * (d - ref)) / span;
      break;
    }
    case 'exponential': {
      const d = Math.max(distance, ref);
      gain = Math.pow(d / ref, -spatial.rolloff);
      break;
    }
  }
  gain = Math.min(1, Math.max(0, gain));
  if (spatial.minGainDb !== null) gain = Math.max(gain, dbToGain(spatial.minGainDb));
  return gain;
}

/** Le son s'entend-il à cette distance (sinon on ne le lance pas) ? */
export function withinCull(spatial: SpatialDef, distance: number): boolean {
  return distance <= spatial.cullBeyond;
}

export function distanceBetween(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Distance d'un point à un rectangle de la carte (0 dedans). */
export function distanceToRect(p: Vec2, r: Rect): number {
  const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.w));
  const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.h));
  return Math.hypot(dx, dy);
}

/**
 * Orientation de l'oreille: `yaw` est la direction « haut de l'écran » au sol
 * (convention de `cameraYaw()` du rendu). Repère audio: x du monde, 0, y du
 * monde (comme Three.js). Renvoie le vecteur avant, au sol.
 */
export function listenerForward(yaw: number, out: { x: number; y: number }): { x: number; y: number } {
  out.x = Math.cos(yaw);
  out.y = Math.sin(yaw);
  return out;
}

/** Position de l'oreille du panoramique: derrière le personnage, vers le bas de l'écran. */
export function earPosition(at: Vec2, yaw: number, backOffset: number, out: { x: number; y: number }): { x: number; y: number } {
  out.x = at.x - Math.cos(yaw) * backOffset;
  out.y = at.y - Math.sin(yaw) * backOffset;
  return out;
}
