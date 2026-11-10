/**
 * `donnees/lieux/<lieu>/quetes/<id>.json`: une suite de quêtes en chapitres et en étapes
 * (réponses 6, 27, 70). Moteur au jalon 2; le schéma est posé pour que l'écriture commence.
 */
import * as v from 'valibot';
import { FileVersionSchema, IdSchema, LabelSchema, TextSchema } from './communs';
import { ConditionSchema, EffectSchema } from './regles';

export const QuestStepSchema = v.strictObject({
  id: IdSchema,
  objective: TextSchema,
  /** Où mène le repère affiché 3 secondes à la demande (réponse 68), `null`: aucun. */
  target: v.nullable(
    v.union([v.strictObject({ point: IdSchema }), v.strictObject({ villager: IdSchema })]),
  ),
  /** Ce qui franchit l'étape. */
  done: v.pipe(v.array(ConditionSchema), v.minLength(1)),
  /** Exige les deux joueurs ensemble (réponse 9). */
  together: v.boolean(),
  onStart: v.array(EffectSchema),
  onDone: v.array(EffectSchema),
});

export const QuestLineSchema = v.strictObject({
  schema: FileVersionSchema,
  id: IdSchema,
  /** `main`: la suite principale du lieu; `side`: secondaire; `errand`: petite demande (rare, réponse 40). */
  kind: v.picklist(['main', 'side', 'errand']),
  title: LabelSchema,
  giver: v.nullable(IdSchema),
  /** Ce qui l'ouvre. */
  requires: v.array(ConditionSchema),
  chapters: v.pipe(
    v.array(
      v.strictObject({
        id: IdSchema,
        title: LabelSchema,
        steps: v.pipe(v.array(QuestStepSchema), v.minLength(1)),
      }),
    ),
    v.minLength(1),
  ),
});
export type QuestLineDef = v.InferOutput<typeof QuestLineSchema>;
