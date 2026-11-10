/**
 * Événements des lieux: verrous qui s'ouvrent ou se ferment, portes franchies. Envoyés aux deux
 * machines; le rendu y joue l'animation de l'obstacle et le fondu, le son le leur.
 */
import * as v from 'valibot';
import { IdSchema, PlayerIndexSchema } from '../../donnees/schemas/communs';

export const PLACE_EVENTS = [
  /** Un verrou d'histoire s'ouvre (`object`: son obstacle visible, `null` s'il n'est pas posé). */
  v.strictObject({
    type: v.literal('lock_opened'),
    lock: IdSchema,
    object: v.nullable(IdSchema),
  }),
  /** Un verrou se referme (condition redevenue fausse: rare, une condition d'heure par exemple). */
  v.strictObject({
    type: v.literal('lock_closed'),
    lock: IdSchema,
    object: v.nullable(IdSchema),
  }),
  /**
   * Un joueur franchit une porte: il est déjà à l'arrivée. Le rendu de sa machine fait le fondu et
   * ne lisse pas ce saut; `interior`: l'intérieur où il arrive, `null` dehors.
   */
  v.strictObject({
    type: v.literal('door_passed'),
    player: PlayerIndexSchema,
    door: IdSchema,
    to: IdSchema,
    interior: v.nullable(IdSchema),
  }),
] as const;
