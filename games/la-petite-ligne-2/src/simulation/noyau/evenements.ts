/**
 * Événements de la simulation: nés chez l'hôte, envoyés à l'invité sur le canal fiable, lus par
 * l'interface, le rendu et le son des deux machines. Règle (retours R03, R18, R19): un son du
 * monde naît d'un événement ou de l'état, jamais d'une entrée locale.
 */
import * as v from 'valibot';
import { IdSchema, PlayerIndexSchema } from '../../donnees/schemas/communs';
import { NEEDS_EVENTS } from '../besoins/evenements';
import { BRICK_EVENTS } from '../briques/evenements';
import { DIALOGUE_EVENTS } from '../dialogues/evenements';
import { BAG_EVENTS } from '../sac/evenements';
import { TRAVEL_EVENTS } from '../voyage/evenements';

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
] as const;

export const GameEventSchema = v.variant('type', [
  ...CORE_EVENTS,
  ...BRICK_EVENTS,
  ...TRAVEL_EVENTS,
  ...NEEDS_EVENTS,
  ...BAG_EVENTS,
  ...DIALOGUE_EVENTS,
]);
export type GameEvent = v.InferOutput<typeof GameEventSchema>;
