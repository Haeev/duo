/**
 * Schémas des tables sonores (`src/audio/donnees/*.json`). Le moteur ne nomme aucun son: tout ce
 * qui se joue vient de ces tables, validées au chargement (une faute nomme le fichier et le champ).
 */
import * as v from 'valibot';
import { FiniteSchema, IdSchema, IntSchema } from '../donnees/schemas/communs';

/** Réglage joueur par catégorie; la plateforme garde ses propres bus par-dessus. */
export const CATEGORIES = ['effects', 'interface', 'babble', 'ambience'] as const;
export type Category = (typeof CATEGORIES)[number];
export const CategorySchema = v.picklist(CATEGORIES);

const Db = v.pipe(FiniteSchema, v.minValue(-60), v.maxValue(12));
/** Chemin d'un fichier sous `assets/commun/son/` (`effets/page.ogg`). */
export const SoundFileSchema = v.pipe(v.string(), v.regex(/^[a-z0-9-]+\/[a-z0-9-]+\.ogg$/));

export const SoundDefSchema = v.strictObject({
  /** Variantes tirées sans répétition immédiate. */
  files: v.pipe(v.array(SoundFileSchema), v.minLength(1), v.maxLength(8)),
  category: CategorySchema,
  volumeDb: Db,
  /** Écart de hauteur tiré à chaque lecture (0,04 = plus ou moins 4 %). */
  pitchVariation: v.pipe(FiniteSchema, v.minValue(0), v.maxValue(0.2)),
  gainVariationDb: v.pipe(FiniteSchema, v.minValue(0), v.maxValue(6)),
  /** 1 jamais coupé, 4 coupé en premier. */
  priority: v.picklist([1, 2, 3, 4]),
  /** Lectures simultanées au plus de ce son. */
  maxVoices: v.pipe(IntSchema, v.minValue(1), v.maxValue(8)),
  /** Délai minimal entre deux lectures (ms): deux joueurs qui font le même geste ne doublent pas. */
  minIntervalMs: v.pipe(IntSchema, v.minValue(0), v.maxValue(2000)),
  /**
   * Son tenu (une sonnerie): après une lecture jusqu'à `to`, il reprend de `from` à `to` (s, sur
   * des attaques du fichier) jusqu'à ce qu'une règle `stop` le fasse taire.
   */
  loop: v.exactOptional(
    v.strictObject({
      from: v.pipe(FiniteSchema, v.minValue(0)),
      to: v.pipe(FiniteSchema, v.minValue(0.1)),
    }),
  ),
});
export type SoundDef = v.InferOutput<typeof SoundDefSchema>;
export const SoundTableSchema = v.record(IdSchema, SoundDefSchema);
export type SoundTable = v.InferOutput<typeof SoundTableSchema>;

const Literal = v.union([v.string(), v.number(), v.boolean(), v.null()]);
/** Condition sur un champ de l'événement: valeur exacte, ou bornes `gt` / `lt` pour un nombre. */
const Condition = v.union([
  Literal,
  v.strictObject({
    gt: v.exactOptional(FiniteSchema),
    lt: v.exactOptional(FiniteSchema),
    notNull: v.exactOptional(v.boolean()),
  }),
]);

export const EventRuleSchema = v.strictObject({
  /** Type de l'événement de la simulation (`gesture_done`). */
  on: v.pipe(v.string(), v.regex(/^[a-z_]+$/)),
  /** Champs qui doivent valoir ceci. */
  where: v.exactOptional(v.record(v.string(), Condition), {}),
  sound: IdSchema,
  /** Champ de l'événement qui désigne le joueur acteur (`player` par défaut; `to`, `who`). */
  actor: v.exactOptional(v.picklist(['player', 'from', 'to', 'who']), 'player'),
  /**
   * `own`: seul l'acteur l'entend (retour privé); `both`: les deux, l'autre un peu plus bas;
   * `other`: seulement l'autre joueur (l'acteur a déjà eu son signal immédiat de l'interface).
   */
  audience: v.picklist(['own', 'both', 'other']),
  /** Joué à la position de l'acteur (écoute placée) ou sans position. */
  placed: v.boolean(),
  /** Fait taire `sound` (un son tenu) au lieu de le jouer. */
  stop: v.exactOptional(v.boolean()),
});
export type EventRule = v.InferOutput<typeof EventRuleSchema>;

export const EventTableSchema = v.strictObject({
  /** Le premier gabarit qui convient gagne: les cas précis d'abord, le général ensuite. */
  rules: v.array(EventRuleSchema),
  /** Sons demandés par l'interface (nom de signal vers son): ouvrir le carnet, choisir... */
  cues: v.record(IdSchema, IdSchema),
  /** Son joué quand la cible visée change (retour immédiat avant l'appui). */
  aim: IdSchema,
});
export type EventTable = v.InferOutput<typeof EventTableSchema>;

const Midi = v.pipe(FiniteSchema, v.minValue(24), v.maxValue(108));

export const TimbreSchema = v.strictObject({
  file: SoundFileSchema,
  /** Note MIDI enregistrée dans le fichier. */
  rootMidi: Midi,
});

export const VoiceSchema = v.strictObject({
  timbre: IdSchema,
  /** Tonique de la voix (note MIDI). */
  tonicMidi: Midi,
  /** Demi-tons au-dessus de la tonique, dans l'ordre des degrés. */
  scale: v.pipe(v.array(IntSchema), v.minLength(3), v.maxLength(8)),
  /** Étendue des syllabes en degrés de la gamme (au-dessus de la tonique). */
  span: v.pipe(IntSchema, v.minValue(2), v.maxValue(12)),
  /** Durée d'une syllabe (ms), et écart minimal entre deux (le débit). */
  noteMs: v.pipe(IntSchema, v.minValue(40), v.maxValue(400)),
  minGapMs: v.pipe(IntSchema, v.minValue(20), v.maxValue(600)),
  /** Voyelle: plus longue. Consonne: plus brève. */
  vowelLength: v.pipe(FiniteSchema, v.minValue(0.5), v.maxValue(2)),
  consonantLength: v.pipe(FiniteSchema, v.minValue(0.3), v.maxValue(1.5)),
  /** Tirage de hauteur en plus du caractère (demi-tons, 0 pour une voix très régulière). */
  wobble: v.pipe(FiniteSchema, v.minValue(0), v.maxValue(1)),
  volumeDb: Db,
});
export type VoiceDef = v.InferOutput<typeof VoiceSchema>;

export const VoiceTableSchema = v.strictObject({
  timbres: v.record(IdSchema, TimbreSchema),
  voices: v.record(IdSchema, VoiceSchema),
  /** Voix des habitants dont la fiche en nomme une inconnue. */
  fallback: IdSchema,
  /** Ponctuation: demi-tons ajoutés à la dernière syllabe et facteur de durée. */
  punctuation: v.record(
    v.pipe(v.string(), v.length(1)),
    v.strictObject({
      semitones: FiniteSchema,
      length: v.pipe(FiniteSchema, v.minValue(0.3), v.maxValue(3)),
      gainDb: Db,
    }),
  ),
  /** Lettres qui comptent comme des voyelles. */
  vowels: v.pipe(v.string(), v.minLength(1)),
});
export type VoiceTable = v.InferOutput<typeof VoiceTableSchema>;

export const AmbienceLayerSchema = v.strictObject({
  file: SoundFileSchema,
  /** `day` et `night` se fondent selon l'heure; `travel` couvre tout pendant le voyage. */
  when: v.picklist(['day', 'night', 'travel']),
  volumeDb: Db,
});

export const AmbienceTableSchema = v.strictObject({
  layers: v.record(IdSchema, AmbienceLayerSchema),
  /** Heures de jeu (0 à 24) où le jour se lève (de, à) et se couche. */
  dawn: v.tuple([FiniteSchema, FiniteSchema]),
  dusk: v.tuple([FiniteSchema, FiniteSchema]),
  /** Durée du fondu entre deux états (s). */
  fadeSeconds: v.pipe(FiniteSchema, v.minValue(0.1), v.maxValue(10)),
});
export type AmbienceTable = v.InferOutput<typeof AmbienceTableSchema>;

export const TuningSchema = v.strictObject({
  space: v.strictObject({
    /** Distance (m) sous laquelle un son placé garde son plein niveau, et pente de l'atténuation. */
    refDistance: v.pipe(FiniteSchema, v.minValue(0.5)),
    rolloff: v.pipe(FiniteSchema, v.minValue(0)),
    /** Au-delà, le son n'est pas lancé. */
    cullDistance: v.pipe(FiniteSchema, v.minValue(1)),
    /** Écart latéral (m) qui donne le panoramique extrême, et amplitude de ce panoramique (0 à 1). */
    panWidth: v.pipe(FiniteSchema, v.minValue(0.5)),
    panAmount: v.pipe(FiniteSchema, v.minValue(0), v.maxValue(1)),
    /** Les gestes de l'autre joueur sont un peu plus bas que les siens. */
    otherPlayerDb: Db,
  }),
  steps: v.strictObject({
    /** Distance entre deux pas (m): calée sur la foulée des personnages. */
    strideMeters: v.pipe(FiniteSchema, v.minValue(0.2)),
    minSpeed: v.pipe(FiniteSchema, v.minValue(0)),
    /** Surface sous les pieds vers son, `default` quand elle est inconnue. */
    surfaces: v.record(IdSchema, IdSchema),
    default: IdSchema,
  }),
  /** Plafond de lectures simultanées d'effets: au-delà, les priorités 4 puis 3 cèdent. */
  maxVoices: v.pipe(IntSchema, v.minValue(4)),
  /** Fondu (s) d'un son tenu qu'une règle `stop` fait taire (la sonnerie s'éteint, pas de coupure). */
  heldFadeSeconds: v.exactOptional(v.pipe(FiniteSchema, v.minValue(0.02), v.maxValue(3)), 0.4),
  defaults: v.strictObject({
    master: v.pipe(FiniteSchema, v.minValue(0), v.maxValue(1)),
    effects: v.pipe(FiniteSchema, v.minValue(0), v.maxValue(1)),
    interface: v.pipe(FiniteSchema, v.minValue(0), v.maxValue(1)),
    babble: v.pipe(FiniteSchema, v.minValue(0), v.maxValue(1)),
    ambience: v.pipe(FiniteSchema, v.minValue(0), v.maxValue(1)),
  }),
  storageKey: v.string(),
});
export type Tuning = v.InferOutput<typeof TuningSchema>;
