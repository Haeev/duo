/**
 * `donnees/lieux/<lieu>/dialogues/<id>.json`: un dialogue est un graphe de nœuds, un fichier par dialogue. L'état
 * ne porte que le nœud courant de chaque joueur; le défilement lettre par lettre est local.
 */
import * as v from 'valibot';
import { FileVersionSchema, IdSchema, IntSchema, TextSchema } from './communs';
import { ConditionSchema, EffectSchema } from './regles';

export const EMOTES = ['surprise', 'question', 'joy', 'anger', 'sad', 'idea'] as const;

const Next = v.nullable(IdSchema);

/**
 * Écrans de l'interface qu'une réplique peut ouvrir (`opens`). Un écran de plus: son nom ici, et
 * son ouverture dans `src/interface/ecrans-dialogue.ts`.
 */
export const DIALOGUE_SCREEN_IDS = ['character-editor'] as const;
export type DialogueScreenId = (typeof DIALOGUE_SCREEN_IDS)[number];

export const DialogueNodeSchema = v.variant('kind', [
  /** Une réplique; `speaker`: identifiant de l'habitant, ou `player`. */
  v.strictObject({
    kind: v.literal('line'),
    speaker: IdSchema,
    text: TextSchema,
    emote: v.nullable(v.picklist(EMOTES)),
    next: Next,
    /**
     * Écran ouvert chez le joueur qui lit, une fois la réplique lue (la touche qui passerait à la
     * suite l'ouvre); le fermer fait avancer le dialogue. Absent: réplique ordinaire.
     */
    opens: v.exactOptional(v.picklist(DIALOGUE_SCREEN_IDS)),
  }),
  v.strictObject({
    kind: v.literal('choice'),
    options: v.pipe(
      v.array(
        v.strictObject({
          id: IdSchema,
          text: TextSchema,
          when: v.array(ConditionSchema),
          effects: v.array(EffectSchema),
          next: Next,
        }),
      ),
      v.minLength(2),
    ),
  }),
  /** Aiguillage sans texte: premier cas vrai, sinon `otherwise`. */
  v.strictObject({
    kind: v.literal('branch'),
    cases: v.pipe(
      v.array(
        v.strictObject({ when: v.pipe(v.array(ConditionSchema), v.minLength(1)), next: IdSchema }),
      ),
      v.minLength(1),
    ),
    otherwise: Next,
  }),
  /**
   * Effets appliqués d'un bloc. `otherwise`: si l'échange est impossible (poches pleines, argent
   * insuffisant, objet manquant), rien n'est appliqué, le refus part et le dialogue continue là.
   * Sans `otherwise`, un don qui ne tient pas dans les poches n'est pas donné non plus: l'habitant
   * dit qu'il le garde (`pocketsFull`), la conversation se ferme et reprendra à ce bloc.
   */
  v.strictObject({
    kind: v.literal('effects'),
    effects: v.pipe(v.array(EffectSchema), v.minLength(1)),
    next: Next,
    otherwise: v.exactOptional(IdSchema),
  }),
]);
export type DialogueNode = v.InferOutput<typeof DialogueNodeSchema>;

export const DialogueSchema = v.strictObject({
  schema: FileVersionSchema,
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
