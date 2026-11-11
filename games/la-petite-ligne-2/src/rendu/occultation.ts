/**
 * Occultation (technique 3.5): ce qui se trouve entre la caméra et un personnage à garder visible
 * (murs, toits, houppiers, grands meubles) s'efface en fondu, pour n'importe quel angle. Plus de
 * coupe par quadrant: un rayon part du personnage vers la caméra, et tout volume qu'il traverse
 * s'efface. Logique pure, sans WebGL: le moteur applique `opacity()` aux matériaux.
 *
 * Repère Three.js: X est, Y haut, Z sud.
 */
import { RENDER_SETTINGS } from './reglages';

export type OcclusionSettings = typeof RENDER_SETTINGS.occlusion;

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Boîte alignée sur les axes d'un volume qui peut cacher un personnage. */
export interface OccluderBox {
  readonly id: string;
  readonly min: Vec3;
  readonly max: Vec3;
}

/**
 * Le rayon `origin + t * direction` (t >= 0) traverse-t-il la boîte grossie de `margin` ?
 * Méthode des tranches. Une origine dans la boîte grossie compte: le personnage est dedans.
 */
export function rayHitsBox(
  origin: Vec3,
  direction: Vec3,
  box: OccluderBox,
  margin: number,
): boolean {
  let near = 0;
  let far = Number.POSITIVE_INFINITY;
  const axes = ['x', 'y', 'z'] as const;
  for (const axis of axes) {
    const o = origin[axis];
    const d = direction[axis];
    const min = box.min[axis] - margin;
    const max = box.max[axis] + margin;
    if (Math.abs(d) < 1e-9) {
      if (o < min || o > max) return false;
      continue;
    }
    const a = (min - o) / d;
    const b = (max - o) / d;
    near = Math.max(near, Math.min(a, b));
    far = Math.min(far, Math.max(a, b));
    if (near > far) return false;
  }
  return true;
}

interface Entry {
  readonly box: OccluderBox;
  hidden: boolean;
  opacity: number;
}

export class Occlusion {
  private readonly entries = new Map<string, Entry>();

  constructor(private readonly settings: OcclusionSettings = RENDER_SETTINGS.occlusion) {}

  /**
   * Déclare un volume. Plus bas que les épaules d'un personnage debout au sol (`minHeight`):
   * ignoré, il reste toujours plein. La même règle se rejoue par personnage dans `update`, à
   * partir de ses pieds, pour un volume posé plus haut que le sol.
   */
  add(box: OccluderBox): boolean {
    if (box.max.y < this.settings.minHeight) return false;
    this.entries.set(box.id, { box, hidden: false, opacity: 1 });
    return true;
  }

  remove(id: string): void {
    this.entries.delete(id);
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }

  /**
   * Une image: `subjects` sont les pieds des personnages à garder visibles (le joueur local),
   * `toCamera` la direction du sol vers la caméra. Rend les volumes dont l'opacité a changé.
   */
  update(dt: number, subjects: readonly Vec3[], toCamera: Vec3): readonly string[] {
    const s = this.settings;
    const changed: string[] = [];
    for (const [id, entry] of this.entries) {
      // Hystérésis: il faut s'écarter davantage pour réapparaître que pour s'effacer.
      const margin = entry.hidden ? s.margin + s.hysteresis : s.margin;
      entry.hidden = this.blocks(entry.box, subjects, toCamera, margin);
      const goal = entry.hidden ? s.fadedOpacity : 1;
      if (entry.opacity === goal) continue;
      const seconds = entry.hidden ? s.fadeOutSeconds : s.fadeInSeconds;
      const step = seconds <= 0 ? 1 : ((1 - s.fadedOpacity) * dt) / seconds;
      entry.opacity =
        goal < entry.opacity
          ? Math.max(goal, entry.opacity - step)
          : Math.min(goal, entry.opacity + step);
      changed.push(id);
    }
    return changed;
  }

  private blocks(
    box: OccluderBox,
    subjects: readonly Vec3[],
    toCamera: Vec3,
    margin: number,
  ): boolean {
    for (const feet of subjects) {
      // Meuble bas (comptoir, table, muret): son dessus n'atteint pas les épaules de ce
      // personnage, où qu'il soit posé (sol en relief, estrade). Il reste plein.
      if (box.max.y < feet.y + this.settings.minHeight) continue;
      for (const height of this.settings.probeHeights) {
        const origin = { x: feet.x, y: feet.y + height, z: feet.z };
        // Le volume sur lequel le personnage est posé, ou qu'il touche du pied sans être derrière,
        // ne compte pas: seul ce qui monte au-dessus du point visé peut le cacher.
        if (box.max.y <= origin.y) continue;
        if (rayHitsBox(origin, toCamera, box, margin)) return true;
      }
    }
    return false;
  }

  /** Opacité affichée d'un volume (1: plein). */
  opacity(id: string): number {
    return this.entries.get(id)?.opacity ?? 1;
  }

  isHidden(id: string): boolean {
    return this.entries.get(id)?.hidden ?? false;
  }
}
