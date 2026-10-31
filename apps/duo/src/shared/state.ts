// État publié par le processus principal à la vue plateforme (ADR 0012, point 1):
// l'interface en est une projection et n'envoie que des intentions.
// Les heures (`...At`) sont en millisecondes de l'horloge `Date.now()` de cette
// machine: principal et vue la partagent.
import type { PlayerColor } from './players';

export interface Profile {
  readonly pseudo: string;
  readonly color: PlayerColor;
}

export type GameMode = 'coop' | 'versus';
export type GamePlay = 'match' | 'session';

export interface GameAction {
  readonly id: string;
  readonly label: string;
  /** Touches par position physique (`KeyboardEvent.code`). */
  readonly keys: readonly string[];
  readonly mouse: 'left' | 'right' | 'middle' | null;
}

export interface SaveSummary {
  /** Libellé donné par le jeu: « Jour 3 ». */
  readonly label: string;
  readonly writtenAt: number;
}

export interface GameSummary {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly mode: GameMode;
  readonly play: GamePlay;
  readonly durationMinutes: readonly [number, number];
  readonly description: string;
  /** Adresse `duo-game://` de la vignette. */
  readonly thumbnailUrl: string;
  readonly actions: readonly GameAction[];
  /** `null`: le jeu ne garde pas de sauvegarde. */
  readonly saves: { readonly help: string | null; readonly onExit: boolean } | null;
  /** Sauvegarde gardée sur cet ordinateur (prototype: un emplacement, non répliqué). */
  readonly lastSave: SaveSummary | null;
}

export type PeerView =
  | { readonly status: 'unknown' }
  | { readonly status: 'absent'; readonly profile: Profile }
  | { readonly status: 'present'; readonly profile: Profile };

export type SaveChoice = 'continue' | 'new';

export type PeerSeatState = 'waiting' | 'joined' | 'lost';

export interface SalonView {
  readonly role: 'host' | 'guest';
  readonly game: GameSummary;
  readonly saveChoice: SaveChoice;
  /** Sauvegarde reprise, vue de l'hôte (l'invité la voit aussi). */
  readonly save: SaveSummary | null;
  readonly selfReady: boolean;
  readonly peerReady: boolean;
  readonly peerSeat: PeerSeatState;
  readonly countdownEndsAt: number | null;
}

export interface InvitationView {
  readonly from: Profile;
  readonly game: GameSummary;
  readonly save: SaveSummary | null;
}

export type MatchPhase = 'loading' | 'playing' | 'paused' | 'resuming' | 'link-lost';

export interface MatchView {
  readonly role: 'host' | 'guest';
  readonly game: GameSummary;
  readonly phase: MatchPhase;
  readonly selfLoading: number;
  readonly peerLoading: number | null;
  readonly loadingSince: number;
  readonly pausedBy: { readonly self: boolean; readonly peer: boolean };
  readonly resumeReady: { readonly self: boolean; readonly peer: boolean };
  readonly resumeEndsAt: number | null;
  readonly linkLostSince: number | null;
  /** Retour de l'autre après une coupure: la pause devient ordinaire. */
  readonly peerBack: boolean;
  /** Indice « Échap : pause » au début de la partie. */
  readonly hintUntil: number | null;
}

export interface EndView {
  readonly game: GameSummary;
  readonly kind: 'session' | 'match';
  readonly durationMs: number;
  readonly saved: boolean;
}

export type NoticeView =
  | {
      readonly kind: 'game-crashed';
      readonly gameName: string;
      readonly where: 'self' | 'peer';
      readonly hadSave: boolean;
    }
  | { readonly kind: 'load-failed'; readonly gameName: string; readonly where: 'self' | 'peer' };

/** Notification: le texte est choisi par l'interface (fichier de textes unique, ADR 0012). */
export type ToastKind =
  | 'joined'
  | 'left-salon'
  | 'closed-salon'
  | 'asked-wait'
  | 'other-save'
  | 'back'
  | 'stopped-match'
  | 'quit-duo';

export interface Toast {
  readonly id: number;
  readonly kind: ToastKind;
  /** Pseudo de l'autre joueur. */
  readonly name: string;
}

export interface Settings {
  /** `null`: suivre le réglage du système (`prefers-reduced-motion`). */
  readonly reducedMotion: boolean | null;
  readonly uiScale: 1 | 1.25 | 1.5;
}

export interface AppState {
  readonly appVersion: string;
  readonly platform: 'darwin' | 'win32' | 'linux';
  readonly profile: Profile | null;
  readonly setup: { readonly networkAccepted: boolean; readonly done: boolean };
  readonly settings: Settings;
  readonly peer: PeerView;
  readonly games: readonly GameSummary[];
  readonly salon: SalonView | null;
  readonly invitation: InvitationView | null;
  readonly match: MatchView | null;
  readonly end: EndView | null;
  readonly notice: NoticeView | null;
  readonly toasts: readonly Toast[];
  readonly quitConfirm: boolean;
}
