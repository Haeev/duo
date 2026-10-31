// Pont entre la plateforme et un jeu (ADR 0005, point 3, et ses « Précisions de
// l'implémentation »), côté plateforme. Les messages sont ceux de @duo/protocol
// (copie provisoire dans `src/main/protocol/`, remplacée par la dépendance à la
// fusion). Le principal valide tout ce qui vient du jeu.
import {
  BRIDGE_PORT_MESSAGE,
  BRIDGE_VERSION,
  parseBridgeVersion,
  parseGameMessage,
  type GameMessage,
  type PlatformMessage,
} from '@duo/protocol';

export type {
  GameMessage,
  GameSettings,
  InitMessage,
  LoadedSave,
  MatchOutcome,
  PlatformMessage,
  PlayerInfo,
  ResultStat,
  Role,
  SaveMoment,
  SaveStatus,
  StopReason,
} from '@duo/protocol';

export { BRIDGE_PORT_MESSAGE, BRIDGE_VERSION };

export interface BridgeCodec {
  /** Version du pont annoncée (`majeure.mineure`). */
  readonly version: string;
  encode(message: PlatformMessage): unknown;
  /** `null`: message non conforme, jeté et journalisé par l'appelant. */
  decode(data: unknown): GameMessage | null;
  /** Vrai si le pont annoncé par le jeu dans `hello` est compatible (même majeure). */
  accepts(gameBridge: string): boolean;
}

export const bridgeCodec: BridgeCodec = {
  version: BRIDGE_VERSION,
  encode: (message) => message,
  decode: (data) => parseGameMessage(data),
  accepts(gameBridge) {
    const game = parseBridgeVersion(gameBridge);
    const platform = parseBridgeVersion(BRIDGE_VERSION);
    return game !== null && platform !== null && game.major === platform.major;
  },
};
