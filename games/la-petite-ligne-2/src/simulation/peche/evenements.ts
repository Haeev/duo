/** Événements de la pêche, pour l'interface, le rendu et le son des deux machines. */
import * as v from 'valibot';
import {
  FiniteSchema,
  IdSchema,
  IntSchema,
  PlayerIndexSchema,
} from '../../donnees/schemas/communs';

export const FISHING_EVENTS = [
  /** Le bouchon touche l'eau (éclaboussure, « plouf »). */
  v.strictObject({
    type: v.literal('fish_cast'),
    player: PlayerIndexSchema,
    x: FiniteSchema,
    y: FiniteSchema,
  }),
  /** Ça mord: la canne plie chez les deux. */
  v.strictObject({ type: v.literal('fish_hooked'), player: PlayerIndexSchema }),
  /**
   * Une prise. `isNew`: première de l'espèce au carnet (la grande fête); `record`: meilleure
   * taille de ce joueur; `together`: l'autre a tendu l'épuisette; `big`: gros poisson (vibration).
   */
  v.strictObject({
    type: v.literal('fish_caught'),
    player: PlayerIndexSchema,
    catch: IdSchema,
    sizeMm: v.pipe(IntSchema, v.minValue(1)),
    quality: v.pipe(IntSchema, v.minValue(1), v.maxValue(3)),
    count: v.pipe(IntSchema, v.minValue(1), v.maxValue(2)),
    isNew: v.boolean(),
    record: v.boolean(),
    together: v.boolean(),
    big: v.boolean(),
  }),
  /**
   * Pêche à deux: l'épuisette a plongé à côté. `reason`: elle était au fond, dans un autre
   * couloir, ou la canne n'était pas tenue. Elle replonge; rien n'est perdu.
   */
  v.strictObject({
    type: v.literal('fish_net_missed'),
    player: PlayerIndexSchema,
    reason: v.picklist(['deep', 'side', 'slack']),
  }),
  /** Pas de prise, rien de perdu. `reason`: raté au ferrage, décroché, ligne rangée, résultat refusé. */
  v.strictObject({
    type: v.literal('fish_lost'),
    player: PlayerIndexSchema,
    reason: v.picklist(['missed', 'escaped', 'cancelled', 'invalid']),
  }),
] as const;
