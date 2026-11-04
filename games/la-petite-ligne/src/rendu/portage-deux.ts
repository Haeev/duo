/**
 * Charges portées à deux (retour R14, 2026-11-03: le colis flottait au-dessus et à côté des deux
 * porteurs, bras levés, sans contact). Le rendu pose la charge dans les mains des porteurs, telles
 * que l'animation les place à cette image, au lieu de la poser à un point fixe de la simulation:
 * - charge longue (poutre, étal: modèle couché le long d'un axe): portée au-dessus de la tête
 *   (`carry_two`, mains jointes au-dessus de la tête), son axe passe au-dessus des deux porteurs;
 * - charge courte (colis, caisses, panière): les porteurs se font face (`carry.grip.apart`),
 *   bras devant la poitrine (`carry_one`), la charge entre leurs mains;
 * - la draisine roule au sol (`vie.ts`).
 */
import type { Content } from '../donnees/types';
import type { Beam, DeepReadonly } from '../etat/types';
import type { ModelLibrary } from './modeles';

export type LoadShape = 'long' | 'short' | 'rolling';

export function loadShape(content: Content, library: Pick<ModelLibrary, 'extras'>, beam: DeepReadonly<Beam>): LoadShape {
  if (beam.purpose === 'handcar') return 'rolling';
  if ((content.settings.carry.lengths[beam.item] ?? 0) > 0) return 'long';
  const model = content.items[beam.item]?.model ?? beam.item;
  return typeof library.extras(model).length_axis === 'string' ? 'long' : 'short';
}

/** Point 3D minimal (repère du monde: x, y vers le haut, z). */
export interface Point3 {
  x: number;
  y: number;
  z: number;
}

/** Mains des deux porteurs à cette image (repère du monde). */
export interface CarrierHands {
  a: { left: Point3; right: Point3 };
  b: { left: Point3; right: Point3 };
}

/**
 * Où dessiner la charge à cette image: centre au sol (x, z), hauteur de sa base et cap, d'après les
 * mains des porteurs. `height`: hauteur du modèle (m), `grip`: les mains prennent la charge à cette
 * hauteur au-dessus de sa base (moitié de la hauteur pour une caisse tenue par les côtés, 0 pour une
 * poutre posée sur les mains). `beamYaw`: cap de la charge longue (elle garde son orientation).
 */
export function loadPose(
  shape: 'long' | 'short',
  hands: CarrierHands,
  grip: number,
  beamAt: { x: number; z: number },
  beamYaw: number,
): { x: number; y: number; z: number; yaw: number } {
  const all = [hands.a.left, hands.a.right, hands.b.left, hands.b.right];
  const mid = {
    x: all.reduce((sum, p) => sum + p.x, 0) / all.length,
    y: all.reduce((sum, p) => sum + p.y, 0) / all.length,
    z: all.reduce((sum, p) => sum + p.z, 0) / all.length,
  };
  if (shape === 'short') {
    const ax = (hands.b.left.x + hands.b.right.x - hands.a.left.x - hands.a.right.x) / 2;
    const az = (hands.b.left.z + hands.b.right.z - hands.a.left.z - hands.a.right.z) / 2;
    // Le modèle est tourné pour que son X (sa longueur) aille d'un porteur à l'autre.
    return { x: mid.x, y: mid.y - grip, z: mid.z, yaw: Math.atan2(-az, ax) };
  }
  // Charge longue: son axe garde son cap, décalé en travers pour passer au-dessus des mains.
  const ux = Math.sin(beamYaw);
  const uz = Math.cos(beamYaw);
  const dx = mid.x - beamAt.x;
  const dz = mid.z - beamAt.z;
  const across = dx * uz - dz * ux;
  return { x: beamAt.x + uz * across, y: mid.y - grip, z: beamAt.z - ux * across, yaw: beamYaw };
}
