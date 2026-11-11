/**
 * Occultation (technique 3.5): ce qui se trouve entre la caméra et un personnage à garder visible
 * (murs, toits, houppiers, grands meubles) s'efface en fondu, pour n'importe quel angle. Plus de
 * coupe par quadrant: un rayon part du personnage vers la caméra, et tout volume qu'il traverse
 * s'efface. Un volume se donne par sa boîte; un grand volume plein qui ne la remplit pas (le
 * coteau d'un tunnel) y ajoute le relevé de ses hauteurs, et ne s'efface que si le rayon passe
 * vraiment dessous. Logique pure, sans WebGL: le moteur applique `opacity()` aux matériaux.
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

/**
 * Relevé de hauteurs d'un grand volume plein (un coteau): le dessus du volume dans chaque case
 * d'une grille au sol. Sa boîte englobe bien plus que lui (toute la tranchée devant un tunnel):
 * le relevé dit si le rayon passe vraiment dessous.
 */
export interface HeightProfile {
  /** Coin de la grille (m) et côté d'une case. */
  readonly x0: number;
  readonly z0: number;
  readonly cell: number;
  readonly columns: number;
  readonly rows: number;
  /** Dessus du volume dans chaque case (m); `-Infinity`: rien dans la case. */
  readonly tops: Float32Array;
}

/** Boîte alignée sur les axes d'un volume qui peut cacher un personnage. */
export interface OccluderBox {
  readonly id: string;
  readonly min: Vec3;
  readonly max: Vec3;
  /** Grand volume plein: il ne cache que là où le rayon passe sous son dessus. */
  readonly profile?: HeightProfile;
}

/**
 * Relève les hauteurs d'un maillage. `positions`: sommets dans le repère du monde (x, y, z à la
 * suite); `index`: triangles (`null`: trois sommets à la suite par triangle); `cell`: côté d'une
 * case (m). Chaque triangle donne sa hauteur aux cases dont le centre tombe sous lui, et chaque
 * sommet à sa case (un triangle plus petit qu'une case, ou debout, compte aussi).
 */
export function heightProfile(
  positions: ArrayLike<number>,
  index: ArrayLike<number> | null,
  cell: number,
): HeightProfile {
  let minX = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  const count = Math.floor(positions.length / 3);
  for (let i = 0; i < count; i++) {
    const x = positions[i * 3] ?? 0;
    const z = positions[i * 3 + 2] ?? 0;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  if (count === 0) return { x0: 0, z0: 0, cell, columns: 0, rows: 0, tops: new Float32Array(0) };
  const columns = Math.max(1, Math.ceil((maxX - minX) / cell - 1e-6));
  const rows = Math.max(1, Math.ceil((maxZ - minZ) / cell - 1e-6));
  const tops = new Float32Array(columns * rows).fill(Number.NEGATIVE_INFINITY);
  const raise = (cx: number, cz: number, y: number): void => {
    if (cx < 0 || cz < 0 || cx >= columns || cz >= rows) return;
    const at = cz * columns + cx;
    if (y > (tops[at] ?? 0)) tops[at] = y;
  };
  const triangles = Math.floor((index === null ? count : index.length) / 3);
  for (let t = 0; t < triangles; t++) {
    const a = (index === null ? t * 3 : (index[t * 3] ?? 0)) * 3;
    const b = (index === null ? t * 3 + 1 : (index[t * 3 + 1] ?? 0)) * 3;
    const c = (index === null ? t * 3 + 2 : (index[t * 3 + 2] ?? 0)) * 3;
    const ax = (positions[a] ?? 0) - minX;
    const ay = positions[a + 1] ?? 0;
    const az = (positions[a + 2] ?? 0) - minZ;
    const bx = (positions[b] ?? 0) - minX;
    const by = positions[b + 1] ?? 0;
    const bz = (positions[b + 2] ?? 0) - minZ;
    const cx = (positions[c] ?? 0) - minX;
    const cy = positions[c + 1] ?? 0;
    const cz = (positions[c + 2] ?? 0) - minZ;
    // Un sommet au bord de la grille compte pour sa dernière case.
    raise(
      Math.min(columns - 1, Math.floor(ax / cell)),
      Math.min(rows - 1, Math.floor(az / cell)),
      ay,
    );
    raise(
      Math.min(columns - 1, Math.floor(bx / cell)),
      Math.min(rows - 1, Math.floor(bz / cell)),
      by,
    );
    raise(
      Math.min(columns - 1, Math.floor(cx / cell)),
      Math.min(rows - 1, Math.floor(cz / cell)),
      cy,
    );
    const area = (bx - ax) * (cz - az) - (cx - ax) * (bz - az);
    if (Math.abs(area) < 1e-9) continue;
    const i0 = Math.max(0, Math.floor(Math.min(ax, bx, cx) / cell));
    const i1 = Math.min(columns - 1, Math.floor(Math.max(ax, bx, cx) / cell));
    const j0 = Math.max(0, Math.floor(Math.min(az, bz, cz) / cell));
    const j1 = Math.min(rows - 1, Math.floor(Math.max(az, bz, cz) / cell));
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const px = (i + 0.5) * cell;
        const pz = (j + 0.5) * cell;
        // Coordonnées barycentriques du centre de la case dans le triangle vu de dessus.
        const u = ((bx - px) * (cz - pz) - (cx - px) * (bz - pz)) / area;
        const v = ((cx - px) * (az - pz) - (ax - px) * (cz - pz)) / area;
        const w = 1 - u - v;
        if (u < 0 || v < 0 || w < 0) continue;
        raise(i, j, u * ay + v * by + w * cy);
      }
  }
  return { x0: minX, z0: minZ, cell, columns, rows, tops };
}

/**
 * Le rayon `origin + t * direction` (t >= 0) passe-t-il sous le dessus du volume ? Il avance par
 * demi-cases. Les cases plus basses que `floor` ne comptent pas (un muret au pied du coteau ne
 * cache personne); `lower` abaisse le rayon (m): l'hystérésis d'un volume déjà effacé.
 */
export function rayHitsProfile(
  origin: Vec3,
  direction: Vec3,
  profile: HeightProfile,
  floor: number,
  lower = 0,
): boolean {
  const { x0, z0, cell, columns, rows, tops } = profile;
  if (columns === 0 || rows === 0) return false;
  const flat = Math.hypot(direction.x, direction.z);
  const topAt = (x: number, z: number): number => {
    const i = Math.floor((x - x0) / cell);
    const j = Math.floor((z - z0) / cell);
    if (i < 0 || j < 0 || i >= columns || j >= rows) return Number.NEGATIVE_INFINITY;
    return tops[j * columns + i] ?? Number.NEGATIVE_INFINITY;
  };
  const under = (x: number, y: number, z: number): boolean => {
    const top = topAt(x, z);
    return top >= floor && y - lower < top;
  };
  if (flat < 1e-6) return direction.y > 0 && under(origin.x, origin.y, origin.z);
  // Au plus d'un bout à l'autre de la grille.
  const reach = Math.hypot(columns, rows) * cell;
  const step = (cell * 0.5) / flat;
  for (let t = 0; t * flat <= reach; t += step)
    if (under(origin.x + direction.x * t, origin.y + direction.y * t, origin.z + direction.z * t))
      return true;
  return false;
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
      entry.hidden = this.blocks(
        entry.box,
        subjects,
        toCamera,
        margin,
        entry.hidden ? s.hysteresis : 0,
      );
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
    lower: number,
  ): boolean {
    const profile = box.profile;
    for (const feet of subjects) {
      // Meuble bas (comptoir, table, muret): son dessus n'atteint pas les épaules de ce
      // personnage, où qu'il soit posé (sol en relief, estrade). Il reste plein.
      if (box.max.y < feet.y + this.settings.minHeight) continue;
      for (const height of this.settings.probeHeights) {
        const origin = { x: feet.x, y: feet.y + height, z: feet.z };
        // Le volume sur lequel le personnage est posé, ou qu'il touche du pied sans être derrière,
        // ne compte pas: seul ce qui monte au-dessus du point visé peut le cacher.
        if (box.max.y <= origin.y) continue;
        if (!rayHitsBox(origin, toCamera, box, margin)) continue;
        // Grand volume plein: sa boîte ne suffit pas, le rayon doit passer sous son dessus.
        if (
          profile === undefined ||
          rayHitsProfile(origin, toCamera, profile, feet.y + this.settings.minHeight, lower)
        )
          return true;
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
