/**
 * `donnees/commun/reglages.json`: les valeurs de gameplay, jamais en dur dans la logique.
 * Chaque lot y ajoute sa section (schéma ici, valeurs dans le JSON, validées au chargement).
 */
import * as v from 'valibot';
import { CountSchema, FileVersionSchema, FiniteSchema, IdSchema, IntSchema } from './communs';

const Seconds = v.pipe(FiniteSchema, v.minValue(0));
/** Minutes de jeu depuis minuit. */
const MinuteOfDay = v.pipe(IntSchema, v.minValue(0), v.maxValue(1439));
const Positive = v.pipe(FiniteSchema, v.minValue(0.01));

export const SettingsSchema = v.strictObject({
  schema: FileVersionSchema,
  /** Début d'une partie neuve. */
  start: v.strictObject({ place: IdSchema, minute: MinuteOfDay, money: CountSchema }),
  clock: v.strictObject({
    /** Secondes réelles par heure de jeu (cahier 4.3: 125). */
    secondsPerHour: v.pipe(FiniteSchema, v.minValue(10), v.maxValue(600)),
    dayStart: MinuteOfDay,
    nightStart: MinuteOfDay,
    /** Dormir à deux fait passer au lendemain à partir de cette heure. */
    sleepFrom: MinuteOfDay,
    /** Jours par saison (14). */
    seasonDays: v.pipe(IntSchema, v.minValue(7), v.maxValue(28)),
  }),
  movement: v.strictObject({
    /** Mètres par seconde. */
    walkSpeed: Positive,
    runSpeed: Positive,
    /** Rayon de collision d'un personnage (m). */
    radius: Positive,
    /** Temps pour atteindre la vitesse voulue et pour s'arrêter (s): accélération douce. */
    accelSeconds: Seconds,
  }),
  reach: v.strictObject({
    /** Portée de la touche d'action (m) et demi-angle du cône de visée (degrés). */
    action: Positive,
    aimHalfAngleDeg: v.pipe(FiniteSchema, v.minValue(10), v.maxValue(180)),
  }),
  gestures: v.strictObject({
    /** Aucune action courante ne bloque plus longtemps (note de ressenti: 1,5 s). */
    maxSeconds: v.pipe(FiniteSchema, v.minValue(0.2), v.maxValue(1.5)),
    pickSeconds: Seconds,
    eatSeconds: Seconds,
  }),
  travel: v.strictObject({
    /** Heures de jeu ajoutées à l'horloge par un trajet. */
    clockHours: v.pipe(FiniteSchema, v.minValue(0), v.maxValue(12)),
    /** Durée minimale de la scène de wagon, et attente avant le message « l'autre charge encore ». */
    minSeconds: Seconds,
    slowLoadSeconds: Seconds,
    /** Départs permis entre ces deux heures. */
    from: MinuteOfDay,
    to: MinuteOfDay,
  }),
  dialogue: v.strictObject({
    /** Longueur maximale d'une réplique: trois lignes du bandeau. */
    maxChars: v.pipe(IntSchema, v.minValue(40), v.maxValue(400)),
    charsPerSecond: Positive,
    maxOptions: v.pipe(IntSchema, v.minValue(2), v.maxValue(4)),
  }),
});
export type Settings = v.InferOutput<typeof SettingsSchema>;
