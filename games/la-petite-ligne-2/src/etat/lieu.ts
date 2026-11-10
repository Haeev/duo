/**
 * Tranche « lieu »: l'état d'un lieu. Tous les lieux visités sont dans le monde et dans la
 * sauvegarde; seul le lieu courant est simulé et transmis (ADR 0018).
 */
import * as v from 'valibot';
import { FiniteSchema, IdSchema, IntSchema, PlayerIndexSchema, TickSchema } from '../donnees/schemas/communs';
import { BodySchema, StackSchema } from './joueur';

const villagerSlow = {
  /** Déjà rencontré par chaque joueur. */
  met: v.tuple([v.boolean(), v.boolean()]),
  /** Joueur à qui il parle. */
  talkingWith: v.nullable(PlayerIndexSchema),
} as const;

export const VillagerSlowSchema = v.strictObject(villagerSlow);
export const VillagerSchema = v.strictObject({ ...villagerSlow, body: BodySchema });
export type VillagerState = v.InferOutput<typeof VillagerSchema>;

/** État d'un objet de la carte qui en a un (stock d'un arbre fruitier, d'un tas de bois). */
export const ObjectStateSchema = v.strictObject({
  left: v.pipe(IntSchema, v.minValue(0)),
  /** Pas où le stock revient, `null` s'il est plein. */
  refillAt: v.nullable(TickSchema),
});

/** Objet posé au sol par un joueur (« Poches pleines »: ce qui ne rentre pas reste là). */
export const GroundItemSchema = v.strictObject({
  id: v.pipe(IntSchema, v.minValue(0)),
  stack: StackSchema,
  x: FiniteSchema,
  y: FiniteSchema,
});

const placeSlow = {
  /** Jour du départ des joueurs, pour le rattrapage au retour; `null`: ils y sont. */
  leftOn: v.nullable(v.pipe(IntSchema, v.minValue(1))),
  objects: v.record(IdSchema, ObjectStateSchema),
  ground: v.pipe(v.array(GroundItemSchema), v.maxLength(200)),
  nextGroundId: v.pipe(IntSchema, v.minValue(0)),
} as const;

/** Ce qui part dans la tranche « lieu »: tout, sauf les positions des habitants (canal rapide). */
export const PlaceSlowSchema = v.strictObject({ ...placeSlow, villagers: v.record(IdSchema, VillagerSlowSchema) });
export type PlaceSlow = v.InferOutput<typeof PlaceSlowSchema>;

export const PlaceStateSchema = v.strictObject({ ...placeSlow, villagers: v.record(IdSchema, VillagerSchema) });
export type PlaceState = v.InferOutput<typeof PlaceStateSchema>;

export function slowOfPlace(place: PlaceState): PlaceSlow {
  const villagers: PlaceSlow['villagers'] = {};
  for (const [id, villager] of Object.entries(place.villagers)) villagers[id] = { met: villager.met, talkingWith: villager.talkingWith };
  return { leftOn: place.leftOn, objects: place.objects, ground: place.ground, nextGroundId: place.nextGroundId, villagers };
}
