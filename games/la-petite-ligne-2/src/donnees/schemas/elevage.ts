/**
 * Basse-cour (cahier 4.7, réponse 31, R20): les espèces (`commun/especes/<id>.json`), la brique
 * `shelter` d'un abri (poulailler, clapier, bergerie) et l'état de l'abri. Une seule nourriture par
 * espèce; la mangeoire nourrit toute seule; sans nourriture, les bêtes pondent moins puis plus du
 * tout, rien d'autre. Fichier à part, comme `recolte-briques.ts`: `briques.ts` l'étale dans
 * `BRICK_SCHEMAS`, `etat/briques.ts` y prend l'état. Il n'importe rien de `briques.ts`.
 */
import * as v from 'valibot';
import {
  CentsSchema,
  FileVersionSchema,
  FiniteSchema,
  IdSchema,
  IntSchema,
  LabelSchema,
} from './communs';

/** Clé d'un fait de la mémoire (`regles.ts`, `FactKeySchema`), redite ici (import circulaire). */
const FactKey = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9-]*(\.[a-z0-9-]+){0,3}$/));
const Hex = v.pipe(v.string(), v.regex(/^#[0-9a-f]{6}$/));
const Short = v.pipe(v.string(), v.minLength(1), v.maxLength(12));

/** `commun/especes/<id>.json`: ce qu'est une bête, ce qu'elle mange et ce qu'elle donne. */
export const SpeciesSchema = v.strictObject({
  schema: FileVersionSchema,
  id: IdSchema,
  name: LabelSchema,
  /** Nœud du modèle 3D, ou forme simple tant qu'il n'est pas livré. */
  model: IdSchema,
  /** Prix d'achat (centimes). */
  price: CentsSchema,
  /** La seule nourriture: un objet de `commun/objets/`; un exemplaire vaut une ration. */
  food: IdSchema,
  /** Rations mangées par jour et par bête. */
  ration: v.pipe(IntSchema, v.minValue(1), v.maxValue(4)),
  /** Ce qu'elle donne et tous les combien de jours (nourrie). */
  product: v.strictObject({
    every: v.pipe(IntSchema, v.minValue(1), v.maxValue(7)),
    /** Qualités, de la plus simple à la meilleure: atteinte à partir de `hearts` cœurs. */
    qualities: v.pipe(
      v.array(v.strictObject({ hearts: v.pipe(IntSchema, v.minValue(0)), item: IdSchema })),
      v.minLength(1),
      v.maxLength(4),
    ),
    /** Caressée la veille: chance que le produit monte d'une qualité (cahier: une sur dix). */
    pettedChance: v.pipe(FiniteSchema, v.minValue(0), v.maxValue(1)),
  }),
  /** Affection: points par caresse (un geste par jour et par joueur), points par cœur, cœurs au plus. */
  affection: v.strictObject({
    perPet: v.pipe(IntSchema, v.minValue(1), v.maxValue(10)),
    perHeart: v.pipe(IntSchema, v.minValue(1), v.maxValue(20)),
    hearts: v.pipe(IntSchema, v.minValue(1), v.maxValue(10)),
  }),
  /**
   * Sans nourriture: les `fewer` premiers jours, elle ne donne qu'un jour sur deux; ensuite plus
   * rien jusqu'au prochain repas. Elle ne meurt pas et ne s'en va pas.
   */
  hunger: v.strictObject({ fewer: v.pipe(IntSchema, v.minValue(0), v.maxValue(7)) }),
  /** Onomatopées montrées au-dessus de la bête. */
  sounds: v.strictObject({ happy: Short, hungry: Short, petted: Short }),
  /** Robes possibles (couleur du corps pour la forme simple); la bête en reçoit une. */
  robes: v.pipe(
    v.array(v.strictObject({ id: IdSchema, name: LabelSchema, color: Hex })),
    v.minLength(1),
    v.maxLength(8),
  ),
  /** Noms proposés à l'arrivée, avant que les joueurs ne la renomment. */
  names: v.pipe(v.array(LabelSchema), v.minLength(1), v.maxLength(40)),
  /** Pas dans l'enclos (m par minute de jeu) et heures dehors (minutes depuis minuit). */
  roam: v.strictObject({
    out: v.pipe(IntSchema, v.minValue(0), v.maxValue(1440)),
    in: v.pipe(IntSchema, v.minValue(0), v.maxValue(1440)),
    /** Minutes de jeu entre deux buts de promenade. */
    every: v.pipe(IntSchema, v.minValue(1), v.maxValue(240)),
  }),
});
export type SpeciesDef = v.InferOutput<typeof SpeciesSchema>;

/** Une bête présente au départ (abri d'essai, ferme déjà peuplée). */
const StarterSchema = v.strictObject({ name: LabelSchema, robe: IdSchema });

export const SHELTER_BRICK_SCHEMAS = [
  /**
   * Un abri: places (qui montent avec les faits d'agrandissement, comme `field`), mangeoire en
   * rations, pondoirs et leur plafond d'œufs, enclos du jour (rectangle relatif au centre du
   * meuble, façade au sud, en m).
   */
  v.strictObject({
    brick: v.literal('shelter'),
    species: IdSchema,
    places: v.pipe(
      v.array(
        v.strictObject({
          count: v.pipe(IntSchema, v.minValue(1), v.maxValue(12)),
          fact: v.nullable(FactKey),
        }),
      ),
      v.minLength(1),
      v.maxLength(4),
    ),
    feeder: v.pipe(IntSchema, v.minValue(1), v.maxValue(99)),
    nests: v.pipe(IntSchema, v.minValue(1), v.maxValue(6)),
    nestCapacity: v.pipe(IntSchema, v.minValue(1), v.maxValue(40)),
    pen: v.strictObject({
      x: FiniteSchema,
      y: FiniteSchema,
      w: v.pipe(FiniteSchema, v.minValue(1), v.maxValue(20)),
      h: v.pipe(FiniteSchema, v.minValue(1), v.maxValue(20)),
    }),
    starters: v.pipe(v.array(StarterSchema), v.maxLength(12)),
  }),
] as const;

/** Une bête de l'abri. */
export const AnimalSchema = v.strictObject({
  /** Numéro dans l'abri, stable (vignette, focus, caresse). */
  id: v.pipe(IntSchema, v.minValue(0)),
  name: LabelSchema,
  robe: IdSchema,
  /** Points d'affection (`affection.perHeart` par cœur). */
  love: v.pipe(IntSchema, v.minValue(0), v.maxValue(999)),
  /** Dernier jour de caresse de chaque joueur (0: jamais). */
  petted: v.tuple([v.pipe(IntSchema, v.minValue(0)), v.pipe(IntSchema, v.minValue(0))]),
  /** Jours de suite sans manger (0: nourrie). */
  hungry: v.pipe(IntSchema, v.minValue(0), v.maxValue(999)),
  /** Jours depuis le dernier produit. */
  since: v.pipe(IntSchema, v.minValue(0), v.maxValue(999)),
  /** Dernier jour où elle a donné (0: jamais), pour le picto « a pondu ». */
  laid: v.pipe(IntSchema, v.minValue(0)),
});
export type Animal = v.InferOutput<typeof AnimalSchema>;

/** L'abri: mangeoire (rations), œufs au nid, bêtes, et dernier jour compté (rattrapage). */
export const ShelterStateSchema = v.strictObject({
  feed: v.pipe(IntSchema, v.minValue(0), v.maxValue(99)),
  nest: v.pipe(
    v.array(v.strictObject({ item: IdSchema, count: v.pipe(IntSchema, v.minValue(1)) })),
    v.maxLength(4),
  ),
  animals: v.pipe(v.array(AnimalSchema), v.maxLength(12)),
  nextId: v.pipe(IntSchema, v.minValue(0)),
  day: v.pipe(IntSchema, v.minValue(0)),
});
export type ShelterState = v.InferOutput<typeof ShelterStateSchema>;
