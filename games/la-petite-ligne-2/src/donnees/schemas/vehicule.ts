/**
 * Véhicule de voie à deux places (`lieux/<lieu>/vehicules/<id>.json`): la draisine d'Aubrune en
 * est un. Tout ce qui le distingue est ici, en données: son modèle, ses places, sa voie, sa
 * remise, sa vitesse, la brique qui le fait avancer (`drive`) et ses arrêts. Le moteur
 * (`simulation/vehicules/`) ne connaît aucun véhicule par son nom.
 */
import * as v from 'valibot';
import { FileVersionSchema, FiniteSchema, IdSchema, LabelSchema, TextSchema } from './communs';
import { ConditionSchema, EffectSchema } from './regles';

/**
 * Un endroit d'une voie: au droit d'un point de la carte (le point de la voie le plus proche),
 * décalé de `shift` mètres vers la fin de la voie (négatif: vers son début).
 */
export const TrackSpotSchema = v.strictObject({
  point: IdSchema,
  shift: v.exactOptional(v.pipe(FiniteSchema, v.minValue(-60), v.maxValue(60))),
});
export type TrackSpot = v.InferOutput<typeof TrackSpotSchema>;

/** Côtés du véhicule, vus dans son sens (l'avant du modèle regarde la fin de la voie). */
export const VEHICLE_SIDES = ['left', 'right'] as const;

/** Une place à bord, dans le repère du modèle (m): +z vers l'avant, +x à gauche de qui regarde l'avant. */
export const VehicleSeatSchema = v.strictObject({
  /** Libellé du rôle (« À l'avant »), montré à qui s'y installe. */
  name: LabelSchema,
  /** Du centre vers l'avant du véhicule (négatif: vers l'arrière). */
  along: v.pipe(FiniteSchema, v.minValue(-8), v.maxValue(8)),
  /** Du centre le long de +x du modèle (vers la gauche; négatif: vers la droite). */
  side: v.pipe(FiniteSchema, v.minValue(-2), v.maxValue(2)),
  /** Dessus de l'assise au-dessus du plancher (m), et bord avant de l'assise depuis son centre. */
  height: v.pipe(FiniteSchema, v.minValue(0.2), v.maxValue(2)),
  front: v.pipe(FiniteSchema, v.minValue(0), v.maxValue(0.6)),
  /** Où regarde l'assis: l'avant ou l'arrière du véhicule (face au balancier, face à l'autre). */
  faces: v.picklist(['front', 'back']),
  /** Côté par lequel on descend. */
  exit: v.picklist(VEHICLE_SIDES),
});
export type VehicleSeat = v.InferOutput<typeof VehicleSeatSchema>;

const Share = v.pipe(FiniteSchema, v.minValue(0), v.maxValue(1));
const Seconds = v.pipe(FiniteSchema, v.minValue(0.02), v.maxValue(10));

/**
 * Brique `pump`: un balancier à deux. Chaque joueur donne ses coups (touche d'action); seuls les
 * coups alternés comptent (jamais deux fois de suite la même place), et ils poussent d'autant
 * mieux qu'ils tombent au battement.
 */
export const PumpDriveSchema = v.strictObject({
  brick: v.literal('pump'),
  /** Écart idéal entre deux coups alternés (s): chacun appuie donc toutes les deux fois `beat`. */
  beat: Seconds,
  /** Écart toléré autour du battement pour un coup plein (s). */
  tolerance: Seconds,
  /** En deçà de cet écart, les deux ont appuyé ensemble: le balancier se bloque, le coup d'avant est perdu (s). */
  jam: Seconds,
  /** Au-delà, le rythme est perdu: l'indicateur retombe (s). */
  lost: Seconds,
  /** Vitesse gagnée par un coup plein (m/s). */
  push: v.pipe(FiniteSchema, v.minValue(0.05), v.maxValue(5)),
  /** Part gardée par un coup alterné mais trop lent (hors battement). */
  offBeat: Share,
});
export type PumpDrive = v.InferOutput<typeof PumpDriveSchema>;

/** Les briques d'entraînement: une par façon de faire avancer un véhicule de voie. */
export const VehicleDriveSchema = v.variant('brick', [PumpDriveSchema]);
export type VehicleDrive = v.InferOutput<typeof VehicleDriveSchema>;

/** Ce qui se passe quand le véhicule s'arrête à un arrêt, quelqu'un à bord. */
export const StopRuleSchema = v.strictObject({
  when: v.array(ConditionSchema),
  effects: v.pipe(v.array(EffectSchema), v.minLength(1), v.maxLength(8)),
});

/** Un arrêt: un endroit de la voie où descendre a un sens (règle « cohérence du monde »). */
export const VehicleStopSchema = v.strictObject({
  id: IdSchema,
  /** Nom montré à l'approche et à l'arrêt, sans article ni majuscule (« passage de l'Église »). */
  name: LabelSchema,
  at: TrackSpotSchema,
  /** Pourquoi descendre ici. Ignoré du moteur. */
  pourquoi: TextSchema,
  /** Effets à l'arrêt (faits pour les suites), dans l'ordre; absent: aucun. */
  arrive: v.exactOptional(v.pipe(v.array(StopRuleSchema), v.maxLength(4))),
});
export type VehicleStop = v.InferOutput<typeof VehicleStopSchema>;

const Line = v.pipe(v.string(), v.minLength(1), v.maxLength(120));

export const RailVehicleSchema = v.strictObject({
  schema: FileVersionSchema,
  id: IdSchema,
  /** Nom avec son article (« la draisine »). */
  name: LabelSchema,
  /** D'où il vient, à quoi il sert, pourquoi cette voie et ces arrêts. Ignoré du moteur. */
  pourquoi: TextSchema,
  /** Modèle du manifeste des décors (`assets/commun/decors/decors.json`): le rendu seul le lit. */
  model: IdSchema,
  /**
   * Tant que `model` n'est pas livré: un modèle existant du manifeste, que le rendu ramène au
   * gabarit du plancher (largeur, longueur, hauteur `deck`); bancs et balancier sont provisoires.
   */
  fallback: v.exactOptional(IdSchema),
  /**
   * Gabarit (m): du centre aux tampons avant et arrière, demi-largeur, hauteur hors tout (pour le
   * fondu devant un joueur), dessus du plancher au-dessus du sol de la voie (les pieds s'y posent).
   */
  body: v.strictObject({
    front: v.pipe(FiniteSchema, v.minValue(0.3), v.maxValue(8)),
    back: v.pipe(FiniteSchema, v.minValue(0.3), v.maxValue(8)),
    halfWidth: v.pipe(FiniteSchema, v.minValue(0.3), v.maxValue(2)),
    height: v.pipe(FiniteSchema, v.minValue(0.3), v.maxValue(5)),
    deck: v.pipe(FiniteSchema, v.minValue(0), v.maxValue(3)),
  }),
  /** Les deux places, de part et d'autre du balancier. */
  seats: v.tuple([VehicleSeatSchema, VehicleSeatSchema]),
  /** Voie parcourue: identifiant d'un tracé de `rails` de la carte du lieu. */
  track: IdSchema,
  /**
   * Remise: la voie de garage (`rails`) au bout de laquelle il dort, `inside` mètres après son
   * dernier point (dans le bâtiment). La porte est ce dernier point: c'est là qu'on le sort.
   */
  garage: v.strictObject({
    track: IdSchema,
    inside: v.pipe(FiniteSchema, v.minValue(0), v.maxValue(20)),
  }),
  /** Où il est posé sur sa voie quand on le sort de la remise, et où on le rentre. */
  launch: TrackSpotSchema,
  /** Butées: il ne roule qu'entre ces deux endroits de sa voie. */
  range: v.strictObject({ from: TrackSpotSchema, to: TrackSpotSchema }),
  /** Conditions pour le sortir (la suite qui en donne la clé); vide: toujours. */
  available: v.array(ConditionSchema),
  speed: v.strictObject({
    /** Vitesse de pointe (m/s). */
    max: v.pipe(FiniteSchema, v.minValue(0.5), v.maxValue(20)),
    /** Ralentissement en roue libre: constant (m/s²) et proportionnel à la vitesse (par seconde). */
    roll: v.pipe(FiniteSchema, v.minValue(0), v.maxValue(5)),
    drag: v.pipe(FiniteSchema, v.minValue(0), v.maxValue(2)),
    /** Frein serré (m/s²), et freinage de lui-même à l'approche d'une butée (m/s²). */
    brake: v.pipe(FiniteSchema, v.minValue(0.5), v.maxValue(20)),
    endBrake: v.pipe(FiniteSchema, v.minValue(0.5), v.maxValue(20)),
  }),
  /** Ce qui le fait avancer. */
  drive: VehicleDriveSchema,
  /** Trains des événements sur la même voie: annonce (minutes de jeu avant leur arrivée). */
  trains: v.strictObject({
    warnMinutes: v.pipe(FiniteSchema, v.minValue(1), v.maxValue(240)),
  }),
  /** Rayon d'un arrêt (m): arrêté à moins de cela de son repère, on y est. */
  stopReach: v.pipe(FiniteSchema, v.minValue(0.5), v.maxValue(20)),
  stops: v.pipe(v.array(VehicleStopSchema), v.maxLength(12)),
  /** Verbes de la bulle d'action et mots d'explication (tutoiement, phrases courtes). */
  lines: v.strictObject({
    rollOut: LabelSchema,
    rollIn: LabelSchema,
    board: LabelSchema,
    /** Un train est à quai ou s'annonce: on ne part pas. */
    trainDue: Line,
    /** Un train s'annonce pendant la balade. */
    trainWarning: Line,
    /** Le train est là: rangé d'office, personne n'est bousculé. */
    putAway: Line,
    /** Il faut être deux pour le faire avancer. */
    needsTwo: Line,
    /** Bout de voie (butée, verrou d'histoire fermé). */
    endOfLine: Line,
  }),
});
export type RailVehicleDef = v.InferOutput<typeof RailVehicleSchema>;
