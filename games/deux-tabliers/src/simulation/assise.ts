/**
 * Avatars assis: « Agir » sur une assise libre (mains vides) assoit l'avatar sur l'assise
 * déclarée du meuble, tourné comme elle (face à sa table); un pas le relève, à côté de l'assise
 * et jamais à travers la table. Même code chez l'hôte et pour la prédiction de l'invité.
 */
import type { Content } from '../donnees/charger';
import { approachCandidates, seatAnchor } from '../etat/assises';
import type { PlayerIndex, PlayerState, World } from '../etat/monde';
import { resolve } from './deplacement';
import type { Vec2 } from './geometrie';

/** Assise prise par un client ou par l'autre joueur. */
export function seatTaken(world: World, furniture: string, except: PlayerIndex | null): boolean {
  if (world.players.some((p, i) => i !== except && p.seat === furniture)) return true;
  return world.clientele.groups.some((g) => g.seats.includes(furniture));
}

/** Hauteur des yeux du joueur (assis: au-dessus de son assise). */
export function eyeHeightOf(content: Content, world: World, player: PlayerIndex): number {
  const id = world.players[player].seat ?? null;
  const f = id === null ? undefined : world.furniture.find((x) => x.id === id);
  if (f === undefined) return content.settings.player.eyeHeight;
  return seatAnchor(content, world.furniture, f).y + content.settings.seating.eyeAboveSeat;
}

export function sitDown(content: Content, world: World, player: PlayerIndex, id: string): void {
  const f = world.furniture.find((x) => x.id === id);
  if (f === undefined) return;
  const a = seatAnchor(content, world.furniture, f);
  const p = world.players[player];
  p.seat = id;
  p.use = null;
  p.x = a.x;
  p.z = a.z;
  p.yawDeg = a.yawDeg;
}

const probe: Vec2 = { x: 0, z: 0 };

/** Relève le joueur: au premier point libre devant, à côté ou derrière l'assise. */
export function standUp(content: Content, world: World, p: PlayerState): void {
  const id = p.seat ?? null;
  p.seat = null;
  const f = id === null ? undefined : world.furniture.find((x) => x.id === id);
  if (f === undefined) return;
  const a = seatAnchor(content, world.furniture, f);
  let bestX = a.x;
  let bestZ = a.z;
  let bestShift = Infinity;
  for (const [x, z] of approachCandidates(a, content.settings.player.radius)) {
    probe.x = x;
    probe.z = z;
    resolve(content, world, probe);
    const shift = Math.hypot(probe.x - x, probe.z - z);
    if (shift < 0.02) {
      p.x = probe.x;
      p.z = probe.z;
      return;
    }
    if (shift < bestShift) {
      bestShift = shift;
      bestX = probe.x;
      bestZ = probe.z;
    }
  }
  p.x = bestX;
  p.z = bestZ;
}
