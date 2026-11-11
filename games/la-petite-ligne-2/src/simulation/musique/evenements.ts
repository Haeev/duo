/** Événements de la musique jouée: l'interface et le son des deux machines les lisent. */
import * as v from 'valibot';
import {
  CentsSchema,
  IdSchema,
  IntSchema,
  PlayerIndexSchema,
  TickSchema,
} from '../../donnees/schemas/communs';
import { VERDICTS } from './reglages';

/** Voix tenue par un joueur: la voix seule, ou l'une des deux voix du duo. */
export const VoiceSchema = v.picklist(['solo', 0, 1]);
export type VoiceId = v.InferOutput<typeof VoiceSchema>;

const Count = v.pipe(IntSchema, v.minValue(0), v.maxValue(600));
const Rating = v.picklist([0, 1, 2, 3]);

/** Ce qu'un joueur a fait de l'air, et ce qu'il en retire. */
const ResultSchema = v.strictObject({
  rating: Rating,
  just: Count,
  /** Un peu tôt ou un peu tard: la note sonne juste quand même. */
  near: Count,
  false: Count,
  missed: Count,
  /** Pièces du chapeau (centimes), 0 s'il a déjà tourné aujourd'hui ou sans auditeur. */
  cents: CentsSchema,
  /** Auditeurs dont l'amitié a monté. */
  friends: Count,
});
export type MusicResult = v.InferOutput<typeof ResultSchema>;

export const MUSIC_EVENTS = [
  /**
   * Le joueur s'installe à un endroit où jouer, instrument en main. `leader`: celui qui tient le
   * cahier et choisit l'air; l'autre le rejoint pour un duo. `airs`: les airs que le duo a appris
   * (l'album des collections ne voyage pas jusqu'à l'invité: le cahier se lit ici).
   */
  v.strictObject({
    type: v.literal('music_opened'),
    player: PlayerIndexSchema,
    target: IdSchema,
    leader: PlayerIndexSchema,
    airs: v.pipe(v.array(IdSchema), v.maxLength(99)),
  }),
  /**
   * L'air part. `voices`: la voix de chaque joueur (`null`: il ne joue pas). `startTick`: premier
   * temps sur l'horloge de l'hôte (elle fait foi pour valider); `startAtMs`: le même instant sur
   * l'heure de session commune, pour que les deux machines fassent partir l'accompagnement ensemble.
   */
  v.strictObject({
    type: v.literal('music_started'),
    target: IdSchema,
    air: IdSchema,
    leader: PlayerIndexSchema,
    voices: v.tuple([v.nullable(VoiceSchema), v.nullable(VoiceSchema)]),
    startTick: TickSchema,
    startAtMs: v.pipe(v.number(), v.finite(), v.minValue(0)),
  }),
  /** Une note validée par l'hôte: l'autre machine l'entend, la partition de l'autre se coche. */
  v.strictObject({
    type: v.literal('music_note'),
    player: PlayerIndexSchema,
    index: Count,
    verdict: v.picklist(VERDICTS),
  }),
  /**
   * L'air est allé au bout. `together`: duo réussi ensemble (récompenses majorées). `first`: cet
   * air n'avait jamais été joué. `listeners`: habitants qui ont écouté.
   */
  v.strictObject({
    type: v.literal('music_finished'),
    target: IdSchema,
    air: IdSchema,
    rating: Rating,
    duo: v.boolean(),
    together: v.boolean(),
    first: v.boolean(),
    listeners: Count,
    results: v.tuple([v.nullable(ResultSchema), v.nullable(ResultSchema)]),
  }),
  /** Le joueur a rangé son instrument (ou s'est éloigné): son cahier se ferme. */
  v.strictObject({
    type: v.literal('music_closed'),
    player: PlayerIndexSchema,
    target: IdSchema,
  }),
] as const;
