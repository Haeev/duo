/**
 * L'outil en main et ce que vaut un coup (cahier 4.5): niveau, points de travail, cases par
 * coup, durée du geste avec le bonus des besoins (`toolSpeed`). Lecture pure (`Look`), sauf
 * `strike` qui porte le coup: usure, effort, saleté.
 */
import type { TOOL_KINDS } from '../../donnees/schemas/briques';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { ItemDef } from '../../donnees/schemas/objets';
import type { DeepReadonly } from '../../etat/monde';
import type { Stack } from '../../etat/joueur';
import type { Look } from '../briques/types';
import { modifiersOf, neutralModifiers } from '../besoins/jauges';
import { relieveNeed, soil } from '../besoins/soins';
import type { SimContext } from '../noyau/systemes';
import { wearTool } from '../sac/outils';

type ToolDef = NonNullable<ItemDef['tool']>;
type ToolKind = (typeof TOOL_KINDS)[number];

/** L'objet tenu: sa case de la barre, sa pile, sa fiche, et sa fiche d'outil s'il en est un. */
export interface Held {
  readonly slot: number;
  readonly stack: DeepReadonly<Stack>;
  readonly item: ItemDef;
  readonly tool: ToolDef | null;
}

export function heldOf(look: Look, player: PlayerIndex): Held | null {
  const actor = look.world.players[player];
  if (actor.selected === null) return null;
  const stack = actor.toolbar[actor.selected] ?? null;
  const item = stack === null ? undefined : look.content.items[stack.item];
  if (stack === null || item === undefined) return null;
  return { slot: actor.selected, stack, item, tool: item.tool };
}

/** L'outil de cette sorte tenu en main, `null` sinon. */
export function heldTool(look: Look, player: PlayerIndex, kind: ToolKind): Held | null {
  const held = heldOf(look, player);
  return held?.tool?.kind === kind ? held : null;
}

/** Émoussé: amélioré et à 0 d'usure (toujours utilisable, plus lent). */
export function isBlunt(held: Held): boolean {
  if (held.tool === null || held.tool.durability === 0) return false;
  return (held.stack.wear ?? held.tool.durability) <= 0;
}

export function tierOf(held: Held): number {
  return held.tool?.work?.tier ?? 0;
}

/** Points de travail d'un coup (sans fiche `work`: 1). */
export function powerOf(held: Held): number {
  const work = held.tool?.work;
  if (work === undefined) return 1;
  return isBlunt(held) ? work.bluntPower : work.power;
}

/** Cases du potager traitées d'un coup. */
export function cellsOf(held: Held): number {
  const work = held.tool?.work;
  if (work === undefined) return 1;
  return isBlunt(held) ? work.bluntCells : work.cells;
}

/** Durée d'un coup (s): celle de l'outil (ou `bare` à mains nues), divisée par `toolSpeed`. */
export function strokeSeconds(
  look: Look,
  player: PlayerIndex,
  held: Held | null,
  bare: number,
): number {
  const tool = held?.tool ?? null;
  if (held === null || tool === null) return bare;
  const base = isBlunt(held) ? tool.bluntGestureSeconds : tool.gestureSeconds;
  const speed = modifiersOf(look.content, look.world, player, scratch).toolSpeed;
  return base / Math.max(0.25, speed);
}

const scratch = neutralModifiers();

/** Modificateurs des besoins de ce joueur, lus dans un objet réutilisé (pas d'allocation par coup). */
export function luckOf(look: Look, player: PlayerIndex): { rareLuck: number; extraCatch: number } {
  const mods = modifiersOf(look.content, look.world, player, scratch);
  return { rareLuck: mods.rareLuck, extraCatch: mods.extraCatch };
}

/**
 * Porte un coup: usure de l'outil amélioré (case `slot`, `null` sans outil), faim de l'effort,
 * saleté d'un geste salissant. L'effort du geste lui-même (faim qui baisse plus vite pendant
 * le geste) est déjà compté par le système des besoins.
 */
export function strike(
  sim: SimContext,
  player: PlayerIndex,
  slot: number | null,
  effort: number,
  dirty: boolean,
): void {
  if (slot !== null) wearTool(sim, player, slot);
  if (effort > 0) relieveNeed(sim, player, 'hunger', -effort);
  if (dirty) soil(sim, player);
}
