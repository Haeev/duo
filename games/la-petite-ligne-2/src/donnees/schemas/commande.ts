/**
 * Commande de la semaine et courrier (cahier 4.1, train du samedi). Trois fichiers par lieu, tous
 * facultatifs: `lieux/<lieu>/commande.json` (le guichet: quel événement amène qui reçoit, combien
 * de lignes, où va l'argent, ses répliques), `lieux/<lieu>/commandes/<table>.json` (les lignes
 * possibles, par métier) et `lieux/<lieu>/lettres/<id>.json` (le courrier). Moteur:
 * `src/simulation/commandes/`.
 */
import * as v from 'valibot';
import {
  CentsSchema,
  FileVersionSchema,
  IdSchema,
  IntSchema,
  LabelSchema,
  TextSchema,
} from './communs';
import { ConditionSchema, EffectSchema } from './regles';

const Count = v.pipe(IntSchema, v.minValue(1), v.maxValue(99));
/** Prix d'une unité livrée, en centimes, multiple de 10 (0,10 € au moins). */
const UnitPrice = v.pipe(
  CentsSchema,
  v.minValue(10),
  v.check((cents) => cents % 10 === 0, 'prix: un multiple de 10 centimes'),
);
const Why = v.exactOptional(v.pipe(v.string(), v.maxLength(600)));

/**
 * Une ligne possible: l'objet, la quantité tirée entre `count.min` et `count.max`, le prix payé
 * par unité livrée. Elle ne sort au tirage que si le duo a déjà eu l'objet entre les mains (récolté,
 * pêché, cuisiné, reçu: fait `objets.obtenu.<objet>`) et si `when` est vrai.
 */
export const OrderLineSchema = v.pipe(
  v.strictObject({
    /** Unique dans le lieu, toutes tables confondues (c'est la clé de la ligne dans la mémoire). */
    id: IdSchema,
    item: IdSchema,
    count: v.strictObject({ min: Count, max: Count }),
    price: UnitPrice,
    when: v.array(ConditionSchema),
  }),
  v.check((line) => line.count.min <= line.count.max, 'count: min au-delà de max'),
);
export type OrderLineDef = v.InferOutput<typeof OrderLineSchema>;

/** Une table de lignes (un métier: potager, pêche, cuisine...). */
export const OrderTableSchema = v.strictObject({
  schema: FileVersionSchema,
  id: IdSchema,
  /** Nom court affiché à côté de la ligne (« Potager »). */
  name: LabelSchema,
  pourquoi: Why,
  lines: v.pipe(v.array(OrderLineSchema), v.minLength(1), v.maxLength(40)),
});
export type OrderTableDef = v.InferOutput<typeof OrderTableSchema>;

/** Où va l'argent d'une ligne livrée: le coffre commun, ou la bourse de qui livre. */
export const ORDER_PAY = ['chest', 'deliverer'] as const;
export type OrderPay = (typeof ORDER_PAY)[number];

/** Le guichet de la commande d'un lieu (`lieux/<lieu>/commande.json`). */
export const OrderDeskSchema = v.pipe(
  v.strictObject({
    schema: FileVersionSchema,
    /** Événement du calendrier du lieu pendant lequel on livre (le train du samedi). */
    event: IdSchema,
    /** L'habitant qui reçoit la commande et remet le courrier, à la fin de chaque conversation. */
    receiver: IdSchema,
    /** Conditions pour que les commandes commencent (fait d'histoire); [] = toujours. */
    when: v.array(ConditionSchema),
    /** Nombre de lignes de chaque commande, reports compris. */
    lines: v.strictObject({
      min: v.pipe(IntSchema, v.minValue(1), v.maxValue(8)),
      max: v.pipe(IntSchema, v.minValue(1), v.maxValue(8)),
    }),
    pay: v.picklist(ORDER_PAY),
    /** Rangements de la carte (brique `store`) où la livraison puise après le sac: la consigne. */
    stores: v.array(IdSchema),
    /** Lettres qui arrivent au plus par passage de l'événement. */
    mailPerVisit: v.pipe(IntSchema, v.minValue(0), v.maxValue(6)),
    /** Page proposée à la fin de chaque conversation avec `receiver` (comme `talk` d'un commerce). */
    talk: v.strictObject({ open: LabelSchema, leave: LabelSchema }),
    /** Répliques de `receiver` dans l'écran de livraison, dans sa voix. */
    says: v.strictObject({
      open: TextSchema,
      thanks: TextSchema,
      partial: TextSchema,
      nothing: TextSchema,
      mail: TextSchema,
    }),
    pourquoi: Why,
  }),
  v.check((desk) => desk.lines.min <= desk.lines.max, 'lines: min au-delà de max'),
);
export type OrderDeskDef = v.InferOutput<typeof OrderDeskSchema>;

/** Une lettre du courrier (`lieux/<lieu>/lettres/<id>.json`). */
export const LetterSchema = v.strictObject({
  schema: FileVersionSchema,
  id: IdSchema,
  /** Expéditeur, lu sur l'enveloppe. */
  from: LabelSchema,
  /** Rang d'arrivée quand plusieurs lettres attendent le même passage (le plus petit d'abord). */
  order: v.pipe(IntSchema, v.minValue(0), v.maxValue(999)),
  /** Conditions pour qu'elle parte vers le lieu; [] = au premier passage. */
  when: v.array(ConditionSchema),
  /** Paragraphes, dans l'ordre. */
  text: v.pipe(v.array(TextSchema), v.minLength(1), v.maxLength(5)),
  signature: LabelSchema,
  /** Ce que contient l'enveloppe, lu sous la lettre (« un sachet de graines »); absent: rien. */
  enclosed: v.exactOptional(LabelSchema),
  /** Effets appliqués une fois, à qui prend le courrier (objets, argent, recette, souvenir). */
  attach: v.array(EffectSchema),
  pourquoi: Why,
});
export type LetterDef = v.InferOutput<typeof LetterSchema>;
