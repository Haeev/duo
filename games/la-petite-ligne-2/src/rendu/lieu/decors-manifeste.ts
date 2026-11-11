/**
 * Manifeste des décors livrés (`assets/commun/decors/decors.json`, écrit par
 * `assets-src/decors/construire.sh`): pour chaque modèle, son fichier GLB et ses accroches (assise,
 * plateau, portes). Logique pure, sans Three.js: les réglages des personnages y lisent les assises.
 */
import * as v from 'valibot';
import manifestJson from '../../../assets/commun/decors/decors.json';
import { LAYER, type LayerName } from '../encre/couches';

const Size = v.object({ w: v.number(), d: v.number(), h: v.number() });

/**
 * Partie mobile d'un modèle (`nodes`): nœud enfant nommé du GLB, posé à son pivot (m, repère du
 * modèle). Le jeu le fait tourner autour de `axe`; les autres champs sont les réglages de l'artiste
 * (débattement en degrés, angles baissé et levé en degrés, rayon d'une roue en m).
 */
const DecorNodeSchema = v.object({
  pivot: v.tuple([v.number(), v.number(), v.number()]),
  axe: v.optional(v.picklist(['x', 'y', 'z'])),
  debattement: v.optional(v.number()),
  baissee: v.optional(v.number()),
  levee: v.optional(v.number()),
  rayon: v.optional(v.pipe(v.number(), v.minValue(0.01))),
});
export type DecorNode = v.InferOutput<typeof DecorNodeSchema>;

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
  /** Autres formes du même modèle: chaque exemplaire posé tire la sienne (`variantOf`). */
  variants: v.optional(v.array(v.string())),
  /** Modèle à montrer selon l'état: `stump`, `bare`, `winter`, `chipped`, `tilled`, `watered`. */
  states: v.optional(v.record(v.string(), v.string())),
  /** Écarts de pose tirés par exemplaire: cap libre, échelle entre deux bornes. */
  jitter: v.optional(v.object({ yaw: v.boolean(), scale: v.tuple([v.number(), v.number()]) })),
  /** Parties mobiles, par nom de nœud: le chargeur les garde à part, enfants nommés du modèle. */
  nodes: v.optional(v.record(v.string(), DecorNodeSchema)),
  /**
   * Le modèle éclaire: foyer dans son repère (m, avant vers +z), rayon de la flaque au sol,
   * couleur ajoutée (sinon la teinte des lampes de l'ambiance), force, ombre locale ou non.
   */
  light: v.optional(
    v.object({
      at: v.tuple([v.number(), v.number(), v.number()]),
      radius: v.pipe(v.number(), v.minValue(0.5), v.maxValue(12)),
      color: v.optional(v.pipe(v.string(), v.regex(/^#[0-9a-fA-F]{6}$/))),
      gain: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(3))),
      shadow: v.optional(v.boolean()),
    }),
  ),
});

/**
 * Ce que le rendu encré tire du NOM d'un matériau: couche de traits, prise au vent, verre d'une
 * lampe (`flame`), feu vivant (`fire`: langues qui ondulent; un morceau qui ne finit pas en pointe reste un verre) et
 * braise qui rougeoie (`ember`).
 */
const DecorMaterialSchema = v.object({
  layer: v.picklist(Object.keys(LAYER) as LayerName[]),
  kind: v.optional(v.picklist(['leaf', 'stem', 'flame', 'fire', 'ember'])),
});
export type DecorMaterial = v.InferOutput<typeof DecorMaterialSchema>;

export const DecorManifestSchema = v.object({
  format: v.literal('duo-decors/1'),
  models: v.record(v.string(), DecorModelSchema),
  /** Matériaux aux noms stables (récoltables); un modèle sans ces noms est converti par sa teinte. */
  materials: v.optional(v.record(v.string(), DecorMaterialSchema)),
  /** Par modèle de culture (`model` d'une fiche de culture): un modèle par stade, le dernier mûr, et les mêmes à arroser. */
  crops: v.optional(
    v.record(
      v.string(),
      v.object({ crop: v.string(), stages: v.array(v.string()), thirsty: v.array(v.string()) }),
    ),
  ),
});
export type DecorManifest = v.InferOutput<typeof DecorManifestSchema>;

/** Le manifeste livré, contrôlé à l'exécution (fichier produit hors du code). */
export const DECOR_MANIFEST: DecorManifest = v.parse(DecorManifestSchema, manifestJson);

/**
 * Assises des modèles livrés, au format de `CHARACTER_SETTINGS.seat.byModel`. Un modèle sans
 * assise mesurée (tabouret, banc de table) s'assoit sur son dessus, bord avant à mi-profondeur:
 * sa vraie taille plutôt que la forme provisoire (0,9 m de haut), qui posait le personnage en
 * l'air et devant le meuble.
 */
export function decorSeats(
  manifest: DecorManifest = DECOR_MANIFEST,
): Record<string, { height: number; front: number }> {
  const seats: Record<string, { height: number; front: number }> = {};
  for (const [id, model] of Object.entries(manifest.models))
    seats[id] =
      model.seat === undefined
        ? { height: model.size.h, front: model.size.d / 2 }
        : { height: model.seat.height, front: model.seat.front };
  return seats;
}

/** Fichiers GLB à charger pour avoir tous les modèles du manifeste. */
export function decorFiles(manifest: DecorManifest = DECOR_MANIFEST): string[] {
  return [...new Set(Object.values(manifest.models).map((model) => model.file))].sort();
}

/** Tirage stable de 0 à 1 d'après une clé (l'identifiant d'un exemplaire posé). */
export function keyDraw(key: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

/** La forme que prend cet exemplaire: le modèle lui-même ou l'une de ses variantes livrées. */
export function variantOf(
  model: string,
  key: string,
  manifest: DecorManifest = DECOR_MANIFEST,
): string {
  const all = [model, ...(manifest.models[model]?.variants ?? [])].filter(
    (id) => manifest.models[id] !== undefined,
  );
  return all[Math.floor(keyDraw(key, 1) * all.length)] ?? model;
}

/**
 * Écarts de pose d'un exemplaire, tirés de sa clé et de la fiche du modèle demandé (pas de celle
 * de sa variante ni de son état): un arbre abattu garde le cap et la taille de l'arbre debout.
 */
export function jitterOf(
  model: string,
  key: string,
  manifest: DecorManifest = DECOR_MANIFEST,
): { yaw: number; scale: number } {
  const jitter = manifest.models[model]?.jitter;
  if (jitter === undefined) return { yaw: 0, scale: 1 };
  const [low, high] = jitter.scale;
  return {
    yaw: jitter.yaw ? keyDraw(key, 2) * Math.PI * 2 : 0,
    scale: low + (high - low) * keyDraw(key, 3),
  };
}

/**
 * Le modèle montré pour un exemplaire: sa variante (tirée de `key`), puis l'état de cette
 * variante, ou à défaut celui du modèle demandé. Un état sans modèle propre garde la variante.
 */
export function shownModel(
  model: string,
  key: string,
  state: string | null = null,
  manifest: DecorManifest = DECOR_MANIFEST,
): string {
  const variant = variantOf(model, key, manifest);
  if (state === null) return variant;
  return stateModel(variant, state, manifest) ?? stateModel(model, state, manifest) ?? variant;
}

/**
 * Le modèle d'un état (`stump`, `bare`, `winter`, `tilled`...), `null` si le modèle n'en a pas:
 * une ressource récoltée dont il ne reste rien, ou un état sans apparence propre.
 */
export function stateModel(
  model: string,
  state: string,
  manifest: DecorManifest = DECOR_MANIFEST,
): string | null {
  const id = manifest.models[model]?.states?.[state];
  return id !== undefined && manifest.models[id] !== undefined ? id : null;
}

/**
 * Le modèle d'une case de culture: `model` est celui de la fiche de la culture, `stage` son stade
 * (`stages.length`: mûre), `thirsty` si elle attend l'arrosoir. `null`: culture sans modèle.
 */
export function cropModel(
  model: string,
  stage: number,
  thirsty: boolean,
  manifest: DecorManifest = DECOR_MANIFEST,
): string | null {
  const crop = manifest.crops?.[model];
  if (crop === undefined) return null;
  const last = crop.stages.length - 1;
  const at = Math.min(Math.max(0, Math.floor(stage)), last);
  return (thirsty ? crop.thirsty[at] : undefined) ?? crop.stages[at] ?? null;
}
