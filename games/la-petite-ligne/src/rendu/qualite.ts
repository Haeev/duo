/**
 * Qualité adaptative du rendu: d'après la durée des images, descend d'un
 * palier de résolution, passe au mode léger quand le dernier palier ne suffit
 * plus, et en revient au plus `maxReturns` fois par séance. Logique pure, sans
 * WebGL: le moteur (`moteur.ts`) applique ce qu'elle décide, les tests lui
 * donnent des durées d'image fabriquées.
 *
 * Hystérésis: on se replie sur une moyenne lente tenue `slowSeconds`, on ne
 * revient que sur une moyenne au rythme de l'écran tenue `returnSeconds`, et
 * un second repli est définitif. Pas d'aller-retour possible.
 */
import { RENDER_SETTINGS } from './reglages';

export type QualityChange =
  /** Palier de résolution dynamique suivant (index dans `steps`). */
  | { kind: 'step'; step: number }
  /** Repli vers le mode léger; `final`: plus aucun retour pendant la séance. */
  | { kind: 'light'; final: boolean }
  /** Retour à la qualité normale, au dernier palier de résolution. */
  | { kind: 'normal' };

export interface AdaptiveSettings {
  readonly dynamicResolution: {
    readonly steps: readonly number[];
    readonly slowFrameMs: number;
    readonly averageSeconds: number;
    readonly cooldownSeconds: number;
    readonly warmupSeconds: number;
    readonly ignoreFrameMs: number;
    readonly refreshRiseSeconds: number;
    readonly minRefreshMs: number;
    readonly maxRefreshMs: number;
    readonly slowRatio: number;
  };
  readonly autoLight: {
    readonly slowSeconds: number;
    readonly comfortRatio: number;
    readonly returnSeconds: number;
    readonly maxReturns: number;
  };
}

const MS_PER_SECOND = 1000;

export class AdaptiveQuality {
  private step = 0;
  private light = false;
  private returns = 0;
  private time = 0;
  /**
   * Images et temps comptés sur une fenêtre glissante (`averageSeconds`): leur
   * rapport est la durée moyenne d'une image, l'inverse des images par
   * seconde. Une moyenne pondérée par le temps surévaluerait les images en
   * retard (une sur vingt à 33 ms: 18,3 ms au lieu de 17,5).
   */
  private windowFrames = 0;
  private windowSeconds = 0;
  private averageMs = 0;
  /** Plancher des durées d'image (ms), estimation de la période de l'écran. */
  private floorMs = 0;
  private sinceChange = 0;
  private slowFor = 0;
  private comfortFor = 0;

  constructor(private readonly settings: AdaptiveSettings = RENDER_SETTINGS) {}

  /** Palier de résolution dynamique courant (index dans `steps`). */
  resolutionStep(): number {
    return this.step;
  }

  /** Mode léger en vigueur. */
  isLight(): boolean {
    return this.light;
  }

  /** Moyenne glissante des images (ms), pour le journal. */
  averageFrameMs(): number {
    return this.averageMs;
  }

  /** Période de l'écran estimée et bornée (ms). */
  refreshMs(): number {
    const s = this.settings.dynamicResolution;
    return Math.min(s.maxRefreshMs, Math.max(s.minRefreshMs, this.floorMs));
  }

  /** Une image de `dtSeconds` vient d'être dessinée: changement à appliquer, ou `null`. */
  sample(dtSeconds: number): QualityChange | null {
    const s = this.settings.dynamicResolution;
    const ms = dtSeconds * MS_PER_SECOND;
    if (!(ms > 0) || ms > s.ignoreFrameMs) return null;
    this.time += dtSeconds;
    const keep = Math.max(0, 1 - dtSeconds / s.averageSeconds);
    this.windowFrames = this.windowFrames * keep + 1;
    this.windowSeconds = this.windowSeconds * keep + dtSeconds;
    this.averageMs = (this.windowSeconds / this.windowFrames) * MS_PER_SECOND;
    if (this.floorMs === 0 || ms < this.floorMs) this.floorMs = ms;
    else this.floorMs += (ms - this.floorMs) * Math.min(1, dtSeconds / s.refreshRiseSeconds);
    this.sinceChange += dtSeconds;
    if (this.time < s.warmupSeconds || this.sinceChange < s.cooldownSeconds) return null;
    return this.light ? this.considerReturn(dtSeconds) : this.considerSlow(dtSeconds);
  }

  private considerSlow(dtSeconds: number): QualityChange | null {
    const s = this.settings.dynamicResolution;
    const slowMs = Math.max(s.slowFrameMs, this.refreshMs() * s.slowRatio);
    if (this.averageMs <= slowMs) {
      this.slowFor = 0;
      return null;
    }
    if (this.step < s.steps.length - 1) {
      this.step += 1;
      this.changed();
      return { kind: 'step', step: this.step };
    }
    this.slowFor += dtSeconds;
    if (this.slowFor < this.settings.autoLight.slowSeconds) return null;
    this.light = true;
    this.changed();
    return { kind: 'light', final: this.returns >= this.settings.autoLight.maxReturns };
  }

  private considerReturn(dtSeconds: number): QualityChange | null {
    const auto = this.settings.autoLight;
    if (this.returns >= auto.maxReturns) return null;
    if (this.averageMs > this.refreshMs() * auto.comfortRatio) {
      this.comfortFor = 0;
      return null;
    }
    this.comfortFor += dtSeconds;
    if (this.comfortFor < auto.returnSeconds) return null;
    this.light = false;
    this.returns += 1;
    this.changed();
    return { kind: 'normal' };
  }

  private changed(): void {
    this.sinceChange = 0;
    this.slowFor = 0;
    this.comfortFor = 0;
  }
}
