/**
 * Réglages du rendu 3D: tout ce qui se règle à l'œil (caméra, lumière du jour,
 * ombres, animations, effets, budgets). Aucune valeur de gameplay ici: elles
 * restent dans `donnees/reglages.json`. Le technical artist affine la lumière
 * et les ombres dans ce fichier sans toucher au code.
 *
 * Couleurs en sRGB (`#rrggbb`), converties en linéaire par Three.js. Angles en
 * degrés, durées en secondes, distances en mètres (une case = 1 m).
 */

/** Moment clé de la lumière du jour, interpolé avec ses voisins. */
export interface DaylightKey {
  /** Minutes depuis minuit (0 à 1440). */
  minutes: number;
  /**
   * Direction d'où vient la lumière, dans le plan du sol: même convention que
   * `facing` (0 vers l'est, 90 vers le sud). Le soir, 180 (ouest): les ombres
   * partent vers l'est, ce que l'énigme de la cloche demande à 17 h 15.
   */
  azimuthDeg: number;
  /** Hauteur de la lumière au-dessus de l'horizon. */
  elevationDeg: number;
  sunColor: string;
  sunIntensity: number;
  skyColor: string;
  groundColor: string;
  hemiIntensity: number;
  /** Fond (au-delà de la carte) et brume. */
  background: string;
  /** 0 en plein jour, 1 en pleine nuit: fenêtres et lampes allumées. */
  night: number;
}

export interface WeatherLook {
  sunFactor: number;
  shadowFactor: number;
  hemiFactor: number;
  /** Part de désaturation vers le gris (0 à 1). */
  desaturate: number;
  /** Assombrissement du fond et des lumières (0 à 1). */
  darken: number;
}

export const RENDER_SETTINGS = {
  renderer: {
    /** Rapport de pixels plafonné (Retina, mise à l'échelle de Windows). */
    maxPixelRatio: 2,
    /** Budget de la plateforme: 1920x1080 pixels physiques au plus sur le PC. */
    maxPhysicalPixels: 1920 * 1080,
    antialias: true,
    /** Tone mapping neutre (Khronos PBR Neutral): garde les teintes de la palette. */
    toneMapping: 'neutral' as 'neutral' | 'agx' | 'aces',
    exposure: 1.0,
  },

  camera: {
    /** Largeurs de vue des trois zooms (cahier, section 4.15). */
    viewWidths: [16, 24, 36] as const,
    initialZoom: 1,
    /** Azimut de la première orientation (caméra au sud-est, regard vers le nord-ouest). */
    firstAzimuthDeg: 45,
    /** Isométrie vraie: arctan(1 / racine de 2). */
    elevationDeg: 35.264,
    distance: 80,
    near: 1,
    far: 220,
    rotateSeconds: 0.3,
    zoomSeconds: 0.2,
    /** Demi-vie du suivi du personnage: plus court, plus collé. */
    followHalfLife: 0.12,
    /** Anticipation dans le sens de la marche, à pleine vitesse. */
    lookAhead: 0.7,
    lookAheadHalfLife: 0.35,
    /** Vitesse de marche de référence pour l'anticipation (m/s). */
    lookAheadSpeed: 3.5,
    /** Marge laissée au bord de la carte quand on la longe. */
    edgeMargin: 2,
    /** Tremblement par trauma: amplitude en mètres et décroissance par seconde. */
    shakeAmplitude: 0.18,
    shakeDecay: 1.6,
    shakeFrequency: 23,
  },

  shadows: {
    mapSize: 1024,
    /** Douceur du bord (en texels de la carte d'ombre). */
    radius: 2.5,
    /** Opacité de l'ombre par beau temps (ombres légères). */
    intensity: 0.62,
    /** Biais de profondeur et biais selon la normale, contre l'acné d'ombre. */
    bias: -0.0004,
    /** Biais normal = taille d'un texel au sol x ce facteur (suit le zoom). */
    normalBiasTexels: 1.4,
    /** Marge autour de la vue couverte par l'ombre, et hauteur max des objets. */
    margin: 5,
    casterHeight: 14,
    lightDistance: 60,
  },

  /** Lumière du jour, du minuit au minuit suivant. */
  daylight: [
    {
      minutes: 0,
      azimuthDeg: 120,
      elevationDeg: 55,
      sunColor: '#a3b6e6',
      sunIntensity: 0.7,
      skyColor: '#43557e',
      groundColor: '#252a3a',
      hemiIntensity: 0.95,
      background: '#1c2645',
      night: 1,
    },
    {
      minutes: 300,
      azimuthDeg: 120,
      elevationDeg: 55,
      sunColor: '#a3b6e6',
      sunIntensity: 0.7,
      skyColor: '#43557e',
      groundColor: '#252a3a',
      hemiIntensity: 0.95,
      background: '#1c2645',
      night: 1,
    },
    {
      minutes: 345,
      azimuthDeg: 60,
      elevationDeg: 30,
      sunColor: '#c7a6c8',
      sunIntensity: 0.2,
      skyColor: '#6e6a8e',
      groundColor: '#3a3440',
      hemiIntensity: 0.7,
      background: '#6d6688',
      night: 0.8,
    },
    {
      minutes: 390,
      azimuthDeg: -10,
      elevationDeg: 8,
      sunColor: '#ffb48e',
      sunIntensity: 1.8,
      skyColor: '#d3bccb',
      groundColor: '#7a665a',
      hemiIntensity: 1.05,
      background: '#efc4ad',
      night: 0.15,
    },
    {
      minutes: 480,
      azimuthDeg: 15,
      elevationDeg: 26,
      sunColor: '#ffe3bb',
      sunIntensity: 2.6,
      skyColor: '#d3e3f0',
      groundColor: '#908163',
      hemiIntensity: 1.1,
      background: '#cfe3ef',
      night: 0,
    },
    {
      minutes: 750,
      azimuthDeg: 90,
      elevationDeg: 58,
      sunColor: '#fff7ea',
      sunIntensity: 2.9,
      skyColor: '#d6e7f4',
      groundColor: '#8f8667',
      hemiIntensity: 1.15,
      background: '#bfddf0',
      night: 0,
    },
    {
      minutes: 960,
      azimuthDeg: 160,
      elevationDeg: 44,
      sunColor: '#ffebcb',
      sunIntensity: 2.7,
      skyColor: '#d9e3ec',
      groundColor: '#8c7f60',
      hemiIntensity: 1.1,
      background: '#c9deec',
      night: 0,
    },
    {
      minutes: 1035,
      azimuthDeg: 180,
      elevationDeg: 35,
      sunColor: '#ffd39a',
      sunIntensity: 2.5,
      skyColor: '#e5d9cc',
      groundColor: '#85704f',
      hemiIntensity: 1.0,
      background: '#e6d3bc',
      night: 0,
    },
    {
      minutes: 1110,
      azimuthDeg: 195,
      elevationDeg: 16,
      sunColor: '#ffaa5e',
      sunIntensity: 1.9,
      skyColor: '#e8be9c',
      groundColor: '#765a44',
      hemiIntensity: 0.9,
      background: '#f1be92',
      night: 0.1,
    },
    {
      minutes: 1170,
      azimuthDeg: 205,
      elevationDeg: 6,
      sunColor: '#e88a6e',
      sunIntensity: 1.0,
      skyColor: '#9a8fb2',
      groundColor: '#5a4c52',
      hemiIntensity: 0.95,
      background: '#9a86a8',
      night: 0.55,
    },
    {
      minutes: 1230,
      azimuthDeg: 150,
      elevationDeg: 40,
      sunColor: '#97aadc',
      sunIntensity: 0.45,
      skyColor: '#4c5b86',
      groundColor: '#282c3c',
      hemiIntensity: 0.9,
      background: '#2b3556',
      night: 0.9,
    },
    {
      minutes: 1320,
      azimuthDeg: 120,
      elevationDeg: 55,
      sunColor: '#a3b6e6',
      sunIntensity: 0.7,
      skyColor: '#43557e',
      groundColor: '#252a3a',
      hemiIntensity: 0.95,
      background: '#1c2645',
      night: 1,
    },
    {
      minutes: 1440,
      azimuthDeg: 120,
      elevationDeg: 55,
      sunColor: '#a3b6e6',
      sunIntensity: 0.7,
      skyColor: '#43557e',
      groundColor: '#252a3a',
      hemiIntensity: 0.95,
      background: '#1c2645',
      night: 1,
    },
  ] satisfies DaylightKey[],

  weather: {
    sunny: { sunFactor: 1, shadowFactor: 1, hemiFactor: 1, desaturate: 0, darken: 0 },
    cloudy: {
      sunFactor: 0.5,
      shadowFactor: 0.45,
      hemiFactor: 1.15,
      desaturate: 0.35,
      darken: 0.08,
    },
    rain: { sunFactor: 0.28, shadowFactor: 0.25, hemiFactor: 1.05, desaturate: 0.55, darken: 0.22 },
  } satisfies Record<'sunny' | 'cloudy' | 'rain', WeatherLook>,

  fog: {
    /** Brume légère au loin (en haut de l'écran), au-delà de la distance de la caméra. */
    nearBeyondCamera: 18,
    farBeyondCamera: 75,
  },

  /** Lueur nocturne des fenêtres et des lampes (texture d'émission de la palette). */
  nightGlow: 1.6,

  terrain: {
    /** Hauteurs des sols (m). L'eau est en creux, le quai en relief. */
    heights: {
      grass: 0,
      path: 0,
      dirt: 0,
      gravel: 0.03,
      wood: 0.45,
      floor: 0.12,
      water: -0.42,
      rail: 0.06,
      stone: 0.04,
    },
    waterSurface: -0.16,
    /** Taille des taches d'herbe (bruit lisse), en mètres. */
    grassPatchScale: 5.5,
    /** Sol au-delà de la carte, pour ne jamais voir le vide. */
    outerSize: 400,
    outerDrop: 0.01,
    /** Subdivision des cases d'eau pour les vaguelettes. */
    waterSubdivisions: 2,
    waterOpacity: 0.82,
    waveAmplitude: 0.025,
    waveSpeed: 1.3,
    waveLength: 3.2,
    /** Taille des morceaux de décor fusionnés (découpage pour l'élimination hors champ). */
    chunkSize: 24,
    /** Bande de terrain prolongée au-delà de la carte (rivière, voie, forêt du pourtour). */
    extension: 26,
    /** Fond du gué (eau basse franchissable). */
    fordBed: -0.12,
    /** Touffes d'herbe et fleurs semées sur l'herbe (part des cases). */
    tuftDensity: 0.32,
    flowerDensity: 0.07,
    /** Arbres du pourtour: densité selon la distance au bord (cases). */
    outerTreeDensity: 0.22,
    outerTreeStart: 2,
    pebbleDensity: 0.12,
  },

  /**
   * Sols surélevés de la carte et leur hauteur (m), en attendant que
   * `GameMap.props` porte la hauteur de chaque type (demande dans ETAT.md).
   */
  floorProps: { platform: 0.4, pontoon: 0.5 } as Readonly<Record<string, number>>,

  characters: {
    crossFadeSeconds: 0.22,
    /** Vitesse à laquelle l'animation de marche joue à son rythme d'origine (m/s). */
    walkReferenceSpeed: 3.2,
    /** En dessous de cette vitesse, on attend au lieu de marcher. */
    walkThreshold: 0.15,
    turnHalfLife: 0.06,
    /** Au-delà, on ne lisse pas (retour de minuit, apparition). */
    teleportDistance: 3,
    blinkEverySeconds: 3.7,
    blinkSeconds: 0.12,
    /** Silhouette du joueur vue derrière un mur. */
    silhouetteOpacity: 0.38,
  },

  garden: {
    tilledHeight: 0.06,
    /** Pop d'un stade qui change (s) et dépassement de l'échelle. */
    growPopSeconds: 0.45,
    growPopOvershoot: 0.18,
  },

  effects: {
    /** Objet récolté qui saute au sac. */
    jumpSeconds: 0.55,
    jumpHeight: 1.3,
    /** Hauteur du sac sur le personnage. */
    bagHeight: 1.05,
    maxParticles: 320,
    gravity: 9.8,
    destinationSeconds: 1,
    highlightPulseHz: 1.6,
    /** Taille de l'objet d'inventaire affiché (m). */
    itemScale: 0.75,
    rainDrops: 700,
    rainAreaPadding: 6,
    rainHeight: 14,
    rainSpeed: 16,
    smokePuffsPerSecond: 6,
    smokeSeconds: 2.4,
  },

  train: {
    /** Distance parcourue pendant l'entrée et le départ (m). */
    slideDistance: 70,
    wheelRadius: 0.42,
    /** Voie: rangée de la carte et décalage des voitures depuis `train_stop`. */
    carSpacing: 0.25,
  },

  house: {
    /** Lumière chaude de la maisonnette le soir (lampe, réchaud): couleur, intensité à la nuit, portée. */
    lampColor: '#ffb563',
    lampIntensity: 9,
    lampDistance: 8,
    lampHeight: 1.9,
    /** La lampe ne s'allume qu'une fois la maison réparée (toit et porte). */
    lampNeedsRepair: true as boolean,
  },

  budgets: {
    drawCalls: 150,
    triangles: 250_000,
    programs: 12,
    /** Fréquence de rafraîchissement de l'indicateur de performances (s). */
    statsRefreshSeconds: 0.5,
  },

  /**
   * Mode léger (`quality: 'light'`, `?rendu=leger`): pour jouer des séquences
   * dans un Chromium en rendu logiciel (tests de qa-testeur). Résolution
   * interne basse, ni ombres ni antialiasing, effets et végétation réduits.
   */
  light: {
    pixelRatio: 0.5,
    maxPhysicalPixels: 640 * 360,
    /** Part gardée des touffes, fleurs, galets et arbres du pourtour. */
    vegetationShare: 0.25,
    /** Part gardée des particules et des gouttes de pluie. */
    effectsShare: 0.25,
  },

  /**
   * Résolution dynamique (budget de la plateforme: jusqu'à 0,75): si les
   * images durent trop longtemps en moyenne, la résolution de rendu baisse
   * par paliers, sans jamais remonter pendant la partie (pas de va-et-vient).
   */
  dynamicResolution: {
    steps: [1, 0.9, 0.8, 0.75] as const,
    /** Moyenne glissante des images au-delà de laquelle on descend d'un palier (ms). */
    slowFrameMs: 20,
    /** Durée de lissage de la moyenne et attente entre deux paliers (s). */
    averageSeconds: 1.5,
    cooldownSeconds: 3,
    /** Premières secondes ignorées (compilation, chargement des textures). */
    warmupSeconds: 5,
  },
} as const;

export type RenderSettings = typeof RENDER_SETTINGS;
