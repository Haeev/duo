/**
 * Lecture des recettes, sans rien modifier: utilisable par l'hôte, l'invité et l'interface.
 * Le moteur ne nomme aucune recette: tout vient de `donnees/commun/recettes/`.
 */
import type { Content } from '../../donnees/charger';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { CookStep, RecipeDef } from '../../donnees/schemas/recette';
import type { PlayerState } from '../../etat/joueur';
import type { DeepReadonly, ReadonlyWorld } from '../../etat/monde';
import { COOKING, type CookingSettings, type Quality } from './reglages';

export type Part = 0 | 1;

export interface Portion {
  readonly item: string;
  readonly count: number;
}

export function recipeKey(recipe: string): string {
  return `${COOKING.memoryPrefix}${recipe}`;
}

/** Connue: dès le début, ou retenue en mémoire (habitant, livre, essai, plat déjà fait). */
export function isKnown(world: ReadonlyWorld, recipe: DeepReadonly<RecipeDef>): boolean {
  if (recipe.known === 'start') return true;
  const fact = world.progress.memory[recipeKey(recipe.id)];
  return fact !== undefined && fact.v !== false;
}

/** Meilleure qualité déjà obtenue, 0 si jamais cuisinée. */
export function bestQuality(world: ReadonlyWorld, recipe: string): 0 | Quality {
  const value = world.progress.memory[recipeKey(recipe)]?.v;
  return value === 1 || value === 2 || value === 3 ? value : 0;
}

/** Repas à deux: deux parts, chacune son poste. */
export function isDuo(recipe: DeepReadonly<RecipeDef>): boolean {
  return recipe.second !== undefined;
}

export interface PartDef {
  readonly station: RecipeDef['station'];
  readonly inputs: readonly Portion[];
  readonly steps: readonly CookStep[];
}

export function partOf(recipe: DeepReadonly<RecipeDef>, part: Part): PartDef | null {
  if (part === 0)
    return { station: recipe.station, inputs: recipe.inputs, steps: recipe.steps ?? [] };
  return recipe.second ?? null;
}

/** Tous les ingrédients de la recette (les deux parts d'un repas à deux). */
export function allInputs(recipe: DeepReadonly<RecipeDef>): readonly Portion[] {
  return [...recipe.inputs, ...(recipe.second?.inputs ?? [])];
}

export function countOf(player: DeepReadonly<PlayerState>, item: string): number {
  let total = 0;
  for (const stack of player.toolbar) if (stack?.item === item) total += stack.count;
  for (const stack of player.bag?.slots ?? []) if (stack?.item === item) total += stack.count;
  return total;
}

export function hasInputs(player: DeepReadonly<PlayerState>, inputs: readonly Portion[]): boolean {
  return inputs.every((portion) => countOf(player, portion.item) >= portion.count);
}

/** Qualité d'après la moyenne des notes (1 à 3): jamais de plat perdu. */
export function qualityOf(grades: readonly number[], settings: CookingSettings = COOKING): Quality {
  if (grades.length === 0) return 1;
  const mean = grades.reduce((sum, grade) => sum + grade, 0) / grades.length;
  if (mean >= settings.perfectFrom) return 3;
  if (mean >= settings.goodFrom) return 2;
  return 1;
}

/** Le plat obtenu à cette qualité. */
export function outputFor(recipe: DeepReadonly<RecipeDef>, quality: Quality): Portion {
  if (quality === 3) return recipe.quality?.perfect ?? recipe.quality?.good ?? recipe.output;
  if (quality === 2) return recipe.quality?.good ?? recipe.output;
  return recipe.output;
}

/** Durée estimée d'une étape (s) à l'allure donnée, sans aide: sert aux bornes et aux tests. */
export function stepSeconds(
  step: DeepReadonly<CookStep>,
  settings: CookingSettings = COOKING,
): number {
  const tuning = settings.steps[step.kind];
  const beat = tuning.beat / (step.pace ?? 1);
  const each = step.kind === 'heat' || step.kind === 'season' ? beat * 0.8 + 0.6 : beat;
  return settings.leadIn + step.count * each;
}

export function partSeconds(steps: readonly DeepReadonly<CookStep>[]): number {
  return steps.reduce((sum, step) => sum + stepSeconds(step), 0);
}

/** Durée estimée du mini-jeu complet (les deux parts enchaînées pour un repas à deux joué seul). */
export function recipeSeconds(recipe: DeepReadonly<RecipeDef>): number {
  return partSeconds(recipe.steps ?? []) + partSeconds(recipe.second?.steps ?? []);
}

/** Recettes à afficher au livre: connues, et celles qu'on peut trouver par essai (en devinette). */
export function bookOf(
  content: Content,
  world: ReadonlyWorld,
): { recipe: RecipeDef; known: boolean }[] {
  return Object.values(content.recipes)
    .filter((recipe) => recipe.station !== 'workbench')
    .map((recipe) => ({ recipe, known: isKnown(world, recipe) }))
    .sort((a, b) => Number(b.known) - Number(a.known) || a.recipe.id.localeCompare(b.recipe.id));
}

/** Joueur de l'autre part. */
export function partner(player: PlayerIndex): PlayerIndex {
  return player === 0 ? 1 : 0;
}
