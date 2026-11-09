/**
 * Réglages du décor vivant (lumière du jour, passants de la place), typés et commentés: à régler par
 * le game designer et le tech-artist sans toucher à la logique (`lumiere.ts`, `passants.ts`).
 */

// -----------------------------------------------------------------------------------------------
// Lumière du jour

export interface DaylightKey {
  /** Minute de jeu (480: 8 h). */
  readonly minute: number;
  /** Soleil: couleur (sRGB), force relative à la lumière d'origine (1,2), azimut (0 nord, 90 est), hauteur. */
  readonly sun: string;
  readonly sunIntensity: number;
  readonly azimuthDeg: number;
  readonly elevationDeg: number;
  /** Ciel de la lumière hémisphérique (couleur sRGB) et forces relatives (hémisphère, ambiance). */
  readonly sky: string;
  readonly skyIntensity: number;
  readonly ambientIntensity: number;
  /** Place cuite (pierre, pavés, enduits) et dôme du ciel: multiplicateurs (1: la cuisson de 15 h). */
  readonly outdoor: readonly [number, number, number];
  readonly skyDome: readonly [number, number, number];
  /** Lumière cuite de la salle (1: la cuisson). */
  readonly interior: number;
  /** Lampes du café et réverbères: 0 éteints, 1 allumés. */
  readonly lamps: number;
}

export interface WeatherLight {
  /** Part du soleil qui passe, gris ajouté (0 à 1) et assombrissement de la place, lampes en plus le soir. */
  readonly sun: number;
  readonly grey: number;
  readonly dim: number;
  readonly lamps: number;
}

export interface DaylightSettings {
  readonly keys: readonly [DaylightKey, ...DaylightKey[]];
  readonly minElevationDeg: number;
  /** Par temps gris, les lampes s'allument en plus à partir de cette minute, sur une heure. */
  readonly greyLampsFromMinute: number;
  readonly clear: WeatherLight;
  readonly weather: Readonly<Record<string, WeatherLight>>;
  /** Couleurs des lampes du café éteintes et allumées (sRGB), force de l'allumée (au-delà de 1: éclat). */
  readonly lampOff: string;
  readonly lampOn: string;
  readonly lampOnBoost: number;
  /** Lanternes des réverbères et applique de la rue allumées (couleur sRGB, éclat). */
  readonly streetLampOn: string;
  readonly streetLampBoost: number;
}

/**
 * Le café regarde le sud: le soleil du matin vient de l'est (gauche vu de la salle) et rase la place,
 * celui de midi est haut au sud, celui de 16 h 30 descend au sud-ouest, doré; vers 18 h 30 la place
 * passe au bleu et les réverbères s'allument. Une journée de printemps stylisée (le service finit à
 * 18 h et la soirée du bilan dure jusqu'à 19 h 15 au plus, `eveningCapMinute`).
 */
export const DAYLIGHT: DaylightSettings = {
  keys: [
    {
      minute: 420,
      sun: '#ffc79a',
      sunIntensity: 0.55,
      azimuthDeg: 80,
      elevationDeg: 6,
      sky: '#c4cde0',
      skyIntensity: 0.8,
      ambientIntensity: 0.85,
      outdoor: [0.74, 0.77, 0.88],
      skyDome: [0.86, 0.87, 0.98],
      interior: 0.86,
      lamps: 0.7,
    },
    {
      minute: 480,
      sun: '#ffd9b0',
      sunIntensity: 0.85,
      azimuthDeg: 95,
      elevationDeg: 14,
      sky: '#e2e7f0',
      skyIntensity: 0.92,
      ambientIntensity: 0.95,
      outdoor: [0.8, 0.85, 0.98],
      skyDome: [0.88, 0.95, 1.1],
      interior: 0.9,
      lamps: 0.15,
    },
    {
      minute: 600,
      sun: '#fff0dc',
      sunIntensity: 1.08,
      azimuthDeg: 130,
      elevationDeg: 38,
      sky: '#f2f2f2',
      skyIntensity: 1,
      ambientIntensity: 1,
      outdoor: [1.0, 1.0, 1.03],
      skyDome: [1.0, 1.01, 1.05],
      interior: 1,
      lamps: 0,
    },
    {
      minute: 720,
      sun: '#fffbf4',
      sunIntensity: 1.25,
      azimuthDeg: 180,
      elevationDeg: 56,
      sky: '#f5f6f6',
      skyIntensity: 1.06,
      ambientIntensity: 1.05,
      outdoor: [1.12, 1.12, 1.12],
      skyDome: [1.05, 1.08, 1.14],
      interior: 1.06,
      lamps: 0,
    },
    {
      minute: 900,
      sun: '#fff1d6',
      sunIntensity: 1,
      azimuthDeg: 215,
      elevationDeg: 44,
      sky: '#fff6e8',
      skyIntensity: 1,
      ambientIntensity: 1,
      outdoor: [1, 1, 1],
      skyDome: [1, 1, 1],
      interior: 1,
      lamps: 0,
    },
    {
      minute: 990,
      sun: '#ffdca6',
      sunIntensity: 0.98,
      azimuthDeg: 240,
      elevationDeg: 30,
      sky: '#fff0dc',
      skyIntensity: 0.97,
      ambientIntensity: 0.97,
      outdoor: [1.12, 0.93, 0.72],
      skyDome: [1.12, 0.95, 0.8],
      interior: 0.98,
      lamps: 0,
    },
    {
      minute: 1080,
      sun: '#ffbe7a',
      sunIntensity: 0.78,
      azimuthDeg: 262,
      elevationDeg: 13,
      sky: '#f2d6c0',
      skyIntensity: 0.88,
      ambientIntensity: 0.9,
      outdoor: [1.0, 0.76, 0.55],
      skyDome: [1.06, 0.86, 0.74],
      interior: 0.93,
      lamps: 0.35,
    },
    {
      minute: 1110,
      sun: '#ff9a66',
      sunIntensity: 0.35,
      azimuthDeg: 272,
      elevationDeg: 4,
      sky: '#b4bedc',
      skyIntensity: 0.74,
      ambientIntensity: 0.8,
      outdoor: [0.5, 0.53, 0.74],
      skyDome: [0.6, 0.65, 0.92],
      interior: 0.85,
      lamps: 1,
    },
    {
      minute: 1155,
      sun: '#8a96c8',
      sunIntensity: 0.06,
      azimuthDeg: 285,
      elevationDeg: -4,
      sky: '#8692c0',
      skyIntensity: 0.58,
      ambientIntensity: 0.7,
      outdoor: [0.32, 0.36, 0.55],
      skyDome: [0.36, 0.42, 0.7],
      interior: 0.82,
      lamps: 1,
    },
  ],
  minElevationDeg: 3,
  greyLampsFromMinute: 960,
  clear: { sun: 1, grey: 0, dim: 1, lamps: 0 },
  weather: {
    soleil: { sun: 1, grey: 0, dim: 1, lamps: 0 },
    chaleur: { sun: 1.05, grey: 0, dim: 1.02, lamps: 0 },
    couvert: { sun: 0.35, grey: 0.45, dim: 0.9, lamps: 0.3 },
    froid: { sun: 0.6, grey: 0.25, dim: 0.95, lamps: 0.2 },
    pluie: { sun: 0.15, grey: 0.65, dim: 0.78, lamps: 0.6 },
    neige: { sun: 0.3, grey: 0.6, dim: 0.95, lamps: 0.4 },
  },
  lampOff: '#d9cdb8',
  lampOn: '#ffe6be',
  lampOnBoost: 1.15,
  streetLampOn: '#ffd79a',
  streetLampBoost: 1.3,
};

/** Le soir (bilan), l'heure du décor avance encore jusqu'à 19 h 15, puis s'arrête. */
export const EVENING_CAP_MINUTE = 1155;

// -----------------------------------------------------------------------------------------------
// Passants de la place

/** Motifs de sortie: chacun a un lieu réel (`decor/place.ts`). */
export type PurposeId = 'traverser' | 'boulangerie' | 'mairie' | 'eglise' | 'banc';

export interface PassersSettings {
  /**
   * Départs par heure de jeu (tous motifs hors école), par heure pleine (8: 8 h), interpolés: la
   * boulangerie du matin, le midi, la sortie d'école, des soirs rares.
   */
  readonly perHour: readonly (readonly [number, number])[];
  /** Poids des motifs selon l'heure (mêmes heures pleines, interpolés). */
  readonly purposes: readonly (readonly [number, Readonly<Record<PurposeId, number>>])[];
  /** École (minutes de jeu): dépose du matin, parents qui attendent 16 h 30, écoliers qui rentrent seuls. */
  readonly school: {
    readonly morning: readonly [number, number];
    readonly morningPerHour: number;
    readonly outMinute: number;
    readonly parentsFrom: number;
    readonly parentsPerHour: number;
    readonly pupilsUntil: number;
    readonly pupilsPerHour: number;
  };
  /** Par mauvais temps, moins de monde (multiplicateur des départs). */
  readonly weather: Readonly<Record<string, number>>;
  /** Vitesse de marche (m/s), plus lente avec un enfant; voie à droite du chemin (m). */
  readonly speed: readonly [number, number];
  readonly childSpeed: number;
  readonly lane: number;
  /** Temps passé dedans ou assis (secondes réelles), par motif. */
  readonly dwell: Readonly<
    Record<'boulangerie' | 'mairie' | 'eglise' | 'banc', readonly [number, number]>
  >;
  /**
   * Distance minimale entre deux passants (m), sous l'écart des deux voies (2 x `lane`): deux
   * passants qui se croisent chacun sur sa droite ne se gênent pas. Décalage d'un départ (s).
   */
  readonly spacing: number;
  readonly delayStep: number;
  readonly delayTries: number;
  /** On s'arrête devant quelqu'un à moins de `yieldDistance` m; patience envers un autre passant (s). */
  readonly yieldDistance: number;
  readonly yieldPatience: number;
  /** Passants dessinés au plus; personnages animés visibles au plus (C1, tous compris). */
  readonly maxPassers: number;
  readonly maxAnimated: number;
  /** Au-delà de cette distance de la caméra, l'animation n'avance qu'une image sur deux. */
  readonly farDistance: number;
  /** Secondes de frise simulées d'avance au premier affichage (la place n'est jamais vide d'un coup). */
  readonly prewarmSeconds: number;
  /** Client qui arrive: attente à la porte (s) que la simulation le fasse entrer, sinon il repart. */
  readonly arrivalWaitSeconds: number;
  /** Allures des adultes (modèles livrés) et des enfants (modèles réduits, échelle). */
  readonly adults: readonly string[];
  readonly children: readonly string[];
  readonly childScale: number;
  /** D'où l'on vient et où l'on rentre (lieux de `place.ts`), avec leur poids. */
  readonly homes: readonly (readonly [string, number])[];
}

export const PASSERS: PassersSettings = {
  perHour: [
    [7, 8],
    [8, 20],
    [9, 18],
    [10, 13],
    [11, 15],
    [12, 20],
    [13, 14],
    [14, 8],
    [15, 9],
    [16, 11],
    [17, 8],
    [18, 4.5],
    [19, 2],
  ],
  purposes: [
    [7, { traverser: 3, boulangerie: 6, mairie: 0, eglise: 0.5, banc: 0.5 }],
    [9, { traverser: 3, boulangerie: 4, mairie: 2, eglise: 1, banc: 1.5 }],
    [12, { traverser: 4, boulangerie: 3, mairie: 0.5, eglise: 0.3, banc: 1.5 }],
    [14, { traverser: 3, boulangerie: 1, mairie: 2, eglise: 1, banc: 2.5 }],
    [16, { traverser: 3, boulangerie: 3, mairie: 1, eglise: 0.5, banc: 2 }],
    [18, { traverser: 4, boulangerie: 0.5, mairie: 0, eglise: 1, banc: 0.5 }],
    [19, { traverser: 4, boulangerie: 0, mairie: 0, eglise: 0.3, banc: 0 }],
  ],
  school: {
    morning: [470, 510],
    morningPerHour: 14,
    outMinute: 990,
    parentsFrom: 925,
    parentsPerHour: 9,
    pupilsUntil: 1010,
    pupilsPerHour: 14,
  },
  weather: { pluie: 0.45, froid: 0.75, neige: 0.5, couvert: 0.9, soleil: 1, chaleur: 0.85 },
  speed: [1.05, 1.35],
  childSpeed: 0.95,
  lane: 0.35,
  dwell: {
    boulangerie: [25, 70],
    mairie: [60, 180],
    eglise: [90, 300],
    banc: [60, 200],
  },
  spacing: 0.6,
  delayStep: 2,
  delayTries: 14,
  yieldDistance: 0.8,
  yieldPatience: 4,
  maxPassers: 16,
  maxAnimated: 40,
  farDistance: 22,
  prewarmSeconds: 120,
  arrivalWaitSeconds: 2.5,
  adults: [
    'char_client_flaneur',
    'char_client_voisine',
    'char_client_gourmand',
    'char_client_brunch',
    'char_client_pressee',
    'char_client_connaisseur',
    'char_client_teletravail',
    'char_client_etudiante',
  ],
  children: ['char_client_etudiante', 'char_client_flaneur', 'char_client_brunch'],
  childScale: 0.7,
  homes: [
    ['ouest', 3],
    ['est', 3],
    ['ruelle', 2],
    ['maison_h1', 1],
    ['maison_h4', 1],
    ['maison_h5', 1],
    ['maison_h6', 1],
    ['maison_ne', 1],
    ['presbytere', 0.5],
  ],
};
