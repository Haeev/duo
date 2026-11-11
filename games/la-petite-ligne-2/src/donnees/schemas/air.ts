/**
 * `donnees/commun/airs/<id>.json`: un air jouable (cahier 4.7, musique). L'identifiant est celui
 * de sa fiche du carnet (`commun/carnet/<id>.json`, source `tune`) et de son morceau dans la table
 * de musique: l'accompagnement vient de là.
 *
 * Le haut du fichier s'écrit à la main (rang, difficulté, d'où vient chaque voix). Le bloc
 * `score` ne s'écrit jamais à la main: `pnpm partition <id>` le tire du fichier MIDI de l'air
 * (`assets-src/son/musique/midi/`), et un test refuse une partition qui ne vient pas de là.
 */
import * as v from 'valibot';
import { FileVersionSchema, FiniteSchema, IdSchema, IntSchema, LabelSchema } from './communs';

/** Les quatre touches, de la plus grave (0) à la plus aiguë (3). */
export const LANES = 4;

const Bar = v.pipe(IntSchema, v.minValue(0), v.maxValue(400));

/** D'où vient une voix: des pistes du fichier MIDI, entières ou par tranches de mesures. */
export const AirPartSchema = v.strictObject({
  /** Nom de la piste dans le fichier MIDI (`pnpm partition --pistes <id>` les liste). */
  track: v.pipe(v.string(), v.minLength(1), v.maxLength(40)),
  /** Mesures gardées, de `fromBar` (comprise) à `toBar` (exclue), comptées depuis le début de l'air. */
  fromBar: v.exactOptional(Bar),
  toBar: v.exactOptional(Bar),
  /** Transposition en demi-tons (une piste grave remontée dans le registre de l'instrument). */
  transpose: v.exactOptional(v.pipe(IntSchema, v.minValue(-36), v.maxValue(36))),
});

export const AirVoiceSchema = v.strictObject({
  /** Nom affiché de la voix (« Chant », « Réponse »). */
  name: LabelSchema,
  parts: v.pipe(v.array(AirPartSchema), v.minLength(1), v.maxLength(16)),
});

/** Une note de la partition: [instant (ms depuis le début de l'extrait), touche, hauteur MIDI, durée (ms)]. */
export const AirNoteSchema = v.tuple([
  v.pipe(IntSchema, v.minValue(0), v.maxValue(600_000)),
  v.pipe(IntSchema, v.minValue(0), v.maxValue(LANES - 1)),
  v.pipe(IntSchema, v.minValue(24), v.maxValue(108)),
  v.pipe(IntSchema, v.minValue(40), v.maxValue(8000)),
]);
export type AirNote = v.InferOutput<typeof AirNoteSchema>;

const Notes = v.pipe(v.array(AirNoteSchema), v.minLength(4), v.maxLength(600));

/** La partition tirée du MIDI par `outils/partition-air.ts`. */
export const AirScoreSchema = v.strictObject({
  /** Noires par minute et noires par mesure, lues dans le fichier MIDI. */
  tempo: v.pipe(FiniteSchema, v.minValue(30), v.maxValue(240)),
  beatsPerBar: v.pipe(FiniteSchema, v.minValue(1), v.maxValue(12)),
  /** Début de l'extrait dans la boucle de l'accompagnement, et sa longueur (ms). */
  startMs: v.pipe(IntSchema, v.minValue(0)),
  lengthMs: v.pipe(IntSchema, v.minValue(4000), v.maxValue(180_000)),
  solo: Notes,
  /** Les deux voix du duo; absente: à deux, on joue la voix seule à l'unisson. */
  duo: v.exactOptional(v.tuple([Notes, Notes])),
});
export type AirScore = v.InferOutput<typeof AirScoreSchema>;

export const PlayableAirSchema = v.strictObject({
  schema: FileVersionSchema,
  id: IdSchema,
  /** Rang dans le cahier de fanfare: un instrument de base joue les trois premiers rangs (4.5). */
  order: v.pipe(IntSchema, v.minValue(1), v.maxValue(99)),
  /** Difficulté affichée, de 1 (lent, notes espacées) à 3. */
  difficulty: v.picklist([1, 2, 3]),
  source: v.strictObject({
    /** Fichier de `assets-src/son/musique/midi/`. */
    midi: v.pipe(v.string(), v.regex(/^[a-z0-9-]+\.mid$/)),
    /** Extrait joué: première mesure et nombre de mesures. */
    fromBar: Bar,
    bars: v.pipe(IntSchema, v.minValue(2), v.maxValue(200)),
    /** Écart minimal entre deux notes à frapper (ms): les notes plus serrées restent à l'orchestre. */
    minGapMs: v.pipe(IntSchema, v.minValue(120), v.maxValue(2000)),
    /** Les hauteurs se rangent sur les quatre touches par groupes de tant de mesures. */
    laneBars: v.exactOptional(v.pipe(IntSchema, v.minValue(1), v.maxValue(16))),
  }),
  voices: v.strictObject({
    solo: AirVoiceSchema,
    duo: v.exactOptional(v.tuple([AirVoiceSchema, AirVoiceSchema])),
  }),
  /** Absente dans le gabarit tant que `pnpm partition` n'est pas passé: l'air n'est alors pas jouable. */
  score: v.exactOptional(AirScoreSchema),
});
export type PlayableAirDef = v.InferOutput<typeof PlayableAirSchema>;
