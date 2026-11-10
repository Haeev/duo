/**
 * Cultures (`commun/cultures/<id>.json`), ressources du monde (`commun/ressources/<id>.json`) et
 * travail des outils (`tool.work` d'un objet). Cahier 4.5 (outils de base inusables et lents,
 * outils améliorés qui s'usent) et 4.7 (potager indulgent, cueillette, bois, fouilles).
 */
import * as v from 'valibot';
import type { Content } from '../charger';
import { ToolKindSchema } from './briques';
import {
  CentsSchema,
  FileVersionSchema,
  FiniteSchema,
  IdSchema,
  IntSchema,
  LabelSchema,
} from './communs';
import { CATCH_WEATHERS, SEASONS } from './prise';

const Materials = v.pipe(
  v.array(
    v.strictObject({ item: IdSchema, count: v.pipe(IntSchema, v.minValue(1), v.maxValue(99)) }),
  ),
  v.maxLength(4),
);

/** Un coût: des centimes et des matériaux pris dans les poches. */
export const CostSchema = v.strictObject({ cents: CentsSchema, items: Materials });
export type Cost = v.InferOutput<typeof CostSchema>;

/**
 * Ce que fait un outil à chaque coup. Absent: niveau 0, un point de travail et une case par coup.
 * La lenteur d'un outil faible tient en coups en plus, jamais en geste plus long (cahier 4.5).
 */
export const ToolWorkSchema = v.strictObject({
  /** Niveau: 0 de base, 1 amélioré, 2 fin. Une ressource demande un niveau minimal (`minTier`). */
  tier: v.pipe(IntSchema, v.minValue(0), v.maxValue(3)),
  /** Points de travail par coup, outil en état puis émoussé. */
  power: v.pipe(IntSchema, v.minValue(1), v.maxValue(99)),
  bluntPower: v.pipe(IntSchema, v.minValue(1), v.maxValue(99)),
  /** Cases du potager traitées par coup (bêche, arrosoir), en état puis émoussé. */
  cells: v.pipe(IntSchema, v.minValue(1), v.maxValue(18)),
  bluntCells: v.pipe(IntSchema, v.minValue(1), v.maxValue(18)),
  /** Amélioration à la forge: l'objet obtenu et son prix; `null`: dernier niveau. */
  upgrade: v.nullable(v.strictObject({ to: IdSchema, cost: CostSchema })),
  /** Réparation payée (meule, rustine, fil); `null`: ne se répare pas (outil de base). */
  repair: v.nullable(CostSchema),
});
export type ToolWork = v.InferOutput<typeof ToolWorkSchema>;

const MinuteOfDay = v.pipe(IntSchema, v.minValue(0), v.maxValue(1440));

/** Une ligne d'une table de butin: conditions de rareté (heure, météo, saison) et poids du tirage. */
export const LootEntrySchema = v.strictObject({
  item: IdSchema,
  min: v.pipe(IntSchema, v.minValue(1), v.maxValue(20)),
  max: v.pipe(IntSchema, v.minValue(1), v.maxValue(20)),
  weight: v.pipe(FiniteSchema, v.minValue(0.01), v.maxValue(1000)),
  /** Entrée rare: son poids est multiplié par la chance des besoins (`rareLuck`). */
  rare: v.boolean(),
  /** Plage d'heures (elle peut passer minuit), `null`: toute la journée. Listes vides: toutes. */
  hours: v.nullable(v.strictObject({ from: MinuteOfDay, to: MinuteOfDay })),
  weathers: v.array(v.picklist(CATCH_WEATHERS)),
  seasons: v.array(v.picklist(SEASONS)),
});
export type LootEntry = v.InferOutput<typeof LootEntrySchema>;

export const RESOURCE_KINDS = ['chop', 'pick', 'dig', 'shake'] as const;

export const ResourceSchema = v.strictObject({
  schema: FileVersionSchema,
  id: IdSchema,
  name: LabelSchema,
  /** Famille du geste, pour l'animation, le son et les particules. */
  kind: v.picklist(RESOURCE_KINDS),
  /** Verbe de la bulle d'action, deux mots au plus. */
  verb: v.pipe(v.string(), v.minLength(2), v.maxLength(20)),
  clip: IdSchema,
  /** Durée du geste à mains nues (s); avec un outil, celle de l'outil. */
  seconds: v.pipe(FiniteSchema, v.minValue(0.1), v.maxValue(1.5)),
  /** Outil à tenir en main, `null`: mains nues. */
  tool: v.nullable(ToolKindSchema),
  /** Niveau d'outil minimal (une hache de base ne coupe pas le gros chêne). */
  minTier: v.pipe(IntSchema, v.minValue(0), v.maxValue(3)),
  /** Points de travail avant la récolte (mains nues: un point par coup). */
  work: v.pipe(IntSchema, v.minValue(1), v.maxValue(200)),
  /** Geste salissant (fouille, souche): l'hygiène baisse à chaque coup. */
  dirty: v.boolean(),
  /** Points de faim perdus par coup, en plus de l'effort du geste. */
  effort: v.pipe(FiniteSchema, v.minValue(0), v.maxValue(5)),
  /** Ce qui reste une fois récolté, pour le rendu: rien, une souche, un arbre sans fruits. */
  after: v.picklist(['gone', 'stump', 'bare']),
  /** Jours avant la repousse ou la réapparition. */
  respawnDays: v.pipe(IntSchema, v.minValue(1), v.maxValue(56)),
  /** Le butin tombe au sol autour de la ressource (fruits secoués) au lieu d'aller dans les poches. */
  toGround: v.boolean(),
  /** Tirages par récolte; chaque tirage choisit une entrée possible maintenant. */
  rolls: v.pipe(IntSchema, v.minValue(1), v.maxValue(5)),
  loot: v.pipe(v.array(LootEntrySchema), v.minLength(1), v.maxLength(24)),
});
export type ResourceDef = v.InferOutput<typeof ResourceSchema>;

/** Une qualité de récolte: atteinte quand la part de jours arrosés vaut au moins `wateredShare`. */
export const CropQualitySchema = v.strictObject({
  wateredShare: v.pipe(FiniteSchema, v.minValue(0), v.maxValue(1)),
  item: IdSchema,
  count: v.pipe(IntSchema, v.minValue(1), v.maxValue(10)),
});

export const CropSchema = v.strictObject({
  schema: FileVersionSchema,
  id: IdSchema,
  name: LabelSchema,
  /** Graine qui la sème (objet de famille `seed`). */
  seed: IdSchema,
  /** Saisons où elle se sème et pousse; hors saison, elle attend sans mourir. Vide: toutes. */
  seasons: v.array(v.picklist(SEASONS)),
  /** Points de pousse de chaque stade avant la maturité (jour sec 1, arrosé 2). */
  stages: v.pipe(
    v.array(v.pipe(IntSchema, v.minValue(1), v.maxValue(12))),
    v.minLength(1),
    v.maxLength(5),
  ),
  /** Après récolte: stade où elle revient (récolte qui repousse), `null`: récolte unique. */
  regrowStage: v.nullable(v.pipe(IntSchema, v.minValue(0), v.maxValue(4))),
  /** Qualités, de la plus basse (`wateredShare` 0) à la meilleure. */
  qualities: v.pipe(v.array(CropQualitySchema), v.minLength(1), v.maxLength(4)),
});
export type CropDef = v.InferOutput<typeof CropSchema>;

/** Ce qui relie les cultures, ressources et outils au reste: chaque faute nomme son fichier. */
export function validateHarvestContent(content: Content): string[] {
  const problems: string[] = [];
  const item = (path: string, id: string): void => {
    if (content.items[id] === undefined) problems.push(`${path}: objet inconnu « ${id} »`);
  };
  const seeds = new Map<string, string>();
  for (const crop of Object.values(content.crops)) {
    const path = `commun/cultures/${crop.id}.json`;
    item(path, crop.seed);
    const other = seeds.get(crop.seed);
    if (other !== undefined)
      problems.push(`${path}: la graine « ${crop.seed} » sème déjà « ${other} »`);
    seeds.set(crop.seed, crop.id);
    for (const quality of crop.qualities) item(path, quality.item);
    if (crop.qualities[0]?.wateredShare !== 0)
      problems.push(`${path}, qualities: la première qualité demande « wateredShare » 0`);
    for (let i = 1; i < crop.qualities.length; i++) {
      if ((crop.qualities[i]?.wateredShare ?? 0) <= (crop.qualities[i - 1]?.wateredShare ?? 0))
        problems.push(`${path}, qualities: « wateredShare » doit croître`);
    }
    if (crop.regrowStage !== null && crop.regrowStage >= crop.stages.length)
      problems.push(`${path}: « regrowStage » au-delà des stades`);
  }
  for (const resource of Object.values(content.resources)) {
    const path = `commun/ressources/${resource.id}.json`;
    for (const entry of resource.loot) {
      item(path, entry.item);
      if (entry.max < entry.min) problems.push(`${path}, ${entry.item}: « max » sous « min »`);
    }
    if (resource.tool === null && resource.minTier > 0)
      problems.push(`${path}: « minTier » sans outil`);
  }
  for (const [id, prop] of Object.entries(content.props)) {
    for (const brick of prop.bricks) {
      if (brick.brick === 'harvest' && content.resources[brick.resource] === undefined)
        problems.push(`commun/meubles/${id}.json: ressource inconnue « ${brick.resource} »`);
    }
  }
  for (const def of Object.values(content.items)) {
    const work = def.tool?.work;
    if (work === undefined) continue;
    const path = `commun/objets/${def.id}.json, tool.work`;
    for (const cost of [work.upgrade?.cost, work.repair]) {
      for (const material of cost?.items ?? []) item(path, material.item);
    }
    if (work.upgrade !== null) {
      const next = content.items[work.upgrade.to]?.tool;
      if (next === undefined) item(path, work.upgrade.to);
      else if (next === null || next.kind !== def.tool?.kind)
        problems.push(`${path}: « ${work.upgrade.to} » n'est pas un outil de la même sorte`);
    }
  }
  return problems;
}
