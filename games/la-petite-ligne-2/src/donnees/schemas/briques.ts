/**
 * Briques de comportement: ce qu'un meuble ou un élément de la carte sait faire, déclaré dans ses
 * données (`bricks`). Une chaise est « un meuble avec la brique s'asseoir », jamais un cas
 * particulier du moteur. Ajouter une brique: son schéma ici, son état dans `etat/briques.ts`, son
 * comportement dans `simulation/briques/`; ensuite tout contenu peut la déclarer sans code.
 *
 * Ne sont pas des briques: ramasser un objet au sol (`pickup`) et parler à un habitant (`talk`).
 * Ces deux actions visent des entités de l'état qui ne sont pas des meubles et qu'aucune donnée
 * de meuble ne déclare: elles restent des comportements d'entité du registre
 * (`simulation/briques/registre.ts`, `ENTITY_BEHAVIOURS`). Un habitant parle parce qu'il a des
 * dialogues; un objet au sol se ramasse parce qu'il est au sol.
 */
import * as v from 'valibot';
import { CountSchema, FiniteSchema, IdSchema, IntSchema, NeedIdSchema } from './communs';

export const TOOL_KINDS = ['axe', 'spade', 'can', 'rod', 'net', 'hammer'] as const;
export const ToolKindSchema = v.picklist(TOOL_KINDS);

export const STATIONS = ['stove', 'kitchen', 'workbench'] as const;

/** Verbe de la bulle d'action (« Cueillir »), deux mots au plus. */
const Verb = v.pipe(v.string(), v.minLength(2), v.maxLength(20));
const GestureSeconds = v.pipe(FiniteSchema, v.minValue(0.1), v.maxValue(1.5));

export const BRICK_SCHEMAS = [
  /** Ramasser, cueillir, couper: un geste court qui donne un objet, avec ou sans stock. */
  v.strictObject({
    brick: v.literal('gather'),
    verb: Verb,
    clip: IdSchema,
    seconds: GestureSeconds,
    gives: v.strictObject({ item: IdSchema, count: v.pipe(CountSchema, v.minValue(1)) }),
    /** Usages avant épuisement et retour, en minutes de jeu; `null`: sans limite. */
    stock: v.nullable(
      v.strictObject({
        count: v.pipe(IntSchema, v.minValue(1)),
        refillMinutes: v.pipe(IntSchema, v.minValue(1)),
      }),
    ),
    /** Outil à tenir en main, `null`: mains nues. */
    tool: v.nullable(ToolKindSchema),
  }),
  /** Soulager un besoin sur place (se laver à la pompe, boire): geste long, interruptible. */
  v.strictObject({
    brick: v.literal('relieve'),
    verb: Verb,
    clip: IdSchema,
    seconds: v.pipe(FiniteSchema, v.minValue(0.5), v.maxValue(15)),
    need: NeedIdSchema,
    amount: v.pipe(FiniteSchema, v.minValue(1), v.maxValue(100)),
    cap: v.pipe(FiniteSchema, v.minValue(1), v.maxValue(100)),
  }),
  /** S'asseoir: on y reste jusqu'à donner une direction; le sommeil remonte doucement (sieste). */
  v.strictObject({
    brick: v.literal('sit'),
    seats: v.pipe(IntSchema, v.minValue(1), v.maxValue(4)),
    /** Points de sommeil rendus par minute réelle assise. */
    restPerMinute: v.pipe(FiniteSchema, v.minValue(0), v.maxValue(20)),
  }),
  /** Dormir: à deux au lit après l'heure permise, on passe au lendemain. */
  v.strictObject({
    brick: v.literal('sleep'),
    places: v.pipe(IntSchema, v.minValue(1), v.maxValue(2)),
    /** Sommeil au réveil (100 pour un vrai lit, 80 pour une paillasse). */
    wakeAt: v.pipe(FiniteSchema, v.minValue(1), v.maxValue(100)),
  }),
  /** Ranger: des cases comme celles du sac, partagées par les deux joueurs. */
  v.strictObject({
    brick: v.literal('store'),
    slots: v.pipe(IntSchema, v.minValue(1), v.maxValue(40)),
  }),
  /** Vendre et acheter: le comptoir d'un commerce du lieu (`commerces/<id>.json`). */
  v.strictObject({ brick: v.literal('shop'), shop: IdSchema }),
  /** Cuisiner ou fabriquer: les recettes de ce poste. */
  v.strictObject({ brick: v.literal('cook'), station: v.picklist(STATIONS) }),
  /** Ouvrir et fermer (porte, portillon, volet). */
  v.strictObject({ brick: v.literal('open'), startsOpen: v.boolean() }),
  /** Réparer un outil émoussé (meule, établi). */
  v.strictObject({
    brick: v.literal('repair'),
    tools: v.pipe(v.array(ToolKindSchema), v.minLength(1)),
    seconds: GestureSeconds,
  }),
  /**
   * Prendre le train: la portière ou le poteau du quai. Les destinations sont les `links` du lieu;
   * il faut être deux à l'avoir validé pour partir (ADR 0018). C'est l'objet visible du voyage:
   * pas de zone d'embarquement sans objet.
   */
  v.strictObject({ brick: v.literal('travel') }),
] as const;

export const BrickSchema = v.variant('brick', [...BRICK_SCHEMAS]);
export type Brick = v.InferOutput<typeof BrickSchema>;
export type BrickId = Brick['brick'];
export const BRICK_IDS: readonly BrickId[] = BRICK_SCHEMAS.map(
  (schema) => schema.entries.brick.literal,
);
