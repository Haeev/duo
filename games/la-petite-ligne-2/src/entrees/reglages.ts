/** Réglages des commandes (game designer). */
export interface InputTuning {
  /**
   * Après la fermeture d'un écran qui capture le clavier, la touche d'action n'agit de nouveau
   * qu'une fois relâchée et passé ce délai, en temps réel (pas en temps de jeu: sous charge, un
   * délai de jeu avalerait des appuis). Le déplacement n'est jamais concerné.
   */
  readonly actReleaseGuardMs: number;
}

export const INPUT_TUNING: InputTuning = { actReleaseGuardMs: 300 };
