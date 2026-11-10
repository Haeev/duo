/**
 * Briques communes des schémas de données et d'état. Les schémas Valibot sont la source unique
 * des types (`v.InferOutput`) et des validateurs (ADR 0017).
 */
import * as v from 'valibot';

/** Identifiant de contenu: minuscules, chiffres, traits d'union (`essai-gare`, `pomme`). */
export const IdSchema = v.pipe(
  v.string(),
  v.regex(
    /^[a-z][a-z0-9-]{0,39}$/,
    'identifiant: minuscules, chiffres et traits d’union, 40 caractères au plus',
  ),
);
export type Id = v.InferOutput<typeof IdSchema>;

export const FiniteSchema = v.pipe(v.number(), v.finite());
export const IntSchema = v.pipe(v.number(), v.integer());
export const CountSchema = v.pipe(IntSchema, v.minValue(0), v.maxValue(9999));
/** Montant en centimes d'euro (entiers: jamais de flottant), plafonné à 100 000 €. */
export const CENTS_MAX = 10_000_000;
export const CentsSchema = v.pipe(IntSchema, v.minValue(0), v.maxValue(CENTS_MAX));
export const TickSchema = v.pipe(IntSchema, v.minValue(0));
/** Jauge de 0 à 100. */
export const GaugeSchema = v.pipe(FiniteSchema, v.minValue(0), v.maxValue(100));
/** Texte affiché au joueur, en français. */
export const TextSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(400));
export const LabelSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(40));

export const PointSchema = v.strictObject({ x: FiniteSchema, y: FiniteSchema });
export type Point = v.InferOutput<typeof PointSchema>;

export const RectSchema = v.strictObject({
  x: IntSchema,
  y: IntSchema,
  w: v.pipe(IntSchema, v.minValue(1)),
  h: v.pipe(IntSchema, v.minValue(1)),
});
export type Rect = v.InferOutput<typeof RectSchema>;

/** Les trois besoins (réponse 23 du client). */
export const NEED_IDS = ['hunger', 'sleep', 'hygiene'] as const;
export const NeedIdSchema = v.picklist(NEED_IDS);
export type NeedId = (typeof NEED_IDS)[number];

/** Les deux joueurs: 0 l'hôte de la première séance, 1 l'autre (liés à l'identifiant de membre). */
export const PlayerIndexSchema = v.picklist([0, 1]);
export type PlayerIndex = 0 | 1;

/** Version du format d'un fichier de données. */
export const FileVersionSchema = v.literal(1);
