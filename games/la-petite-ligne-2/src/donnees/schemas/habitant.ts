/** `donnees/lieux/<lieu>/habitants.json`: les habitants écrits d'un lieu. */
import * as v from 'valibot';
import { FileVersionSchema, IdSchema, LabelSchema } from './communs';
import { LookSchema } from './personnage';

export const VillagerSchema = v.strictObject({
  id: IdSchema,
  name: LabelSchema,
  /** Caractère: il choisit sa remarque d'hygiène et sa façon de parler (réponse 44). */
  temper: v.picklist(['grumpy', 'dreamy', 'chatty', 'shy', 'cheerful']),
  /** Apparence composée depuis le catalogue; `null` tant que le catalogue n'est pas livré. */
  look: v.nullable(LookSchema),
  /** Point de la carte où il se tient (les plannings arrivent au jalon 2). */
  stands: IdSchema,
  /** Babil: identifiant du timbre de voix. */
  voice: IdSchema,
});
export type VillagerDef = v.InferOutput<typeof VillagerSchema>;

export const VillagersFileSchema = v.strictObject({
  schema: FileVersionSchema,
  villagers: v.array(VillagerSchema),
});
