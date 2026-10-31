import * as v from 'valibot';
import type { Endpoint } from './addresses.ts';
import { every } from './clock.ts';
import type { CancelTimer, Clock } from './clock.ts';
import type { NetworkConfig } from './config.ts';
import {
  ByeSchema,
  GameFrameSchema,
  PingSchema,
  PongSchema,
  ReliableHeaderSchema,
  decodeBinaryGameFrame,
  encodeBinaryGameFrame,
  parseJson,
} from './protocol.ts';
import type { ByeReason, InstalledGame } from './protocol.ts';
import type { Connection, Frame } from './transport.ts';

/** Ce que l'on sait de l'autre machine, d'après sa poignée de main. */
export interface PeerInfo {
  readonly machine: string;
  readonly instance: string;
  readonly appVersion: string;
  readonly protocol: number;
  readonly pseudo: string;
  readonly color: string;
  readonly computer: string;
  readonly games: readonly InstalledGame[];
  readonly bridge?: readonly string[];
  readonly electron?: string;
  readonly dataFormat?: number;
  readonly os?: string;
  readonly arch?: string;
}

/** Santé de la liaison: établie, en reprise (silence ou connexion perdue), ou perdue. */
export type LinkHealth = 'connected' | 'unstable' | 'lost';

export type ConnectionRole = 'caller' | 'callee';

/** Mode d'un canal de jeu (reseau.md, section 11.2). */
export type ChannelMode = 'reliable' | 'latest';

export type GamePayload = unknown;

/** Message fiable reçu, d'un type que la liaison ne traite pas elle-même. */
export interface ReliableMessage {
  readonly type: string;
  readonly body: Readonly<Record<string, unknown>>;
}

export interface LinkCallbacks {
  onMessage(message: ReliableMessage): void;
  onGame(channel: number, payload: GamePayload): void;
  onHealth(health: LinkHealth): void;
  /** La connexion manque ou se tait: le gestionnaire décide s'il faut rappeler. */
  onConnectionTrouble(kind: 'closed' | 'silent'): void;
  onBye(reason: ByeReason): void;
  /** Le tampon de réémission a débordé: la reprise devient impossible. */
  onOverflow(): void;
  onActivityChange(): void;
  log(event: string, data?: Readonly<Record<string, unknown>>): void;
}

interface OutgoingEntry {
  readonly seq: number;
  readonly frame: Frame;
  readonly bytes: number;
  readonly latestChannel: number | null;
}

interface ClockSample {
  readonly rtt: number;
  readonly offset: number;
  readonly at: number;
}

/** Qualité mesurée par les battements (reseau.md, section 13). */
export interface LinkQuality {
  readonly rttMs: number | null;
  readonly rttP95Ms: number | null;
  readonly jitterMs: number | null;
  /** Horloge de l'autre moins la nôtre, d'après l'aller-retour le plus court. */
  readonly clockOffsetMs: number;
  readonly state: 'good' | 'unstable';
  readonly silenceMs: number;
}

export interface LinkOptions {
  readonly id: string;
  readonly peer: PeerInfo;
  readonly config: NetworkConfig;
  readonly clock: Clock;
  readonly callbacks: LinkCallbacks;
}

const textEncoder = new TextEncoder();

function frameBytes(frame: Frame): number {
  return typeof frame === 'string' ? textEncoder.encode(frame).byteLength : frame.byteLength;
}

/**
 * La liaison: une session logique entre les deux machines (identifiant, numéros
 * dans chaque sens), portée à un instant donné par une connexion. Elle survit au
 * remplacement de cette connexion sans perdre ni doubler un message fiable
 * (reseau.md, section 8.3).
 */
export class Link {
  readonly id: string;
  peer: PeerInfo;
  private readonly config: NetworkConfig;
  private readonly clock: Clock;
  private readonly callbacks: LinkCallbacks;

  private connection: Connection | null = null;
  private connectionRoleValue: ConnectionRole = 'caller';
  private endpointValue: Endpoint | null = null;
  private sendSeq = 0;
  private recvSeq = 0;
  private buffer: OutgoingEntry[] = [];
  private bufferBytes = 0;
  private lastReceivedAt: number;
  private healthValue: LinkHealth = 'unstable';
  private troubleSignalled = false;
  private localActive = false;
  private peerActive = false;
  private pingId = 0;
  private samples: ClockSample[] = [];
  private closedValue = false;
  private stopHeartbeat: CancelTimer = () => undefined;
  private readonly stopSilenceCheck: CancelTimer;
  private invalidAt: number[] = [];
  /** Début du régime actif: l'autre a un battement pour répondre avant qu'on compte son silence. */
  private activeSince = 0;

  constructor(options: LinkOptions) {
    this.id = options.id;
    this.peer = options.peer;
    this.config = options.config;
    this.clock = options.clock;
    this.callbacks = options.callbacks;
    this.lastReceivedAt = this.clock.now();
    this.armHeartbeat();
    this.stopSilenceCheck = every(
      this.clock,
      () => this.config.silenceCheckMs,
      () => {
        this.checkSilence();
      },
    );
  }

  get health(): LinkHealth {
    return this.healthValue;
  }

  get closed(): boolean {
    return this.closedValue;
  }

  get connectionRole(): ConnectionRole {
    return this.connectionRoleValue;
  }

  get endpoint(): Endpoint | null {
    return this.endpointValue;
  }

  get hasConnection(): boolean {
    return this.connection !== null;
  }

  /** Dernier numéro fiable reçu de l'autre (annoncé à la reprise). */
  get received(): number {
    return this.recvSeq;
  }

  silenceMs(): number {
    return this.clock.now() - this.lastReceivedAt;
  }

  isActive(): boolean {
    return this.localActive || this.peerActive;
  }

  setLocalActive(active: boolean): void {
    if (this.localActive === active) return;
    const before = this.isActive();
    this.localActive = active;
    // L'autre apprend le changement de régime par un battement envoyé tout de suite.
    this.sendPing();
    this.afterActivityChange(before);
  }

  /** Le battement suit le régime tout de suite, sans attendre le tour en cours (2 s au repos). */
  private armHeartbeat(): void {
    this.stopHeartbeat();
    this.stopHeartbeat = every(
      this.clock,
      () => (this.isActive() ? this.config.heartbeatActiveMs : this.config.heartbeatIdleMs),
      () => {
        this.sendPing();
      },
    );
  }

  private afterActivityChange(before: boolean): void {
    const now = this.isActive();
    if (before === now || this.closedValue) return;
    if (now) this.activeSince = this.clock.now();
    this.armHeartbeat();
    this.callbacks.onActivityChange();
  }

  /**
   * Confie la liaison à une connexion neuve (établissement ou reprise). L'ancienne
   * est fermée; tout ce que l'autre n'a pas reçu (`peerReceived`) est réémis.
   */
  attach(
    connection: Connection,
    role: ConnectionRole,
    peerReceived: number,
    endpoint: Endpoint | null,
  ): void {
    if (this.closedValue) {
      connection.close(4000, 'closed');
      return;
    }
    const previous = this.connection;
    this.connection = connection;
    this.connectionRoleValue = role;
    this.endpointValue = endpoint;
    connection.setHandlers({
      onFrame: (frame) => {
        if (this.connection === connection) this.handleFrame(frame);
      },
      onClose: () => {
        if (this.connection !== connection) return;
        this.connection = null;
        this.callbacks.log('connexion-fermee', { link: this.id });
        this.signalTrouble('closed');
      },
    });
    if (previous !== null && previous !== connection) {
      previous.setHandlers({ onFrame: () => undefined, onClose: () => undefined });
      previous.close(4001, 'replaced');
    }
    this.acknowledge(peerReceived);
    for (const entry of this.buffer) {
      if (entry.seq > peerReceived) connection.send(entry.frame);
    }
    this.lastReceivedAt = this.clock.now();
    this.troubleSignalled = false;
    this.setHealth('connected');
    this.sendPing();
  }

  /** Envoie un message fiable de contrôle (salon, partie). */
  sendReliable(type: string, body: Readonly<Record<string, unknown>> = {}): void {
    if (this.closedValue) return;
    const seq = ++this.sendSeq;
    const frame = JSON.stringify({ ...body, type, seq });
    this.enqueue({ seq, frame, bytes: frameBytes(frame), latestChannel: null });
  }

  /** Envoie un message de jeu: JSON par défaut, binaire si le contenu est un `Uint8Array`. */
  sendGame(channel: number, payload: GamePayload, mode: ChannelMode): void {
    if (this.closedValue) return;
    const seq = ++this.sendSeq;
    const frame =
      payload instanceof Uint8Array
        ? encodeBinaryGameFrame(channel, seq, payload)
        : JSON.stringify({ type: 'g', seq, ch: channel, d: payload });
    if (mode === 'latest') {
      // Un ancien instantané n'a plus de valeur: seul le dernier du canal est gardé pour la reprise.
      const kept: OutgoingEntry[] = [];
      for (const entry of this.buffer) {
        if (entry.latestChannel === channel) this.bufferBytes -= entry.bytes;
        else kept.push(entry);
      }
      this.buffer = kept;
    }
    this.enqueue({
      seq,
      frame,
      bytes: frameBytes(frame),
      latestChannel: mode === 'latest' ? channel : null,
    });
  }

  /** Ferme la liaison pour de bon (`bye` si la connexion est là). */
  close(reason: ByeReason, sendBye: boolean): void {
    if (this.closedValue) return;
    this.closedValue = true;
    this.stopHeartbeat();
    this.stopSilenceCheck();
    const connection = this.connection;
    this.connection = null;
    if (connection !== null) {
      if (sendBye) connection.send(JSON.stringify({ type: 'bye', reason }));
      connection.setHandlers({ onFrame: () => undefined, onClose: () => undefined });
      connection.close(1000, reason);
    }
    this.buffer = [];
    this.bufferBytes = 0;
  }

  /** Abandonne la connexion courante sans fermer la liaison (essais et banc). */
  dropConnection(): void {
    const connection = this.connection;
    if (connection === null) return;
    this.connection = null;
    connection.setHandlers({ onFrame: () => undefined, onClose: () => undefined });
    connection.close(4002, 'dropped');
    this.signalTrouble('closed');
  }

  quality(): LinkQuality {
    const now = this.clock.now();
    const recent = this.samples.filter((sample) => now - sample.at <= this.config.qualityWindowMs);
    const rtts = recent.map((sample) => sample.rtt).sort((a, b) => a - b);
    let jitter: number | null = null;
    if (recent.length >= 2) {
      let total = 0;
      for (let index = 1; index < recent.length; index += 1) {
        const current = recent[index];
        const previous = recent[index - 1];
        if (current !== undefined && previous !== undefined)
          total += Math.abs(current.rtt - previous.rtt);
      }
      jitter = total / (recent.length - 1);
    }
    const silence = this.silenceMs();
    const unstable =
      this.healthValue !== 'connected' ||
      silence >
        Math.max(this.config.unstableAfterMs, this.heartbeatMs() + this.config.unstableAfterMs) ||
      (jitter !== null && jitter > this.config.unstableJitterMs);
    return {
      rttMs: percentile(rtts, 0.5),
      rttP95Ms: percentile(rtts, 0.95),
      jitterMs: jitter,
      clockOffsetMs: this.clockOffset(),
      state: unstable ? 'unstable' : 'good',
      silenceMs: silence,
    };
  }

  /** Horloge de l'autre moins la nôtre (0 tant qu'aucun battement n'est revenu). */
  clockOffset(): number {
    let best: ClockSample | undefined;
    for (const sample of this.samples) {
      if (best === undefined || sample.rtt < best.rtt) best = sample;
    }
    return best?.offset ?? 0;
  }

  private heartbeatMs(): number {
    return this.isActive() ? this.config.heartbeatActiveMs : this.config.heartbeatIdleMs;
  }

  private enqueue(entry: OutgoingEntry): void {
    this.buffer.push(entry);
    this.bufferBytes += entry.bytes;
    if (this.bufferBytes > this.config.retransmitBufferBytes) {
      this.callbacks.log('tampon-deborde', { link: this.id, bytes: this.bufferBytes });
      this.buffer = [];
      this.bufferBytes = 0;
      this.callbacks.onOverflow();
      return;
    }
    this.connection?.send(entry.frame);
  }

  private acknowledge(ack: number): void {
    if (this.buffer.length === 0 || (this.buffer[0]?.seq ?? Infinity) > ack) return;
    const kept: OutgoingEntry[] = [];
    for (const entry of this.buffer) {
      if (entry.seq > ack) kept.push(entry);
      else this.bufferBytes -= entry.bytes;
    }
    this.buffer = kept;
  }

  private sendPing(): void {
    if (this.connection === null || this.closedValue) return;
    this.pingId = (this.pingId + 1) % 0xffff_ffff;
    this.connection.send(
      JSON.stringify({
        type: 'ping',
        id: this.pingId,
        t0: this.clock.now(),
        ack: this.recvSeq,
        active: this.localActive,
      }),
    );
  }

  private checkSilence(): void {
    if (this.closedValue) return;
    const active = this.isActive();
    const silence = active
      ? this.clock.now() - Math.max(this.lastReceivedAt, this.activeSince)
      : this.silenceMs();
    const lostAfter = active ? this.config.lostActiveMs : this.config.lostIdleMs;
    if (silence >= lostAfter) {
      this.setHealth('lost');
      // Au repos aussi, une liaison perdue se relance sans fin.
      this.signalTrouble('silent');
    }
    if (active && silence >= this.config.earlyReconnectMs) {
      this.signalTrouble('silent');
    }
  }

  private signalTrouble(kind: 'closed' | 'silent'): void {
    if (kind === 'silent' && this.troubleSignalled) return;
    this.troubleSignalled = true;
    if (this.healthValue === 'connected') this.setHealth('unstable');
    this.callbacks.onConnectionTrouble(kind);
  }

  private setHealth(health: LinkHealth): void {
    if (this.healthValue === health) return;
    this.healthValue = health;
    this.callbacks.log('sante', { link: this.id, health });
    this.callbacks.onHealth(health);
  }

  private noteInvalid(reason: string): void {
    const now = this.clock.now();
    this.invalidAt = this.invalidAt.filter((at) => now - at < 60_000);
    this.invalidAt.push(now);
    this.callbacks.log('message-invalide', { link: this.id, reason });
    if (this.invalidAt.length >= this.config.invalidMessagesPerMinute) {
      // Trop de messages invalides: la connexion est fermée, la liaison se reprend sur une neuve.
      this.invalidAt = [];
      this.dropConnection();
    }
  }

  private handleFrame(frame: Frame): void {
    const now = this.clock.now();
    this.lastReceivedAt = now;
    if (this.healthValue !== 'connected' && this.connection !== null) {
      this.troubleSignalled = false;
      this.setHealth('connected');
    }
    if (typeof frame !== 'string') {
      const decoded = decodeBinaryGameFrame(frame);
      if (decoded === null) {
        this.noteInvalid('binaire');
        return;
      }
      if (!this.accept(decoded.seq)) return;
      this.callbacks.onGame(decoded.channel, decoded.payload);
      return;
    }
    const data = parseJson(frame);
    if (typeof data !== 'object' || data === null || !('type' in data)) {
      this.noteInvalid('json');
      return;
    }
    switch (data.type) {
      case 'ping': {
        const ping = v.safeParse(PingSchema, data);
        if (!ping.success) {
          this.noteInvalid('ping');
          return;
        }
        this.updatePeerActive(ping.output.active);
        this.acknowledge(ping.output.ack);
        this.connection?.send(
          JSON.stringify({
            type: 'pong',
            id: ping.output.id,
            t0: ping.output.t0,
            t1: now,
            t2: this.clock.now(),
            ack: this.recvSeq,
            active: this.localActive,
          }),
        );
        return;
      }
      case 'pong': {
        const pong = v.safeParse(PongSchema, data);
        if (!pong.success) {
          this.noteInvalid('pong');
          return;
        }
        this.updatePeerActive(pong.output.active);
        this.acknowledge(pong.output.ack);
        const { t0, t1, t2 } = pong.output;
        const rtt = now - t0 - (t2 - t1);
        if (rtt >= 0) {
          this.samples.push({ rtt, offset: (t1 - t0 + (t2 - now)) / 2, at: now });
          if (this.samples.length > this.config.clockSamples) this.samples.shift();
        }
        return;
      }
      case 'bye': {
        const bye = v.safeParse(ByeSchema, data);
        this.callbacks.onBye(bye.success ? bye.output.reason : 'quit');
        return;
      }
      default:
        break;
    }
    const header = v.safeParse(ReliableHeaderSchema, data);
    if (!header.success) {
      this.noteInvalid('en-tete');
      return;
    }
    if (!this.accept(header.output.seq)) return;
    if (header.output.type === 'g') {
      const game = v.safeParse(GameFrameSchema, data);
      if (!game.success) {
        this.noteInvalid('jeu');
        return;
      }
      this.callbacks.onGame(game.output.ch, game.output.d);
      return;
    }
    const body: Record<string, unknown> = { ...header.output };
    this.callbacks.onMessage({ type: header.output.type, body });
  }

  /** Livré une seule fois: un numéro déjà vu est un doublon de réémission. */
  private accept(seq: number): boolean {
    if (seq <= this.recvSeq) return false;
    this.recvSeq = seq;
    return true;
  }

  private updatePeerActive(active: boolean): void {
    if (this.peerActive === active) return;
    const before = this.isActive();
    this.peerActive = active;
    this.afterActivityChange(before);
  }
}

function percentile(sorted: readonly number[], ratio: number): number | null {
  if (sorted.length === 0) return null;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(ratio * sorted.length) - 1));
  return sorted[index] ?? null;
}
