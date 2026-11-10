/**
 * Conditions et effets des données (quêtes, dialogues, objets de la carte): vocabulaire du
 * jalon 1. Le lot L3 (`simulation/regles/`) les évalue; un nouveau type s'ajoute ici, avec son
 * cas dans l'évaluateur et dans `valider.ts`.
 */
import * as v from 'valibot';
import { CountSchema, FiniteSchema, IdSchema, NeedIdSchema, type NeedId } from './communs';

/** Valeur retenue dans la mémoire des actions (`progress.memory`). */
export const FactValueSchema = v.union([v.string(), v.number(), v.boolean()]);
export type FactValue = v.InferOutput<typeof FactValueSchema>;

/** Clé de mémoire: `lieu.sujet.detail`. */
export const FactKeySchema = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9-]*(\.[a-z0-9-]+){0,3}$/));

export type Condition =
  | { type: 'all'; conditions: Condition[] }
  | { type: 'any'; conditions: Condition[] }
  | { type: 'not'; condition: Condition }
  /** Fait retenu égal à `equals` (absent: le fait existe). */
  | { type: 'remembered'; key: string; equals?: FactValue }
  | { type: 'need_at_least'; need: NeedId; value: number }
  | { type: 'item_in_bag'; item: string; count: number }
  | { type: 'place_is'; place: string }
  /** Heure de jeu, en minutes depuis minuit (`from` inclus, `to` exclu; la plage peut passer minuit). */
  | { type: 'time_is'; from: number; to: number };

const Minutes = v.pipe(FiniteSchema, v.minValue(0), v.maxValue(1440));

export const ConditionSchema: v.GenericSchema<Condition> = v.lazy(() =>
  v.variant('type', [
    v.strictObject({
      type: v.literal('all'),
      conditions: v.pipe(v.array(ConditionSchema), v.minLength(1)),
    }),
    v.strictObject({
      type: v.literal('any'),
      conditions: v.pipe(v.array(ConditionSchema), v.minLength(1)),
    }),
    v.strictObject({ type: v.literal('not'), condition: ConditionSchema }),
    v.strictObject({
      type: v.literal('remembered'),
      key: FactKeySchema,
      equals: v.exactOptional(FactValueSchema),
    }),
    v.strictObject({
      type: v.literal('need_at_least'),
      need: NeedIdSchema,
      value: v.pipe(FiniteSchema, v.minValue(0), v.maxValue(100)),
    }),
    v.strictObject({
      type: v.literal('item_in_bag'),
      item: IdSchema,
      count: v.pipe(CountSchema, v.minValue(1)),
    }),
    v.strictObject({ type: v.literal('place_is'), place: IdSchema }),
    v.strictObject({ type: v.literal('time_is'), from: Minutes, to: Minutes }),
  ]),
);

export const EffectSchema = v.variant('type', [
  /** Écrit un fait dans la mémoire, au nom du joueur qui agit (`by: 'duo'`: au nom des deux). */
  v.strictObject({
    type: v.literal('remember'),
    key: FactKeySchema,
    value: FactValueSchema,
    by: v.picklist(['actor', 'duo']),
  }),
  v.strictObject({
    type: v.literal('give_item'),
    item: IdSchema,
    count: v.pipe(CountSchema, v.minValue(1)),
  }),
  v.strictObject({
    type: v.literal('take_item'),
    item: IdSchema,
    count: v.pipe(CountSchema, v.minValue(1)),
  }),
  v.strictObject({ type: v.literal('give_money'), amount: v.pipe(CountSchema, v.minValue(1)) }),
  /** Ajoute `amount` (négatif permis) à un besoin de celui qui agit, sans dépasser `cap`. */
  v.strictObject({
    type: v.literal('change_need'),
    need: NeedIdSchema,
    amount: v.pipe(FiniteSchema, v.minValue(-100), v.maxValue(100)),
    cap: v.pipe(FiniteSchema, v.minValue(0), v.maxValue(100)),
  }),
  /** Remplace le sac de celui qui agit (identifiant de `sacs.json`). */
  v.strictObject({ type: v.literal('give_bag'), bag: IdSchema }),
]);
export type Effect = v.InferOutput<typeof EffectSchema>;
