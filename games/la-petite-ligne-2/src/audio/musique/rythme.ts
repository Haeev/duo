/**
 * Rythme de la musique: elle ne joue pas en continu. Après une plage de jeu, un silence voulu où
 * seule l'ambiance reste, puis elle revient. Machine à états pure (testée dans Node).
 */
import type { RandomSource } from '@duo/sdk/sim';
import type { Pacing } from './schemas';

export interface PacerState {
  readonly mode: 'play' | 'quiet';
  /** Morceau à entendre maintenant (`null` pendant un silence). */
  readonly track: string | null;
}

export class Pacer {
  private mode: 'play' | 'quiet' = 'play';
  private playedFor = 0;
  private limit = 0;
  private quietLeft = 0;

  constructor(private readonly random: RandomSource) {}

  private draw(range: readonly [number, number]): number {
    const [low, high] = range;
    return high <= low ? low : this.random.float(low, high);
  }

  /**
   * `wanted`: morceau que les règles demandent (`null`: rien), `pacing`: rythme de la règle
   * (`null`: sans silence). Un morceau demandé qui change se fond tout de suite, sans repartir de zéro
   * le temps de jeu; un silence en cours n'est interrompu que par un rythme sans silence.
   */
  update(dt: number, wanted: string | null, pacing: Pacing): PacerState {
    if (wanted === null || pacing === null) {
      this.mode = 'play';
      this.playedFor = 0;
      this.limit = 0;
      return { mode: 'play', track: wanted };
    }
    if (this.mode === 'quiet') {
      this.quietLeft -= dt;
      if (this.quietLeft > 0) return { mode: 'quiet', track: null };
      this.mode = 'play';
      this.playedFor = 0;
      this.limit = this.draw(pacing.playSeconds);
    } else if (this.limit === 0) {
      this.limit = this.draw(pacing.playSeconds);
    }
    this.playedFor += dt;
    if (this.playedFor >= this.limit) {
      this.mode = 'quiet';
      this.quietLeft = this.draw(pacing.quietSeconds);
      return { mode: 'quiet', track: null };
    }
    return { mode: 'play', track: wanted };
  }
}
