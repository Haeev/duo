/**
 * Petite faune d'ambiance hors des moments (demande du DA pour le pilier 2, tour 7): des mésanges
 * qui se posent sur les buissons et s'envolent à l'approche, des papillons dans le pré fleuri.
 * Côté rendu seulement (aucun état de simulation); positions tirées de la graine de la partie.
 */
import type { Weather } from '../etat/types';
import type { PaletteCell } from './palette';

/** Plage horaire en minutes depuis minuit (`world.clock.minutes`). */
export interface HourRange {
  from: number;
  to: number;
}

export interface AmbientBirdSettings {
  /** Bête de `faune.glb` (déjà livrée pour le moment des mésanges). */
  model: string;
  count: number;
  countLight: number;
  /** Modèles de la carte où elles se posent (sommet du feuillage). */
  perchModels: readonly string[];
  /** Le sommet d'un buisson est rond: les pattes s'enfoncent un peu dans les feuilles (m). */
  perchSink: number;
  /** Écart minimal entre deux buissons choisis (m), pour les répartir dans le bourg. */
  minSpacing: number;
  /** Pas de mésange d'ambiance près de ces points de la carte (le nichoir et ses mésanges du moment). */
  avoidPoints: readonly string[];
  avoidRadius: number;
  /** Refuge: un arbre (chêne ou sapin) à moins de tant du buisson; un buisson sans arbre proche n'est pas pris. */
  refugeMaxDistance: number;
  /** Où elles entrent dans le houppier: hauteur (m) et recul depuis le tronc vers le buisson (m). */
  refugeHeight: number;
  refugeInset: number;
  /** Un joueur à moins de tant (m) la fait partir; elle ne revient que si personne n'est à moins de `returnClear`. */
  flushRadius: number;
  returnClear: number;
  /** Temps caché dans l'arbre avant de revenir (s). */
  awaySeconds: readonly [number, number];
  /** Vol (m/s) et hauteur ajoutée au milieu de l'arc (m). */
  flySpeed: number;
  arcHeight: number;
  /** Entre deux gestes au perchoir: se tourner ou chanter (s); part des gestes qui sont un chant. */
  idleEverySeconds: readonly [number, number];
  singShare: number;
  hours: HourRange;
  weathers: readonly Weather[];
}

export interface ButterflySettings {
  /** Zones de la carte où ils volent (le pré de l'est, ses herbes hautes et ses fleurs). */
  zones: readonly string[];
  count: number;
  countLight: number;
  /** Envergure réelle (m) et agrandissement pour la lecture au zoom de jeu (la mésange est à x 1,5; à x 1,6, un papillon fait 4 pixels au zoom 1). */
  wingspan: number;
  displayScale: number;
  /** Piéride, citron, azuré, aurore. */
  colors: readonly PaletteCell[];
  /** Hauteur de vol (m) et rayon de promenade autour de leur fleur (m). */
  height: readonly [number, number];
  roam: number;
  speed: readonly [number, number];
  flapHz: readonly [number, number];
  /** Se posent sur une tête d'herbe ou une fleur après quelques bonds, un moment. */
  legsBeforeRest: readonly [number, number];
  restSeconds: readonly [number, number];
  restHeight: number;
  /** Leurs heures finies, posés, ils ferment les ailes et descendent de tant (m) dans l'herbe en tant de secondes. */
  hideSink: number;
  hideSeconds: number;
  hours: HourRange;
  weathers: readonly Weather[];
}

export interface AmbientFaunaSettings {
  birds: AmbientBirdSettings;
  butterflies: ButterflySettings;
}

const HOUR = 60;

export const AMBIENT_FAUNA: AmbientFaunaSettings = {
  birds: {
    model: 'blue_tit',
    count: 7,
    countLight: 4,
    perchModels: ['bush'],
    perchSink: 0.05,
    minSpacing: 4,
    avoidPoints: ['nest_box'],
    avoidRadius: 7,
    refugeMaxDistance: 10,
    refugeHeight: 3.3,
    refugeInset: 0.9,
    flushRadius: 2.6,
    returnClear: 5,
    awaySeconds: [10, 25],
    flySpeed: 4.5,
    arcHeight: 0.8,
    idleEverySeconds: [2, 5],
    singShare: 0.3,
    // Le jour seulement (elles dorment dans les haies), et à l'abri sous la pluie.
    hours: { from: 7 * HOUR, to: 20 * HOUR + 30 },
    weathers: ['sunny', 'cloudy'],
  },
  butterflies: {
    zones: ['meadow'],
    count: 10,
    countLight: 5,
    wingspan: 0.05,
    displayScale: 2.2,
    colors: ['flower_white', 'flower_yellow', 'flower_blue', 'fox_red'],
    height: [0.35, 1.1],
    roam: 2.5,
    speed: [0.5, 0.9],
    flapHz: [7, 10],
    legsBeforeRest: [2, 5],
    restSeconds: [2, 6],
    restHeight: 0.3,
    hideSink: 0.22,
    hideSeconds: 1.5,
    // Au soleil des heures chaudes seulement: ni nuit, ni pluie, ni ciel couvert.
    hours: { from: 9 * HOUR + 30, to: 18 * HOUR + 30 },
    weathers: ['sunny'],
  },
};
