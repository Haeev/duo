/** Ce que chaque joueur fournit à un pas: ses commandes tenues et ses intentions. */
import * as v from 'valibot';
import { FiniteSchema, IntSchema } from '../../donnees/schemas/communs';
import { NEEDS_INTENTS } from '../besoins/intentions';
import { COLLECTION_INTENTS } from '../collections/intentions';
import { BRICK_INTENTS } from '../briques/intentions';
import { SHOP_INTENTS } from '../commerces/intentions';
import { COOK_INTENTS } from '../cuisine/intentions';
import { CRAFT_INTENTS } from '../fabrication/intentions';
import { DIALOGUE_INTENTS } from '../dialogues/intentions';
import { TOOL_INTENTS } from '../outils/intentions';
import { VILLAGER_INTENTS } from '../habitants/intentions';
import { QUEST_INTENTS } from '../quetes/intentions';
import { BAG_INTENTS } from '../sac/intentions';
import { SCENE_INTENTS } from '../scenes/intentions';
import { TRAVEL_INTENTS } from '../voyage/intentions';
import { CORE_INTENTS } from './intentions';

const Unit = v.pipe(FiniteSchema, v.minValue(-1), v.maxValue(1));

/**
 * Commandes tenues pendant un pas. Le déplacement est déjà dans le repère du monde (x vers l'est,
 * y vers le sud): la caméra de chaque machine le convertit, le réseau et la simulation n'en
 * savent rien.
 */
export const StepInputSchema = v.strictObject({
  /** Numéro de la commande chez son auteur, pour l'accusé de réception et la prédiction. */
  seq: v.pipe(IntSchema, v.minValue(0)),
  moveX: Unit,
  moveY: Unit,
  run: v.boolean(),
  /** Touche d'action tenue (gestes à maintien). */
  act: v.boolean(),
});
export type StepInput = v.InferOutput<typeof StepInputSchema>;

export function idleInput(seq: number): StepInput {
  return { seq, moveX: 0, moveY: 0, run: false, act: false };
}

export const IntentSchema = v.variant('type', [
  ...CORE_INTENTS,
  ...BRICK_INTENTS,
  ...TRAVEL_INTENTS,
  ...NEEDS_INTENTS,
  ...BAG_INTENTS,
  ...SHOP_INTENTS,
  ...DIALOGUE_INTENTS,
  ...TOOL_INTENTS,
  ...VILLAGER_INTENTS,
  ...QUEST_INTENTS,
  ...SCENE_INTENTS,
  ...COOK_INTENTS,
  ...CRAFT_INTENTS,
  ...COLLECTION_INTENTS,
]);
export type Intent = v.InferOutput<typeof IntentSchema>;
