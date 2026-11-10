/**
 * `donnees/lieux/<lieu>/quetes/<id>.json`: une suite de quêtes en actes (`chapters`) et en
 * étapes (réponses 6, 27, 70). Moteur: `src/simulation/quetes/`. Les étapes ont, en plus des
 * conditions et effets communs (`regles.ts`), un vocabulaire propre à l'histoire (objet remis,
 * lieu atteint, dialogue tenu, joueurs réunis, scène vue; verrou de zone, arrivée d'habitant,
 * suite ou scène lancée).
 */
import * as v from 'valibot';
import {
  CountSchema,
  FileVersionSchema,
  FiniteSchema,
  IdSchema,
  LabelSchema,
  TextSchema,
} from './communs';
import { ConditionSchema, EffectSchema, type Condition } from './regles';

const Radius = v.pipe(FiniteSchema, v.minValue(0.5), v.maxValue(40));

/** Conditions propres à l'histoire (évaluées par `simulation/quetes/conditions.ts`). */
export const StoryConditionSchema = v.variant('type', [
  /** Un joueur parle à `villager` en tenant `count` exemplaires de `item`: ils lui sont remis. */
  v.strictObject({
    type: v.literal('deliver'),
    item: IdSchema,
    count: v.pipe(CountSchema, v.minValue(1)),
    villager: IdSchema,
  }),
  /** Un joueur (`one`) ou les deux (`both`) à moins de `radius` m d'un point de la carte. */
  v.strictObject({
    type: v.literal('reach'),
    point: IdSchema,
    radius: v.exactOptional(Radius),
    who: v.picklist(['one', 'both']),
  }),
  /** Un joueur affiche ce dialogue (au nœud `node` s'il est donné), ou l'a déjà joué (`once`). */
  v.strictObject({
    type: v.literal('talked'),
    dialogue: IdSchema,
    node: v.exactOptional(IdSchema),
  }),
  /** Les deux joueurs à moins de `radius` m l'un de l'autre (défaut: réglages des quêtes). */
  v.strictObject({ type: v.literal('together'), radius: v.exactOptional(Radius) }),
  /** La scène a été jouée jusqu'au bout. */
  v.strictObject({ type: v.literal('scene_seen'), scene: IdSchema }),
  /** Une étape d'une suite (ou, sans `step`, toute la suite) est franchie. */
  v.strictObject({
    type: v.literal('quest_step'),
    quest: IdSchema,
    step: v.exactOptional(IdSchema),
  }),
]);
export type StoryCondition = v.InferOutput<typeof StoryConditionSchema>;

export const StepConditionSchema = v.union([ConditionSchema, StoryConditionSchema]);
export type StepCondition = Condition | StoryCondition;

/** Effets propres à l'histoire (appliqués par `simulation/quetes/effets.ts`). */
export const StoryEffectSchema = v.variant('type', [
  /** Ouvre une zone du lieu (fait `zones.<lieu>.<zone>`, lu par le déplacement et le rendu). */
  v.strictObject({ type: v.literal('unlock_zone'), zone: IdSchema }),
  /** Un habitant arrive (fait `habitants.<lieu>.<habitant>`, lu par la présence des habitants). */
  v.strictObject({ type: v.literal('villager_arrives'), villager: IdSchema }),
  /** Ouvre une suite du même lieu, même si ses `requires` ne sont pas vrais. */
  v.strictObject({ type: v.literal('open_quest'), quest: IdSchema }),
  /** Lance une scène du lieu (elle attend son tour si une autre se joue). */
  v.strictObject({ type: v.literal('play_scene'), scene: IdSchema }),
]);
export type StoryEffect = v.InferOutput<typeof StoryEffectSchema>;

export const StepEffectSchema = v.union([EffectSchema, StoryEffectSchema]);
export type StepEffect = v.InferOutput<typeof StepEffectSchema>;

export const QuestStepSchema = v.strictObject({
  id: IdSchema,
  /** Ligne du carnet: ce qu'il faut faire, en une phrase (R70). */
  objective: TextSchema,
  /** Où mène le repère affiché 3 secondes à la demande (réponse 68), `null`: aucun. */
  target: v.nullable(
    v.union([v.strictObject({ point: IdSchema }), v.strictObject({ villager: IdSchema })]),
  ),
  /**
   * Étapes de l'acte à franchir avant celle-ci. Absent: la précédente de l'acte (suite ordonnée);
   * `[]`: ouverte dès le début de l'acte (en parallèle).
   */
  after: v.exactOptional(v.array(IdSchema)),
  /** Ce qui franchit l'étape (toutes vraies). */
  done: v.pipe(v.array(StepConditionSchema), v.minLength(1)),
  /** Exige les deux joueurs ensemble (réponse 9); sinon, faisable seul. */
  together: v.boolean(),
  onStart: v.array(StepEffectSchema),
  onDone: v.array(StepEffectSchema),
});
export type QuestStepDef = v.InferOutput<typeof QuestStepSchema>;

export const QuestLineSchema = v.strictObject({
  schema: FileVersionSchema,
  id: IdSchema,
  /** `main`: la suite principale du lieu; `side`: secondaire; `errand`: petite demande (rare, réponse 40). */
  kind: v.picklist(['main', 'side', 'errand']),
  title: LabelSchema,
  giver: v.nullable(IdSchema),
  /** Ce qui l'ouvre (toutes vraies). */
  requires: v.array(StepConditionSchema),
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
