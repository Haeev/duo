/**
 * Réglages de l'histoire (quêtes, scènes, déclencheurs) que `reglages.json` n'a pas encore:
 * typés et réunis ici pour le game designer, à migrer dans `donnees/commun/reglages.json` quand
 * L0 aura ajouté la section, sans changer les systèmes qui les lisent.
 */
export interface StorySettings {
  /** Les étapes en cours sont évaluées tous les N pas (30 pas par seconde). */
  readonly checkEveryTicks: number;
  /** Distance entre les deux joueurs sous laquelle ils sont « réunis » (m). */
  readonly togetherRadius: number;
  /** Rayon par défaut de la condition `reach` (m). */
  readonly reachRadius: number;
  /** Durée du coup d'œil vers l'objectif suivi (s, réponse 68). */
  readonly glanceSeconds: number;
  /** Retard permis d'un déclencheur à heure fixe (minutes de jeu): au-delà, il attend le lendemain. */
  readonly triggerLateMinutes: number;
  /** Une réplique lue par un seul joueur passe d'elle-même au bout de ce délai (s). */
  readonly soloReadSeconds: number;
  /** Plafond d'une réplique, lue ou non (s): un joueur parti ne bloque jamais l'autre. */
  readonly maxLineSeconds: number;
  /** Vitesse de marche d'un habitant dans une scène (m/s). */
  readonly villagerWalkSpeed: number;
  /** Au-delà, une marche de scène se termine en replaçant l'habitant (s). */
  readonly maxWalkSeconds: number;
}

export const STORY: StorySettings = {
  checkEveryTicks: 6,
  togetherRadius: 6,
  reachRadius: 2.5,
  glanceSeconds: 3,
  triggerLateMinutes: 60,
  soloReadSeconds: 4,
  maxLineSeconds: 20,
  villagerWalkSpeed: 1.4,
  maxWalkSeconds: 20,
};
