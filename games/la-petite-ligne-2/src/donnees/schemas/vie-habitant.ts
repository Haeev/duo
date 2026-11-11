/**
 * Vie d'un habitant (champ `life` de sa fiche): son planning, ses goûts, ses réactions, son
 * arrivée par le train. Lu par le système `simulation/habitants/`; contrôlé à travers les
 * fichiers par `simulation/habitants/valider.ts` (planning sans trou, points et sièges existants).
 */
import * as v from 'valibot';
import { IdSchema, IntSchema } from './communs';
import { CATCH_WEATHERS as WEATHERS, SEASONS } from './prise';
import { ConditionSchema } from './regles';

/** Jours de la semaine; le jour 1 de la partie est un lundi (cahier 4.3). */
export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

const Minute = v.pipe(IntSchema, v.minValue(0), v.maxValue(1440));

/**
 * Où se tient l'activité: jamais dans le vide. Un point de la carte, une place assise d'un meuble
 * à brique `sit`, une place couchée d'un meuble à brique `sleep` (son lit, la nuit), ou un meuble
 * devant (ou derrière: le comptoir) lequel on travaille. Le point ou le meuble peut être dans un
 * intérieur: l'habitant y va par les portes (`simulation/lieux/traversee.ts`).
 */
export const SpotSchema = v.union([
  v.strictObject({ point: IdSchema }),
  v.strictObject({ seat: IdSchema }),
  v.strictObject({ bed: IdSchema }),
  v.strictObject({ object: IdSchema, side: v.picklist(['front', 'behind']) }),
]);
export type Spot = v.InferOutput<typeof SpotSchema>;

/**
 * Une ligne du planning. Les lignes se lisent dans l'ordre: la première dont l'heure et les
 * conditions conviennent l'emporte. Une liste absente ne filtre rien.
 */
export const ScheduleEntrySchema = v.strictObject({
  /** Plage d'heures en minutes (`from` inclus, `to` exclu; elle peut passer minuit). */
  from: Minute,
  to: Minute,
  days: v.exactOptional(v.pipe(v.array(v.picklist(WEEKDAYS)), v.minLength(1))),
  weathers: v.exactOptional(v.pipe(v.array(v.picklist(WEATHERS)), v.minLength(1))),
  seasons: v.exactOptional(v.pipe(v.array(v.picklist(SEASONS)), v.minLength(1))),
  /** Conditions d'histoire (faits retenus, cœurs, lieu): les règles du lot L3. */
  when: v.exactOptional(v.array(ConditionSchema)),
  at: SpotSchema,
  /** Nom de l'activité, lu par le rendu et l'interface (`balayer`, `comptoir`, `discuter`). */
  activity: IdSchema,
  /** Geste joué sur place, en boucle (clip du rendu); `null`: posture de repos. */
  gesture: v.nullable(IdSchema),
  /** Discuter à deux: l'autre habitant, qui doit avoir une ligne qui le nomme en retour. */
  with: v.exactOptional(IdSchema),
  /** Commerce tenu pendant cette ligne: ouvert quand le commerçant est à son poste. */
  shop: v.exactOptional(IdSchema),
});
export type ScheduleEntry = v.InferOutput<typeof ScheduleEntrySchema>;

/** Actes simples des joueurs auxquels un habitant réagit d'une émotion, de près. */
export const REACTION_ACTS = ['runs', 'dirty', 'gesture'] as const;

export const VillagerLifeSchema = v.strictObject({
  /** Point de la carte chez lui: il y est la nuit, ou couché dans la même pièce (contrôlé à 3 h). */
  home: IdSchema,
  schedule: v.pipe(v.array(ScheduleEntrySchema), v.minLength(1), v.maxLength(32)),
  /** Onomatopée du premier bonjour du jour à chaque joueur. */
  greeting: IdSchema,
  reactions: v.pipe(
    v.array(
      v.strictObject({
        act: v.picklist(REACTION_ACTS),
        /** Pour `gesture`: le clip du joueur qui le fait réagir. */
        clip: v.exactOptional(IdSchema),
        emote: IdSchema,
      }),
    ),
    v.maxLength(6),
  ),
  /** Goûts: objets adorés, aimés, détestés; tout autre cadeau est reçu poliment. */
  gifts: v.strictObject({
    loved: v.array(IdSchema),
    liked: v.array(IdSchema),
    disliked: v.array(IdSchema),
  }),
  /** Absent du lieu tant que ces conditions sont fausses, puis il descend du train. `null`: là dès le début. */
  arrives: v.nullable(v.pipe(v.array(ConditionSchema), v.minLength(1))),
  /** Il reprend le train quand ces conditions deviennent vraies. `null`: il reste. */
  leaves: v.nullable(v.pipe(v.array(ConditionSchema), v.minLength(1))),
});
export type VillagerLife = v.InferOutput<typeof VillagerLifeSchema>;
