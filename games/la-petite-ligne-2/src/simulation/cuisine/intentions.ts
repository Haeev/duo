/** Intentions de la cuisine. Le mini-jeu se joue chez le joueur; seules ses notes partent à l'hôte. */
import * as v from 'valibot';
import { IdSchema, IntSchema } from '../../donnees/schemas/communs';
import { SlotRefSchema } from '../sac/cases';

export const COOK_INTENTS = [
  /** Choisir une recette au poste visé: l'hôte attribue la part (repas à deux) et la graine. */
  v.strictObject({ type: v.literal('cook_start'), target: IdSchema, recipe: IdSchema }),
  /** Une étape du mini-jeu finie, notée de 1 à 3 (l'hôte borne). */
  v.strictObject({
    type: v.literal('cook_step'),
    grade: v.pipe(IntSchema, v.minValue(1), v.maxValue(3)),
  }),
  /** Quitter la préparation: rien n'est perdu, les ingrédients ne partent qu'à la fin. */
  v.strictObject({ type: v.literal('cook_cancel') }),
  /** Lire le livre de cette case au poste: ses recettes s'apprennent. */
  v.strictObject({ type: v.literal('cook_read'), from: SlotRefSchema }),
] as const;
