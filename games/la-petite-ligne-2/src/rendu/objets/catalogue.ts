/**
 * Index des modèles d'objets (`assets/commun/objets/index.json`, écrit par
 * `assets-src/objets/construire_objets.py`): pour chaque modèle, son fichier GLB, son nœud, sa
 * taille et le point de prise en main. Validé à l'exécution: c'est un fichier externe au code.
 */
import * as v from 'valibot';
import type { ItemDef } from '../../donnees/schemas/objets';

const Vec3Schema = v.tuple([v.number(), v.number(), v.number()]);

export const ObjectModelSchema = v.object({
  file: v.pipe(v.string(), v.regex(/^[a-z0-9-]+\.glb$/)),
  node: v.string(),
  family: v.string(),
  /** Taille en mètres (x, y, z du glTF: largeur, hauteur, profondeur). */
  size: Vec3Schema,
  /** Point de prise en main dans le repère du modèle (aussi le nœud `<node>--grip`). */
  grip: Vec3Schema,
  triangles: v.number(),
});
export type ObjectModel = v.InferOutput<typeof ObjectModelSchema>;

export const ObjectIndexSchema = v.object({
  schema: v.literal(1),
  objects: v.record(v.string(), ObjectModelSchema),
});
export type ObjectIndex = v.InferOutput<typeof ObjectIndexSchema>;

/** Suffixe du nœud vide qui marque la prise en main d'un objet. */
export const GRIP_SUFFIX = '--grip';

/** Lit et valide l'index (lève une erreur lisible s'il est mal formé). */
export function parseObjectIndex(raw: unknown): ObjectIndex {
  return v.parse(ObjectIndexSchema, raw);
}

/** Résout l'identifiant d'un objet du jeu vers son modèle: le champ `model` de sa fiche. */
export type ModelResolver = (itemId: string) => string | undefined;

/** Résolveur tiré des fiches d'objets (`content.items`). */
export function resolverFromItems(items: Readonly<Record<string, ItemDef>>): ModelResolver {
  return (itemId) => items[itemId]?.model;
}

/** Modèle d'un objet, ou `null` si sa fiche n'en nomme pas ou si l'index ne le connaît pas. */
export function modelOf(
  index: ObjectIndex,
  resolve: ModelResolver,
  itemId: string,
): ObjectModel | null {
  const id = resolve(itemId);
  if (id === undefined) return null;
  return index.objects[id] ?? null;
}
