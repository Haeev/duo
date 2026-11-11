/** `donnees/commun/objets/<id>.json`: tout ce qui tient dans une case (cahier 4.5). Un fichier par objet. */
import * as v from 'valibot';
import { ToolKindSchema } from './briques';
import { ToolWorkSchema } from './recolte';
import { FileVersionSchema, FiniteSchema, IdSchema, IntSchema, LabelSchema } from './communs';
import { FoodStaminaSchema } from './endurance';

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
  /**
   * Points de faim rendus en le mangeant, `null` s'il ne se mange pas. `stamina` (facultatif):
   * renfort d'endurance de la bouchée (`schemas/endurance.ts`).
   */
  food: v.nullable(
    v.strictObject({
      hunger: v.pipe(FiniteSchema, v.minValue(1), v.maxValue(100)),
      stamina: v.exactOptional(FoodStaminaSchema),
    }),
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
  /**
   * Objet d'histoire (règlement, lettre, lanterne): reçu et repris par les dialogues et les
   * étapes, il ne se vend pas et ne se jette pas (il peut se donner à l'autre ou se ranger).
   */
  story: v.exactOptional(v.literal(true)),
  /**
   * Instrument de musique (pile de 1, `tool: null`): en main à un endroit où jouer (brique
   * `perform`), il ouvre le cahier de fanfare. `timbre`: son nom dans la table des timbres
   * (`src/audio/musique/donnees/timbres.json`); `tier`: 0 de base (les trois premiers airs du
   * cahier), 1 amélioré (six), 2 fin (tous), cahier 4.5.
   */
  instrument: v.exactOptional(v.strictObject({ timbre: IdSchema, tier: v.picklist([0, 1, 2]) })),
});
export type ItemDef = v.InferOutput<typeof ItemSchema>;
