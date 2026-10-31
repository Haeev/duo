// Ce que la plateforme attend de la liaison avec l'autre ordinateur (ADR 0007,
// module `session` de dev-reseau, paquet `packages/liaison`). La plateforme ne
// dépend que de cette interface; `LocalLiaison` en est une implémentation
// provisoire pour deux instances (sur la même machine, ou à une adresse donnée).
import type { Profile } from '../../shared/state';
import type { HostSession, SalonGame } from './session-machine';

export interface LocalIdentity {
  readonly machineId: string;
  readonly appVersion: string;
  readonly profile: Profile;
}

export interface PeerInfo {
  readonly machineId: string;
  /** Change à chaque lancement de Duo chez l'autre: une reprise est alors impossible. */
  readonly instanceId: string;
  readonly appVersion: string;
  readonly profile: Profile;
}

/**
 * Salons vus par cette machine. `own`: le salon que j'héberge. `peer`: celui de
 * l'autre (invitation, ou salon rejoint), avec les heures converties à mon horloge.
 */
export interface SessionsView {
  readonly own: HostSession;
  readonly peer: HostSession | null;
}

/** Message de jeu relayé sans décodage (ADR 0007, point 2). */
export interface GameRelayMessage {
  readonly channel: number;
  readonly mode: 'reliable' | 'latest';
  readonly data: unknown;
}

export type LiaisonEvent =
  /** Présence: `null` quand l'autre n'est pas visible. */
  | { readonly type: 'peer'; readonly peer: PeerInfo | null }
  /** Perte et retour de la connexion pendant un salon ou une partie. */
  | { readonly type: 'link'; readonly up: boolean }
  /** État des salons et de la partie, à chaque changement. */
  | { readonly type: 'sessions'; readonly sessions: SessionsView }
  /** Message du jeu de l'autre machine. */
  | { readonly type: 'game'; readonly message: GameRelayMessage };

export type StopReason = 'stopped' | 'crash' | 'load-failed' | 'end';

export interface Liaison {
  /** Démarre l'écoute et la recherche de l'autre ordinateur (après l'accord réseau de E03). */
  start(identity: LocalIdentity): Promise<void>;
  /** Prévient l'autre (fermeture propre), puis ferme tout. */
  stop(): Promise<void>;
  setProfile(profile: Profile): void;

  /** Ouvre un salon hébergé ici; l'invitation part aussitôt chez l'autre. */
  openSalon(game: SalonGame): void;
  closeSalon(): void;
  selectSave(choice: SalonGame['saveChoice']): void;
  /** Rejoint le salon de l'autre (vaut « C'est parti »). */
  joinSalon(): void;
  leaveSalon(): void;
  setReady(ready: boolean): void;

  /** Le jeu est prêt sur cette machine. */
  reportLoaded(): void;
  requestPause(): void;
  requestResume(): void;
  stopMatch(reason: StopReason): void;
  /** Relaie un message du jeu vers l'instance de l'autre machine. */
  sendGame(message: GameRelayMessage): void;

  subscribe(listener: (event: LiaisonEvent) => void): () => void;
}
