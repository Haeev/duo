/**
 * Collections du carnet (cahier 4.8), insectes au filet et sujets de photo (cahier 4.7).
 * Fichiers: `commun/collections.json` (catégories), `commun/carnet/<id>.json` (une entrée),
 * `commun/insectes/<id>.json` (une espèce), `commun/photos/<id>.json` (un sujet),
 * `lieux/<id>/nature.json` (zones de terrain, facultatif). Moteur: `simulation/collections/`.
 * L'état (`AlbumSchema`, `InsectsStateSchema`) est compact: il part sur le réseau.
 */
import * as v from 'valibot';
import {
  FileVersionSchema,
  FiniteSchema,
  IdSchema,
  IntSchema,
  LabelSchema,
  RectSchema,
  TextSchema,
} from './communs';
import { HoursSchema, SeasonSchema, WeatherSchema } from './temps';
import { ConditionSchema } from './regles';

export const CollectionsFileSchema = v.strictObject({
  schema: FileVersionSchema,
  /** Catégories, dans l'ordre du carnet. `record`: libellé du record tenu par entrée (taille). */
  categories: v.pipe(
    v.array(
      v.strictObject({
        id: IdSchema,
        name: LabelSchema,
        record: v.nullable(
          v.strictObject({ label: LabelSchema, unit: v.pipe(v.string(), v.maxLength(8)) }),
        ),
      }),
    ),
    v.minLength(1),
  ),
});
export type CollectionsFile = v.InferOutput<typeof CollectionsFileSchema>;

/** Rareté d'une entrée: heures, météos, saisons (listes vides: toutes). */
export const RaritySchema = v.strictObject({
  hours: HoursSchema,
  weathers: v.array(WeatherSchema),
  seasons: v.array(SeasonSchema),
});
export type Rarity = v.InferOutput<typeof RaritySchema>;

/**
 * Comment une entrée s'inscrit. `item`: à la première fois qu'un joueur reçoit l'objet (pêche,
 * fouille, cadeau, achat: tout `item_gained`). `recipe`: à la première réussite en cuisine de
 * cette recette par ce joueur (chacun de ceux d'un repas à deux), ou par l'effet `give_recipe`;
 * un plat acheté ou reçu ne l'inscrit pas. `insect` et `photo`: par le filet et l'appareil.
 * `tune`: un air entendu (événement) ou appris. `manual`: un système appelle `recordFind`.
 */
export const EntrySourceSchema = v.variant('type', [
  v.strictObject({ type: v.literal('item'), item: IdSchema }),
  v.strictObject({ type: v.literal('recipe'), recipe: IdSchema }),
  v.strictObject({ type: v.literal('insect') }),
  v.strictObject({ type: v.literal('photo') }),
  v.strictObject({ type: v.literal('tune') }),
  v.strictObject({ type: v.literal('manual') }),
]);

export const CollectionEntrySchema = v.strictObject({
  schema: FileVersionSchema,
  id: IdSchema,
  category: IdSchema,
  name: LabelSchema,
  /** Lieu de la collection (une collection complète dans un lieu donne son trophée). */
  place: IdSchema,
  source: EntrySourceSchema,
  /** Conditions montrées au carnet après la première prise ou un indice; `null`: sans condition. */
  rarity: v.nullable(RaritySchema),
  /** Ligne de texte de la présentation d'une prise nouvelle. */
  text: TextSchema,
});
export type CollectionEntryDef = v.InferOutput<typeof CollectionEntrySchema>;

export const InsectSchema = v.strictObject({
  schema: FileVersionSchema,
  id: IdSchema,
  /** Entrée du carnet (source `insect`). */
  entry: IdSchema,
  /** Objet reçu à la capture (`objets/<id>.json`), `null`: seulement l'entrée du carnet. */
  item: v.nullable(IdSchema),
  places: v.pipe(v.array(IdSchema), v.minLength(1)),
  /** Terrains des zones de `nature.json` où il se pose. */
  terrains: v.pipe(v.array(IdSchema), v.minLength(1)),
  rarity: RaritySchema,
  /** Poids de tirage parmi les espèces possibles (commune 10, rare 1). */
  weight: v.pipe(FiniteSchema, v.minValue(0.01), v.maxValue(100)),
  /** Distance (m) à laquelle un joueur qui court le fait fuir. */
  alertRadius: v.pipe(FiniteSchema, v.minValue(0.5), v.maxValue(10)),
  /** Vitesse de fuite (m/s), pour le rendu de l'envol. */
  fleeSpeed: v.pipe(FiniteSchema, v.minValue(0.5), v.maxValue(20)),
  /** Rayon (m) de son vol autour de son point de pose (rendu). */
  wander: v.pipe(FiniteSchema, v.minValue(0), v.maxValue(5)),
});
export type InsectDef = v.InferOutput<typeof InsectSchema>;

/** Zones de terrain d'un lieu (pré, bois, berge...): où les insectes se posent. */
export const NatureSchema = v.strictObject({
  schema: FileVersionSchema,
  zones: v.array(
    v.strictObject({
      id: IdSchema,
      terrain: IdSchema,
      area: RectSchema,
      /** Insectes présents au plus dans la zone. */
      max: v.pipe(IntSchema, v.minValue(0), v.maxValue(8)),
    }),
  ),
});
export type NatureDef = v.InferOutput<typeof NatureSchema>;

/** Ce que vise l'appareil: un point de la carte, un objet de la carte, un habitant, un insecte, un événement. */
export const PhotoTargetSchema = v.variant('type', [
  v.strictObject({ type: v.literal('point'), place: IdSchema, point: IdSchema }),
  v.strictObject({ type: v.literal('object'), place: IdSchema, object: IdSchema }),
  v.strictObject({ type: v.literal('villager'), villager: IdSchema }),
  v.strictObject({ type: v.literal('insect'), insect: IdSchema }),
  v.strictObject({ type: v.literal('event'), event: IdSchema }),
]);
export type PhotoTarget = v.InferOutput<typeof PhotoTargetSchema>;

export const PhotoSubjectSchema = v.strictObject({
  schema: FileVersionSchema,
  id: IdSchema,
  /** Entrée du carnet (source `photo`): la carte postale. */
  entry: IdSchema,
  target: PhotoTargetSchema,
  /** Conditions d'histoire ou de moment (`weather_is`, `time_is`...); vide: toujours. */
  conditions: v.array(ConditionSchema),
});
export type PhotoSubjectDef = v.InferOutput<typeof PhotoSubjectSchema>;

const Count = v.pipe(IntSchema, v.minValue(0), v.maxValue(9999));

/**
 * Une entrée trouvée, en tuple pour tenir le budget de la progression:
 * [premier joueur, jour, minute, météo, saison, prises du joueur 0, prises du joueur 1, record?, joueur du record?].
 * Météo et saison: index dans `WEATHERS` et `SEASONS`.
 */
export const FindSchema = v.union([
  v.tuple([
    v.picklist([0, 1]),
    v.pipe(IntSchema, v.minValue(1)),
    v.pipe(IntSchema, v.minValue(0), v.maxValue(1440)),
    v.pipe(IntSchema, v.minValue(0), v.maxValue(15)),
    v.pipe(IntSchema, v.minValue(0), v.maxValue(3)),
    Count,
    Count,
  ]),
  v.tuple([
    v.picklist([0, 1]),
    v.pipe(IntSchema, v.minValue(1)),
    v.pipe(IntSchema, v.minValue(0), v.maxValue(1440)),
    v.pipe(IntSchema, v.minValue(0), v.maxValue(15)),
    v.pipe(IntSchema, v.minValue(0), v.maxValue(3)),
    Count,
    Count,
    FiniteSchema,
    v.picklist([0, 1]),
  ]),
]);
export type Find = v.InferOutput<typeof FindSchema>;

/** Le carnet des collections, commun au duo (champ `progress.album`). */
export const AlbumSchema = v.strictObject({
  /** Entrées trouvées. */
  f: v.record(IdSchema, FindSchema),
  /** Entrées dont un habitant a donné l'indice: le carnet montre leurs conditions. */
  h: v.pipe(v.array(IdSchema), v.maxLength(600)),
});
export type Album = v.InferOutput<typeof AlbumSchema>;

/** Un insecte posé (tranche « lieu »): sa position de pose suffit, son vol se calcule au rendu. */
export const InsectStateSchema = v.strictObject({
  id: v.pipe(IntSchema, v.minValue(0)),
  s: IdSchema,
  /** Zone de `nature.json`. */
  z: IdSchema,
  x: FiniteSchema,
  y: FiniteSchema,
});
export type InsectState = v.InferOutput<typeof InsectStateSchema>;

export const InsectsStateSchema = v.strictObject({
  list: v.pipe(v.array(InsectStateSchema), v.maxLength(40)),
  next: v.pipe(IntSchema, v.minValue(0)),
  /** Minute absolue (jour × 1440 + minutes depuis l'aube) du dernier essai d'apparition. */
  at: v.pipe(IntSchema, v.minValue(0)),
});
export type InsectsState = v.InferOutput<typeof InsectsStateSchema>;
