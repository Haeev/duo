/**
 * `@duo/liaison`: réseau local de Duo pour le processus principal (lot L5).
 * Découverte, liaison WebSocket authentifiée, salon et relais des messages de jeu.
 * Mode d'emploi: `packages/liaison/README.md`.
 */
export { createLiaison } from './liaison.ts';
export type {
  ConnectResult,
  IncompatibleInfo,
  Liaison,
  LiaisonEvents,
  LiaisonIdentity,
  LiaisonLogger,
  LiaisonOptions,
  LiaisonProfile,
  LobbyApi,
  MatchApi,
  PartnerInfo,
  PartnerState,
  StartReport,
} from './liaison.ts';
export type {
  ActionResult,
  LobbyGame,
  LobbyState,
  MatchEndReason,
  MatchPhase,
  MatchState,
  PauseReason,
  Role,
  SendResult,
  SessionNotice,
  SessionView,
} from './session.ts';
export type { ChannelMode, GamePayload, LinkHealth, LinkQuality } from './link.ts';
export type { ManualConnectResult, PairingPolicy } from './link-manager.ts';
export type { Sighting } from './discovery.ts';
export type { InstalledGame } from './protocol.ts';
export type { DialFailure, NetworkDriver } from './transport.ts';
export type { Endpoint, RetainedInterface } from './addresses.ts';
export { parseEndpoint, parseManualAddress, isPrivateIPv4, selectInterfaces } from './addresses.ts';
export { DEFAULT_CONFIG, createConfig } from './config.ts';
export type { NetworkConfig } from './config.ts';
export { createFileStore, createMemoryStore } from './store.ts';
export type { LinkMemory, LinkStore, PairingRecord, RetainedAddress } from './store.ts';
export { createNodeDriver } from './node-driver.ts';
