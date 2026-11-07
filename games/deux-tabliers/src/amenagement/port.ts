/**
 * Port à deux (technique 5.7, C14, ux 6.4): chaque porteur tient un bout de la charge. L'hôte
 * déplace la charge d'après les deux joueurs (moyenne de leurs envies, 1,2 m/s au plus) et place
 * les porteurs à leurs poignées; la position d'un porteur n'est donc pas prédite (`walk` s'arrête),
 * son regard reste libre. Sans échec: la charge s'arrête doucement contre un mur ou un meuble.
 */
import type { Content } from '../donnees/charger';
import type { PlacedFurniture, PlayerIndex, PlayerState, World } from '../etat/monde';
import { shellObstacles } from '../simulation/collisions';
import type { StepInput } from '../simulation/entrees';
import { localToWorld, type Obstacle } from '../simulation/geometrie';
import { distanceTo, footprintOf, overlaps } from './regles';

/** Ce joueur porte (ou attend l'autre pour porter): ses pas ne le déplacent pas. */
export function isCarrying(world: World, player: PlayerState): boolean {
  const carry = world.arrangement.carry;
  if (carry === null) return false;
  if (world.players[0] === player) return carry.handles[0] !== null;
  if (world.players[1] === player) return carry.handles[1] !== null;
  return false;
}

export function carriedFurniture(world: World): PlacedFurniture | undefined {
  const carry = world.arrangement.carry;
  return carry === null ? undefined : world.furniture.find((f) => f.id === carry.furniture);
}

/** Les deux poignées d'une charge: aux deux bouts de son grand côté, à `gap` du bord. */
export function handlesOf(
  content: Content,
  f: PlacedFurniture,
  x = f.x,
  z = f.z,
  rotDeg = f.rotDeg,
): [{ x: number; z: number }, { x: number; z: number }] {
  const type = content.furniture.get(f.type);
  const [w, d] = type?.footprint ?? [1, 1];
  const gap = content.arrangement.carry.handleGap;
  const along = w >= d;
  const reach = (along ? w : d) / 2 + gap;
  const a = along ? localToWorld(x, z, rotDeg, -reach, 0) : localToWorld(x, z, rotDeg, 0, -reach);
  const b = along ? localToWorld(x, z, rotDeg, reach, 0) : localToWorld(x, z, rotDeg, 0, reach);
  return [a, b];
}

/** Côté le plus proche du joueur (0 ou 1), et sa distance. */
export function nearestHandle(
  content: Content,
  f: PlacedFurniture,
  px: number,
  pz: number,
): { side: 0 | 1; distance: number } {
  const [a, b] = handlesOf(content, f);
  const da = Math.hypot(a.x - px, a.z - pz);
  const db = Math.hypot(b.x - px, b.z - pz);
  return da <= db ? { side: 0, distance: da } : { side: 1, distance: db };
}

function wish(player: PlayerState, input: StepInput, speed: number): { x: number; z: number } {
  const len = Math.hypot(input.moveX, input.moveZ);
  if (len === 0) return { x: 0, z: 0 };
  const yaw = (player.yawDeg * Math.PI) / 180;
  const f = input.moveZ / Math.max(1, len);
  const s = input.moveX / Math.max(1, len);
  return {
    x: (-Math.sin(yaw) * f + Math.cos(yaw) * s) * speed,
    z: (-Math.cos(yaw) * f - Math.sin(yaw) * s) * speed,
  };
}

/** La charge tiendrait-elle à cette pose (sans toucher la coque ni un meuble, porteurs compris) ? */
export function poseFree(
  content: Content,
  world: World,
  f: PlacedFurniture,
  x: number,
  z: number,
  rotDeg: number,
): boolean {
  const type = content.furniture.get(f.type);
  if (type === undefined) return false;
  const fp = footprintOf(type, x, z, rotDeg);
  const shell = shellObstacles(content, world);
  const others: Obstacle[] = [];
  for (const g of world.furniture) {
    const t = content.furniture.get(g.type);
    if (g.id === f.id || t?.blocks !== true || g.y > 0.05) continue;
    others.push(footprintOf(t, g.x, g.z, g.rotDeg));
  }
  for (const o of shell) if (overlaps(fp, o)) return false;
  for (const o of others) if (overlaps(fp, o)) return false;
  const r = content.settings.player.radius;
  for (const h of handlesOf(content, f, x, z, rotDeg)) {
    for (const o of shell) if (distanceTo(h.x, h.z, o) < r - 0.02) return false;
    for (const o of others) if (distanceTo(h.x, h.z, o) < r - 0.02) return false;
  }
  return true;
}

/** Place chaque porteur à sa poignée. */
export function snapCarriers(content: Content, world: World, f: PlacedFurniture): void {
  const carry = world.arrangement.carry;
  if (carry === null) return;
  const handles = handlesOf(content, f);
  for (const i of [0, 1] as const) {
    const side = carry.handles[i];
    if (side === null) continue;
    const h = handles[side];
    world.players[i].x = h.x;
    world.players[i].z = h.z;
  }
}

/** Un pas de port, chez l'hôte: seulement quand les deux tiennent la charge. */
export function stepCarry(
  content: Content,
  world: World,
  inputs: readonly [StepInput, StepInput],
  dt: number,
): void {
  const carry = world.arrangement.carry;
  const f = carriedFurniture(world);
  if (carry === null || f === undefined) return;
  if (carry.handles[0] === null || carry.handles[1] === null) {
    snapCarriers(content, world, f);
    return;
  }
  const max = content.arrangement.carry.maxSpeed;
  const a = wish(world.players[0], inputs[0], max);
  const b = wish(world.players[1], inputs[1], max);
  let vx = (a.x + b.x) / 2;
  let vz = (a.z + b.z) / 2;
  const speed = Math.hypot(vx, vz);
  if (speed > max) {
    vx = (vx / speed) * max;
    vz = (vz / speed) * max;
  }
  if (speed > 1e-6) {
    const nx = f.x + vx * dt;
    const nz = f.z + vz * dt;
    // Contre un mur, la charge glisse le long de lui plutôt que de s'arrêter net.
    if (poseFree(content, world, f, nx, nz, f.rotDeg)) {
      f.x = nx;
      f.z = nz;
    } else if (poseFree(content, world, f, nx, f.z, f.rotDeg)) f.x = nx;
    else if (poseFree(content, world, f, f.x, nz, f.rotDeg)) f.z = nz;
  }
  snapCarriers(content, world, f);
}

/** Tourne la charge d'un pas autour de son centre, si rien ne gêne. */
export function turnCarry(content: Content, world: World, dir: -1 | 1, stepDeg: number): boolean {
  const f = carriedFurniture(world);
  if (f === undefined) return false;
  const rot = (((f.rotDeg + dir * stepDeg) % 360) + 360) % 360;
  if (!poseFree(content, world, f, f.x, f.z, rot)) return false;
  f.rotDeg = rot;
  snapCarriers(content, world, f);
  return true;
}

export function carrierCount(world: World): number {
  const carry = world.arrangement.carry;
  if (carry === null) return 0;
  return (carry.handles[0] === null ? 0 : 1) + (carry.handles[1] === null ? 0 : 1);
}

export function otherPlayer(p: PlayerIndex): PlayerIndex {
  return p === 0 ? 1 : 0;
}
