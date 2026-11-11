/** Événements des véhicules de voie (`index.ts`): l'interface, le rendu et le son les lisent. */
import * as v from 'valibot';
import { FiniteSchema, IdSchema, PlayerIndexSchema } from '../../donnees/schemas/communs';

const Seat = v.picklist([0, 1]);

export const VEHICLE_EVENTS = [
  /** Sorti de sa remise et posé sur sa voie par ce joueur. */
  v.strictObject({ type: v.literal('vehicle_out'), vehicle: IdSchema, player: PlayerIndexSchema }),
  /**
   * Rentré dans sa remise: par un joueur (`player`), ou d'office parce qu'un train arrive
   * (`train`: ceux qui étaient à bord sont posés à côté de la voie, sans dommage).
   */
  v.strictObject({
    type: v.literal('vehicle_in'),
    vehicle: IdSchema,
    reason: v.picklist(['player', 'train']),
  }),
  /** Ce joueur a pris cette place, ou l'a quittée (`seat` nul). */
  v.strictObject({
    type: v.literal('vehicle_seat'),
    vehicle: IdSchema,
    player: PlayerIndexSchema,
    seat: v.nullable(Seat),
  }),
  /**
   * Un coup de balancier: `push` (alterné, `quality` de 0 à 1), `jam` (les deux ensemble), `same`
   * (deux fois de suite le même), `alone` (il manque quelqu'un à bord).
   */
  v.strictObject({
    type: v.literal('vehicle_stroke'),
    vehicle: IdSchema,
    player: PlayerIndexSchema,
    kind: v.picklist(['push', 'jam', 'same', 'alone']),
    quality: v.pipe(FiniteSchema, v.minValue(0), v.maxValue(1)),
  }),
  /** Il s'ébranle. */
  v.strictObject({ type: v.literal('vehicle_started'), vehicle: IdSchema }),
  /** Arrêté: à un arrêt de sa fiche (`stop`), en bout de voie (`end`), ou en pleine voie. */
  v.strictObject({
    type: v.literal('vehicle_stopped'),
    vehicle: IdSchema,
    stop: v.nullable(IdSchema),
    end: v.boolean(),
  }),
  /** Sens de marche inversé à l'arrêt (1: vers la fin de la voie). */
  v.strictObject({
    type: v.literal('vehicle_turned'),
    vehicle: IdSchema,
    dir: v.picklist([1, -1]),
  }),
  /** Arrêté devant un passant sur la voie, il repart, voie libre: un petit coup de timbre. */
  v.strictObject({ type: v.literal('vehicle_bell'), vehicle: IdSchema }),
  /** Un train s'annonce sur sa voie: il est temps de rentrer. */
  v.strictObject({ type: v.literal('vehicle_warning'), vehicle: IdSchema }),
] as const;
