/**
 * Canaux et messages entre les deux machines (ADR 0007 et 0019). L'état part en tranches, une
 * par canal en mode `latest` (une tranche n'en écrase jamais une autre), chacune avec un budget
 * de taille: le SDK arrête la partie des deux côtés au-delà de 64 Kio par message.
 */
import * as v from 'valibot';
import { FiniteSchema, IdSchema, IntSchema, TickSchema } from '../donnees/schemas/communs';
import { CommonSchema } from '../etat/commun';
import { StaminaValueSchema } from '../etat/endurance';
import { PlayerSlowSchema } from '../etat/joueur';
import { PlaceSlowSchema } from '../etat/lieu';
import type { Slice } from '../etat/monde';
import { ProgressSchema } from '../etat/progression';
import { IntentSchema, StepInputSchema } from '../simulation/noyau/entrees';
import { GameEventSchema } from '../simulation/noyau/evenements';
import {
  PROGRESS_PART_BUDGET_BYTES,
  PROGRESS_PART_CHANNEL,
  ProgressPartSchema,
} from './progression';
import { PLACE_PART_BUDGET_BYTES, PLACE_PART_CHANNEL, PlacePartSchema } from './etat-lieu';

/**
 * Canaux (0 à 15), les mêmes chez les deux. Le canal 5 est libre: la progression ne part plus en
 * tranche entière mais par différences et par morceaux, sur un canal fiable (`progression.ts`).
 * Le canal 7 est réservé aux activités (pêche, mini-jeux).
 */
export const CHANNEL = {
  guestInput: 0,
  common: 1,
  fast: 2,
  events: 3,
  players: 4,
  place: 6,
  /** Fiable, schéma `ProgressPartSchema`. */
  progressPart: PROGRESS_PART_CHANNEL,
  /** Fiable, schéma `PlacePartSchema`: l'état lent du lieu par différences et par morceaux (M3). */
  placePart: PLACE_PART_CHANNEL,
} as const;

/** Budget de chaque message, en octets de JSON. Tenu par `tests/tailles.test.ts` et par l'hôte à l'envoi. */
export const BUDGET_BYTES = {
  guestInput: 2048,
  common: 1024,
  fast: 3072,
  events: 4096,
  players: 8192,
  /** Taille de la progression entière: plus un message, mais la borne de l'état (sauvegarde, test « au pire »). */
  progress: 32_768,
  place: 32_768,
  /** Un morceau de progression. */
  progressPart: PROGRESS_PART_BUDGET_BYTES,
  /** Un morceau de l'état du lieu (M3). */
  placePart: PLACE_PART_BUDGET_BYTES,
} as const;

/**
 * Borne de l'état des meubles d'un lieu (`place.objects`), en octets de JSON (ADR 0022). Dans un
 * grand lieu, il ne tient plus dans la tranche « lieu » au pire (59 Ko mesurés pour Aubrune): il
 * part par différences et par morceaux sur le canal 5, comme la progression (lot L1). Ce n'est
 * pas une taille de message: aucun message ne dépasse 32 Kio.
 */
export const PLACE_OBJECTS_STATE_BYTES = 65_536;

/** Une tranche lourde part au plus tous les N pas; « joueurs » et « commun » partent au pas même. */
export const SLICE_EVERY_TICKS: Readonly<Record<Slice, number>> = {
  common: 1,
  players: 1,
  progress: 15,
  place: 6,
};
/** Sans changement, chaque tranche repart quand même tous les N pas (filet de sécurité). */
export const SLICE_KEEPALIVE_TICKS = 150;

/** Invité vers hôte: ses commandes depuis le dernier envoi et ses intentions. */
export const GuestInputSchema = v.strictObject({
  inputs: v.pipe(v.array(StepInputSchema), v.maxLength(16)),
  intents: v.pipe(v.array(IntentSchema), v.maxLength(16)),
});
export type GuestInput = v.InferOutput<typeof GuestInputSchema>;

/** Un mobile: x, y, cap, vitesse. */
const MoverSchema = v.tuple([FiniteSchema, FiniteSchema, FiniteSchema, FiniteSchema]);
/** Les trois jauges: faim, sommeil, hygiène. */
const GaugesSchema = v.tuple([FiniteSchema, FiniteSchema, FiniteSchema]);

/** Ce qui bouge à chaque pas: positions, heure, jauges des besoins et endurance. */
export const FastSchema = v.strictObject({
  tick: TickSchema,
  /** Dernière commande de l'invité jouée par l'hôte (réconciliation de la prédiction), -1 avant la première. */
  ack: v.pipe(IntSchema, v.minValue(-1)),
  minutes: FiniteSchema,
  /** Lieu de ces positions: pendant un voyage, l'invité écarte un instantané d'un lieu qu'il n'a pas encore. */
  place: IdSchema,
  players: v.tuple([MoverSchema, MoverSchema]),
  needs: v.tuple([GaugesSchema, GaugesSchema]),
  /** Jauge d'endurance de chaque joueur (part de la jauge de base). */
  stamina: v.tuple([StaminaValueSchema, StaminaValueSchema]),
  /** Habitants du lieu courant, dans l'ordre de ses données. */
  villagers: v.pipe(v.array(MoverSchema), v.maxLength(32)),
});
export type FastMessage = v.InferOutput<typeof FastSchema>;

export const EventsSchema = v.strictObject({
  tick: TickSchema,
  events: v.pipe(v.array(GameEventSchema), v.maxLength(64)),
});
export type EventsMessage = v.InferOutput<typeof EventsSchema>;

/** Les tranches lentes, validées champ par champ chez l'invité. */
export const SLICE_SCHEMAS = {
  common: v.strictObject({ tick: TickSchema, common: CommonSchema }),
  players: v.strictObject({
    tick: TickSchema,
    players: v.tuple([PlayerSlowSchema, PlayerSlowSchema]),
  }),
  progress: v.strictObject({ tick: TickSchema, progress: ProgressSchema }),
  place: v.strictObject({ tick: TickSchema, id: IdSchema, place: PlaceSlowSchema }),
} as const;
export type SliceMessage<S extends Slice> = v.InferOutput<(typeof SLICE_SCHEMAS)[S]>;

/** La progression par morceaux (canal `progressPart`, fiable): schéma tenu par `progression.ts`. */
export { ProgressPartSchema };
/** L'état du lieu par morceaux (canal `placePart`, fiable): schéma tenu par `etat-lieu.ts`. */
export { PlacePartSchema };
