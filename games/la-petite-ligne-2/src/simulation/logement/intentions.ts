/** Intentions du logement et du mode déco. Positions en mètres de la carte du lieu. */
import * as v from 'valibot';
import { FiniteSchema, IdSchema } from '../../donnees/schemas/communs';

const Rotation = v.picklist([0, 1, 2, 3]);
const Coord = v.pipe(FiniteSchema, v.minValue(0), v.maxValue(128));

export const HOUSING_INTENTS = [
  /** Apporter à la pièce les matériaux de l'étape en cours qu'on a dans le sac. */
  v.strictObject({ type: v.literal('housing_supply'), housing: IdSchema, room: IdSchema }),
  /** Payer l'étape en cours: coffre commun d'abord, sa bourse pour le reste. */
  v.strictObject({ type: v.literal('housing_pay'), housing: IdSchema, room: IdSchema }),
  /** Se mettre au travail sur la pièce (`on: false`: s'arrêter). Bouger arrête aussi. */
  v.strictObject({
    type: v.literal('housing_work'),
    housing: IdSchema,
    room: IdSchema,
    on: v.boolean(),
  }),
  /** Entrer dans le mode déco ou en sortir (ce qu'on tient revient à sa place). */
  v.strictObject({ type: v.literal('deco_mode'), housing: IdSchema, on: v.boolean() }),
  /** Saisir un meuble posé: il est verrouillé pour l'autre joueur. */
  v.strictObject({ type: v.literal('deco_grab'), housing: IdSchema, prop: IdSchema }),
  /** Sortir un meuble de l'inventaire de la maison, en main. */
  v.strictObject({
    type: v.literal('deco_take'),
    housing: IdSchema,
    prop: IdSchema,
    x: Coord,
    y: Coord,
    rotation: Rotation,
  }),
  /** Le meuble en main bouge ou tourne: l'autre joueur voit le geste. */
  v.strictObject({
    type: v.literal('deco_move'),
    housing: IdSchema,
    x: Coord,
    y: Coord,
    rotation: Rotation,
  }),
  /** Poser le meuble en main là où il est (refusé avec la raison si la place ne va pas). */
  v.strictObject({ type: v.literal('deco_drop'), housing: IdSchema }),
  /** Lâcher: le meuble revient à sa place (ou à l'inventaire s'il en sortait). */
  v.strictObject({ type: v.literal('deco_cancel'), housing: IdSchema }),
  /** Ranger dans l'inventaire le meuble en main, ou un meuble posé désigné. */
  v.strictObject({
    type: v.literal('deco_store'),
    housing: IdSchema,
    prop: v.nullable(IdSchema),
  }),
] as const;
