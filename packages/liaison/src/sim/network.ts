import { directedBroadcast, endpointKey, sameSubnet } from '../addresses.ts';
import type { Endpoint, RawInterfaces } from '../addresses.ts';
import { ManualClock } from '../clock.ts';
import type { CancelTimer } from '../clock.ts';
import { createSeededRandom } from '../random.ts';
import type { RandomSource } from '../random.ts';
import type {
  BindOptions,
  Connection,
  ConnectionHandlers,
  DatagramSocket,
  DialCallbacks,
  Frame,
  ListenOptions,
  NetworkDriver,
  StreamServer,
} from '../transport.ts';

/**
 * Qualité du lien simulé, dans chaque sens (reseau.md, section 18.2). Une perte
 * imite TCP: la trame attend une réémission (200 ms, doublés à chaque perte de
 * suite) et retarde toutes celles qui la suivent.
 */
export interface LinkProfile {
  /** Délai d'un sens. */
  readonly latencyMs: number;
  /** Écart type de la gigue (loi normale bornée à deux écarts types). */
  readonly jitterMs: number;
  /** Probabilité de perte d'une trame TCP ou d'un datagramme. */
  readonly loss: number;
  readonly retransmitMs: number;
}

export const PROFILE_R0: LinkProfile = { latencyMs: 0.5, jitterMs: 0, loss: 0, retransmitMs: 200 };
/** Profil R1 des critères: 100 ms d'aller-retour, 20 ms de gigue, 2 % de pertes. */
export const PROFILE_R1: LinkProfile = { latencyMs: 50, jitterMs: 20, loss: 0.02, retransmitMs: 200 };

interface SimInterface {
  readonly name: string;
  readonly address: string;
  readonly netmask: string;
}

interface PipeItem {
  readonly deliver: () => void;
  at: number;
}

/** Un sens d'une connexion: file ordonnée comme TCP, gelée pendant une coupure. */
class Pipe {
  private readonly items: PipeItem[] = [];
  private timer: CancelTimer | null = null;
  private lastAt = 0;
  private consecutiveLosses = 0;
  private readonly network: SimNetwork;
  readonly from: string;
  readonly to: string;

  constructor(network: SimNetwork, from: string, to: string) {
    this.network = network;
    this.from = from;
    this.to = to;
  }

  push(deliver: () => void): void {
    const now = this.network.clock.now();
    let at = now + this.network.sampleDelay();
    if (this.network.sampleLoss()) {
      at += this.network.profile.retransmitMs * 2 ** this.consecutiveLosses;
      this.consecutiveLosses = Math.min(this.consecutiveLosses + 1, 6);
    } else {
      this.consecutiveLosses = 0;
    }
    at = Math.max(at, this.lastAt);
    this.lastAt = at;
    this.items.push({ deliver, at });
    this.arm();
  }

  /** Coupure levée: ce qui attendait repart, dans l'ordre, après le délai du lien. */
  retime(): void {
    const now = this.network.clock.now();
    let previous = 0;
    for (const item of this.items) {
      item.at = Math.max(item.at, now + this.network.sampleDelay(), previous);
      previous = item.at;
    }
    this.lastAt = Math.max(this.lastAt, previous);
    this.arm();
  }

  freeze(): void {
    if (this.timer !== null) {
      this.timer();
      this.timer = null;
    }
  }

  drop(): void {
    this.freeze();
    this.items.length = 0;
  }

  private arm(): void {
    if (this.timer !== null || this.items.length === 0) return;
    if (this.network.isCut(this.from, this.to)) return;
    const head = this.items[0];
    if (head === undefined) return;
    this.timer = this.network.clock.setTimeout(() => {
      this.timer = null;
      if (this.network.isCut(this.from, this.to)) return;
      const item = this.items.shift();
      item?.deliver();
      this.arm();
    }, head.at - this.network.clock.now());
  }
}

class SimConnection implements Connection {
  readonly remote: Endpoint;
  readonly direction: 'outgoing' | 'incoming';
  readonly bufferedAmount = 0;
  peer: SimConnection | null = null;
  outgoing: Pipe | null = null;
  private handlers: ConnectionHandlers | null = null;
  private readonly inbox: (() => void)[] = [];
  private closed = false;
  private notified = false;
  private readonly network: SimNetwork;
  readonly localHost: string;

  constructor(network: SimNetwork, localHost: string, remote: Endpoint, direction: 'outgoing' | 'incoming') {
    this.network = network;
    this.localHost = localHost;
    this.remote = remote;
    this.direction = direction;
  }

  setHandlers(handlers: ConnectionHandlers): void {
    this.handlers = handlers;
    const pending = this.inbox.splice(0);
    for (const run of pending) run();
  }

  send(frame: Frame): void {
    if (this.closed || this.peer === null || this.outgoing === null) return;
    const peer = this.peer;
    const copy = typeof frame === 'string' ? frame : frame.slice();
    this.network.countFrame(this.localHost);
    this.outgoing.push(() => {
      peer.receive(() => peer.handlers?.onFrame(copy));
    });
  }

  close(code: number, reason: string): void {
    if (this.closed) return;
    this.closed = true;
    this.network.forget(this);
    const peer = this.peer;
    if (peer !== null && this.outgoing !== null) {
      this.outgoing.push(() => {
        peer.closeFromPeer(code, reason);
      });
    }
    this.notifyClose(code, reason);
  }

  /** Fermeture par le système (processus tué, réseau perdu): l'autre côté l'apprend après le délai. */
  breakConnection(code = 1006): void {
    if (this.closed) return;
    this.closed = true;
    this.network.forget(this);
    this.outgoing?.drop();
    const peer = this.peer;
    if (peer !== null) {
      this.network.clock.setTimeout(() => {
        peer.closeFromPeer(code, '');
      }, this.network.profile.latencyMs);
    }
    this.notifyClose(code, '');
  }

  isOpen(): boolean {
    return !this.closed;
  }

  private closeFromPeer(code: number, reason: string): void {
    if (this.closed) {
      this.notifyClose(code, reason);
      return;
    }
    this.closed = true;
    this.network.forget(this);
    this.outgoing?.drop();
    this.notifyClose(code, reason);
  }

  private receive(run: () => void): void {
    if (this.closed) return;
    if (this.handlers === null) {
      this.inbox.push(run);
      return;
    }
    run();
  }

  private notifyClose(code: number, reason: string): void {
    if (this.notified) return;
    this.notified = true;
    const run = (): void => {
      this.handlers?.onClose({ code, reason });
    };
    if (this.handlers === null) this.inbox.push(run);
    else run();
  }
}

interface SimListener {
  readonly onConnection: (connection: Connection) => void;
}

interface SimSocket {
  readonly port: number;
  readonly onMessage: (data: Uint8Array, from: Endpoint) => void;
}

class SimHost {
  interfaces: SimInterface[];
  readonly listeners = new Map<number, SimListener>();
  readonly sockets = new Map<number, SimSocket>();
  readonly connections = new Set<SimConnection>();
  nextEphemeral = 50_000;
  /** Processus tué: plus aucune émission ni aucun appel. */
  dead = false;
  readonly address: string;

  constructor(address: string, netmask: string, interfaceName: string) {
    this.address = address;
    this.interfaces = [{ name: interfaceName, address, netmask }];
  }

  get netmask(): string {
    return this.interfaces[0]?.netmask ?? '255.255.255.0';
  }
}

export interface AddHostOptions {
  readonly netmask?: string;
  readonly interfaceName?: string;
  readonly seed?: number;
  /** Décalage de l'horloge de cette machine: chaque machine a sa propre origine de temps. */
  readonly clockOffsetMs?: number;
}

/**
 * Réseau simulé en temps simulé: plusieurs machines, des connexions qui imitent
 * TCP et des datagrammes qui imitent UDP, sur une même horloge manuelle.
 */
export class SimNetwork {
  readonly clock: ManualClock;
  profile: LinkProfile;
  /** Datagrammes UDP perdus (indépendamment des trames TCP). */
  datagramLoss = 0;
  readonly framesSent = new Map<string, number>();
  private readonly hosts = new Map<string, SimHost>();
  private readonly cuts = new Set<string>();
  private readonly pipes = new Set<Pipe>();
  private readonly random: RandomSource;

  constructor(options: { seed?: number; profile?: LinkProfile; clock?: ManualClock } = {}) {
    this.clock = options.clock ?? new ManualClock();
    this.profile = options.profile ?? PROFILE_R0;
    this.random = createSeededRandom(options.seed ?? 7);
  }

  /** Ajoute une machine et rend son pilote réseau. */
  addHost(address: string, options: AddHostOptions = {}): NetworkDriver {
    const host = new SimHost(address, options.netmask ?? '255.255.255.0', options.interfaceName ?? 'en0');
    this.hosts.set(address, host);
    return this.createDriver(host, createSeededRandom(options.seed ?? hashText(address)), options.clockOffsetMs ?? 0);
  }

  /**
   * Processus tué: ses connexions sont fermées par le système, il ne fait plus
   * rien, et la machine reste là sans écoute (un appel reçoit un refus net).
   */
  crashHost(address: string): void {
    const host = this.hosts.get(address);
    if (host === undefined) return;
    host.dead = true;
    for (const connection of [...host.connections]) connection.breakConnection();
    host.listeners.clear();
    host.sockets.clear();
    this.hosts.set(address, new SimHost(address, host.netmask, host.interfaces[0]?.name ?? 'en0'));
  }

  /** Machine éteinte ou partie du réseau: plus rien ne répond à son adresse. */
  removeHost(address: string): void {
    const host = this.hosts.get(address);
    if (host === undefined) return;
    host.dead = true;
    for (const connection of [...host.connections]) connection.breakConnection();
    this.hosts.delete(address);
  }

  /** Remplace les interfaces d'une machine (changement de Wi-Fi, câble débranché). */
  setInterfaces(address: string, interfaces: readonly SimInterface[]): void {
    const host = this.hosts.get(address);
    if (host !== undefined) host.interfaces = [...interfaces];
  }

  /** Coupe le trajet entre deux machines: tout attend, rien ne se ferme. */
  cut(a: string, b: string): void {
    this.cuts.add(pairKey(a, b));
    for (const pipe of this.pipes) {
      if (pairKey(pipe.from, pipe.to) === pairKey(a, b)) pipe.freeze();
    }
  }

  restore(a: string, b: string): void {
    this.cuts.delete(pairKey(a, b));
    for (const pipe of this.pipes) {
      if (pairKey(pipe.from, pipe.to) === pairKey(a, b)) pipe.retime();
    }
  }

  isCut(a: string, b: string): boolean {
    return this.cuts.has(pairKey(a, b));
  }

  /** Ferme par le système toutes les connexions entre deux machines (erreur réseau). */
  breakConnections(a: string, b: string): void {
    for (const host of [this.hosts.get(a), this.hosts.get(b)]) {
      for (const connection of [...(host?.connections ?? [])]) {
        if (connection.remote.host === a || connection.remote.host === b) connection.breakConnection();
      }
    }
  }

  openConnections(address: string): number {
    const host = this.hosts.get(address);
    return host === undefined ? 0 : [...host.connections].filter((c) => c.isOpen()).length;
  }

  sampleDelay(): number {
    const { latencyMs, jitterMs } = this.profile;
    if (jitterMs <= 0) return latencyMs;
    const u1 = Math.max(this.random.next(), 1e-9);
    const u2 = this.random.next();
    const gaussian = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const bounded = Math.max(-2, Math.min(2, gaussian));
    return Math.max(0, latencyMs + bounded * jitterMs);
  }

  sampleLoss(): boolean {
    return this.profile.loss > 0 && this.random.next() < this.profile.loss;
  }

  countFrame(host: string): void {
    this.framesSent.set(host, (this.framesSent.get(host) ?? 0) + 1);
  }

  forget(connection: SimConnection): void {
    this.hosts.get(connection.localHost)?.connections.delete(connection);
  }

  private createDriver(host: SimHost, random: RandomSource, clockOffsetMs: number): NetworkDriver {
    const clock =
      clockOffsetMs === 0
        ? this.clock
        : {
            now: () => this.clock.now() + clockOffsetMs,
            setTimeout: (callback: () => void, delayMs: number) => this.clock.setTimeout(callback, delayMs),
          };
    return {
      clock,
      random,
      dialer: {
        dial: (endpoint, timeoutMs, callbacks) => this.dial(host, endpoint, timeoutMs, callbacks),
      },
      listen: (options) => this.listen(host, options),
      bindDatagram: (options) => this.bind(host, options),
      interfaces: () => toRawInterfaces(host.interfaces),
    };
  }

  private listen(host: SimHost, options: ListenOptions): Promise<StreamServer> {
    if (host.listeners.has(options.port)) {
      return Promise.reject(Object.assign(new Error('EADDRINUSE'), { code: 'EADDRINUSE' }));
    }
    host.listeners.set(options.port, { onConnection: options.onConnection });
    return Promise.resolve({
      port: options.port,
      close: () => {
        host.listeners.delete(options.port);
        return Promise.resolve();
      },
    });
  }

  private bind(host: SimHost, options: BindOptions): Promise<DatagramSocket> {
    if (host.sockets.has(options.port)) {
      return Promise.reject(Object.assign(new Error('EADDRINUSE'), { code: 'EADDRINUSE' }));
    }
    host.sockets.set(options.port, { port: options.port, onMessage: options.onMessage });
    return Promise.resolve({
      port: options.port,
      send: (data, endpoint) => {
        this.sendDatagram(host, options.port, data, endpoint);
      },
      close: () => {
        host.sockets.delete(options.port);
      },
    });
  }

  private sendDatagram(host: SimHost, fromPort: number, data: Uint8Array, to: Endpoint): void {
    if (host.dead) return;
    const targets: SimHost[] = [];
    const isBroadcast =
      to.host === '255.255.255.255' ||
      host.interfaces.some((entry) => directedBroadcast(entry.address, entry.netmask) === to.host);
    if (isBroadcast) {
      for (const candidate of this.hosts.values()) {
        if (candidate === host || sameSubnet(host.address, candidate.address, host.netmask)) {
          targets.push(candidate);
        }
      }
    } else {
      const target = this.hosts.get(to.host);
      if (target !== undefined) targets.push(target);
    }
    const copy = data.slice();
    const from: Endpoint = { host: host.address, port: fromPort };
    for (const target of targets) {
      if (target !== host && this.isCut(host.address, target.address)) continue;
      if (this.datagramLoss > 0 && this.random.next() < this.datagramLoss) continue;
      this.clock.setTimeout(() => {
        if (this.hosts.get(target.address) !== target) return;
        target.sockets.get(to.port)?.onMessage(copy, from);
      }, this.sampleDelay());
    }
  }

  private dial(host: SimHost, endpoint: Endpoint, timeoutMs: number, callbacks: DialCallbacks): CancelTimer {
    if (host.dead) return () => undefined;
    let settled = false;
    const timers: CancelTimer[] = [];
    const settle = (run: () => void): void => {
      if (settled) return;
      settled = true;
      for (const cancel of timers) cancel();
      run();
    };
    timers.push(
      this.clock.setTimeout(() => {
        settle(() => {
          callbacks.onFail('timeout');
        });
      }, timeoutMs),
    );
    const target = this.hosts.get(endpoint.host);
    const oneWay = this.profile.latencyMs;
    if (target === undefined) {
      timers.push(
        this.clock.setTimeout(() => {
          settle(() => {
            callbacks.onFail('unreachable');
          });
        }, Math.min(3000, timeoutMs - 1)),
      );
    } else if (!this.isCut(host.address, target.address)) {
      timers.push(
        this.clock.setTimeout(() => {
          if (settled || this.isCut(host.address, target.address)) return;
          const listener = target.listeners.get(endpoint.port);
          if (listener === undefined || this.hosts.get(target.address) !== target) {
            this.clock.setTimeout(() => {
              settle(() => {
                callbacks.onFail('refused');
              });
            }, oneWay);
            return;
          }
          const localPort = host.nextEphemeral++;
          const outgoing = new SimConnection(this, host.address, endpoint, 'outgoing');
          const incoming = new SimConnection(this, target.address, { host: host.address, port: localPort }, 'incoming');
          outgoing.peer = incoming;
          incoming.peer = outgoing;
          outgoing.outgoing = this.createPipe(host.address, target.address);
          incoming.outgoing = this.createPipe(target.address, host.address);
          target.connections.add(incoming);
          listener.onConnection(incoming);
          this.clock.setTimeout(() => {
            if (settled) {
              outgoing.close(1001, 'cancelled');
              return;
            }
            host.connections.add(outgoing);
            settle(() => {
              callbacks.onOpen(outgoing);
            });
          }, oneWay);
        }, oneWay),
      );
    }
    return () => {
      settled = true;
      for (const cancel of timers) cancel();
    };
  }

  private createPipe(from: string, to: string): Pipe {
    const pipe = new Pipe(this, from, to);
    this.pipes.add(pipe);
    return pipe;
  }

  /** Clé lisible d'une extrémité, pour les messages des tests. */
  static describe(endpoint: Endpoint): string {
    return endpointKey(endpoint);
  }
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function hashText(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  }
  return hash >>> 0;
}

function toRawInterfaces(interfaces: readonly SimInterface[]): RawInterfaces {
  const raw: Record<string, { address: string; netmask: string; family: string; internal: boolean }[]> = {
    lo: [{ address: '127.0.0.1', netmask: '255.0.0.0', family: 'IPv4', internal: true }],
  };
  for (const entry of interfaces) {
    const list = raw[entry.name] ?? [];
    list.push({ address: entry.address, netmask: entry.netmask, family: 'IPv4', internal: false });
    raw[entry.name] = list;
  }
  return raw;
}
