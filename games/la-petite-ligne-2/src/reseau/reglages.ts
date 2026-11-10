/**
 * Réglages du réseau (lot L1): valeurs de la file des commandes, du coussin de gigue, de la
 * prédiction et de l'envoi de la progression. Les budgets de taille sont dans `canaux.ts` (L0).
 */

export interface NetSettings {
  readonly input: {
    /** Commandes de l'invité gardées d'avance sans rien écarter (coussin contre la gigue). */
    readonly idleBuffered: number;
    /** Au-delà, on écarte aussi des pas de marche (filet: l'invité reculerait d'autant). */
    readonly maxBuffered: number;
    /**
     * Commandes de l'invité en retard devinées d'affilée (la dernière marche rejouée), puis on
     * attend la vraie sans avancer. Une devinée « marche » à la place d'un arrêt fait glisser
     * l'invité d'un pas après l'arrêt: peu de devinées bornent ce glissement (5 cm par devinée).
     */
    readonly guessTicks: number;
    /** Sous cette norme, une commande de déplacement compte comme immobile. */
    readonly moveDeadzone: number;
  };
  readonly interpolation: {
    /** Retard d'affichage des autres, en pas: borne basse et borne haute du coussin. */
    readonly minDelayTicks: number;
    readonly maxDelayTicks: number;
    /** Marge ajoutée au 95e centile du retard observé. */
    readonly extraTicks: number;
    /** Instantanés regardés pour estimer la gigue. */
    readonly window: number;
    /** Instantanés gardés pour l'interpolation. */
    readonly kept: number;
    /** Vitesse à laquelle le coussin suit sa cible (pas de retard par seconde). */
    readonly followTicksPerSecond: number;
  };
  readonly prediction: {
    /** Retour de la correction vers zéro, par seconde (à l'arrêt). */
    readonly correctionDecay: number;
    /** En marche, la correction se résorbe au plus à cette part de la vitesse du pas. */
    readonly correctionWalkShare: number;
    /** Au-delà de cet écart (m), on se recale d'un coup (porte, téléportation). */
    readonly snapDistance: number;
    /** Geste prédit sans confirmation ni refus au bout de ce nombre de pas: abandonné. */
    readonly gestureTimeoutTicks: number;
  };
  readonly progress: {
    /** Taille visée d'un morceau de progression (octets de JSON), sous le budget du canal. */
    readonly partBytes: number;
  };
  /** Part du budget au-delà de laquelle l'hôte journalise un avertissement. */
  readonly warnShare: number;
}

export const NET_SETTINGS: NetSettings = {
  input: { idleBuffered: 1, maxBuffered: 12, guessTicks: 2, moveDeadzone: 0.1 },
  interpolation: {
    minDelayTicks: 2,
    maxDelayTicks: 10,
    extraTicks: 1,
    window: 90,
    kept: 64,
    followTicksPerSecond: 3,
  },
  prediction: {
    correctionDecay: 10,
    correctionWalkShare: 0.3,
    snapDistance: 2,
    gestureTimeoutTicks: 45,
  },
  progress: { partBytes: 12_288 },
  warnShare: 0.75,
};
