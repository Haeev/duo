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
  /**
   * Force des ombres (part de `shadows.intensity`; au-delà de 1, l'ombre est
   * plus dense, plafonnée à 1 en tout): elles s'effacent à l'aube et au
   * crépuscule, quand la lumière change de côté.
   */
  shadow: number;
  /** Douceur du bord des ombres (texels), si elle diffère de `shadows.radius`. */
  shadowRadius?: number;
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
  shadow: 0.47,
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
      shadow: 0.085,
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
      shadow: 0.47,
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
      shadow: 0.72,
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
      shadow: 0.85,
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
      shadow: 0.85,
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
      shadow: 0.85,
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
      shadow: 0.85,
      glow: 0,
      mist: 0,
      clouds: 1,
    },
    // Énigme de la cloche: le soleil descend plus vite autour de 17 h, plein ouest, pour que
    // l'ombre de la cloche arrive sur le banc vers 17 h et le quitte vers 17 h 40.
    // De 16 h 45 à 17 h 45: ombres pleines, bord net (le poteau est fin) et ciel moins fort,
    // pour que l'ombre se lise sur le sol et sur le banc.
    {
      minutes: 1005,
      azimuthDeg: 176,
      elevationDeg: 43,
      sunColor: '#ffd8a2',
      sunIntensity: 2.55,
      skyColor: '#e8dccb',
      groundColor: '#988e6c',
      hemiIntensity: 0.8,
      fogColor: '#e3d6c3',
      reflectionColor: '#e2d6c6',
      shadow: 1,
      glow: 0,
      mist: 0,
      clouds: 0,
      shadowRadius: 1.5,
    },
    {
      minutes: 1035,
      azimuthDeg: 180,
      elevationDeg: 30.5,
      sunColor: '#ffc98a',
      sunIntensity: 2.6,
      skyColor: '#f0d0ac',
      groundColor: '#928a6a',
      hemiIntensity: 0.8,
      fogColor: '#ecd0b0',
      reflectionColor: '#efcfac',
      shadow: 1,
      glow: 0,
      mist: 0,
      clouds: 0,
      shadowRadius: 1.5,
    },
    // Soirée (revues du directeur artistique): soleil chaud, ciel froid bleu-violet (ombres
    // froides, lumière chaude), plus fort et plus clair, pour une soirée dorée
    // et lisible (au moins 75 de gris moyen et 25 d'écart à 18 h et 19 h).
    {
      minutes: 1065,
      azimuthDeg: 184,
      elevationDeg: 19,
      sunColor: '#ffb577',
      sunIntensity: 3,
      skyColor: '#ddd2d6',
      groundColor: '#968f70',
      hemiIntensity: 1.4,
      fogColor: '#b8aa9c',
      reflectionColor: '#f4c79c',
      shadow: 1.15,
      glow: 0,
      mist: 0,
      clouds: 0.3,
      shadowRadius: 1.5,
    },
    {
      minutes: 1140,
      azimuthDeg: 197,
      elevationDeg: 10,
      sunColor: '#ffa468',
      sunIntensity: 2.5,
      skyColor: '#c4c6de',
      groundColor: '#5f5a54',
      hemiIntensity: 1.5,
      fogColor: '#9c918e',
      reflectionColor: '#f0b088',
      shadow: 1.15,
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
      skyColor: '#b3a6c4',
      groundColor: '#6f6878',
      hemiIntensity: 1.2,
      fogColor: '#a99aae',
      reflectionColor: '#c792a2',
      shadow: 0.3,
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
      shadow: 0.13,
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
      hemiFactor: 1.2,
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
    /**
     * Fin d'après-midi de l'énigme (minutes): carte de 2048, pour que l'ombre
     * fine du poteau et de la cloche se lise sur l'herbe et le banc. Le reste
     * du temps, 1024 (moins de remplissage pour l'UHD 620).
     */
    detailMapSize: 2048,
    detailFrom: 990,
    detailTo: 1080,
    /** Douceur du bord (en texels de la carte d'ombre). */
    radius: 2.5,
    /** Opacité de l'ombre à pleine force (le sol ne devient jamais noir). */
    intensity: 0.85,
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

  /** Surfaces du décor et des personnages (shader de la palette): nuages, sol mouillé, flaques de lumière. */
  surfaces: {
    /** Taille des nuages (m par motif du bruit), vent (m/s, x et z), et force de leur ombre (0 à 1). */
    cloudSize: 46,
    cloudWind: [1.1, 0.45] as const,
    cloudShadow: 0.45,
    /** Douceur du bord des ombres de nuages (part du bruit). */
    cloudSoftness: 0.14,
    /** Sol mouillé: couleur multipliée, rugosité multipliée (plus brillant). */
    wetDarken: 0.74,
    wetRoughness: 0.45,
    /** Les murs se mouillent un peu (part du mouillé des sols). */
    wetWalls: 0.35,
    /** Flaques: taille du motif (m), seuil du bruit (plus haut, moins de flaques), assombrissement, reflet du ciel. */
    puddleSize: 7,
    puddleThreshold: 0.63,
    puddleDarken: 0.6,
    puddleReflection: 0.1,
    /** Léger reflet du ciel sur tout ce qui est mouillé. */
    wetSheen: 0.015,
    /** Les flaques ne se forment que sous cette hauteur (m): sols, pas les toits. */
    puddleMaxHeight: 0.5,
    /**
     * Sol continu (gauntlet, tour 4): l'herbe mélange ses trois verts par un
     * bruit doux en coordonnées du monde (plus de carrés à bords francs), les
     * pavés et les chemins varient doucement autour de leur teinte claire au
     * lieu d'un tirage case par case. Taille des taches (m), part du bruit
     * fin, et ampleur de la variation des pavés et des chemins (0 à 1).
     */
    groundPatch: 9,
    groundDetail: 0.35,
    stoneVariation: 0.3,
    /** Seules les faces tournées vers le haut et plus basses que cela (m) sont du sol. */
    groundMaxHeight: 0.6,
  },

  /** Lueurs de nuit: halos autour des lanternes et des fenêtres, flaques de lumière chaude au sol. */
  glow: {
    /** Lumières de sol suivies à la fois (les plus proches de la vue). */
    slots: 12,
    slotsLight: 6,
    /** Une lumière de plus de cette distance au point suivi (m) au-delà du rayon de vue s'éteint en douceur. */
    fadeBeyondView: 4,
    /** Nouveau tri des lumières quand le point suivi a bougé de plus de cela (m). */
    resortDistance: 1,
    /** Regroupement des faces lumineuses d'un même objet (m): une fenêtre, une lanterne. */
    clusterRadius: 0.8,
    /** Regroupement des fenêtres d'une façade en une seule flaque de lumière (m). */
    facadeRadius: 3,
    kinds: {
      lantern: {
        color: '#ffc070',
        intensity: 2.6,
        radius: 6.5,
        halo: 1.1,
        haloOpacity: 0.55,
        push: 0,
      },
      window: {
        color: '#ffc874',
        intensity: 1.3,
        radius: 4,
        halo: 0.75,
        haloOpacity: 0.3,
        push: 0.7,
      },
      /** Foyer de la maisonnette réparée, le soir et la nuit (réchaud, lampe): éclaire la pièce. */
      hearth: {
        color: '#ffb35c',
        intensity: 3.2,
        radius: 5.5,
        halo: 0,
        haloOpacity: 0,
        push: 0,
      },
      flame: {
        color: '#ffb347',
        intensity: 1.1,
        radius: 2.5,
        halo: 0.45,
        haloOpacity: 0.45,
        push: 0.1,
      },
    },
    /** Hauteur de la lumière au-dessus du centre d'une fenêtre (la flaque s'étale devant la façade). */
    windowDrop: -0.6,
    /** Scintillement des flammes (Hz) et son ampleur (part de l'intensité). */
    flickerHz: 7,
    flicker: 0.12,
  },

  /** Rivière: couleurs, écume du bord, courant, reflets du ciel et étincelles du soleil. */
  water: {
    shallow: '#7fbcc0',
    deep: '#3f7f93',
    foam: '#e2f2ef',
    /** Profondeur (cases depuis la berge) où l'eau devient profonde. */
    depthCells: 3,
    /** Opacité près de la berge et au large. */
    opacityShallow: 0.55,
    opacityDeep: 0.9,
    /** Courant (m/s, vers l'est) et taille des rides (m par motif). */
    flow: [0.35, 0.04] as const,
    rippleSize: 3.2,
    /** Part du ciel reflété (fond, puis selon les rides). */
    reflection: 0.32,
    reflectionRipple: 0.25,
    /** Écume: largeur depuis la berge (part de `depthCells`), vitesse et nombre de vaguelettes. */
    foamWidth: 0.35,
    foamSpeed: 0.9,
    foamBands: 9,
    foamAmount: 0.75,
    /** Étincelles du soleil: finesse du motif (fois les rides), vitesse, seuil du bruit, force; et la part de la lune la nuit. */
    glintScale: 5,
    glintSpeed: 2.5,
    glintThreshold: 0.93,
    glintStrength: 2.4,
    moonGlint: 0.35,
    /** Vaguelettes de la surface (m) et leur vitesse. */
    waveAmplitude: 0.02,
    waveSpeed: 1.3,
    waveLength: 3.2,
    /** Lame d'eau sur les galets du gué: hauteur au-dessus du gravier et opacité. */
    fordLift: 0.05,
    fordOpacity: 0.3,
    fordFoam: 0.2,
    /** Rugosité de la surface (reflet du soleil). */
    roughness: 0.14,
  },

  /** Pluie (jour 4): gouttes en traits fins autour de la vue, éclaboussures au sol, ronds dans l'eau. */
  rain: {
    drops: 900,
    dropsLight: 420,
    splashes: 140,
    /** Colonne de pluie: marge autour de la vue (m), hauteur (m), vitesse de chute (m/s), vent (m/s, x et z). */
    padding: 4,
    height: 13,
    speed: 15,
    wind: [1.6, 0.8] as const,
    /** Trait d'une goutte (m) et son opacité. */
    streakLength: 0.55,
    streakWidth: 0.028,
    opacity: 0.42,
    color: '#d6e2ea',
    /** Éclaboussure: durée (s), rayon au sol et dans l'eau (m), opacité. */
    splashSeconds: 0.38,
    splashRadius: 0.16,
    rippleRadius: 0.42,
    splashOpacity: 0.5,
  },

  /** Panache de la locomotive et petites particules du potager (GPU, une seule passe). */
  puffs: {
    capacity: 192,
    steam: {
      /**
       * Train qui roule: panache qui s'étire derrière la cheminée. Taille au
       * départ et à la fin (m), montée (m/s), poussée vers le haut (m/s²), vent
       * (m/s²), écart (m/s), frein, part de la vitesse du train héritée.
       */
      moving: {
        rate: 6,
        seconds: 2.2,
        startSize: 0.3,
        endSize: 1.3,
        rise: 1.6,
        lift: 0.3,
        drift: [0.5, 0.15] as const,
        spread: 0.3,
        drag: 0.9,
        opacity: 0.6,
        trail: 0.85,
      },
      /** À l'arrêt (revue du directeur artistique): petites bouffées nettes et rares, qui montent droit et s'effacent en 1 à 1,5 m. */
      idle: {
        rate: 0.8,
        seconds: 1.1,
        startSize: 0.18,
        endSize: 0.5,
        rise: 1.1,
        lift: 0.4,
        drift: [0.08, 0.03] as const,
        spread: 0.05,
        drag: 0.9,
        opacity: 0.85,
        trail: 0,
      },
      /** Coup de sifflet: quelques bouffées de l'arrêt, qui montent plus vite. */
      whistleBurst: 5,
      whistleRise: 1.5,
      color: '#f4f2ee',
    },
    /** Arrosage: gouttes qui tombent du bec, éclaboussure sur la terre. */
    water: {
      count: 14,
      seconds: 0.6,
      size: 0.035,
      speed: 1.2,
      up: 1.4,
      color: '#bfe3f2',
      opacity: 0.9,
      /** Rond d'eau qui s'étale sur la terre (rayon final en m, durée en s). */
      ringRadius: 0.45,
      ringSeconds: 0.55,
      ringOpacity: 0.55,
    },
    /** Bêche: petit nuage de poussière de terre. */
    dust: {
      count: 6,
      seconds: 0.9,
      size: 0.25,
      endSize: 0.7,
      speed: 0.6,
      color: '#b89a74',
      opacity: 0.4,
    },
    /** Récolte « belle »: étoiles dorées qui montent et scintillent. */
    stars: {
      count: 9,
      seconds: 1.2,
      size: 0.18,
      speed: 0.55,
      up: 1.1,
      color: '#ffe08a',
      opacity: 1,
    },
    /** Hauteur où naissent les gouttes d'arrosage (bec de l'arrosoir) au-dessus de la case. */
    canHeight: 0.75,
    gravity: 9.8,
  },

  /** Nuages bas qui passent au loin et brume du matin au ras du sol (sprites doux). */
  sky: {
    clouds: 7,
    /** Bouffées par nuage, taille d'une bouffée (m), hauteur des nuages (m). */
    cloudPuffs: 6,
    cloudPuffSize: 4.2,
    cloudHeight: 15,
    /** Zone où les nuages tournent autour de la vue (demi-côté, m) et leur vitesse (m/s, x et z). */
    cloudArea: 46,
    cloudWind: [1.1, 0.45] as const,
    cloudOpacity: 0.55,
    cloudColor: '#ffffff',
    /** Les nuages s'effacent au centre de l'écran: rayon (coordonnées normalisées) où ils sont invisibles, puis pleins. */
    cloudClearCenter: 0.45,
    cloudFullEdge: 0.95,
    mist: 26,
    mistSize: 5.5,
    mistHeight: 0.5,
    mistOpacity: 0.2,
    mistColor: '#eef1f2',
    /** Bancs de brume posés sur l'eau et dans les prés, dans cette zone autour de la vue (demi-côté, m). */
    mistArea: 26,
    mistDrift: 0.25,
  },

  /**
   * Vent (gauntlet, tour 2): balancement du feuillage, des herbes et des
   * fleurs (première rangée de la palette et cases `flower_*`), proportionnel
   * à la hauteur au-dessus du pied, et frisson du store de l'épicerie. Rien
   * dans la carte d'ombre: les ombres restent immobiles.
   */
  wind: {
    /** Direction du vent au sol (x, z), celle des nuages. */
    direction: [1.1, 0.45] as const,
    /** Déplacement par mètre de hauteur (m), plafonné à `maxHeight`. */
    strength: 0.018,
    maxHeight: 6,
    /** Les plantes basses (moins de 1,6 m) plient jusqu'à autant de fois plus (herbes, fleurs). */
    smallPlants: 4,
    /** Balancement (rad/s), rafales lentes (rad/s) et taille des rafales (m par onde). */
    swaySpeed: 1.6,
    gustSpeed: 0.33,
    gustSize: 28,
    /** Déphasage d'un arbre à l'autre (par mètre). */
    phaseScale: 0.37,
    /** Frisson des tissus (m) et sa vitesse (rad/s). */
    cloth: 0.025,
    clothSpeed: 4.2,
    /** Force selon la météo. */
    weather: { sunny: 1, cloudy: 1.4, rain: 1.9 },
  },

  /**
   * Fumées de cheminée (gauntlet, tour 2): fines, rares, qui montent en
   * dérivant avec le vent et s'effacent. Les bouches de cheminée sont
   * trouvées dans les modèles (faces sombres tournées vers le haut, au sommet
   * du bâtiment).
   */
  chimneys: {
    /** Heures des foyers du bourg (minutes): petit-déjeuner, midi, soirée. */
    villageHours: [
      [390, 540],
      [690, 790],
      [1080, 1350],
    ] as const,
    /** Maisonnette réparée: le soir (veillée, réchaud) et au petit-déjeuner. */
    houseHours: [
      [360, 480],
      [1080, 1440],
    ] as const,
    /** Après un repas cuisiné à la maisonnette, elle fume encore ce temps (s, temps réel). */
    afterCookingSeconds: 90,
    rate: 1.4,
    seconds: 3.2,
    startSize: 0.18,
    endSize: 0.6,
    rise: 0.55,
    lift: 0.12,
    /** Le vent pousse la fumée (part de sa direction, m/s²). */
    drift: 0.22,
    spread: 0.06,
    drag: 0.6,
    opacity: 0.75,
    /** La bouffée naît un peu au-dessus de la bouche (m). */
    birthLift: 0.15,
    color: '#dcd8d1',
    /** Une bouche de cheminée: faces de cette case, tournées vers le haut, à moins de `topBand` m du sommet. */
    openingCell: 'shadow',
    /** Hauteur du foyer au-dessus du plancher de la pièce (m). */
    hearthHeight: 1.3,
    topBand: 1.2,
    clusterRadius: 0.8,
  },

  /**
   * Version légère des effets: le moteur la prend de lui-même si les images
   * restent trop longues (mêmes seuils que la résolution dynamique).
   */
  detail: {
    slowFrameMs: 20,
    averageSeconds: 1.5,
    slowSeconds: 4,
    warmupSeconds: 6,
  },
} as const;

export type AmbianceSettings = typeof AMBIANCE_SETTINGS;
