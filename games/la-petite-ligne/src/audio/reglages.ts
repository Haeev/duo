/**
 * Réglages du son de La Petite Ligne, hors de `sons.json` (que le sound
 * designer génère et qu'on ne retouche pas à la main). Les niveaux, priorités,
 * variations, boucles et séquences viennent de `sons.json`; ici, ce qui relie
 * les sons au jeu: cadences, distances, délais, mémoire.
 */
import type { GroundKind } from '../etat/carte';

const MIB = 1024 * 1024;

export interface AudioSettings {
  memory: {
    /** Plafond de l'audio décodé pour ce jeu (décision du manager, son.md S1). */
    capBytes: number;
    /** Octets par échantillon décodé (float32). */
    bytesPerSample: number;
    /** Dossiers de `assets/son/` gardés décodés toute la partie (son.md 6). */
    residentFolders: readonly string[];
  };
  listener: {
    /** Oreille posée derrière le personnage, vers le bas de l'écran (m): panoramique plus doux. */
    backOffsetM: number;
    /** Orientation de la caméra quand le rendu ne la donne pas (`cameraYaw()` du rendu au départ). */
    defaultYaw: number;
  };
  /** Pause de la plateforme: musique atténuée, effets suspendus. */
  pause: {
    musicDb: number;
    rampSeconds: number;
    /** Sans événement de pause du SDK: le monde ne bouge plus depuis ce temps (s), hôte et invité. */
    stallSecondsHost: number;
    stallSecondsGuest: number;
  };
  steps: {
    /** Durée du cycle de marche à `referenceSpeed` (clip `walk` de `personnages.glb`, 2 pas). */
    walkCycleSeconds: number;
    /** Cycle du portage à deux (clip `carry_two`). */
    carryCycleSeconds: number;
    stepsPerCycle: number;
    /** Mêmes bornes que le rendu (`rendu/personnages.ts`), pour suivre l'animation. */
    referenceSpeed: number;
    scaleMin: number;
    scaleMax: number;
    /** Vitesse sous laquelle on ne marche pas (m/s), comme le rendu. */
    threshold: number;
    /** Phase de départ: le premier pas tombe peu après le départ. */
    firstStepPhase: number;
    /** Son de pas selon la nature du sol de la carte. */
    byGround: Readonly<Record<GroundKind, string>>;
    /** Sol de la pièce de la maisonnette. */
    indoor: string;
  };
  /** Coups de marteau tant que l'action dure (clip `hammer`: un coup par cycle). */
  hammer: { periodSeconds: number; firstHitSeconds: number };
  hens: {
    /** Écart entre deux gloussements d'une poule (s), tiré au hasard. */
    intervalSeconds: readonly [number, number];
    /** Juste après la mangeoire: plus souvent, pendant `fedForSeconds`. */
    fedIntervalSeconds: readonly [number, number];
    fedForSeconds: number;
    /** Les poules se taisent la nuit (minutes du jeu). */
    quietFromMinutes: number;
    quietUntilMinutes: number;
  };
  delays: {
    doorCloseSeconds: number;
    /** Deux passages de porte plus proches que cela: un seul grincement (les deux joueurs sortent ensemble). */
    doorRepeatSeconds: number;
    qualitySeconds: number;
    treeCrackSeconds: number;
    treeFallSeconds: number;
    digFoundSeconds: number;
    stampSeconds: number;
    /** Tour 9: la lisse se verrouille à la fin de l'armement (s). */
    gateLockSeconds: number;
    duoDoneSeconds: number;
    /** Le bouchon touche l'eau après le lancer (son.md 4). */
    fishingSplashSeconds: number;
    /** Décision à deux: `decision-agree` après le tampon (son.md). */
    decisionAgreeSeconds: number;
  };
  /** Une ligne de la commande se coche: tampon chez qui est près de la caisse (m). */
  stampNearCrateM: number;
  train: {
    /** Point de l'arrêt et décalage de la locomotive en x (en tête vers l'ouest: négatif, comme le rendu). */
    stopPoint: string;
    locomotiveOffsetM: number;
    /** Glissement d'entrée et de sortie (m), comme `RENDER_SETTINGS.train.slideDistance`. */
    slideDistanceM: number;
    /**
     * Sens de marche: -1 vers l'ouest. Le train arrive par l'est et repart vers l'ouest sans faire
     * demi-tour (retour R06), comme `RENDER_SETTINGS.train.travel`.
     */
    departureDirection: -1 | 1;
    /** Le train hors de la carte s'entend depuis son bord ouest, plus cet écart (m). */
    offMapX: number;
    /** Sous ce rayon autour du quai, le sifflet est placé; au-delà, sa version lointaine. */
    nearQuayM: number;
    /** Son de la séquence d'arrivée qui tombe à l'arrêt du train. */
    arrivalStopSound: string;
    /** Son de la séquence de départ qui tombe quand le train se met en marche. */
    departureMoveSound: string;
    /** Avant la fanfare, la musique du moment s'efface (s). */
    bedFadeBeforeFanfareSeconds: number;
    /** Après le départ, silence avant le thème du jour (s, tiré). */
    afterDepartureRestSeconds: readonly [number, number];
  };
  music: {
    /** Musique du samedi près du quai et sur la place: zones de la carte. */
    saturdayZones: readonly string[];
    /** Hystérésis autour des zones (m): on entre à `enter`, on sort au-delà de `leave`. */
    enterMarginM: number;
    leaveMarginM: number;
    /** Après la nuit: la musique de nuit s'efface (s). */
    nightFadeOutSeconds: number;
  };
  ambience: {
    /** Rampe d'une ambiance qui change de niveau (s). */
    rampSeconds: number;
    /** Ambiance du bourg plus présente sur la place. */
    village: { zone: string; farM: number; farDb: number };
    /** Vent plus fort près de la lisière. */
    wind: { zone: string; farM: number; farDb: number };
    /** Sources de la rivière: tous les `spacingM` le long du bord sud, à partir du gué. */
    river: { zone: string; fordPoint: string; spacingM: number; fordBoostDb: number; offsetY: number };
    /** Avance (minutes du jeu) pour décoder une ambiance avant son heure. */
    prefetchMinutes: number;
  };
  sequences: {
    /** Un pas de séquence en retard de plus que cela n'est pas joué (sauf les longs sons recalés). */
    lateToleranceSeconds: number;
    /** Écart toléré entre la position d'un son recalé et l'horloge de la séquence (s). */
    resyncToleranceSeconds: number;
    resyncFadeSeconds: number;
    /** Longs sons recalés sur l'horloge de la simulation (approche, départ). */
    syncedSounds: readonly string[];
  };
  /** Boucles d'effets: fondu à l'arrêt (s). */
  loopFadeSeconds: number;
  /** Habitants dont le motif existe (`talk-<id>` dans `sons.json`). */
  villagerMotifPrefix: string;
  /** Tour 8 (son.md 4.6): un son de cueillette par sorte, à la place de `pickup`. */
  pickSounds: Readonly<Record<string, string>>;
  /** Tournant de saison: `season-turn-<saison>`, au petit-déjeuner, chez les deux. */
  seasonTurnPrefix: string;
  /** Sons demandés par l'interface (`GameAudio.ui`): au plus tant par image, le reste est perdu. */
  interface: { maxQueued: number };
  /** Moments rares (tour 6, `moments.json`): d'où part chaque son, ce qui suit une bête. */
  moments: {
    /**
     * Source d'un son de chorégraphie (nom de la fiche): un acteur du moment, ou `@point` de la
     * carte; sinon le premier acteur dessiné qui a des images clés (la bête du moment).
     */
    sources: Readonly<Record<string, string>>;
    /** Sons qui suivent leur source tout du long (la volée des oies), recalés sur la chorégraphie. */
    followed: readonly string[];
    /** Son joué seulement si les poules sont là. */
    hensOnly: readonly string[];
    /**
     * Niveau (dB) où descend, à la fin de l'apogée, une boucle d'attente dont le moment part tout
     * entier pendant l'apogée (la brume levée), avant de s'éteindre en fondu de boucle.
     */
    departFloorDb: number;
  };
  /** 0.13 (lot L4 bis): cloches, métiers, ambiances placées, forêt, passages à niveau (`village.ts`). */
  village: VillageSoundSettings;
}

/** Lieu: un point de la carte (`point`) ou une zone (`zone`), avec une portée (m). */
export interface VillagePlace {
  point?: string;
  zone?: string;
  reachM: number;
}

/** Boucle placée tant qu'un habitant fait cette activité à l'un de ces points (forge, meules, menuiserie). */
export interface VillageWorkLoop {
  key: string;
  sound: string;
  points: readonly string[];
  activities: readonly string[];
}

/** Coups joués à intervalle tiré tant qu'un habitant fait cette activité à l'un de ces points (lavoir). */
export interface VillageWorkBeats {
  key: string;
  sound: string;
  points: readonly string[];
  activities: readonly string[];
  intervalSeconds: readonly [number, number];
}

/** Ambiance placée (boucle du bus ambiance), à chaque point listé, sous condition. */
export interface VillagePlacedAmbience {
  key: string;
  sound: string;
  /** Points de la carte, ou rangée de sources le long d'une zone (`alongZone`, `count` sources sur sa longueur). */
  points?: readonly string[];
  alongZone?: { zone: string; count: number };
  /** Heures [début, fin[ (au-delà de 24: le lendemain matin), `null`: toujours. */
  hours: readonly [number, number] | null;
  /** Seulement si un habitant est à l'un de ces points (`null`: sans condition). */
  whenVillagerAt: readonly string[] | null;
  /** Écouté au-delà de cette distance: la boucle s'arrête (m). */
  reachM: number;
}

/** Ce que joue un événement du lot de la vie du village (son nom dans `WorldEvent.type`). */
export interface VillageEventSound {
  sound: string;
  /**
   * Où: `villager` (l'habitant de l'événement), `by` (le joueur), `at` (champ `at` de l'événement),
   * `point:<id>` (point de la carte), `ui` (non placé, chez `by`), `ui-both` (non placé, chez les deux).
   * Le premier qui existe dans la liste l'emporte.
   */
  where: readonly string[];
  /** Variante imposée (index du fichier). */
  variant?: number;
}

export interface VillageSoundSettings {
  bells: {
    /** Le clocher (x 87, y -12): toutes les cloches y sont placées. */
    at: { x: number; y: number };
    /** Angélus: heures de jeu, séquence de `plan.sequences`. */
    angelusHours: readonly number[];
    angelusSequence: string;
    /** Messe du dimanche: jour de la semaine (`weekdayOf`: 0 samedi, 1 dimanche), sonnerie et volée de sortie. */
    mass: { weekday: number; callMinutes: number; callSound: string; endMinutes: number; endSound: string };
    /** Décodées tant de minutes de jeu avant de sonner, libérées tant après. */
    decodeBeforeMinutes: number;
    decodeAfterMinutes: number;
  };
  workLoops: readonly VillageWorkLoop[];
  workBeats: readonly VillageWorkBeats[];
  placedAmbiences: readonly VillagePlacedAmbience[];
  /** Le moulin tourne: drapeau du monde (`world.flags`) ou état nommé (`worldStates`), puis ses heures. */
  millWheel: {
    sound: string;
    at: { x: number; y: number };
    flag: string;
    worldState: { key: string; value: string };
    hours: readonly [number, number];
    notWeekdays: readonly number[];
    reachM: number;
  };
  /** La forêt profonde (non placée): pleine à `fadeInM` dans les zones, baisse d'autres ambiances. */
  forest: {
    sound: string;
    zones: readonly string[];
    fadeInM: number;
    hours: readonly [number, number];
    lowerDb: Readonly<Record<string, number>>;
    /** Décodée à moins de tant de la lisière (m). */
    decodeMarginM: number;
  };
  /** Pas selon l'aspect de la case (`groundStyles` de la carte): sous-bois et sentiers de forêt. */
  stepsByStyle: Readonly<Record<string, string>>;
  /** Sons décodés quand l'écouteur approche du lieu (`decodeWhen` de `sons.json`). */
  places: readonly (VillagePlace & { sounds: readonly string[] })[];
  /** Événements du lot de la vie du village, par type (cas préparés avant leur arrivée dans `WorldEvent`). */
  events: Readonly<Record<string, VillageEventSound>>;
  /** Sifflet aux passages à niveau sans barrière, à l'arrivée du train. */
  crossings: {
    sound: string;
    zones: readonly string[];
    /** On siffle à tant de mètres avant le passage. */
    leadM: number;
    /** Pas avant tant de secondes après le début de l'arrivée (le sifflet d'annonce sonne alors). */
    notBeforeSeconds: number;
    /** Le train hors carte au début de l'arrivée: à tant du bord est (m), comme le rendu. */
    offMapClearanceM: number;
  };
  /** Cadeaux (lot H2): réaction après `gift-give`. */
  gifts: {
    delaySeconds: number;
    happy: string;
    polite: string;
    /** Variante de `happy`: il l'adore, il l'aime. */
    lovesVariant: number;
    likesVariant: number;
  };
  /** Anniversaire souhaité: entendu aussi par l'autre joueur à moins de tant (m). */
  birthdayNearM: number;
}

export const AUDIO_SETTINGS: AudioSettings = {
  memory: {
    capBytes: 128 * MIB,
    bytesPerSample: 4,
    residentFolders: ['effets/', 'interface/', 'habitants/'],
  },
  listener: {
    backOffsetM: 4,
    defaultYaw: (-3 * Math.PI) / 4,
  },
  pause: {
    musicDb: -12,
    rampSeconds: 0.25,
    stallSecondsHost: 0.3,
    stallSecondsGuest: 0.6,
  },
  steps: {
    walkCycleSeconds: 0.533,
    carryCycleSeconds: 0.8,
    stepsPerCycle: 2,
    referenceSpeed: 3.2,
    scaleMin: 0.55,
    scaleMax: 1.7,
    threshold: 0.15,
    firstStepPhase: 0.6,
    byGround: {
      grass: 'step-grass',
      path: 'step-path',
      dirt: 'step-path',
      gravel: 'step-stone',
      wood: 'step-wood',
      floor: 'step-wood',
      water: 'step-stone',
      rail: 'step-stone',
      stone: 'step-stone',
    },
    indoor: 'step-wood',
  },
  hammer: { periodSeconds: 0.667, firstHitSeconds: 0.25 },
  hens: {
    intervalSeconds: [4, 15],
    fedIntervalSeconds: [1.2, 3.5],
    fedForSeconds: 20,
    quietFromMinutes: 21 * 60,
    quietUntilMinutes: 6 * 60 + 30,
  },
  delays: {
    doorCloseSeconds: 0.75,
    doorRepeatSeconds: 1.2,
    qualitySeconds: 0.06,
    treeCrackSeconds: 0.15,
    treeFallSeconds: 1.3,
    digFoundSeconds: 0.25,
    stampSeconds: 0.25,
    gateLockSeconds: 2.5,
    duoDoneSeconds: 0.35,
    fishingSplashSeconds: 0.55,
    decisionAgreeSeconds: 0.2,
  },
  stampNearCrateM: 4,
  train: {
    stopPoint: 'train_stop',
    locomotiveOffsetM: -8.45,
    slideDistanceM: 70,
    departureDirection: -1,
    offMapX: 0,
    nearQuayM: 40,
    arrivalStopSound: 'train-steam',
    departureMoveSound: 'train-depart',
    bedFadeBeforeFanfareSeconds: 1.5,
    afterDepartureRestSeconds: [30, 50],
  },
  music: {
    saturdayZones: ['quay', 'square'],
    enterMarginM: 1,
    leaveMarginM: 5,
    nightFadeOutSeconds: 2.5,
  },
  ambience: {
    rampSeconds: 3,
    village: { zone: 'square', farM: 30, farDb: -8 },
    wind: { zone: 'forest_edge', farM: 30, farDb: -4 },
    river: { zone: 'river', fordPoint: 'river_ford', spacingM: 15, fordBoostDb: 3, offsetY: 2.5 },
    prefetchMinutes: 45,
  },
  sequences: {
    lateToleranceSeconds: 1.5,
    resyncToleranceSeconds: 0.35,
    resyncFadeSeconds: 0.25,
    syncedSounds: ['train-approach', 'train-depart'],
  },
  loopFadeSeconds: 0.2,
  villagerMotifPrefix: 'talk-',
  pickSounds: {
    dandelion: 'pick-herb',
    wild_garlic: 'pick-herb',
    chanterelle: 'pick-mushroom',
    blackberry: 'pick-berries',
    hazelnut: 'pick-nuts',
  },
  seasonTurnPrefix: 'season-turn-',
  interface: { maxQueued: 4 },
  moments: {
    sources: {
      ladder_step: 'basile',
      nest_box_turn: 'nest_box',
      hammer_tap: 'nest_box',
      tit_call: 'blue_tit',
      tit_song: 'tit_b',
      tit_wings: 'tit_a',
      hens_alarm: '@chicken_coop',
      crickets_night: '@meadow_glow',
      geese_rest: '@geese_rest',
      // Tour 7: le faon à son lit, la chevrette pour ses bonds et son effarouchement, la brume à son point.
      fawn_rustle: 'fawn',
      fawn_bleat: 'fawn',
      roe_call: 'roe_deer',
      deer_bounds: 'roe_deer',
      deer_stamp: 'roe_deer',
      roe_bark: 'roe_deer',
      kf_whistle: 'kingfisher',
      kf_dive: 'kingfisher',
      kf_beat: 'kingfisher',
      fish_jump: 'mist_fish',
      mist_ambience: '@mist_narrows',
      // Tour 9: l'eau du ponton, la locomotive (cabine du mécanicien), l'effraie, les lanternes et la cloche.
      night_water: '@stars_water',
      train_slow_roll: 'driver',
      train_whistle_salute: 'driver',
      cylinder_cocks: 'driver',
      owl_screech: 'barn_owl',
      grass_strike: 'barn_owl',
      lantern_light: '@lantern_square',
      quay_bell_once: '@quay_bell',
    },
    followed: ['geese_flight', 'train_slow_roll'],
    hensOnly: ['hens_alarm'],
    departFloorDb: -24,
  },
  village: {
    bells: {
      at: { x: 87, y: -12 },
      angelusHours: [7, 12, 19],
      angelusSequence: 'angelus',
      // Tous les foyers partent vers la nef à 10 h 15 (v0-13-habitants.md, section 7): la sonnerie les appelle.
      mass: { weekday: 1, callMinutes: 10 * 60 + 15, callSound: 'mass-peal', endMinutes: 11 * 60 + 30, endSound: 'bell-peal' },
      decodeBeforeMinutes: 10,
      decodeAfterMinutes: 5,
    },
    workLoops: [
      { key: 'forge', sound: 'forge-loop', points: ['forge_yard', 'forge_inside'], activities: ['work'] },
      { key: 'millstone', sound: 'millstone', points: ['mill_inside'], activities: ['work'] },
      { key: 'joinery', sound: 'joinery-loop', points: ['joinery_yard', 'joinery_inside'], activities: ['work'] },
    ],
    workBeats: [{ key: 'washhouse', sound: 'washboard-beat', points: ['washhouse'], activities: ['work'], intervalSeconds: [1.5, 3] }],
    placedAmbiences: [
      { key: 'mill-race', sound: 'mill-race', alongZone: { zone: 'mill_race', count: 3 }, hours: null, whenVillagerAt: null, reachM: 45 },
      { key: 'washhouse', sound: 'washhouse-water', points: ['washhouse'], hours: null, whenVillagerAt: null, reachM: 28 },
      {
        key: 'cafe',
        sound: 'cafe-terrace',
        points: ['cafe_terrace'],
        hours: [7, 23],
        whenVillagerAt: ['cafe_terrace', 'cafe_counter', 'skittles_alley'],
        reachM: 45,
      },
      { key: 'farm', sound: 'farm', points: ['farmyard'], hours: [6, 21], whenVillagerAt: null, reachM: 120 },
    ],
    millWheel: {
      sound: 'mill-wheel',
      at: { x: -14, y: 34.5 },
      flag: 'mill_running',
      worldState: { key: 'mill', value: 'running' },
      // Berthe lève la vanne à 6 h et la baisse à 17 h, sauf le dimanche (son habitude `sluice`).
      hours: [6, 17],
      notWeekdays: [1],
      reachM: 45,
    },
    forest: {
      sound: 'forest-deep',
      zones: ['forest_cote', 'forest_cure', 'forest_west'],
      fadeInM: 8,
      hours: [5, 21],
      lowerDb: { wind: -4, village: -6, 'birds-morning': -3 },
      decodeMarginM: 15,
    },
    stepsByStyle: { undergrowth: 'step-leaves', forestPath: 'step-leaves' },
    places: [
      { point: 'church_porch', reachM: 50, sounds: ['angelus-toll', 'bell-peal', 'harmonium-note', 'harmonium-chord'] },
      { point: 'forge_yard', reachM: 55, sounds: ['anvil-strike', 'forge-loop'] },
      { point: 'joinery_yard', reachM: 55, sounds: ['plane-stroke', 'handsaw-stroke', 'joinery-loop'] },
      { point: 'washhouse', reachM: 40, sounds: ['washboard-beat', 'washhouse-water'] },
      { zone: 'mill_race', reachM: 55, sounds: ['mill-wheel', 'millstone', 'sluice-open', 'mill-race'] },
      { point: 'cafe_terrace', reachM: 55, sounds: ['cafe-terrace'] },
      { point: 'farmyard', reachM: 130, sounds: ['farm'] },
      { point: 'well', reachM: 25, sounds: ['well-drop', 'well-echo'] },
      { point: 'lookout', reachM: 35, sounds: ['lookout-echo'] },
      { zone: 'river', reachM: 25, sounds: ['plic'] },
      { zone: 'forest_cote', reachM: 20, sounds: ['step-leaves'] },
      { zone: 'forest_cure', reachM: 20, sounds: ['step-leaves'] },
      { zone: 'forest_west', reachM: 20, sounds: ['step-leaves'] },
    ],
    // Noms d'événements attendus du lot de la vie du village (compte rendu du 2026-11-04).
    events: {
      forge_strike: { sound: 'anvil-strike', where: ['villager', 'by', 'point:forge_yard'] },
      joinery_plane: { sound: 'plane-stroke', where: ['villager', 'by', 'point:joinery_yard'] },
      joinery_saw: { sound: 'handsaw-stroke', where: ['villager', 'by', 'point:joinery_yard'] },
      bell_rope_pull: { sound: 'angelus-toll', where: ['point:church_bell_rope'] },
      bells_rung: { sound: 'bell-peal', where: ['point:church_bell_rope'] },
      harmonium_note: { sound: 'harmonium-note', where: ['point:church_harmonium', 'by'] },
      harmonium_chord: { sound: 'harmonium-chord', where: ['point:church_harmonium', 'by'] },
      washhouse_scrub: { sound: 'washboard-beat', where: ['point:washhouse', 'by'] },
      skim_stone: { sound: 'plic', where: ['at', 'by'] },
      well_peek: { sound: 'well-drop', where: ['point:well', 'by'] },
      well_shout: { sound: 'well-echo', where: ['point:well', 'by'] },
      lookout_shout: { sound: 'lookout-echo', where: ['point:lookout', 'by'] },
      sluice_opened: { sound: 'sluice-open', where: ['point:mill_sluice'] },
      cat_pet: { sound: 'cat-purr', where: ['at', 'by'] },
      cat_follow: { sound: 'cat-meow', where: ['at', 'by'], variant: 0 },
      cat_gift: { sound: 'cat-meow', where: ['at', 'point:house_door'], variant: 1 },
      decision_agreed: { sound: 'decision-agree', where: ['ui-both'] },
    },
    crossings: {
      sound: 'train-whistle-crossing',
      zones: ['church_level_crossing', 'farm_level_crossing'],
      leadM: 20,
      notBeforeSeconds: 3,
      offMapClearanceM: 19,
    },
    gifts: { delaySeconds: 0.35, happy: 'gift-happy', polite: 'gift-polite', lovesVariant: 0, likesVariant: 1 },
    birthdayNearM: 8,
  },
};

/** Décibels vers gain linéaire. */
export function dbToGain(db: number): number {
  return Number.isFinite(db) ? Math.pow(10, db / 20) : 0;
}
