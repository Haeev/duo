/**
 * Données de plan d'un lieu (format `plan-de-lieu` de `docs/jeux/jeu-1/refonte/carte-aubrune/plan.json`),
 * réduites à ce que la carte du carnet dessine. Données externes: lues avec un schéma, jamais
 * prises telles quelles. Unité: le mètre, x vers l'est, y vers le sud.
 */
import * as v from 'valibot';

const Pt = v.tuple([v.number(), v.number()]);

const ZoneSchema = v.object({
  nom: v.string(),
  acte: v.number(),
  couleur: v.string(),
  poly: v.array(Pt),
});
const WaterSchema = v.object({
  id: v.string(),
  nom: v.string(),
  largeur: v.number(),
  pts: v.array(Pt),
});
const PondSchema = v.object({
  id: v.string(),
  cx: v.number(),
  cy: v.number(),
  rx: v.number(),
  ry: v.number(),
});
const RailSchema = v.object({ id: v.string(), pts: v.array(Pt), tunnel: v.optional(v.boolean()) });
const NodeSchema = v.object({ x: v.number(), y: v.number(), zone: v.optional(v.string()) });
const EdgeSchema = v.object({ a: v.string(), b: v.string(), classe: v.string() });
const BuildingSchema = v.object({
  id: v.string(),
  nom: v.string(),
  rect: v.tuple([v.number(), v.number(), v.number(), v.number()]),
  acte: v.number(),
});
const LandmarkSchema = v.object({
  id: v.string(),
  nom: v.string(),
  x: v.number(),
  y: v.number(),
  h: v.number(),
});
const PlotSchema = v.object({
  nom: v.string(),
  rect: v.tuple([v.number(), v.number(), v.number(), v.number()]),
  couleur: v.string(),
});
const KeyPointSchema = v.object({ noeud: v.string(), nom: v.string() });

export const PlanSchema = v.object({
  format: v.literal('plan-de-lieu'),
  id: v.string(),
  nom: v.string(),
  taille: v.object({ largeur: v.number(), hauteur: v.number() }),
  zones: v.record(v.string(), ZoneSchema),
  eaux: v.array(WaterSchema),
  plans_eau: v.array(PondSchema),
  rails: v.array(RailSchema),
  noeuds: v.record(v.string(), NodeSchema),
  aretes: v.array(EdgeSchema),
  batiments: v.array(BuildingSchema),
  reperes: v.array(LandmarkSchema),
  parcelles: v.array(PlotSchema),
  points_cles: v.array(KeyPointSchema),
});
export type PlanRead = v.InferOutput<typeof PlanSchema>;

/** Lit un plan brut; `null` si le format n'est pas le bon (la carte dit alors « pas de plan »). */
export function parsePlan(raw: unknown): PlanRead | null {
  const result = v.safeParse(PlanSchema, raw);
  return result.success ? result.output : null;
}
