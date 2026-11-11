/**
 * État d'un véhicule de voie (`simulation/vehicules/`), dans la tranche du lieu: l'hôte fait
 * autorité, l'invité le reçoit avec le reste du lieu (par différences) et le sauvegarde l'emporte.
 * Absent de l'état d'un lieu: le véhicule dort dans sa remise.
 */
import * as v from 'valibot';
import { FiniteSchema, IdSchema, PlayerIndexSchema, TickSchema } from '../donnees/schemas/communs';

const Seat = v.nullable(PlayerIndexSchema);

export const RailVehicleStateSchema = v.strictObject({
  /** Sorti sur sa voie (vrai) ou rangé dans sa remise (faux). */
  out: v.boolean(),
  /** Centre du véhicule, en mètres depuis le début de sa voie. */
  s: FiniteSchema,
  /** Vitesse (m/s), jamais négative: le sens est `dir`. */
  speed: v.pipe(FiniteSchema, v.minValue(0), v.maxValue(40)),
  /** Sens de marche: 1 vers la fin de la voie, -1 vers son début. */
  dir: v.picklist([1, -1]),
  /** Qui tient chaque place, dans l'ordre de la fiche. */
  riders: v.tuple([Seat, Seat]),
  /** Frein serré. */
  brake: v.boolean(),
  /**
   * Balancier: la place qui a donné le dernier coup (`null`: aucun encore), le pas de ce coup, la
   * vitesse qu'il a donnée (reprise si l'autre appuie en même temps) et la justesse du rythme
   * (0 à 1, pour l'indicateur, le rendu et le son).
   */
  lever: v.strictObject({
    seat: v.nullable(v.picklist([0, 1])),
    tick: TickSchema,
    gain: v.pipe(FiniteSchema, v.minValue(0), v.maxValue(10)),
    rhythm: v.pipe(FiniteSchema, v.minValue(0), v.maxValue(1)),
  }),
  /** Arrêt où il se tient (`null`: en ligne ou en route). */
  stop: v.nullable(IdSchema),
  /** Un train s'annonce: l'avertissement a été donné (il ne se répète pas). */
  warned: v.boolean(),
});
export type RailVehicleState = v.InferOutput<typeof RailVehicleStateSchema>;

/** Les véhicules d'un lieu, par identifiant de fiche. */
export const RailVehiclesSchema = v.record(IdSchema, RailVehicleStateSchema);
