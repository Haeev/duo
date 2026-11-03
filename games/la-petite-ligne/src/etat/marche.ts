/**
 * Le marché du dimanche (0.12, section 2.3 de `v0-12-conception.md`), partie pure: où est l'étal,
 * où se tiennent les deux clients de la file et le vendeur, combien de cases, à quel prix.
 * Lue par la simulation (`simulation/marche.ts`) et par l'interface.
 */
import type { GameMap } from './carte';
import type { Content } from '../donnees/types';
import type { MarketLevel } from '../donnees/marche';
import type { ItemStack, Quality, ReadonlyWorld, Vec2 } from './types';

/** Pose de l'étal: centre, direction vers les clients (unitaire) et le long de la planche. */
export interface StallPose {
  centre: Vec2;
  front: Vec2;
  along: Vec2;
}

export function stallPose(content: Content, map: GameMap): StallPose | null {
  const m = content.market;
  if (m === null) return null;
  const own = map.points[m.stall.point];
  const base = own ?? map.points[m.stall.fallbackPoint];
  if (base === undefined) return null;
  const [dx, dy] = own === undefined ? m.stall.fallbackOffset : [0, 0];
  // Cap en degrés comme les chantiers (0 nord, 90 est): `front` part vers les clients.
  const rad = (m.stall.facing * Math.PI) / 180;
  const front = { x: Math.sin(rad), y: -Math.cos(rad) };
  return { centre: { x: base.x + dx, y: base.y + dy }, front, along: { x: -front.y, y: front.x } };
}

/** Place du client `spot` (0 ou 1) devant l'étal, à un mètre de la planche. */
export function buyerSpot(pose: StallPose, spot: number): Vec2 {
  const side = spot === 0 ? -0.5 : 0.5;
  return {
    x: pose.centre.x + pose.front.x * 1.1 + pose.along.x * side,
    y: pose.centre.y + pose.front.y * 1.1 + pose.along.y * side,
  };
}

/** Où se tient le vendeur: derrière la planche, au milieu. */
export function sellerSpot(pose: StallPose): Vec2 {
  return { x: pose.centre.x - pose.front.x * 0.9, y: pose.centre.y - pose.front.y * 0.9 };
}

/** Un joueur est derrière l'étal (il peut servir). */
export function behindStall(content: Content, map: GameMap, pos: Vec2): boolean {
  const pose = stallPose(content, map);
  const m = content.market;
  if (pose === null || m === null) return false;
  const at = sellerSpot(pose);
  return Math.hypot(pos.x - at.x, pos.y - at.y) <= m.serveRange;
}

/** Assez près de l'étal pour le garnir (de n'importe quel côté). */
export function nearStall(content: Content, map: GameMap, pos: Vec2): boolean {
  const pose = stallPose(content, map);
  const m = content.market;
  if (pose === null || m === null) return false;
  return Math.hypot(pos.x - pose.centre.x, pos.y - pose.centre.y) <= m.stallRange;
}

/** L'étal est posé sur la place (quête `market_stall` finie). */
export function stallSetUp(content: Content, world: Pick<ReadonlyWorld, 'flags'>): boolean {
  return content.market !== null && world.flags.includes(content.market.enabledFlag);
}

export function stallSlots(content: Content, world: Pick<ReadonlyWorld, 'flags'>): number {
  const m = content.market;
  if (m === null) return 0;
  return world.flags.includes(m.cratesFlag) ? m.slotsWithCrates : m.slots;
}

/** Prix d'une unité à l'étal: `sellPrice x qualité x facteur du niveau` (on vend soi-même: ni taux d'Odette ni offre). */
export function stallUnitPrice(
  content: Content,
  item: string,
  quality: Quality,
  level: MarketLevel,
): number {
  const def = content.items[item];
  const m = content.market;
  if (def?.sellPrice === null || def === undefined || m === null) return 0;
  return Math.max(
    1,
    Math.round(def.sellPrice * content.qualities[quality].priceMultiplier * m.levels[level].factor),
  );
}

/** Unités d'un article sur l'étal, toutes qualités. */
export function onStall(stall: readonly ItemStack[], item: string): number {
  return stall.reduce((n, s) => (s.item === item ? n + s.count : n), 0);
}
