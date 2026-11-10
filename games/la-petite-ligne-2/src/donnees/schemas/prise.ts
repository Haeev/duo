/**
 * `donnees/commun/prises/<id>.json`: un poisson, un insecte, un coquillage, un fossile ou un
 * trésor (réponses 28, 56 et 58): où, quand et par quel temps on le trouve. Moteurs au jalon 3.
 */
import * as v from 'valibot';
import { FileVersionSchema, FiniteSchema, IdSchema, IntSchema } from './communs';
import { FishTraitsSchema } from './peche';

export const CATCH_KINDS = ['fish', 'insect', 'shell', 'fossil', 'treasure'] as const;
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export const CATCH_WEATHERS = ['clear', 'overcast', 'rain', 'mist', 'snow'] as const;

const MinuteOfDay = v.pipe(IntSchema, v.minValue(0), v.maxValue(1440));

export const CatchSchema = v.strictObject({
  schema: FileVersionSchema,
  id: IdSchema,
  kind: v.picklist(CATCH_KINDS),
  /** Objet obtenu (`objets/<id>.json`): c'est lui qui porte le nom et la pile. */
  item: IdSchema,
  /** Lieux où on le trouve. */
  places: v.pipe(v.array(IdSchema), v.minLength(1)),
  /** Plage d'heures de jeu (elle peut passer minuit), météos et saisons; liste vide: toutes. */
  hours: v.strictObject({ from: MinuteOfDay, to: MinuteOfDay }),
  weathers: v.array(v.picklist(CATCH_WEATHERS)),
  seasons: v.array(v.picklist(SEASONS)),
  rarity: v.picklist(['common', 'uncommon', 'rare']),
  /** Difficulté du mini-jeu, de 1 (facile) à 5. */
  difficulty: v.pipe(FiniteSchema, v.minValue(1), v.maxValue(5)),
  /** Poisson: son caractère au combat (`schemas/peche.ts`). Absent: il ne se pêche pas. */
  fish: v.exactOptional(FishTraitsSchema),
});
export type CatchDef = v.InferOutput<typeof CatchSchema>;
