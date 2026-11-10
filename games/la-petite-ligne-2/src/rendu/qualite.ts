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
    readonly cutFrameMs: number;
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

  /** Pourquoi les ombres ont été coupées (journal), `null` tant qu'elles sont là. */
  private reason: ShadowCutReason | null = null;

  /**
   * `usefulSteps`: nombre de paliers de résolution qui changent vraiment l'image sur cet écran
   * (`usefulResolutionSteps`). Sur le PC (1366x768 à 100, 125 ou 150 %), le plancher de netteté
   * les rend tous égaux à la pleine résolution: un seul palier utile.
   */
  constructor(
    private readonly settings: AdaptiveSettings = RENDER_SETTINGS,
    private readonly usefulSteps: () => number = () => settings.dynamicResolution.steps.length,
  ) {}

  /** Raison du dernier repli (moyenne et seuil), pour le journal de Duo. */
  lastReason(): ShadowCutReason | null {
    return this.reason;
  }

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
    const lastUseful = Math.min(s.steps.length, Math.max(1, this.usefulSteps())) - 1;
    if (this.step < lastUseful && this.averageMs > slowMs) {
      this.step += 1;
      this.changed();
      return { kind: 'step', step: this.step };
    }
    // Les ombres ne partent que si la machine peine vraiment: sous `cutFrameMs` tenu `slowSeconds`,
    // au dernier palier qui change quelque chose. Au-dessus, le jeu garde ses ombres.
    const cutMs = Math.max(this.settings.autoLight.cutFrameMs, slowMs);
    if (this.averageMs <= cutMs) {
      this.slowFor = 0;
      return null;
    }
    this.slowFor += dtSeconds;
    if (this.slowFor < this.settings.autoLight.slowSeconds) return null;
    this.reason = {
      averageFrameMs: this.averageMs,
      thresholdMs: cutMs,
      slowSeconds: this.slowFor,
      refreshMs: this.refreshMs(),
      resolutionStep: this.step,
      usefulSteps: lastUseful + 1,
    };
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

  /**
   * Dernier palier et repli définitif, sans attendre de lenteur: page de
   * démonstration (`repli=1`), pour voir l'image d'un PC à la peine.
   */
  forceFallback(): QualityChange {
    this.step = this.settings.dynamicResolution.steps.length - 1;
    this.reason = {
      averageFrameMs: this.averageMs,
      thresholdMs: 0,
      slowSeconds: 0,
      refreshMs: this.refreshMs(),
      resolutionStep: this.step,
      usefulSteps: this.step + 1,
    };
    this.light = true;
    this.returns = this.settings.autoLight.maxReturns;
    this.changed();
    return { kind: 'light', final: true };
  }

  private changed(): void {
    this.sinceChange = 0;
    this.slowFor = 0;
    this.comfortFor = 0;
  }
}

/** Ce qui a fait couper les ombres (journal de Duo). */
export interface ShadowCutReason {
  /** Moyenne glissante des images au moment du repli (ms). */
  averageFrameMs: number;
  /** Seuil dépassé (ms): `autoLight.cutFrameMs`, ou la période de l'écran x `slowRatio`. */
  thresholdMs: number;
  /** Durée de lenteur continue avant le repli (s). */
  slowSeconds: number;
  refreshMs: number;
  resolutionStep: number;
  usefulSteps: number;
}

/** Ce que le moteur sait de la carte graphique et du navigateur (journal seulement). */
export interface GraphicsInfo {
  readonly userAgent: string;
  /** Rendu de la carte graphique (`UNMASKED_RENDERER_WEBGL`), ou chaîne vide si le navigateur le cache. */
  readonly renderer: string;
}

/**
 * Ligne du journal de Duo quand les ombres partent: pourquoi, sur quel écran, avec
 * quelle carte graphique. Rien ici ne décide: agent utilisateur, carte graphique et taille d'écran
 * ne servent qu'au journal, la décision ne lit que la durée des images.
 */
export function shadowCutLog(
  reason: ShadowCutReason,
  surface: DisplaySurface,
  buffer: { width: number; height: number },
  graphics: GraphicsInfo,
  final: boolean,
): Record<string, string | number | boolean> {
  return {
    cause: reason.thresholdMs > 0 ? 'images trop lentes' : 'repli imposé (page de démonstration)',
    moyenneImageMs: Math.round(reason.averageFrameMs * 10) / 10,
    seuilMs: Math.round(reason.thresholdMs * 10) / 10,
    lenteurSecondes: Math.round(reason.slowSeconds * 10) / 10,
    periodeEcranMs: Math.round(reason.refreshMs * 10) / 10,
    palier: reason.resolutionStep,
    paliersUtiles: reason.usefulSteps,
    ecranCss: `${String(Math.round(surface.cssWidth))}x${String(Math.round(surface.cssHeight))}`,
    echelle: surface.devicePixelRatio,
    tampon: `${String(buffer.width)}x${String(buffer.height)}`,
    carteGraphique: graphics.renderer === '' ? 'inconnue' : graphics.renderer,
    navigateur: graphics.userAgent,
    definitif: final,
  };
}

/**
 * Paliers de la résolution dynamique qui donnent chacun une image plus petite que le précédent sur
 * cette surface (au moins un: la pleine résolution). Un palier qui ne change rien ne doit pas
 * compter comme un levier avant de couper les ombres.
 */
export function usefulResolutionSteps(
  surface: DisplaySurface,
  steps: readonly number[],
  settings: RenderSizeSettings = RENDER_SETTINGS,
): number {
  let useful = 1;
  let previous = renderPixelSize(surface, steps[0] ?? 1, false, settings);
  for (let i = 1; i < steps.length; i += 1) {
    const size = renderPixelSize(surface, steps[i] ?? 1, false, settings);
    if (size.width * size.height >= previous.width * previous.height) break;
    useful = i + 1;
    previous = size;
  }
  return useful;
}

/** Ce que le moteur sait de la surface d'affichage, pour `renderPixelSize`. */
export interface DisplaySurface {
  /** Taille du conteneur en points CSS. */
  readonly cssWidth: number;
  readonly cssHeight: number;
  readonly devicePixelRatio: number;
  /**
   * Taille exacte en pixels physiques (`devicePixelContentBoxSize` du
   * `ResizeObserver`), ou `null` si le navigateur ne la donne pas.
   */
  readonly devicePixels: { readonly width: number; readonly height: number } | null;
}

export interface RenderSizeSettings {
  readonly renderer: {
    readonly maxPixelRatio: number;
    readonly maxPhysicalPixels: number;
    readonly minCrispRatio: number;
  };
  readonly light: { readonly pixelRatio: number; readonly maxPhysicalPixels: number };
}

/**
 * Taille du tampon de rendu (pixels), selon l'écran et la qualité.
 *
 * - `requestedLight`: mode léger des tests en rendu logiciel, basse résolution voulue.
 * - Sinon: rapport plafonné (2, budget de pixels), réduit par le palier de la
 *   résolution dynamique sans descendre sous le plancher de netteté. Le repli
 *   automatique (ombres coupées) garde cette résolution.
 *
 * À la pleine résolution de l'écran, la taille est celle des pixels physiques
 * exacts quand on la connaît: un écart d'un pixel entre le tampon et l'écran
 * (arrondi d'une largeur CSS fractionnaire à 125 %) suffit à rééchantillonner
 * toute l'image, donc à l'adoucir.
 */
export function renderPixelSize(
  surface: DisplaySurface,
  scale: number,
  requestedLight: boolean,
  settings: RenderSizeSettings = RENDER_SETTINGS,
): { width: number; height: number; ratio: number } {
  const cssWidth = Math.max(1, surface.cssWidth);
  const cssHeight = Math.max(1, surface.cssHeight);
  const dpr = surface.devicePixelRatio > 0 ? surface.devicePixelRatio : 1;
  const area = cssWidth * cssHeight;
  let ratio: number;
  if (requestedLight) {
    ratio = Math.min(settings.light.pixelRatio, Math.sqrt(settings.light.maxPhysicalPixels / area));
  } else {
    const r = settings.renderer;
    const cap = Math.min(dpr, r.maxPixelRatio, Math.sqrt(r.maxPhysicalPixels / area));
    const crisp = Math.min(cap, r.minCrispRatio);
    ratio = Math.max(crisp, cap * scale);
  }
  // Boîte physique gardée seulement si elle concorde avec la taille CSS x dpr (au pixel d'arrondi
  // près): sous Chromium sans tête, l'échelle émulée n'y est pas appliquée.
  const native =
    surface.devicePixels !== null &&
    Math.abs(surface.devicePixels.width - cssWidth * dpr) <= NATIVE_SLACK &&
    Math.abs(surface.devicePixels.height - cssHeight * dpr) <= NATIVE_SLACK
      ? surface.devicePixels
      : null;
  // Pleine résolution de l'écran (à un millième près): pixels physiques exacts.
  if (native !== null && ratio >= dpr * NATIVE_TOLERANCE) {
    const width = Math.max(1, Math.round(native.width));
    const height = Math.max(1, Math.round(native.height));
    return { width, height, ratio: width / cssWidth };
  }
  return {
    width: Math.max(1, Math.round(cssWidth * ratio)),
    height: Math.max(1, Math.round(cssHeight * ratio)),
    ratio,
  };
}

const NATIVE_TOLERANCE = 0.999;
/** Écart toléré entre la boîte physique et la taille CSS x dpr (pixels d'arrondi). */
const NATIVE_SLACK = 2;
