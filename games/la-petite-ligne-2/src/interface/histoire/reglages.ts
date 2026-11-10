/** Réglages de l'histoire à l'écran (durées, seuils), sans toucher à la logique. */
export interface HistoireSettings {
  /** Anti-double-appui à l'arrivée de l'écran de fin de chapitre (ms): l'Espace d'avant ne le ferme pas. */
  readonly endGuardMs: number;
  /** Écho local d'un maintien: l'avancement affiché ne dépasse pas cette part avant l'hôte. */
  readonly echoCap: number;
  /** Un appui reste affiché « appuyé » aussi longtemps (ms) avant de s'en remettre à l'hôte. */
  readonly pressEchoMs: number;
  /** « Ensemble ! » reste affiché après la réussite (ms). */
  readonly togetherHoldMs: number;
  /** Message d'un geste raté (ms). */
  readonly gestureMessageMs: number;
}

export const HISTOIRE_SETTINGS: HistoireSettings = {
  endGuardMs: 500,
  echoCap: 0.98,
  pressEchoMs: 400,
  togetherHoldMs: 1400,
  gestureMessageMs: 2200,
};
