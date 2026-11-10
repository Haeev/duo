/**
 * Réglages de la basse-cour qui ne dépendent ni de l'espèce ni de l'abri (ceux-là sont dans
 * leurs fiches de `donnees/`). Réglables par le game designer.
 */
export const FARM_TUNING = {
  /** Mangeoire « basse » à ce nombre de jours de réserve ou moins (anneau hachuré). */
  lowDays: 1,
  /** Jours rattrapés au plus d'un coup (retour d'un long voyage): au-delà, plus rien ne change. */
  catchUpDays: 60,
  /** Part d'un intervalle de promenade passée à marcher; le reste, elle picore sur place. */
  walkShare: 0.3,
  /** Marge entre une bête et le bord de l'enclos ou de l'abri (m). */
  margin: 0.3,
  /** Plafond de bêtes d'un abri (schéma de l'état). */
  maxAnimals: 12,
} as const;
