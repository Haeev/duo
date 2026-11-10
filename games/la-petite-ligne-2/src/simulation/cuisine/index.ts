/**
 * Système « cuisine»: recettes au poste, mini-jeu joué chez le joueur et noté par étape, repas à
 * deux sur deux postes de la même cuisine. L'hôte borne les notes, vérifie les ingrédients au
 * départ et à la fin (quitter ne coûte rien), puis donne le plat. Conception:
 * `docs/jeux/jeu-1/refonte/cuisine.md`.
 *
 * Les préparations en cours ne sont pas sauvegardées ni transmises (elles durent moins d'une
 * minute): elles vivent à côté du monde, chez l'hôte, et l'invité les suit par les événements.
 */
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { RecipeDef } from '../../donnees/schemas/recette';
import type { WorldState } from '../../etat/monde';
import type { Intent } from '../noyau/entrees';
import type { GameSystem, SimContext } from '../noyau/systemes';
import { SIM_DT } from '../noyau/constantes';
import { giveItem } from '../sac/actions';
import { removeItem, stackAt } from '../sac/inventaire';
import { remember } from '../regles/memoire';
import {
  bestQuality,
  hasInputs,
  isKnown,
  outputFor,
  partOf,
  partSeconds,
  qualityOf,
  recipeKey,
  type Part,
} from './recettes';
import { COOKING } from './reglages';

interface Session {
  readonly recipe: string;
  readonly part: Part;
  readonly target: string;
  readonly startTick: number;
  readonly grades: number[];
}

interface PartDone {
  readonly player: PlayerIndex;
  readonly target: string;
  readonly grades: readonly number[];
}

interface Kitchen {
  readonly cooks: [Session | null, Session | null];
  /** Parts finies d'un repas à deux, par recette, en attente de l'autre. */
  readonly done: Map<string, [PartDone | null, PartDone | null]>;
}

const kitchens = new WeakMap<WorldState, Kitchen>();

function kitchenOf(world: WorldState): Kitchen {
  let kitchen = kitchens.get(world);
  if (kitchen === undefined) {
    kitchen = { cooks: [null, null], done: new Map() };
    kitchens.set(world, kitchen);
  }
  return kitchen;
}

/** Préparation en cours d'un joueur (lecture pour les tests et l'outillage de l'hôte). */
export function cookingOf(world: WorldState, player: PlayerIndex): Readonly<Session> | null {
  return kitchens.get(world)?.cooks[player] ?? null;
}

interface Station {
  readonly station: RecipeDef['station'];
  readonly x: number;
  readonly y: number;
}

/** Le poste d'une instance du lieu courant (carte ou posée), s'il déclare la brique `cook`. */
function stationAt(sim: SimContext, target: string): Station | null {
  const place = sim.world.common.place;
  const instance =
    sim.content.places[place]?.map.objects.find((object) => object.id === target) ??
    sim.world.places[place]?.placed.find((prop) => prop.id === target);
  if (instance === undefined) return null;
  const brick = sim.content.props[instance.type]?.bricks.find((b) => b.brick === 'cook');
  return brick?.brick === 'cook' ? { station: brick.station, x: instance.x, y: instance.y } : null;
}

function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

function refuse(sim: SimContext, player: PlayerIndex, reason: string, target: string | null): void {
  sim.emit({ type: 'refused', player, reason, target });
}

/** La part libre d'une recette: la première si personne ne l'a prise, sinon la seconde. */
function freePart(kitchen: Kitchen, recipe: RecipeDef): Part | null {
  const done = kitchen.done.get(recipe.id) ?? [null, null];
  const taken = (part: Part): boolean =>
    done[part] !== null || kitchen.cooks.some((s) => s?.recipe === recipe.id && s.part === part);
  if (!taken(0)) return 0;
  if (recipe.second !== undefined && !taken(1)) return 1;
  return null;
}

/** Cible de la première part (en cours ou finie), pour vérifier que la seconde est dans la même cuisine. */
function firstPartTarget(kitchen: Kitchen, recipe: string): string | null {
  const done = kitchen.done.get(recipe)?.[0];
  if (done !== undefined && done !== null) return done.target;
  return kitchen.cooks.find((s) => s?.recipe === recipe && s.part === 0)?.target ?? null;
}

function start(sim: SimContext, player: PlayerIndex, target: string, id: string): void {
  const kitchen = kitchenOf(sim.world);
  const recipe = sim.content.recipes[id];
  const station = stationAt(sim, target);
  const body = sim.world.players[player].body;
  if (recipe === undefined || station === null) {
    refuse(sim, player, 'cannot-cook', target);
    return;
  }
  if (kitchen.cooks[player] !== null) {
    refuse(sim, player, 'already-cooking', target);
    return;
  }
  if (distance(body.x, body.y, station.x, station.y) > COOKING.reach) {
    refuse(sim, player, 'too-far', target);
    return;
  }
  const part = freePart(kitchen, recipe);
  if (part === null) {
    refuse(sim, player, 'meal-busy', target);
    return;
  }
  if (part === 0 && !isKnown(sim.world, recipe) && recipe.learn?.trial !== true) {
    refuse(sim, player, 'recipe-unknown', target);
    return;
  }
  const def = partOf(recipe, part);
  if (def?.station !== station.station) {
    refuse(sim, player, 'wrong-station', target);
    return;
  }
  if (part === 1) {
    const first = firstPartTarget(kitchen, recipe.id);
    const at = first === null ? null : stationAt(sim, first);
    if (at === null || distance(at.x, at.y, station.x, station.y) > COOKING.kitchenRadius) {
      refuse(sim, player, 'other-kitchen', target);
      return;
    }
  }
  if (!hasInputs(sim.world.players[player], def.inputs)) {
    refuse(sim, player, 'missing-ingredients', target);
    return;
  }
  if (def.steps.length === 0) {
    finishDish(sim, recipe, [{ player, target, grades: [] }], player);
    return;
  }
  kitchen.cooks[player] = {
    recipe: recipe.id,
    part,
    target,
    startTick: sim.world.tick,
    grades: [],
  };
  const seed = sim.random.int(0, 0x7fffffff);
  sim.emit({ type: 'cook_started', player, recipe: recipe.id, part, target, seed });
}

/** L'étape `after` de la première part est-elle faite ? */
function firstStepDone(kitchen: Kitchen, recipe: string, after: number): boolean {
  const done = kitchen.done.get(recipe)?.[0];
  if (done !== undefined && done !== null) return true;
  const session = kitchen.cooks.find((s) => s?.recipe === recipe && s.part === 0);
  return (session?.grades.length ?? 0) > after;
}

function stepDone(sim: SimContext, player: PlayerIndex, grade: number): void {
  const kitchen = kitchenOf(sim.world);
  const session = kitchen.cooks[player];
  const recipe = session === null ? undefined : sim.content.recipes[session.recipe];
  const def = session === null || recipe === undefined ? null : partOf(recipe, session.part);
  if (session === null || recipe === undefined || def === null) return;
  const index = session.grades.length;
  const step = def.steps[index];
  if (step === undefined) return;
  let bounded = Math.max(1, Math.min(3, Math.round(grade)));
  const early =
    session.part === 1 &&
    step.after !== undefined &&
    !firstStepDone(kitchen, session.recipe, step.after);
  if (early) bounded = Math.max(1, bounded - 1);
  session.grades.push(bounded);
  sim.emit({
    type: 'cook_step_done',
    player,
    recipe: session.recipe,
    part: session.part,
    step: index,
    grade: bounded,
    early,
  });
  if (session.grades.length < def.steps.length) return;
  kitchen.cooks[player] = null;
  const elapsed = (sim.world.tick - session.startTick) * SIM_DT;
  if (elapsed < COOKING.minFraction * partSeconds(def.steps)) {
    refuse(sim, player, 'too-fast', session.target);
    return;
  }
  const finished: PartDone = { player, target: session.target, grades: session.grades };
  if (recipe.second === undefined) {
    finishDish(sim, recipe, [finished], player);
    return;
  }
  const done = kitchen.done.get(recipe.id) ?? [null, null];
  done[session.part] = finished;
  kitchen.done.set(recipe.id, done);
  const [first, second] = done;
  if (first === null || second === null) {
    sim.emit({ type: 'cook_part_done', player, recipe: recipe.id, part: session.part });
    return;
  }
  kitchen.done.delete(recipe.id);
  finishDish(sim, recipe, [first, second], player);
}

/** Retire les ingrédients de chaque part chez qui l'a faite, donne le plat à `receiver`. */
function finishDish(
  sim: SimContext,
  recipe: RecipeDef,
  parts: readonly PartDone[],
  receiver: PlayerIndex,
): void {
  const inputsOf = (index: number): readonly { item: string; count: number }[] =>
    partOf(recipe, index === 0 ? 0 : 1)?.inputs ?? [];
  const missing = parts.some(
    (done, index) => !hasInputs(sim.world.players[done.player], inputsOf(index)),
  );
  if (missing) {
    refuse(sim, receiver, 'missing-ingredients', parts[0]?.target ?? null);
    return;
  }
  parts.forEach((done, index) => {
    for (const portion of inputsOf(index))
      removeItem(sim.world.players[done.player], portion.item, portion.count);
  });
  const quality = qualityOf(parts.flatMap((done) => done.grades));
  const wasKnown = isKnown(sim.world, recipe);
  const best = bestQuality(sim.world, recipe.id);
  const first = best === 0;
  const shared = new Set(parts.map((done) => done.player)).size > 1;
  remember(sim, recipeKey(recipe.id), Math.max(best, quality), shared ? 'duo' : receiver);
  if (!wasKnown)
    sim.emit({ type: 'recipe_learned', player: receiver, recipe: recipe.id, how: 'trial' });
  const portion = outputFor(recipe, quality);
  giveItem(sim, receiver, portion.item, portion.count);
  sim.touch('players');
  for (const player of new Set([receiver, ...parts.map((done) => done.player)]))
    sim.emit({
      type: 'dish_cooked',
      player,
      recipe: recipe.id,
      quality,
      item: portion.item,
      count: portion.count,
      first,
      shared,
    });
}

function cancel(sim: SimContext, player: PlayerIndex): void {
  const kitchen = kitchenOf(sim.world);
  const session = kitchen.cooks[player];
  if (session === null) return;
  kitchen.cooks[player] = null;
  sim.emit({ type: 'cook_cancelled', player, recipe: session.recipe });
}

function read(
  sim: SimContext,
  player: PlayerIndex,
  intent: Extract<Intent, { type: 'cook_read' }>,
): void {
  const stack = stackAt(sim.world.players[player], intent.from);
  let learned = 0;
  for (const recipe of Object.values(sim.content.recipes)) {
    if (stack === null || recipe.learn?.book !== stack.item || isKnown(sim.world, recipe)) continue;
    remember(sim, recipeKey(recipe.id), 0, 'duo');
    sim.emit({ type: 'recipe_learned', player, recipe: recipe.id, how: 'book' });
    learned += 1;
  }
  if (learned === 0) refuse(sim, player, 'nothing-to-learn', null);
}

function onIntent(sim: SimContext, player: PlayerIndex, intent: Intent): void {
  if (intent.type === 'cook_start') start(sim, player, intent.target, intent.recipe);
  else if (intent.type === 'cook_step') stepDone(sim, player, intent.grade);
  else if (intent.type === 'cook_cancel') cancel(sim, player);
  else if (intent.type === 'cook_read') read(sim, player, intent);
}

/** S'éloigner du poste arrête la préparation (rien n'est perdu). */
function stepKitchen(sim: SimContext): void {
  const kitchen = kitchens.get(sim.world);
  if (kitchen === undefined) return;
  for (const player of [0, 1] as const) {
    const session = kitchen.cooks[player];
    if (session === null) continue;
    const station = stationAt(sim, session.target);
    const body = sim.world.players[player].body;
    if (station === null || distance(body.x, body.y, station.x, station.y) > COOKING.reach * 1.5)
      cancel(sim, player);
  }
}

export const cookingSystem: GameSystem = {
  id: 'cuisine',
  intent: onIntent,
  step: stepKitchen,
};
