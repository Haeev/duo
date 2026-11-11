/**
 * Le temps du monde (cahier 4.3 et 4.7): calendrier, climat de chaque lieu, événements du
 * calendrier. Fichiers: `commun/temps.json`, `lieux/<id>/climat.json` (facultatif: sans lui, le
 * climat par défaut de `temps.json`), `lieux/<id>/evenements/<id>.json`. Moteur:
 * `simulation/monde/`.
 */
import * as v from 'valibot';
import { WEATHERS } from '../../etat/commun';
import {
  FileVersionSchema,
  FiniteSchema,
  IdSchema,
  IntSchema,
  LabelSchema,
  TextSchema,
} from './communs';
import { SEASONS } from './prise';
import { ConditionSchema, FactKeySchema, FactValueSchema } from './regles';

export { SEASONS, WEATHERS };
export type Season = (typeof SEASONS)[number];
export type Weather = (typeof WEATHERS)[number];
export const SeasonSchema = v.picklist(SEASONS);
export const WeatherSchema = v.picklist(WEATHERS);

export const WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;
export type Weekday = (typeof WEEKDAYS)[number];
export const WeekdaySchema = v.picklist(WEEKDAYS);

const MinuteOfDay = v.pipe(IntSchema, v.minValue(0), v.maxValue(1440));
export const HoursSchema = v.strictObject({ from: MinuteOfDay, to: MinuteOfDay });
export type Hours = v.InferOutput<typeof HoursSchema>;

/** Poids de tirage de chaque météo (0: jamais). Une météo absente pèse 0. */
const WeightsSchema = v.pipe(
  v.record(WeatherSchema, v.pipe(FiniteSchema, v.minValue(0), v.maxValue(100))),
  v.check((w) => Object.values(w).some((n) => n > 0), 'au moins une météo de poids positif'),
);

/** Le climat d'un lieu: par saison, les poids du tirage et l'ambiance pour le rendu et le son. */
export const ClimateSchema = v.strictObject({
  schema: FileVersionSchema,
  seasons: v.strictObject({
    spring: v.strictObject({ weights: WeightsSchema, ambience: IdSchema }),
    summer: v.strictObject({ weights: WeightsSchema, ambience: IdSchema }),
    autumn: v.strictObject({ weights: WeightsSchema, ambience: IdSchema }),
    winter: v.strictObject({ weights: WeightsSchema, ambience: IdSchema }),
  }),
  /** Chance (0 à 1) qu'une tranche de la journée retire sa météo au lieu de garder la précédente. */
  changeChance: v.pipe(FiniteSchema, v.minValue(0), v.maxValue(1)),
});
export type ClimateDef = v.InferOutput<typeof ClimateSchema>;

export const TimeFileSchema = v.strictObject({
  schema: FileVersionSchema,
  /** Jour de la semaine du jour 1 de la partie. */
  firstWeekday: WeekdaySchema,
  /** Saison du jour 1. L'ordre des saisons est celui de `SEASONS`; leur durée: `clock.seasonDays`. */
  firstSeason: SeasonSchema,
  /**
   * Début de chaque tranche météo du jour, en minutes depuis minuit, croissantes à partir de
   * l'aube (`clock.dayStart`); la première est le tirage du matin, celui qu'on annonce la veille.
   */
  weatherSlots: v.pipe(v.array(MinuteOfDay), v.minLength(1), v.maxLength(8)),
  /** Météos qui arrosent les cultures (événement `rain_watered`). */
  wateringWeathers: v.array(WeatherSchema),
  /** Climat des lieux sans `climat.json`. */
  defaultClimate: ClimateSchema,
  collections: v.strictObject({
    /** Coup de pouce (cahier 4.3, R58): poids d'une entrée jamais trouvée, conditions réunies. */
    newEntryBoost: v.pipe(FiniteSchema, v.minValue(1), v.maxValue(10)),
  }),
  insects: v.strictObject({
    /** Minutes de jeu entre deux essais d'apparition dans une zone. */
    spawnEveryMinutes: v.pipe(IntSchema, v.minValue(1), v.maxValue(240)),
    /** Chance d'apparition à chaque essai, si la zone a de la place. */
    spawnChance: v.pipe(FiniteSchema, v.minValue(0), v.maxValue(1)),
    /** Portée du coup de filet (m) et demi-angle du cône (degrés). */
    netReach: v.pipe(FiniteSchema, v.minValue(0.5), v.maxValue(4)),
    netHalfAngleDeg: v.pipe(FiniteSchema, v.minValue(10), v.maxValue(180)),
    /** Au-dessus de cette vitesse (m/s), le joueur court: les insectes proches s'envolent. */
    runThreshold: v.pipe(FiniteSchema, v.minValue(0.1), v.maxValue(10)),
  }),
  photo: v.strictObject({
    /** Portée (m) et demi-angle du cadre (degrés) de l'appareil. */
    range: v.pipe(FiniteSchema, v.minValue(1), v.maxValue(60)),
    halfAngleDeg: v.pipe(FiniteSchema, v.minValue(5), v.maxValue(90)),
  }),
});
export type TimeFile = v.InferOutput<typeof TimeFileSchema>;

/** Quand revient un événement: à une date de l'année, ou chaque semaine un jour donné. */
export const EventWhenSchema = v.variant('type', [
  v.strictObject({
    type: v.literal('date'),
    season: SeasonSchema,
    /** Jour de la saison, à partir de 1. */
    day: v.pipe(IntSchema, v.minValue(1), v.maxValue(28)),
  }),
  v.strictObject({
    type: v.literal('weekly'),
    weekday: WeekdaySchema,
    /** Saisons où il a lieu; vide: toutes. */
    seasons: v.array(SeasonSchema),
  }),
]);
export type EventWhen = v.InferOutput<typeof EventWhenSchema>;

export const EVENT_KINDS = [
  'festival',
  'visitor',
  'contest',
  'birthday',
  'market',
  'other',
] as const;

/** Un véhicule d'une rame: le modèle livré et ses tampons, mesurés depuis son centre (m). */
export const TrainVehicleSchema = v.strictObject({
  /** Modèle du manifeste des décors (`assets/commun/decors/decors.json`): le rendu seul le lit. */
  model: IdSchema,
  /** Du centre au tampon avant (côté +z du modèle), puis au tampon arrière. */
  front: v.pipe(FiniteSchema, v.minValue(0.5), v.maxValue(15)),
  back: v.pipe(FiniteSchema, v.minValue(0.5), v.maxValue(15)),
  /** Tourné bout pour bout dans la rame (une locomotive qui roule tender en avant). */
  reversed: v.exactOptional(v.boolean()),
});

/** Bout d'une voie de la carte (`rails`): son premier point ou son dernier. */
export const TRACK_ENDS = ['start', 'end'] as const;

/** Arrivée ou départ: la distance parcourue (m) et sa durée (minutes de jeu). */
const TrainRunSchema = v.strictObject({
  minutes: v.pipe(FiniteSchema, v.minValue(0.5), v.maxValue(30)),
  distance: v.pipe(FiniteSchema, v.minValue(10), v.maxValue(400)),
});

/**
 * Le train d'un événement (`simulation/monde/trains.ts`): il arrive en ralentissant pour s'arrêter
 * à l'heure `from` de l'événement, reste à quai jusqu'à `to`, puis repart en accélérant.
 */
export const TrainSchema = v.strictObject({
  /** Pourquoi cette rame, ce sens et cet arrêt (règle « cohérence du monde »). Ignoré du moteur. */
  pourquoi: TextSchema,
  /** Les véhicules, de la tête (côté arrivée) à la queue. */
  consist: v.pipe(v.array(TrainVehicleSchema), v.minLength(1), v.maxLength(8)),
  /** Voie suivie: identifiant d'un tracé de `rails` de la carte du lieu. */
  track: IdSchema,
  /** Bout de la voie d'où il vient, et vers lequel il repart (le même: il rebrousse chemin). */
  comesFrom: v.picklist(TRACK_ENDS),
  leavesTo: v.picklist(TRACK_ENDS),
  /**
   * Arrêt: le centre du véhicule `vehicle` (0: la tête) au droit du point `point` de la carte,
   * décalé de `shift` m dans le sens d'arrivée.
   */
  stop: v.strictObject({
    point: IdSchema,
    vehicle: v.pipe(IntSchema, v.minValue(0), v.maxValue(7)),
    shift: v.pipe(FiniteSchema, v.minValue(-30), v.maxValue(30)),
  }),
  arrival: TrainRunSchema,
  departure: TrainRunSchema,
});
export type TrainDef = v.InferOutput<typeof TrainSchema>;

export const CalendarEventSchema = v.strictObject({
  schema: FileVersionSchema,
  id: IdSchema,
  name: LabelSchema,
  kind: v.picklist(EVENT_KINDS),
  when: EventWhenSchema,
  /** Nombre de jours (1: le jour même). */
  days: v.pipe(IntSchema, v.minValue(1), v.maxValue(14)),
  /** Heures de chaque jour (cahier 4.7: 10 h à 22 h pour les fêtes). */
  hours: HoursSchema,
  /** Conditions d'histoire (vocabulaire de `regles.ts`); vide: toujours. */
  conditions: v.array(ConditionSchema),
  /** Annoncé la veille (événement `calendar_announced`). */
  announce: v.boolean(),
  activates: v.strictObject({
    /** Faits écrits au début, au nom du duo. */
    facts: v.array(v.strictObject({ key: FactKeySchema, value: FactValueSchema })),
    /** Habitants présents pendant l'événement (ceux du lieu, ou des visiteurs venus par le train). */
    villagers: v.array(IdSchema),
    /** Commerce spécial ouvert (`commerces/<id>.json` du lieu), `null`: aucun. */
    shop: v.nullable(IdSchema),
    /** Scène jouée au début (moteur des scènes), `null`: aucune. */
    scene: v.nullable(IdSchema),
    /** Air joué: les deux joueurs l'entendent et l'inscrivent au carnet (entrée de source `tune`). */
    tune: v.nullable(IdSchema),
  }),
  /** Le train qui arrive pour l'événement et repart à sa fin (absent: aucun). */
  train: v.exactOptional(TrainSchema),
});
export type CalendarEventDef = v.InferOutput<typeof CalendarEventSchema>;
