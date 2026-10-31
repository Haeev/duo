// Pont entre la plateforme et un jeu (ADR 0005, points 3 et 6), côté plateforme.
// Le principal ne manipule que les types internes ci-dessous; `BridgeCodec`
// traduit vers le format du fil. L'implémentation `bridgeCodecV1` suit l'ADR
// 0005 en attendant les schémas de @duo/protocol: à la fusion, seul ce fichier
// change (noms des champs, enveloppe), pas l'hébergement des jeux.
import * as v from 'valibot';
import type { PlayerColor } from '../../shared/players';

export type Role = 'host' | 'guest';

export interface BridgePlayer {
  readonly memberId: string;
  readonly pseudo: string;
  readonly color: PlayerColor;
  readonly local: boolean;
}

export interface BridgeSettings {
  readonly volumes: { readonly master: number; readonly music: number; readonly effects: number; readonly ui: number };
  readonly uiScale: 1 | 1.25 | 1.5;
  readonly reducedMotion: boolean;
  /** Liaisons des actions: identifiant d'action vers codes de touches. */
  readonly keys: Readonly<Record<string, readonly string[]>>;
}

export interface BridgeSave {
  readonly label: string;
  readonly dataSchema: number;
  readonly data: ArrayBuffer;
}

/** Messages de la plateforme vers le jeu. */
export type PlatformToGame =
  | {
      readonly type: 'init';
      readonly role: Role;
      readonly players: readonly BridgePlayer[];
      readonly seed: number;
      readonly gameVersion: string;
      readonly settings: BridgeSettings;
      readonly save: BridgeSave | null;
    }
  | { readonly type: 'start' }
  | { readonly type: 'pause'; readonly reason: 'player' | 'disconnect' }
  | { readonly type: 'resume' }
  | { readonly type: 'settings'; readonly settings: BridgeSettings }
  | { readonly type: 'saveRequest'; readonly reason: 'auto' | 'exit' | 'pause' }
  | {
      readonly type: 'saveResult';
      readonly ok: boolean;
      readonly error: 'too-large' | 'moment' | 'write' | null;
    }
  | {
      readonly type: 'stop';
      readonly reason: 'end' | 'stopped' | 'quit' | 'peer-crash' | 'disconnect-stop';
      readonly save: boolean;
    }
  | { readonly type: 'net'; readonly channel: number; readonly data: unknown };

export type SaveMoment = 'level-end' | 'exit' | 'auto' | 'manual';

/** Messages du jeu vers la plateforme, validés à l'arrivée. */
export type GameToPlatform =
  | { readonly type: 'loading'; readonly progress: number }
  | { readonly type: 'ready' }
  | { readonly type: 'heartbeat' }
  | { readonly type: 'perf'; readonly fps: number; readonly simHz: number }
  | {
      readonly type: 'saveWrite';
      readonly moment: SaveMoment;
      readonly label: string;
      readonly dataSchema: number;
      readonly data: Uint8Array;
    }
  | { readonly type: 'matchEnd'; readonly result: unknown }
  | { readonly type: 'sessionEnd'; readonly progress: unknown }
  | { readonly type: 'fatal'; readonly message: string }
  | { readonly type: 'log'; readonly level: 'debug' | 'info' | 'warn' | 'error'; readonly message: string }
  | {
      readonly type: 'net';
      readonly channel: number;
      readonly mode: 'reliable' | 'latest';
      readonly data: unknown;
    };

export interface BridgeCodec {
  /** Version du pont annoncée (`majeure.mineure`). */
  readonly version: string;
  encode(message: PlatformToGame): unknown;
  /** `null`: message invalide, jeté et journalisé par l'appelant. */
  decode(data: unknown): GameToPlatform | null;
}

const ProgressSchema = v.pipe(v.number(), v.minValue(0), v.maxValue(1));
const ChannelSchema = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(15));

const GameMessageSchema = v.variant('type', [
  v.object({ type: v.literal('loading'), progress: ProgressSchema }),
  v.object({ type: v.literal('ready') }),
  v.object({ type: v.literal('heartbeat') }),
  v.object({
    type: v.literal('perf'),
    fps: v.pipe(v.number(), v.minValue(0)),
    simHz: v.pipe(v.number(), v.minValue(0)),
  }),
  v.object({
    type: v.literal('saveWrite'),
    moment: v.picklist(['level-end', 'exit', 'auto', 'manual']),
    label: v.pipe(v.string(), v.maxLength(80)),
    dataSchema: v.pipe(v.number(), v.integer(), v.minValue(0)),
    data: v.union([v.instance(ArrayBuffer), v.instance(Uint8Array)]),
  }),
  v.object({ type: v.literal('matchEnd'), result: v.unknown() }),
  v.object({ type: v.literal('sessionEnd'), progress: v.optional(v.unknown()) }),
  v.object({ type: v.literal('fatal'), message: v.pipe(v.string(), v.maxLength(4000)) }),
  v.object({
    type: v.literal('log'),
    level: v.picklist(['debug', 'info', 'warn', 'error']),
    message: v.pipe(v.string(), v.maxLength(4000)),
  }),
  v.object({
    type: v.literal('net'),
    channel: ChannelSchema,
    mode: v.optional(v.picklist(['reliable', 'latest']), 'reliable'),
    data: v.unknown(),
  }),
]);

export const bridgeCodecV1: BridgeCodec = {
  version: '1.0',
  encode(message) {
    if (message.type === 'init') {
      return { ...message, bridge: '1.0' };
    }
    return message;
  },
  decode(data) {
    const parsed = v.safeParse(GameMessageSchema, data);
    if (!parsed.success) return null;
    const message = parsed.output;
    switch (message.type) {
      case 'saveWrite':
        return {
          ...message,
          data: message.data instanceof Uint8Array ? message.data : new Uint8Array(message.data),
        };
      case 'sessionEnd':
        return { type: 'sessionEnd', progress: message.progress ?? null };
      case 'loading':
      case 'ready':
      case 'heartbeat':
      case 'perf':
      case 'matchEnd':
      case 'fatal':
      case 'log':
      case 'net':
        return message;
    }
  },
};
