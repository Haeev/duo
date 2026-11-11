/**
 * Réglages du rendu (lot L4): tout ce qui se règle sans toucher au moteur. Caméra, occultation,
 * cible, lumière du jour et de la nuit, ombres, qualité, formes provisoires. Les valeurs de
 * gameplay restent dans `donnees/commun/reglages.json`; ici, seulement ce qui se voit.
 */

/** Une heure repère de la lumière: les valeurs sont interpolées d'un repère au suivant, en boucle. */
export interface LightKey {
  /** Minutes depuis minuit. */
  readonly minute: number;
  readonly sunColor: string;
  readonly sunIntensity: number;
  /** D'où vient la lumière: azimut depuis le nord, dans le sens horaire (90: de l'est), et hauteur. */
  readonly azimuthDeg: number;
  readonly elevationDeg: number;
  readonly skyColor: string;
  readonly groundColor: string;
  readonly hemiIntensity: number;
  /** Couleur de la table autour de la maquette, et du fond. */
  readonly tableColor: string;
  /** Force de l'ombre portée (0 à 1). */
  readonly shadowIntensity: number;
}

const NIGHT = {
  sunColor: '#9fb4ff',
  sunIntensity: 0.95,
  azimuthDeg: 115,
  elevationDeg: 52,
  skyColor: '#7088c8',
  groundColor: '#3d4a78',
  hemiIntensity: 2.1,
  tableColor: '#2a3048',
  shadowIntensity: 0.55,
} as const;

export const RENDER_SETTINGS = {
  renderer: {
    antialias: true as boolean,
    /** Reprise de l'ancien moteur (choix du tech-artist): neutre, exposition 1. */
    toneMapping: 'neutral' as 'neutral' | 'agx' | 'aces',
    exposure: 1.0,
    maxPixelRatio: 2,
    maxPhysicalPixels: 1920 * 1080,
    /** Plancher de netteté: jamais moins de `min(devicePixelRatio, minCrispRatio)` pixels par point. */
    minCrispRatio: 1.5,
  },

  /**
   * Fondu au noir quand les deux joueurs ont dormi (événement `day_started` avec `slept`): durée
   * totale (s), descente puis remontée de l'exposition, et part tenue au noir au milieu.
   */
  sleepFade: { seconds: 1.6, holdPart: 0.25 },

  /**
   * Passage d'une porte (et tout replacement d'un coup du joueur local): l'image s'éteint en
   * `outSeconds` sur la vue d'avant, la caméra est reposée au noir, puis l'image revient en
   * `inSeconds`. `jumpMeters`: déplacement entre deux images qui ne peut pas être une marche.
   */
  passage: { outSeconds: 0.18, inSeconds: 0.22, jumpMeters: 3 },

  /** Mode léger demandé (tests en rendu logiciel): basse résolution, sans ombres. */
  light: { pixelRatio: 0.5, maxPhysicalPixels: 640 * 360 },

  dynamicResolution: {
    steps: [1, 0.9, 0.8, 0.75] as const,
    /**
     * Plancher visé: 30 images par seconde (technique 3.10, réponse 73: la beauté d'abord).
     * La netteté ne baisse que sous 30 images par seconde en moyenne.
     */
    slowFrameMs: 33.4,
    averageSeconds: 1.5,
    cooldownSeconds: 3,
    warmupSeconds: 5,
    ignoreFrameMs: 250,
    refreshRiseSeconds: 30,
    minRefreshMs: 4,
    maxRefreshMs: 21,
    /** Part de la période de l'écran; avec `maxRefreshMs` à 21, c'est `slowFrameMs` qui décide. */
    slowRatio: 1.08,
  },

  autoLight: {
    /** Les ombres ne partent que sous 24 images par seconde tenues 5 s (technique 3.10). */
    cutFrameMs: 41.7,
    slowSeconds: 5,
    comfortRatio: 1.03,
    returnSeconds: 60,
    maxReturns: 1,
  },

  camera: {
    /** Largeur de vue au sol (m): proche du personnage (technique 3.5). */
    minWidth: 8,
    maxWidth: 28,
    defaultWidth: 14,
    /** Inclinaison au zoom le plus large, adoucie au plus proche (degrés au-dessus de l'horizon). */
    pitchFarDeg: 35,
    pitchNearDeg: 28,
    /** Lacet au départ (degrés): 0 regarde vers le nord, 45 vers le nord-est. */
    defaultYawDeg: 45,
    /** Rotation tenue aux touches (degrés par seconde) et temps de mise en vitesse et d'arrêt (s). */
    yawSpeedDeg: 110,
    yawEaseSeconds: 0.12,
    /** Glisser au bouton droit: degrés par point CSS. */
    dragDegPerPixel: 0.35,
    /** Un cran de molette multiplie la largeur par ce facteur; flèches tenues: facteur par seconde. */
    wheelFactor: 1.12,
    holdFactorPerSecond: 1.9,
    /** Temps de demi-rattrapage du zoom et du suivi (s): le « léger retard ». */
    zoomHalfLife: 0.09,
    followHalfLife: 0.14,
    /** Anticipation: la vue devance le personnage de sa vitesse fois ce temps (s), bornée (m). */
    lookAheadSeconds: 0.25,
    lookAheadMax: 1.2,
    /** Hauteur du point suivi (m): la poitrine, pas les pieds. */
    focusHeight: 1.0,
    /**
     * Limites douces: le point suivi ne s'approche pas du bord de la carte à moins de `edgeMargin`
     * (m), freiné sur `edgeSoftness` (m) au lieu de buter net. Le zoom peut dépasser ses bornes de
     * `zoomOvershoot` (part) puis revient.
     */
    edgeMargin: 2,
    edgeSoftness: 3,
    zoomOvershoot: 0.06,
    /** Recul de la caméra le long de l'axe de vue (m), plans de coupe. */
    distance: 120,
    near: 1,
    far: 400,
  },

  occlusion: {
    /** Opacité d'un volume effacé, et durées du fondu (s). */
    fadedOpacity: 0.16,
    fadeOutSeconds: 0.18,
    fadeInSeconds: 0.3,
    /** Hauteurs du personnage visées par les rayons (m): pieds, taille, tête. */
    probeHeights: [0.15, 0.9, 1.6] as const,
    /** Le volume s'efface dès que le rayon passe à moins de `margin` (m): le personnage entier reste lisible. */
    margin: 0.45,
    /** Marge de plus pour réapparaître: pas de clignotement quand on tourne lentement. */
    hysteresis: 0.35,
    /** Une forme en boule ne remplit pas sa boîte: part de la boîte qui compte pour l'occultation. */
    ballShare: 0.78,
    /**
     * Un volume dont le dessus est plus bas que ça au-dessus des pieds du personnage ne s'efface
     * jamais (m): un comptoir, une table, un muret laissent voir la tête et les épaules, ils ne
     * cachent rien d'utile, et effacés ils deviendraient des fantômes au milieu de la pièce.
     */
    minHeight: 1.35,
  },

  target: {
    /** Rebond à la visée: échelle maximale et durée (interface.md, bulle d'action). */
    bounceScale: 1.08,
    bounceSeconds: 0.2,
    /** Liseré clair: épaisseur (m) et couleur. */
    rimWidth: 0.045,
    rimColor: '#fff6dc',
    /** Brillance qui passe: période (s), durée (s), force ajoutée à l'émissif. */
    sheenPeriod: 2,
    sheenSeconds: 0.45,
    sheenStrength: 0.35,
    /** Émissif tenu tant que l'objet est visé. */
    glow: 0.1,
  },

  shadows: {
    radius: 2.5,
    bias: -0.0004,
    normalBiasTexels: 1.4,
    /** Marge autour du cercle vu (m), et hauteur des plus hauts volumes qui portent ombre (m). */
    margin: 1.5,
    casterHeight: 8,
    /** Recul de la lumière le long de sa direction (m). */
    distance: 80,
    /** Ombre de contact sous chaque personnage: rayon (m) et opacité. */
    contactRadius: 0.34,
    contactOpacity: 0.32,
  },

  /**
   * Cycle continu du jour et de la nuit. Teintes reprises de l'ancien jeu (elles plaisent, bible
   * 1.2), nuit bleue jouable. Les repères encadrent `clock.dayStart` et `clock.nightStart`.
   */
  lightKeys: [
    { minute: 0, ...NIGHT },
    { minute: 300, ...NIGHT },
    {
      minute: 390,
      sunColor: '#ffb08a',
      sunIntensity: 1.5,
      azimuthDeg: 80,
      elevationDeg: 14,
      skyColor: '#d7c3cf',
      groundColor: '#8a7f78',
      hemiIntensity: 0.95,
      tableColor: '#b99f8c',
      shadowIntensity: 0.6,
    },
    {
      minute: 540,
      sunColor: '#ffdcae',
      sunIntensity: 2.5,
      azimuthDeg: 115,
      elevationDeg: 36,
      skyColor: '#d3e3f0',
      groundColor: '#9c9482',
      hemiIntensity: 1.1,
      tableColor: '#c9b79c',
      shadowIntensity: 0.8,
    },
    {
      minute: 780,
      sunColor: '#fff4e0',
      sunIntensity: 2.9,
      azimuthDeg: 180,
      elevationDeg: 58,
      skyColor: '#d9e8f2',
      groundColor: '#a39a86',
      hemiIntensity: 1.15,
      tableColor: '#cfbfa5',
      shadowIntensity: 0.85,
    },
    {
      minute: 1020,
      sunColor: '#ffd8a2',
      sunIntensity: 2.55,
      azimuthDeg: 245,
      elevationDeg: 32,
      skyColor: '#e8dccb',
      groundColor: '#9c9482',
      hemiIntensity: 0.9,
      tableColor: '#c9b292',
      shadowIntensity: 0.8,
    },
    {
      minute: 1170,
      sunColor: '#ffb577',
      sunIntensity: 2.2,
      azimuthDeg: 280,
      elevationDeg: 12,
      skyColor: '#ddd2d6',
      groundColor: '#857a80',
      hemiIntensity: 1.0,
      tableColor: '#a88f86',
      shadowIntensity: 0.6,
    },
    { minute: 1260, ...NIGHT },
  ] satisfies readonly LightKey[],

  /** La maquette: une plaque posée sur une table (bible 1.1). Couleurs d'intention d'Aubrune. */
  ground: {
    color: '#93b45e',
    /** Une case sur deux un peu plus sombre: la grille de 1 m se lit sur le prototype. */
    checker: 0.94,
    /** Épaisseur de la plaque (m) et couleur de sa tranche. */
    thickness: 0.5,
    edgeColor: '#8a6a4a',
    /** Demi-côté de la table (m). */
    tableHalfSize: 300,
  },

  /**
   * Formes provisoires, quand le modèle manque. Elles sont faites pour se reconnaître comme
   * provisoires: un volume uni à la taille des données, un socle sombre, une bande claire sur
   * la façade (rotation 0: au sud) pour contrôler le sens de pose.
   */
  standIn: {
    /** Hauteur d'un meuble sans modèle (m): les données ne la donnent pas encore. */
    propHeight: 0.9,
    /** Retrait de la forme dans son emprise (m): deux meubles voisins ne se touchent pas. */
    inset: 0.06,
    /** Teinte tirée de l'identifiant du modèle: saturation et clarté fixes, mates. */
    saturation: 0.32,
    lightness: 0.62,
    plinthHeight: 0.08,
    plinthColor: '#5d5348',
    facadeColor: '#f4ead2',
    facadeHeight: 0.12,
    /** Zone bloquée de la carte (mur, eau ou voie: la carte ne le dit pas encore): dalle basse hachurée. */
    blockedHeight: 0.12,
    blockedColor: '#6f6a78',
    blockedStripe: '#58546180',
    /** Objet posé au sol: petit cube (m). */
    itemSize: 0.28,
    itemColor: '#e2b25a',
  },

  /** Bonhomme provisoire (en attendant le lot L6): 1,70 m, tête d'un cinquième (bible 1.2). */
  figure: {
    height: 1.7,
    bodyRadius: 0.2,
    headRadius: 0.17,
    villagerColor: '#e9e2d0',
    /** Repère du regard: un nez franc, pour lire l'orientation à tout angle. */
    noseColor: '#3a3340',
    noseSize: 0.07,
    /** Temps de demi-rattrapage de la position et du cap affichés (s). */
    smoothHalfLife: 0.05,
    turnHalfLife: 0.07,
  },
} as const;

export type RenderSettings = typeof RENDER_SETTINGS;

/** Ce que valent les niveaux des options graphiques: texels d'ombre, tampon, part des effets. */
export interface ResolutionProfile {
  readonly scale: number;
  readonly maxPhysicalPixels: number;
  readonly minCrispRatio: number;
}
export interface ShadowProfile {
  readonly enabled: boolean;
  /** Côté de la carte d'ombre (texels). */
  readonly mapSize: number;
}

export const GRAPHICS_RENDER_SETTINGS = {
  shadows: {
    off: { enabled: false, mapSize: 1024 },
    soft: { enabled: true, mapSize: 1024 },
    fine: { enabled: true, mapSize: 2048 },
  } satisfies Record<'off' | 'soft' | 'fine', ShadowProfile>,
  resolution: {
    reduced: { scale: 0.8, maxPhysicalPixels: 1920 * 1080, minCrispRatio: 0.8 },
    standard: {
      scale: 1,
      maxPhysicalPixels: RENDER_SETTINGS.renderer.maxPhysicalPixels,
      minCrispRatio: RENDER_SETTINGS.renderer.minCrispRatio,
    },
    max: { scale: 1, maxPhysicalPixels: 2560 * 1600, minCrispRatio: 1.5 },
  } satisfies Record<'reduced' | 'standard' | 'max', ResolutionProfile>,
  effects: { reduced: 0.4, full: 1 } satisfies Record<'reduced' | 'full', number>,
} as const;
