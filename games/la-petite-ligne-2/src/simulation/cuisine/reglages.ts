/**
 * Réglages de la cuisine (cahier 4.4 et 4.7, `docs/jeux/jeu-1/refonte/cuisine.md`), typés et
 * réunis pour le game designer. Les recettes elles-mêmes sont des données.
 */
import type { CookStepKind } from '../../donnees/schemas/recette';

export type Quality = 1 | 2 | 3;

export interface StepTuning {
  /** Secondes d'un geste à l'allure 1 (battement, alternance, montée du feu, aller de l'aiguille). */
  readonly beat: number;
  /** Fenêtre « parfait » et « bon »: en secondes (couper, remuer) ou en part de jauge (cuire, assaisonner). */
  readonly perfect: number;
  readonly good: number;
  /** Un geste qui n'arrive pas dans ce délai compte 1 (on ne bloque jamais). */
  readonly patience: number;
}

export interface CookingSettings {
  /** Préfixe de mémoire d'une recette connue: la valeur est la meilleure qualité obtenue (0: jamais cuisinée). */
  readonly memoryPrefix: string;
  /** Distance (m) entre le joueur et le poste pendant la cuisine; au-delà, la préparation s'arrête. */
  readonly reach: number;
  /** Les deux postes d'un repas à deux sont dans la même cuisine: à moins de cette distance (m). */
  readonly kitchenRadius: number;
  /** Part de la durée visée en dessous de laquelle l'hôte refuse une part finie (borne anti-triche). */
  readonly minFraction: number;
  /** Moyenne des notes à partir de laquelle le plat est bon, puis parfait. */
  readonly goodFrom: number;
  readonly perfectFrom: number;
  /** Plafond de l'élargissement des fenêtres (bonus, aide et cuisine tranquille réunis). */
  readonly maxWindowScale: number;
  /** Aide réglable (cahier 2.4): élargissement selon le cran. */
  readonly assist: readonly [number, number, number];
  /** Cuisine tranquille (interface.md 5.6): fenêtres doublées. */
  readonly calm: number;
  /** Attente avant le premier geste d'une étape (s): le temps de lire la frise. */
  readonly leadIn: number;
  readonly steps: Readonly<Record<CookStepKind, StepTuning>>;
  /** Scène du repas pris à deux (cahier 4.4: 15 s), temps forts pour le rendu et le son. */
  readonly mealScene: readonly { readonly at: number; readonly beat: MealBeat }[];
  readonly mealSceneSeconds: number;
}

export const MEAL_BEATS = ['sit', 'serve', 'toast', 'eat', 'laugh', 'sigh'] as const;
export type MealBeat = (typeof MEAL_BEATS)[number];

export const COOKING: CookingSettings = {
  memoryPrefix: 'cuisine.recette.',
  reach: 2.5,
  kitchenRadius: 6,
  minFraction: 0.4,
  goodFrom: 1.8,
  perfectFrom: 2.6,
  maxWindowScale: 2.5,
  assist: [1, 1.25, 1.5],
  calm: 2,
  leadIn: 1,
  steps: {
    // Couper: Espace sur le métronome; 0,6 s le coup, moins de 2 appuis par seconde.
    chop: { beat: 0.6, perfect: 0.08, good: 0.18, patience: 0 },
    // Remuer: Q puis D, une alternance toutes les 0,5 s environ.
    stir: { beat: 0.5, perfect: 0.12, good: 0.25, patience: 2.5 },
    // Cuire: le feu monte en 1,6 s; zone dorée large de 16 % de la jauge.
    heat: { beat: 1.6, perfect: 0.05, good: 0.1, patience: 4 },
    // Assaisonner: l'aiguille fait un aller en 1,2 s; pincée large de 14 %.
    season: { beat: 1.2, perfect: 0.045, good: 0.09, patience: 5 },
    // Dresser: une flèche à refaire, 1,2 s chacune au plus pour la note pleine.
    plate: { beat: 1.2, perfect: 0, good: 1, patience: 3 },
  },
  mealScene: [
    { at: 0, beat: 'sit' },
    { at: 1.5, beat: 'serve' },
    { at: 4, beat: 'toast' },
    { at: 6, beat: 'eat' },
    { at: 10, beat: 'laugh' },
    { at: 13, beat: 'sigh' },
  ],
  mealSceneSeconds: 15,
};
