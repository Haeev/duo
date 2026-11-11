/**
 * Récompenses d'histoire qui ne sont ni un objet ni de l'argent (cahier 4.9): une recette, un
 * plan d'artisanat, une entrée de collection, une pièce de tenue. Effets déclarés dans les
 * données (`give_recipe`, `give_plan`, `give_entry`, `give_piece` de `schemas/regles.ts`), pour
 * une étape de quête, une scène ou une option de dialogue. Tout s'écrit dans la progression, que
 * l'invité reçoit telle quelle; l'annonce part en événement `reward_given` (l'entrée de
 * collection garde la sienne: `collection_found`). Recettes, plans et collections sont au duo;
 * les tenues sont à chacun (cahier 2.1 et 5: « sac, tenues, cœurs et réglages sont propres à
 * chaque joueur »): une pièce gagnée ou achetée n'entre que dans la garde-robe de qui la reçoit.
 */
import type { Catalogue, Look, PieceDef } from '../../donnees/schemas/personnage';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { DeepReadonly, ReadonlyWorld } from '../../etat/monde';
import { recordFind } from '../collections/registre';
import { isKnown, recipeKey } from '../cuisine/recettes';
import { isPlanKnown, planKey } from '../fabrication/plans';
import type { SimContext } from '../noyau/systemes';
import { playerFactKey, remember } from './memoire';

/** Réglages de la garde-robe gagnée, en attente de leur place dans `reglages.json`. */
export const WARDROBE = {
  /** Étiquette d'une pièce du catalogue qui se gagne: cachée dans l'éditeur tant qu'elle n'est pas donnée. */
  lockedTag: 'a-gagner',
  /**
   * Fait retenu quand un joueur a la pièce: `garde-robe.piece.<id>.j<n>`. Sans suffixe (ancienne
   * garde-robe commune, avant le 2026-11-11), la pièce est aux deux: aucune migration.
   */
  memoryPrefix: 'garde-robe.piece.',
} as const;

/** Clé du fait « pièce gagnée »: celle de ce joueur, ou sans `player` l'ancienne clé commune. */
export function pieceKey(piece: string, player?: PlayerIndex): string {
  const key = `${WARDROBE.memoryPrefix}${piece}`;
  return player === undefined ? key : playerFactKey(key, player);
}

/** Ce joueur a gagné ou acheté cette pièce (ou le duo l'avait, ancienne garde-robe commune). */
export function hasPiece(world: ReadonlyWorld, piece: string, player: PlayerIndex): boolean {
  const memory = world.progress.memory;
  return memory[pieceKey(piece, player)] !== undefined || memory[pieceKey(piece)] !== undefined;
}

/** Cette pièce se porte-t-elle ? Toujours, sauf une pièce à gagner que ce joueur n'a pas encore. */
export function isPieceOwned(
  world: ReadonlyWorld,
  piece: DeepReadonly<PieceDef>,
  player: PlayerIndex,
): boolean {
  return !piece.tags.includes(WARDROBE.lockedTag) || hasPiece(world, piece.id, player);
}

/** Le catalogue tel que ce joueur peut s'en servir: sans les pièces à gagner qu'il n'a pas. */
export function wardrobeOf(
  catalogue: Catalogue,
  world: ReadonlyWorld,
  player: PlayerIndex,
): Catalogue {
  const pieces = catalogue.pieces.filter((piece) => isPieceOwned(world, piece, player));
  return pieces.length === catalogue.pieces.length ? catalogue : { ...catalogue, pieces };
}

/** Première pièce de cette apparence que ce joueur n'a pas, `null` si tout se porte. */
export function lockedPieceOf(
  world: ReadonlyWorld,
  pieces: Readonly<Record<string, DeepReadonly<PieceDef>>>,
  look: DeepReadonly<Look>,
  player: PlayerIndex,
): string | null {
  for (const worn of look.pieces) {
    const def = pieces[worn.id];
    if (def !== undefined && !isPieceOwned(world, def, player)) return worn.id;
  }
  return null;
}

export type RewardKind = 'recipe' | 'plan' | 'piece';

function announce(sim: SimContext, by: PlayerIndex, kind: RewardKind, id: string): void {
  sim.emit({ type: 'reward_given', by, kind, id });
}

/** Apprend la recette au duo. Déjà connue: rien, pas d'annonce. */
export function giveRecipe(sim: SimContext, by: PlayerIndex, id: string): void {
  const recipe = sim.content.recipes[id];
  if (recipe === undefined || isKnown(sim.world, recipe)) return;
  if (remember(sim, recipeKey(id), 0, 'duo')) announce(sim, by, 'recipe', id);
}

/** Apprend le plan d'artisanat au duo. Déjà connu: rien. */
export function givePlan(sim: SimContext, by: PlayerIndex, id: string): void {
  const plan = sim.content.plans[id];
  if (plan === undefined || isPlanKnown(sim.world, plan)) return;
  if (remember(sim, planKey(id), 0, 'duo')) announce(sim, by, 'plan', id);
}

/** Inscrit l'entrée au carnet des collections, au nom de celui qui agit (une seule fois). */
export function giveEntry(sim: SimContext, by: PlayerIndex, id: string): void {
  if (sim.world.progress.album?.f[id] !== undefined) return;
  recordFind(sim, by, id);
}

/**
 * Ajoute la pièce de tenue à la garde-robe de ce joueur (l'éditeur, le miroir et l'onglet Tenues
 * la proposent); l'annonce `reward_given` porte son index dans `by`. Déjà à lui: rien, pas
 * d'annonce. Rend `true` si la pièce vient d'entrer.
 */
export function givePiece(sim: SimContext, to: PlayerIndex, id: string): boolean {
  if (sim.content.pieces[id] === undefined || hasPiece(sim.world, id, to)) return false;
  if (!remember(sim, pieceKey(id, to), true, to)) return false;
  announce(sim, to, 'piece', id);
  return true;
}
