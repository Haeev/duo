/**
 * Réglages des gestes de récolte et du potager (cahier 4.5 et 4.7), réglables par le game
 * designer. Ce qui varie d'un contenu à l'autre vit dans les données (outils, cultures,
 * ressources); ici, les règles communes.
 */
import type { Weather } from './saison';

export interface HarvestTuning {
  /** Points de pousse d'un jour: sec, puis arrosé ou de pluie (« compte double »). */
  readonly growth: { readonly dry: number; readonly watered: number };
  /** Météos qui arrosent le potager. */
  readonly rainWeathers: readonly Weather[];
  /** Bêcher: points de travail d'une case (bêche de base à 3 par coup: 2 coups), geste salissant. */
  readonly till: {
    readonly work: number;
    readonly clip: string;
    readonly dirty: boolean;
    readonly effort: number;
  };
  readonly sow: { readonly clip: string; readonly seconds: number };
  readonly water: { readonly clip: string; readonly effort: number };
  readonly reap: { readonly clip: string; readonly seconds: number };
  /** Distance devant le personnage où l'on vise une case du potager (m). */
  readonly cellAhead: number;
  /** Rayon où tombent les fruits secoués autour de l'arbre (m). */
  readonly dropSpread: number;
  /** Portée de la forge pour une amélioration ou une réparation payée, au-delà de l'emprise (m). */
  readonly forgeReach: number;
}

export const HARVEST_TUNING: HarvestTuning = {
  growth: { dry: 1, watered: 2 },
  rainWeathers: ['rain'],
  till: { work: 6, clip: 'dig', dirty: true, effort: 0.2 },
  sow: { clip: 'sow', seconds: 0.6 },
  water: { clip: 'water', effort: 0 },
  reap: { clip: 'pick-low', seconds: 0.5 },
  cellAhead: 0.7,
  dropSpread: 0.9,
  forgeReach: 1.2,
};
