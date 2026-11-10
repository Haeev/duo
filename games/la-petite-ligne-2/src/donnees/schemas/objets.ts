/** `donnees/commun/objets/<id>.json`: tout ce qui tient dans une case (cahier 4.5). Un fichier par objet. */
import * as v from 'valibot';
import { ToolKindSchema } from './briques';
import { ToolWorkSchema } from './recolte';
import { FileVersionSchema, FiniteSchema, IdSchema, IntSchema, LabelSchema } from './communs';

export const ITEM_FAMILIES = [
  'food',
  'material',
  'crop',
  'catch',
  'treasure',
  'seed',
  'supply',
  'tool',
  'furniture',
  'clothing',
  'bag',
] as const;

/** Un outil: celui de base ne s'use pas et travaille lentement (réponse 19). */
export const ToolSchema = v.strictObject({
  kind: ToolKindSchema,
  /** Usages avant d'être émoussé; 0: outil de base, inusable. */
  durability: v.pipe(IntSchema, v.minValue(0), v.maxValue(1000)),
  /** Durée d'un geste, en secondes, outil en état puis émoussé. */
  gestureSeconds: v.pipe(FiniteSchema, v.minValue(0.2), v.maxValue(1.5)),
  bluntGestureSeconds: v.pipe(FiniteSchema, v.minValue(0.2), v.maxValue(1.5)),
  /** Niveau, puissance par coup, amélioration et réparation (`recolte.ts`); absent: outil de base. */
  work: v.exactOptional(ToolWorkSchema),
});

/** Bonus exclusif d'un repas spécial pris à deux (cahier 4.4, R26): vocabulaire du moteur, pas un plat. */
export const MEAL_PERKS = [
  'extra_catch',
  'no_tool_wear',
  'better_prices',
  'night_rare_glow',
] as const;
export const MealPerkSchema = v.picklist(MEAL_PERKS);
export type MealPerk = (typeof MEAL_PERKS)[number];

export const ItemSchema = v.strictObject({
  schema: FileVersionSchema,
  id: IdSchema,
  name: LabelSchema,
  /** Modèle 3D (`assets-src/objets/gabarits.toml`); absent: vignette générique provisoire. */
  model: v.exactOptional(IdSchema),
  family: v.picklist(ITEM_FAMILIES),
  /** Pile maximale dans une case (1: ne s'empile pas). */
  stack: v.pipe(IntSchema, v.minValue(1), v.maxValue(99)),
  /** Points de faim rendus en le mangeant, `null` s'il ne se mange pas. */
  food: v.nullable(
    v.strictObject({ hunger: v.pipe(FiniteSchema, v.minValue(1), v.maxValue(100)) }),
  ),
  tool: v.nullable(ToolSchema),
  /** Repas spécial (pile de 1): servi à table aux deux joueurs assis, il donne ce bonus. Absent: plat ordinaire. */
  meal: v.exactOptional(v.strictObject({ perk: MealPerkSchema })),
  /**
   * Sac (pile de 1, famille `bag`): l'équiper (intention `equip_bag`) donne le sac de `sacs.json`
   * de cet identifiant et rend le précédent. Il s'achète, se trouve au sol ou se reçoit comme
   * n'importe quel objet; l'effet `give_bag` des dialogues reste valable.
   */
  bag: v.exactOptional(IdSchema),
});
export type ItemDef = v.InferOutput<typeof ItemSchema>;
