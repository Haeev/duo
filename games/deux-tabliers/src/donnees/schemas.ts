// Schémas des fichiers de `donnees/` (décrits dans `donnees/SCHEMA.md`, à tenir ensemble).
import { v } from '@duo/sdk';

const Id = v.pipe(
  v.string(),
  v.regex(/^[a-z0-9][a-z0-9-]*$/, 'identifiant: minuscules, chiffres, traits d’union'),
);
const Label = v.pipe(v.string(), v.minLength(1), v.maxLength(60));
const Color = v.pipe(v.string(), v.regex(/^#[0-9a-fA-F]{6}$/, 'couleur: #RRGGBB'));
const Positive = v.pipe(v.number(), v.minValue(0));
const Point = v.tuple([v.number(), v.number()]);

export const SettingsSchema = v.strictObject({
  player: v.strictObject({
    walkSpeed: Positive,
    fastSpeed: Positive,
    radius: v.pipe(v.number(), v.minValue(0.3, 'rayon du corps: 0,3 m au moins (technique 2.3)')),
    eyeHeight: Positive,
    fovDeg: v.pipe(v.number(), v.minValue(50), v.maxValue(75)),
    pitchLimitDeg: v.pipe(v.number(), v.minValue(10), v.maxValue(89)),
    reach: Positive,
    giveReach: Positive,
  }),
  aim: v.strictObject({
    coneDeg: v.pipe(v.number(), v.minValue(0), v.maxValue(15)),
    targetRadius: Positive,
  }),
  mouse: v.strictObject({ degPerPixel: Positive }),
  seating: v.strictObject({
    tableReach: Positive,
    /** Hauteur des yeux d'un avatar assis, au-dessus de l'assise (m). */
    eyeAboveSeat: Positive,
    /** Inclinaison du regard en s'asseyant (vers la table), en degrés. */
    seatedPitchDeg: v.pipe(v.number(), v.minValue(-60), v.maxValue(0)),
    /** Pause d'un client assis entre deux gorgées (s, bornes du tirage par client). */
    sipGapSeconds: v.tuple([Positive, Positive]),
    /** Durée d'un regard d'un client qui attend, vers le comptoir ou son voisin (s, bornes). */
    glanceSeconds: v.tuple([Positive, Positive]),
    /** Rotation de tête au plus, de part et d'autre du regard droit devant (degrés). */
    glanceMaxDeg: v.pipe(v.number(), v.minValue(0), v.maxValue(80)),
  }),
  net: v.strictObject({
    movesEvery: v.pipe(v.number(), v.integer(), v.minValue(1)),
    domainsEvery: v.pipe(v.number(), v.integer(), v.minValue(1)),
    interpolationMs: v.pipe(v.number(), v.minValue(0), v.maxValue(400)),
  }),
});
export type Settings = v.InferOutput<typeof SettingsSchema>;

export const ObjectTypeSchema = v.strictObject({
  id: Id,
  label: Label,
  model: v.optional(Id),
  size: v.tuple([Positive, Positive, Positive]),
  color: Color,
  tray: v.nullable(
    v.strictObject({ places: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(12)) }),
  ),
});
export type ObjectType = v.InferOutput<typeof ObjectTypeSchema>;
export const ObjectsFileSchema = v.strictObject({ objects: v.array(ObjectTypeSchema) });

export const SlotSchema = v.strictObject({ id: Id, x: v.number(), y: v.number(), z: v.number() });
export type Slot = v.InferOutput<typeof SlotSchema>;

export const FurnitureTypeSchema = v.strictObject({
  id: Id,
  label: Label,
  model: v.optional(Id),
  color: Color,
  footprint: v.tuple([Positive, Positive]),
  height: Positive,
  /** Assise et table: règle d'orientation de l'aménagement (`amenagement/assises.ts`). */
  kind: v.picklist(['seat', 'table', 'other']),
  blocks: v.boolean(),
  fixed: v.boolean(),
  carry: v.picklist(['none', 'one', 'two']),
  price: Positive,
  slots: v.array(SlotSchema),
  station: v.nullable(Id),
  source: v.nullable(Id),
});
export type FurnitureType = v.InferOutput<typeof FurnitureTypeSchema>;
export const FurnitureFileSchema = v.strictObject({ furniture: v.array(FurnitureTypeSchema) });

export const StationTypeSchema = v.strictObject({
  id: Id,
  label: Label,
  verb: Label,
  use: v.picklist(['click', 'hold']),
  seconds: Positive,
  slot: Id,
  transforms: v.array(v.strictObject({ from: Id, to: Id })),
});
export type StationType = v.InferOutput<typeof StationTypeSchema>;
export const StationsFileSchema = v.strictObject({ stations: v.array(StationTypeSchema) });

// Plan du level designer (format `cosy-cafe-plans`): on ne lit que ce qui sert, le reste passe.
const ShapeSchema = v.union([
  v.strictObject({ rect: v.tuple([v.number(), v.number(), Positive, Positive]) }),
  v.strictObject({ circle: v.tuple([v.number(), v.number(), Positive]) }),
]);
export type Shape = v.InferOutput<typeof ShapeSchema>;
export const PlanElementSchema = v.looseObject({
  id: v.string(),
  kind: v.string(),
  shape: ShapeSchema,
  height: v.optional(v.number()),
  blocks: v.optional(v.boolean(), false),
  access: v.optional(v.string()),
  style: v.optional(v.nullable(v.string())),
  sill: v.optional(v.number()),
});
export type PlanElement = v.InferOutput<typeof PlanElementSchema>;
export const PlanSchema = v.looseObject({
  id: v.string(),
  title: v.string(),
  levels: v.pipe(
    v.array(
      v.looseObject({
        id: v.string(),
        frame: v.tuple([v.number(), v.number(), Positive, Positive]),
        elements: v.array(PlanElementSchema),
      }),
    ),
    v.minLength(1),
  ),
});
export type Plan = v.InferOutput<typeof PlanSchema>;

export const StartSchema = v.strictObject({
  address: Id,
  spawns: v.tuple([Point, Point]),
  furniture: v.array(
    v.strictObject({
      id: v.string(),
      type: Id,
      x: v.number(),
      z: v.number(),
      y: v.number(),
      rotDeg: v.number(),
    }),
  ),
  objects: v.array(v.strictObject({ type: Id, furniture: v.string(), slot: Id })),
});
export type Start = v.InferOutput<typeof StartSchema>;
