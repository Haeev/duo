/**
 * Ce que valent les niveaux des options graphiques (0.13) dans le rendu: texels des cartes d'ombre,
 * taille du tampon, part des particules. Réglable par le technical artist; les préréglages (quels
 * niveaux pour Haute, Moyenne, Basse) sont dans `etat/options-graphiques.ts`, la logique dans
 * `options-graphiques.ts`, l'application à chaud dans `moteur.ts`.
 */
import type { EffectsLevel, ResolutionLevel, ShadowLevel } from '../etat/options-graphiques';
import { AMBIANCE_SETTINGS } from './reglages-ambiance';
import { RENDER_SETTINGS } from './reglages';

export interface ResolutionProfile {
  /** Part de la résolution de l'écran (1: pleine résolution). */
  readonly scale: number;
  /** Budget de pixels physiques du tampon de rendu. */
  readonly maxPhysicalPixels: number;
  /** Plancher de netteté (pixels de rendu par point CSS, voir `RENDER_SETTINGS.renderer.minCrispRatio`). */
  readonly minCrispRatio: number;
}

export interface ShadowProfile {
  readonly enabled: boolean;
  /** Carte d'ombre hors de l'heure de l'énigme d'Émile, puis pendant (texels de côté). */
  readonly mapSize: number;
  readonly detailMapSize: number;
}

export const GRAPHICS_RENDER_SETTINGS = {
  shadows: {
    off: { enabled: false, mapSize: 1024, detailMapSize: 1024 },
    /** Ombres de la 0.12 (`AMBIANCE_SETTINGS.shadows`): 1024, 2048 de 16 h 30 à 18 h pour l'énigme. */
    soft: {
      enabled: true,
      mapSize: AMBIANCE_SETTINGS.shadows.mapSize,
      detailMapSize: AMBIANCE_SETTINGS.shadows.detailMapSize,
    },
    /** 2048 toute la journée: bords plus nets, quatre fois plus de texels à remplir (budget: 2048 au plus). */
    fine: { enabled: true, mapSize: 2048, detailMapSize: 2048 },
  } satisfies Record<ShadowLevel, ShadowProfile>,

  resolution: {
    /**
     * 80 % de l'écran, plancher abaissé d'autant: l'image s'adoucit (retour R07), c'est le prix de
     * la fluidité. Seul niveau qui descend sous le pixel de l'écran.
     */
    reduced: { scale: 0.8, maxPhysicalPixels: 1920 * 1080, minCrispRatio: 0.8 },
    /** Celle de la 0.12 (`RENDER_SETTINGS.renderer`). */
    standard: {
      scale: 1,
      maxPhysicalPixels: RENDER_SETTINGS.renderer.maxPhysicalPixels,
      minCrispRatio: RENDER_SETTINGS.renderer.minCrispRatio,
    },
    /** Écran Retina du Mac (1440x900 points à 2): jusqu'à 2560x1600 pixels au lieu de 1920x1080. */
    max: { scale: 1, maxPhysicalPixels: 2560 * 1600, minCrispRatio: 1.5 },
  } satisfies Record<ResolutionLevel, ResolutionProfile>,

  /** Part des particules gardée à chaque émission (la réserve reste allouée: bascule à chaud). */
  effects: { reduced: 0.4, full: 1 } satisfies Record<EffectsLevel, number>,
} as const;
