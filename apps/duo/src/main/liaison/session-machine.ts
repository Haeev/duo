// Salon et partie, vus par la machine qui héberge (ADR 0007, point 4): machine à
// états pure. L'invité envoie des intentions, l'hôte répond par l'état complet
// numéroté. Les heures sont celles de l'horloge de l'hôte (millisecondes).

export type Seat = 'host' | 'guest';

export interface SalonGame {
  readonly id: string;
  readonly version: string;
  readonly saveChoice: 'continue' | 'new';
  /** Sauvegarde que l'hôte reprendrait (« Continuer »), pour l'affichage chez l'invité. */
  readonly save: { readonly label: string; readonly writtenAt: number } | null;
}

export interface SalonState {
  readonly game: SalonGame;
  readonly guestJoined: boolean;
  readonly ready: { readonly host: boolean; readonly guest: boolean };
  readonly countdownEndsAt: number | null;
}

export type MatchPhase = 'loading' | 'playing' | 'paused' | 'resuming';

export interface MatchState {
  readonly matchId: string;
  readonly seed: number;
  readonly game: SalonGame;
  readonly phase: MatchPhase;
  readonly loaded: { readonly host: boolean; readonly guest: boolean };
  readonly pausedBy: { readonly host: boolean; readonly guest: boolean };
  readonly resumeReady: { readonly host: boolean; readonly guest: boolean };
  readonly resumeEndsAt: number | null;
  readonly linkLost: boolean;
  /** Temps joué hors pauses, jusqu'à `playingSince`. */
  readonly playedMs: number;
  readonly playingSince: number | null;
}

export type EndReason = 'stopped' | 'crash' | 'load-failed' | 'end' | 'guest-gone';

/** Résumé fourni par le jeu de l'hôte à la fin (ADR 0005: `matchEnd`, `sessionEnd`). */
export interface EndSummary {
  readonly outcome: 'success' | 'failure' | 'draw' | 'win-host' | 'win-guest' | null;
  /** Jusqu'à trois statistiques, textes du jeu. */
  readonly stats: readonly { readonly label: string; readonly value: string }[];
  /**
   * Avancement déclaré par le jeu, de 0 à 1 (Duo 0.4). Facultatif sur la liaison: une
   * application plus ancienne ne l'envoie pas et l'ignore à la réception.
   */
  readonly progress?: number | undefined;
}

export interface MatchEnd {
  readonly matchId: string;
  readonly game: SalonGame;
  readonly reason: EndReason;
  readonly by: Seat | null;
  readonly durationMs: number;
  readonly summary: EndSummary | null;
}

export interface HostSession {
  readonly rev: number;
  readonly salon: SalonState | null;
  readonly match: MatchState | null;
  readonly lastEnd: MatchEnd | null;
}

export type SessionInput =
  | { readonly type: 'open'; readonly game: SalonGame }
  | { readonly type: 'close' }
  | {
      readonly type: 'select-save';
      readonly saveChoice: SalonGame['saveChoice'];
      readonly save: SalonGame['save'];
    }
  | { readonly type: 'join' }
  | { readonly type: 'leave' }
  | { readonly type: 'ready'; readonly seat: Seat; readonly ready: boolean }
  | { readonly type: 'loaded'; readonly seat: Seat }
  | { readonly type: 'pause'; readonly seat: Seat }
  | { readonly type: 'resume'; readonly seat: Seat }
  | {
      readonly type: 'stop';
      readonly seat: Seat;
      readonly reason: Exclude<EndReason, 'guest-gone'>;
      readonly summary?: EndSummary | undefined;
    }
  | { readonly type: 'summary'; readonly matchId: string; readonly summary: EndSummary }
  | { readonly type: 'link'; readonly up: boolean }
  | { readonly type: 'guest-gone' }
  | { readonly type: 'tick' };

export const COUNTDOWN_MS = 3000;

export interface SessionTools {
  readonly newMatchId: () => string;
  readonly newSeed: () => number;
}

export const EMPTY_SESSION: HostSession = { rev: 0, salon: null, match: null, lastEnd: null };

const BOTH_FALSE = { host: false, guest: false } as const;

function playedUntil(match: MatchState, now: number): number {
  return match.playedMs + (match.playingSince === null ? 0 : Math.max(0, now - match.playingSince));
}

function freeze(match: MatchState, now: number): MatchState {
  return { ...match, playedMs: playedUntil(match, now), playingSince: null };
}

function withSalonReady(salon: SalonState, ready: SalonState['ready'], now: number): SalonState {
  const bothReady = salon.guestJoined && ready.host && ready.guest;
  return {
    ...salon,
    ready,
    countdownEndsAt: bothReady ? (salon.countdownEndsAt ?? now + COUNTDOWN_MS) : null,
  };
}

function endMatch(
  state: HostSession,
  match: MatchState,
  reason: EndReason,
  by: Seat | null,
  now: number,
  summary: EndSummary | null = null,
): HostSession {
  return {
    ...state,
    match: null,
    lastEnd: {
      matchId: match.matchId,
      game: match.game,
      reason,
      by,
      durationMs: playedUntil(match, now),
      summary,
    },
  };
}

/** Applique une entrée; renvoie le même objet si rien ne change. */
function apply(
  state: HostSession,
  input: SessionInput,
  now: number,
  tools: SessionTools,
): HostSession {
  const { salon, match } = state;
  switch (input.type) {
    case 'open':
      if (match !== null) return state;
      return {
        ...state,
        lastEnd: null,
        salon: { game: input.game, guestJoined: false, ready: BOTH_FALSE, countdownEndsAt: null },
      };
    case 'close':
      if (salon === null) return state;
      return match === null
        ? { ...state, salon: null }
        : { ...endMatch(state, match, 'stopped', 'host', now), salon: null };
    case 'select-save':
      if (
        salon === null ||
        match !== null ||
        (salon.game.saveChoice === input.saveChoice &&
          salon.game.save?.label === input.save?.label &&
          salon.game.save?.writtenAt === input.save?.writtenAt)
      ) {
        return state;
      }
      // Un nouveau choix remet les deux joueurs à « Pas encore » (UX 2.2).
      return {
        ...state,
        salon: {
          ...salon,
          game: { ...salon.game, saveChoice: input.saveChoice, save: input.save },
          ready: BOTH_FALSE,
          countdownEndsAt: null,
        },
      };
    case 'join':
      if (salon === null || salon.guestJoined) return state;
      // Rejoindre vaut « C'est parti » (UX 2).
      return {
        ...state,
        lastEnd: null,
        salon: withSalonReady(
          { ...salon, guestJoined: true },
          { host: salon.ready.host, guest: true },
          now,
        ),
      };
    case 'leave':
      if (!salon?.guestJoined) return state;
      if (match !== null) {
        return {
          ...endMatch(state, match, 'stopped', 'guest', now),
          salon: { ...salon, guestJoined: false, ready: BOTH_FALSE, countdownEndsAt: null },
        };
      }
      return {
        ...state,
        salon: { ...salon, guestJoined: false, ready: BOTH_FALSE, countdownEndsAt: null },
      };
    case 'ready': {
      if (salon === null || match !== null) return state;
      if (input.seat === 'guest' && !salon.guestJoined) return state;
      if (salon.ready[input.seat] === input.ready) return state;
      return {
        ...state,
        salon: withSalonReady(salon, { ...salon.ready, [input.seat]: input.ready }, now),
      };
    }
    case 'loaded': {
      if (match?.phase !== 'loading' || match.loaded[input.seat]) return state;
      const loaded = { ...match.loaded, [input.seat]: true };
      const allLoaded = loaded.host && loaded.guest;
      return {
        ...state,
        match: {
          ...match,
          loaded,
          phase: allLoaded ? 'playing' : 'loading',
          playingSince: allLoaded ? now : null,
        },
      };
    }
    case 'pause': {
      if (match === null || match.phase === 'loading') return state;
      if (match.phase === 'paused' && match.pausedBy[input.seat]) return state;
      return {
        ...state,
        match: {
          ...freeze(match, now),
          phase: 'paused',
          pausedBy: {
            ...(match.phase === 'playing' ? BOTH_FALSE : match.pausedBy),
            [input.seat]: true,
          },
          resumeReady: { ...match.resumeReady, [input.seat]: false },
          resumeEndsAt: null,
        },
      };
    }
    case 'resume': {
      if (match?.phase !== 'paused' || match.linkLost || match.resumeReady[input.seat])
        return state;
      const resumeReady = { ...match.resumeReady, [input.seat]: true };
      const both = resumeReady.host && resumeReady.guest;
      return {
        ...state,
        match: {
          ...match,
          resumeReady,
          phase: both ? 'resuming' : 'paused',
          resumeEndsAt: both ? now + COUNTDOWN_MS : null,
        },
      };
    }
    case 'summary':
      // Résumé arrivé après l'arrêt (séance arrêtée par la plateforme): il complète la fin sans
      // en remplacer un déjà donné par le jeu (fin de partie ou fin de démo).
      if (state.lastEnd?.matchId !== input.matchId || state.lastEnd.summary !== null) return state;
      return { ...state, lastEnd: { ...state.lastEnd, summary: input.summary } };
    case 'stop':
      if (match === null) return state;
      return {
        ...endMatch(state, match, input.reason, input.seat, now, input.summary ?? null),
        salon: salon === null ? null : { ...salon, ready: BOTH_FALSE, countdownEndsAt: null },
      };
    case 'link':
      if (input.up) {
        return match?.linkLost === true
          ? { ...state, match: { ...match, linkLost: false } }
          : state;
      }
      if (match !== null) {
        if (match.phase === 'loading') {
          return {
            ...endMatch(state, match, 'load-failed', null, now),
            salon: salon === null ? null : { ...salon, ready: BOTH_FALSE, countdownEndsAt: null },
          };
        }
        return {
          ...state,
          match: {
            ...freeze(match, now),
            phase: 'paused',
            linkLost: true,
            resumeReady: BOTH_FALSE,
            resumeEndsAt: null,
          },
        };
      }
      if (salon?.guestJoined === true) {
        return { ...state, salon: { ...salon, ready: BOTH_FALSE, countdownEndsAt: null } };
      }
      return state;
    case 'guest-gone': {
      const left =
        salon === null
          ? null
          : { ...salon, guestJoined: false, ready: BOTH_FALSE, countdownEndsAt: null };
      if (match !== null)
        return { ...endMatch(state, match, 'guest-gone', 'guest', now), salon: left };
      return left === salon ? state : { ...state, salon: left };
    }
    case 'tick':
      if (match?.phase === 'resuming' && match.resumeEndsAt !== null && now >= match.resumeEndsAt) {
        return {
          ...state,
          match: {
            ...match,
            phase: 'playing',
            pausedBy: BOTH_FALSE,
            resumeReady: BOTH_FALSE,
            resumeEndsAt: null,
            playingSince: now,
          },
        };
      }
      if (
        match === null &&
        salon !== null &&
        salon.countdownEndsAt !== null &&
        now >= salon.countdownEndsAt
      ) {
        return {
          ...state,
          lastEnd: null,
          salon: { ...salon, ready: BOTH_FALSE, countdownEndsAt: null },
          match: {
            matchId: tools.newMatchId(),
            seed: tools.newSeed(),
            game: salon.game,
            phase: 'loading',
            loaded: BOTH_FALSE,
            pausedBy: BOTH_FALSE,
            resumeReady: BOTH_FALSE,
            resumeEndsAt: null,
            linkLost: false,
            playedMs: 0,
            playingSince: null,
          },
        };
      }
      return state;
  }
}

export function reduceSession(
  state: HostSession,
  input: SessionInput,
  now: number,
  tools: SessionTools,
): HostSession {
  const next = apply(state, input, now, tools);
  return next === state ? state : { ...next, rev: state.rev + 1 };
}

/** Prochaine échéance à surveiller (décompte du salon ou de la reprise), ou `null`. */
export function nextDeadline(state: HostSession): number | null {
  if (state.match?.phase === 'resuming') return state.match.resumeEndsAt;
  if (state.match === null && state.salon !== null) return state.salon.countdownEndsAt;
  return null;
}

/** Transpose les heures de l'hôte en durées restantes, pour l'envoi à l'autre machine. */
export function toWire(state: HostSession, now: number): HostSession {
  const shift = (at: number | null): number | null => (at === null ? null : at - now);
  return {
    ...state,
    salon:
      state.salon === null
        ? null
        : { ...state.salon, countdownEndsAt: shift(state.salon.countdownEndsAt) },
    match:
      state.match === null
        ? null
        : {
            ...state.match,
            resumeEndsAt: shift(state.match.resumeEndsAt),
            playingSince: shift(state.match.playingSince),
          },
  };
}

/** Inverse de `toWire`, avec l'horloge de la machine qui reçoit. */
export function fromWire(state: HostSession, now: number): HostSession {
  const shift = (remaining: number | null): number | null =>
    remaining === null ? null : now + remaining;
  return {
    ...state,
    salon:
      state.salon === null
        ? null
        : { ...state.salon, countdownEndsAt: shift(state.salon.countdownEndsAt) },
    match:
      state.match === null
        ? null
        : {
            ...state.match,
            resumeEndsAt: shift(state.match.resumeEndsAt),
            playingSince: shift(state.match.playingSince),
          },
  };
}
