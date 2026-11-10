/**
 * Réglages de la scène du trajet (rendu seul). La durée vient de la configuration du jeu
 * (`travel.minSeconds` de `reglages.json`); ici, le découpage de la scène, les mesures du diorama
 * et ses couleurs (nuancier de la bible artistique).
 */
export const TRIP_SETTINGS = {
  /**
   * Parts de la scène (somme 1): le train entre en gare, on monte, il roule, il arrive et on
   * descend. Une scène de 10 s: 2,2 s, 1,8 s, 4 s, 2 s.
   */
  parts: { arrive: 0.22, board: 0.18, ride: 0.4, alight: 0.2 },
  /** Distance parcourue par le train qui entre en gare (m), puis entre les deux quais (m). */
  approachDistance: 34,
  rideDistance: 120,
  /** Part de la montée passée à marcher jusqu'à la portière; de la descente, attente puis marche. */
  boardWalk: 0.65,
  alightWait: 0.12,
  alightWalk: 0.6,
  /** Fondu au noir à l'entrée et à la sortie de la scène (s). */
  fadeSeconds: 0.35,

  /** Caméra: milieu visé (m), lacet et inclinaison (degrés), largeur de vue à quai et au plus large (m). */
  camera: { x: -4.2, y: 1.6, yawDeg: 12, pitchDeg: 30, width: 15, rideWidth: 21 },

  /** Diorama: le quai est au niveau 0, la voie en contrebas (assez bas pour que les roues restent sous le plancher). */
  ground: { trench: 1.1, trackHalfWidth: 1.6, halfDepth: 16, margin: 50 },
  rails: { gauge: 1.44, height: 0.12, sleeperStep: 0.75 },
  platform: { length: 26, depth: 4.2, edge: 0.22 },

  /** Wagon (m): longueur, demi-largeur, hauteurs (bas des fenêtres, haut, toit); portière au milieu. */
  wagon: { length: 9.4, halfWidth: 1.3, sill: 0.95, lintel: 1.85, top: 2.3, roof: 2.5, door: 1.1 },
  /** Places des deux joueurs: sur le quai, à côté de la portière (m); dans le wagon, à la fenêtre. */
  spots: {
    quay: [
      { dx: -1.1, y: 2.5 },
      { dx: 1.1, y: 2.5 },
    ],
    inside: [
      { dx: -2.3, y: 0.75 },
      { dx: 2.3, y: 0.75 },
    ],
    /** Seuil de la portière, côté quai (m), et écart de chacun au milieu: on ne s'y marche pas dessus. */
    doorstep: 1.75,
    doorSpread: 0.3,
  },
  /** Fumée de la locomotive: bouffées en boucle, montée (m) et durée de vie (s). */
  smoke: { puffs: 6, rise: 2.2, drift: 3.5, life: 1.4, size: 0.32 },

  /** Décor qui défile: arbres et poteaux le long de la voie, collines au loin. */
  scenery: { trees: 90, poleStep: 14, hills: 9, seed: 5 },

  colors: {
    grass: '#93B45E',
    grassDark: '#7F9C79',
    ballast: '#9A948A',
    sleeper: '#5E4233',
    rail: '#8C8E91',
    stone: '#C0B4A1',
    edge: '#F3EDE0',
    livery: '#3F6453',
    band: '#EBDCBF',
    chassis: '#9B4C3B',
    roof: '#737B86',
    wheel: '#26282E',
    interior: '#D9CAAE',
    brass: '#C8A150',
    trunk: '#96704C',
    foliage: ['#7F9C79', '#93B45E', '#6F8F5A', '#96A98C'],
    hill: '#A9BF86',
    pole: '#3F6453',
    shelterRoof: '#B86B4F',
    sign: '#2C3B57',
    smoke: '#F3EDE0',
  },
} as const;

export type TripSettings = typeof TRIP_SETTINGS;
