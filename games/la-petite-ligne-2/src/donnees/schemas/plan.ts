/**
 * `donnees/commun/plans/<id>.json`: un plan de fabrication (cahier 4.2, 4.5 et 4.7, R57 et R59).
 * Ce qu'il fabrique (meuble d'une série en plusieurs couleurs, objet, outil), ses matériaux, le
 * poste qui le fait (brique `craft` d'un meuble), le travail en points et la façon de le connaître.
 * Une amélioration d'outil est aussi un plan: le prix et l'outil obtenu restent ceux de l'outil
 * (`tool.work.upgrade`), le plan dit qui la fait et si elle est prête le lendemain.
 * Moteur: `simulation/fabrication/`.
 */
import * as v from 'valibot';
import { CountSchema, FileVersionSchema, IdSchema, IntSchema, LabelSchema } from './communs';

/** Postes: établi, forge (l'artisan), métier à tisser, meule. */
export const CRAFT_STATIONS = ['workbench', 'forge', 'loom', 'grindstone'] as const;
export type CraftStation = (typeof CRAFT_STATIONS)[number];

/** Usages d'un poste, qui sont les onglets de l'atelier: fabriquer, améliorer, réparer, affûter. */
export const CRAFT_SERVICES = ['make', 'upgrade', 'repair', 'sharpen'] as const;
export type CraftService = (typeof CRAFT_SERVICES)[number];

/** Comment on connaît le plan: dès le début, d'un habitant, acheté, trouvé en fouille, quête. */
export const PLAN_SOURCES = ['start', 'villager', 'shop', 'dig', 'quest'] as const;

const Portion = v.strictObject({ item: IdSchema, count: v.pipe(CountSchema, v.minValue(1)) });
const Color = v.pipe(v.string(), v.regex(/^#[0-9a-f]{6}$/));

export const PlanMakesSchema = v.variant('kind', [
  /** Un meuble (objet de famille `furniture`), une variante par couleur de la série. */
  v.strictObject({
    kind: v.literal('furniture'),
    variants: v.pipe(
      v.array(v.strictObject({ color: Color, item: IdSchema })),
      v.minLength(1),
      v.maxLength(6),
    ),
  }),
  /** Un objet ou un outil, en `count` exemplaires. */
  v.strictObject({
    kind: v.literal('item'),
    item: IdSchema,
    count: v.pipe(CountSchema, v.minValue(1)),
  }),
  /** L'amélioration de cet outil (prix et outil obtenu: `tool.work.upgrade` de l'outil). */
  v.strictObject({ kind: v.literal('upgrade'), from: IdSchema }),
]);
export type PlanMakes = v.InferOutput<typeof PlanMakesSchema>;

export const PlanSchema = v.strictObject({
  schema: FileVersionSchema,
  id: IdSchema,
  name: LabelSchema,
  makes: PlanMakesSchema,
  /** Poste requis (brique `craft` d'un meuble, avec l'usage `make` ou `upgrade`). */
  station: v.picklist(CRAFT_STATIONS),
  /** Matériaux pris dans les poches puis dans les coffres proches (vide pour une amélioration). */
  materials: v.pipe(v.array(Portion), v.maxLength(6)),
  /** Points de travail: un coup de marteau de base en donne 6 (36: six coups seul, trois à deux). */
  work: v.pipe(IntSchema, v.minValue(1), v.maxValue(240)),
  /** Connu dès le début, ou à apprendre (effet `remember` sur `fabrication.plan.<id>`, papier). */
  source: v.picklist(PLAN_SOURCES),
  /** Objet « plan papier » qui l'apprend quand on ouvre un atelier en l'ayant sur soi. */
  paper: v.exactOptional(IdSchema),
  /** Série de meubles assortis (R57), comme `series` des meubles. */
  series: v.nullable(IdSchema),
  /** Amélioration seulement: l'artisan la rend le lendemain (sinon tout de suite). */
  delay: v.exactOptional(v.picklist(['next-day'])),
});
export type PlanDef = v.InferOutput<typeof PlanSchema>;
