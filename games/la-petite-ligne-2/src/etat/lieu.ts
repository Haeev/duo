/**
 * Tranche « lieu »: l'état d'un lieu. Tous les lieux visités sont dans le monde et dans la
 * sauvegarde; seul le lieu courant est simulé et transmis (ADR 0018).
 */
import * as v from 'valibot';
import { FiniteSchema, IdSchema, IntSchema, PlayerIndexSchema } from '../donnees/schemas/communs';
import { BrickStatesSchema } from './briques';
import { VillagerLifeStateSchema } from './habitants';
import { BodySchema, StackSchema } from './joueur';

const villagerSlow = {
  /** Déjà rencontré par chaque joueur. */
  met: v.tuple([v.boolean(), v.boolean()]),
  /** Joueur à qui il parle. */
  talkingWith: v.nullable(PlayerIndexSchema),
  /** Vie au fil du planning (`etat/habitants.ts`), pour les habitants qui en ont un. */
  life: v.exactOptional(VillagerLifeStateSchema),
} as const;

export const VillagerSlowSchema = v.strictObject(villagerSlow);
export const VillagerSchema = v.strictObject({ ...villagerSlow, body: BodySchema });
export type VillagerState = v.InferOutput<typeof VillagerSchema>;

/** Meuble posé par un joueur (mode déco): même catalogue et mêmes briques que ceux de la carte. */
export const PlacedPropSchema = v.strictObject({
  /** Identifiant d'instance, `pose-<n>`: il ne croise jamais ceux de la carte. */
  id: IdSchema,
  type: IdSchema,
  x: FiniteSchema,
  y: FiniteSchema,
  rotation: v.picklist([0, 1, 2, 3]),
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
  /** Meubles posés par les joueurs. */
  placed: v.pipe(v.array(PlacedPropSchema), v.maxLength(200)),
  nextPlacedId: v.pipe(IntSchema, v.minValue(0)),
  /** État des briques de chaque meuble (carte et joueurs), par identifiant d'instance. */
  objects: v.record(IdSchema, BrickStatesSchema),
  /** 80 au plus: au-delà, le rangement retire les plus anciens (budget de la tranche, `reseau/canaux.ts`). */
  ground: v.pipe(v.array(GroundItemSchema), v.maxLength(80)),
  nextGroundId: v.pipe(IntSchema, v.minValue(0)),
} as const;

/** Ce qui part dans la tranche « lieu »: tout, sauf les positions des habitants (canal rapide). */
export const PlaceSlowSchema = v.strictObject({
  ...placeSlow,
  villagers: v.record(IdSchema, VillagerSlowSchema),
});
export type PlaceSlow = v.InferOutput<typeof PlaceSlowSchema>;

export const PlaceStateSchema = v.strictObject({
  ...placeSlow,
  villagers: v.record(IdSchema, VillagerSchema),
});
export type PlaceState = v.InferOutput<typeof PlaceStateSchema>;

export function slowOfPlace(place: PlaceState): PlaceSlow {
  const villagers: PlaceSlow['villagers'] = {};
  for (const [id, villager] of Object.entries(place.villagers))
    villagers[id] =
      villager.life === undefined
        ? { met: villager.met, talkingWith: villager.talkingWith }
        : { met: villager.met, talkingWith: villager.talkingWith, life: villager.life };
  const { leftOn, placed, nextPlacedId, objects, ground, nextGroundId } = place;
  return { leftOn, placed, nextPlacedId, objects, ground, nextGroundId, villagers };
}
