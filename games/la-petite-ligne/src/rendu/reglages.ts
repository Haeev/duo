/**
 * Réglages du rendu 3D: tout ce qui se règle à l'œil (caméra, terrain,
 * animations, effets, budgets). Aucune valeur de gameplay ici: elles restent
 * dans `donnees/reglages.json`. La lumière du jour, la météo, la brume et les
 * ombres sont dans `reglages-ambiance.ts` (technical artist).
 *
 * Couleurs en sRGB (`#rrggbb`), converties en linéaire par Three.js. Angles en
 * degrés, durées en secondes, distances en mètres (une case = 1 m).
 */

export const RENDER_SETTINGS = {
  renderer: {
    /** Rapport de pixels plafonné (Retina, mise à l'échelle de Windows). */
    maxPixelRatio: 2,
    /** Budget de la plateforme: 1920x1080 pixels physiques au plus sur le PC. */
    maxPhysicalPixels: 1920 * 1080,
    antialias: true as boolean,
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

  /** Lueur nocturne des fenêtres et des lampes (texture d'émission de la palette). */
  nightGlow: 1.3,

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
    /** Fondu entre la marche et l'attente: court, pour que les pieds ne glissent pas au départ et à l'arrêt. */
    walkFadeSeconds: 0.1,
    /** Fondu d'entrée et de sortie d'un geste d'outil joué une fois. */
    gestureFadeSeconds: 0.06,
    /**
     * Instant du contact dans chaque clip de geste (s, mesuré sur la main droite
     * de `personnages.glb`: au plus bas pour la houe, la récolte, le marteau;
     * la hache touche le tronc à mi-descente). Le clip démarre juste avant, pour
     * que le coup tombe avec le son et la terre, émis au pas de l'appui.
     */
    gestureImpact: { hoe: 0.53, chop: 0.62, harvest: 0.34, sow: 0.4, hammer: 0.27 } as Readonly<
      Record<string, number>
    >,
    /** Le contact tombe au plus ce délai après l'appui (s). */
    gestureImpactLead: 0.08,
    /**
     * Un geste beaucoup plus long que son clip (scie et cuisine à l'établi,
     * plusieurs secondes) se joue en boucle à son rythme plutôt qu'étiré.
     */
    gestureLoopAbove: 1.6,
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
  },

  train: {
    /** Distance parcourue pendant l'entrée et le départ (m). */
    slideDistance: 70,
    /**
     * Côté de la voie par où le train arrive et repart: -1 l'ouest (la carte:
     * « le train arrive et repart par là »), comme `departureDirection` du son
     * (`src/audio/reglages.ts`).
     */
    sideDirection: -1 as -1 | 1,
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
   * Logique dans `qualite.ts`.
   */
  dynamicResolution: {
    steps: [1, 0.9, 0.8, 0.75] as const,
    /**
     * Moyenne glissante des images au-delà de laquelle on descend d'un palier
     * (ms, environ 55 images par seconde), relevée sur un écran plus lent que
     * 60 Hz (voir `slowRatio`).
     */
    slowFrameMs: 18,
    /** Durée de lissage de la moyenne et attente entre deux paliers (s). */
    averageSeconds: 1.5,
    cooldownSeconds: 3,
    /** Premières secondes ignorées (compilation, chargement des textures). */
    warmupSeconds: 5,
    /**
     * Image ignorée au-delà de cette durée (ms): onglet caché, pause,
     * compilation d'un shader. En deçà elle compte, même très lente.
     */
    ignoreFrameMs: 250,
    /**
     * Période de l'écran: plancher des durées d'image, qui remonte lentement
     * (s pour suivre une hausse), bornée pour qu'un jeu à 30 images par
     * seconde ne passe jamais pour un écran à 30 Hz (ms).
     */
    refreshRiseSeconds: 30,
    minRefreshMs: 4,
    maxRefreshMs: 21,
    /**
     * Lent: moyenne au-delà de cette part de la période de l'écran (écrans à
     * 48 ou 50 Hz), et jamais sous `slowFrameMs`.
     */
    slowRatio: 1.08,
  },

  /**
   * Repli automatique vers le mode léger (risque 1 du gauntlet): quand le
   * dernier palier de la résolution dynamique ne suffit plus, à chaud, sans
   * recréer le contexte WebGL (ombres coupées, résolution du mode léger;
   * l'antialiasing, la végétation et les effets restent ceux du départ).
   * Un seul retour par séance: s'il faut se replier de nouveau, c'est définitif.
   */
  autoLight: {
    /** Au dernier palier, durée de lenteur continue avant le repli (s). */
    slowSeconds: 8,
    /**
     * Retour à la qualité normale (au dernier palier) si la moyenne reste
     * sous cette part de la période de l'écran pendant `returnSeconds`.
     * Plus petit que `slowRatio`: le seuil de retour reste sous celui du repli.
     */
    comfortRatio: 1.03,
    returnSeconds: 60,
    maxReturns: 1,
  },
} as const;

export type RenderSettings = typeof RENDER_SETTINGS;
