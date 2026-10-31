/**
 * Ce que chaque partie du rendu reçoit à chaque image, et les petites aides
 * partagées (interpolation, angles, désignation au clic).
 */
import { Box3, MathUtils, Vector3, type Ray } from 'three';
import type { PickResult } from '../etat/vue';
import type { CharacterId, ReadonlyWorld, Vec2 } from '../etat/types';

export interface FrameContext {
  world: ReadonlyWorld;
  /** Facteur d'interpolation entre `prev` et `pos` (0 à 1). */
  alpha: number;
  /** Durée de l'image (s), bornée pour qu'un onglet en arrière-plan ne fasse pas tout sauter. */
  dt: number;
  /** Temps de rendu cumulé (s), pour les animations décoratives. */
  time: number;
  local: CharacterId;
  /** Quart de tour de la caméra (0 à 3) et orientation affichée (radians, convention de `yaw`). */
  quarter: number;
  shownYaw: number;
  /** 0 le jour, 1 la nuit. */
  night: number;
  reducedMotion: boolean;
}

/** Une partie du rendu mise à jour à chaque image. */
export interface RenderPart {
  update(context: FrameContext): void;
}

/** Position interpolée d'un mobile (`prev` vers `pos`), écrite dans `out` (x, y du sol). */
export function interpolate(prev: Readonly<Vec2>, pos: Readonly<Vec2>, alpha: number, out: Vec2): Vec2 {
  out.x = prev.x + (pos.x - prev.x) * alpha;
  out.y = prev.y + (pos.y - prev.y) * alpha;
  return out;
}

/** Rotation Three.js (`rotation.y`) d'un modèle qui regarde +Z au repos, pour un `facing` du sol. */
export function yawFromFacing(facing: number): number {
  return Math.PI / 2 - facing;
}

/** Rotation Three.js d'un objet de la carte ou d'un meuble (quarts de tour, 0 face au sud). */
export function yawFromQuarter(quarter: number): number {
  return quarter * (Math.PI / 2);
}

/** Approche un angle d'un autre par le plus court chemin. */
export function dampAngle(current: number, target: number, factor: number): number {
  const delta = MathUtils.euclideanModulo(target - current + Math.PI, Math.PI * 2) - Math.PI;
  return current + delta * factor;
}

/** Ce qu'un clic peut désigner: une boîte englobante et le résultat à renvoyer. */
export interface PickTarget {
  box: Box3;
  result: PickResult;
  enabled: boolean;
}

export class PickRegistry {
  private readonly targets: PickTarget[] = [];
  private readonly hit = new Vector3();

  add(result: PickResult): PickTarget {
    const target: PickTarget = { box: new Box3(), result, enabled: false };
    this.targets.push(target);
    return target;
  }

  remove(target: PickTarget): void {
    const index = this.targets.indexOf(target);
    if (index >= 0) {
      this.targets.splice(index, 1);
    }
  }

  /** Cible la plus proche touchée par le rayon, avec sa distance. */
  nearest(ray: Ray): { result: PickResult; distance: number } | null {
    let best: { result: PickResult; distance: number } | null = null;
    for (const target of this.targets) {
      if (!target.enabled) {
        continue;
      }
      const point = ray.intersectBox(target.box, this.hit);
      if (point === null) {
        continue;
      }
      const distance = point.distanceTo(ray.origin);
      if (best === null || distance < best.distance) {
        best = { result: target.result, distance };
      }
    }
    return best;
  }
}

/** Boîte d'un objet debout posé en (x, sol, y), de rayon `radius` et de hauteur `height`. */
export function setStandingBox(box: Box3, x: number, ground: number, y: number, radius: number, height: number): void {
  box.min.set(x - radius, ground, y - radius);
  box.max.set(x + radius, ground + height, y + radius);
}
