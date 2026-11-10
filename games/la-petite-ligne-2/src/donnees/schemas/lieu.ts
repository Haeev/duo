/**
 * Un lieu: `donnees/lieux/<id>/lieu.json` et `carte.json`. La carte du jalon 1 est une grille
 * de 1 m par case (convention de l'ancien jeu: x vers l'est, y vers le sud, rotation en quarts
 * de tour, 0 façade au sud). Le format complet des cartes d'Aubrune (terrain, pièces, intérieurs)
 * sera repris de l'ancien `GameMap` par les lots L2 et L8.
 */
import * as v from 'valibot';
import { FileVersionSchema, FiniteSchema, IdSchema, IntSchema, LabelSchema, PointSchema, RectSchema } from './communs';
import { ConditionSchema, EffectSchema } from './regles';

export const PlaceSchema = v.strictObject({
  schema: FileVersionSchema,
  id: IdSchema,
  name: LabelSchema,
  station: v.strictObject({
    /** Point de la carte où les deux joueurs descendent du train. */
    arrival: IdSchema,
    /** Point du quai: il faut y être tous les deux pour monter. */
    platform: IdSchema,
    /** Rayon du quai autour de ce point (m). */
    platformRadius: v.pipe(FiniteSchema, v.minValue(1), v.maxValue(10)),
  }),
  /** Lieux reliés par le rail (le lien doit être écrit des deux côtés). */
  links: v.array(IdSchema),
  /** Activités offertes ici (réponse 28: selon le lieu). */
  activities: v.array(IdSchema),
});
export type PlaceDef = v.InferOutput<typeof PlaceSchema>;

/**
 * Ce que fait la touche d'action sur un objet de la carte. Règle de ressenti: toute interaction
 * est attachée à un objet visible, avec un verbe; il n'existe pas de zone d'action sans objet.
 */
export const UseSchema = v.strictObject({
  /** Verbe de la bulle (« Ramasser », « Se laver »), 2 mots au plus. */
  verb: v.pipe(v.string(), v.minLength(2), v.maxLength(20)),
  /** Clip d'animation du personnage et durée du geste (s). */
  clip: IdSchema,
  seconds: v.pipe(FiniteSchema, v.minValue(0), v.maxValue(10)),
  /** Geste long déclaré (toilette, repas): interruptible, hors de la règle des 1,5 s. */
  long: v.boolean(),
  when: v.array(ConditionSchema),
  effects: v.pipe(v.array(EffectSchema), v.minLength(1)),
  /** Usages avant épuisement (`null`: sans limite) et retour, en minutes de jeu. */
  stock: v.nullable(v.strictObject({ count: v.pipe(IntSchema, v.minValue(1)), refillMinutes: v.pipe(IntSchema, v.minValue(1)) })),
});
export type UseDef = v.InferOutput<typeof UseSchema>;

export const MapObjectSchema = v.strictObject({
  id: IdSchema,
  /** Nom du modèle (formes simples au jalon 1). */
  model: IdSchema,
  x: FiniteSchema,
  y: FiniteSchema,
  rotation: v.picklist([0, 1, 2, 3]),
  /** Emprise qui bloque le passage, en cases, ou `null`. */
  blocks: v.nullable(RectSchema),
  use: v.nullable(UseSchema),
});
export type MapObject = v.InferOutput<typeof MapObjectSchema>;

export const MapSchema = v.strictObject({
  schema: FileVersionSchema,
  /** Taille en cases de 1 m (ADR: 128 au plus par côté). */
  width: v.pipe(IntSchema, v.minValue(8), v.maxValue(128)),
  height: v.pipe(IntSchema, v.minValue(8), v.maxValue(128)),
  /** Zones où l'on ne marche pas (murs, eau). */
  blocked: v.array(RectSchema),
  points: v.record(IdSchema, PointSchema),
  objects: v.array(MapObjectSchema),
});
export type MapDef = v.InferOutput<typeof MapSchema>;
