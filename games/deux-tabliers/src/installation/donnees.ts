/**
 * Données du départ dans une cellule vide (démo v0.3, `docs/jeux/cosy-cafe/demo/depart-cellule-vide-v0-3.md`):
 * - `installation.json`: règles communes à toutes les adresses (durées, achats « Pour ouvrir »,
 *   besoins pour ouvrir, crédit, textes);
 * - `departs/<adresse>-cellule.json`, bloc `installation`: ce qui est propre au local (rideaux,
 *   draps, poussière, vitres, lots de l'ancienne patronne, emplacements des appareils, trottoir).
 * Chaque adresse a son fichier de départ: rien n'est écrit en dur pour le village.
 */
import { v } from '@duo/sdk';
import { readFile, type DataFiles } from '../donnees/charger';

const Str = v.pipe(v.string(), v.minLength(1));
const Pos = v.pipe(v.number(), v.minValue(0));
const Nat = v.pipe(v.number(), v.integer(), v.minValue(0));
const Point = v.tuple([v.number(), v.number()]);
const Spot3 = { x: v.number(), y: v.number(), z: v.number() };

const RulesSchema = v.strictObject({
  deliveryFirstSec: Pos,
  deliveryNextSec: Pos,
  deliveryJoinSec: Pos,
  heatSec: Pos,
  connectHoldSec: Pos,
  shutterHoldSec: Pos,
  sweepHoldSec: Pos,
  wipeHoldSec: Pos,
  buyHoldSec: Pos,
  returnHoldSec: Pos,
  chairsDownSec: Pos,
  soloLift: Pos,
  dustCleanliness: Pos,
  whitewashPassers: Pos,
  seatsAdvised: Nat,
  sweepRadius: Pos,
  spotReach: Pos,
  snapRadius: Pos,
  lookLineAfterSec: Pos,
  lookLineReach: Pos,
  budgetLineAbove: Pos,
  /** Fenêtre « Parfait » en plus avec la machine révisée (s). */
  perfectBonusSec: Pos,
});
export type InstallRules = v.InferOutput<typeof RulesSchema>;

const NeedId = v.picklist([
  'machine',
  'moulin',
  'caisse',
  'vaisselle',
  'frais',
  'thes',
  'viennoiseries',
  'places',
]);
export type NeedId = v.InferOutput<typeof NeedId>;

const PurchaseSchema = v.strictObject({
  id: Str,
  name: Str,
  price: Pos,
  need: NeedId,
  seller: v.picklist(['simone', 'gaby']),
  /** `en-place`: déjà dans le local (rien à porter); `simone`: posé tout de suite; `gaby`: livré. */
  delivery: v.picklist(['en-place', 'simone', 'gaby']),
  /** Type de meuble que devient le carton (appareil), `null` pour un lot de Simone. */
  furniture: v.nullable(Str),
  heavy: v.boolean(),
  dishes: Nat,
  lot: v.nullable(Str),
  exclusive: v.nullable(Str),
  text: Str,
});
export type InstallPurchase = v.InferOutput<typeof PurchaseSchema>;

const TextsSchema = v.strictObject({
  prologue: v.array(Str),
  note: Str,
  counter: Str,
  machine: Str,
  tables: Str,
  mail: Str,
  trace: Str,
  minimum: Str,
  budget: Str,
  gaby: Str,
  hot: Str,
  testedOld: Str,
  testedNew: Str,
  order: Str,
  name: Str,
  done: Str,
  noCoffee: Str,
  seatsReminder: Str,
  dustReminder: Str,
  panesReminder: Str,
  bigDay: Str,
  mails: v.array(v.tuple([Str, Str])),
  prompts: v.record(Str, Str),
  spots: v.record(Str, Str),
  occupied: Str,
  open: v.record(Str, Str),
  catalog: v.record(Str, Str),
  messages: v.record(Str, Str),
  evening: v.record(Str, Str),
  saveLabel: Str,
  guide: v.record(Str, Str),
});
export type InstallTexts = v.InferOutput<typeof TextsSchema>;

export const InstallationFileSchema = v.strictObject({
  rules: RulesSchema,
  purchases: v.array(PurchaseSchema),
  needs: v.array(v.strictObject({ id: NeedId, label: Str, short: Str, blocks: v.boolean() })),
  required: v.array(NeedId),
  credit: v.record(Str, Str),
  texts: TextsSchema,
});

const LotSchema = v.strictObject({
  id: Str,
  table: Str,
  chairs: Str,
  sheet: Str,
  seats: v.array(
    v.strictObject({ id: Str, type: Str, x: v.number(), z: v.number(), rotDeg: v.number() }),
  ),
  /** Décor qu'apporte le lot à l'ambiance: article du catalogue de la clientèle, nombre. */
  decor: v.array(v.tuple([Str, Nat])),
});
export type Lot = v.InferOutput<typeof LotSchema>;

const ApplianceSchema = v.strictObject({
  type: Str,
  /** Identifiant du meuble posé (celui que lisent le service et la clientèle). */
  id: Str,
  x: v.number(),
  z: v.number(),
  y: v.number(),
  rotDeg: v.number(),
  /** Clé de la phrase de refus (`texts.spots`). */
  reason: Str,
});
export type Appliance = v.InferOutput<typeof ApplianceSchema>;

/** Bloc `installation` d'un fichier de départ « cellule ». */
export const CellSchema = v.strictObject({
  economy: v.strictObject({
    startCash: Pos,
    /** Cadeau de Simone pour le café d'essai: ingrédient, unités (lot daté du jour 1). */
    simoneGift: v.array(v.tuple([Str, Pos])),
    startDecor: v.array(v.tuple([Str, Nat, v.boolean()])),
    /** Pièces de départ de l'aménagement gardées (ce qui est scellé au mur). */
    keepPieces: v.array(Str),
  }),
  simone: v.strictObject({ door: Point, counter: Point, why: Str }),
  shutters: v.array(v.strictObject({ id: Str, door: v.boolean() })),
  shutterHandle: v.strictObject({ ...Spot3, reach: Pos }),
  sheets: v.array(v.strictObject({ id: Str, covers: v.array(Str), ...Spot3 })),
  mail: v.strictObject({ id: Str, ...Spot3 }),
  tools: v.array(v.strictObject({ id: Str, tool: v.picklist(['broom', 'sponge']), ...Spot3 })),
  dust: v.array(Str),
  panes: v.array(v.strictObject({ id: Str, ...Spot3, sign: v.boolean() })),
  lots: v.array(LotSchema),
  oldMachine: Str,
  appliances: v.array(ApplianceSchema),
  machineParts: v.array(Str),
  serviceDeferred: v.array(Str),
  deliveryArea: v.tuple([v.number(), v.number(), Pos, Pos]),
  deliveryWhy: Str,
  nightCartonSpot: Point,
  nightCartonWhy: Str,
});
export type Cell = v.InferOutput<typeof CellSchema>;

export interface InstallationContent {
  readonly rules: InstallRules;
  readonly purchases: ReadonlyMap<string, InstallPurchase>;
  readonly purchaseList: readonly InstallPurchase[];
  readonly needs: v.InferOutput<typeof InstallationFileSchema>['needs'];
  readonly required: readonly NeedId[];
  readonly credit: Readonly<Record<string, string>>;
  readonly texts: InstallTexts;
  readonly cell: Cell;
}

/** Règles communes et bloc propre à l'adresse; `null` si l'adresse n'a pas de départ en cellule. */
export function loadInstallationContent(
  files: DataFiles,
  cell: Cell | null,
  issues: string[],
): InstallationContent | null {
  if (cell === null) return null;
  const file = readFile(files, 'installation.json', InstallationFileSchema, issues);
  if (file === null) return null;
  return {
    rules: file.rules,
    purchases: new Map(file.purchases.map((p) => [p.id, p])),
    purchaseList: file.purchases,
    needs: file.needs,
    required: file.required,
    credit: file.credit,
    texts: file.texts,
    cell,
  };
}

/** Prompt de l'installation (`texts.prompts`), avec ses gabarits remplis. */
export function prompt(
  content: InstallationContent,
  key: string,
  values: Readonly<Record<string, string | number>> = {},
): string {
  let text = content.texts.prompts[key] ?? key;
  for (const [k, value] of Object.entries(values)) text = text.replaceAll(`{${k}}`, String(value));
  return text;
}
