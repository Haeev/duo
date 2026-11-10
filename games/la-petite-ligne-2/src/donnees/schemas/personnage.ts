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

/** Genre d'un joueur: accords des textes et silhouette de départ. Les habitants écrits ont le leur dans leurs textes. */
export const GENDERS = ['f', 'm'] as const;
export const GenderSchema = v.picklist(GENDERS);
export type Gender = (typeof GENDERS)[number];

const ColorIndex = v.pipe(IntSchema, v.minValue(0), v.maxValue(63));

export const LookSchema = v.strictObject({
  /** Morphologie (`adult-f-medium`): âge, silhouette femme ou homme, corpulence. */
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

const Ratio = v.pipe(FiniteSchema, v.minValue(0.5), v.maxValue(1.5));
const ZoneIndex = v.pipe(IntSchema, v.minValue(0), v.maxValue(7));

/**
 * `donnees/commun/personnages/morphologies.json`: ce que le générateur de pièces (lot L5) et
 * l'assemblage (lot L6) partagent. Écrit par le générateur, jamais à la main.
 */
export const MorphologiesSchema = v.strictObject({
  /** Régions du corps qu'une pièce peut masquer (`covers` du catalogue); `none`: aucune. */
  regions: v.pipe(v.array(IdSchema), v.minLength(1)),
  /** Conventions de zones de couleur des maillages: indices teintables, zone fixe, zone de peau. */
  zones: v.strictObject({
    teintables: v.pipe(v.array(ZoneIndex), v.minLength(1), v.maxLength(3)),
    fixe: ZoneIndex,
    peau: ZoneIndex,
  }),
  /** Expressions du visage livrées. */
  expressions: v.array(IdSchema),
  /** Clips livrés et leur durée (s). */
  clips: v.record(IdSchema, v.pipe(FiniteSchema, v.minValue(0.1), v.maxValue(30))),
  /** Suffixe du nœud d'une coiffure aplatie sous une coiffe. */
  flat_suffix: v.pipe(v.string(), v.minLength(1), v.maxLength(16)),
  /**
   * Par morphologie du catalogue: morphoses du gabarit (`f` ou `m` pour la silhouette, `slim` ou
   * `round` pour la corpulence) et longueurs par âge (échelle d'ensemble, tête, jambes, bras, torse).
   */
  shapes: v.record(
    IdSchema,
    v.strictObject({
      morphs: v.pipe(v.array(v.picklist(['f', 'm', 'slim', 'round'])), v.maxLength(2)),
      scale: Ratio,
      head: Ratio,
      legs: Ratio,
      arms: Ratio,
      torso: Ratio,
    }),
  ),
  /** Couleurs par défaut de chaque pièce: un indice par zone teintable. */
  defaults: v.record(IdSchema, v.pipe(v.array(ColorIndex), v.maxLength(3))),
  /** Poids de chaque GLB d'emplacement, en octets (budget du paquet). */
  files: v.record(SlotSchema, v.pipe(IntSchema, v.minValue(1))),
});
export type Morphologies = v.InferOutput<typeof MorphologiesSchema>;
