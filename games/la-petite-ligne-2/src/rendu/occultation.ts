/**
 * Occultation (technique 3.5): ce qui se trouve entre la caméra et un personnage à garder visible
 * (murs, toits, houppiers, grands meubles) s'ouvre, pour n'importe quel angle. Un rayon part du
 * personnage vers la caméra, et tout volume qu'il traverse est retenu. Logique pure, sans WebGL.
 *
 * - Ancien rendu (`?rendu=aplats`): le volume retenu s'efface en fondu (`opacity()`).
 * - Rendu encré: il reste plein et ne s'ouvre que là où il cache vraiment un joueur, par une
 *   découpe en ellipse autour de lui (`cutZone`), bordée d'une trame d'encre; un bâtiment ouvert
 *   montre son dedans coupé à hauteur d'appui (`cutInterior`): murs en encre pleine, sol et faces
 *   intérieures sombres, jamais l'herbe sous son emprise. `openness()` fait grandir la découpe.
 *   Le nuanceur des volumes (`encre/matiere.ts`) refait ces deux calculs point par point.
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
  /** Temps écoulé depuis le dernier rayon qui touchait (s). */
  since: number;
  opacity: number;
}

export type CutSettings = OcclusionSettings['cut'];

/** Où tombe un point d'un volume ouvert: plein, dans la trame du bord, ou ouvert. */
export type CutZone = 'keep' | 'band' | 'open';

/** Axes de l'écran (droite, haut) pour une caméra orthographique tournée vers `-toCamera`. */
export function screenAxes(toCamera: Vec3): { right: Vec3; up: Vec3 } {
  const flat = Math.hypot(toCamera.x, toCamera.z);
  const right =
    flat < 1e-6 ? { x: 1, y: 0, z: 0 } : { x: toCamera.z / flat, y: 0, z: -toCamera.x / flat };
  // haut = toCamera x droite
  const up = {
    x: toCamera.y * right.z - toCamera.z * right.y,
    y: toCamera.z * right.x - toCamera.x * right.z,
    z: toCamera.x * right.y - toCamera.y * right.x,
  };
  return { right, up };
}

/**
 * Le point `point` d'un volume ouvert à `amount` (0 à 1) devant un joueur aux pieds `feet`:
 * s'ouvre-t-il ? Seul ce qui est plus haut que la coupe (`keep`), devant le joueur (`front`) et
 * dans l'ellipse autour de lui à l'écran s'ouvre; l'ellipse grandit avec `amount`. La couronne
 * `band` autour se dessine en traits (le nuanceur choisit trait par trait).
 */
export function cutZone(
  point: Vec3,
  feet: Vec3,
  toCamera: Vec3,
  amount: number,
  cut: CutSettings = RENDER_SETTINGS.occlusion.cut,
): CutZone {
  if (amount <= 0 || point.y < feet.y + cut.keep) return 'keep';
  const v = { x: point.x - feet.x, y: point.y - feet.y - cut.center, z: point.z - feet.z };
  const along = v.x * toCamera.x + v.y * toCamera.y + v.z * toCamera.z;
  if (along < cut.front) return 'keep';
  const { right, up } = screenAxes(toCamera);
  const qx = (v.x * right.x + v.z * right.z) / cut.radius[0];
  const qy = (v.x * up.x + v.y * up.y + v.z * up.z) / cut.radius[1];
  const reach = Math.hypot(qx, qy) / amount;
  if (reach < 1) return 'open';
  const band = cut.band / ((cut.radius[0] + cut.radius[1]) / 2);
  return reach < 1 + band ? 'band' : 'keep';
}

/** Emprise au sol d'un bâtiment (m, monde) et hauteur de son sol. */
export interface Footprint {
  readonly x0: number;
  readonly z0: number;
  readonly x1: number;
  readonly z1: number;
  readonly floor: number;
}

/** Ce que l'on voit par un point ouvert d'un bâtiment: le dehors, un mur coupé, son sol ou un mur vu de dedans. */
export type CutSight = 'air' | 'poche' | 'floor' | 'wall';

/**
 * Par un point ouvert de l'enveloppe d'un bâtiment, le regard descend jusqu'au plan de coupe (à
 * `keep` au-dessus des pieds du joueur). Hors de l'emprise: il ne rencontre plus rien du bâtiment
 * (le dehors, le joueur derrière). Sur l'épaisseur des murs: la tranche coupée. Dedans: le sol, ou
 * la face intérieure d'un mur s'il la touche avant le sol. Un joueur dans l'emprise (sous un
 * débord, au pied d'un repère plus large en haut qu'en bas): tout s'ouvre, rien ne le recouvre.
 */
export function cutInterior(
  point: Vec3,
  toCamera: Vec3,
  feet: Vec3,
  footprint: Footprint,
  cut: CutSettings = RENDER_SETTINGS.occlusion.cut,
): CutSight {
  const { x0, z0, x1, z1 } = footprint;
  if (feet.x > x0 && feet.x < x1 && feet.z > z0 && feet.z < z1) return 'air';
  const dy = Math.max(toCamera.y, 1e-3);
  const t1 = Math.max(0, point.y - feet.y - cut.keep) / dy;
  const qx = point.x - toCamera.x * t1;
  const qz = point.z - toCamera.z * t1;
  const edge = Math.min(qx - x0, x1 - qx, qz - z0, z1 - qz);
  if (edge < 0) return 'air';
  if (edge < cut.wall) return 'poche';
  const t2 = Math.max(0, point.y - footprint.floor) / dy;
  const px = point.x - toCamera.x * t2;
  const pz = point.z - toCamera.z * t2;
  const inner = Math.min(px - x0, x1 - px, pz - z0, z1 - pz);
  return inner >= cut.wall ? 'floor' : 'wall';
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
    this.entries.set(box.id, { box, hidden: false, since: Number.POSITIVE_INFINITY, opacity: 1 });
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
      entry.since = entry.hidden ? 0 : entry.since + dt;
      // Le volume reste ouvert `holdSeconds` après le dernier rayon: aucun battement le long d'un mur.
      const open = entry.hidden || entry.since < s.holdSeconds;
      const goal = open ? s.fadedOpacity : 1;
      if (entry.opacity === goal) continue;
      const seconds = open ? s.fadeOutSeconds : s.fadeInSeconds;
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

  /** Boîte déclarée d'un volume (`null`: inconnu). */
  box(id: string): OccluderBox | null {
    return this.entries.get(id)?.box ?? null;
  }

  /** Part d'ouverture d'un volume (0: plein, 1: découpe entière), qui suit le même fondu. */
  openness(id: string): number {
    return opennessOf(this.opacity(id), this.settings.fadedOpacity);
  }

  isHidden(id: string): boolean {
    return this.entries.get(id)?.hidden ?? false;
  }
}

/** Opacité d'un fondu vers sa part d'ouverture (0: plein, 1: ouvert en entier). */
export function opennessOf(opacity: number, faded: number): number {
  return Math.min(1, Math.max(0, (1 - opacity) / Math.max(1e-6, 1 - faded)));
}
