/**
 * L'état complet d'une partie, découpé en tranches (ADR 0019). C'est ce que l'hôte simule et
 * sauvegarde; l'invité en tient une copie nourrie par les tranches reçues.
 */
import * as v from 'valibot';
import { FiniteSchema, IdSchema, IntSchema, TickSchema } from '../donnees/schemas/communs';
import { CommonSchema } from './commun';
import { PlayerSchema } from './joueur';
import { PlaceStateSchema } from './lieu';
import { ProgressSchema } from './progression';

/** Version du format de sauvegarde. Jusqu'à l'Alpha, un changement peut remettre la partie à zéro (ADR 0017). */
export const DATA_SCHEMA = 1;

export const WorldSchema = v.strictObject({
  schema: v.literal(DATA_SCHEMA),
  tick: TickSchema,
  seed: IntSchema,
  /** État du générateur aléatoire de la simulation, réécrit à chaque pas. */
  rng: v.tuple([IntSchema, IntSchema, IntSchema, IntSchema]),
  /** Heure de jeu, en minutes depuis minuit (canal rapide). */
  minutes: v.pipe(FiniteSchema, v.minValue(0), v.maxValue(1440)),
  common: CommonSchema,
  players: v.tuple([PlayerSchema, PlayerSchema]),
  progress: ProgressSchema,
  /** Les lieux visités, par identifiant. */
  places: v.record(IdSchema, PlaceStateSchema),
});
export type WorldState = v.InferOutput<typeof WorldSchema>;

/** Les tranches lentes de l'état, chacune avec sa révision et son canal. */
export const SLICES = ['common', 'players', 'progress', 'place'] as const;
export type Slice = (typeof SLICES)[number];

/** Lecture seule en profondeur: ce que le rendu, l'interface et le son reçoivent. */
export type DeepReadonly<T> = T extends readonly unknown[]
  ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;
export type ReadonlyWorld = DeepReadonly<WorldState>;
