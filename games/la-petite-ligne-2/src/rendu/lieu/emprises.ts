/**
 * Emprises où rien ne se sème ni ne se pose (logique pure, sans Three.js): les meubles et les
 * repères de la carte (un potager est un meuble), les bâtiments, et le bord de toute autre surface
 * (chemin, dallage, voie, eau). Le semis des tuiles (touffes, cailloux, arbres, buissons) demande
 * une place libre avec sa garde; un objet au sol est repoussé hors de l'emprise d'un meuble.
 */
import type { GroundField } from './terrain-rendu';

/** Rectangle au sol (m, repère du lieu: x est, z sud). */
export interface Footprint {
  readonly x0: number;
  readonly z0: number;
  readonly x1: number;
  readonly z1: number;
}

/** Emprises d'un lieu, rangées par case pour répondre vite (des milliers de tirages par tuile). */
export class KeepOut {
  private readonly byCell = new Map<number, Footprint[]>();

  /**
   * `reach`: la plus grande garde qui sera demandée (m); chaque emprise est rangée dans les cases
   * qu'elle touche une fois élargie d'autant.
   */
  constructor(
    private readonly field: Pick<GroundField, 'width' | 'height' | 'cells' | 'looks'>,
    footprints: readonly Footprint[],
    private readonly reach: number,
  ) {
    const { width, height } = field;
    for (const rect of footprints) {
      const x0 = Math.max(0, Math.floor(rect.x0 - reach));
      const z0 = Math.max(0, Math.floor(rect.z0 - reach));
      const x1 = Math.min(width - 1, Math.floor(rect.x1 + reach));
      const z1 = Math.min(height - 1, Math.floor(rect.z1 + reach));
      for (let z = z0; z <= z1; z++)
        for (let x = x0; x <= x1; x++) {
          const list = this.byCell.get(z * width + x);
          if (list === undefined) this.byCell.set(z * width + x, [rect]);
          else list.push(rect);
        }
    }
  }

  /**
   * Vrai si un volume de garde `clear` (m, bornée à `reach`) peut se poser en (x, z): hors de
   * toute emprise élargie de sa garde, et sans mordre sur une autre surface que la sienne (un
   * brin d'herbe ne dépasse pas sur le chemin, un caillou du chemin ne roule pas dans le pré).
   */
  free(x: number, z: number, clear: number): boolean {
    const { width, height, cells, looks } = this.field;
    const cx = Math.floor(x);
    const cz = Math.floor(z);
    if (cx < 0 || cz < 0 || cx >= width || cz >= height) return false;
    const r = Math.min(clear, this.reach);
    for (const rect of this.byCell.get(cz * width + cx) ?? [])
      if (x > rect.x0 - r && x < rect.x1 + r && z > rect.z0 - r && z < rect.z1 + r) return false;
    const own = looks[cells[cz * width + cx] ?? 0]?.surface;
    const x0 = Math.max(0, Math.floor(x - r));
    const z0 = Math.max(0, Math.floor(z - r));
    const x1 = Math.min(width - 1, Math.floor(x + r));
    const z1 = Math.min(height - 1, Math.floor(z + r));
    for (let j = z0; j <= z1; j++)
      for (let i = x0; i <= x1; i++)
        if (looks[cells[j * width + i] ?? 0]?.surface !== own) return false;
    return true;
  }
}

/**
 * Place d'un objet posé au sol une fois sorti des meubles: s'il tombe dans l'emprise d'un meuble
 * (élargie de `half`, sa demi-taille, et de `gap`), il glisse par le plus court jusqu'au bord. Une
 * seule passe: entre deux meubles collés il peut rester contre le second, jamais dessous.
 */
export function clearOf(
  x: number,
  z: number,
  half: number,
  gap: number,
  footprints: readonly Footprint[],
): { x: number; z: number } {
  let px = x;
  let pz = z;
  const grow = half + gap;
  // Deux tours: sorti d'un meuble, l'objet peut être entré dans son voisin.
  for (let turn = 0; turn < 2; turn++) {
    let moved = false;
    for (const rect of footprints) {
      const x0 = rect.x0 - grow;
      const x1 = rect.x1 + grow;
      const z0 = rect.z0 - grow;
      const z1 = rect.z1 + grow;
      if (px <= x0 || px >= x1 || pz <= z0 || pz >= z1) continue;
      const west = px - x0;
      const east = x1 - px;
      const north = pz - z0;
      const south = z1 - pz;
      const least = Math.min(west, east, north, south);
      // À égalité, vers le sud puis l'est: du côté de la caméra de départ, où on le voit.
      if (least === south) pz = z1;
      else if (least === east) px = x1;
      else if (least === north) pz = z0;
      else px = x0;
      moved = true;
    }
    if (!moved) break;
  }
  return { x: px, z: pz };
}
