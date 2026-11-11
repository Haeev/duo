/**
 * Réglages des trains des événements (`trains.ts`). Les rames, les voies, les arrêts et les
 * horaires sont dans les données (`train` d'un événement); ici, ce qui vaut pour tous les trains.
 */
export const TRAINS = {
  /**
   * Demi-largeur de l'emprise bloquante (m): les caisses livrées font 2,93 m. Sur une voie droite
   * à 97,5, l'emprise prend les cases 96 à 98 et laisse libre la bordure du quai (case 99).
   */
  halfWidth: 1.47,
  /** Emprise prolongée devant et derrière une rame qui roule (m): on est écarté avant le choc. */
  movingMargin: 3,
  /** Pas d'échantillonnage de l'emprise, le long de la rame et en travers (m). */
  sample: 0.25,
  /** Position de la tête arrondie à ce pas (m): les obstacles ne sont refaits qu'à ce rythme. */
  quantum: 0.5,
  /**
   * Bogies: part de la demi-longueur d'un véhicule où ses deux points d'appui sont pris sur la
   * voie. La caisse suit la corde entre eux dans les courbes, comme un vrai véhicule.
   */
  bogieShare: 0.7,
} as const;

export type TrainSettings = typeof TRAINS;
