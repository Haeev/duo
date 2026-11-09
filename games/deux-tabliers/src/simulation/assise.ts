/**
 * Avatars assis: « Agir » sur une place libre (mains vides) assoit l'avatar sur cette place du
 * meuble (banquette, banc: la place visée), tourné comme elle (face à sa table); un pas le
 * relève, à côté de l'assise et jamais à travers la table. Même code chez l'hôte et pour la
 * prédiction de l'invité. Une place se nomme comme dans `etat/assises.ts` (`seat-9#1`).
 */
import type { Content } from '../donnees/charger';
import { approachCandidates, placeAnchor } from '../etat/assises';
import type { PlayerIndex, PlayerState, World } from '../etat/monde';
import { resolve } from './deplacement';
import type { Vec2 } from './geometrie';

/** Place prise par un client ou par l'autre joueur. */
export function seatTaken(world: World, place: string, except: PlayerIndex | null): boolean {
  if (world.players.some((p, i) => i !== except && p.seat === place)) return true;
  return world.clientele.groups.some((g) => g.seats.includes(place));
}

/** Hauteur des yeux du joueur (assis: au-dessus de son assise). */
export function eyeHeightOf(content: Content, world: World, player: PlayerIndex): number {
  const id = world.players[player].seat ?? null;
  const a = id === null ? null : placeAnchor(content, world.furniture, id);
  if (a === null) return content.settings.player.eyeHeight;
  return a.y + content.settings.seating.eyeAboveSeat;
}

export function sitDown(content: Content, world: World, player: PlayerIndex, place: string): void {
  const a = placeAnchor(content, world.furniture, place);
  if (a === null) return;
  const p = world.players[player];
  p.seat = place;
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
  const a = id === null ? null : placeAnchor(content, world.furniture, id);
  if (a === null) return;
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
