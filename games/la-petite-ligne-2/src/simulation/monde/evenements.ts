/** Événements du temps du monde: météo, pluie qui arrose, annonce du lendemain, calendrier. */
import * as v from 'valibot';
import { IdSchema, IntSchema } from '../../donnees/schemas/communs';
import { WORLD_WEATHERS } from '../../donnees/schemas/regles';

const Weather = v.picklist(WORLD_WEATHERS);

export const WORLD_EVENTS = [
  /** La météo du lieu courant change (rendu, son, horloge). */
  v.strictObject({ type: v.literal('weather_changed'), place: IdSchema, weather: Weather }),
  /** Il pleut sur le lieu courant: les cultures comptent ce jour comme arrosé (au plus une fois par jour et par reprise). */
  v.strictObject({
    type: v.literal('rain_watered'),
    place: IdSchema,
    day: v.pipe(IntSchema, v.minValue(1)),
  }),
  /** Le lendemain est connu: météo du matin et événements annoncés (interface: annonce). */
  v.strictObject({
    type: v.literal('outlook_ready'),
    place: IdSchema,
    day: v.pipe(IntSchema, v.minValue(1)),
    weather: Weather,
    events: v.pipe(v.array(IdSchema), v.maxLength(8)),
  }),
  /** Un événement du calendrier commence ou finit au lieu courant. */
  v.strictObject({ type: v.literal('calendar_started'), place: IdSchema, event: IdSchema }),
  v.strictObject({ type: v.literal('calendar_ended'), place: IdSchema, event: IdSchema }),
  /** Un coup de la cloche des heures (`stroke` sur `strokes`): rejoué chez l'invité pour le son. */
  v.strictObject({
    type: v.literal('clock_struck'),
    place: IdSchema,
    hour: v.pipe(IntSchema, v.minValue(0), v.maxValue(23)),
    stroke: v.pipe(IntSchema, v.minValue(1), v.maxValue(12)),
    strokes: v.pipe(IntSchema, v.minValue(1), v.maxValue(12)),
  }),
] as const;
