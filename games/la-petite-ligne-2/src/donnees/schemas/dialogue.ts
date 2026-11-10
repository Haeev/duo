/**
 * `donnees/lieux/<lieu>/dialogues/<habitant>.json`: un dialogue est un graphe de nœuds. L'état
 * ne porte que le nœud courant de chaque joueur; le défilement lettre par lettre est local.
 */
import * as v from 'valibot';
import { FileVersionSchema, IdSchema, IntSchema, TextSchema } from './communs';
import { ConditionSchema, EffectSchema } from './regles';

export const EMOTES = ['surprise', 'question', 'joy', 'anger', 'sad', 'idea'] as const;

const Next = v.nullable(IdSchema);

export const DialogueNodeSchema = v.variant('kind', [
  /** Une réplique; `speaker`: identifiant de l'habitant, ou `player`. */
  v.strictObject({ kind: v.literal('line'), speaker: IdSchema, text: TextSchema, emote: v.nullable(v.picklist(EMOTES)), next: Next }),
  v.strictObject({
    kind: v.literal('choice'),
    options: v.pipe(
      v.array(v.strictObject({ id: IdSchema, text: TextSchema, when: v.array(ConditionSchema), effects: v.array(EffectSchema), next: Next })),
      v.minLength(2),
    ),
  }),
  /** Aiguillage sans texte: premier cas vrai, sinon `otherwise`. */
  v.strictObject({
    kind: v.literal('branch'),
    cases: v.pipe(v.array(v.strictObject({ when: v.pipe(v.array(ConditionSchema), v.minLength(1)), next: IdSchema })), v.minLength(1)),
    otherwise: Next,
  }),
  v.strictObject({ kind: v.literal('effects'), effects: v.pipe(v.array(EffectSchema), v.minLength(1)), next: Next }),
]);
export type DialogueNode = v.InferOutput<typeof DialogueNodeSchema>;

export const DialogueSchema = v.strictObject({
  id: IdSchema,
  villager: IdSchema,
  /** Le plus prioritaire dont `when` est vrai est joué. */
  priority: IntSchema,
  when: v.array(ConditionSchema),
  /** Joué une seule fois pour le duo, pour chaque joueur, ou à volonté. */
  once: v.nullable(v.picklist(['duo', 'player'])),
  start: IdSchema,
  nodes: v.record(IdSchema, DialogueNodeSchema),
});
export type DialogueDef = v.InferOutput<typeof DialogueSchema>;

export const DialoguesFileSchema = v.strictObject({
  schema: FileVersionSchema,
  dialogues: v.array(DialogueSchema),
});
