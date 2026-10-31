/**
 * Réglages du rendu 3D: tout ce qui se règle à l'œil (caméra, terrain,
 * animations, effets, budgets). Aucune valeur de gameplay ici: elles restent
 * dans `donnees/reglages.json`. La lumière du jour, la météo, la brume et les
 * ombres sont dans `reglages-ambiance.ts` (technical artist).
 *
 * Couleurs en sRGB (`#rrggbb`), converties en linéaire par Three.js. Angles en
 * degrés, durées en secondes, distances en mètres (une case = 1 m).
 */

import type { IdlePose } from './attentes';

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
      // Dessus du platelage des traversées (passage à niveau, traversée de service): 1,5 cm sous le
      // champignon du rail (0,38 m: voie posée à 0,06 m, `rail_top` de 0,32 m). Les personnages y
      // marchent à cette hauteur; la rampe de terre (`crossing.rampLength`) rattrape la route.
      wood: 0.365,
      floor: 0.12,
      water: -0.42,
      rail: 0.06,
      stone: 0.04,
    },
    waterSurface: -0.16,
    /**
     * Platelage des traversées (revue du directeur artistique, tour 5): lames
     * dans le sens des rails, posées sur les traverses, sur toute la largeur de
     * la route; ornière sombre le long de la face intérieure de chaque rail;
     * rampe de terre de chaque côté où la route est plus basse. Distances en
     * mètres, en travers de la voie depuis son axe sauf mention contraire.
     */
    crossing: {
      /** Rails à cette distance de l'axe de la voie (voie métrique du modèle `rail_straight`). */
      railOffset: 0.5,
      /** Largeur du champignon du rail. */
      railHeadWidth: 0.06,
      /** Ornière: fente le long de la face intérieure du rail (passage du boudin des roues). */
      flangeway: 0.07,
      /** Jeu entre la face extérieure du rail et la première lame. */
      outerClearance: 0.01,
      /** Bande de planches à l'extérieur de chaque rail. */
      outerBand: 0.45,
      /** Largeur visée d'une lame (pas des lames, chanfreins compris): 20 à 25 cm. */
      plankWidth: 0.22,
      /** Épaisseur visible des lames au-dessus du fond de l'ornière (au-dessus des traverses, à 0,28 m). */
      plankThickness: 0.035,
      /** Chanfrein des arêtes du dessus des lames, bouts compris (un segment). */
      chamfer: 0.015,
      /** Rampe de terre de la route jusqu'au dessus des planches. */
      rampLength: 1.25,
      /**
       * Tons des lames, de l'une à la suivante (repris en boucle, décalé d'une
       * traversée à l'autre): `wood_old` est plus clair de 8 niveaux de gris
       * que `wood` (128,7 contre 136,7); une lame sur trois ou quatre.
       */
      plankTones: ['wood', 'wood', 'wood_old', 'wood', 'wood', 'wood', 'wood_old'] as const,
      /** Fond des ornières et des fentes autour du rail. */
      grooveTone: 'shadow' as const,
      /** Bouts du platelage côté voie (sous les lames, jusqu'au ballast). */
      endTone: 'wood_dark' as const,
      rampTone: 'path' as const,
      rampSideTone: 'bank' as const,
    },
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
    /**
     * Coins des chemins arrondis (bible, 8.7): rayon (m) et segments du quart
     * de cercle (un tous les 25 cm environ). Entre sols dont la hauteur diffère
     * d'au plus `cornerMaxStep` (m): le coin rogné prend la hauteur de la case,
     * la marche de quelques centimètres reste droite au bord.
     */
    cornerRadius: 0.5,
    cornerSegments: 3,
    cornerMaxStep: 0.05,
    /**
     * Semis au zoom large: à partir de cette largeur de vue (m; zooms de 16, 24
     * et 36 m), seule cette part des touffes, fleurs et galets est dessinée.
     */
    scatterFarViewWidth: 30,
    scatterFarShare: 0.5,
    /**
     * Morceaux de décor fusionnés (élimination hors champ, dans la vue et dans
     * la passe d'ombre): cases de `chunkSize` m. Une case de moins de
     * `chunkMergeBelow` triangles rejoint les autres petites cases de son bloc
     * de `chunkMergeBlock` x `chunkMergeBlock` cases: découpage fin autour des
     * bâtiments, peu d'appels de dessin pour les lampadaires et les clôtures.
     */
    chunkSize: 12,
    chunkMergeBlock: 2,
    chunkMergeBelow: 3000,
    /** Tronçons de la forêt du pourtour et des rails (m): éliminés hors du cadre. */
    stripSegment: 12,
    /** Bande de terrain prolongée au-delà de la carte (rivière, voie, forêt du pourtour). */
    extension: 26,
    /** Berges de la rivière: la pente descend sous l'eau sur cette largeur (m), dans la case d'eau. */
    bankSlope: 0.6,
    /** Fond du gué (eau basse franchissable). */
    fordBed: -0.12,
    /**
     * Pierres plates du gué: côtés (un modèle par nombre), épaisseur (posées sur
     * le fond, elles affleurent la lame d'eau), taille (m), places dans la case
     * (décalage depuis son coin) et désordre.
     */
    fordStones: {
      /** Fond du gué de gravier: une douzaine de centimètres sous la lame d'eau. */
      bed: -0.04,
      sides: [5, 6, 7],
      thickness: 0.13,
      minSize: 0.3,
      maxSize: 0.55,
      perCell: [
        [0.28, 0.3],
        [0.72, 0.7],
      ] as readonly (readonly [number, number])[],
      jitter: 0.12,
    },
    /** Touffes d'herbe et fleurs semées sur l'herbe (part des cases). */
    tuftDensity: 0.32,
    flowerDensity: 0.07,
    /** Arbres du pourtour: densité selon la distance au bord (cases). */
    outerTreeDensity: 0.22,
    outerTreeStart: 2,
    pebbleDensity: 0.12,
    /**
     * Décor de la carte hors de la passe d'ombre: objets de cette hauteur ou
     * moins (m). La passe d'ombre redessine chaque triangle qui la porte. À 1 m,
     * bancs, barrières, rochers et tonneaux perdaient une ombre bien visible de
     * près, et le quai son liseré: on s'en tient aux tout petits accessoires.
     */
    shadowlessBelow: 0.3,
  },

  /** Passe d'ombre (budget de triangles et d'appels du PC de référence). */
  shadowCasters: {
    /**
     * Tri fin (`ombre-tri.ts`): ce dont l'ombre ne peut tomber dans la vue sort
     * de la passe d'ombre. Hauteurs (m) de l'empreinte qui reçoit l'ombre: du
     * lit de la rivière au faîte des toits; marge (m) pour le flou du bord.
     */
    cull: true as boolean,
    receiverHeights: [-0.5, 2, 6] as readonly number[],
    margin: 0.5,
    /**
     * Pièces sans ombre visible, par nom de nœud: roues et bielles sous les
     * voitures (dans l'ombre de la caisse), cadre accroché au mur, plancher de
     * 15 cm de la maisonnette (sous ses murs). Les poules gardent la leur: à
     * midi, sans elle, elles flottent au-dessus de l'herbe.
     */
    shadowlessParts: [
      /_wheels(_\d+)?$/,
      /_rod_[lr]$/,
      /^picture_frame$/,
      /^gatekeeper_house_(ruin|repaired)_floor$/,
    ] as readonly RegExp[],
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
    /**
     * Attentes variées (rendu seul, `attentes.ts`): après une immobilité tirée
     * entre ces bornes (s), une attente de la liste du personnage, puis
     * l'attente ordinaire. Poses de `IDLE_POSES` ou clips de `personnages.glb`.
     */
    idleAfterSeconds: { min: 5, max: 8 },
    idleFadeSeconds: 0.3,
    idleVariants: {
      players: ['look_around', 'stretch', 'look_down'],
      firmin: ['watch', 'look_around'],
      odette: ['wipe', 'look_around'],
      jeanne: ['look_around', 'stretch'],
      basile: ['wipe_brow', 'look_around'],
    } as Readonly<Record<string, readonly string[]>>,
    /** Joueur arrêté près d'une poule (m, devant lui): il la caresse parfois (clip `pet`). */
    petRange: 1.3,
    /** Habitants: tête et buste tournés vers le joueur le plus proche à cette distance (m). */
    lookRange: 4,
    lookMaxDegrees: 70,
    lookHalfLife: 0.25,
    /** Répartition de la rotation du regard entre le buste, le cou et la tête. */
    lookShares: { chest: 0.2, neck: 0.3, head: 0.5 },
    /** Salut (clip `wave`) au premier croisement de la journée, à cette distance (m). */
    greetRange: 2.6,
    /**
     * Bancs de la carte (modèle `bench`, sans `seat_height` dans le GLB): hauteur
     * de l'assise (m). Places, avancée de l'assise et portée des habitants:
     * `reglages.benches` (partagés avec la simulation, qui réserve les places).
     * `glideSeconds`: le corps glisse de sa place debout à l'assise (et retour)
     * pendant le fondu, au lieu d'y sauter.
     */
    bench: { seatHeight: 0.45, glideSeconds: 0.22 },
    /** Hauteur d'assise de l'animation `sit` (m): le bassin y est posé quand la racine est au sol. */
    sitClipSeatHeight: 0.47,
    /** Tape dans la main (clip `high_five`) à une réussite à deux, si les joueurs sont à moins de (m). */
    highFiveRange: 1.8,
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

/**
 * Attentes procédurales (`attentes.ts`): rotations d'os ajoutées au clip
 * `idle`, en degrés autour des axes du personnage. `up` (vertical): positif
 * vers sa gauche. `side` (de sa droite à sa gauche): positif penche en avant,
 * négatif lève un bras devant soi. `forward` (devant lui): positif écarte et
 * lève le bras gauche, négatif le droit. `sweeps`: allers-retours sur la durée.
 */
export const IDLE_POSES: Readonly<Record<string, IdlePose>> = {
  /** Regarder autour de soi: à gauche, à droite, revenir. */
  look_around: {
    seconds: 3.4,
    terms: [
      { bone: 'head', axis: 'up', degrees: 38, sweeps: 1 },
      { bone: 'neck', axis: 'up', degrees: 18, sweeps: 1 },
      { bone: 'chest', axis: 'up', degrees: 8, sweeps: 1 },
    ],
  },
  /** S'étirer: bras levés sur les côtés, buste et tête en arrière. */
  stretch: {
    seconds: 2.8,
    raisesArms: true,
    terms: [
      { bone: 'upper_arm_l', axis: 'forward', degrees: 140 },
      { bone: 'upper_arm_r', axis: 'forward', degrees: -140 },
      { bone: 'forearm_l', axis: 'forward', degrees: 20 },
      { bone: 'forearm_r', axis: 'forward', degrees: -20 },
      { bone: 'chest', axis: 'side', degrees: -10 },
      { bone: 'head', axis: 'side', degrees: -18 },
    ],
  },
  /** Regarder ses pieds, en se balançant un peu. */
  look_down: {
    seconds: 2.6,
    terms: [
      { bone: 'head', axis: 'side', degrees: 28 },
      { bone: 'neck', axis: 'side', degrees: 10 },
      { bone: 'chest', axis: 'up', degrees: 8, sweeps: 1 },
    ],
  },
  /** Firmin consulte sa montre (poignet gauche). */
  watch: {
    seconds: 2.6,
    terms: [
      { bone: 'upper_arm_l', axis: 'side', degrees: -45 },
      { bone: 'upper_arm_l', axis: 'up', degrees: -25 },
      { bone: 'forearm_l', axis: 'side', degrees: -80 },
      { bone: 'head', axis: 'side', degrees: 26 },
      { bone: 'head', axis: 'up', degrees: 15 },
    ],
  },
  /** Odette essuie le comptoir, main droite en cercles. */
  wipe: {
    seconds: 3.2,
    terms: [
      { bone: 'upper_arm_r', axis: 'side', degrees: -40 },
      { bone: 'upper_arm_r', axis: 'up', degrees: 18, sweeps: 3 },
      { bone: 'forearm_r', axis: 'side', degrees: -25 },
      { bone: 'chest', axis: 'side', degrees: 10 },
      { bone: 'head', axis: 'side', degrees: 18 },
    ],
  },
  /** Basile s'essuie le front du revers de la main. */
  wipe_brow: {
    seconds: 2.2,
    raisesArms: true,
    terms: [
      { bone: 'upper_arm_r', axis: 'side', degrees: -75 },
      { bone: 'forearm_r', axis: 'side', degrees: -110 },
      { bone: 'upper_arm_r', axis: 'up', degrees: 12, sweeps: 1 },
      { bone: 'head', axis: 'side', degrees: -8 },
    ],
  },
};
