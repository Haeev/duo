/**
 * Données du chantier « amenagement »: `catalogue.json` (converti de la démo par
 * `outils/convertir-catalogue.py`) et `amenagement.json` (règles de pose, pièces, livraisons,
 * mobilier de Simone, extensions). Décrits dans `donnees/SCHEMA.md`, section « Aménagement ».
 * Chaque objet posable du catalogue devient aussi un type de meuble (`furnitureTypes`), ajouté
 * au catalogue des meubles par le chargeur: le cœur le dessine et en tient compte aux collisions.
 */
import { v } from '@duo/sdk';
import { readFile, type DataFiles } from '../donnees/charger';
import type { FurnitureType } from '../donnees/schemas';

const Id = v.pipe(
  v.string(),
  v.regex(/^[a-z0-9][a-z0-9-]*$/, 'identifiant: minuscules, chiffres, traits d’union'),
);
const ModelName = v.pipe(v.string(), v.regex(/^[a-z0-9][a-z0-9_-]*$/, 'nom de modèle'));
const Label = v.pipe(v.string(), v.minLength(1), v.maxLength(60));
const Color = v.pipe(v.string(), v.regex(/^#[0-9a-fA-F]{6}$/, 'couleur: #RRGGBB'));
const Positive = v.pipe(v.number(), v.minValue(0));
const Rect = v.tuple([v.number(), v.number(), Positive, Positive]);
const Point = v.tuple([v.number(), v.number()]);

export const STYLE_IDS = ['campagne', 'jardin', 'nordique', 'retro', 'bistrot', 'atelier'] as const;
export type StyleId = (typeof STYLE_IDS)[number];

export const PLACEMENTS = [
  'floor',
  'floor_terrace',
  'floor_wall',
  'floor_under',
  'wall',
  'ceiling',
  'surface',
  'counter',
  'counter_tip',
  'window_sill',
  'wall_cover',
  'floor_cover',
  'facade',
  'vitrine',
  'terrace',
  'terrace_store',
  'street',
] as const;
export type Placement = (typeof PLACEMENTS)[number];

const UnlockSchema = v.variant('kind', [
  v.strictObject({ kind: v.literal('tier'), tier: Id }),
  v.strictObject({ kind: v.literal('brocante') }),
  v.strictObject({ kind: v.literal('regular'), ref: Id }),
  v.strictObject({ kind: v.literal('event'), ref: Id }),
]);
export type Unlock = v.InferOutput<typeof UnlockSchema>;

const CatalogItemSchema = v.strictObject({
  id: Id,
  label: Label,
  model: ModelName,
  category: v.picklist([
    'seat',
    'table',
    'light',
    'plant',
    'frame',
    'rug',
    'shelf',
    'paint',
    'wallpaper',
    'floor',
    'counter_object',
    'sign',
    'terrace',
  ]),
  style: v.picklist([...STYLE_IDS, 'neutre']),
  price: Positive,
  charm: Positive,
  size: v.nullable(v.tuple([Positive, Positive, Positive])),
  placement: v.picklist(PLACEMENTS),
  rotationStep: v.picklist([0, 15, 90]),
  heavy: v.boolean(),
  unlock: UnlockSchema,
  text: v.pipe(v.string(), v.maxLength(200)),
  color: Color,
  seats: v.optional(
    v.strictObject({
      type: v.picklist(['table', 'comfort', 'counter']),
      count: v.pipe(v.number(), v.integer(), v.minValue(1)),
    }),
  ),
  renovationPrice: v.optional(Positive),
  priceUnit: v.optional(v.picklist(['wall', 'm2'])),
  charmPerM2: v.optional(v.boolean()),
  unique: v.optional(v.boolean()),
});
export type CatalogItem = v.InferOutput<typeof CatalogItemSchema>;

const CatalogFileSchema = v.strictObject({
  source: v.string(),
  styles: v.pipe(v.array(v.picklist(STYLE_IDS)), v.length(6)),
  tiers: v.array(v.strictObject({ id: Id, label: Label, cups: Positive, orDay: Positive })),
  brocante: v.strictObject({
    piecesPerMonday: v.pipe(v.number(), v.integer(), v.minValue(0)),
    discount: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
    charmFactor: Positive,
  }),
  ambiance: v.strictObject({
    decorMax: Positive,
    charmPerM2ForMax: Positive,
    coherenceMax: Positive,
    comfortFactor: Positive,
    comfortMax: Positive,
    lightPerM2: Positive,
    lightMax: Positive,
    musicMatching: Positive,
    musicOther: Positive,
    cleanlinessMax: Positive,
    wornCharmFactor: Positive,
    words: v.array(v.strictObject({ from: Positive, label: Label })),
  }),
  extensions: v.array(
    v.strictObject({
      id: Id,
      label: Label,
      price: Positive,
      tier: Id,
      nights: v.pipe(v.number(), v.integer(), v.minValue(1)),
      publicSurfaceM2: Positive,
      text: v.string(),
    }),
  ),
  items: v.array(CatalogItemSchema),
});

const PlanElementPatch = v.looseObject({
  id: v.string(),
  kind: v.string(),
  shape: v.union([
    v.strictObject({ rect: Rect }),
    v.strictObject({ circle: v.tuple([v.number(), v.number(), Positive]) }),
  ]),
  blocks: v.optional(v.boolean(), false),
});

const PlacedSpec = v.strictObject({
  id: v.string(),
  type: Id,
  x: v.number(),
  z: v.number(),
  rotDeg: v.number(),
});

const SurfaceSchema = v.strictObject({
  x: v.number(),
  z: v.number(),
  y: Positive,
  w: Positive,
  d: Positive,
  placement: v.picklist(['surface', 'counter']),
});
export type Surface = v.InferOutput<typeof SurfaceSchema>;

const ArrangementFileSchema = v.strictObject({
  rules: v.strictObject({
    grid: v.pipe(v.number(), v.minValue(0.05)),
    clearanceToSeat: Positive,
    mainAisle: Positive,
    minPassage: v.pipe(v.number(), v.minValue(0.6, 'jamais moins de 0,6 m (C13)')),
    seatReach: Positive,
    outletReach: Positive,
    waterReach: Positive,
    objectLimit: v.pipe(
      v.number(),
      v.integer(),
      v.minValue(1),
      v.maxValue(60, 'C6: 60 au village'),
    ),
    /** Achat important proposé à l'autre (DE-10, démo D5), si la clientèle ne fixe pas le sien. */
    bigPurchase: Positive,
    wallSnap: Positive,
    reach: Positive,
    ceiling: Positive,
    wallItemMinY: Positive,
    wallItemMaxY: Positive,
    storeHeight: Positive,
    facadeY: Positive,
    vitrineY: Positive,
  }),
  carry: v.strictObject({
    maxSpeed: v.pipe(v.number(), v.minValue(0.1), v.maxValue(1.2, 'C14: 1,2 m/s au plus')),
    turnDegPerSecond: Positive,
    handleGap: Positive,
    grabReach: Positive,
  }),
  cartons: v.strictObject({
    small: v.strictObject({
      label: Label,
      size: v.tuple([Positive, Positive, Positive]),
      color: Color,
    }),
    heavy: v.strictObject({
      label: Label,
      size: v.tuple([Positive, Positive, Positive]),
      color: Color,
    }),
  }),
  delivery: v.strictObject({ areas: v.array(Rect), why: v.string() }),
  rooms: v.array(
    v.strictObject({
      id: Id,
      label: Label,
      space: Rect,
      free: v.array(Rect),
      outdoor: v.boolean(),
      walls: v.pipe(v.number(), v.integer(), v.minValue(0)),
      surfaceM2: Positive,
      extension: v.nullable(Id),
      why: v.optional(v.string()),
    }),
  ),
  keepClear: v.array(
    v.strictObject({ zone: v.string(), reason: v.pipe(v.string(), v.maxLength(80)) }),
  ),
  entrance: Point,
  aisleTargets: v.array(Point),
  outlets: v.array(Point),
  /** Articles qui demandent une prise (`power`) ou un point d'eau (`water`), DE-04. */
  needs: v.record(Id, v.picklist(['power', 'water'])),
  waterPoints: v.array(Point),
  surfaces: v.record(Id, v.array(SurfaceSchema)),
  simone: v.record(
    Id,
    v.strictObject({
      item: v.nullable(Id),
      style: v.optional(v.picklist([...STYLE_IDS, 'neutre'])),
      charm: v.optional(Positive),
      worn: v.boolean(),
      renovationPrice: v.optional(Positive),
      why: v.optional(v.string()),
    }),
  ),
  startPieces: v.array(
    v.strictObject({
      item: Id,
      at: v.strictObject({
        kind: v.picklist(['wall', 'surface']),
        x: v.number(),
        z: v.number(),
        y: v.number(),
        rotDeg: v.number(),
        support: v.optional(v.string()),
      }),
      worn: v.optional(v.boolean()),
      why: v.string(),
    }),
  ),
  extensionWorks: v.record(
    Id,
    v.strictObject({
      planRemove: v.array(v.string()),
      planAdd: v.array(PlanElementPatch),
      planRestyle: v.optional(v.record(v.string(), v.string())),
      removeFurniture: v.array(v.string()),
      furniture: v.array(PlacedSpec),
      why: v.string(),
    }),
  ),
});
type ArrangementFile = v.InferOutput<typeof ArrangementFileSchema>;

const ZonesSchema = v.looseObject({
  levels: v.array(
    v.looseObject({
      zones: v.optional(
        v.array(
          v.looseObject({
            id: v.string(),
            kind: v.string(),
            shape: v.looseObject({ rect: v.optional(Rect) }),
          }),
        ),
        [],
      ),
    }),
  ),
});

export interface PieceInfo {
  /** Article du catalogue, ou `null` pour un meuble de Simone hors catalogue. */
  readonly item: CatalogItem | null;
  readonly style: StyleId | 'neutre';
  readonly charm: number;
  readonly worn: boolean;
  readonly renovationPrice: number;
  readonly category: CatalogItem['category'] | 'other';
  readonly seats: CatalogItem['seats'];
  readonly label: string;
  /** Modèle à afficher: celui de l'article (les chaises de Simone sont des chaises paillées). */
  readonly model: string | undefined;
}

export interface Extension {
  readonly id: string;
  readonly label: string;
  readonly price: number;
  readonly tier: string;
  readonly nights: number;
  readonly publicSurfaceM2: number;
  readonly text: string;
  readonly works: ArrangementFile['extensionWorks'][string];
}

export interface ArrangementContent {
  readonly items: ReadonlyMap<string, CatalogItem>;
  readonly styles: readonly StyleId[];
  readonly tiers: readonly { id: string; label: string; cups: number; orDay: number }[];
  readonly brocante: { piecesPerMonday: number; discount: number; charmFactor: number };
  readonly ambiance: v.InferOutput<typeof CatalogFileSchema>['ambiance'];
  readonly extensions: ReadonlyMap<string, Extension>;
  readonly rules: ArrangementFile['rules'];
  readonly carry: ArrangementFile['carry'];
  readonly cartons: ArrangementFile['cartons'];
  readonly delivery: ArrangementFile['delivery'];
  readonly rooms: ArrangementFile['rooms'];
  /** Zones à laisser libres, avec leur rectangle lu dans le plan. */
  /** Zones du personnel (comptoir, réserve): les clients n'y passent pas. */
  readonly staffZones: readonly (readonly [number, number, number, number])[];
  readonly keepClear: readonly {
    rect: readonly [number, number, number, number];
    reason: string;
  }[];
  readonly entrance: readonly [number, number];
  readonly aisleTargets: readonly (readonly [number, number])[];
  readonly outlets: readonly (readonly [number, number])[];
  readonly needs: Readonly<Record<string, 'power' | 'water'>>;
  readonly waterPoints: readonly (readonly [number, number])[];
  readonly surfaces: Readonly<Record<string, readonly Surface[]>>;
  readonly startPieces: ArrangementFile['startPieces'];
  /** Types de meubles des objets posables et des cartons, ajoutés au catalogue des meubles. */
  readonly furnitureTypes: readonly FurnitureType[];
  /** Style, charme et usure par type de meuble (catalogue et mobilier de Simone). */
  readonly pieces: ReadonlyMap<string, PieceInfo>;
}

export const CARTON_SMALL = 'carton';
export const CARTON_HEAVY = 'carton-lourd';

/** Revêtements: appliqués directement à une pièce, jamais posés comme un meuble. */
export function isCovering(item: CatalogItem): boolean {
  return item.placement === 'wall_cover' || item.placement === 'floor_cover';
}

const FLOOR_PLACEMENTS: ReadonlySet<Placement> = new Set([
  'floor',
  'floor_terrace',
  'floor_wall',
  'floor_under',
  'terrace',
  'street',
]);

export function isFloorItem(item: CatalogItem): boolean {
  return FLOOR_PLACEMENTS.has(item.placement);
}

function tableSlots(item: CatalogItem): FurnitureType['slots'] {
  if (item.category !== 'table' || item.size === null) return [];
  const [w, d, h] = item.size;
  // Deux places pour les tasses, comme les guéridons de Simone; quatre sur les grandes tables.
  if (w >= 1 || (w >= 0.8 && d >= 0.8))
    return [
      { id: 'a', x: -w / 4, y: h, z: -d / 4 },
      { id: 'b', x: w / 4, y: h, z: -d / 4 },
      { id: 'c', x: -w / 4, y: h, z: d / 4 },
      { id: 'd', x: w / 4, y: h, z: d / 4 },
    ];
  return [
    { id: 'a', x: -0.12, y: h, z: 0 },
    { id: 'b', x: 0.12, y: h, z: 0 },
  ];
}

function furnitureOf(item: CatalogItem): FurnitureType | null {
  if (item.size === null || isCovering(item)) return null;
  const [w, d, h] = item.size;
  const floor = isFloorItem(item);
  return {
    id: item.id,
    label: item.label,
    model: item.model,
    color: item.color,
    footprint: [w, d],
    height: h,
    kind: item.category === 'seat' ? 'seat' : item.category === 'table' ? 'table' : 'other',
    blocks: floor && item.placement !== 'floor_under',
    fixed: false,
    carry: item.heavy ? 'two' : 'one',
    price: item.price,
    slots: tableSlots(item),
    station: null,
    source: null,
  };
}

function cartonType(
  id: string,
  spec: ArrangementFile['cartons']['small'],
  heavy: boolean,
): FurnitureType {
  return {
    id,
    label: spec.label,
    color: spec.color,
    footprint: [spec.size[0], spec.size[1]],
    height: spec.size[2],
    kind: 'other',
    blocks: true,
    fixed: false,
    carry: heavy ? 'two' : 'one',
    price: 0,
    slots: [],
    station: null,
    source: null,
  };
}

const EMPTY: ArrangementContent = {
  items: new Map(),
  styles: STYLE_IDS,
  tiers: [],
  brocante: { piecesPerMonday: 0, discount: 0, charmFactor: 1 },
  ambiance: {
    decorMax: 0,
    charmPerM2ForMax: 1,
    coherenceMax: 0,
    comfortFactor: 0,
    comfortMax: 0,
    lightPerM2: 1,
    lightMax: 0,
    musicMatching: 0,
    musicOther: 0,
    cleanlinessMax: 0,
    wornCharmFactor: 1,
    words: [],
  },
  extensions: new Map(),
  rules: {
    grid: 0.25,
    clearanceToSeat: 0.9,
    mainAisle: 1.2,
    minPassage: 0.6,
    seatReach: 0.7,
    outletReach: 1.5,
    waterReach: 2,
    objectLimit: 60,
    bigPurchase: 150,
    wallSnap: 0.3,
    reach: 3.5,
    ceiling: 2.7,
    wallItemMinY: 0.9,
    wallItemMaxY: 2.5,
    storeHeight: 2.35,
    facadeY: 2.2,
    vitrineY: 1.55,
  },
  carry: { maxSpeed: 1.2, turnDegPerSecond: 60, handleGap: 0.35, grabReach: 1.6 },
  cartons: {
    small: { label: 'Carton', size: [0.5, 0.4, 0.4], color: '#b98b57' },
    heavy: { label: 'Gros carton', size: [1, 0.6, 0.6], color: '#a8784a' },
  },
  delivery: { areas: [], why: '' },
  rooms: [],
  keepClear: [],
  staffZones: [],
  entrance: [0, 0],
  aisleTargets: [],
  outlets: [],
  needs: {},
  waterPoints: [],
  surfaces: {},
  startPieces: [],
  furnitureTypes: [],
  pieces: new Map(),
};

export function loadArrangementContent(files: DataFiles, issues: string[]): ArrangementContent {
  const catalog = readFile(files, 'catalogue.json', CatalogFileSchema, issues);
  const file = readFile(files, 'amenagement.json', ArrangementFileSchema, issues);
  const plan = readFile(files, 'adresses/village.json', ZonesSchema, []);
  if (catalog === null || file === null) return EMPTY;

  const items = new Map<string, CatalogItem>();
  for (const item of catalog.items) {
    if (items.has(item.id)) issues.push(`catalogue.json: identifiant en double « ${item.id} »`);
    items.set(item.id, item);
    if (item.size === null && !isCovering(item))
      issues.push(`catalogue.json (${item.id}): dimensions absentes pour un objet posé`);
  }
  const furnitureTypes: FurnitureType[] = [];
  const pieces = new Map<string, PieceInfo>();
  for (const item of items.values()) {
    const type = furnitureOf(item);
    if (type !== null) furnitureTypes.push(type);
    pieces.set(item.id, {
      item,
      style: item.style,
      charm: item.charm,
      worn: false,
      renovationPrice: item.renovationPrice ?? 0,
      category: item.category,
      seats: item.seats,
      label: item.label,
      model: item.model,
    });
  }
  furnitureTypes.push(
    cartonType(CARTON_SMALL, file.cartons.small, false),
    cartonType(CARTON_HEAVY, file.cartons.heavy, true),
  );
  for (const [typeId, s] of Object.entries(file.simone)) {
    const item = s.item === null ? null : (items.get(s.item) ?? null);
    if (s.item !== null && item === null)
      issues.push(`amenagement.json (simone.${typeId}): objet inconnu « ${s.item} »`);
    pieces.set(typeId, {
      item,
      style: item?.style ?? s.style ?? 'neutre',
      charm: item?.charm ?? s.charm ?? 0,
      worn: s.worn,
      renovationPrice: s.renovationPrice ?? item?.renovationPrice ?? 0,
      category: item?.category ?? (typeId.includes('table') ? 'table' : 'seat'),
      seats: item?.seats ?? { type: 'table', count: 1 },
      label: item?.label ?? typeId,
      model: item?.model,
    });
  }
  const extensions = new Map<string, Extension>();
  for (const x of catalog.extensions) {
    const works = file.extensionWorks[x.id];
    if (works === undefined) {
      issues.push(`amenagement.json: travaux de l'extension « ${x.id} » absents`);
      continue;
    }
    extensions.set(x.id, { ...x, works });
  }
  for (const room of file.rooms)
    if (room.extension !== null && !extensions.has(room.extension))
      issues.push(`amenagement.json (${room.id}): extension inconnue « ${room.extension} »`);
  const zones = new Map<string, readonly [number, number, number, number]>();
  const staffZones: (readonly [number, number, number, number])[] = [];
  for (const level of plan?.levels ?? [])
    for (const z of level.zones) {
      if (z.shape.rect === undefined) continue;
      zones.set(z.id, z.shape.rect);
      if (z.kind === 'work' || z.kind === 'private') staffZones.push(z.shape.rect);
    }
  const keepClear: { rect: readonly [number, number, number, number]; reason: string }[] = [];
  for (const k of file.keepClear) {
    const rect = zones.get(k.zone);
    if (rect === undefined) issues.push(`amenagement.json: zone du plan inconnue « ${k.zone} »`);
    else keepClear.push({ rect, reason: k.reason });
  }
  for (const p of file.startPieces)
    if (!items.has(p.item))
      issues.push(`amenagement.json (startPieces): objet inconnu « ${p.item} »`);
  if (catalog.styles.some((s, i) => s !== STYLE_IDS[i]))
    issues.push('catalogue.json (styles): la roue doit suivre l’ordre du cahier (AM-02)');
  for (const [support, list] of Object.entries(file.surfaces))
    if (list.length === 0) issues.push(`amenagement.json (surfaces.${support}): liste vide`);

  return {
    items,
    styles: catalog.styles,
    tiers: catalog.tiers,
    brocante: catalog.brocante,
    ambiance: catalog.ambiance,
    extensions,
    rules: file.rules,
    carry: file.carry,
    cartons: file.cartons,
    delivery: file.delivery,
    rooms: file.rooms,
    keepClear,
    staffZones,
    entrance: file.entrance,
    aisleTargets: file.aisleTargets,
    outlets: file.outlets,
    needs: file.needs,
    waterPoints: file.waterPoints,
    surfaces: file.surfaces,
    startPieces: file.startPieces,
    furnitureTypes,
    pieces,
  };
}
