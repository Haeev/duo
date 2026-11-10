/** Tranche « commun »: ce que les deux joueurs partagent et qui change rarement. */
import * as v from 'valibot';
import { CountSchema, IdSchema, IntSchema, TickSchema } from '../donnees/schemas/communs';

/**
 * Phases du jeu (ADR 0018). `day` couvre le jour et la nuit jouable; les trois autres sont le
 * voyage: sur le quai en attendant l'autre, dans le wagon pendant le chargement, puis la descente.
 */
export const PHASES = ['day', 'boarding', 'travel', 'arrival'] as const;
export type Phase = (typeof PHASES)[number];

export const WEATHERS = ['clear', 'overcast', 'rain', 'mist', 'snow'] as const;

const Pair = v.tuple([v.boolean(), v.boolean()]);

export const TravelSchema = v.strictObject({
  to: IdSchema,
  /** Chaque joueur a validé « Monter ». */
  boarded: Pair,
  /** Chaque machine a chargé le lieu d'arrivée (intention `place_loaded`). */
  loaded: Pair,
  /** Pas du départ (les deux à bord). */
  since: v.nullable(TickSchema),
});
export type TravelState = v.InferOutput<typeof TravelSchema>;

export const CommonSchema = v.strictObject({
  phase: v.picklist(PHASES),
  /** Le seul lieu simulé, rendu et transmis: celui où sont les deux joueurs. */
  place: IdSchema,
  /** Jour de jeu, à partir de 1. L'heure (`minutes`) vit à la racine du monde: elle part sur le canal rapide. */
  day: v.pipe(IntSchema, v.minValue(1)),
  weather: v.picklist(WEATHERS),
  /** Coffre commun, pour les gros achats (réponse 10). */
  chest: CountSchema,
  travel: v.nullable(TravelSchema),
});
export type CommonState = v.InferOutput<typeof CommonSchema>;
