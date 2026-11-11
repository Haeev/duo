/**
 * Récompenses d'histoire qui ne sont ni un objet ni de l'argent (cahier 4.9): une recette, un
 * plan d'artisanat, une entrée de collection, une pièce de tenue. Effets déclarés dans les
 * données (`give_recipe`, `give_plan`, `give_entry`, `give_piece` de `schemas/regles.ts`), pour
 * une étape de quête, une scène ou une option de dialogue. Tout s'écrit dans la progression
 * commune au duo, que l'invité reçoit telle quelle; l'annonce part en événement `reward_given`
 * (l'entrée de collection garde la sienne: `collection_found`).
 */
import type { Catalogue, Look, PieceDef } from '../../donnees/schemas/personnage';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { DeepReadonly, ReadonlyWorld } from '../../etat/monde';
import { recordFind } from '../collections/registre';
import { isKnown, recipeKey } from '../cuisine/recettes';
import { isPlanKnown, planKey } from '../fabrication/plans';
import type { SimContext } from '../noyau/systemes';
import { remember } from './memoire';

/** Réglages de la garde-robe gagnée, en attente de leur place dans `reglages.json`. */
export const WARDROBE = {
  /** Étiquette d'une pièce du catalogue qui se gagne: cachée dans l'éditeur tant qu'elle n'est pas donnée. */
  lockedTag: 'a-gagner',
  /** Fait retenu quand le duo a gagné la pièce: `garde-robe.piece.<id>`. */
  memoryPrefix: 'garde-robe.piece.',
} as const;

export function pieceKey(piece: string): string {
  return `${WARDROBE.memoryPrefix}${piece}`;
}

/** Cette pièce se porte-t-elle ? Toujours, sauf une pièce à gagner que le duo n'a pas encore. */
export function isPieceOwned(world: ReadonlyWorld, piece: DeepReadonly<PieceDef>): boolean {
  if (!piece.tags.includes(WARDROBE.lockedTag)) return true;
  return world.progress.memory[pieceKey(piece.id)] !== undefined;
}

/** Le catalogue tel que le duo peut s'en servir: sans les pièces à gagner pas encore gagnées. */
export function wardrobeOf(catalogue: Catalogue, world: ReadonlyWorld): Catalogue {
  const pieces = catalogue.pieces.filter((piece) => isPieceOwned(world, piece));
  return pieces.length === catalogue.pieces.length ? catalogue : { ...catalogue, pieces };
}

/** Première pièce de cette apparence que le duo n'a pas gagnée, `null` si tout se porte. */
export function lockedPieceOf(
  world: ReadonlyWorld,
  pieces: Readonly<Record<string, DeepReadonly<PieceDef>>>,
  look: DeepReadonly<Look>,
): string | null {
  for (const worn of look.pieces) {
    const def = pieces[worn.id];
    if (def !== undefined && !isPieceOwned(world, def)) return worn.id;
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

/** Ajoute la pièce de tenue à la garde-robe du duo (l'éditeur et le miroir la proposent). */
export function givePiece(sim: SimContext, by: PlayerIndex, id: string): void {
  if (sim.world.progress.memory[pieceKey(id)] !== undefined) return;
  if (remember(sim, pieceKey(id), true, 'duo')) announce(sim, by, 'piece', id);
}
