/** Événements du logement et du mode déco (son, rebond, poussière, avis à l'interface). */
import * as v from 'valibot';
import { IdSchema, IntSchema, PlayerIndexSchema } from '../../donnees/schemas/communs';

export const HOUSING_EVENTS = [
  /** Une étape de restauration est finie (`done`: la pièce est restaurée). */
  v.strictObject({
    type: v.literal('room_progress'),
    housing: IdSchema,
    room: IdSchema,
    stage: IntSchema,
    done: v.boolean(),
  }),
  /** Matériaux apportés à une pièce. */
  v.strictObject({
    type: v.literal('room_supplied'),
    player: PlayerIndexSchema,
    room: IdSchema,
    item: IdSchema,
    count: IntSchema,
  }),
  /** La touche d'action sur un chantier (brique `worksite`): son écran s'ouvre chez ce joueur. */
  v.strictObject({
    type: v.literal('worksite_opened'),
    player: PlayerIndexSchema,
    target: IdSchema,
    housing: IdSchema,
    room: IdSchema,
  }),
  /** Des meubles du sac (objets à champ `prop`) sont entrés dans l'inventaire de la maison. */
  v.strictObject({
    type: v.literal('furniture_stowed'),
    player: PlayerIndexSchema,
    housing: IdSchema,
    item: IdSchema,
    prop: IdSchema,
    count: IntSchema,
  }),
  /** Un meuble saisi, posé ou rangé (le meuble se soulève, se pose avec un rebond et une poussière). */
  v.strictObject({
    type: v.literal('deco_changed'),
    player: PlayerIndexSchema,
    action: v.picklist(['grab', 'take', 'drop', 'cancel', 'store', 'rotate']),
    prop: v.nullable(IdSchema),
    item: IdSchema,
  }),
  /** Le confort change de palier (petit avis doux, jamais une perte annoncée comme une faute). */
  v.strictObject({
    type: v.literal('comfort_changed'),
    housing: IdSchema,
    level: IntSchema,
  }),
] as const;
