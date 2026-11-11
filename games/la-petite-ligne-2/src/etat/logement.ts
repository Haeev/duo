/**
 * État d'un logement (lot logement), rangé dans l'état de son lieu (`PlaceState.housing`): pièces,
 * inventaire de meubles, meubles tenus en mode déco (verrou), travail en cours, confort.
 */
import * as v from 'valibot';
import {
  CentsSchema,
  CountSchema,
  FiniteSchema,
  IdSchema,
  IntSchema,
} from '../donnees/schemas/communs';
import { RoomStateSchema } from '../donnees/schemas/logement';

export const RoomProgressSchema = v.strictObject({
  state: RoomStateSchema,
  /** Étape en cours (index dans `stages`). */
  stage: v.pipe(IntSchema, v.minValue(0), v.maxValue(8)),
  /** Matériaux déjà apportés pour l'étape en cours. */
  delivered: v.record(IdSchema, CountSchema),
  paid: CentsSchema,
  /** Secondes de travail faites sur l'étape en cours. */
  work: v.pipe(FiniteSchema, v.minValue(0)),
});
export type RoomProgress = v.InferOutput<typeof RoomProgressSchema>;

/** Un meuble en main en mode déco: c'est aussi le verrou (un seul joueur le tient). */
export const HoldSchema = v.strictObject({
  /** Instance posée qu'on déplace, `null`: sorti de l'inventaire. */
  prop: v.nullable(IdSchema),
  type: IdSchema,
  x: FiniteSchema,
  y: FiniteSchema,
  rotation: v.picklist([0, 1, 2, 3]),
});
export type Hold = v.InferOutput<typeof HoldSchema>;

export const HousingStateSchema = v.strictObject({
  rooms: v.record(IdSchema, RoomProgressSchema),
  /** Meubles possédés et rangés (hors sac), par type. */
  stock: v.record(IdSchema, v.pipe(CountSchema, v.minValue(1))),
  /**
   * Meubles de départ déjà remis (`stock` et `furnished` de la fiche), par type: le rattrapage ne
   * remet que l'écart, une seule fois. Absent: logement créé avant ce relevé (0.22.0 et avant).
   */
  granted: v.exactOptional(v.record(IdSchema, CountSchema)),
  held: v.tuple([v.nullable(HoldSchema), v.nullable(HoldSchema)]),
  decorating: v.tuple([v.boolean(), v.boolean()]),
  /** Pièce où chaque joueur travaille, `null`: aucune. */
  working: v.tuple([v.nullable(IdSchema), v.nullable(IdSchema)]),
  /** Confort actuel et son palier (indicateur doux, jamais une sanction). */
  comfort: v.pipe(IntSchema, v.minValue(0)),
  level: v.pipe(IntSchema, v.minValue(0), v.maxValue(9)),
  /** Jour du dernier bonus de sommeil versé. */
  sleptDay: v.pipe(IntSchema, v.minValue(0)),
});
export type HousingState = v.InferOutput<typeof HousingStateSchema>;
