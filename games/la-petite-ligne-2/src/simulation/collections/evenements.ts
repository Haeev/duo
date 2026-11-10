/** Événements des collections, des insectes et de la photo. */
import * as v from 'valibot';
import {
  FiniteSchema,
  IdSchema,
  IntSchema,
  PlayerIndexSchema,
} from '../../donnees/schemas/communs';

export const COLLECTION_EVENTS = [
  /**
   * Une entrée s'inscrit au carnet. `first`: nouvelle pour le duo (présentation complète: pose,
   * jingle, ligne de texte de l'entrée); `mine`: nouvelle pour ce joueur; sinon une prise connue, qui va vite.
   */
  v.strictObject({
    type: v.literal('collection_found'),
    player: PlayerIndexSchema,
    entry: IdSchema,
    category: IdSchema,
    first: v.boolean(),
    mine: v.boolean(),
  }),
  v.strictObject({
    type: v.literal('collection_record'),
    player: PlayerIndexSchema,
    entry: IdSchema,
    value: FiniteSchema,
  }),
  /** Toutes les entrées d'une catégorie trouvées dans un lieu: le trophée. */
  v.strictObject({ type: v.literal('collection_completed'), category: IdSchema, place: IdSchema }),
  /** Un insecte s'envole (joueur qui court): direction de fuite et vitesse, pour le rendu. */
  v.strictObject({
    type: v.literal('insect_fled'),
    id: v.pipe(IntSchema, v.minValue(0)),
    insect: IdSchema,
    x: FiniteSchema,
    y: FiniteSchema,
    dx: FiniteSchema,
    dy: FiniteSchema,
    speed: FiniteSchema,
  }),
  /** Coup de filet; `insect`: espèce prise, `null`: raté. */
  v.strictObject({
    type: v.literal('net_swung'),
    player: PlayerIndexSchema,
    insect: v.nullable(IdSchema),
  }),
  /** Déclic de l'appareil; `subject`: sujet valable photographié, `null`: photo sans sujet. */
  v.strictObject({
    type: v.literal('photo_taken'),
    player: PlayerIndexSchema,
    subject: v.nullable(IdSchema),
  }),
] as const;
