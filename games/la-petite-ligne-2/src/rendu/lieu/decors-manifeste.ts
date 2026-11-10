/**
 * Manifeste des décors livrés (`assets/commun/decors/decors.json`, écrit par
 * `assets-src/decors/construire.sh`): pour chaque modèle, son fichier GLB et ses accroches (assise,
 * plateau, portes). Logique pure, sans Three.js: les réglages des personnages y lisent les assises.
 */
import * as v from 'valibot';
import manifestJson from '../../../assets/commun/decors/decors.json';

const Size = v.object({ w: v.number(), d: v.number(), h: v.number() });

const DecorModelSchema = v.object({
  file: v.string(),
  family: v.string(),
  triangles: v.number(),
  size: Size,
  /** Dessus de l'assise (m) et bord avant depuis le centre de l'emprise (m). */
  seat: v.optional(v.object({ height: v.number(), front: v.number() })),
  /** Hauteur du plateau où l'on pose un objet (m). */
  top: v.optional(v.number()),
  /** Portes d'un bâtiment: milieu du seuil dehors (m, x est, y sud, depuis l'origine), hauteur. */
  doors: v.optional(
    v.array(
      v.object({
        side: v.string(),
        x: v.number(),
        y: v.number(),
        width: v.number(),
        height: v.number(),
      }),
    ),
  ),
});

export const DecorManifestSchema = v.object({
  format: v.literal('duo-decors/1'),
  models: v.record(v.string(), DecorModelSchema),
});
export type DecorManifest = v.InferOutput<typeof DecorManifestSchema>;

/** Le manifeste livré, contrôlé à l'exécution (fichier produit hors du code). */
export const DECOR_MANIFEST: DecorManifest = v.parse(DecorManifestSchema, manifestJson);

/** Assises des modèles livrés, au format de `CHARACTER_SETTINGS.seat.byModel`. */
export function decorSeats(
  manifest: DecorManifest = DECOR_MANIFEST,
): Record<string, { height: number; front: number }> {
  const seats: Record<string, { height: number; front: number }> = {};
  for (const [id, model] of Object.entries(manifest.models))
    if (model.seat !== undefined)
      seats[id] = { height: model.seat.height, front: model.seat.front };
  return seats;
}

/** Fichiers GLB à charger pour avoir tous les modèles du manifeste. */
export function decorFiles(manifest: DecorManifest = DECOR_MANIFEST): string[] {
  return [...new Set(Object.values(manifest.models).map((model) => model.file))].sort();
}
