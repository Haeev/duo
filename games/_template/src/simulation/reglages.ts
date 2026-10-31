// Valeurs de jeu, jamais en dur dans la logique.
export const REGLAGES = {
  /** Taille du terrain, en unités du monde. */
  largeur: 16,
  hauteur: 9,
  /** Vitesse d'un astre, en unités par seconde. */
  vitesse: 4,
  /** Un instantané tous les N pas (2 à 60 Hz: 30 instantanés par seconde). */
  pasParInstantane: 2,
} as const;
