/**
 * Cloche des heures du clocher. Valeurs de jeu: le game designer les règle ici, jamais dans la
 * logique. La grande cloche de Marthe retarde de quatre minutes tant que le fait `repairedFact`
 * n'est pas écrit (cahier du son, point d'accroche 5).
 */
export interface BellTuning {
  /** Lieu qui a un clocher: ailleurs, la cloche ne sonne pas. */
  readonly place: string;
  /** Heures pleines sonnées (heures de jour seulement), bornes comprises. */
  readonly firstHour: number;
  readonly lastHour: number;
  /** Retard de la cloche (minutes de jeu) tant que le fait `repairedFact` manque. */
  readonly lateMinutes: number;
  readonly repairedFact: string;
  /** Écart entre deux coups d'une même heure (secondes réelles). */
  readonly strokeGapSeconds: number;
}

export const BELL: BellTuning = {
  place: 'aubrune',
  firstHour: 7,
  lastHour: 19,
  lateMinutes: 4,
  repairedFact: 'aubrune.cloche.juste',
  strokeGapSeconds: 3,
};

/** Nombre de coups d'une heure sur un cadran de douze heures (midi: 12, 13 h: 1). */
export function strokesFor(hour: number): number {
  return hour % 12 === 0 ? 12 : hour % 12;
}
