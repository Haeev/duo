/**
 * Variantes et variations (son.md 3.1): tirage sans répétition immédiate,
 * hauteur par `playbackRate`, niveau en dB. L'aléa vient d'un générateur à
 * graine du SDK (graine de la séance), jamais de `Math.random`.
 */
import type { RandomSource } from '@duo/sdk/sim';

/** Tire l'index d'une variante, sans répéter la dernière de ce son. */
export class VariantPicker {
  private readonly last = new Map<string, number>();

  constructor(private readonly random: RandomSource) {}

  pick(sound: string, count: number, shuffle: boolean): number {
    if (count <= 1) return 0;
    if (!shuffle) return 0;
    const previous = this.last.get(sound);
    let index: number;
    if (previous === undefined) {
      index = this.random.int(0, count);
    } else {
      // Un tirage parmi les autres: l'écart à la précédente va de 1 à count - 1.
      index = (previous + this.random.int(1, count)) % count;
    }
    this.last.set(sound, index);
    return index;
  }
}

export interface Variation {
  /** Vitesse de lecture (hauteur et durée). */
  rate: number;
  /** Écart de niveau (dB). */
  gainDb: number;
}

/** Variation de hauteur et de niveau d'une lecture. */
export function drawVariation(random: RandomSource, pitchVariation: number, gainVariationDb: number, out: Variation): Variation {
  out.rate = pitchVariation > 0 ? 1 + random.float(-pitchVariation, pitchVariation) : 1;
  out.gainDb = gainVariationDb > 0 ? random.float(-gainVariationDb, gainVariationDb) : 0;
  return out;
}
