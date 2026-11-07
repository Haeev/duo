/**
 * Visée: rayon des yeux et aimant (ux 8.3). La cible est la plus proche du point de visée dans
 * un cône de `aim.coneDeg` (la sphère de chaque cible compte), à portée de main. La caméra ne
 * bouge jamais (C22): l'aimant choisit la cible, il ne tourne pas la vue. On préfère une cible
 * où « Agir » ferait quelque chose; sinon la plus proche, pour montrer pourquoi c'est refusé.
 */
import type { Content } from '../donnees/charger';
import type { PlayerIndex, World } from '../etat/monde';
import type { Target } from './entrees';
import { planAct, type ActPlan } from './interactions';
import { furnitureType, heldObject, objectOnSlot, objectPosition, slotPosition } from './monde';

export interface Aim {
  readonly target: Target;
  readonly plan: ActPlan;
  /** Point visé, pour l'anneau de visée et l'aide de pose. */
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface Eye {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yawDeg: number;
  readonly pitchDeg: number;
}

export function eyeOf(content: Content, world: World, player: PlayerIndex): Eye {
  const p = world.players[player];
  return {
    x: p.x,
    y: content.settings.player.eyeHeight,
    z: p.z,
    yawDeg: p.yawDeg,
    pitchDeg: p.pitchDeg,
  };
}

/** Cible visée depuis `eye` (le regard local, sans attendre la simulation). */
export function aim(content: Content, world: World, player: PlayerIndex, eye: Eye): Aim | null {
  const yaw = (eye.yawDeg * Math.PI) / 180;
  const pitch = (eye.pitchDeg * Math.PI) / 180;
  const dx = -Math.sin(yaw) * Math.cos(pitch);
  const dy = Math.sin(pitch);
  const dz = -Math.cos(yaw) * Math.cos(pitch);
  const { reach } = content.settings.player;
  const cone = (content.settings.aim.coneDeg * Math.PI) / 180;
  const radius = content.settings.aim.targetRadius;
  const holding = heldObject(world, player) !== undefined;

  let best: Aim | null = null;
  let bestScore = Infinity;
  let bestActionable = false;
  const consider = (target: Target, x: number, y: number, z: number, r = radius): void => {
    const vx = x - eye.x;
    const vy = y - eye.y;
    const vz = z - eye.z;
    const dist = Math.hypot(vx, vy, vz);
    if (dist > reach || dist < 1e-6) return;
    const cos = (vx * dx + vy * dy + vz * dz) / dist;
    const angle = Math.acos(Math.max(-1, Math.min(1, cos)));
    const score = angle - Math.atan(r / dist);
    if (score > cone) return;
    const plan = planAct(content, world, player, target);
    const actionable = plan.kind !== 'refuse';
    if ((actionable && !bestActionable) || (actionable === bestActionable && score < bestScore)) {
      best = { target, plan, x, y, z };
      bestScore = score;
      bestActionable = actionable;
    }
  };

  for (const o of world.objects) {
    if (o.at.kind === 'hand') continue;
    const pos = objectPosition(content, world, o);
    const type = content.objects.get(o.type);
    if (pos === null || type === undefined) continue;
    consider(
      { kind: 'object', id: o.id },
      pos.x,
      pos.y + type.size[2] / 2,
      pos.z,
      Math.max(radius, type.size[0] / 2),
    );
  }
  for (const f of world.furniture) {
    const type = furnitureType(content, f);
    if (holding) {
      for (const slot of type.slots) {
        if (objectOnSlot(world, f.id, slot.id) !== undefined) continue;
        const pos = slotPosition(f, slot);
        consider({ kind: 'slot', furniture: f.id, slot: slot.id }, pos.x, pos.y + 0.03, pos.z);
      }
    }
    if (type.source !== null)
      consider({ kind: 'source', furniture: f.id }, f.x, f.y + type.height * 0.7, f.z, 0.12);
    if (type.station !== null) {
      const r = Math.min(type.footprint[0], type.footprint[1]) / 2;
      consider({ kind: 'station', furniture: f.id }, f.x, f.y + type.height * 0.6, f.z, r);
    }
  }
  if (holding) {
    const otherIndex: PlayerIndex = player === 0 ? 1 : 0;
    const q = world.players[otherIndex];
    const close = Math.hypot(q.x - eye.x, q.z - eye.z) <= content.settings.player.giveReach;
    if (close) consider({ kind: 'player', player: otherIndex }, q.x, 1.2, q.z, 0.3);
  }
  return best;
}
