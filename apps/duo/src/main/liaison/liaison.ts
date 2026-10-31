// Ce que la plateforme attend de la liaison avec l'autre ordinateur (ADR 0007,
// module `session` de dev-reseau, paquet `packages/liaison`). La plateforme ne
// dépend que de cette interface; `LocalLiaison` en est une implémentation
// provisoire pour deux instances (sur la même machine, ou à une adresse donnée).
import type { Profile } from '../../shared/state';
import type { EndSummary, HostSession, SalonGame } from './session-machine';

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

/** Message de jeu relayé sans décodage (ADR 0007, point 2): texte JSON du SDK. */
export interface GameRelayMessage {
  readonly channel: number;
  readonly mode: 'reliable' | 'latest';
  readonly data: string;
}

/** Qualité du lien, telle que le jeu la reçoit (message `link` du pont, ADR 0005). */
export interface LinkQualityView {
  readonly rttMs: number;
  readonly jitterMs: number;
  readonly state: 'good' | 'unstable';
  /** Heure de session = `performance.timeOrigin + performance.now()` locale + cet écart. */
  readonly clockOffsetMs: number;
}

export type LiaisonEvent =
  /** Présence: `null` quand l'autre n'est pas visible. */
  | { readonly type: 'peer'; readonly peer: PeerInfo | null }
  /** Perte et retour de la connexion pendant un salon ou une partie. */
  | { readonly type: 'link'; readonly up: boolean }
  /** État des salons et de la partie, à chaque changement. */
  | { readonly type: 'sessions'; readonly sessions: SessionsView }
  /** Message du jeu de l'autre machine. */
  | { readonly type: 'game'; readonly message: GameRelayMessage }
  /** Mesure du lien, chaque seconde tant que l'autre est là, et à chaque perte ou retour. */
  | { readonly type: 'quality'; readonly quality: LinkQualityView };

export type StopReason = 'stopped' | 'crash' | 'load-failed' | 'end';

export interface Liaison {
  /**
   * Écart à ajouter à `performance.timeOrigin + performance.now()` de cette machine pour
   * obtenir l'heure de session: l'horloge de l'hôte du salon ou de la partie en cours
   * (0 chez l'hôte, l'écart d'horloge mesuré par la liaison chez l'invité).
   */
  sessionOffsetMs(): number;
  /** Démarre l'écoute et la recherche de l'autre ordinateur (après l'accord réseau de E03). */
  start(identity: LocalIdentity): Promise<void>;
  /** Prévient l'autre (fermeture propre), puis ferme tout. */
  stop(): Promise<void>;
  setProfile(profile: Profile): void;

  /** Ouvre un salon hébergé ici; l'invitation part aussitôt chez l'autre. */
  openSalon(game: SalonGame): void;
  closeSalon(): void;
  /** Choix de la sauvegarde au salon, avec le résumé de celle que l'hôte reprendrait. */
  selectSave(choice: SalonGame['saveChoice'], save: SalonGame['save']): void;
  /** Rejoint le salon de l'autre (vaut « C'est parti »). */
  joinSalon(): void;
  leaveSalon(): void;
  setReady(ready: boolean): void;

  /** Le jeu est prêt sur cette machine. */
  reportLoaded(): void;
  requestPause(): void;
  requestResume(): void;
  /** Arrête la partie; `summary`: résumé du jeu de l'hôte (fin de partie ou de séance). */
  stopMatch(reason: StopReason, summary?: EndSummary): void;
  /** Relaie un message du jeu vers l'instance de l'autre machine. */
  sendGame(message: GameRelayMessage): void;

  subscribe(listener: (event: LiaisonEvent) => void): () => void;
}
