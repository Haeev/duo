/**
 * `donnees/lieux/<lieu>/logements/<id>.json`: le logement d'un lieu (cahier 4.2), un sous-lieu
 * fait de pièces. Chaque pièce a un état (absente, en ruine, en travaux, restaurée) et une
 * restauration en étapes: matériaux, argent (coffre commun, complété par la bourse), travail à
 * faire (plus vite à deux) et parfois un fait d'histoire. Une pièce `absent` est un
 * agrandissement (nouvelle pièce, étage); un appartement n'a que des pièces `restored` sans étape.
 *
 * Aussi: `DecoSchema`, la part « décoration » d'un meuble (`meuble.ts`, champ `deco`).
 */
import * as v from 'valibot';
import {
  CentsSchema,
  CountSchema,
  FileVersionSchema,
  FiniteSchema,
  IdSchema,
  IntSchema,
  LabelSchema,
  PointSchema,
  RectSchema,
  TextSchema,
} from './communs';
import { ConditionSchema } from './regles';

/** Ce qu'une pièce restaurée permet d'installer chez soi. */
export const HOUSING_FUNCTIONS = ['sleep', 'cook', 'wash', 'store'] as const;
export const HousingFunctionSchema = v.picklist(HOUSING_FUNCTIONS);
export type HousingFunction = (typeof HOUSING_FUNCTIONS)[number];

/** État d'une pièce: `absent` (agrandissement pas encore commencé), `ruin`, `works`, `restored`. */
export const ROOM_STATES = ['absent', 'ruin', 'works', 'restored'] as const;
export const RoomStateSchema = v.picklist(ROOM_STATES);
export type RoomState = (typeof ROOM_STATES)[number];

export const StageSchema = v.strictObject({
  name: LabelSchema,
  /** Matériaux à apporter (objets du sac), livrables en plusieurs fois et par les deux joueurs. */
  materials: v.pipe(
    v.array(v.strictObject({ item: IdSchema, count: v.pipe(CountSchema, v.minValue(1)) })),
    v.maxLength(6),
  ),
  /** Prix en centimes, payé par le coffre commun puis, s'il manque, par la bourse de qui paie. */
  cost: CentsSchema,
  /** Secondes de travail d'un joueur seul (`0`: rien à faire sur place). À deux, plus vite (réglages). */
  work: v.pipe(FiniteSchema, v.minValue(0), v.maxValue(600)),
  /** Conditions d'histoire (mémoire, amitié...) pour commencer l'étape; vide: libre. */
  when: v.array(ConditionSchema),
});
export type StageDef = v.InferOutput<typeof StageSchema>;

export const RoomSchema = v.strictObject({
  id: IdSchema,
  name: LabelSchema,
  /** Sol de la pièce sur la carte du lieu (m), murs exclus. Un étage a son propre rectangle. */
  area: RectSchema,
  /** Niveau: 0 rez-de-chaussée, 1 étage. */
  floor: v.pipe(IntSchema, v.minValue(0), v.maxValue(3)),
  start: v.picklist(['absent', 'ruin', 'restored']),
  /** Pièces à restaurer avant celle-ci (l'étage après la troisième pièce). */
  requires: v.array(IdSchema),
  stages: v.pipe(v.array(StageSchema), v.maxLength(8)),
  /** Ce que la pièce restaurée permet d'installer (lit, cuisinière, baquet, coffre). */
  unlocks: v.array(HousingFunctionSchema),
  /** Indice de l'histoire livré à la fin de la restauration (cahier 4.2: jamais qu'un achat). */
  clue: v.nullable(TextSchema),
});
export type RoomDef = v.InferOutput<typeof RoomSchema>;

export const HousingSchema = v.strictObject({
  schema: FileVersionSchema,
  id: IdSchema,
  name: LabelSchema,
  kind: v.picklist(['house', 'apartment', 'wagon']),
  /** Porte d'entrée (point de passage dans le mur): toujours libre, départ du chemin vers les lits. */
  entrance: PointSchema,
  /** Autres portes (entre pièces, vers le jardin): jamais encombrées. */
  doors: v.array(PointSchema),
  rooms: v.pipe(v.array(RoomSchema), v.minLength(1), v.maxLength(12)),
  /** Dehors décorable autour du logement (décision du client, réponse 53), `null`: aucun. */
  garden: v.nullable(RectSchema),
  /** Meubles déjà possédés à l'arrivée (inventaire de la maison), par type. */
  stock: v.record(IdSchema, v.pipe(CountSchema, v.minValue(1))),
});
export type HousingDef = v.InferOutput<typeof HousingSchema>;

/** Couche de pose: au sol, tapis (dessous, on marche dessus), sur un meuble, au mur. */
export const DECO_LAYERS = ['floor', 'rug', 'top', 'wall'] as const;
export type DecoLayer = (typeof DECO_LAYERS)[number];

/** Part « décoration » d'un meuble posable. Absente: au sol, dedans, confort 1. */
export const DecoSchema = v.strictObject({
  layer: v.picklist(DECO_LAYERS),
  /** On peut poser des objets dessus (table, commode). */
  surface: v.boolean(),
  /** Où il se pose: dedans, dehors (jardin), ou les deux. */
  where: v.picklist(['indoor', 'outdoor', 'both']),
  /** Apport au confort de la maison. */
  comfort: v.pipe(IntSchema, v.minValue(0), v.maxValue(10)),
});
export type DecoDef = v.InferOutput<typeof DecoSchema>;
