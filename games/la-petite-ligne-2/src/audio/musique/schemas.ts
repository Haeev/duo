/**
 * Schémas de la table de musique (`donnees/musique.json`). Le moteur ne nomme aucun morceau: le
 * choix de ce qui joue vient des règles de cette table, validées au chargement.
 */
import * as v from 'valibot';
import { FiniteSchema, IdSchema, IntSchema } from '../../donnees/schemas/communs';
import { SEASONS } from '../../donnees/schemas/prise';
import { PHASES, WEATHERS } from '../../etat/commun';

const Db = v.pipe(FiniteSchema, v.minValue(-60), v.maxValue(12));
/** Chemin d'un fichier sous `assets/commun/son/` (`musique/bourg-matin-air.ogg`). */
const FileSchema = v.pipe(v.string(), v.regex(/^[a-z0-9-]+\/[a-z0-9-]+\.ogg$/));
const Hour = v.pipe(FiniteSchema, v.minValue(0), v.maxValue(24));
const Range = v.tuple([v.pipe(FiniteSchema, v.minValue(0)), v.pipe(FiniteSchema, v.minValue(0))]);

/** Une tige: un fichier mono qui boucle avec les autres tiges du morceau. */
export const StemSchema = v.strictObject({
  file: FileSchema,
  /** Panoramique de -1 (gauche) à 1 (droite): les tiges sont mono, le panoramique les écarte un peu. */
  pan: v.pipe(FiniteSchema, v.minValue(-1), v.maxValue(1)),
  volumeDb: Db,
});

export const TrackSchema = v.strictObject({
  /** Durée de la boucle (s), sans les amorces (`timing.preroll` de chaque côté dans le fichier). */
  seconds: v.pipe(IntSchema, v.minValue(10), v.maxValue(180)),
  /** Tiges par rôle (`fond`, `air`): le même nom d'un morceau à l'autre, pour les couches. */
  stems: v.pipe(v.record(IdSchema, StemSchema), v.minEntries(1)),
});

export const JingleSchema = v.strictObject({
  file: FileSchema,
  volumeDb: Db,
  /** Écart (dB) dont la musique recule pendant le jingle. */
  duckDb: v.pipe(FiniteSchema, v.minValue(-24), v.maxValue(0)),
  /** Durée du fichier (s), pour rendre la musique à la fin du jingle. */
  seconds: v.pipe(FiniteSchema, v.minValue(0.5), v.maxValue(10)),
});

/** Conditions d'une règle: chaque champ présent doit convenir, une liste convient si elle contient la valeur. */
export const WhenSchema = v.strictObject({
  places: v.exactOptional(v.array(IdSchema)),
  /** Zones du lieu (rivière, voie...), fournies par l'hôte (`zoneAt`). */
  zones: v.exactOptional(v.array(IdSchema)),
  bands: v.exactOptional(v.array(IdSchema)),
  weathers: v.exactOptional(v.array(v.picklist(WEATHERS))),
  seasons: v.exactOptional(v.array(v.picklist(SEASONS))),
  phases: v.exactOptional(v.array(v.picklist(PHASES))),
  /** Scène en cours (`common.story.scene.id`). */
  scenes: v.exactOptional(v.array(IdSchema)),
  /** Événements du calendrier en cours dans le lieu. */
  events: v.exactOptional(v.array(IdSchema)),
});
export type When = v.InferOutput<typeof WhenSchema>;

export const RuleSchema = v.strictObject({
  id: IdSchema,
  when: WhenSchema,
  /** Morceau à jouer, ou `null`: silence voulu (l'ambiance seule). */
  play: v.nullable(IdSchema),
  pacing: IdSchema,
});
export type Rule = v.InferOutput<typeof RuleSchema>;

/** Couches: appliquées toutes ensemble quand leurs conditions conviennent (somme des dB). */
export const ModifierSchema = v.strictObject({
  id: IdSchema,
  when: WhenSchema,
  /** Écart de niveau par rôle de tige (`air: -6`); -60 retire la tige. */
  stemsDb: v.exactOptional(v.record(IdSchema, Db), {}),
  /** Écart de niveau de tout le morceau. */
  gainDb: v.exactOptional(Db, 0),
  /** Passe-bas du morceau (Hz): plus feutré. Le plus bas des valeurs retenues gagne. */
  lowpassHz: v.exactOptional(v.pipe(FiniteSchema, v.minValue(500), v.maxValue(20000))),
});
export type Modifier = v.InferOutput<typeof ModifierSchema>;

/** Rythme des plages de calme: durée de jeu d'un morceau puis de silence (s), tirées dans chaque plage. */
export const PacingSchema = v.nullable(v.strictObject({ playSeconds: Range, quietSeconds: Range }));

export const JingleRuleSchema = v.strictObject({
  /** Type de l'événement de la simulation. */
  on: v.pipe(v.string(), v.regex(/^[a-z_]+$/)),
  /** Champs qui doivent valoir ceci (valeur exacte). */
  where: v.exactOptional(
    v.record(v.string(), v.union([v.string(), v.number(), v.boolean(), v.null()])),
    {},
  ),
  jingle: IdSchema,
  /** Champ de l'événement qui désigne le joueur acteur (absent de l'événement: les deux). */
  actor: v.exactOptional(v.picklist(['player', 'by']), 'player'),
  /** `own`: seul l'acteur l'entend; `both`: les deux, l'autre un peu plus bas. */
  audience: v.picklist(['own', 'both']),
});
export type JingleRule = v.InferOutput<typeof JingleRuleSchema>;

export const MusicTableSchema = v.strictObject({
  /** Lieux annoncés dont les données n'existent pas encore (le test ne les exige pas du contenu). */
  plannedPlaces: v.array(IdSchema),
  timing: v.strictObject({
    /** Fréquence de décodage (Hz): les fichiers sont lus à cette fréquence, la mémoire en dépend. */
    decodeRate: v.picklist([16000, 24000, 32000, 44100, 48000]),
    /** Amorce (s) de chaque côté de la boucle dans les fichiers. */
    preroll: v.pipe(FiniteSchema, v.minValue(0), v.maxValue(4)),
    /** Fondu enchaîné entre deux morceaux, fondu d'entrée et de sortie autour d'un silence (s). */
    crossfadeSeconds: v.pipe(FiniteSchema, v.minValue(0.5), v.maxValue(20)),
    fadeSeconds: v.pipe(FiniteSchema, v.minValue(0.5), v.maxValue(20)),
    /** Après un thème d'arrivée, la musique attend ce délai (s). */
    arrivalHoldSeconds: v.pipe(FiniteSchema, v.minValue(0), v.maxValue(30)),
    /** Délai minimal (s) entre deux lectures du même jingle. */
    jingleCooldownSeconds: v.pipe(FiniteSchema, v.minValue(0), v.maxValue(20)),
    /** Les gestes de l'autre joueur: jingle un peu plus bas (dB). */
    otherPlayerDb: Db,
    /** Morceaux décodés gardés en mémoire (en plus de celui qui joue). */
    residentTracks: v.pipe(IntSchema, v.minValue(1), v.maxValue(6)),
    /** Période de réévaluation du contexte (s). */
    tickSeconds: v.pipe(FiniteSchema, v.minValue(0.05), v.maxValue(5)),
  }),
  /** Tranches horaires (heure de jeu de, à; peut passer minuit), la première qui convient. */
  bands: v.record(IdSchema, v.tuple([Hour, Hour])),
  tracks: v.record(IdSchema, TrackSchema),
  jingles: v.record(IdSchema, JingleSchema),
  pacings: v.record(IdSchema, PacingSchema),
  /** Le premier gabarit qui convient gagne: les cas précis d'abord, le général ensuite. */
  rules: v.array(RuleSchema),
  modifiers: v.array(ModifierSchema),
  jingleRules: v.array(JingleRuleSchema),
  /** Thème court joué à l'arrivée dans un lieu (lieu vers jingle). */
  arrivals: v.record(IdSchema, IdSchema),
  defaults: v.strictObject({
    /** Volume de la musique réglé par le joueur (0 à 1), séparé de tout le reste. */
    music: v.pipe(FiniteSchema, v.minValue(0), v.maxValue(1)),
    /** Niveau de jeu de la musique sous les effets (dB). */
    levelDb: Db,
  }),
  storageKey: v.string(),
});
export type MusicTable = v.InferOutput<typeof MusicTableSchema>;
export type Track = v.InferOutput<typeof TrackSchema>;
export type Pacing = v.InferOutput<typeof PacingSchema>;
