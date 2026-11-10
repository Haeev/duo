/** Événements du sac, de la barre et de l'argent (lot L3). */
import * as v from 'valibot';
import { CountSchema, IdSchema, IntSchema, PlayerIndexSchema } from '../../donnees/schemas/communs';

export const BAG_EVENTS = [
  v.strictObject({
    type: v.literal('item_gained'),
    player: PlayerIndexSchema,
    item: IdSchema,
    count: CountSchema,
  }),
  /** Plus de place: l'objet reste au sol et brille. */
  v.strictObject({ type: v.literal('pockets_full'), player: PlayerIndexSchema, item: IdSchema }),
  /** Un joueur a donné une pile à l'autre. */
  v.strictObject({
    type: v.literal('item_given'),
    from: PlayerIndexSchema,
    to: PlayerIndexSchema,
    item: IdSchema,
    count: CountSchema,
  }),
  v.strictObject({ type: v.literal('bag_changed'), player: PlayerIndexSchema, bag: IdSchema }),
  /** L'outil amélioré arrive à 0 d'usure: émoussé, toujours utilisable. */
  v.strictObject({ type: v.literal('tool_blunt'), player: PlayerIndexSchema, item: IdSchema }),
  v.strictObject({ type: v.literal('tool_repaired'), player: PlayerIndexSchema, item: IdSchema }),
  /** Bourse d'un joueur ou coffre commun: écart en centimes (le tintement, le chiffre qui bouge). */
  v.strictObject({
    type: v.literal('money_changed'),
    who: v.union([PlayerIndexSchema, v.literal('chest')]),
    delta: IntSchema,
  }),
] as const;
