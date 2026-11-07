/**
 * Pas d'un avatar: même fonction chez l'hôte et pour la prédiction de l'invité (technique 5.2).
 * Seuls obstacles: la coque et les meubles, connus des deux machines; aucun joueur ni
 * personnage ne bloque un joueur (C15), donc la prédiction ne se trompe pas.
 */
import type { Content } from '../donnees/charger';
import type { PlayerState, World } from '../etat/monde';
import type { StepInput } from './entrees';
import { furnitureObstacles, shellObstacles } from './collisions';
import { pushOut, type Vec2 } from './geometrie';
import { isCarrying } from '../amenagement/port';

const scratch: Vec2 = { x: 0, z: 0 };

export function applyLook(player: PlayerState, input: StepInput, content: Content): void {
  const limit = content.settings.player.pitchLimitDeg;
  player.yawDeg = ((input.yawDeg % 360) + 360) % 360;
  player.pitchDeg = Math.max(-limit, Math.min(limit, input.pitchDeg));
}

export function walk(
  content: Content,
  world: World,
  player: PlayerState,
  input: StepInput,
  dt: number,
): void {
  applyLook(player, input, content);
  // Port à deux: la charge mène les deux porteurs (chez l'hôte), rien à prédire (technique 5.7).
  if (isCarrying(world, player)) return;
  const len = Math.hypot(input.moveX, input.moveZ);
  if (len === 0) return;
  const speed = input.fast ? content.settings.player.fastSpeed : content.settings.player.walkSpeed;
  const yaw = (player.yawDeg * Math.PI) / 180;
  // Avant: (-sin, -cos); droite: (cos, -sin) (caméra Three.js qui regarde vers -z à cap nul).
  const f = input.moveZ / Math.max(1, len);
  const s = input.moveX / Math.max(1, len);
  scratch.x = player.x + (-Math.sin(yaw) * f + Math.cos(yaw) * s) * speed * dt;
  scratch.z = player.z + (-Math.cos(yaw) * f - Math.sin(yaw) * s) * speed * dt;
  resolve(content, world, scratch);
  player.x = scratch.x;
  player.z = scratch.z;
}

/** Repousse un point hors des obstacles (trois passes suffisent aux coins de la coque). */
export function resolve(content: Content, world: World, p: Vec2): void {
  const r = content.settings.player.radius;
  const shell = shellObstacles(content, world);
  const furniture = furnitureObstacles(content, world);
  for (let pass = 0; pass < 3; pass++) {
    let touched = false;
    for (const o of shell) touched = pushOut(p, r, o) || touched;
    for (const o of furniture) touched = pushOut(p, r, o) || touched;
    if (!touched) return;
  }
}
