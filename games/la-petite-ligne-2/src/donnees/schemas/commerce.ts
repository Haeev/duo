/**
 * `donnees/lieux/<lieu>/commerces/<id>.json`: un commerçant vend sa liste et ne rachète que ce
 * qui touche à son métier, à son prix (réponse 34, cahier 4.6). Prix en centimes d'euro, multiples
 * de 10 (tout prix affiché tombe sur 0,10 €). Moteur: `src/simulation/commerces/`.
 */
import * as v from 'valibot';
import {
  CentsSchema,
  FileVersionSchema,
  FiniteSchema,
  IdSchema,
  IntSchema,
  LabelSchema,
  TextSchema,
} from './communs';
import { ITEM_FAMILIES } from './objets';
import { ConditionSchema } from './regles';

/** Prix en centimes, multiple de 10 centimes, 0,10 € au moins. */
const Price = v.pipe(
  CentsSchema,
  v.minValue(10),
  v.multipleOf(10, 'prix: multiple de 10 centimes'),
);
const MinuteOfDay = v.pipe(IntSchema, v.minValue(0), v.maxValue(1440));

/**
 * Qui paie un article: `purse` sa bourse (par défaut); `purse-or-chest` la bourse ou, au choix,
 * le coffre commun (un meuble); `household` le coffre commun, complété par la bourse (pièces de
 * la maison, cuisine, salle d'eau, établi: cahier 4.6).
 */
export const PAYMENTS = ['purse', 'purse-or-chest', 'household'] as const;
export type Payment = (typeof PAYMENTS)[number];

export const ShopSellSchema = v.strictObject({
  item: IdSchema,
  price: Price,
  /** Exemplaires disponibles par réassort, ou `null` (sans limite). */
  dailyStock: v.nullable(v.pipe(IntSchema, v.minValue(1), v.maxValue(999))),
  /** Jours entre deux réassorts (1: chaque matin). Absent: 1. */
  restockDays: v.exactOptional(v.pipe(IntSchema, v.minValue(1), v.maxValue(28))),
  /** L'article n'apparaît qu'une fois la condition vraie pour ce joueur (fait d'histoire, amitié). */
  unlock: v.exactOptional(ConditionSchema),
  payment: v.exactOptional(v.picklist(PAYMENTS)),
});
export type ShopSell = v.InferOutput<typeof ShopSellSchema>;

/** Le commerçant ne rachète cette ligne qu'une fois la condition vraie pour ce joueur (fait d'histoire, amitié). */
const BuyUnlock = { unlock: v.exactOptional(ConditionSchema) } as const;

/** Rachats: par objet précis (prix, ou coefficient du prix de sa famille ici) ou par famille. */
export const ShopBuySchema = v.union([
  v.strictObject({ item: IdSchema, price: Price, ...BuyUnlock }),
  /** Coefficient du prix de la famille de l'objet dans ce même commerce (ligne `family` requise). */
  v.strictObject({
    item: IdSchema,
    factor: v.pipe(FiniteSchema, v.minValue(0.1), v.maxValue(5)),
    ...BuyUnlock,
  }),
  v.strictObject({ family: v.picklist(ITEM_FAMILIES), price: Price, ...BuyUnlock }),
]);
export type ShopBuy = v.InferOutput<typeof ShopBuySchema>;

export const ShopSchema = v.strictObject({
  schema: FileVersionSchema,
  id: IdSchema,
  name: LabelSchema,
  /** L'habitant qui tient le commerce. */
  keeper: IdSchema,
  /** Picto du métier sur la plaque du commerçant (sprite de l'interface); absent: une échoppe. */
  icon: v.exactOptional(IdSchema),
  /** Heures d'ouverture, en minutes depuis minuit; la plage peut passer minuit. */
  hours: v.strictObject({ from: MinuteOfDay, to: MinuteOfDay }),
  /**
   * Commerce conditionné par l'histoire: fermé (ni achat ni vente, comptoir compris) tant qu'une
   * de ces conditions est fausse (le commerçant n'est pas encore arrivé). Absent: toujours tenu.
   */
  when: v.exactOptional(v.pipe(v.array(ConditionSchema), v.minLength(1), v.maxLength(8))),
  sells: v.array(ShopSellSchema),
  /** Le plus précis l'emporte: objet, puis famille. Rien d'autre n'est racheté. */
  buys: v.array(ShopBuySchema),
  /** Ce que le commerçant dépense au plus par jour en rachats, en centimes. Absent: sans plafond. */
  dailyBuyCap: v.exactOptional(v.pipe(CentsSchema, v.minValue(10))),
  /** Candidats au besoin du jour (payé plus cher, cahier 4.6). Absent: les objets de `buys`. */
  dailyNeeds: v.exactOptional(v.pipe(v.array(IdSchema), v.minLength(1))),
  /** Bonus d'amitié sur les rachats: à partir de `hearts` cœurs du joueur, prix multiplié par `factor`. */
  friendship: v.exactOptional(
    v.array(
      v.strictObject({
        hearts: v.pipe(IntSchema, v.minValue(1), v.maxValue(5)),
        factor: v.pipe(FiniteSchema, v.minValue(1), v.maxValue(1.5)),
      }),
    ),
  ),
  /** Ce qu'il dit, avec son caractère, d'un objet qu'il ne rachète pas (« Ça sent la vase. »). */
  refusal: v.exactOptional(TextSchema),
  /**
   * Répliques de comptoir, dites dans l'écran de boutique (`shopSays` de
   * `simulation/commerces/prix.ts`): après un achat du joueur (`bought`), après une vente
   * (`sold`), quand l'argent manque (`noMoney`). Absente: le texte commun de l'écran.
   */
  lines: v.exactOptional(
    v.strictObject({
      bought: v.exactOptional(TextSchema),
      sold: v.exactOptional(TextSchema),
      noMoney: v.exactOptional(TextSchema),
    }),
  ),
  /**
   * Choix offert à la fin de toute conversation avec le commerçant, boutique ouverte, quand le
   * dialogue joué ne l'ouvre pas lui-même (`simulation/dialogues/`): `open` ouvre la boutique,
   * `leave` clôt. Ainsi un dialogue de quête ne masque jamais le commerce.
   */
  talk: v.exactOptional(v.strictObject({ open: TextSchema, leave: TextSchema })),
});
export type ShopDef = v.InferOutput<typeof ShopSchema>;
