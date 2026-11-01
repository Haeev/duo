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
    duoDoneSeconds: number;
    /** Le bouchon touche l'eau après le lancer (son.md 4). */
    fishingSplashSeconds: number;
  };
  /** Une ligne de la commande se coche: tampon chez qui est près de la caisse (m). */
  stampNearCrateM: number;
  train: {
    /** Point de l'arrêt et décalage de la locomotive vers l'est (rendu: voitures dans l'axe X). */
    stopPoint: string;
    locomotiveOffsetM: number;
    /** Glissement d'entrée et de sortie (m), comme `RENDER_SETTINGS.train.slideDistance`. */
    slideDistanceM: number;
    /** Départ: -1 vers l'ouest (la carte: le train arrive et repart par la voie de l'ouest). */
    departureDirection: -1 | 1;
    /** Le train hors de la carte s'entend depuis son bord (x). */
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
    duoDoneSeconds: 0.35,
    fishingSplashSeconds: 0.55,
  },
  stampNearCrateM: 4,
  train: {
    stopPoint: 'train_stop',
    locomotiveOffsetM: 8.45,
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
    },
    followed: ['geese_flight'],
    hensOnly: ['hens_alarm'],
    departFloorDb: -24,
  },
};

/** Décibels vers gain linéaire. */
export function dbToGain(db: number): number {
  return Number.isFinite(db) ? Math.pow(10, db / 20) : 0;
}
