/** Réglages des onglets du carnet (interface.md, 5.3), réglables sans toucher à la logique. */
export interface CarnetTuning {
  /** Quêtes: cartes secondaires par page (1 carte principale en plus). */
  readonly secondaryPerPage: number;
  /** Habitants: colonnes de portraits. */
  readonly villagerColumns: number;
  /** Collections: colonnes de cases. */
  readonly collectionColumns: number;
  /** Cœurs d'amitié par habitant. */
  readonly heartsMax: number;
  /** Carte: rafraîchissement des portraits (ms). */
  readonly mapRefreshMs: number;
  /** Carte: un habitant est « à » un lieu s'il en est à moins de (m). */
  readonly mapPlaceRadius: number;
  /** Carte: pixels utiles de la carte à 1366x768 (interface.md, 5.3). */
  readonly mapWidthPx: number;
  readonly mapHeightPx: number;
  /** Réglages: pas du volume. */
  readonly volumeStep: number;
}

export const CARNET_TUNING: CarnetTuning = {
  secondaryPerPage: 4,
  villagerColumns: 5,
  collectionColumns: 6,
  heartsMax: 5,
  mapRefreshMs: 2000,
  mapPlaceRadius: 12,
  mapWidthPx: 1030,
  mapHeightPx: 550,
  volumeStep: 10,
};
