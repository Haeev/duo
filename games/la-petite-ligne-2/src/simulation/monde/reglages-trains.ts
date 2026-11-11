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
  /**
   * Passages à niveau: là où une voie à ciel ouvert croise une case de ces natures de terrain
   * (la carte n'a pas d'autre donnée des ouvrages). Le chemin de planches du quai (`chemin`) est
   * une traversée de service, sans sonnerie. La sonnerie sonne dès que la rame entre en freinant
   * (ou démarre) et que son chemin jusqu'à l'arrêt (ou jusqu'à son départ) passe sur la route, et
   * se tait quand sa queue l'a dégagée de `margin` mètres.
   */
  crossing: { natures: ['route', 'rue'] as readonly string[], margin: 1, sample: 0.25 },
  /**
   * Habitants: l'emprise d'une rame s'étend de sa place à celle où elle va (arrêt, ou fin de son
   * départ): on ne traverse pas devant un train qui arrive. Pas d'échantillonnage d'une arête du
   * graphe des chemins contre cette emprise (m).
   */
  waySample: 0.5,
  /**
   * Barrières de passage à niveau (brique `barrier`): une barrière se lie au passage à niveau le
   * plus proche dont le milieu est à moins de `linkMeters` de son centre; au-delà, elle reste levée.
   */
  barriers: { linkMeters: 12 },
} as const;

export type TrainSettings = typeof TRAINS;
