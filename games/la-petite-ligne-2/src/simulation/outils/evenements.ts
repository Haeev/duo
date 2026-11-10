/**
 * Événements des gestes de récolte et du potager, pour le son, les particules et l'animation.
 * Début: `gesture_started` du noyau (clip et cible). Coup: `work_hit`. Fin: `harvested`,
 * `crop_reaped`, `plot_changed` (et `gesture_done` du noyau).
 */
import * as v from 'valibot';
import {
  CountSchema,
  FiniteSchema,
  IdSchema,
  IntSchema,
  PlayerIndexSchema,
} from '../../donnees/schemas/communs';
import { RESOURCE_KINDS } from '../../donnees/schemas/recolte';

const FIELD_ACTIONS = ['till', 'sow', 'water', 'reap'] as const;

export const TOOL_EVENTS = [
  /** Un coup porté: l'objet touché réagit (copeaux, terre, gouttes); `done`: le travail est fini. */
  v.strictObject({
    type: v.literal('work_hit'),
    player: PlayerIndexSchema,
    target: IdSchema,
    action: v.picklist([...RESOURCE_KINDS, ...FIELD_ACTIONS]),
    progress: v.pipe(FiniteSchema, v.minValue(0), v.maxValue(1)),
    done: v.boolean(),
  }),
  /** Une ressource récoltée a donné cet objet (l'arbre tombe, la fouille sort un trésor). */
  v.strictObject({
    type: v.literal('harvested'),
    player: PlayerIndexSchema,
    target: IdSchema,
    resource: IdSchema,
    item: IdSchema,
    count: CountSchema,
    rare: v.boolean(),
  }),
  /** Une case du potager a changé (bêchée, semée, arrosée, récoltée). */
  v.strictObject({
    type: v.literal('plot_changed'),
    player: PlayerIndexSchema,
    target: IdSchema,
    cell: v.pipe(IntSchema, v.minValue(0)),
    action: v.picklist(FIELD_ACTIONS),
  }),
  /** Une récolte du potager, avec sa qualité (0: la plus simple). */
  v.strictObject({
    type: v.literal('crop_reaped'),
    player: PlayerIndexSchema,
    target: IdSchema,
    cell: v.pipe(IntSchema, v.minValue(0)),
    crop: IdSchema,
    item: IdSchema,
    count: CountSchema,
    quality: v.pipe(IntSchema, v.minValue(0), v.maxValue(3)),
  }),
  v.strictObject({
    type: v.literal('tool_upgraded'),
    player: PlayerIndexSchema,
    from: IdSchema,
    to: IdSchema,
  }),
] as const;
