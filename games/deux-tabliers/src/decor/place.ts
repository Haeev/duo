/**
 * La place du Tilleul pour ses passants: lieux réels (portes, bancs, bords de la scène), chemins
 * entre eux, hauteur du sol, obstacles. Relevé sur le décor cuit (`assets-src/modeles/lib/place.py`,
 * repère du plan: x vers l'est, z = y du plan vers le sud; sol du café à 0).
 *
 * Pourquoi ces lieux: la boulangerie (« juste de l'autre côté de la ruelle »), la mairie-école (une
 * seule porte sur la place: les enfants sortent par là à 16 h 30), l'église (portail sur le parvis),
 * les maisons de la place (leurs portes), les trois bancs (tilleul, parvis), la ruelle du Lavoir qui
 * monte vers le nord, la route départementale qui file vers l'ouest et l'est. Le café: sa porte.
 *
 * Les chemins suivent les trottoirs et la place en évitant la terrasse (z 13 à 15,5), le tilleul, la
 * fontaine (et les clients assis sur sa margelle), l'abri du car, les réverbères et les bancs:
 * `tests/passants.test.ts` vérifie que chaque chemin, voies de gauche et de droite comprises, reste
 * à distance de tout obstacle.
 */

export interface PlacePoint {
  readonly x: number;
  readonly z: number;
}

/** Nœuds du réseau de chemins. */
export const NODES = {
  // bords de la scène (on y naît et on y disparaît, hors de la vue des vitrines)
  ouest: { x: -30, z: 22.4 },
  est: { x: 40, z: 22.4 },
  ruelle: { x: 12.5, z: 3.6 },
  // trottoir nord (dalles, devant les maisons, le café et la boulangerie)
  sw_w: { x: -8.5, z: 14.7 },
  sw_h1: { x: -1.25, z: 14.7 },
  sw_til: { x: 2.55, z: 15.45 },
  sw_ruelle: { x: 12.5, z: 15.0 },
  ru_bas: { x: 12.5, z: 12.6 },
  sw_boul: { x: 19.1, z: 14.8 },
  sw_e: { x: 21.0, z: 15.2 },
  // place pavée, au sud de la terrasse
  pl_w: { x: -1.8, z: 18.3 },
  pl_cafe_w: { x: 4.55, z: 16.95 },
  pl_cafe: { x: 6.6, z: 17.3 },
  pl_porte: { x: 9.4, z: 17.4 },
  pl_c: { x: 6.2, z: 19.0 },
  pl_til_s: { x: 2.6, z: 19.3 },
  pl_se: { x: 20.2, z: 18.4 },
  // route départementale (on la traverse, on la longe vers l'ouest et l'est)
  rd_w: { x: -1.8, z: 21.9 },
  rd_c: { x: 7.4, z: 21.9 },
  rd_e: { x: 20.0, z: 21.9 },
  // parvis et sud de la place
  pv_w: { x: -0.8, z: 25.8 },
  pv_w2: { x: -1.6, z: 32.6 },
  h4_ap: { x: -2.5, z: 27.4 },
  pv_c: { x: 6.6, z: 26.05 },
  pv_e: { x: 17.6, z: 25.95 },
  pv_e2: { x: 16.6, z: 31.4 },
  eglise_ap: { x: 8.5, z: 31.4 },
  mairie_ap: { x: 19.4, z: 30.1 },
  presby_ap: { x: 18.2, z: 39.6 },
  banc_t_ap: { x: 0.4, z: 18.1 },
  banc_pw_ap: { x: 2.3, z: 25.75 },
  banc_pe_ap: { x: 14.8, z: 25.95 },
  // la porte du café: le point d'entrée des clients (`entrance` du plan)
  cafe_porte: { x: 9.4, z: 16.0 },
} as const satisfies Record<string, PlacePoint>;

export type NodeId = keyof typeof NODES;

export const EDGES: readonly (readonly [NodeId, NodeId])[] = [
  ['ouest', 'rd_w'],
  ['rd_w', 'rd_c'],
  ['rd_c', 'rd_e'],
  ['rd_e', 'est'],
  ['ruelle', 'ru_bas'],
  ['ru_bas', 'sw_ruelle'],
  ['sw_w', 'sw_h1'],
  ['sw_w', 'pl_w'],
  ['sw_h1', 'sw_til'],
  ['sw_til', 'pl_cafe_w'],
  ['pl_cafe_w', 'pl_cafe'],
  ['pl_cafe', 'pl_porte'],
  ['pl_porte', 'cafe_porte'],
  ['pl_porte', 'sw_ruelle'],
  ['sw_ruelle', 'sw_boul'],
  ['sw_boul', 'sw_e'],
  ['sw_e', 'pl_se'],
  ['pl_se', 'rd_e'],
  ['pl_w', 'rd_w'],
  ['pl_w', 'banc_t_ap'],
  ['banc_t_ap', 'pl_til_s'],
  ['pl_w', 'pl_til_s'],
  ['pl_til_s', 'pl_c'],
  ['pl_cafe', 'pl_c'],
  ['pl_c', 'rd_c'],
  ['rd_w', 'pv_w'],
  ['pv_w', 'banc_pw_ap'],
  ['banc_pw_ap', 'pv_c'],
  ['pv_w', 'pv_w2'],
  ['pv_w', 'h4_ap'],
  ['rd_c', 'pv_c'],
  ['pv_c', 'eglise_ap'],
  ['rd_e', 'pv_e'],
  ['pv_e', 'banc_pe_ap'],
  ['banc_pe_ap', 'pv_c'],
  ['pv_e', 'mairie_ap'],
  ['pv_e', 'pv_e2'],
  ['pv_e2', 'mairie_ap'],
  ['pv_e2', 'eglise_ap'],
  ['pv_e2', 'presby_ap'],
];

/** Où l'on va: une porte (on y entre), une place de banc (on s'y assoit), un bord (on s'en va). */
export interface Place {
  readonly id: string;
  readonly kind: 'door' | 'seat' | 'edge' | 'wait';
  /** Nœud du réseau d'où l'on rejoint le lieu (le dernier pas va droit au lieu). */
  readonly node: NodeId;
  readonly x: number;
  readonly z: number;
  /** Cap une fois arrivé (0 regarde le nord, -z; 90 l'ouest), comme les joueurs. */
  readonly yawDeg: number;
}

export const PLACES: readonly Place[] = [
  // portes
  { id: 'boulangerie', kind: 'door', node: 'sw_boul', x: 19.1, z: 13.35, yawDeg: 0 },
  { id: 'mairie', kind: 'door', node: 'mairie_ap', x: 21.45, z: 30.1, yawDeg: 270 },
  { id: 'eglise', kind: 'door', node: 'eglise_ap', x: 8.5, z: 33.7, yawDeg: 180 },
  { id: 'maison_h1', kind: 'door', node: 'sw_h1', x: -1.25, z: 13.35, yawDeg: 0 },
  // la porte de h4 a un pot de fleurs devant sa moitié nord: on l'aborde par le sud-est
  { id: 'maison_h4', kind: 'door', node: 'h4_ap', x: -3.7, z: 26.75, yawDeg: 90 },
  { id: 'maison_h5', kind: 'door', node: 'pv_w2', x: -3.85, z: 34.55, yawDeg: 90 },
  { id: 'maison_h6', kind: 'door', node: 'pv_w2', x: -2.97, z: 35.65, yawDeg: 180 },
  { id: 'maison_ne', kind: 'door', node: 'sw_e', x: 21.65, z: 14.5, yawDeg: 270 },
  { id: 'presbytere', kind: 'door', node: 'presby_ap', x: 18.2, z: 41.15, yawDeg: 180 },
  // bancs: deux places chacun (le banc du tilleul regarde l'église, ceux du parvis le café)
  { id: 'banc_tilleul_1', kind: 'seat', node: 'banc_t_ap', x: 0.0, z: 16.98, yawDeg: 180 },
  { id: 'banc_tilleul_2', kind: 'seat', node: 'banc_t_ap', x: 0.8, z: 16.98, yawDeg: 180 },
  { id: 'banc_parvis_o_1', kind: 'seat', node: 'banc_pw_ap', x: 1.9, z: 27.02, yawDeg: 0 },
  { id: 'banc_parvis_o_2', kind: 'seat', node: 'banc_pw_ap', x: 2.7, z: 27.02, yawDeg: 0 },
  { id: 'banc_parvis_e_1', kind: 'seat', node: 'banc_pe_ap', x: 14.4, z: 27.02, yawDeg: 0 },
  { id: 'banc_parvis_e_2', kind: 'seat', node: 'banc_pe_ap', x: 15.2, z: 27.02, yawDeg: 0 },
  // parents qui attendent la sortie de l'école, contre la façade de part et d'autre des marches
  // (hors du passage vers la porte), tournés vers elle
  { id: 'ecole_1', kind: 'wait', node: 'mairie_ap', x: 21.35, z: 27.9, yawDeg: 200 },
  { id: 'ecole_2', kind: 'wait', node: 'mairie_ap', x: 20.6, z: 27.6, yawDeg: 210 },
  { id: 'ecole_3', kind: 'wait', node: 'mairie_ap', x: 21.35, z: 32.3, yawDeg: 340 },
  { id: 'ecole_4', kind: 'wait', node: 'mairie_ap', x: 20.6, z: 32.6, yawDeg: 330 },
  // bords
  { id: 'ouest', kind: 'edge', node: 'ouest', x: NODES.ouest.x, z: NODES.ouest.z, yawDeg: 90 },
  { id: 'est', kind: 'edge', node: 'est', x: NODES.est.x, z: NODES.est.z, yawDeg: 270 },
  { id: 'ruelle', kind: 'edge', node: 'ruelle', x: NODES.ruelle.x, z: NODES.ruelle.z, yawDeg: 0 },
  // porte du café (clients qui arrivent et qui repartent)
  { id: 'cafe', kind: 'door', node: 'cafe_porte', x: 9.4, z: 16.0, yawDeg: 0 },
];

export function placeById(id: string): Place | undefined {
  return PLACES.find((p) => p.id === id);
}

/** Obstacle au sol: disque (centre, rayon) ou boîte alignée (x0, z0, x1, z1). */
export type Blocker =
  | { readonly kind: 'disc'; readonly x: number; readonly z: number; readonly r: number }
  | {
      readonly kind: 'box';
      readonly x0: number;
      readonly z0: number;
      readonly x1: number;
      readonly z1: number;
    };

/**
 * Ce que les passants ne traversent pas (hors bâtiments, que le réseau longe): tilleul et sa
 * banquette, fontaine et margelle où s'assoient les clients, abri du car, poteau, réverbères, bancs,
 * vélos, pots, la terrasse du café et son ardoise.
 */
export const BLOCKERS: readonly Blocker[] = [
  // tilleul: le tronc évasé (la grille de fonte autour du pied est au ras du sol, on y marche)
  { kind: 'disc', x: 2.6, z: 17.4, r: 0.7 },
  { kind: 'disc', x: 13.6, z: 17.6, r: 1.45 },
  { kind: 'box', x0: 15.2, z0: 16.95, x1: 17.8, z1: 18.3 },
  { kind: 'disc', x: 18.3, z: 19.0, r: 0.05 },
  { kind: 'disc', x: 8.65, z: 18.9, r: 0.14 },
  { kind: 'disc', x: -3.0, z: 18.9, r: 0.14 },
  { kind: 'disc', x: 11.2, z: 25.1, r: 0.14 },
  { kind: 'disc', x: 21.3, z: 25.0, r: 0.14 },
  { kind: 'disc', x: -2.0, z: 25.1, r: 0.14 },
  { kind: 'box', x0: -0.4, z0: 16.72, x1: 1.2, z1: 17.28 },
  { kind: 'box', x0: 1.5, z0: 26.72, x1: 3.1, z1: 27.28 },
  { kind: 'box', x0: 14.0, z0: 26.72, x1: 15.6, z1: 27.28 },
  { kind: 'box', x0: 12.1, z0: 16.55, x1: 13.25, z1: 16.95 },
  { kind: 'box', x0: 13.9, z0: 13.0, x1: 15.15, z1: 13.5 },
  { kind: 'disc', x: 13.75, z: 13.4, r: 0.38 },
  { kind: 'disc', x: 20.25, z: 13.4, r: 0.38 },
  { kind: 'disc', x: 6.0, z: 33.2, r: 0.38 },
  { kind: 'disc', x: 11.0, z: 33.2, r: 0.38 },
  { kind: 'disc', x: -3.4, z: 26.0, r: 0.38 },
  { kind: 'box', x0: 4.0, z0: 13.0, x1: 8.8, z1: 15.5 },
  // bâtiments vus de la place (façades): rangée nord, boulangerie, mairie, église et clocher, maisons
  { kind: 'box', x0: -11.5, z0: 4.0, x1: 11.5, z1: 13.0 },
  { kind: 'box', x0: 13.5, z0: 4.0, x1: 20.5, z1: 13.0 },
  { kind: 'box', x0: 22.0, z0: 13.0, x1: 29.0, z1: 19.0 },
  { kind: 'box', x0: 22.0, z0: 25.2, x1: 31.0, z1: 35.0 },
  { kind: 'box', x0: 4.0, z0: 34.0, x1: 13.0, z1: 48.0 },
  { kind: 'box', x0: 10.2, z0: 33.4, x1: 13.4, z1: 36.6 },
  { kind: 'box', x0: -11.0, z0: 25.2, x1: -4.0, z1: 30.2 },
  { kind: 'box', x0: -11.5, z0: 30.2, x1: -4.2, z1: 36.0 },
  { kind: 'box', x0: -4.2, z0: 36.0, x1: 3.2, z1: 44.0 },
  { kind: 'box', x0: 14.8, z0: 41.5, x1: 21.6, z1: 48.0 },
  { kind: 'box', x0: -17.0, z0: 13.0, x1: -10.0, z1: 19.0 },
];

/** Distance d'un point à un obstacle (négative dedans). */
export function blockerDistance(b: Blocker, x: number, z: number): number {
  if (b.kind === 'disc') return Math.hypot(x - b.x, z - b.z) - b.r;
  const dx = Math.max(b.x0 - x, 0, x - b.x1);
  const dz = Math.max(b.z0 - z, 0, z - b.z1);
  if (dx > 0 || dz > 0) return Math.hypot(dx, dz);
  return -Math.min(x - b.x0, b.x1 - x, z - b.z0, b.z1 - z);
}

const ramp = (v: number, a: number, b: number): number =>
  Math.max(0, Math.min(1, (v - a) / (b - a)));

/**
 * Hauteur du sol sous un passant: trottoir à 0, place pavée à -0,16, route à -0,27, la ruelle qui
 * monte vers le nord, les marches de l'église et de la mairie. Les marches de bordure se franchissent
 * en un pas (fondu de 20 cm, pas de saut à l'image).
 */
export function groundAt(x: number, z: number): number {
  // Ruelle du Lavoir: de 0 (z 13) à 0,9 (z 3).
  if (x >= 11.5 && x <= 13.5 && z < 13) return 0.9 * ramp(13 - z, 0, 10);
  // Marches du portail de l'église (x 8,5 ± 2,4; z 32,8 à 34).
  if (z > 32.8 && z < 34 && Math.abs(x - 8.5) < 2.4) {
    if (z > 33.6 && Math.abs(x - 8.5) < 1.8) return 0.18;
    if (z > 33.2 && Math.abs(x - 8.5) < 2.1) return 0.02;
    return -0.14;
  }
  // Marches de la mairie (x 20,8 à 21,7; z 30,1 ± 1,2).
  if (x > 20.8 && x < 21.75 && Math.abs(z - 30.1) < 1.2) {
    if (x > 21.4 && Math.abs(z - 30.1) < 0.6) return 0.18;
    if (x > 21.1 && Math.abs(z - 30.1) < 0.9) return 0.02;
    return -0.14;
  }
  const sidewalk = x >= -10 && x <= 22 && z < 16;
  if (sidewalk) return -0.16 * ramp(z, 15.8, 16.0);
  if (z < 19.2) return -0.16;
  if (z < 24.5) return -0.16 - 0.11 * ramp(z, 19.2, 19.4) + 0.11 * ramp(z, 24.36, 24.56);
  return -0.16;
}
