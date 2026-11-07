// Données du chantier « service » (`donnees/service/*.json`, décrites dans `donnees/SCHEMA.md`,
// section « Service »). Recettes, ingrédients et achats viennent du game designer
// (`docs/jeux/cosy-cafe/demo/donnees/`), convertis par `outils/service-donnees.mjs`.
import { v } from '@duo/sdk';
import { ContentError, readFile, type DataFiles } from '../donnees/charger';
import { FurnitureFileSchema, ObjectsFileSchema, StationsFileSchema } from '../donnees/schemas';

const Id = v.pipe(
  v.string(),
  v.regex(/^[a-z0-9][a-z0-9-]*$/, 'identifiant: minuscules, chiffres, traits d’union'),
);
const Label = v.pipe(v.string(), v.minLength(1), v.maxLength(80));
const Positive = v.pipe(v.number(), v.minValue(0));
const Seconds3 = v.tuple([Positive, Positive, Positive]);
const Range = v.tuple([v.number(), v.number()]);

/** Postes du game designer, tels qu'écrits dans les recettes. */
export const GD_STATIONS = [
  'espresso',
  'vapeur',
  'bouilloire',
  'vitrine',
  'plan',
  'frigo',
  'agrumes',
  'creperie',
] as const;
export type GdStation = (typeof GD_STATIONS)[number];

export const VESSELS = ['tasse', 'verre', 'assiette'] as const;
export type Vessel = (typeof VESSELS)[number];

const RecipeSchema = v.strictObject({
  id: Id,
  label: Label,
  family: Id,
  price: Positive,
  cost: Positive,
  vessel: v.picklist(VESSELS),
  dishes: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(4)),
  ingredients: v.array(v.strictObject({ id: Id, qty: Positive })),
  steps: v.pipe(
    v.array(
      v.strictObject({
        station: v.picklist(GD_STATIONS),
        /** Par niveau du poste: à la main, machine, machine avancée. */
        activeSeconds: Seconds3,
        passiveSeconds: Seconds3,
        finishSeconds: Seconds3,
        /** Thé: température de l'eau visée (CO-05). */
        waterC: v.optional(Positive),
      }),
    ),
    v.minLength(1),
  ),
  unlock: v.variant('kind', [
    v.strictObject({ kind: v.literal('start') }),
    v.strictObject({ kind: v.literal('purchase'), item: Id }),
    v.strictObject({ kind: v.literal('regular'), regular: Id, level: Positive }),
  ]),
  options: v.array(Id),
});
export type Recipe = v.InferOutput<typeof RecipeSchema>;
export type RecipeStep = Recipe['steps'][number];

const IngredientSchema = v.strictObject({
  id: Id,
  label: Label,
  unit: v.string(),
  unitCost: Positive,
  supplier: Id,
  storage: v.picklist(['frigo', 'reserve', 'vitrine']),
  shelfDays: Positive,
  cartonUnits: v.pipe(v.number(), v.minValue(1)),
  heavy: v.boolean(),
});
export type Ingredient = v.InferOutput<typeof IngredientSchema>;

const EffectSchema = v.variant('kind', [
  v.strictObject({
    kind: v.literal('station-level'),
    station: v.picklist(GD_STATIONS),
    level: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(3)),
  }),
  v.strictObject({ kind: v.literal('recipe'), recipe: Id }),
  v.strictObject({ kind: v.literal('dishes'), count: v.pipe(v.number(), v.integer()) }),
  v.strictObject({ kind: v.literal('equip'), equip: Id }),
]);
export type ServiceEffect = v.InferOutput<typeof EffectSchema>;

const PurchaseSchema = v.strictObject({
  id: Id,
  label: Label,
  price: Positive,
  tier: Id,
  effects: v.array(EffectSchema),
  furniture: v.nullable(Id),
  text: v.string(),
});
export type Purchase = v.InferOutput<typeof PurchaseSchema>;

const Placement = v.strictObject({
  id: v.string(),
  type: Id,
  /** Meuble posé qui porte celui-ci (coordonnées locales), ou `null` (coordonnées du monde). */
  anchor: v.nullable(v.string()),
  x: v.number(),
  z: v.number(),
  y: v.number(),
  rotDeg: v.number(),
});
export type Placement = v.InferOutput<typeof Placement>;

const SettingsSchema = v.strictObject({
  stationOf: v.record(v.picklist(GD_STATIONS), Id),
  levels: v.record(
    Id,
    v.strictObject({
      station: v.picklist(GD_STATIONS),
      level: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(3)),
    }),
  ),
  installation: v.array(Placement),
  purchaseSpots: v.record(
    Id,
    v.union([v.strictObject({ replaces: Id }), v.omit(Placement, ['type'])]),
  ),
  gestures: v.strictObject({
    grind: v.strictObject({
      holdSeconds: Positive,
      maxDoses: v.pipe(v.number(), v.integer(), v.minValue(1)),
      dosesPerClick: v.pipe(v.number(), v.integer(), v.minValue(1)),
    }),
    extraction: v.strictObject({
      underSeconds: Positive,
      perfectSeconds: Positive,
      goodSeconds: Positive,
      autoStopSeconds: Positive,
      assistStopAfterSeconds: Positive,
    }),
    steam: v.strictObject({
      startC: v.number(),
      minC: v.number(),
      perfectC: Range,
      goodC: Range,
      cutC: v.number(),
      assistC: v.number(),
    }),
    kettle: v.strictObject({
      startC: v.number(),
      maxC: v.number(),
      degreesPerSecond: Positive,
      perfectDeltaC: Positive,
      goodDeltaC: Positive,
    }),
    cook: v.strictObject({ goldenSeconds: Positive, autoStopSeconds: Positive }),
    order: v.strictObject({ seconds: Positive, perExtraArticle: Positive }),
    wash: v.strictObject({ secondsPerPiece: Positive }),
    dishwasher: v.strictObject({
      capacity: v.pipe(v.number(), v.integer(), v.minValue(1)),
      cycleSeconds: Positive,
    }),
  }),
  vessels: v.strictObject({
    tasse: v.strictObject({ clean: Id, dirty: Id }),
    verre: v.strictObject({ clean: Id, dirty: Id }),
    assiette: v.strictObject({ clean: Id, dirty: Id }),
  }),
  cleanAtStart: v.strictObject({
    tasse: v.pipe(v.number(), v.integer(), v.minValue(0)),
    verre: v.pipe(v.number(), v.integer(), v.minValue(0)),
    assiette: v.pipe(v.number(), v.integer(), v.minValue(0)),
  }),
  afterEspresso: Id,
  storage: v.strictObject({
    frigo: v.array(Id),
    reserve: v.array(Id),
    vitrine: v.array(Id),
  }),
  passe: v.array(Id),
  palette: Id,
  cartons: v.strictObject({ light: Id, heavy: Id }),
  startCartons: v.pipe(v.number(), v.integer(), v.minValue(0)),
});
export type ServiceSettings = v.InferOutput<typeof SettingsSchema>;

export interface ServiceContent {
  readonly recipes: ReadonlyMap<string, Recipe>;
  readonly ingredients: ReadonlyMap<string, Ingredient>;
  readonly purchases: ReadonlyMap<string, Purchase>;
  readonly settings: ServiceSettings;
  /** Type d'objet propre ou sale vers sa sorte de vaisselle. */
  readonly vesselOf: ReadonlyMap<string, { readonly vessel: Vessel; readonly dirty: boolean }>;
}

function mapById<T extends { readonly id: string }>(
  list: readonly T[],
  path: string,
  issues: string[],
): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of list) {
    if (map.has(item.id)) issues.push(`${path}: identifiant en double « ${item.id} »`);
    map.set(item.id, item);
  }
  return map;
}

export function loadServiceContent(files: DataFiles, issues: string[]): ServiceContent {
  const recipesFile = readFile(
    files,
    'service/recettes.json',
    v.strictObject({ recipes: v.array(RecipeSchema) }),
    issues,
  );
  const ingredientsFile = readFile(
    files,
    'service/ingredients.json',
    v.strictObject({ ingredients: v.array(IngredientSchema) }),
    issues,
  );
  const purchasesFile = readFile(
    files,
    'service/equipements.json',
    v.strictObject({ purchases: v.array(PurchaseSchema) }),
    issues,
  );
  const settings = readFile(files, 'service/reglages.json', SettingsSchema, issues);
  if (
    recipesFile === null ||
    ingredientsFile === null ||
    purchasesFile === null ||
    settings === null
  )
    throw new ContentError(issues);

  const recipes = mapById(recipesFile.recipes, 'service/recettes.json', issues);
  const ingredients = mapById(ingredientsFile.ingredients, 'service/ingredients.json', issues);
  const purchases = mapById(purchasesFile.purchases, 'service/equipements.json', issues);

  // Contrôles croisés avec les fichiers communs (relus ici: le chargeur commun les lit après).
  const objects = new Set<string>();
  const parsedObjects = v.safeParse(ObjectsFileSchema, files['objets.json']);
  if (parsedObjects.success) for (const o of parsedObjects.output.objects) objects.add(o.id);
  const furniture = new Map<string, { station: string | null }>();
  const parsedFurniture = v.safeParse(FurnitureFileSchema, files['meubles.json']);
  if (parsedFurniture.success)
    for (const f of parsedFurniture.output.furniture) furniture.set(f.id, { station: f.station });
  const stations = new Set<string>();
  const parsedStations = v.safeParse(StationsFileSchema, files['postes.json']);
  if (parsedStations.success) for (const s of parsedStations.output.stations) stations.add(s.id);

  const need = (ok: boolean, message: string): void => {
    if (!ok) issues.push(message);
  };
  for (const r of recipes.values()) {
    need(
      objects.has(r.id),
      `service/recettes.json (${r.id}): objet « ${r.id} » absent d'objets.json`,
    );
    for (const i of r.ingredients)
      need(
        ingredients.has(i.id),
        `service/recettes.json (${r.id}): ingrédient inconnu « ${i.id} »`,
      );
    if (r.unlock.kind === 'purchase')
      need(
        purchases.has(r.unlock.item),
        `service/recettes.json (${r.id}): achat inconnu « ${r.unlock.item} »`,
      );
  }
  for (const gd of GD_STATIONS) {
    const s = settings.stationOf[gd];
    need(
      s !== undefined && stations.has(s),
      `service/reglages.json (stationOf.${gd}): poste inconnu « ${s ?? 'absent'} »`,
    );
  }
  for (const p of purchases.values()) {
    if (p.furniture !== null)
      need(
        furniture.has(p.furniture),
        `service/equipements.json (${p.id}): meuble inconnu « ${p.furniture} »`,
      );
    for (const e of p.effects)
      if (e.kind === 'recipe')
        need(recipes.has(e.recipe), `service/equipements.json (${p.id}): recette « ${e.recipe} »`);
  }
  for (const place of settings.installation)
    need(furniture.has(place.type), `service/reglages.json: meuble inconnu « ${place.type} »`);
  for (const [type, spot] of Object.entries(settings.purchaseSpots)) {
    need(furniture.has(type), `service/reglages.json (purchaseSpots): meuble inconnu « ${type} »`);
    if ('replaces' in spot)
      need(
        furniture.has(spot.replaces),
        `service/reglages.json: meuble inconnu « ${spot.replaces} »`,
      );
  }
  const vesselOf = new Map<string, { vessel: Vessel; dirty: boolean }>();
  for (const k of VESSELS) {
    const { clean, dirty } = settings.vessels[k];
    need(objects.has(clean) && objects.has(dirty), `service/reglages.json: vaisselle « ${k} »`);
    vesselOf.set(clean, { vessel: k, dirty: false });
    vesselOf.set(dirty, { vessel: k, dirty: true });
  }
  for (const id of [settings.afterEspresso, settings.cartons.light, settings.cartons.heavy])
    need(objects.has(id), `service/reglages.json: objet inconnu « ${id} »`);
  for (const id of [settings.palette, ...settings.passe, ...Object.values(settings.storage).flat()])
    need(furniture.has(id), `service/reglages.json: meuble inconnu « ${id} »`);

  return { recipes, ingredients, purchases, settings, vesselOf };
}
