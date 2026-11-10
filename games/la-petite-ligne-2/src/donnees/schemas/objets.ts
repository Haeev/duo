/** `donnees/commun/objets.json`: tout ce qui tient dans une case (cahier 4.5). */
import * as v from 'valibot';
import { FileVersionSchema, FiniteSchema, IdSchema, IntSchema, LabelSchema } from './communs';

export const ITEM_FAMILIES = ['food', 'material', 'crop', 'catch', 'treasure', 'seed', 'supply', 'tool', 'furniture', 'clothing'] as const;

/** Un outil: celui de base ne s'use pas et travaille lentement (réponse 19). */
export const ToolSchema = v.strictObject({
  kind: v.picklist(['axe', 'spade', 'can', 'rod', 'net', 'hammer']),
  /** Usages avant d'être émoussé; 0: outil de base, inusable. */
  durability: v.pipe(IntSchema, v.minValue(0), v.maxValue(1000)),
  /** Durée d'un geste, en secondes, outil en état puis émoussé. */
  gestureSeconds: v.pipe(FiniteSchema, v.minValue(0.2), v.maxValue(1.5)),
  bluntGestureSeconds: v.pipe(FiniteSchema, v.minValue(0.2), v.maxValue(1.5)),
});

export const ItemSchema = v.strictObject({
  id: IdSchema,
  name: LabelSchema,
  family: v.picklist(ITEM_FAMILIES),
  /** Pile maximale dans une case (1: ne s'empile pas). */
  stack: v.pipe(IntSchema, v.minValue(1), v.maxValue(99)),
  /** Points de faim rendus en le mangeant, `null` s'il ne se mange pas. */
  food: v.nullable(v.strictObject({ hunger: v.pipe(FiniteSchema, v.minValue(1), v.maxValue(100)) })),
  tool: v.nullable(ToolSchema),
});
export type ItemDef = v.InferOutput<typeof ItemSchema>;

export const ItemsFileSchema = v.strictObject({
  schema: FileVersionSchema,
  items: v.pipe(v.array(ItemSchema), v.minLength(1)),
});
