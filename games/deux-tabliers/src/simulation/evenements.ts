/**
 * Événements de la simulation: émis chez l'hôte, envoyés à l'invité (canal fiable), lus par
 * l'interface et le son des deux machines. Les chantiers ajoutent les leurs par `*_EVENTS`.
 */
import { v } from '@duo/sdk';
import { ARRANGEMENT_EVENTS } from '../amenagement/evenements';
import { CLIENTELE_EVENTS } from '../clientele/evenements';
import { SERVICE_EVENTS } from '../service/evenements';
import { INSTALLATION_EVENTS } from '../installation/evenements';
import { PlayerIndexSchema } from '../etat/monde';

const ObjectId = v.pipe(v.number(), v.integer(), v.minValue(0));

export const CORE_EVENTS = [
  v.strictObject({
    type: v.literal('taken'),
    player: PlayerIndexSchema,
    object: ObjectId,
    objectType: v.string(),
  }),
  v.strictObject({
    type: v.literal('placed'),
    player: PlayerIndexSchema,
    object: ObjectId,
    objectType: v.string(),
  }),
  v.strictObject({
    type: v.literal('given'),
    from: PlayerIndexSchema,
    to: PlayerIndexSchema,
    object: ObjectId,
  }),
  v.strictObject({
    type: v.literal('station-done'),
    player: PlayerIndexSchema,
    furniture: v.string(),
    station: v.string(),
  }),
  /** Refus d'une action, à montrer à ce joueur seulement (« Déjà pris », « Mains prises »). */
  v.strictObject({
    type: v.literal('refused'),
    player: PlayerIndexSchema,
    reason: v.pipe(v.string(), v.maxLength(80)),
  }),
] as const;

export const GameEventSchema = v.variant('type', [
  ...CORE_EVENTS,
  ...SERVICE_EVENTS,
  ...CLIENTELE_EVENTS,
  ...ARRANGEMENT_EVENTS,
  ...INSTALLATION_EVENTS,
]);
export type GameEvent = v.InferOutput<typeof GameEventSchema>;
