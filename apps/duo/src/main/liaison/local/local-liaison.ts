// Liaison provisoire, en attendant `packages/liaison` (dev-reseau): TCP, une
// ligne JSON par message. Par défaut sur la boucle locale (deux instances sur une
// même machine, ports de base et suivant); avec une adresse, entre deux machines
// du réseau local, sans découverte. Mêmes valeurs de vivacité que l'ADR 0007
// (battement de 500 ms, perte à 2 s de silence, relance toutes les 250 ms).
import { randomInt, randomUUID } from 'node:crypto';
import net from 'node:net';
import type { Journal } from '../../journal';
import type { Profile } from '../../../shared/state';
import type {
  GameRelayMessage,
  Liaison,
  LiaisonEvent,
  LocalIdentity,
  PeerInfo,
  SessionsView,
  StopReason,
} from '../liaison';
import {
  EMPTY_SESSION,
  fromWire,
  nextDeadline,
  reduceSession,
  toWire,
  type EndSummary,
  type HostSession,
  type SalonGame,
  type SessionInput,
  type SessionTools,
} from '../session-machine';
import { MAX_LINE_BYTES, decodeWire, type GuestIntent, type WireMessage } from './wire';

export const DEFAULT_LIAISON_PORT = 39430;

const HEARTBEAT_MS = 500;
const SILENCE_LOST_MS = 2000;
const ABSENT_AT_REST_MS = 6000;
const RETRY_FAST_MS = 250;
const RETRY_FAST_WINDOW_MS = 10_000;
const RETRY_SLOW_MS = 1000;

export interface LocalLiaisonOptions {
  readonly basePort: number;
  readonly peerAddress: { readonly host: string; readonly port: number } | null;
  readonly journal: Journal;
}

type Hello = Extract<WireMessage, { t: 'hello' }>;

class Link {
  hello: Hello | null = null;
  lastSeen = Date.now();
  private buffer = '';
  private closed = false;

  constructor(
    readonly socket: net.Socket,
    readonly outbound: boolean,
    private readonly onMessage: (link: Link, message: WireMessage) => void,
    private readonly onClose: (link: Link) => void,
  ) {
    socket.setEncoding('utf8');
    socket.setNoDelay(true);
    socket.on('data', (chunk: string) => {
      this.receive(chunk);
    });
    socket.on('error', () => {
      this.close();
    });
    socket.on('close', () => {
      this.close();
    });
  }

  send(message: WireMessage): void {
    if (!this.closed) this.socket.write(`${JSON.stringify(message)}\n`);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.socket.destroy();
    this.onClose(this);
  }

  private receive(chunk: string): void {
    this.lastSeen = Date.now();
    this.buffer += chunk;
    if (this.buffer.length > MAX_LINE_BYTES) {
      this.close();
      return;
    }
    let newline = this.buffer.indexOf('\n');
    while (newline !== -1 && !this.closed) {
      const line = this.buffer.slice(0, newline);
      this.buffer = this.buffer.slice(newline + 1);
      const message = decodeWire(line);
      if (message !== null) this.onMessage(this, message);
      newline = this.buffer.indexOf('\n');
    }
  }
}

export class LocalLiaison implements Liaison {
  private readonly instanceId = randomUUID();
  private readonly listeners = new Set<(event: LiaisonEvent) => void>();
  private readonly tools: SessionTools = {
    newMatchId: () => randomUUID(),
    newSeed: () => randomInt(0, 2 ** 31),
  };
  private identity: LocalIdentity | null = null;
  private server: net.Server | null = null;
  private listenPort: number | null = null;
  private link: Link | null = null;
  private readonly dialing = new Set<string>();
  private readonly sockets = new Set<net.Socket>();
  private peer: PeerInfo | null = null;
  private lastPeerInstance: string | null = null;
  private own: HostSession = EMPTY_SESSION;
  private peerSession: HostSession | null = null;
  private linkDown = false;
  private stopped = false;
  private lostSince: number | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private deadlineTimer: ReturnType<typeof setTimeout> | null = null;
  private absentTimer: ReturnType<typeof setTimeout> | null = null;
  private startedAt = 0;

  constructor(private readonly options: LocalLiaisonOptions) {}

  async start(identity: LocalIdentity): Promise<void> {
    this.identity = identity;
    this.stopped = false;
    this.startedAt = Date.now();
    await this.listen();
    this.heartbeatTimer = setInterval(() => {
      this.onHeartbeatTick();
    }, HEARTBEAT_MS);
    this.scheduleRetry(0);
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.heartbeatTimer !== null) clearInterval(this.heartbeatTimer);
    for (const timer of [this.retryTimer, this.deadlineTimer, this.absentTimer]) {
      if (timer !== null) clearTimeout(timer);
    }
    const link = this.link;
    if (link !== null) {
      link.send({ t: 'bye' });
      await new Promise<void>((resolve) => {
        link.socket.end(() => {
          resolve();
        });
        setTimeout(resolve, 300);
      });
      link.close();
    }
    for (const socket of this.sockets) socket.destroy();
    this.sockets.clear();
    const server = this.server;
    this.server = null;
    if (server !== null) {
      await new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
        setTimeout(resolve, 300);
      });
    }
  }

  private remember(socket: net.Socket): void {
    this.sockets.add(socket);
    socket.once('close', () => {
      this.sockets.delete(socket);
    });
  }

  setProfile(profile: Profile): void {
    if (this.identity !== null) this.identity = { ...this.identity, profile };
    this.link?.send({ t: 'profile', profile });
  }

  subscribe(listener: (event: LiaisonEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  openSalon(game: SalonGame): void {
    if (this.joinedPeer()) return;
    this.applyOwn({ type: 'open', game });
  }

  closeSalon(): void {
    this.applyOwn({ type: 'close' });
  }

  selectSave(choice: SalonGame['saveChoice'], save: SalonGame['save']): void {
    this.applyOwn({ type: 'select-save', saveChoice: choice, save });
  }

  joinSalon(): void {
    const salon = this.peerSession?.salon;
    if (salon === undefined || salon === null || salon.guestJoined || this.link === null) return;
    // Deux salons ouverts: rejoindre celui de l'autre ferme le sien (UX 2.3).
    if (this.own.salon !== null) this.applyOwn({ type: 'close' });
    this.sendIntent({ type: 'join' });
  }

  leaveSalon(): void {
    if (this.joinedPeer()) this.sendIntent({ type: 'leave' });
  }

  setReady(ready: boolean): void {
    this.route({ type: 'ready', seat: 'host', ready }, { type: 'ready', ready });
  }

  reportLoaded(): void {
    this.route({ type: 'loaded', seat: 'host' }, { type: 'loaded' });
  }

  requestPause(): void {
    this.route({ type: 'pause', seat: 'host' }, { type: 'pause' });
  }

  requestResume(): void {
    this.route({ type: 'resume', seat: 'host' }, { type: 'resume' });
  }

  stopMatch(reason: StopReason, summary?: EndSummary): void {
    this.route({ type: 'stop', seat: 'host', reason, summary }, { type: 'stop', reason });
  }

  sendGame(message: GameRelayMessage): void {
    this.link?.send({ t: 'game', channel: message.channel, mode: message.mode, data: message.data });
  }

  private joinedPeer(): boolean {
    return this.peerSession?.salon?.guestJoined === true;
  }

  /** Intention de cette machine: appliquée ici si elle héberge, envoyée à l'hôte sinon. */
  private route(asHost: SessionInput, asGuest: GuestIntent): void {
    if (this.own.salon !== null || this.own.match !== null) {
      this.applyOwn(asHost);
    } else if (this.joinedPeer()) {
      this.sendIntent(asGuest);
    }
  }

  private sendIntent(intent: GuestIntent): void {
    this.link?.send({ t: 'intent', intent });
  }

  private applyOwn(input: SessionInput): void {
    const next = reduceSession(this.own, input, Date.now(), this.tools);
    if (next === this.own) return;
    this.own = next;
    this.armDeadline();
    this.link?.send({ t: 'session', session: toWire(this.own, Date.now()) });
    this.emitSessions();
  }

  private armDeadline(): void {
    if (this.deadlineTimer !== null) clearTimeout(this.deadlineTimer);
    this.deadlineTimer = null;
    const deadline = nextDeadline(this.own);
    if (deadline === null) return;
    this.deadlineTimer = setTimeout(
      () => {
        this.applyOwn({ type: 'tick' });
      },
      Math.max(0, deadline - Date.now()),
    );
  }

  private emit(event: LiaisonEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  private emitSessions(): void {
    const sessions: SessionsView = { own: this.own, peer: this.peerSession };
    this.emit({ type: 'sessions', sessions });
  }

  private inSession(): boolean {
    return this.own.match !== null || this.own.salon?.guestJoined === true || this.joinedPeer();
  }

  private async listen(): Promise<void> {
    const host = this.options.peerAddress === null ? '127.0.0.1' : '0.0.0.0';
    const candidates =
      this.options.peerAddress === null
        ? [this.options.basePort, this.options.basePort + 1]
        : [this.options.basePort];
    for (const port of candidates) {
      const server = net.createServer((socket) => {
        this.accept(socket);
      });
      const ok = await new Promise<boolean>((resolve) => {
        server.once('error', () => {
          resolve(false);
        });
        server.listen(port, host, () => {
          resolve(true);
        });
      });
      if (ok) {
        this.server = server;
        this.listenPort = port;
        this.options.journal.write('info', 'liaison', 'listening', { port });
        return;
      }
    }
    this.options.journal.write('warn', 'liaison', 'listen-failed', { candidates });
  }

  private targets(): { host: string; port: number }[] {
    if (this.options.peerAddress !== null) return [this.options.peerAddress];
    return [this.options.basePort, this.options.basePort + 1]
      .filter((port) => port !== this.listenPort)
      .map((port) => ({ host: '127.0.0.1', port }));
  }

  private accept(socket: net.Socket): void {
    if (this.stopped) {
      socket.destroy();
      return;
    }
    this.remember(socket);
    this.track(new Link(socket, false, (link, message) => {
      this.onMessage(link, message);
    }, (link) => {
      this.onClosed(link);
    }));
  }

  private track(link: Link): void {
    const identity = this.identity;
    if (identity === null) {
      link.close();
      return;
    }
    link.send({
      t: 'hello',
      app: 'duo',
      protocol: 1,
      machineId: identity.machineId,
      instanceId: this.instanceId,
      appVersion: identity.appVersion,
      profile: identity.profile,
    });
  }

  private dial(target: { host: string; port: number }): void {
    const key = `${target.host}:${target.port}`;
    if (this.dialing.has(key)) return;
    this.dialing.add(key);
    const socket = net.connect({ host: target.host, port: target.port });
    this.remember(socket);
    const timeout = setTimeout(() => socket.destroy(), 2000);
    socket.once('connect', () => {
      clearTimeout(timeout);
      this.dialing.delete(key);
      this.track(new Link(socket, true, (link, message) => {
        this.onMessage(link, message);
      }, (link) => {
        this.onClosed(link);
      }));
    });
    socket.once('error', () => {
      clearTimeout(timeout);
      this.dialing.delete(key);
      socket.destroy();
    });
  }

  private scheduleRetry(delayMs: number): void {
    if (this.retryTimer !== null) clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (this.stopped) return;
      if (this.link === null) {
        for (const target of this.targets()) this.dial(target);
      }
      const reference = this.lostSince ?? this.startedAt;
      this.scheduleRetry(Date.now() - reference < RETRY_FAST_WINDOW_MS ? RETRY_FAST_MS : RETRY_SLOW_MS);
    }, delayMs);
  }

  private onHeartbeatTick(): void {
    const link = this.link;
    if (link === null) return;
    if (Date.now() - link.lastSeen > SILENCE_LOST_MS) {
      this.options.journal.write('warn', 'liaison', 'silence');
      link.close();
      return;
    }
    link.send({ t: 'hb' });
  }

  private onMessage(link: Link, message: WireMessage): void {
    if (message.t === 'hello') {
      this.onHello(link, message);
      return;
    }
    if (link !== this.link) return;
    switch (message.t) {
      case 'hb':
        return;
      case 'profile':
        if (this.peer !== null) {
          this.peer = { ...this.peer, profile: message.profile };
          this.emit({ type: 'peer', peer: this.peer });
        }
        return;
      case 'session':
        this.peerSession = fromWire(message.session, Date.now());
        this.emitSessions();
        return;
      case 'intent':
        this.applyOwn(this.guestInput(message.intent));
        return;
      case 'game':
        this.emit({ type: 'game', message: { channel: message.channel, mode: message.mode, data: message.data } });
        return;
      case 'bye':
        this.onBye();
        return;
    }
  }

  private guestInput(intent: GuestIntent): SessionInput {
    switch (intent.type) {
      case 'join':
        return { type: 'join' };
      case 'leave':
        return { type: 'leave' };
      case 'ready':
        return { type: 'ready', seat: 'guest', ready: intent.ready };
      case 'loaded':
        return { type: 'loaded', seat: 'guest' };
      case 'pause':
        return { type: 'pause', seat: 'guest' };
      case 'resume':
        return { type: 'resume', seat: 'guest' };
      case 'stop':
        return { type: 'stop', seat: 'guest', reason: intent.reason };
    }
  }

  private onHello(link: Link, hello: Hello): void {
    const identity = this.identity;
    if (identity === null || hello.machineId === identity.machineId) {
      link.close();
      return;
    }
    link.hello = hello;
    const current = this.link;
    if (current !== null && current !== link) {
      if (current.hello?.machineId !== hello.machineId) {
        link.close();
        return;
      }
      // Deux connexions croisées: on garde celle dont l'appelant a le plus petit identifiant.
      const dialer = (candidate: Link): string =>
        candidate.outbound ? identity.machineId : (candidate.hello?.machineId ?? '');
      if (dialer(current) <= dialer(link)) {
        link.close();
        return;
      }
      this.link = link;
      current.close();
    } else {
      this.link = link;
    }
    this.onEstablished(hello);
  }

  private onEstablished(hello: Hello): void {
    if (this.absentTimer !== null) clearTimeout(this.absentTimer);
    this.absentTimer = null;
    this.lostSince = null;
    const restarted = this.lastPeerInstance !== null && this.lastPeerInstance !== hello.instanceId;
    this.lastPeerInstance = hello.instanceId;
    this.peer = {
      machineId: hello.machineId,
      instanceId: hello.instanceId,
      appVersion: hello.appVersion,
      profile: hello.profile,
    };
    this.options.journal.write('info', 'liaison', 'established', { restarted });
    this.emit({ type: 'peer', peer: this.peer });
    if (restarted) {
      this.peerSession = null;
      this.applyOwn({ type: 'guest-gone' });
    }
    if (this.linkDown) {
      this.linkDown = false;
      this.applyOwn({ type: 'link', up: true });
      this.emit({ type: 'link', up: true });
    }
    this.link?.send({ t: 'session', session: toWire(this.own, Date.now()) });
    this.emitSessions();
  }

  private onClosed(link: Link): void {
    if (link !== this.link) return;
    this.link = null;
    if (this.stopped) return;
    this.lostSince = Date.now();
    this.scheduleRetry(0);
    this.options.journal.write('warn', 'liaison', 'lost', { inSession: this.inSession() });
    if (this.inSession()) {
      this.linkDown = true;
      this.applyOwn({ type: 'link', up: false });
      this.emit({ type: 'link', up: false });
      return;
    }
    this.absentTimer = setTimeout(() => {
      this.absentTimer = null;
      if (this.link !== null) return;
      this.peer = null;
      this.peerSession = null;
      this.emit({ type: 'peer', peer: null });
      this.emitSessions();
    }, ABSENT_AT_REST_MS);
  }

  private onBye(): void {
    this.options.journal.write('info', 'liaison', 'bye-received');
    const link = this.link;
    this.link = null;
    this.peer = null;
    this.peerSession = null;
    this.lastPeerInstance = null;
    this.linkDown = false;
    this.applyOwn({ type: 'guest-gone' });
    this.emit({ type: 'peer', peer: null });
    this.emitSessions();
    link?.close();
    this.lostSince = Date.now();
    this.scheduleRetry(RETRY_FAST_MS);
  }
}
