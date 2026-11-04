// Réglages de la recherche des mises à jour des jeux (ADR 0010, point 4; patch 0.3.1).
// Le contrôle est court pour ne jamais faire attendre: catalogue injoignable dans
// le délai = on joue à la version installée (Internet jamais indispensable).

export interface UpdateConfig {
  /** Délai de lecture du catalogue, en ms. */
  readonly catalogueTimeoutMs: number;
  /** Recherche périodique, en ms. */
  readonly intervalMs: number;
  /** Ouverture de la bibliothèque ou d'un salon: nouvelle recherche si la dernière est plus ancienne. */
  readonly staleAfterMs: number;
  /** Durée d'affichage de « À jour » après une installation, en ms. */
  readonly doneVisibleMs: number;
  /** Nouveaux essais automatiques après un échec, en ms. */
  readonly retryDelaysMs: readonly number[];
}

export const UPDATE_CONFIG: UpdateConfig = {
  catalogueTimeoutMs: 3_000,
  intervalMs: 6 * 60 * 60 * 1000,
  staleAfterMs: 3 * 60 * 1000,
  doneVisibleMs: 6_000,
  retryDelaysMs: [60_000, 5 * 60_000, 15 * 60_000],
};
