/**
 * Rendu encré: résolution interne adaptative (ADR 0023, point 11). Logique pure, sans WebGL:
 * `InkKit` lui donne la durée de chaque image et applique l'échelle qu'elle rend; les tests lui
 * donnent des durées fabriquées.
 *
 * Hystérésis: on descend sur une moyenne trop lente tenue `downSeconds`; on ne remonte que si le
 * temps prévu au palier du dessus garde de la marge pendant `upSeconds`, et une remontée ratée
 * allonge l'attente de la suivante. Aucune allocation par image.
 */
import { INK_SETTINGS } from './reglages';

export type ScaleSettings = typeof INK_SETTINGS.resolution;

/** Échelle demandée par l'adresse (`?echelle=0.8`, `?echelle=auto`), ou `undefined`. */
export function scaleFromAddress(
  search: string,
  settings: ScaleSettings = INK_SETTINGS.resolution,
): number | 'auto' | undefined {
  const asked = new URLSearchParams(search).get(settings.param);
  if (asked === null) return undefined;
  if (asked === 'auto') return 'auto';
  const value = Number(asked);
  return Number.isFinite(value) && value >= 0.5 && value <= 1 ? value : undefined;
}

const MS = 1000;

export class InkScale {
  private step = 0;
  private fixed: number | null;
  private frames = 0;
  private seconds = 0;
  private average = 0;
  /** Temps depuis le dernier changement (s), et temps passé d'affilée trop lent ou à l'aise. */
  private sinceChange = 0;
  private slowFor = 0;
  private easyFor = 0;
  private wait = 0;
  private upSeconds: number;
  /** Le dernier changement était une remontée: une redescente rapide la compte comme ratée. */
  private climbed = false;
  private changes = 0;

  constructor(private readonly settings: ScaleSettings = INK_SETTINGS.resolution) {
    this.fixed = settings.mode === 'fixed' ? settings.fixedScale : null;
    this.upSeconds = settings.upSeconds;
    this.wait = settings.warmupSeconds;
  }

  /** Échelle en vigueur: part du côté du tampon du canevas (1: pleine finesse). */
  scale(): number {
    return this.fixed ?? this.settings.steps[this.step] ?? 1;
  }

  /** `null`: adaptative. */
  fixedScale(): number | null {
    return this.fixed;
  }

  /** Fige l'échelle (`null`: retour à l'adaptation, depuis la pleine finesse). */
  fix(scale: number | null): void {
    this.fixed = scale;
    this.step = 0;
    this.upSeconds = this.settings.upSeconds;
    this.reset(this.settings.cooldownSeconds);
  }

  /** Moyenne glissante de la durée d'une image (ms). */
  averageMs(): number {
    return this.average;
  }

  /** Nombre de changements d'échelle depuis le départ (mesure). */
  changeCount(): number {
    return this.changes;
  }

  /** Arrivée dans un lieu, programmes en compilation: on ne juge pas pendant `seconds`. */
  hold(seconds: number = this.settings.warmupSeconds): void {
    if (seconds > this.wait) this.reset(seconds);
  }

  private reset(wait: number): void {
    this.frames = 0;
    this.seconds = 0;
    this.slowFor = 0;
    this.easyFor = 0;
    this.wait = wait;
  }

  /** Une image de `dtMs` vient de passer. Rend vrai si l'échelle a changé. */
  sample(dtMs: number): boolean {
    const s = this.settings;
    if (this.fixed !== null || !(dtMs > 0) || dtMs > s.ignoreFrameMs) return false;
    const dt = dtMs / MS;
    this.sinceChange += dt;
    if (this.wait > 0) {
      this.wait -= dt;
      return false;
    }
    const keep = Math.max(0, 1 - dt / s.averageSeconds);
    this.frames = this.frames * keep + 1;
    this.seconds = this.seconds * keep + dt;
    this.average = (this.seconds / this.frames) * MS;
    // La moyenne ne vaut qu'une fois la fenêtre à moitié remplie.
    if (this.seconds < s.averageSeconds * 0.5) return false;

    const last = s.steps.length - 1;
    if (this.average > s.budgetMs * s.downRatio) {
      this.easyFor = 0;
      this.slowFor += dt;
      if (this.slowFor < s.downSeconds || this.step >= last) return false;
      if (this.climbed && this.sinceChange < s.retrySeconds)
        this.upSeconds = Math.min(s.maxUpSeconds, this.upSeconds * s.retryFactor);
      this.step += 1;
      this.changed(false);
      return true;
    }
    this.slowFor = 0;
    if (this.step === 0) return false;
    const here = s.steps[this.step] ?? 1;
    const above = s.steps[this.step - 1] ?? 1;
    // Pire cas: tout le temps de l'image est du remplissage, il suit la surface.
    const predicted = this.average * ((above * above) / (here * here));
    if (predicted > s.budgetMs * s.upRatio) {
      this.easyFor = 0;
      return false;
    }
    this.easyFor += dt;
    if (this.easyFor < this.upSeconds) return false;
    this.step -= 1;
    this.changed(true);
    return true;
  }

  private changed(climbed: boolean): void {
    this.climbed = climbed;
    this.changes += 1;
    this.sinceChange = 0;
    this.reset(this.settings.cooldownSeconds);
  }
}
