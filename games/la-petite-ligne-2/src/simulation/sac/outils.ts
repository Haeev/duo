/**
 * Usure des outils (cahier 4.5, R19). Un outil de base (`durability` 0) ne s'use jamais. Un outil
 * amélioré perd un usage par coup; à 0 il est émoussé: toujours utilisable, plus lent, jamais
 * cassé, jusqu'à réparation.
 */
import type { Content } from '../../donnees/charger';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { Stack } from '../../etat/joueur';
import { hasPerk } from '../besoins/repas';
import type { SimContext } from '../noyau/systemes';

export type ToolCondition = 'base' | 'sharp' | 'blunt';

export function toolCondition(content: Content, stack: Stack): ToolCondition | null {
  const tool = content.items[stack.item]?.tool;
  if (tool === undefined || tool === null) return null;
  if (tool.durability === 0) return 'base';
  return (stack.wear ?? tool.durability) > 0 ? 'sharp' : 'blunt';
}

/** Durée d'un coup avec cet outil (s): celle de l'outil en état, ou celle de l'outil émoussé. */
export function toolGestureSeconds(content: Content, stack: Stack): number | null {
  const tool = content.items[stack.item]?.tool;
  if (tool === undefined || tool === null) return null;
  return toolCondition(content, stack) === 'blunt' ? tool.bluntGestureSeconds : tool.gestureSeconds;
}

/** Part d'usure restante, de 0 à 1 (l'arc de l'icône); 1 pour un outil de base. */
export function toolWearRatio(content: Content, stack: Stack): number {
  const durability = content.items[stack.item]?.tool?.durability ?? 0;
  if (durability === 0) return 1;
  return Math.max(0, Math.min(1, (stack.wear ?? durability) / durability));
}

/** Un coup d'outil porté avec la case `slot` de la barre. Appelé par les briques à outil (L2). */
export function wearTool(sim: SimContext, player: PlayerIndex, slot: number): void {
  const stack = sim.world.players[player].toolbar[slot] ?? null;
  if (stack?.wear === undefined || stack.wear === 0) return;
  if (hasPerk(sim.world, player, 'no_tool_wear')) return;
  stack.wear -= 1;
  sim.touch('players');
  if (stack.wear === 0) sim.emit({ type: 'tool_blunt', player, item: stack.item });
}

/** Remet l'outil à neuf; `false` si ce n'est pas un outil amélioré ou s'il est déjà neuf. */
export function repairTool(sim: SimContext, player: PlayerIndex, stack: Stack): boolean {
  const durability = sim.content.items[stack.item]?.tool?.durability ?? 0;
  if (durability === 0 || stack.wear === durability) return false;
  stack.wear = durability;
  sim.touch('players');
  sim.emit({ type: 'tool_repaired', player, item: stack.item });
  return true;
}
