/**
 * État partagé de la partie (le « monde »): sérialisable en JSON, identique chez l'hôte et
 * l'invité aux positions près. Le schéma est la source de vérité du type: il valide les
 * sauvegardes et les messages du réseau. Chaque chantier possède son domaine
 * (`service`, `clientele`, `arrangement`) et son fichier `etat.ts`.
 */
import { v } from '@duo/sdk';
import { ArrangementStateSchema } from '../amenagement/etat';
import { ClienteleStateSchema } from '../clientele/etat';
import { ServiceStateSchema } from '../service/etat';

/** 0: l'hôte, 1: l'invité (ordre de `duo.players`). */
export const PlayerIndexSchema = v.picklist([0, 1]);
export type PlayerIndex = v.InferOutput<typeof PlayerIndexSchema>;

const Int = v.pipe(v.number(), v.integer(), v.minValue(0));

/** Où se trouve un objet: aucune physique, seulement ces trois cas (technique 5.5). */
export const LocationSchema = v.variant('kind', [
  v.strictObject({ kind: v.literal('hand'), player: PlayerIndexSchema }),
  v.strictObject({ kind: v.literal('slot'), furniture: v.string(), slot: v.string() }),
  v.strictObject({ kind: v.literal('tray'), tray: Int, place: Int }),
]);
export type Location = v.InferOutput<typeof LocationSchema>;

export const ObjectStateSchema = v.strictObject({ id: Int, type: v.string(), at: LocationSchema });
export type ObjectState = v.InferOutput<typeof ObjectStateSchema>;

export const PlacedFurnitureSchema = v.strictObject({
  id: v.string(),
  type: v.string(),
  x: v.number(),
  z: v.number(),
  y: v.number(),
  rotDeg: v.number(),
});
export type PlacedFurniture = v.InferOutput<typeof PlacedFurnitureSchema>;

/** Usage d'un poste à maintien en cours. */
export const StationUseSchema = v.strictObject({ furniture: v.string(), elapsed: v.number() });

export const PlayerStateSchema = v.strictObject({
  /** Identifiant de membre du duo (stable d'une séance à l'autre). */
  memberId: v.string(),
  x: v.number(),
  z: v.number(),
  /** Cap en degrés: 0 regarde le nord (-z), 90 l'ouest (-x), comme `rotation.y` de Three.js. */
  yawDeg: v.number(),
  pitchDeg: v.number(),
  use: v.nullable(StationUseSchema),
});
export type PlayerState = v.InferOutput<typeof PlayerStateSchema>;

export const WorldSchema = v.strictObject({
  tick: Int,
  address: v.string(),
  players: v.tuple([PlayerStateSchema, PlayerStateSchema]),
  objects: v.array(ObjectStateSchema),
  nextObjectId: Int,
  furniture: v.array(PlacedFurnitureSchema),
  service: ServiceStateSchema,
  clientele: ClienteleStateSchema,
  arrangement: ArrangementStateSchema,
});
export type World = v.InferOutput<typeof WorldSchema>;

/** Version du format de `World` dans les sauvegardes (`dataSchema`). */
// 2: domaines service, clientèle et aménagement complets (démo du 2026-11-08). Une sauvegarde du
// squelette (format 1) ne se relit pas: la maison repart du jour 1.
// 3: réalisme v0.2 (lots datés, marchandise payée à la livraison, bilan détaillé). Une partie au
// format 2 se relit sans perte: les champs nouveaux ont une valeur par défaut, et les lots naissent
// du stock au premier pas (`reconcileLots`).
export const WORLD_FORMAT = 3;
/** Formats encore relus (voir `restoreWorld`). */
export const WORLD_FORMATS_READ: readonly number[] = [2, 3];
