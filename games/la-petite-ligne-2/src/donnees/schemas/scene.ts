/**
 * `donnees/lieux/<lieu>/scenes/<id>.json`: une scène scriptée, jouée par l'hôte chez les deux
 * joueurs à la fois (moteur: `src/simulation/scenes/`). Elle se lance par l'effet `play_scene`
 * d'une étape ou par son déclencheur de monde (heure, lieu, présence des deux, histoire).
 * Ce fichier porte aussi l'état d'une scène en cours et du suivi des quêtes (`StoryStateSchema`),
 * rangé dans la tranche « commun ».
 */
import * as v from 'valibot';
import {
  FileVersionSchema,
  FiniteSchema,
  IdSchema,
  IntSchema,
  LabelSchema,
  PlayerIndexSchema,
  TextSchema,
  TickSchema,
} from './communs';
import { EMOTES } from './dialogue';
import { StepConditionSchema, StepEffectSchema } from './quete';

const Seconds = v.pipe(FiniteSchema, v.minValue(0), v.maxValue(60));
const Minutes = v.pipe(FiniteSchema, v.minValue(0), v.maxValue(1440));

/** Rôle d'un joueur dans une scène à deux asymétrique (`roles` de la scène). */
export const RoleSchema = v.picklist(['a', 'b']);
export type Role = v.InferOutput<typeof RoleSchema>;

/** Qui parle ou bouge: un habitant du lieu, un rôle joué par un joueur, ou la voix du récit. */
const ActorSchema = v.union([IdSchema, v.literal('narrator')]);
/** Pour qui: les deux joueurs, ou le seul joueur d'un rôle (scène asymétrique). */
const AudienceSchema = v.picklist(['both', 'a', 'b']);
const FocusSchema = v.union([
  v.strictObject({ point: IdSchema }),
  v.strictObject({ villager: IdSchema }),
]);
export type Focus = v.InferOutput<typeof FocusSchema>;

/**
 * Geste d'une partie d'attente (scène à deux rôles), lu sur la touche d'action tenue (`act` des
 * commandes) ou la position du joueur, chez l'hôte: `hold`, tenir la touche `seconds`; `press`,
 * l'appuyer une fois; `stand`, rester `seconds` à moins de `radius` m du point.
 */
export const GestureSchema = v.variant('type', [
  v.strictObject({ type: v.literal('hold'), seconds: v.pipe(Seconds, v.minValue(0.2)) }),
  v.strictObject({ type: v.literal('press') }),
  v.strictObject({
    type: v.literal('stand'),
    point: IdSchema,
    radius: v.exactOptional(v.pipe(FiniteSchema, v.minValue(0.5), v.maxValue(10))),
    seconds: Seconds,
  }),
]);
export type GestureDef = v.InferOutput<typeof GestureSchema>;

/** Avancement d'un geste en cours: touche tenue, et pas où le maintien, l'appui ou la station a commencé. */
export const GestureRunSchema = v.strictObject({
  down: v.boolean(),
  since: v.nullable(TickSchema),
});
export type GestureRun = v.InferOutput<typeof GestureRunSchema>;

export const BeatSchema = v.variant('do', [
  /**
   * Une réplique. Elle passe quand chaque joueur concerné l'a lue (`scene_next`), ou au bout de
   * `seconds` si c'est donné; jamais plus que le plafond des réglages (un joueur parti ne bloque rien).
   */
  v.strictObject({
    do: v.literal('say'),
    /** Habitant, `a` ou `b` (le personnage d'un joueur), ou `narrator`. */
    who: ActorSchema,
    text: TextSchema,
    emote: v.nullable(v.picklist(EMOTES)),
    /** Onomatopée affichée en bulle (« Ding ! »), `null`: aucune. */
    sound: v.nullable(LabelSchema),
    to: AudienceSchema,
    seconds: v.nullable(Seconds),
  }),
  /** Un habitant marche en ligne droite vers un point; l'étape suivante attend son arrivée. */
  v.strictObject({ do: v.literal('walk'), who: IdSchema, to: IdSchema }),
  /** Une émotion ou une onomatopée, sans attendre. */
  v.strictObject({
    do: v.literal('emote'),
    who: ActorSchema,
    emote: v.nullable(v.picklist(EMOTES)),
    sound: v.nullable(LabelSchema),
  }),
  /** Caméra suggérée: chaque machine peut s'y tourner pendant `seconds` (la caméra reste libre). */
  v.strictObject({ do: v.literal('camera'), focus: FocusSchema, seconds: Seconds }),
  /** Fondu au noir (`black`) ou retour à l'image (`clear`), en `seconds`. */
  v.strictObject({ do: v.literal('fade'), to: v.picklist(['black', 'clear']), seconds: Seconds }),
  v.strictObject({ do: v.literal('wait'), seconds: Seconds }),
  /**
   * Attente d'une action des joueurs. Chaque partie a sa consigne et ses conditions; `role`
   * la confie à un joueur (scène asymétrique), `any`: l'un ou l'autre.
   */
  v.strictObject({
    do: v.literal('await'),
    parts: v.pipe(
      v.array(
        v.strictObject({
          role: v.picklist(['a', 'b', 'any']),
          hint: TextSchema,
          /** Conditions (toutes vraies); vide permis si la partie a un geste. */
          done: v.array(StepConditionSchema),
          /** Geste demandé au joueur du rôle (`a` ou `b`), en plus des conditions. */
          gesture: v.exactOptional(GestureSchema),
        }),
      ),
      v.minLength(1),
      v.maxLength(2),
    ),
    /**
     * Gestes ensemble: les parties à geste doivent être réussies en même temps, à `together`
     * secondes près (un appui compte pendant ce délai; tenir et se tenir comptent tant qu'ils
     * durent). Absent: chaque partie est acquise une fois réussie.
     */
    together: v.exactOptional(Seconds),
  }),
  v.strictObject({ do: v.literal('effects'), effects: v.array(StepEffectSchema) }),
]);
export type BeatDef = v.InferOutput<typeof BeatSchema>;

export const SceneSchema = v.strictObject({
  schema: FileVersionSchema,
  id: IdSchema,
  /** Titre au carnet (scènes à relire). */
  title: LabelSchema,
  /** Il faut les deux joueurs réunis pour qu'elle commence. */
  together: v.boolean(),
  /**
   * Scène à deux asymétrique: le nom de chaque rôle (`a`: le joueur qui la déclenche ou le
   * premier, `b`: l'autre); `null`: les deux voient la même chose.
   */
  roles: v.nullable(v.strictObject({ a: LabelSchema, b: LabelSchema })),
  /**
   * Déclencheur de monde, `null`: seulement par l'effet `play_scene`. `at`: heure (minutes depuis
   * minuit) à partir de laquelle elle part, avec le retard permis des réglages; `repeat`: une
   * seule fois ou chaque jour.
   */
  trigger: v.nullable(
    v.strictObject({
      at: v.nullable(Minutes),
      when: v.array(StepConditionSchema),
      repeat: v.picklist(['once', 'daily']),
    }),
  ),
  beats: v.pipe(v.array(BeatSchema), v.minLength(1), v.maxLength(200)),
});
export type SceneDef = v.InferOutput<typeof SceneSchema>;

/** Une scène en cours (tranche « commun »): de quoi la reprendre telle quelle après une reconnexion. */
export const SceneRunSchema = v.strictObject({
  id: IdSchema,
  place: IdSchema,
  /** Indice du temps en cours dans `beats`. */
  beat: v.pipe(IntSchema, v.minValue(0)),
  /** Pas où ce temps a commencé. */
  since: TickSchema,
  /** Joueur qui tient le rôle `a` (l'autre tient `b`). */
  roleA: PlayerIndexSchema,
  /** Chaque joueur a lu la réplique en cours. */
  read: v.tuple([v.boolean(), v.boolean()]),
  /** Pas où le premier joueur a lu la réplique en cours (le délai d'un lecteur seul part de là). */
  readAt: v.exactOptional(TickSchema),
  /** Parties de l'attente déjà faites. */
  parts: v.tuple([v.boolean(), v.boolean()]),
  camera: v.nullable(v.strictObject({ focus: FocusSchema, until: TickSchema })),
  fade: v.picklist(['black', 'clear']),
  /** Gestes de l'attente en cours, par partie; absent hors d'une attente à geste. */
  gestures: v.exactOptional(v.tuple([GestureRunSchema, GestureRunSchema])),
});
export type SceneRun = v.InferOutput<typeof SceneRunSchema>;

/** Histoire en cours (tranche « commun »): suite suivie par chaque joueur, scène jouée, file. */
export const StoryStateSchema = v.strictObject({
  tracked: v.tuple([v.nullable(IdSchema), v.nullable(IdSchema)]),
  scene: v.nullable(SceneRunSchema),
  queue: v.pipe(v.array(IdSchema), v.maxLength(4)),
  /** Départ demandé par l'effet `travel_to`, pris quand la scène en cours est finie. */
  departure: v.exactOptional(
    v.strictObject({ to: IdSchema, since: TickSchema, ending: v.nullable(IdSchema) }),
  ),
  /** Écran de fin de chapitre montré (`ending` d'un `travel_to` du lieu); `closed`: fermé par chacun. */
  ending: v.exactOptional(
    v.strictObject({ place: IdSchema, id: IdSchema, closed: v.tuple([v.boolean(), v.boolean()]) }),
  ),
});
export type StoryState = v.InferOutput<typeof StoryStateSchema>;
