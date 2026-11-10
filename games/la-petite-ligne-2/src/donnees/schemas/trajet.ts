/**
 * Heure d'arrivée d'un trajet (lot L2, `simulation/voyage/`). Sans règle, un trajet prend
 * `travel.clockHours` heures de jeu (`reglages.json`). Un trajet de l'histoire (effet
 * `travel_to`) peut déclarer une autre règle: une durée, une heure fixe, ou un saut de nuit.
 */
import * as v from 'valibot';
import { FiniteSchema, IntSchema } from './communs';

/** Minutes de jeu depuis minuit. */
const MinuteOfDay = v.pipe(IntSchema, v.minValue(0), v.maxValue(1439));

export const TripArrivalSchema = v.variant('kind', [
  /** Le trajet prend `hours` heures de jeu. */
  v.strictObject({
    kind: v.literal('hours'),
    hours: v.pipe(FiniteSchema, v.minValue(0), v.maxValue(24)),
  }),
  /** Arrivée à l'heure `minute`, la prochaine qui vient (aujourd'hui si elle est à venir, sinon demain). */
  v.strictObject({ kind: v.literal('at'), minute: MinuteOfDay }),
  /**
   * Saut de nuit: arrivée le matin à `minute` (une heure après l'aube, `clock.dayStart`). Si la nuit n'est pas encore passée (départ le soir,
   * dans la nuit ou après `minute`), on la passe à bord comme dans un lit: nouveau jour, sommeil
   * remonté à `wakeAt`, faim et hygiène comme après une nuit (cahier 4.4). Déjà passée (départ
   * entre l'aube et `minute`, après avoir dormi), l'horloge avance seulement jusqu'à `minute`.
   */
  v.strictObject({
    kind: v.literal('night'),
    minute: MinuteOfDay,
    wakeAt: v.pipe(FiniteSchema, v.minValue(0), v.maxValue(100)),
  }),
]);
export type TripArrival = v.InferOutput<typeof TripArrivalSchema>;
