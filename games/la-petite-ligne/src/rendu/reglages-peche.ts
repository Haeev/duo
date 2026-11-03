/**
 * Réglages du rendu de la pêche de la 0.12 (conception `peche-0-12-conception.md`, sections 5.2,
 * 6.2, 7.2 et R4): nage des ombres selon la rareté, signes du coin qui frémit, éclats du guet,
 * poisson tenu à la prise. Les règles (combien d'ombres, où, quand) sont dans la simulation; ici,
 * seulement la façon de les montrer. Le tech-artist règle la lisibilité (couleurs, opacités).
 */
import type { FishRarity, ShadowSize } from './peche-vue';

/** Nage d'une rareté (5.2): pauses, déplacements, rayon autour du point de la simulation. */
export interface SwimStyle {
  /** Pause entre deux déplacements (s). */
  readonly pause: readonly [number, number];
  /** Longueur d'un déplacement (m) et vitesse (m/s). */
  readonly reach: readonly [number, number];
  readonly speed: number;
  /** Écart maximal au point de la simulation (m). */
  readonly radius: number;
  /** Rotation sur place pendant les pauses (rad/s, 0: aucune). */
  readonly turnInPlace: number;
  /** Probabilité de faire demi-tour au déplacement suivant (rares). */
  readonly uTurn: number;
  /** Ondulation de la queue (0 à 1). */
  readonly wiggle: number;
  /** Opacité de l'ombre, et sa respiration (s'enfonce et remonte: min, max, période en s). */
  readonly opacity: number;
  readonly breathe: readonly [number, number, number] | null;
}

export const FISHING_RENDER = {
  /** Longueur des ombres (m), conception 3.1. */
  sizes: { small: 0.3, medium: 0.5, large: 0.8, huge: 1.2 } satisfies Record<ShadowSize, number>,
  swim: {
    // Par à-coups: pause de 1 à 3 s, élan de 0,6 m.
    common: {
      pause: [1, 3],
      reach: [0.4, 0.6],
      speed: 1.6,
      radius: 0.7,
      turnInPlace: 0,
      uTurn: 0,
      wiggle: 0.6,
      opacity: 0.5,
      breathe: null,
    },
    // Glisse lente (0,3 m/s), pauses de 3 à 6 s, demi-tours.
    rare: {
      pause: [3, 6],
      reach: [0.5, 0.9],
      speed: 0.3,
      radius: 0.8,
      turnInPlace: 0,
      uTurn: 0.6,
      wiggle: 0.4,
      opacity: 0.55,
      breathe: null,
    },
    // Presque immobile près du fond, tourne lentement sur place, se déplace toutes les 8 à 12 s.
    epic: {
      pause: [8, 12],
      reach: [0.3, 0.5],
      speed: 0.25,
      radius: 0.5,
      turnInPlace: 0.18,
      uTurn: 0,
      wiggle: 0.25,
      opacity: 0.6,
      breathe: null,
    },
    // Très lente, longue, la queue ondule; s'enfonce et remonte (opacité de 40 % à 70 %).
    legendary: {
      pause: [2, 4],
      reach: [0.8, 1.4],
      speed: 0.15,
      radius: 1.0,
      turnInPlace: 0,
      uTurn: 0.2,
      wiggle: 1,
      opacity: 0.55,
      breathe: [0.4, 0.7, 9],
    },
    // Lente, avec une lueur; seul un guetteur la voit.
    mythic: {
      pause: [3, 5],
      reach: [0.6, 1.0],
      speed: 0.18,
      radius: 0.8,
      turnInPlace: 0,
      uTurn: 0.3,
      wiggle: 0.8,
      opacity: 0.5,
      breathe: null,
    },
  } satisfies Record<FishRarity, SwimStyle>,
  /** Approche du bouchon (m/s), attente dessous (oscillation en m), fuite (m/s, s). */
  approachSpeed: 0.4,
  underNibble: 0.03,
  fleeSpeed: 2,
  fleeSeconds: 1,
  /** Fondus d'apparition et de départ (s); au départ, l'ombre rétrécit un peu (glisse vers le fond). */
  fadeSeconds: 2,
  leaveShrink: 0.2,
  /** Lissage du cap (part par seconde) et vitesse en deçà de laquelle le cap ne suit plus le mouvement. */
  headingRate: 6,
  stillSpeed: 0.03,
  /** Couleur de l'ombre (linéaire): un vert-brun profond, posé sur l'eau. */
  shadowColor: '#0b1a17',
  /** Au-dessus de la surface, contre les vaguelettes du shader de l'eau (m). */
  surfaceLift: 0.02,
  /** Profondeur (m) sous laquelle l'ombre pâlit (le bord des berges; le gué, à 8 cm, reste lisible). */
  shallowFade: [0.02, 0.07],
  /** Nuit (21 h à 24 h): sillage, au repos et à pleine vitesse (part de `context.night`). */
  wakeStill: 0.35,
  wakeMoving: 1,
  /** Opacité du corps de l'ombre la nuit (l'eau sombre l'avale; le sillage la dessine). */
  nightBodyOpacity: 0.6,
  /** Pluie: flou (0 à 1) et opacité gardée. */
  rainBlur: 0.55,
  rainOpacity: 1,
  /** Guet (7.2): rayon des éclats autour du guetteur (m). */
  glintRadius: 8,
  glint: {
    rare: { every: [3, 5], color: '#e9f1f4', size: 0.09, seconds: 0.35, opacity: 0.85 },
    epic: {
      every: [2, 4],
      color: '#5fd6c0',
      altColor: '#6aa8f0',
      size: 0.11,
      seconds: 0.4,
      opacity: 0.9,
    },
  },
  /** Reflet bronze sur le dos d'un légendaire (lueur couchée, ajoutée à l'image). */
  bronze: { color: '#c98a3c', opacity: 0.55, pulse: 3.2 },
  /** Lueur d'un mythique: dorée (la Dorée) ou pâle (le Brochet de lune). */
  mythicGlow: {
    golden_trout: '#ffcf5a',
    moon_pike: '#d8e6ff',
    fallback: '#f4e3a8',
    opacity: 0.75,
    pulse: 2.4,
  },
  /** Signes du coin qui frémit (6.2): dessinés à moins de tant d'un joueur (m). */
  signsRadius: 20,
  rings: {
    hotEvery: [5, 9],
    elsewhereEvery: [20, 40],
    radius: 0.6,
    seconds: 1.5,
    opacity: 0.55,
    /** Un rond sur trois au coin du jour en amène un second, tout près (deux ou trois à la fois au plus). */
    pairChance: 0.35,
    color: '#dcefee',
  },
  bubbles: {
    every: [8, 15],
    zones: ['pontoon', 'sands', 'upstream', 'downstream'],
    count: [4, 6],
    spread: 0.2,
    size: [0.06, 0.1],
    seconds: 0.7,
    stagger: 0.9,
    opacity: 0.75,
    color: '#eef8f8',
  },
  birds: {
    every: [40, 80],
    /** Premier passage peu après l'arrivée au bord (on découvre le coin), puis au rythme `every`. */
    first: [3, 9],
    /** Heures de vol (minutes): pas d'oiseaux à la nuit tombée. */
    from: 6 * 60,
    to: 20.5 * 60,
    /** Agrandis comme le martin-pêcheur (x 1,4): à taille réelle, 7 pixels au zoom 1. */
    displayScale: 1.4,
    swallow: {
      count: 2,
      speed: 5,
      length: 16,
      seconds: 3.4,
      height: [0.25, 1.2],
      weave: 0.9,
      flapHz: 9,
      /** Gobe à la surface: un petit rond quand l'hirondelle touche presque l'eau. */
      dipBelow: 0.32,
    },
    wagtail: {
      stay: [6, 10],
      hopEvery: [0.6, 1.4],
      hop: 0.22,
      hopHeight: 0.06,
      tailBobHz: 3,
      flySpeed: 4,
      flySeconds: 1.2,
    },
  },
  /** Poisson tenu à la prise (R4): sortie de l'eau, montré en main, puis au sac ou rendu à l'eau. */
  catch: {
    liftSeconds: 0.55,
    liftArc: 0.35,
    showSeconds: 2,
    releaseSeconds: 0.7,
    /**
     * Substituts sans points de prise: la main serre derrière les pectorales, à 38 % de la
     * longueur depuis le museau (comme les modèles de l'artiste), la seconde main au pédoncule.
     */
    gripShare: 0.38,
    tailShare: 0.12,
  },
} as const;
