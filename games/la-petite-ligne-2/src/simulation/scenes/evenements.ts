/**
 * Événements des scènes. Chaque temps (`scene_beat`) part même s'il passe dans le pas: le son
 * et les bulles d'émotion lisent le temps dans les données (`beats[beat]`).
 */
import * as v from 'valibot';
import { IdSchema, IntSchema, PlayerIndexSchema } from '../../donnees/schemas/communs';

export const SCENE_EVENTS = [
  v.strictObject({ type: v.literal('scene_started'), scene: IdSchema, roleA: PlayerIndexSchema }),
  v.strictObject({
    type: v.literal('scene_beat'),
    scene: IdSchema,
    beat: v.pipe(IntSchema, v.minValue(0)),
  }),
  /**
   * Geste d'une partie d'attente (`part`: son indice) par le joueur de son rôle: `start` (touche
   * enfoncée, joueur arrivé au point), `stop` (lâché, parti), `expired` (appui trop tôt pour un
   * geste ensemble), `done` (réussi), `lost` (geste ensemble défait avant l'autre).
   */
  v.strictObject({
    type: v.literal('scene_gesture'),
    scene: IdSchema,
    part: v.pipe(IntSchema, v.minValue(0), v.maxValue(1)),
    player: PlayerIndexSchema,
    state: v.picklist(['start', 'stop', 'expired', 'done', 'lost']),
  }),
  /** `completed`: jouée jusqu'au bout (sinon abandonnée, elle reviendra). */
  v.strictObject({ type: v.literal('scene_ended'), scene: IdSchema, completed: v.boolean() }),
] as const;
