import * as v from 'valibot';
import type { CancelTimer, Clock } from './clock.ts';
import type { NetworkConfig } from './config.ts';
import { Emitter } from './emitter.ts';
import type { Link, ChannelMode, GamePayload, ReliableMessage } from './link.ts';
import type { LinkManager } from './link-manager.ts';
import { TokenBucket } from './rate.ts';
import { randomId } from './random.ts';
import type { RandomSource } from './random.ts';

/**
 * Salon et partie (reseau.md, sections 9 et 10; ADR 0007, point 4). L'état vit chez
 * l'hôte, qui l'envoie complet et numéroté (`salon.state`) à chaque changement;
 * l'invité n'envoie que des intentions. Les heures sont celles de l'horloge de
 * l'hôte (heure de session), converties localement par l'écart d'horloge.
 */

export type Role = 'host' | 'guest';

export type MatchPhase = 'loading' | 'starting' | 'playing' | 'paused' | 'resuming';

export type PauseReason = 'player' | 'connection';

export interface LobbyGame {
  readonly id: string;
  readonly version: string;
  /** Sauvegarde choisie par l'hôte, ou `null` pour une nouvelle partie. */
  readonly save: string | null;
}

export interface MatchState {
  readonly id: string;
  readonly seed: number;
  readonly phase: MatchPhase;
  readonly loaded: { readonly host: boolean; readonly guest: boolean };
  /** Heure de session du départ, fixée quand les deux ont chargé. */
  readonly startsAt: number | null;
  readonly started: boolean;
  readonly pause: { readonly reason: PauseReason; readonly by: readonly Role[] } | null;
  readonly resumeReady: { readonly host: boolean; readonly guest: boolean };
  readonly resumeAt: number | null;
}

export interface LobbyState {
  readonly id: string;
  readonly rev: number;
  /** Machine de l'hôte: celle qui a ouvert le salon. */
  readonly host: string;
  readonly game: LobbyGame;
  readonly phase: 'open' | 'countdown' | 'match';
  readonly guestJoined: boolean;
  readonly ready: { readonly host: boolean; readonly guest: boolean };
  readonly countdownEndsAt: number | null;
  readonly match: MatchState | null;
  readonly lastResult: { readonly match: string; readonly result: unknown; readonly reason: MatchEndReason } | null;
}

export type MatchEndReason = 'finished' | 'stopped' | 'peer-left' | 'peer-restarted' | 'crashed';

/** Ce que voit la plateforme, sur chaque machine. */
export interface SessionView {
  readonly role: Role | null;
  /** Le salon où l'on est: le sien si l'on est hôte, celui de l'autre si l'on a rejoint. */
  readonly lobby: LobbyState | null;
  /** Le salon de l'autre, si l'on n'y est pas (invitation). */
  readonly invitation: LobbyState | null;
  readonly joining: boolean;
  readonly connection: 'ok' | 'unstable' | 'lost' | 'absent';
  /** Heures converties sur l'horloge locale (celle de `clock.now()`). */
  readonly localTimes: {
    readonly countdownEndsAt: number | null;
    readonly startsAt: number | null;
    readonly resumeAt: number | null;
  };
  /** La partie est en pause de notre côté à cause de la coupure, avant tout message de l'hôte. */
  readonly pausedByConnection: boolean;
}

export type SessionNotice =
  | { readonly kind: 'lobby-closed'; readonly by: 'peer' }
  | { readonly kind: 'peer-left'; readonly reason: 'bye' | 'refused' | 'overflow' | 'reset' | 'stopped' }
  | { readonly kind: 'match-ended'; readonly reason: MatchEndReason; readonly result: unknown }
  | { readonly kind: 'join-refused' };

export interface SessionEvents {
  view: SessionView;
  game: { readonly channel: number; readonly payload: GamePayload };
  notice: SessionNotice;
}

export type ActionResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'no-partner' | 'no-lobby' | 'not-host' | 'not-guest' | 'bad-phase' };

export type SendResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: 'no-match' | 'no-link' | 'bad-channel' | 'too-big' | 'invalid' | 'rate';
    };

const id32 = v.pipe(v.string(), v.regex(/^[0-9a-f]{32}$/));
const machine = v.pipe(v.string(), v.regex(/^[A-Za-z0-9-]{8,64}$/));
const time = v.nullable(v.pipe(v.number(), v.finite()));
const roleSchema = v.picklist(['host', 'guest']);
const pair = v.object({ host: v.boolean(), guest: v.boolean() });

const LobbyStateSchema = v.object({
  id: id32,
  rev: v.pipe(v.number(), v.integer(), v.minValue(0)),
  host: machine,
  game: v.object({
    id: v.pipe(v.string(), v.regex(/^[a-z0-9][a-z0-9-]{0,63}$/)),
    version: v.pipe(v.string(), v.maxLength(32)),
    save: v.nullable(v.pipe(v.string(), v.maxLength(128))),
  }),
  phase: v.picklist(['open', 'countdown', 'match']),
  guestJoined: v.boolean(),
  ready: pair,
  countdownEndsAt: time,
  match: v.nullable(
    v.object({
      id: id32,
      seed: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(0xffff_ffff)),
      phase: v.picklist(['loading', 'starting', 'playing', 'paused', 'resuming']),
      loaded: pair,
      startsAt: time,
      started: v.boolean(),
      pause: v.nullable(
        v.object({
          reason: v.picklist(['player', 'connection']),
          by: v.pipe(v.array(roleSchema), v.maxLength(2)),
        }),
      ),
      resumeReady: pair,
      resumeAt: time,
    }),
  ),
  lastResult: v.nullable(
    v.object({
      match: id32,
      result: v.unknown(),
      reason: v.picklist(['finished', 'stopped', 'peer-left', 'peer-restarted', 'crashed']),
    }),
  ),
});

const StateMessage = v.object({ state: LobbyStateSchema });
const LobbyRef = v.object({ lobby: id32 });
const ReadyMessage = v.object({
  lobby: id32,
  ready: v.boolean(),
  at: v.pipe(v.number(), v.finite()),
});
const MatchRef = v.object({ lobby: id32, match: id32 });

export interface SessionControllerOptions {
  readonly config: NetworkConfig;
  readonly clock: Clock;
  readonly random: RandomSource;
  readonly selfMachine: () => string;
  readonly links: LinkManager;
  readonly log: (event: string, data?: Readonly<Record<string, unknown>>) => void;
}

const encoder = new TextEncoder();

export class SessionController {
  readonly events: Emitter<SessionEvents>;
  private readonly options: SessionControllerOptions;
  private local: LobbyState | null = null;
  private remote: LobbyState | null = null;
  private joinState: 'none' | 'pending' | 'joined' = 'none';
  private hostTimers: CancelTimer[] = [];
  private droppedGameValue = 0;
  private readonly sendMessages: TokenBucket;
  private readonly sendBytes: TokenBucket;
  private readonly receiveMessages: TokenBucket;
  private readonly receiveBytes: TokenBucket;

  constructor(options: SessionControllerOptions) {
    this.options = options;
    const { config } = options;
    const now = options.clock.now();
    const receiveSeconds = config.gameReceiveBurstMs / 1000;
    this.sendMessages = new TokenBucket(config.gameMessagesPerSecond, config.gameBurstMessages, now);
    this.sendBytes = new TokenBucket(config.gameBytesPerSecond, config.gameBurstBytes, now);
    this.receiveMessages = new TokenBucket(
      config.gameMessagesPerSecond,
      config.gameMessagesPerSecond * receiveSeconds,
      now,
    );
    this.receiveBytes = new TokenBucket(config.gameBytesPerSecond, config.retransmitBufferBytes, now);
    this.events = new Emitter((error) => {
      options.log('erreur-ecouteur', { error: String(error) });
    });
    const links = options.links.events;
    links.on('message', ({ link, message }) => {
      this.onMessage(link, message);
    });
    links.on('game', ({ channel, payload }) => {
      this.onGame(channel, payload);
    });
    links.on('established', ({ link, resumed, replaced }) => {
      this.onEstablished(link, resumed, replaced);
    });
    links.on('health', ({ health }) => {
      this.onHealth(health);
    });
    links.on('closed', ({ reason }) => {
      this.onClosed(reason);
    });
  }

  /** Messages de jeu reçus et jetés pour dépassement de débit. */
  get droppedGameMessages(): number {
    return this.droppedGameValue;
  }

  view(): SessionView {
    const link = this.options.links.link;
    const role: Role | null =
      this.joinState === 'joined' ? 'guest' : this.local !== null ? 'host' : null;
    const lobby = role === 'guest' ? this.remote : role === 'host' ? this.local : null;
    const invitation = role === 'guest' ? null : this.remote;
    const connection: SessionView['connection'] =
      link === null ? 'absent' : link.health === 'connected' ? 'ok' : link.health;
    const toLocal = (at: number | null): number | null => {
      if (at === null) return null;
      return role === 'guest' ? this.toLocalFromHost(at) : at;
    };
    const match = lobby?.match ?? null;
    const runningPhase = match !== null && match.phase !== 'paused' && match.phase !== 'loading';
    return {
      role,
      lobby,
      invitation,
      joining: this.joinState === 'pending',
      connection,
      localTimes: {
        countdownEndsAt: toLocal(lobby?.countdownEndsAt ?? null),
        startsAt: toLocal(match?.startsAt ?? null),
        resumeAt: toLocal(match?.resumeAt ?? null),
      },
      pausedByConnection: role === 'guest' && connection === 'lost' && runningPhase,
    };
  }

  /** Heure de session: horloge de l'hôte du salon où l'on est (la nôtre si l'on est hôte ou seul). */
  sessionTime(): number {
    return this.view().role === 'guest' ? this.toHostTime(this.options.clock.now()) : this.options.clock.now();
  }

  /** Ouvre son salon (on en devient l'hôte). Un salon déjà ouvert change de jeu. */
  open(game: LobbyGame): ActionResult {
    if (this.joinState !== 'none') return { ok: false, reason: 'bad-phase' };
    if (this.local !== null) return this.select(game);
    this.local = {
      id: randomId(this.options.random),
      rev: 1,
      host: this.options.selfMachine(),
      game,
      phase: 'open',
      guestJoined: false,
      ready: { host: false, guest: false },
      countdownEndsAt: null,
      match: null,
      lastResult: null,
    };
    this.updateActivity();
    this.broadcast();
    return { ok: true };
  }

  /** L'hôte change de jeu ou de sauvegarde: les deux repassent à « Pas encore » (CA-PF-026). */
  select(game: LobbyGame): ActionResult {
    const local = this.local;
    if (local === null) return { ok: false, reason: 'not-host' };
    if (local.phase === 'match') return { ok: false, reason: 'bad-phase' };
    this.clearHostTimers();
    this.setLocal({ ...local, game, phase: 'open', ready: { host: false, guest: false }, countdownEndsAt: null });
    this.broadcast();
    return { ok: true };
  }

  /** Rejoint le salon de l'autre; « Rejoindre » vaut « C'est parti » (F03). */
  join(): ActionResult {
    const remote = this.remote;
    const link = this.options.links.link;
    if (link === null) return { ok: false, reason: 'no-partner' };
    if (remote === null) return { ok: false, reason: 'no-lobby' };
    if (this.local?.phase === 'match') return { ok: false, reason: 'bad-phase' };
    this.joinState = 'pending';
    link.sendReliable('salon.join', { lobby: remote.id });
    this.updateActivity();
    this.emitView();
    return { ok: true };
  }

  /** Prêt ou « Pas encore », de l'un ou l'autre côté. */
  setReady(ready: boolean): ActionResult {
    if (this.joinState === 'joined') {
      const remote = this.remote;
      const link = this.options.links.link;
      if (remote === null) return { ok: false, reason: 'no-lobby' };
      if (link === null) return { ok: false, reason: 'no-partner' };
      link.sendReliable('salon.ready', {
        lobby: remote.id,
        ready,
        at: this.toHostTime(this.options.clock.now()),
      });
      return { ok: true };
    }
    const local = this.local;
    if (local === null) return { ok: false, reason: 'no-lobby' };
    if (local.phase === 'match') return { ok: false, reason: 'bad-phase' };
    this.applyReady('host', ready, this.options.clock.now());
    return { ok: true };
  }

  /** Quitte le salon: l'invité le quitte, l'hôte le ferme. */
  leave(): ActionResult {
    const link = this.options.links.link;
    if (this.joinState !== 'none') {
      const remote = this.remote;
      if (remote !== null) link?.sendReliable('salon.leave', { lobby: remote.id });
      this.joinState = 'none';
      this.updateActivity();
      this.emitView();
      return { ok: true };
    }
    const local = this.local;
    if (local === null) return { ok: false, reason: 'no-lobby' };
    this.clearHostTimers();
    this.local = null;
    link?.sendReliable('salon.close', { lobby: local.id });
    this.updateActivity();
    this.emitView();
    return { ok: true };
  }

  /** Le jeu de cette machine a fini de charger. */
  reportLoaded(): ActionResult {
    const lobby = this.currentLobby();
    if (lobby === null) return { ok: false, reason: 'no-lobby' };
    const match = lobby.match;
    if (match?.phase !== 'loading') return { ok: false, reason: 'bad-phase' };
    if (this.joinState === 'joined') {
      this.options.links.link?.sendReliable('match.loaded', { lobby: lobby.id, match: match.id });
      return { ok: true };
    }
    this.updateMatch({ loaded: { ...match.loaded, host: true } });
    this.maybeStart();
    return { ok: true };
  }

  /** Échap: pause demandée (l'hôte décide et fige la simulation). */
  pause(): ActionResult {
    const lobby = this.currentLobby();
    const match = lobby?.match ?? null;
    if (lobby === null || match === null) return { ok: false, reason: 'bad-phase' };
    if (this.joinState === 'joined') {
      this.options.links.link?.sendReliable('match.pause', { lobby: lobby.id, match: match.id });
      return { ok: true };
    }
    this.applyPause('host', 'player');
    return { ok: true };
  }

  /** « Reprendre »: la reprise part quand les deux l'ont demandée, après un décompte. */
  resume(): ActionResult {
    const lobby = this.currentLobby();
    const match = lobby?.match ?? null;
    if (lobby === null || match === null) return { ok: false, reason: 'bad-phase' };
    if (this.joinState === 'joined') {
      this.options.links.link?.sendReliable('match.resume', { lobby: lobby.id, match: match.id });
      return { ok: true };
    }
    this.applyResumeReady('host');
    return { ok: true };
  }

  /** Fin de partie, avec le résultat du jeu de l'hôte; retour au salon des deux côtés. */
  endMatch(result: unknown, reason: MatchEndReason = 'finished'): ActionResult {
    const local = this.local;
    if (local === null) return { ok: false, reason: 'not-host' };
    if (local.match === null) return { ok: false, reason: 'bad-phase' };
    this.finishMatch(reason, result);
    return { ok: true };
  }

  /** Message d'un jeu vers l'autre machine, sur un canal de 0 à 15. */
  sendGame(channel: number, payload: GamePayload, mode: ChannelMode): SendResult {
    const { config } = this.options;
    const link = this.options.links.link;
    if ((this.currentLobby()?.match ?? null) === null) return { ok: false, reason: 'no-match' };
    if (link === null) return { ok: false, reason: 'no-link' };
    if (!Number.isInteger(channel) || channel < 0 || channel >= config.gameChannels) {
      return { ok: false, reason: 'bad-channel' };
    }
    let bytes: number;
    if (payload instanceof Uint8Array) {
      bytes = payload.byteLength;
    } else {
      try {
        const text = JSON.stringify(payload);
        if (typeof text !== 'string') return { ok: false, reason: 'invalid' };
        bytes = encoder.encode(text).byteLength;
      } catch {
        return { ok: false, reason: 'invalid' };
      }
    }
    if (bytes > config.maxGameMessageBytes) return { ok: false, reason: 'too-big' };
    const now = this.options.clock.now();
    if (!this.sendMessages.take(1, now) || !this.sendBytes.take(bytes, now)) {
      return { ok: false, reason: 'rate' };
    }
    link.sendGame(channel, payload, mode);
    return { ok: true };
  }

  dispose(): void {
    this.clearHostTimers();
    this.events.clear();
  }

  private currentLobby(): LobbyState | null {
    if (this.joinState === 'joined') return this.remote;
    return this.local;
  }

  private toHostTime(localTime: number): number {
    return localTime + (this.options.links.link?.clockOffset() ?? 0);
  }

  private toLocalFromHost(hostTime: number): number {
    return hostTime - (this.options.links.link?.clockOffset() ?? 0);
  }

  private updateActivity(): void {
    this.options.links.link?.setLocalActive(this.local !== null || this.joinState !== 'none');
  }

  private emitView(): void {
    this.events.emit('view', this.view());
  }

  /** L'hôte publie son état complet, numéroté. */
  private broadcast(): void {
    const local = this.local;
    if (local !== null) {
      this.options.links.link?.sendReliable('salon.state', { state: local });
    }
    this.emitView();
  }

  private setLocal(next: Omit<LobbyState, 'rev'>): void {
    const rev = (this.local?.rev ?? 0) + 1;
    this.local = { ...next, rev };
  }

  private updateMatch(changes: Partial<MatchState>): void {
    const local = this.local;
    const match = local?.match ?? null;
    if (local === null || match === null) return;
    this.setLocal({ ...local, match: { ...match, ...changes } });
    this.broadcast();
  }

  private clearHostTimers(): void {
    for (const cancel of this.hostTimers) cancel();
    this.hostTimers = [];
  }

  private applyReady(role: Role, ready: boolean, at: number): void {
    const local = this.local;
    if (local === null || local.phase === 'match') return;
    if (role === 'guest' && !local.guestJoined) return;
    if (!ready && local.phase === 'countdown') {
      // Annulation tardive: honorée si l'appui précède la fin du décompte (reseau.md, section 9.3).
      if (local.countdownEndsAt !== null && at >= local.countdownEndsAt) return;
      this.clearHostTimers();
      this.setLocal({
        ...local,
        phase: 'open',
        countdownEndsAt: null,
        ready: { ...local.ready, [role]: false },
      });
      this.broadcast();
      return;
    }
    const nextReady = { ...local.ready, [role]: ready };
    this.setLocal({ ...local, ready: nextReady });
    if (nextReady.host && nextReady.guest && local.guestJoined && local.phase === 'open') {
      this.startCountdown();
      return;
    }
    this.broadcast();
  }

  private startCountdown(): void {
    const local = this.local;
    if (local === null) return;
    const { clock, config } = this.options;
    const endsAt = clock.now() + config.countdownMs;
    this.setLocal({ ...local, phase: 'countdown', countdownEndsAt: endsAt });
    const rtt = this.options.links.link?.quality().rttMs ?? 0;
    const margin = Math.min(config.lateCancelMaxMarginMs, rtt / 2 + config.lateCancelBaseMarginMs);
    this.hostTimers.push(
      clock.setTimeout(() => {
        this.launchMatch();
      }, config.countdownMs + margin),
    );
    this.broadcast();
  }

  private launchMatch(): void {
    const local = this.local;
    if (local?.phase !== 'countdown' || !local.ready.host || !local.ready.guest) return;
    this.clearHostTimers();
    const seed = Math.floor(this.options.random.next() * 0x1_0000_0000) >>> 0;
    this.setLocal({
      ...local,
      phase: 'match',
      countdownEndsAt: null,
      match: {
        id: randomId(this.options.random),
        seed,
        phase: 'loading',
        loaded: { host: false, guest: false },
        startsAt: null,
        started: false,
        pause: null,
        resumeReady: { host: false, guest: false },
        resumeAt: null,
      },
    });
    this.options.log('partie-chargement', {});
    this.broadcast();
  }

  private maybeStart(): void {
    const local = this.local;
    const match = local?.match ?? null;
    if (local === null || match === null) return;
    if (match.phase !== 'loading' || !match.loaded.host || !match.loaded.guest) return;
    const { clock, config } = this.options;
    const p95 = this.options.links.link?.quality().rttP95Ms ?? 0;
    const delay = Math.max(config.startDelayMinMs, 2 * p95 + config.startDelayExtraMs);
    const startsAt = clock.now() + delay;
    this.updateMatch({ phase: 'starting', startsAt });
    this.hostTimers.push(
      clock.setTimeout(() => {
        const current = this.local?.match ?? null;
        if (current?.phase !== 'starting') return;
        this.updateMatch({ phase: 'playing', started: true });
      }, delay),
    );
  }

  private applyPause(by: Role, reason: PauseReason): void {
    const local = this.local;
    const match = local?.match ?? null;
    if (local === null || match === null) return;
    if (match.phase === 'loading') return;
    if (match.phase === 'paused' && match.pause !== null) {
      if (match.pause.by.includes(by) && match.pause.reason === reason) return;
      const nextReason: PauseReason = match.pause.reason === 'connection' ? 'connection' : reason;
      this.updateMatch({
        pause: { reason: nextReason, by: match.pause.by.includes(by) ? match.pause.by : [...match.pause.by, by] },
      });
      return;
    }
    this.clearHostTimers();
    this.updateMatch({
      phase: 'paused',
      pause: { reason, by: [by] },
      resumeReady: { host: false, guest: false },
      resumeAt: null,
    });
  }

  private applyResumeReady(role: Role): void {
    const local = this.local;
    const match = local?.match ?? null;
    if (local === null || match?.phase !== 'paused') return;
    const resumeReady = { ...match.resumeReady, [role]: true };
    if (!(resumeReady.host && resumeReady.guest)) {
      this.updateMatch({ resumeReady });
      return;
    }
    if (this.options.links.link?.health !== 'connected') {
      this.updateMatch({ resumeReady });
      return;
    }
    const { clock, config } = this.options;
    const resumeAt = clock.now() + config.resumeCountdownMs;
    this.updateMatch({ phase: 'resuming', resumeReady, resumeAt });
    this.hostTimers.push(
      clock.setTimeout(() => {
        const current = this.local?.match ?? null;
        if (current?.phase !== 'resuming') return;
        // Une pause tombée avant le départ reprend comme un départ: l'heure de départ devient celle de la reprise.
        this.updateMatch({
          phase: 'playing',
          started: true,
          startsAt: current.started ? current.startsAt : this.options.clock.now(),
          pause: null,
          resumeAt: null,
          resumeReady: { host: false, guest: false },
        });
      }, config.resumeCountdownMs),
    );
  }

  private finishMatch(reason: MatchEndReason, result: unknown): void {
    const local = this.local;
    const match = local?.match ?? null;
    if (local === null || match === null) return;
    this.clearHostTimers();
    this.setLocal({
      ...local,
      phase: 'open',
      ready: { host: false, guest: false },
      countdownEndsAt: null,
      match: null,
      lastResult: { match: match.id, result, reason },
    });
    this.broadcast();
    this.events.emit('notice', { kind: 'match-ended', reason, result });
  }

  private removeGuest(reason: MatchEndReason): void {
    const local = this.local;
    if (local === null) return;
    if (local.match !== null) {
      this.finishMatch(reason, null);
    }
    const current = this.local;
    if (current === null) return;
    this.clearHostTimers();
    this.setLocal({
      ...current,
      phase: 'open',
      guestJoined: false,
      ready: { host: current.ready.host, guest: false },
      countdownEndsAt: null,
    });
    this.broadcast();
  }

  private onMessage(link: Link, message: ReliableMessage): void {
    const peer = link.peer.machine;
    switch (message.type) {
      case 'salon.state': {
        const parsed = v.safeParse(StateMessage, message.body);
        if (!parsed.success || parsed.output.state.host !== peer) return;
        const state = parsed.output.state;
        const previous = this.remote;
        if (previous !== null && previous.id === state.id && state.rev <= previous.rev) return;
        this.remote = state;
        if (this.joinState === 'pending' && state.guestJoined) {
          this.joinState = 'joined';
          // Notre propre salon se ferme une fois accueillis chez l'autre (H-06).
          const local = this.local;
          if (local !== null) {
            this.clearHostTimers();
            this.local = null;
            link.sendReliable('salon.close', { lobby: local.id });
          }
          this.updateActivity();
        } else if (this.joinState === 'joined' && !state.guestJoined) {
          this.joinState = 'none';
          this.updateActivity();
        }
        if (
          (previous?.match ?? null) !== null &&
          state.match === null &&
          state.lastResult !== null &&
          this.joinState === 'joined'
        ) {
          this.events.emit('notice', {
            kind: 'match-ended',
            reason: state.lastResult.reason,
            result: state.lastResult.result,
          });
        }
        this.emitView();
        return;
      }
      case 'salon.close': {
        const parsed = v.safeParse(LobbyRef, message.body);
        if (!parsed.success || this.remote?.id !== parsed.output.lobby) return;
        this.remote = null;
        if (this.joinState !== 'none') {
          this.joinState = 'none';
          this.updateActivity();
          this.events.emit('notice', { kind: 'lobby-closed', by: 'peer' });
        }
        this.emitView();
        return;
      }
      case 'salon.join': {
        const parsed = v.safeParse(LobbyRef, message.body);
        const local = this.local;
        if (!parsed.success || local?.id !== parsed.output.lobby) return;
        if (this.joinState !== 'none') {
          // Deux salons qui se rejoignent en même temps: celui de la machine au plus petit identifiant reste.
          if (this.options.selfMachine() > peer) return;
          const remote = this.remote;
          if (remote !== null) link.sendReliable('salon.leave', { lobby: remote.id });
          this.joinState = 'none';
        }
        if (local.phase === 'match') return;
        this.setLocal({ ...local, guestJoined: true, ready: { ...local.ready, guest: true } });
        this.updateActivity();
        if (local.ready.host && local.phase === 'open') {
          this.startCountdown();
        } else {
          this.broadcast();
        }
        return;
      }
      case 'salon.ready': {
        const parsed = v.safeParse(ReadyMessage, message.body);
        if (!parsed.success || this.local?.id !== parsed.output.lobby) return;
        this.applyReady('guest', parsed.output.ready, parsed.output.at);
        return;
      }
      case 'salon.leave': {
        const parsed = v.safeParse(LobbyRef, message.body);
        if (!parsed.success || this.local?.id !== parsed.output.lobby) return;
        this.removeGuest('peer-left');
        return;
      }
      case 'match.loaded':
      case 'match.pause':
      case 'match.resume': {
        const parsed = v.safeParse(MatchRef, message.body);
        const local = this.local;
        if (!parsed.success || local?.id !== parsed.output.lobby || local.match?.id !== parsed.output.match) {
          return;
        }
        if (message.type === 'match.loaded') {
          this.updateMatch({ loaded: { ...local.match.loaded, guest: true } });
          this.maybeStart();
        } else if (message.type === 'match.pause') {
          this.applyPause('guest', 'player');
        } else {
          this.applyResumeReady('guest');
        }
        return;
      }
      default:
        this.options.log('message-inconnu', { type: message.type.slice(0, 32) });
    }
  }

  private onGame(channel: number, payload: GamePayload): void {
    if ((this.currentLobby()?.match ?? null) === null) return;
    const now = this.options.clock.now();
    const bytes = payload instanceof Uint8Array ? payload.byteLength : 0;
    // Garde-fou contre une rafale anormale; la rafale permise couvre une reprise entière.
    if (!this.receiveMessages.take(1, now) || !this.receiveBytes.take(bytes, now)) {
      this.droppedGameValue += 1;
      if (this.droppedGameValue % 100 === 1) this.options.log('jeu-debit-depasse', { dropped: this.droppedGameValue });
      return;
    }
    this.events.emit('game', { channel, payload });
  }

  private onEstablished(link: Link, resumed: boolean, replaced: Link | null): void {
    if (!resumed && replaced !== null) {
      // L'autre a redémarré ou la reprise était impossible: ce qu'il savait du salon est perdu.
      if (this.remote !== null) {
        this.remote = null;
        if (this.joinState !== 'none') {
          this.joinState = 'none';
          this.events.emit('notice', { kind: 'peer-left', reason: 'reset' });
        }
      }
      if (this.local?.guestJoined === true) this.removeGuest('peer-restarted');
    }
    this.updateActivity();
    if (this.local !== null) {
      link.sendReliable('salon.state', { state: this.local });
    }
    this.emitView();
  }

  private onHealth(health: 'connected' | 'unstable' | 'lost'): void {
    if (health === 'lost') {
      const local = this.local;
      if (local?.phase === 'countdown') {
        this.clearHostTimers();
        this.setLocal({ ...local, phase: 'open', countdownEndsAt: null, ready: { host: false, guest: false } });
      }
      const match = this.local?.match ?? null;
      if (match !== null && match.phase !== 'loading') {
        this.applyPause('host', 'connection');
      }
    }
    if (health === 'connected' && this.local !== null) {
      this.broadcast();
      return;
    }
    this.emitView();
  }

  private onClosed(reason: 'bye' | 'refused' | 'overflow' | 'stopped' | 'reset'): void {
    if (reason === 'reset') {
      // Une nouvelle liaison suit aussitôt: `established` fera le ménage.
      this.emitView();
      return;
    }
    if (this.remote !== null) {
      const wasIn = this.joinState !== 'none';
      this.remote = null;
      this.joinState = 'none';
      if (wasIn) this.events.emit('notice', { kind: 'peer-left', reason });
    }
    if (this.local?.guestJoined === true) this.removeGuest('peer-left');
    this.emitView();
  }
}
