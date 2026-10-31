// Messages du pont 1.0 entre un jeu et la plateforme, sur un unique MessagePort (ADR 0005, point 3).
// La plateforme valide ce qui vient du jeu, le SDK valide ce qui vient de la plateforme.
import * as v from 'valibot';
import { ActionIdSchema, GameIdSchema, KeyCodeSchema, SAVE_MOMENTS } from './manifest';
import { PlayerColorIdSchema } from './players';

/**
 * Message `window.postMessage` qui remet le port du pont à la page du jeu
 * (`event.ports[0]`). Envoyé par `preload-game` dans Duo, par la page parente dans le faux hôte.
 */
export const BRIDGE_PORT_MESSAGE = 'duo:bridge-port';
/** Demande du port, envoyée par le SDK à la page parente quand le jeu est dans un cadre (faux hôte). */
export const BRIDGE_PORT_REQUEST = 'duo:bridge-request';

/** Nombre de canaux réseau d'une partie, numérotés de 0 à 15 (reseau.md, section 11.2). */
export const NET_CHANNEL_COUNT = 16;
/** Taille maximale d'un message de jeu sérialisé en JSON (reseau.md, section 7.4): 64 Kio. */
export const MAX_NET_MESSAGE_BYTES = 65_536;
/** Période du battement de cœur du SDK (ADR 0004). */
export const HEARTBEAT_INTERVAL_MS = 1000;

const Int = v.pipe(v.number(), v.integer());
const Finite = v.pipe(v.number(), v.finite());
const Fraction = v.pipe(v.number(), v.minValue(0), v.maxValue(1));
const ShortText = (max: number) => v.pipe(v.string(), v.maxLength(max));

export const RoleSchema = v.picklist(['host', 'guest']);
export type Role = v.InferOutput<typeof RoleSchema>;

export const PlayerIdSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(64));

/** Un joueur de la partie. `id` est l'identifiant de membre du duo: stable d'une partie à l'autre. */
export const PlayerInfoSchema = v.strictObject({
  id: PlayerIdSchema,
  role: RoleSchema,
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(64)),
  color: PlayerColorIdSchema,
  colorHex: v.pipe(v.string(), v.hexColor()),
  local: v.boolean(),
});
export type PlayerInfo = v.InferOutput<typeof PlayerInfoSchema>;

export const VolumesSchema = v.strictObject({
  master: Fraction,
  music: Fraction,
  effects: Fraction,
  interface: Fraction,
});
export type Volumes = v.InferOutput<typeof VolumesSchema>;

export const GameSettingsSchema = v.strictObject({
  volumes: VolumesSchema,
  uiScale: v.picklist([1, 1.25, 1.5]),
  reducedMotion: v.boolean(),
  /** Touches réaffectées sur cette machine, par action; une action absente garde les touches du manifeste. */
  bindings: v.record(ActionIdSchema, v.pipe(v.array(KeyCodeSchema), v.maxLength(4))),
});
export type GameSettings = v.InferOutput<typeof GameSettingsSchema>;

export const SaveMomentSchema = v.picklist(SAVE_MOMENTS);

/** Sauvegarde choisie au salon, remise au jeu de l'hôte seulement. */
export const LoadedSaveSchema = v.strictObject({
  slot: v.pipe(Int, v.minValue(1), v.maxValue(10)),
  label: ShortText(40),
  progress: v.exactOptional(Fraction),
  dataSchema: v.pipe(Int, v.minValue(1)),
  gameVersion: v.string(),
  /** JSON en UTF-8. */
  data: v.instance(ArrayBuffer),
});
export type LoadedSave = v.InferOutput<typeof LoadedSaveSchema>;

export const NetChannelIdSchema = v.pipe(Int, v.minValue(0), v.maxValue(NET_CHANNEL_COUNT - 1));
/**
 * Contenu d'un message de jeu: le texte JSON produit par le SDK de l'émetteur. La plateforme le
 * relaie tel quel sans le décoder; le SDK du destinataire le relit et le valide par le schéma du canal.
 */
export const NetPayloadSchema = v.pipe(v.string(), v.maxLength(MAX_NET_MESSAGE_BYTES));

export const LinkStateSchema = v.picklist(['good', 'unstable']);

// Plateforme vers jeu.

export const InitMessageSchema = v.strictObject({
  type: v.literal('init'),
  bridge: v.string(),
  matchId: v.pipe(v.string(), v.minLength(1), v.maxLength(64)),
  role: RoleSchema,
  localPlayerId: PlayerIdSchema,
  /** Hôte d'abord, puis invité. */
  players: v.tuple([PlayerInfoSchema, PlayerInfoSchema]),
  /** Graine partagée, entier non signé sur 32 bits. */
  seed: v.pipe(Int, v.minValue(0), v.maxValue(0xffff_ffff)),
  game: v.strictObject({ id: GameIdSchema, version: v.string() }),
  settings: GameSettingsSchema,
  /** Slot ouvert à l'écriture au salon (hôte), même quand la partie est nouvelle; `null` si le jeu n'a pas de sauvegarde. */
  saveSlot: v.nullable(v.pipe(Int, v.minValue(1), v.maxValue(10))),
  save: v.nullable(LoadedSaveSchema),
  /** Heure de session = `performance.timeOrigin + performance.now()` de la page + cet écart. */
  clockOffsetMs: Finite,
});
export type InitMessage = v.InferOutput<typeof InitMessageSchema>;

export const PauseReasonSchema = v.picklist(['request', 'disconnect', 'system']);
export type PauseReason = v.InferOutput<typeof PauseReasonSchema>;

export const StopReasonSchema = v.picklist([
  'end',
  'stopped',
  'quit',
  'peer-crash',
  'disconnect-stop',
]);
export type StopReason = v.InferOutput<typeof StopReasonSchema>;

export const SaveStatusSchema = v.picklist([
  'ok',
  'too-large',
  'moment-not-declared',
  'write-error',
  'refused',
]);
export type SaveStatus = v.InferOutput<typeof SaveStatusSchema>;

export const PlatformMessageSchema = v.variant('type', [
  InitMessageSchema,
  v.strictObject({ type: v.literal('start'), atSessionMs: Finite }),
  v.strictObject({
    type: v.literal('pause'),
    reason: PauseReasonSchema,
    by: v.nullable(PlayerIdSchema),
  }),
  v.strictObject({ type: v.literal('resume') }),
  v.strictObject({ type: v.literal('settings'), settings: GameSettingsSchema }),
  v.strictObject({ type: v.literal('saveRequest'), moment: v.picklist(['auto', 'exit']) }),
  v.strictObject({ type: v.literal('saveResult'), requestId: Int, status: SaveStatusSchema }),
  v.strictObject({ type: v.literal('stop'), reason: StopReasonSchema, save: v.boolean() }),
  v.strictObject({ type: v.literal('net'), channel: NetChannelIdSchema, data: NetPayloadSchema }),
  v.strictObject({
    type: v.literal('link'),
    rttMs: Finite,
    jitterMs: Finite,
    state: LinkStateSchema,
    clockOffsetMs: Finite,
  }),
]);
export type PlatformMessage = v.InferOutput<typeof PlatformMessageSchema>;

// Jeu vers plateforme.

export const MatchOutcomeSchema = v.variant('kind', [
  v.strictObject({ kind: v.literal('win'), winner: PlayerIdSchema }),
  v.strictObject({ kind: v.literal('draw') }),
  v.strictObject({ kind: v.literal('success') }),
  v.strictObject({ kind: v.literal('failure') }),
]);
export type MatchOutcome = v.InferOutput<typeof MatchOutcomeSchema>;

export const ResultStatSchema = v.strictObject({ label: ShortText(32), value: ShortText(16) });
export type ResultStat = v.InferOutput<typeof ResultStatSchema>;

const StatsSchema = v.pipe(v.array(ResultStatSchema), v.maxLength(3));

export const GameMessageSchema = v.variant('type', [
  v.strictObject({ type: v.literal('hello'), bridge: v.string(), sdk: v.string() }),
  v.strictObject({ type: v.literal('loading'), progress: Fraction }),
  v.strictObject({ type: v.literal('ready') }),
  v.strictObject({ type: v.literal('heartbeat') }),
  v.strictObject({ type: v.literal('perf'), fps: Finite, frameMs: Finite, stepHz: Finite }),
  /** Échap pressée dans le jeu: n'arrive jamais dans Duo (Échap est interceptée), sert au faux hôte. */
  v.strictObject({ type: v.literal('pauseRequest') }),
  v.strictObject({
    type: v.literal('saveWrite'),
    requestId: Int,
    moment: SaveMomentSchema,
    label: v.pipe(v.string(), v.minLength(1), v.maxLength(40)),
    progress: v.exactOptional(Fraction),
    dataSchema: v.pipe(Int, v.minValue(1)),
    data: v.instance(ArrayBuffer),
  }),
  v.strictObject({
    type: v.literal('matchEnd'),
    outcome: MatchOutcomeSchema,
    scores: v.record(PlayerIdSchema, Finite),
    stats: StatsSchema,
    progress: v.exactOptional(Fraction),
    replayLabel: v.exactOptional(ShortText(24)),
  }),
  v.strictObject({
    type: v.literal('sessionEnd'),
    progress: v.exactOptional(Fraction),
    stats: StatsSchema,
    /** `true` quand la séance s'achève à l'initiative du jeu (fin de la démo), sans `stop` préalable. */
    finished: v.boolean(),
  }),
  v.strictObject({
    type: v.literal('net'),
    channel: NetChannelIdSchema,
    mode: v.picklist(['reliable', 'latest']),
    data: NetPayloadSchema,
  }),
  v.strictObject({
    type: v.literal('fatal'),
    message: ShortText(2000),
    stack: v.exactOptional(ShortText(8000)),
  }),
  v.strictObject({
    type: v.literal('log'),
    level: v.picklist(['info', 'warn', 'error']),
    message: ShortText(2000),
    data: v.exactOptional(v.unknown()),
  }),
]);
export type GameMessage = v.InferOutput<typeof GameMessageSchema>;

/** Valide un message reçu de la plateforme; `null` s'il n'est pas conforme. */
export function parsePlatformMessage(input: unknown): PlatformMessage | null {
  const result = v.safeParse(PlatformMessageSchema, input);
  return result.success ? result.output : null;
}

/** Valide un message reçu d'un jeu; `null` s'il n'est pas conforme. */
export function parseGameMessage(input: unknown): GameMessage | null {
  const result = v.safeParse(GameMessageSchema, input);
  return result.success ? result.output : null;
}
