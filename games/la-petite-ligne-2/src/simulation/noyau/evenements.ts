/**
 * Événements de la simulation: nés chez l'hôte, envoyés à l'invité sur le canal fiable, lus par
 * l'interface, le rendu et le son des deux machines. Règle (retours R03, R18, R19): un son du
 * monde naît d'un événement ou de l'état, jamais d'une entrée locale.
 */
import * as v from 'valibot';
import { IdSchema, IntSchema, PlayerIndexSchema } from '../../donnees/schemas/communs';
import { NEEDS_EVENTS } from '../besoins/evenements';
import { FISHING_EVENTS } from '../peche/evenements';
import { BRICK_EVENTS } from '../briques/evenements';
import { SHOP_EVENTS } from '../commerces/evenements';
import { COOK_EVENTS } from '../cuisine/evenements';
import { CRAFT_EVENTS } from '../fabrication/evenements';
import { DIALOGUE_EVENTS } from '../dialogues/evenements';
import { TOOL_EVENTS } from '../outils/evenements';
import { VILLAGER_EVENTS } from '../habitants/evenements';
import { QUEST_EVENTS } from '../quetes/evenements';
import { COLLECTION_EVENTS } from '../collections/evenements';
import { WORLD_EVENTS } from '../monde/evenements';
import { HOUSING_EVENTS } from '../logement/evenements';
import { PLACE_EVENTS } from '../lieux/evenements';
import { BAG_EVENTS } from '../sac/evenements';
import { SCENE_EVENTS } from '../scenes/evenements';
import { TRAVEL_EVENTS } from '../voyage/evenements';
import { FARM_EVENTS } from '../elevage/evenements';
import { MUSIC_EVENTS } from '../musique/evenements';

export const CORE_EVENTS = [
  /**
   * Début d'un geste. L'invité l'a déjà joué par prédiction pour son propre personnage
   * (ADR 0020): il l'ignore alors, et ne le joue que pour l'autre joueur.
   */
  v.strictObject({
    type: v.literal('gesture_started'),
    player: PlayerIndexSchema,
    clip: IdSchema,
    target: v.nullable(IdSchema),
  }),
  /** Fin d'un geste mené à son terme: l'objet touché réagit, le son de réussite part. */
  v.strictObject({
    type: v.literal('gesture_done'),
    player: PlayerIndexSchema,
    clip: IdSchema,
    target: v.nullable(IdSchema),
  }),
  /** Refus, pour ce joueur seulement; `reason`: clé de texte (« Poches pleines »). */
  v.strictObject({
    type: v.literal('refused'),
    player: PlayerIndexSchema,
    reason: IdSchema,
    target: v.nullable(IdSchema),
  }),
  /** Un nouveau jour commence à l'aube; `slept`: les deux joueurs dormaient (fondu, réveil). */
  v.strictObject({
    type: v.literal('day_started'),
    day: v.pipe(IntSchema, v.minValue(1)),
    slept: v.boolean(),
  }),
  /** Le personnage était coincé: il vient d'être replacé (le rendu ne lisse pas ce saut). */
  v.strictObject({ type: v.literal('unstuck'), player: PlayerIndexSchema }),
] as const;

export const GameEventSchema = v.variant('type', [
  ...CORE_EVENTS,
  ...BRICK_EVENTS,
  ...TRAVEL_EVENTS,
  ...NEEDS_EVENTS,
  ...BAG_EVENTS,
  ...SHOP_EVENTS,
  ...DIALOGUE_EVENTS,
  ...TOOL_EVENTS,
  ...VILLAGER_EVENTS,
  ...QUEST_EVENTS,
  ...SCENE_EVENTS,
  ...COOK_EVENTS,
  ...CRAFT_EVENTS,
  ...WORLD_EVENTS,
  ...COLLECTION_EVENTS,
  ...HOUSING_EVENTS,
  ...FISHING_EVENTS,
  ...PLACE_EVENTS,
  ...FARM_EVENTS,
  ...MUSIC_EVENTS,
]);
export type GameEvent = v.InferOutput<typeof GameEventSchema>;
