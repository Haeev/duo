/**
 * Options graphiques appliquées par le rendu (reprise de l'ancien jeu): profil résolu (ombres, tampon, particules) et
 * filet de sécurité. Logique pure, sans WebGL: le moteur (`moteur.ts`) applique ce qu'elle décide,
 * les tests lui donnent des durées d'image fabriquées.
 *
 * Auto garde la qualité adaptative de `qualite.ts` telle quelle. Un préréglage choisi à la main
 * garde un filet: quand `AdaptiveQuality` juge la machine à la peine (moins de 24 images par
 * seconde tenues 5 s, `RENDER_SETTINGS.autoLight`), on descend d'un cran (Haute, Moyenne, Basse),
 * sauf « Ne jamais réduire ». Jamais de remontée seule: pas d'aller-retour.
 */
import { type GraphicsOptions, levelsOf, lowerOptions, shownLevels } from './options';
import { AdaptiveQuality, type AdaptiveSettings, type RenderSizeSettings } from './qualite';
import {
  GRAPHICS_RENDER_SETTINGS,
  RENDER_SETTINGS,
  type ResolutionProfile,
  type ShadowProfile,
} from './reglages';
import type { QualityChange } from './qualite';

/** Ce que le moteur applique. */
export interface RenderProfile {
  readonly shadows: ShadowProfile;
  readonly resolution: ResolutionProfile;
  readonly effectsShare: number;
  /** `adaptive`: Auto (`qualite.ts`); `safety`: filet d'un cran; `none`: aucun repli. */
  readonly guard: 'adaptive' | 'safety' | 'none';
}

export function resolveProfile(options: GraphicsOptions): RenderProfile {
  const manual = levelsOf(options);
  const levels = shownLevels(options);
  let guard: RenderProfile['guard'] = 'adaptive';
  if (manual !== null)
    guard = options.neverReduce || lowerOptions(options) === null ? 'none' : 'safety';
  return {
    shadows: GRAPHICS_RENDER_SETTINGS.shadows[levels.shadows],
    resolution: GRAPHICS_RENDER_SETTINGS.resolution[levels.resolution],
    effectsShare: GRAPHICS_RENDER_SETTINGS.effects[levels.effects],
    guard,
  };
}

/** Réglages de taille du tampon (`renderPixelSize`) pour cette netteté. */
export function sizeSettingsOf(resolution: ResolutionProfile): RenderSizeSettings {
  return {
    renderer: {
      maxPixelRatio: RENDER_SETTINGS.renderer.maxPixelRatio,
      maxPhysicalPixels: resolution.maxPhysicalPixels,
      minCrispRatio: resolution.minCrispRatio,
    },
    light: RENDER_SETTINGS.light,
  };
}

/** Ce que le moteur doit faire après une image. */
export type GovernorChange =
  /** Auto: décision de la qualité adaptative, appliquée telle quelle. */
  | { kind: 'adaptive'; change: QualityChange }
  /** Filet de sécurité: options un cran plus bas (à appliquer, à mémoriser et à montrer). */
  | { kind: 'reduced'; options: GraphicsOptions };

/**
 * Tient les options de la machine et la mesure qui va avec. Une nouvelle mesure part à chaque
 * changement (choix du joueur ou cran du filet): elle juge la qualité qu'on vient de poser, après
 * ses secondes d'échauffement.
 */
export class QualityGovernor {
  private options: GraphicsOptions;
  private profile: RenderProfile;
  private adaptive: AdaptiveQuality | null = null;

  constructor(
    options: GraphicsOptions,
    private readonly usefulSteps: () => number,
    private readonly settings: AdaptiveSettings = RENDER_SETTINGS,
  ) {
    this.options = options;
    this.profile = resolveProfile(options);
    this.restart();
  }

  current(): GraphicsOptions {
    return this.options;
  }

  currentProfile(): RenderProfile {
    return this.profile;
  }

  /** Mesure de la qualité adaptative en Auto (palier, mode léger, raison), `null` hors d'Auto. */
  adaptiveQuality(): AdaptiveQuality | null {
    return this.profile.guard === 'adaptive' ? this.adaptive : null;
  }

  /** Nouvelles options (choix du joueur): profil résolu, mesure remise à zéro. */
  set(options: GraphicsOptions): RenderProfile {
    this.options = options;
    this.profile = resolveProfile(options);
    this.restart();
    return this.profile;
  }

  sample(dtSeconds: number): GovernorChange | null {
    const adaptive = this.adaptive;
    if (adaptive === null) return null;
    const change = adaptive.sample(dtSeconds);
    if (change === null) return null;
    if (this.profile.guard === 'adaptive') return { kind: 'adaptive', change };
    // Filet: seul le repli compte (un seul palier, la mesure va droit au repli).
    return change.kind === 'light' ? this.lower() : null;
  }

  /** Repli imposé (page de démonstration): comme une machine à la peine. */
  forceFallback(): GovernorChange | null {
    if (this.profile.guard === 'adaptive') {
      return this.adaptive === null
        ? null
        : { kind: 'adaptive', change: this.adaptive.forceFallback() };
    }
    return this.profile.guard === 'safety' ? this.lower() : null;
  }

  private lower(): GovernorChange | null {
    const lower = lowerOptions(this.options);
    if (lower === null) {
      this.adaptive = null;
      return null;
    }
    this.set(lower);
    return { kind: 'reduced', options: lower };
  }

  private restart(): void {
    switch (this.profile.guard) {
      case 'adaptive':
        this.adaptive = new AdaptiveQuality(this.settings, this.usefulSteps);
        return;
      case 'safety':
        // Un seul palier utile: la netteté choisie reste, seul le repli d'un cran est jugé.
        this.adaptive = new AdaptiveQuality(this.settings, () => 1);
        return;
      case 'none':
        this.adaptive = null;
        return;
    }
  }
}
