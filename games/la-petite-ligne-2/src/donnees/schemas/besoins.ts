/** `donnees/commun/besoins.json`: jauges, paliers et effets (cahier 4.4, réponses 23 à 26). */
import * as v from 'valibot';
import { FileVersionSchema, FiniteSchema, GaugeSchema, NeedIdSchema } from './communs';

export const NEED_STATES = ['blocked', 'low', 'neutral', 'bonus'] as const;
export const NeedStateSchema = v.picklist(NEED_STATES);
export type NeedState = (typeof NEED_STATES)[number];

const Factor = v.pipe(FiniteSchema, v.minValue(0.25), v.maxValue(1.5));

/** Multiplicateurs appliqués par un palier; absent: 1. */
export const ModifiersSchema = v.strictObject({
  /** Marche et course. */
  speed: v.exactOptional(Factor),
  /** Vitesse des gestes d'outil. */
  toolSpeed: v.exactOptional(Factor),
  /** Largeur des fenêtres des mini-jeux. */
  minigame: v.exactOptional(Factor),
  /** Points d'amitié gagnés. */
  bond: v.exactOptional(Factor),
});
export type Modifiers = v.InferOutput<typeof ModifiersSchema>;

export const NeedTierSchema = v.strictObject({
  /** Le palier vaut de `from` (inclus) au palier suivant. */
  from: GaugeSchema,
  state: NeedStateSchema,
  modifiers: ModifiersSchema,
  /** La touche d'action ne sert plus qu'à combler ce besoin. */
  onlyRelief: v.boolean(),
});

export const NeedSchema = v.strictObject({
  id: NeedIdSchema,
  /** Points perdus par minute réelle, au repos. */
  decayPerMinute: v.pipe(FiniteSchema, v.minValue(0), v.maxValue(10)),
  /** Perte multipliée pendant un effort (outil, course). */
  effortFactor: v.pipe(FiniteSchema, v.minValue(1), v.maxValue(3)),
  tiers: v.pipe(v.array(NeedTierSchema), v.minLength(2), v.maxLength(6)),
});
export type NeedDef = v.InferOutput<typeof NeedSchema>;

export const NeedsFileSchema = v.strictObject({
  schema: FileVersionSchema,
  /** Valeur des trois jauges au début d'une partie. */
  start: GaugeSchema,
  /** Un palier « bonus » tient jusqu'à repasser sous son seuil moins cette marge (réponse 25). */
  hysteresis: v.pipe(FiniteSchema, v.minValue(0), v.maxValue(10)),
  /** Plafond du produit des bonus (« pas dieu parce qu'on est rassasié », réponse 24). */
  maxBonus: v.pipe(FiniteSchema, v.minValue(1), v.maxValue(1.5)),
  /** Multiplicateur de chance de rare quand les trois jauges sont en bonus. */
  allBonusRareLuck: v.pipe(FiniteSchema, v.minValue(1), v.maxValue(1.5)),
  needs: v.pipe(v.array(NeedSchema), v.length(3)),
});
export type NeedsFile = v.InferOutput<typeof NeedsFileSchema>;
