/**
 * Réglages de l'interface (durées, seuils, mises en page), réglables sans toucher à la logique.
 * Valeurs d'`interface.md` (sections 3, 5.2, 6) et de `references-de-ressenti.md` (section 3).
 */
export interface UiTuning {
  /** Repli de la barre d'outils après le dernier changement (ms). */
  readonly toolbarFoldMs: number;
  /** Durée du coup d'œil (ms). */
  readonly glanceMs: number;
  /** Médaillon montré après un changement de palier (ms). */
  readonly tierShowMs: number;
  /** En dessous (jauge de 0 à 100), le médaillon reste affiché. */
  readonly lowNeed: number;
  /** Vitesse d'écriture des répliques (caractères par seconde). */
  readonly typeCharsPerSecond: number;
  /** Pause après « . », « ! », « ? » (ms). */
  readonly punctuationPauseMs: number;
  /** Une syllabe de babil toutes les N lettres. */
  readonly babbleEvery: number;
  /** Mise en page d'une réplique: caractères par ligne, lignes par page. */
  readonly charsPerLine: number;
  readonly linesPerPage: number;
  /** Anti-double-appui à l'ouverture d'un écran (ms). */
  readonly openGuardMs: number;
  /** Message court sous la bulle (refus) et avis en haut à droite (ms). */
  readonly refusalMs: number;
  readonly noticeMs: number;
  /** Gain d'argent qui flotte près de la bourse (ms). */
  readonly moneyFloatMs: number;
  /** Pas du coffre commun (centimes), et pas avec Maj. */
  readonly chestStepCents: number;
  readonly chestBigStepCents: number;
  /** Heure de jeu (minutes depuis minuit): début et fin de la nuit, heure où l'on peut dormir. */
  readonly nightFrom: number;
  readonly nightUntil: number;
  readonly sleepFrom: number;
  /** Colonnes des grilles du carnet (5 cases de 84 px, interface.md 5.3). */
  readonly gridColumns: number;
  /** Nom d'un objet dans les menus: 4 mots au plus. */
  readonly nameWords: number;
  /**
   * Encombrement du carnet ouvert à l'échelle 1 (px): livre de 1064 x 608 plus signet ouvert et
   * marges. Sert à ne pas agrandir l'interface au point que le carnet sorte de la fenêtre.
   */
  readonly notebookWidthPx: number;
  readonly notebookHeightPx: number;
}

export const UI_TUNING: UiTuning = {
  toolbarFoldMs: 3000,
  glanceMs: 3000,
  tierShowMs: 4000,
  lowNeed: 20,
  typeCharsPerSecond: 40,
  punctuationPauseMs: 150,
  babbleEvery: 3,
  charsPerLine: 60,
  linesPerPage: 3,
  openGuardMs: 300,
  refusalMs: 1600,
  noticeMs: 4000,
  moneyFloatMs: 1200,
  chestStepCents: 100,
  chestBigStepCents: 1000,
  nightFrom: 20 * 60,
  nightUntil: 6 * 60,
  sleepFrom: 15 * 60,
  gridColumns: 5,
  nameWords: 4,
  notebookWidthPx: 1260,
  notebookHeightPx: 640,
};
