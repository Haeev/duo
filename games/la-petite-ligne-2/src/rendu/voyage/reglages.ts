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
  camera: { x: -1.6, y: 1.6, yawDeg: 12, pitchDeg: 30, width: 17, rideWidth: 22 },

  /**
   * Diorama: le quai est au niveau 0, au plancher de la caisse; la voie en contrebas, le dessus
   * des rails (`trench` - 0,1 - `rails.height`) là où l'autorail pose ses roues (0,26 m sous son
   * plancher moins `train.floor`).
   */
  ground: { trench: 0.96, trackHalfWidth: 1.6, halfDepth: 16, margin: 50 },
  rails: { gauge: 1.44, height: 0.12, sleeperStep: 0.75 },
  platform: { length: 26, depth: 4.2, edge: 0.22 },

  /**
   * Le train: l'autorail livré (manifeste des décors), sa caisse le long de x, sa tête vers +x.
   * Mesures du modèle: longueur et largeur (m), plancher au-dessus du ballast, milieu de ses
   * portes à `door` m du centre. Sa porte arrière est la portière du trajet: le centre de la
   * caisse est à `center` m, la portière à `center - door` (`doorX`).
   */
  train: {
    model: 'railcar',
    length: 14.52,
    halfWidth: 1.46,
    height: 3.95,
    floor: 1,
    door: 4.9,
    center: 0.2,
  },
  /** Places des deux joueurs: sur le quai, à côté de la portière (m); dans la salle, à la fenêtre. */
  spots: {
    quay: [
      { dx: -1.1, y: 2.5 },
      { dx: 1.1, y: 2.5 },
    ],
    inside: [
      { dx: 1.7, y: 0.75 },
      { dx: 3.7, y: 0.75 },
    ],
    /** Seuil de la portière, côté quai (m), et écart de chacun au milieu: on ne s'y marche pas dessus. */
    doorstep: 1.75,
    doorSpread: 0.3,
  },

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
    wheel: '#26282E',
    /** Caisse provisoire, tant que le modèle de l'autorail n'est pas chargé. */
    standIn: '#3F6453',
    brass: '#C8A150',
    trunk: '#96704C',
    foliage: ['#7F9C79', '#93B45E', '#6F8F5A', '#96A98C'],
    hill: '#A9BF86',
    pole: '#3F6453',
    shelterRoof: '#B86B4F',
    sign: '#2C3B57',
  },
} as const;

export type TripSettings = typeof TRIP_SETTINGS;
