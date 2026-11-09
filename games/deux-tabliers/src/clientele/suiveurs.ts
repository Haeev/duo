/**
 * Place des membres d'un groupe debout derrière celui qui mène (rendu, hôte et invité). La
 * simulation ne déplace que le premier membre (son marcheur évite murs et meubles); les autres
 * suivent deux par deux, un rang derrière (`groupRows` de la file). Retour de séance du
 * 2026-11-09 (« PNJ dans le mur »): à la caisse, le rang suivant est décalé de 30 cm vers le mur
 * est (x 11), et la cliente se dessinait à moitié dans le mur. Un suiveur qui toucherait un mur ou
 * un meuble passe de l'autre côté, puis derrière le meneur, sinon il est repoussé hors de l'obstacle.
 */
import type { Content } from '../donnees/charger';
import type { World } from '../etat/monde';
import { furnitureObstacles, shellObstacles } from '../simulation/collisions';
import { pushOut, type Obstacle, type Vec2 } from '../simulation/geometrie';

/** Demi-largeur d'un personnage debout (épaules), plus large que le rayon de marche (0,2 m). */
export const FOLLOWER_RADIUS = 0.26;
/** Décalage latéral des suiveurs, de part et d'autre de l'axe du meneur. */
export const FOLLOWER_SIDE = 0.3;

const probe: Vec2 = { x: 0, z: 0 };

function hits(obstacles: readonly Obstacle[], x: number, z: number, r: number): boolean {
  for (const o of obstacles) {
    probe.x = x;
    probe.z = z;
    if (pushOut(probe, r, o)) return true;
  }
  return false;
}

/**
 * Pose `out` (x, z) du membre `k` (1 et plus) derrière le meneur (`lead`, cap en degrés: 0 regarde
 * le nord, -z), à `spacing` mètres par rang. Rend `out`.
 */
export function followerSpot(
  content: Content,
  world: World,
  lead: { readonly x: number; readonly z: number; readonly yawDeg: number },
  k: number,
  spacing: number,
  out: Vec2,
): Vec2 {
  const a = (lead.yawDeg * Math.PI) / 180;
  const back = spacing * Math.ceil(k / 2);
  const side = k % 2 === 1 ? FOLLOWER_SIDE : -FOLLOWER_SIDE;
  const bx = lead.x + Math.sin(a) * back;
  const bz = lead.z + Math.cos(a) * back;
  const shell = shellObstacles(content, world);
  const furniture = furnitureObstacles(content, world);
  const free = (x: number, z: number): boolean =>
    !hits(shell, x, z, FOLLOWER_RADIUS) && !hits(furniture, x, z, FOLLOWER_RADIUS);
  for (const s of [side, -side, 0]) {
    const x = bx + Math.cos(a) * s;
    const z = bz - Math.sin(a) * s;
    if (free(x, z)) {
      out.x = x;
      out.z = z;
      return out;
    }
  }
  // Partout serré (porte, couloir): repoussé hors des obstacles, quelques passes.
  out.x = bx;
  out.z = bz;
  for (let pass = 0; pass < 4; pass++) {
    let moved = false;
    for (const o of shell) moved = pushOut(out, FOLLOWER_RADIUS, o) || moved;
    for (const o of furniture) moved = pushOut(out, FOLLOWER_RADIUS, o) || moved;
    if (!moved) break;
  }
  return out;
}
