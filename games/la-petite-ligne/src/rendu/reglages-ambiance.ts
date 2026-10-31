/**
 * Réglages de la lumière et de l'ambiance (technical artist): courbe du jour,
 * météo, ombres, brume, eau, pluie, panache du train, nuages, brume du matin,
 * lueurs de nuit. Tout ce qui se règle à l'œil, sans toucher au code.
 *
 * Couleurs en sRGB (`#rrggbb`), converties en linéaire par Three.js. Angles en
 * degrés, durées en secondes, distances en mètres (une case = 1 m). Les
 * intensités de lumière sont celles de Three.js (tone mapping neutre).
 *
 * Consignes suivies: bible artistique de la démo (section 4) et énigme de la
 * cloche (`demo.md`, S4): entre 17 h et 17 h 30, par soleil, le soleil vient de
 * l'ouest et l'ombre de la cloche touche le banc posé 3,5 m à l'est.
 */

/**
 * Moment clé de la lumière. Entre deux moments, chaque valeur suit une courbe
 * continue et sans dépassement (interpolation monotone, `courbes.ts`).
 */
export interface LightKey {
  /** Minutes depuis minuit (0 à 1440, sans le 1440: la courbe boucle). */
  minutes: number;
  /** D'où vient la lumière: même convention que `facing` (0 est, 90 sud, 180 ouest). */
  azimuthDeg: number;
  /** Hauteur de la lumière au-dessus de l'horizon. */
  elevationDeg: number;
  sunColor: string;
  sunIntensity: number;
  /** Lumière hémisphérique: ciel (faces tournées vers le haut) et sol (vers le bas). */
  skyColor: string;
  groundColor: string;
  hemiIntensity: number;
  /** Brume au loin (haut de l'écran) et fond. */
  fogColor: string;
  /** Ciel reflété par l'eau et les flaques. */
  reflectionColor: string;
  /** Force des ombres (0 à 1): elles s'effacent à l'aube et au crépuscule, quand la lumière change de côté. */
  shadow: number;
  /** Lueur des fenêtres, lanternes et lampadaires (émission et flaques de lumière): 0 le jour, 1 la nuit. */
  glow: number;
  /** Brume au ras du sol (rosée du matin), de 0 à 1. */
  mist: number;
  /** Part des nuages de la météo qui passent (0: ciel dégagé, comme le soir de l'énigme). */
  clouds: number;
}

/** Ce que la météo change à la lumière et à l'ambiance. */
export interface WeatherLook {
  sunFactor: number;
  shadowFactor: number;
  hemiFactor: number;
  /** Teinte grise vers laquelle tirer le ciel, la brume et les reflets, et sa part (0 à 1). */
  tint: string;
  tintAmount: number;
  /** Part de désaturation des lumières (0 à 1). */
  desaturate: number;
  /** Assombrissement des lumières et de la brume (0 à 1). */
  darken: number;
  /** La brume commence plus près (facteur sur les distances de `fog`). */
  fogFactor: number;
  /** Ombres de nuages qui passent sur le sol (0 à 1). */
  cloudCover: number;
  /** Sol mouillé: plus sombre, plus brillant, flaques (0 à 1). */
  wet: number;
  /** Densité de la pluie (0 à 1). */
  rain: number;
  /** Brume au ras du sol ajoutée à celle de l'heure (0 à 1). */
  mist: number;
}

const NIGHT = {
  azimuthDeg: 115,
  elevationDeg: 52,
  sunColor: '#9fb4ff',
  sunIntensity: 0.62,
  skyColor: '#4d6294',
  groundColor: '#2c3447',
  hemiIntensity: 1.0,
  fogColor: '#1f2a47',
  reflectionColor: '#2c3d68',
  shadow: 0.55,
  glow: 1,
  mist: 0,
  clouds: 0.5,
} as const;

export const AMBIANCE_SETTINGS = {
  /**
   * La journée, de minuit à minuit. 6 h à 10 h: soleil à l'est, bas, doré
   * pâle; midi: au sud, haut, presque blanc; soir: à l'ouest, bas, doré;
   * nuit: lune froide et haute, fenêtres et lanternes allumées.
   */
  daylight: [
    { minutes: 0, ...NIGHT },
    { minutes: 270, ...NIGHT, mist: 0.25 },
    {
      minutes: 330,
      azimuthDeg: 40,
      elevationDeg: 20,
      sunColor: '#b9a6d6',
      sunIntensity: 0.3,
      skyColor: '#7f82ab',
      groundColor: '#40424f',
      hemiIntensity: 0.9,
      fogColor: '#8a86ad',
      reflectionColor: '#9a92bb',
      shadow: 0.1,
      glow: 0.75,
      mist: 0.75,
      clouds: 0.4,
    },
    {
      minutes: 375,
      azimuthDeg: -12,
      elevationDeg: 7,
      sunColor: '#ffb08a',
      sunIntensity: 1.35,
      skyColor: '#d7c3cf',
      groundColor: '#7c7262',
      hemiIntensity: 0.95,
      fogColor: '#efcab6',
      reflectionColor: '#f3cdb8',
      shadow: 0.55,
      glow: 0.2,
      mist: 1,
      clouds: 0.4,
    },
    {
      minutes: 420,
      azimuthDeg: 0,
      elevationDeg: 15,
      sunColor: '#ffd3a0',
      sunIntensity: 2.15,
      skyColor: '#cfe0ee',
      groundColor: '#9daa7a',
      hemiIntensity: 1.05,
      fogColor: '#e4e2da',
      reflectionColor: '#d8e6f0',
      shadow: 0.85,
      glow: 0,
      mist: 0.75,
      clouds: 0.8,
    },
    {
      minutes: 540,
      azimuthDeg: 25,
      elevationDeg: 30,
      sunColor: '#ffe2bb',
      sunIntensity: 2.5,
      skyColor: '#d3e3f0',
      groundColor: '#9fac7c',
      hemiIntensity: 1.1,
      fogColor: '#d6e5ee',
      reflectionColor: '#cfe2f0',
      shadow: 1,
      glow: 0,
      mist: 0.12,
      clouds: 1,
    },
    {
      minutes: 660,
      azimuthDeg: 62,
      elevationDeg: 52,
      sunColor: '#fff0d8',
      sunIntensity: 2.8,
      skyColor: '#d7e7f2',
      groundColor: '#a2b07e',
      hemiIntensity: 1.12,
      fogColor: '#cfe2ee',
      reflectionColor: '#c8e0f0',
      shadow: 1,
      glow: 0,
      mist: 0,
      clouds: 1,
    },
    {
      minutes: 780,
      azimuthDeg: 100,
      elevationDeg: 60,
      sunColor: '#fff4e0',
      sunIntensity: 2.9,
      skyColor: '#d9e8f2',
      groundColor: '#a2b07e',
      hemiIntensity: 1.15,
      fogColor: '#cde1ee',
      reflectionColor: '#c6dff0',
      shadow: 1,
      glow: 0,
      mist: 0,
      clouds: 1,
    },
    {
      minutes: 900,
      azimuthDeg: 150,
      elevationDeg: 47,
      sunColor: '#ffecca',
      sunIntensity: 2.75,
      skyColor: '#dce4ea',
      groundColor: '#9fab7c',
      hemiIntensity: 1.1,
      fogColor: '#d6dfe4',
      reflectionColor: '#cddce8',
      shadow: 1,
      glow: 0,
      mist: 0,
      clouds: 1,
    },
    // Énigme de la cloche: le soleil descend plus vite autour de 17 h, plein ouest, pour que
    // l'ombre de la cloche arrive sur le banc vers 17 h et le quitte vers 17 h 40.
    {
      minutes: 1005,
      azimuthDeg: 176,
      elevationDeg: 43,
      sunColor: '#ffd8a2',
      sunIntensity: 2.55,
      skyColor: '#e8dccb',
      groundColor: '#988e6c',
      hemiIntensity: 1.05,
      fogColor: '#e3d6c3',
      reflectionColor: '#e2d6c6',
      shadow: 1,
      glow: 0,
      mist: 0,
      clouds: 0,
    },
    {
      minutes: 1035,
      azimuthDeg: 180,
      elevationDeg: 30.5,
      sunColor: '#ffc98a',
      sunIntensity: 2.4,
      skyColor: '#f0d0ac',
      groundColor: '#928a6a',
      hemiIntensity: 1.0,
      fogColor: '#ecd0b0',
      reflectionColor: '#efcfac',
      shadow: 1,
      glow: 0,
      mist: 0,
      clouds: 0,
    },
    {
      minutes: 1065,
      azimuthDeg: 184,
      elevationDeg: 19,
      sunColor: '#ffb577',
      sunIntensity: 2.15,
      skyColor: '#f2c9a0',
      groundColor: '#8f8a6a',
      hemiIntensity: 0.95,
      fogColor: '#f1c49a',
      reflectionColor: '#f4c79c',
      shadow: 0.95,
      glow: 0,
      mist: 0,
      clouds: 0.3,
    },
    {
      minutes: 1140,
      azimuthDeg: 197,
      elevationDeg: 10,
      sunColor: '#ff9f62',
      sunIntensity: 1.75,
      skyColor: '#e9b292',
      groundColor: '#7e6f5e',
      hemiIntensity: 0.9,
      fogColor: '#eeac85',
      reflectionColor: '#f0b088',
      shadow: 0.8,
      glow: 0.3,
      mist: 0,
      clouds: 0.6,
    },
    {
      minutes: 1185,
      azimuthDeg: 203,
      elevationDeg: 5,
      sunColor: '#f2826c',
      sunIntensity: 1.05,
      skyColor: '#a995b5',
      groundColor: '#5b5060',
      hemiIntensity: 0.92,
      fogColor: '#b48aa0',
      reflectionColor: '#c792a2',
      shadow: 0.35,
      glow: 0.55,
      mist: 0.1,
      clouds: 0.6,
    },
    {
      minutes: 1230,
      azimuthDeg: 160,
      elevationDeg: 28,
      sunColor: '#8f9fd8',
      sunIntensity: 0.4,
      skyColor: '#56689b',
      groundColor: '#32374a',
      hemiIntensity: 0.97,
      fogColor: '#3c4a74',
      reflectionColor: '#4c5d8f',
      shadow: 0.15,
      glow: 0.9,
      mist: 0.05,
      clouds: 0.5,
    },
    { minutes: 1275, ...NIGHT },
  ] satisfies LightKey[],

  weather: {
    sunny: {
      sunFactor: 1,
      shadowFactor: 1,
      hemiFactor: 1,
      tint: '#c8d0d8',
      tintAmount: 0,
      desaturate: 0,
      darken: 0,
      fogFactor: 1,
      cloudCover: 0.32,
      wet: 0,
      rain: 0,
      mist: 0,
    },
    cloudy: {
      sunFactor: 0.55,
      shadowFactor: 0.5,
      hemiFactor: 1.12,
      tint: '#c8d0d8',
      tintAmount: 0.25,
      desaturate: 0.25,
      darken: 0.05,
      fogFactor: 0.85,
      cloudCover: 0.7,
      wet: 0,
      rain: 0,
      mist: 0.15,
    },
    rain: {
      // Bible: soleil voilé à 0,4, ciel gris doux #B9C4CC, sol arrosé partout.
      sunFactor: 0.4,
      shadowFactor: 0.22,
      hemiFactor: 1.04,
      tint: '#b9c4cc',
      tintAmount: 0.55,
      desaturate: 0.4,
      darken: 0.12,
      fogFactor: 0.6,
      cloudCover: 0,
      wet: 1,
      rain: 1,
      mist: 0.35,
    },
  } satisfies Record<'sunny' | 'cloudy' | 'rain', WeatherLook>,

  shadows: {
    /** Carte d'ombre (budget: 1024, 2048 au plus). */
    mapSize: 1024,
    /** Douceur du bord (en texels de la carte d'ombre). */
    radius: 2.5,
    /** Opacité de l'ombre à pleine force (le sol ne devient jamais noir). */
    intensity: 0.66,
    /** Biais de profondeur, et biais selon la normale en texels (suit le zoom): pas d'acné d'ombre. */
    bias: -0.0004,
    normalBiasTexels: 1.4,
    /**
     * Hauteur des objets qui reçoivent l'ombre près du bas de l'écran (m): la
     * zone couverte par l'ombre s'étend vers la caméra d'autant.
     */
    receiverHeight: 3,
    /** Marge autour de la zone vue (m), et pas d'arrondi de sa taille (pas de scintillement au fil des minutes). */
    margin: 1.5,
    extentStep: 1,
    /** Hauteur des plus hauts objets qui portent une ombre (m), et recul de la lumière. */
    casterHeight: 14,
    lightDistance: 60,
    /** Sans caméra fournie: rayon de vue majoré de cette marge (ancien calage en cercle). */
    fallbackMargin: 5,
    /** La lumière ne descend jamais sous cette hauteur (ombres trop longues, coupées au bord). */
    minElevationDeg: 5,
  },

  fog: {
    /**
     * Brume légère au haut de l'écran: elle commence et finit au-delà de la
     * distance de la caméra au point suivi (profondeur de vue).
     */
    nearBeyondCamera: 4,
    farBeyondCamera: 62,
    /** Brume du matin: elle se rapproche d'autant (part de la brume au ras du sol). */
    mistPull: 0.45,
  },
} as const;

export type AmbianceSettings = typeof AMBIANCE_SETTINGS;
