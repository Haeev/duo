/** Intentions de l'atelier: fabriquer à un poste, améliorer, réparer ou affûter un outil de la barre. */
import * as v from 'valibot';
import { IdSchema, IntSchema } from '../../donnees/schemas/communs';

const Slot = v.pipe(IntSchema, v.minValue(0), v.maxValue(9));

export const CRAFT_INTENTS = [
  /** Choisir un plan au poste visé (`variant`: couleur d'un meuble, 0 sinon); rien n'est pris avant la fin. */
  v.strictObject({
    type: v.literal('craft_start'),
    target: IdSchema,
    plan: IdSchema,
    variant: v.pipe(IntSchema, v.minValue(0), v.maxValue(5)),
  }),
  /** Un coup sur l'ouvrage en cours à ce poste (le sien ou celui de l'autre joueur). */
  v.strictObject({ type: v.literal('craft_strike'), target: IdSchema }),
  /** Laisser l'ouvrage: rien n'est perdu. */
  v.strictObject({ type: v.literal('craft_cancel'), target: IdSchema }),
  /** Améliorer, réparer en payant, ou faire un tour de meule avec l'outil de cette case. */
  v.strictObject({
    type: v.literal('craft_tool'),
    target: IdSchema,
    slot: Slot,
    job: v.picklist(['upgrade', 'repair', 'sharpen']),
  }),
] as const;
