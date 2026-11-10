/**
 * La cible de la touche d'action réagit avant l'appui (références de ressenti, section 3;
 * interface.md, bulle d'action): elle rebondit une fois, garde un liseré clair, et une brillance
 * passe toutes les deux secondes. Une seule cible à la fois: celle que la simulation expose dans
 * `PlayerState.aim` pour le joueur local.
 */
import {
  BackSide,
  Box3,
  type Material,
  Mesh,
  MeshBasicMaterial,
  type Object3D,
  Vector3,
} from 'three';
import { isMesh } from './fondu';
import { RENDER_SETTINGS } from './reglages';

export type TargetSettings = typeof RENDER_SETTINGS.target;

export interface TargetPulse {
  /** Échelle de l'objet visé (1 au repos). */
  readonly scale: number;
  /** Lueur ajoutée à son émissif, de 0 à 1. */
  readonly glow: number;
}

/**
 * Réaction d'une cible visée depuis `seconds`. Logique pure. `reduced` (animations réduites):
 * ni rebond ni brillance qui passe, seulement la lueur fixe et le liseré.
 */
export function targetPulse(
  seconds: number,
  reduced: boolean,
  settings: TargetSettings = RENDER_SETTINGS.target,
): TargetPulse {
  if (reduced) return { scale: 1, glow: settings.glow };
  const t = seconds / Math.max(1e-6, settings.bounceSeconds);
  const scale = t >= 1 ? 1 : 1 + (settings.bounceScale - 1) * Math.sin(Math.PI * t);
  const phase = seconds % settings.sheenPeriod;
  const sheen =
    seconds >= settings.sheenPeriod && phase < settings.sheenSeconds
      ? Math.sin((Math.PI * phase) / settings.sheenSeconds) * settings.sheenStrength
      : 0;
  return { scale, glow: settings.glow + sheen };
}

/** Ce que le moteur donne pour faire réagir un objet: sa racine, et de quoi poser sa lueur. */
export interface Aimable {
  readonly object: Object3D;
  setGlow(glow: number): void;
}

const size = new Vector3();
const center = new Vector3();
const bounds = new Box3();

export class TargetHighlight {
  private readonly rim: Material;
  private current: { id: string; aimable: Aimable; shells: Mesh[]; baseScale: Vector3 } | null =
    null;
  private seconds = 0;

  constructor(
    private readonly reduced: boolean,
    private readonly settings: TargetSettings = RENDER_SETTINGS.target,
  ) {
    this.rim = new MeshBasicMaterial({ color: settings.rimColor, side: BackSide });
  }

  /** Identifiant de la cible en cours de réaction. */
  targetId(): string | null {
    return this.current?.id ?? null;
  }

  /**
   * Une image. `id`: la cible exposée par la simulation, `resolve`: l'objet de la scène qui porte
   * cet identifiant (`null` s'il n'est pas affiché: la cible attend sans erreur).
   */
  update(dt: number, id: string | null, resolve: (id: string) => Aimable | null): void {
    if (id !== (this.current?.id ?? null)) {
      this.release();
      const aimable = id === null ? null : resolve(id);
      if (id !== null && aimable !== null) {
        this.current = {
          id,
          aimable,
          shells: this.addShells(aimable.object),
          baseScale: aimable.object.scale.clone(),
        };
        this.seconds = 0;
      }
    }
    const current = this.current;
    if (current === null) return;
    this.seconds += dt;
    const pulse = targetPulse(this.seconds, this.reduced, this.settings);
    current.aimable.object.scale.copy(current.baseScale).multiplyScalar(pulse.scale);
    current.aimable.setGlow(pulse.glow);
  }

  /**
   * Liseré: une coque de l'objet, un peu plus grande, dont on ne voit que l'intérieur. Elle
   * dépasse de `rimWidth` autour de la silhouette, sans post-traitement ni programme coûteux.
   */
  private addShells(root: Object3D): Mesh[] {
    const sources: Mesh[] = [];
    root.traverse((object) => {
      if (isMesh(object) && !('isSkinnedMesh' in object)) sources.push(object);
    });
    const shells: Mesh[] = [];
    for (const source of sources) {
      const geometry = source.geometry;
      if (geometry.boundingBox === null) geometry.computeBoundingBox();
      bounds.copy(geometry.boundingBox ?? bounds.makeEmpty());
      if (bounds.isEmpty()) continue;
      bounds.getSize(size);
      bounds.getCenter(center);
      const shell = new Mesh(geometry, this.rim);
      const grow = this.settings.rimWidth * 2;
      shell.scale.set(
        1 + grow / Math.max(size.x, grow),
        1 + grow / Math.max(size.y, grow),
        1 + grow / Math.max(size.z, grow),
      );
      shell.position.set(
        center.x * (1 - shell.scale.x),
        center.y * (1 - shell.scale.y),
        center.z * (1 - shell.scale.z),
      );
      shell.castShadow = false;
      shell.receiveShadow = false;
      source.add(shell);
      shells.push(shell);
    }
    return shells;
  }

  /** Rend l'objet visé à son état de repos (changement de cible, départ du lieu). */
  release(): void {
    const current = this.current;
    if (current === null) return;
    for (const shell of current.shells) shell.removeFromParent();
    current.aimable.object.scale.copy(current.baseScale);
    current.aimable.setGlow(0);
    this.current = null;
  }

  dispose(): void {
    this.release();
    this.rim.dispose();
  }
}
