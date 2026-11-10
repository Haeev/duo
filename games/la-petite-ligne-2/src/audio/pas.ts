/**
 * Pas sonores calés sur la foulée: un pas toutes les `strideMeters` parcourues, à condition de
 * marcher vraiment (vitesse minimale). La surface sous les pieds choisit le son (table).
 */
import type { Tuning } from './schemas';

export type StepTuning = Tuning['steps'];

export interface BodyPoint {
  readonly x: number;
  readonly y: number;
  readonly speed: number;
}

export class StepTracker {
  private last: { x: number; y: number } | null = null;
  private walked = 0;

  constructor(private readonly tuning: StepTuning) {}

  /** Nombre de pas à jouer depuis la dernière image (0 ou 1 le plus souvent). */
  update(body: BodyPoint): number {
    const previous = this.last;
    this.last = { x: body.x, y: body.y };
    if (previous === null) return 0;
    const moved = Math.hypot(body.x - previous.x, body.y - previous.y);
    // Un saut de repositionnement (retour au point de départ) n'est pas une marche.
    if (body.speed < this.tuning.minSpeed || moved > 2) {
      this.walked = 0;
      return 0;
    }
    this.walked += moved;
    let steps = 0;
    while (this.walked >= this.tuning.strideMeters) {
      this.walked -= this.tuning.strideMeters;
      steps += 1;
    }
    return Math.min(steps, 1);
  }

  reset(): void {
    this.last = null;
    this.walked = 0;
  }
}

/** Identifiant du son d'un pas sur cette surface (`default` si elle est inconnue). */
export function stepSound(tuning: StepTuning, surface: string | null): string {
  const id = surface === null ? undefined : tuning.surfaces[surface];
  return id ?? tuning.surfaces[tuning.default] ?? '';
}
