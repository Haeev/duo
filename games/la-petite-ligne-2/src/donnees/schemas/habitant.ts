/** `donnees/lieux/<lieu>/habitants/<id>.json`: un habitant écrit d'un lieu. Un fichier par habitant. */
import * as v from 'valibot';
import { FileVersionSchema, IdSchema, LabelSchema } from './communs';
import { LookSchema } from './personnage';
import { VillagerLifeSchema } from './vie-habitant';

export const VillagerSchema = v.strictObject({
  schema: FileVersionSchema,
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
  /** Sa vie au fil des heures (`vie-habitant.ts`); absent: il reste à `stands`. */
  life: v.exactOptional(VillagerLifeSchema),
});
export type VillagerDef = v.InferOutput<typeof VillagerSchema>;
