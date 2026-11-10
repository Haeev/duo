/** Outil en main et cône devant le personnage: commun au filet et à l'appareil photo. */
import type { Content } from '../../donnees/charger';
import type { ToolKindSchema } from '../../donnees/schemas/briques';
import type { Body, PlayerState } from '../../etat/joueur';
import type { DeepReadonly } from '../../etat/monde';
import type * as v from 'valibot';

export function heldToolKind(
  content: Content,
  player: DeepReadonly<PlayerState>,
): v.InferOutput<typeof ToolKindSchema> | null {
  if (player.selected === null) return null;
  const stack = player.toolbar[player.selected];
  if (stack === null || stack === undefined) return null;
  return content.items[stack.item]?.tool?.kind ?? null;
}

/** Distance au point s'il est à portée et dans le cône du regard, sinon `null`. */
export function inCone(
  body: DeepReadonly<Body>,
  x: number,
  y: number,
  reach: number,
  halfAngleDeg: number,
): number | null {
  const dx = x - body.x;
  const dy = y - body.y;
  const distance = Math.hypot(dx, dy);
  if (distance > reach) return null;
  if (distance < 1e-6) return 0;
  let diff = Math.atan2(dy, dx) - body.facing;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  return Math.abs(diff) <= (halfAngleDeg * Math.PI) / 180 ? distance : null;
}

/** Écart (radians) entre le regard et le point. */
export function offAxis(body: DeepReadonly<Body>, x: number, y: number): number {
  const diff = Math.atan2(y - body.y, x - body.x) - body.facing;
  return Math.abs(Math.atan2(Math.sin(diff), Math.cos(diff)));
}
