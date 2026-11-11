/**
 * Aide réglable par joueur (cahier 2.4, CA-23), réglable par le game designer: chaque cran élargit
 * les fenêtres de temps et les tolérances des mini-jeux de ce joueur, et de lui seul.
 */
import type { AssistLevel } from '../../etat/joueur';

export interface AssistSettings {
  /** Multiplicateur des fenêtres et tolérances de chaque cran (1: rien d'élargi). */
  readonly factor: Readonly<Record<AssistLevel, number>>;
}

export const ASSIST: AssistSettings = {
  factor: { normal: 1, nudge: 1.25, big: 1.5 },
};
