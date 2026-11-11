/**
 * Réglages de la musique jouée (cahier 4.5 et 4.7), typés et réunis pour le game designer. Les
 * airs, les instruments et les endroits où jouer sont des données; rien de ce fichier ne nomme
 * un air.
 *
 * Le cahier fixe: quatre touches (positions de Q, S, D, F), le duo, les airs par niveau
 * d'instrument (3, 6, tous) et l'aide par joueur (0, 25 et 50 %: `simulation/aide/`). Le reste (fenêtres, mots,
 * chapeau, amitié des auditeurs) est une proposition du studio, à valider par le game designer.
 */

/** Verdict d'une note: juste, un peu tôt, un peu tard, fausse (trop loin ou mauvaise touche), manquée. */
export const VERDICTS = ['just', 'early', 'late', 'false', 'missed'] as const;
export type Verdict = (typeof VERDICTS)[number];

/** Mot gentil de la fin, du plus timide au plus beau: jamais d'échec. */
export type Rating = 0 | 1 | 2 | 3;

export interface MusicSettings {
  /** Les quatre touches, par position (`KeyboardEvent.code`): Q, S, D, F d'un clavier AZERTY. */
  readonly keys: readonly [string, string, string, string];
  /**
   * Demi-fenêtres autour de l'instant écrit (ms): dans `just` la note est juste; dans `near` elle
   * sonne juste, un peu tôt ou un peu tard; dans `loose` elle sonne faux; au-delà elle est manquée.
   */
  readonly windows: { readonly just: number; readonly near: number; readonly loose: number };
  /** Plafond de l'élargissement (aide et bonus des besoins réunis). */
  readonly maxWindowScale: number;
  /** Décompte avant la première mesure: tant de temps de l'air, et au moins tant de ms. */
  readonly countIn: { readonly beats: number; readonly minMs: number };
  /** Silence gardé après la dernière note avant le mot de la fin (ms). */
  readonly tailMs: number;
  /** Distance (m) entre le joueur et l'endroit où il joue; au-delà, il s'arrête. */
  readonly reach: number;
  /**
   * Tolérance de l'hôte sur l'instant d'une note annoncée par une machine, autour de sa propre
   * horloge de l'air (ms): le réseau et le recalage des horloges y tiennent largement.
   */
  readonly hostSlack: { readonly early: number; readonly late: number };
  /** Poids d'une note dans la justesse d'un joueur (de 0 à 1). */
  readonly weights: Readonly<Record<'just' | 'near' | 'false' | 'missed', number>>;
  /** Justesse à partir de laquelle le mot monte d'un cran (1, 2, 3). */
  readonly ratings: readonly [number, number, number];
  /** Airs qu'un instrument sait jouer selon son niveau (4.5): les premiers rangs du cahier; `null`: tous. */
  readonly airsPerTier: readonly [number | null, number | null, number | null];
  readonly duo: {
    /** Un duo vaut plus que deux solos (R12): chapeau et amitié multipliés. */
    readonly bonus: number;
    /** Mot que chacun doit atteindre pour que le duo compte comme réussi ensemble. */
    readonly minRating: Rating;
    /** Écart (ms) sous lequel deux notes des deux voix comptent comme jouées ensemble. */
    readonly togetherMs: number;
  };
  readonly audience: {
    /** Les habitants à moins de cette distance (m) s'arrêtent et écoutent. */
    readonly radius: number;
    /** Écoute minimale (s) pour compter parmi les auditeurs à la fin. */
    readonly minSeconds: number;
    /** Relecture de l'auditoire (s). */
    readonly everySeconds: number;
    /** Onomatopée des auditeurs à la fin, selon le mot (`null`: rien). */
    readonly emotes: readonly [string | null, string | null, string | null, string | null];
  };
  /** Le chapeau: pièces par auditeur selon le mot (centimes), plafond, une fois par jour et par joueur. */
  readonly hat: {
    readonly centsPerListener: readonly [number, number, number, number];
    readonly maxCents: number;
  };
  /** Amitié de chaque auditeur selon le mot, une fois par jour, par joueur et par habitant. */
  readonly bond: { readonly points: readonly [number, number, number, number] };
  readonly memory: {
    /** `<bestPrefix><air>`: meilleur mot obtenu sur cet air (commun au duo). */
    readonly bestPrefix: string;
    /** Fait par joueur: dernier jour où le chapeau a tourné. */
    readonly hat: string;
    /** `habitants.<id>.<listened>.j<n>`: dernier jour où cet habitant a écouté ce joueur. */
    readonly listened: string;
  };
  /**
   * Celui qui ne joue pas entend l'autre jouer (accompagnement et voix) quand il est à portée:
   * plein volume jusqu'à `nearM`, puis de moins en moins, plus rien au-delà de `farM` (m). La
   * musique du lieu se tait quand le niveau dépasse `hushAbove` (de 0 à 1).
   */
  readonly listen: { readonly nearM: number; readonly farM: number; readonly hushAbove: number };
  /** Ce que la machine du joueur fait sonner (dB, cents, ms). */
  readonly sound: {
    /** Niveau de la tige `air` de l'enregistrement sous les joueurs: -60 la retire. */
    readonly guideDb: number;
    /** Une note fausse baisse de tant de cents, en glissant. */
    readonly falseCents: number;
    readonly falseGlideMs: number;
    /** La voix de l'autre joueur: un peu plus bas, un peu de côté. */
    readonly partnerDb: number;
    readonly partnerPan: number;
    /** Avance de programmation des notes de l'autre voix (ms). */
    readonly lookaheadMs: number;
    /** Une note juste de l'autre apprise en retard se joue encore si le retard tient sous ce délai (ms). */
    readonly lateEchoMs: number;
    /** Décalage de frappe du joueur (ms), si son clavier ou son écran retardent; positif: frappes en avance. */
    readonly inputOffsetMs: number;
  };
}

export const MUSIC: MusicSettings = {
  keys: ['KeyA', 'KeyS', 'KeyD', 'KeyF'],
  windows: { just: 70, near: 150, loose: 280 },
  maxWindowScale: 2,
  countIn: { beats: 4, minMs: 2400 },
  tailMs: 1200,
  reach: 3,
  hostSlack: { early: 700, late: 1800 },
  weights: { just: 1, near: 0.8, false: 0.3, missed: 0 },
  ratings: [0.4, 0.65, 0.88],
  // Cahier 4.5: 3, 6 puis tous. Tant que le second lieu n'existe pas (le seul qui donnerait un
  // instrument fin), l'instrument amélioré (la clarinette d'Armand) joue tous les airs appris.
  airsPerTier: [3, null, null],
  duo: { bonus: 1.5, minRating: 1, togetherMs: 400 },
  audience: {
    radius: 9,
    minSeconds: 6,
    everySeconds: 1,
    emotes: [null, 'joy', 'joy', 'joy'],
  },
  hat: { centsPerListener: [0, 20, 35, 50], maxCents: 400 },
  bond: { points: [1, 2, 3, 4] },
  listen: { nearM: 4, farM: 18, hushAbove: 0.5 },
  memory: {
    bestPrefix: 'musique.joue.',
    hat: 'musique.chapeau',
    listened: 'concert',
  },
  sound: {
    guideDb: -15,
    falseCents: -70,
    falseGlideMs: 160,
    partnerDb: -3,
    partnerPan: 0.3,
    lookaheadMs: 160,
    lateEchoMs: 180,
    inputOffsetMs: 0,
  },
};
