/**
 * Réglages des personnages assemblés (lot L6): tout ce qui se règle sans toucher à la logique.
 * Les pièces, les morphologies et les clips viennent du catalogue (lot L5), jamais d'ici.
 */
import { decorSeats } from '../lieu/decors-manifeste';
import { RENDER_SETTINGS } from '../reglages';

export const CHARACTER_SETTINGS = {
  /** Matériau unique de tous les personnages (couleurs de sommets, rendu « figurine »). */
  roughness: 0.85,

  /** Temps de demi-rattrapage de la position et du cap affichés (s): orientation lissée. */
  smoothHalfLife: 0.05,
  turnHalfLife: 0.08,

  /** Clips du catalogue joués pour chaque posture (noms de `morphologies.json`, `clips`). */
  clips: {
    idle: 'idle',
    walk: 'walk',
    run: 'run',
    sit: 'sit',
    carry: 'carry',
    /** Geste générique: joué pour un geste dont le clip n'est pas (encore) livré. */
    gesture: 'carry',
  },

  /**
   * Marche et course selon la vitesse au sol (m/s): repos sous `moving`, fondu de la marche à la
   * course entre `runFrom` et `runTo`. La cadence suit la vitesse réelle (pas de pieds qui
   * glissent), bornée par `minRate` et `maxRate` autour de la cadence du clip.
   */
  locomotion: {
    moving: 0.25,
    /**
     * Marche à 1,5 m/s (1,65 bien reposé), course à 3,2 m/s (2,56 affamé ou fatigué): le fondu
     * se fait entre les deux. Foulées mesurées des clips: marche 1,46 m par cycle de 1 s (cadence
     * 1,03 à 1,5 m/s), course 1,80 m par cycle de 0,625 s (1,11 à 3,2 m/s).
     */
    runFrom: 2.0,
    runTo: 2.5,
    /** Bornes de la cadence: la marche épuisée (0,75 m/s) tient dans `minRate` sans patiner. */
    minRate: 0.4,
    maxRate: 1.9,
    /** Fondu entre deux postures (s, demi-vie). */
    fadeHalfLife: 0.07,
  },

  /**
   * Le personnage se penche dans les virages (references-de-ressenti.md, « Déplacement »): angle
   * (rad) = vitesse au sol (m/s) x vitesse de virage affichée (rad/s) x `perTurn`, borné à `max`,
   * et lissé (`halfLife`, s). Une fraction de la vraie inclinaison (v.w/g): lisible, sans excès.
   */
  lean: { perTurn: 0.03, max: 0.14, halfLife: 0.1 },

  /**
   * Assise: hauteur du dessus de l'assise (m) par modèle de meuble; sans entrée, le dessus de la
   * forme provisoire (les modèles de meubles ne sont pas encore livrés). `clipSeat`: hauteur de
   * l'assise sous le bassin dans le clip `sit`, mesurée sur le corps (hanche à 0,608 m, moins
   * l'épaisseur des fesses).
   */
  seat: {
    /**
     * Par modèle: hauteur du dessus de l'assise (m) et distance du milieu du meuble à son bord
     * avant (m). Le bassin avance pour que les genoux arrivent au bord: les jambes pendent devant.
     */
    byModel: decorSeats() as Readonly<Record<string, { height: number; front: number }>>,
    standIn: {
      height: RENDER_SETTINGS.standIn.propHeight,
      front: 0.5 - RENDER_SETTINGS.standIn.inset,
    },
    clipSeat: 0.5,
    /**
     * Jambes posées par cinématique inverse (`assise.ts`): os de chaque jambe (squelette
     * `duo-24`), et marge gardée avant la jambe tendue (m).
     */
    legs: [
      ['LeftUpLeg', 'LeftLeg', 'LeftFoot'],
      ['RightUpLeg', 'RightLeg', 'RightFoot'],
    ] as const,
    legSlack: 0.012,
    /**
     * Par famille de meuble à accoudoirs: ce qu'il faut entre le milieu du corps et le bout du
     * meuble (accoudoir et demi-largeur du corps, coudes compris) pour ne rien traverser (m).
     */
    sideClear: { banc: 0.47 } as Readonly<Record<string, number>>,
    /** Avancée des genoux devant le bassin dans le clip `sit` (m, gabarit adulte), et marge au bord. */
    clipKnee: 0.35,
    kneeMargin: 0.05,
  },

  /**
   * Couché (brique `sleep`): le personnage debout basculé sur le dos. `back`: épaisseur du dos
   * sous l'axe des pieds (m), `headBelowTop`: du sommet du crâne au milieu de la tête (m), au
   * gabarit adulte. Mesures du couchage: fiche du meuble (`lie`), sinon le dessus de la forme
   * provisoire. Yeux fermés pendant le sommeil.
   */
  lie: {
    back: 0.12,
    headBelowTop: 0.12,
    expression: 'blink',
    fallback: { height: RENDER_SETTINGS.standIn.propHeight, pillowInset: 0.35 },
  },

  /** Clignement: intervalle tiré entre `minGap` et `maxGap` (s), durée d'un battement (s). */
  blink: { minGap: 2.4, maxGap: 5.5, seconds: 0.16 },
  /** Bouche du babil: durée d'une page (s) et fréquence d'ouverture (Hz). */
  talk: { seconds: 1.8, hertz: 6.5 },
  /** Fondu d'une expression (s, demi-vie) et durée par défaut d'une expression d'événement (s). */
  expressionHalfLife: 0.08,
  /**
   * Expressions déclenchées par un événement: qui la prend (le joueur de l'événement ou
   * l'habitant), laquelle, combien de temps (s).
   */
  eventExpressions: {
    talk_started: { who: 'villager', expression: 'joy', seconds: 1.6 },
    refused: { who: 'player', expression: 'embarrassed', seconds: 1.4 },
    gesture_done: { who: 'player', expression: 'joy', seconds: 0.9 },
  } as Readonly<
    Record<string, { who: 'player' | 'villager'; expression: string; seconds: number }>
  >,
  /** Expression tenue par l'état: palier d'un besoin. */
  needExpressions: { sleep: { low: 'sleepy', blocked: 'sleepy' } } as Readonly<
    Record<string, Readonly<Record<string, string>>>
  >,

  /**
   * Niveau de détail: sous cette hauteur à l'écran (pixels CSS), la tête rejoint le corps en un
   * seul maillage sans morphoses (un appel de dessin, ni visage ni clignement).
   */
  lod: { farPixels: 70, hysteresis: 8 },

  /** Ombre de contact: ellipse (m) et opacité au centre. */
  contact: { width: 0.8, depth: 0.62, opacity: 0.38, lift: 0.012 },

  /** Liseré d'un personnage visé: épaisseur (m) et couleur (celles des objets visés). */
  rim: { width: 0.022, color: RENDER_SETTINGS.target.rimColor },

  /**
   * Apparence par défaut, tant que l'éditeur n'existe pas: silhouette selon le genre (ou, sans
   * genre, celui-ci par joueur) et chances des pièces facultatives d'un habitant composé.
   */
  defaultGenders: ['f', 'm'] as const,
  composed: { dress: 0.3, hat: 0.2, accessory: 0.2 },

  /**
   * Silhouette d'un joueur dont l'apparence n'est pas encore révélée (avant la photo du prologue):
   * la même pour les deux, une tête nue et le volume d'une tenue (première pièce du catalogue de
   * chaque emplacement de `slots`), le tout d'une seule teinte sombre: ni traits, ni couleur de
   * tenue, ni coiffure. `gender`: la morphologie de départ prêtée aux deux.
   */
  silhouette: {
    gender: 'f',
    slots: ['head', 'top', 'bottom', 'shoes'],
    color: '#2b2a36',
  },
} as const;

export type CharacterSettings = typeof CHARACTER_SETTINGS;
