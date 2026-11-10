/**
 * Un lieu est un dossier autonome: `donnees/lieux/<id>/` avec `lieu.json`, `carte.json`, et les
 * dossiers `habitants/`, `dialogues/`, `commerces/`, `quetes/`. La carte du jalon 1 est une grille
 * de 1 m par case (convention de l'ancien jeu: x vers l'est, y vers le sud, rotation en quarts
 * de tour, 0 façade au sud). Le format complet des cartes d'Aubrune (terrain, pièces, intérieurs)
 * sera repris de l'ancien `GameMap` par les lots L2 et L8.
 */
import * as v from 'valibot';
import {
  FileVersionSchema,
  FiniteSchema,
  IdSchema,
  IntSchema,
  LabelSchema,
  PointSchema,
  RectSchema,
} from './communs';

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
  /** Musiques du lieu, de jour et de nuit (`assets/lieux/<id>/son/`), `null` tant qu'elles ne sont pas livrées. */
  music: v.nullable(v.strictObject({ day: IdSchema, night: IdSchema })),
});
export type PlaceDef = v.InferOutput<typeof PlaceSchema>;

/**
 * Un meuble ou un élément du décor posé sur la carte par le level designer. Ce qu'il fait vient
 * de son type (`commun/meubles/<type>.json` et ses briques). Règle de ressenti: il n'existe pas
 * de zone d'action sans objet visible.
 */
export const MapObjectSchema = v.strictObject({
  id: IdSchema,
  type: IdSchema,
  /** Centre de l'emprise (m). */
  x: FiniteSchema,
  y: FiniteSchema,
  /** Quarts de tour: 0 façade au sud, 1 à l'est, 2 au nord, 3 à l'ouest. */
  rotation: v.picklist([0, 1, 2, 3]),
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
  /**
   * Graphe des chemins tiré du plan du lieu (`noeuds` et `aretes` de `plan.json`): les habitants
   * marchent dessus. Absent: ils cherchent leur chemin sur la grille.
   */
  paths: v.exactOptional(
    v.strictObject({
      nodes: v.record(IdSchema, PointSchema),
      edges: v.array(v.strictObject({ a: IdSchema, b: IdSchema })),
    }),
  ),
});
export type MapDef = v.InferOutput<typeof MapSchema>;
