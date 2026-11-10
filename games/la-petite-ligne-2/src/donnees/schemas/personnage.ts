/**
 * Apparence d'un personnage (ce qui est sauvegardé et synchronisé) et catalogue des pièces
 * (ADR 0021). Les pièces arrivent avec le lot L5: leur schéma est posé ici pour que L5 et L6
 * partent du même contrat.
 */
import * as v from 'valibot';
import { FileVersionSchema, FiniteSchema, IdSchema, IntSchema } from './communs';

export const SLOTS = [
  'body',
  'head',
  'hair',
  'top',
  'bottom',
  'dress',
  'shoes',
  'hat',
  'glasses',
  'accessory',
] as const;
export const SlotSchema = v.picklist(SLOTS);
export type Slot = (typeof SLOTS)[number];

const ColorIndex = v.pipe(IntSchema, v.minValue(0), v.maxValue(63));

export const LookSchema = v.strictObject({
  /** Morphologie (`adult-medium`). */
  shape: IdSchema,
  /** Teinte de peau: indice dans `skins` du catalogue. */
  skin: ColorIndex,
  /** Une pièce par emplacement au plus; `colors`: indice de couleur de chaque zone teintable. */
  pieces: v.pipe(
    v.array(
      v.strictObject({
        slot: SlotSchema,
        id: IdSchema,
        colors: v.pipe(v.array(ColorIndex), v.maxLength(3)),
      }),
    ),
    v.maxLength(SLOTS.length),
  ),
});
export type Look = v.InferOutput<typeof LookSchema>;

const HexColor = v.pipe(v.string(), v.regex(/^#[0-9a-f]{6}$/));

/** Une pièce de personnage (vêtement, coiffure, tête, accessoire): une entrée de `pieces` du catalogue. */
export const PieceSchema = v.strictObject({
  id: IdSchema,
  slot: SlotSchema,
  /** Fichier GLB de l'emplacement (relatif à `assets/commun/personnages/`) et nœud dans ce fichier. */
  file: v.pipe(v.string(), v.regex(/^[a-z0-9-]+\.glb$/)),
  node: v.pipe(v.string(), v.minLength(1), v.maxLength(64)),
  /** Régions du corps masquées sous la pièce (liste des régions: `morphologies.json`, tenu par le générateur). */
  covers: v.array(IdSchema),
  /** Effet d'une coiffe sur les cheveux, `null` pour les autres pièces. */
  hair: v.nullable(v.picklist(['free', 'flat', 'hidden'])),
  /** Zones teintables (3 au plus) et couleurs permises pour chacune. */
  zones: v.pipe(
    v.array(v.strictObject({ id: IdSchema, colors: v.pipe(v.array(HexColor), v.minLength(1)) })),
    v.maxLength(3),
  ),
  tags: v.array(IdSchema),
  triangles: v.pipe(IntSchema, v.minValue(1), v.maxValue(6000)),
});
export type PieceDef = v.InferOutput<typeof PieceSchema>;

/**
 * `donnees/commun/personnages/catalogue.json`: squelette, morphologies, teintes de peau et pièces.
 * Ce fichier sort du générateur de pièces (lot L5), qui produit aussi les GLB: on ajoute une
 * pièce au générateur, pas à la main ici.
 */
export const CatalogueSchema = v.strictObject({
  schema: FileVersionSchema,
  /** Squelette commun (ADR 0021). */
  skeleton: v.literal('duo-24'),
  shapes: v.pipe(
    v.array(
      v.strictObject({
        id: IdSchema,
        age: v.picklist(['child', 'adult', 'elder']),
        build: v.picklist(['slim', 'medium', 'round']),
        /** Taille debout (m). */
        height: v.pipe(FiniteSchema, v.minValue(0.8), v.maxValue(2)),
      }),
    ),
    v.minLength(1),
  ),
  skins: v.pipe(v.array(HexColor), v.minLength(1)),
  pieces: v.array(PieceSchema),
});
export type Catalogue = v.InferOutput<typeof CatalogueSchema>;
