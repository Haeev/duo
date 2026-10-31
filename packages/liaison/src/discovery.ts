import * as v from 'valibot';
import { isAcceptedSource, selectInterfaces } from './addresses.ts';
import type { Endpoint, RawInterfaces, RetainedInterface } from './addresses.ts';
import { every } from './clock.ts';
import type { CancelTimer, Clock } from './clock.ts';
import type { NetworkConfig } from './config.ts';
import { Emitter } from './emitter.ts';
import { DatagramSchema, FrozenEnvelopeSchema, parseJson } from './protocol.ts';
import type { Datagram, DatagramType, FrozenEnvelope } from './protocol.ts';
import { randomInt } from './random.ts';
import type { RandomSource } from './random.ts';
import type { DatagramSocket } from './transport.ts';

/** Ce que chaque Duo annonce de lui-même (reseau.md, section 5.2). */
export interface AnnounceContent {
  readonly machine: string;
  readonly appVersion: string;
  readonly instance: string;
  /** Port TCP réellement ouvert, 0 si l'écoute a échoué. */
  readonly port: number;
  readonly pseudo: string;
  readonly color: string;
  readonly computer: string;
  readonly setup: 'done' | 'in-progress';
  readonly duos: readonly string[];
}

/** Une machine Duo vue sur le réseau par ses balises ou ses réponses. */
export interface Sighting {
  readonly machine: string;
  readonly instance: string;
  readonly appVersion: string;
  readonly protocol: number;
  readonly pseudo: string;
  readonly color: string;
  readonly computer: string;
  readonly setup: 'done' | 'in-progress';
  readonly duos: readonly string[];
  /** Source du dernier datagramme. */
  readonly from: Endpoint;
  /** Adresses TCP à essayer, la source d'abord. */
  readonly endpoints: readonly Endpoint[];
  readonly lastSeenAt: number;
}

export interface DiscoveryEvents {
  sighting: Sighting;
  incompatible: { readonly peer: FrozenEnvelope; readonly from: Endpoint };
  bye: { readonly machine: string };
  expired: { readonly machine: string };
  interfaces: readonly RetainedInterface[];
}

export interface DiscoveryOptions {
  readonly config: NetworkConfig;
  readonly clock: Clock;
  readonly random: RandomSource;
  readonly interfaces: () => RawInterfaces;
  readonly content: () => AnnounceContent;
  /** Destinations directes en plus des diffusions (`--duo-peer`, boucle locale). */
  readonly extraDestinations: readonly Endpoint[];
  /** Port UDP visé par les diffusions (celui de tous les Duo du réseau). */
  readonly broadcastPort: number;
  readonly allowLoopback: boolean;
  readonly isLinked: () => boolean;
  readonly log: (event: string, data?: Readonly<Record<string, unknown>>) => void;
}

interface RateWindow {
  start: number;
  count: number;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Découverte par diffusion UDP dirigée sur chaque interface privée, requêtes à
 * réponse directe et balises périodiques (ADR 0008). Une balise ne montre jamais
 * personne: elle déclenche seulement une tentative de liaison.
 */
export class Discovery {
  readonly events: Emitter<DiscoveryEvents>;
  private readonly options: DiscoveryOptions;
  private socket: DatagramSocket | null = null;
  private seq = 0;
  private readonly sightings = new Map<string, Sighting>();
  private retainedValue: RetainedInterface[] = [];
  private readonly timers: CancelTimer[] = [];
  private queryTimers: CancelTimer[] = [];
  private readonly perSource = new Map<string, RateWindow>();
  private total: RateWindow = { start: 0, count: 0 };
  private droppedValue = 0;
  private running = false;

  constructor(options: DiscoveryOptions) {
    this.options = options;
    this.events = new Emitter((error) => {
      options.log('erreur-ecouteur', { error: String(error) });
    });
  }

  get retainedInterfaces(): readonly RetainedInterface[] {
    return this.retainedValue;
  }

  /** Datagrammes jetés (format, débit), pour le diagnostic. */
  get dropped(): number {
    return this.droppedValue;
  }

  seen(): Sighting[] {
    return [...this.sightings.values()];
  }

  start(socket: DatagramSocket): void {
    if (this.running) return;
    this.running = true;
    this.socket = socket;
    const { config, clock, random } = this.options;
    this.refreshInterfaces(false);
    this.sendAll('announce');
    this.timers.push(
      every(
        clock,
        () => config.beaconIntervalMs + randomInt(random, -config.beaconJitterMs, config.beaconJitterMs),
        () => {
          this.sendAll('announce');
        },
      ),
    );
    this.timers.push(
      every(
        clock,
        () => (this.options.isLinked() ? config.interfacesRefreshMs : config.interfacesRefreshUnlinkedMs),
        () => {
          this.refreshInterfaces(true);
        },
      ),
    );
    this.timers.push(
      every(
        clock,
        () => config.queryRepeatMs,
        () => {
          if (!this.options.isLinked()) this.sendAll('query');
        },
      ),
    );
    this.timers.push(
      every(
        clock,
        () => 1000,
        () => {
          this.expire();
        },
      ),
    );
    this.queryBurst();
  }

  /** Série de requêtes (démarrage, changement d'interface, ouverture de E04 ou E17). */
  queryBurst(): void {
    if (!this.running) return;
    for (const cancel of this.queryTimers) cancel();
    this.queryTimers = this.options.config.querySchedule.map((delay) =>
      this.options.clock.setTimeout(() => {
        this.sendAll('query');
      }, delay),
    );
  }

  /** Arrêt; `bye` trois fois à 50 ms d'écart si demandé (fermeture propre de Duo). */
  stop(sendBye: boolean): Promise<void> {
    if (!this.running) return Promise.resolve();
    this.running = false;
    for (const cancel of [...this.timers, ...this.queryTimers]) cancel();
    this.timers.length = 0;
    this.queryTimers = [];
    const socket = this.socket;
    if (!sendBye || socket === null) {
      socket?.close();
      this.socket = null;
      return Promise.resolve();
    }
    const { byeRepeat, byeSpacingMs } = this.options.config;
    return new Promise((resolve) => {
      let sent = 0;
      const sendOne = (): void => {
        this.sendAll('bye', socket);
        sent += 1;
        if (sent >= byeRepeat) {
          socket.close();
          this.socket = null;
          resolve();
          return;
        }
        this.options.clock.setTimeout(sendOne, byeSpacingMs);
      };
      sendOne();
    });
  }

  /** Un datagramme reçu sur la socket UDP. */
  handleDatagram(data: Uint8Array, from: Endpoint): void {
    if (!this.running) return;
    const { config, clock } = this.options;
    if (!isAcceptedSource(from.host, this.options.allowLoopback)) {
      this.droppedValue += 1;
      return;
    }
    if (data.byteLength > config.datagramMaxBytes || !this.withinRate(from.host)) {
      this.droppedValue += 1;
      return;
    }
    const json = parseJson(decoder.decode(data));
    const envelope = v.safeParse(FrozenEnvelopeSchema, json);
    if (!envelope.success) {
      // Autre application ou datagramme forgé: ignoré sans bruit (CA-PF-021).
      this.droppedValue += 1;
      return;
    }
    const content = this.options.content();
    if (envelope.output.machine === content.machine) return;
    if (envelope.output.protocol !== config.protocol) {
      this.events.emit('incompatible', { peer: envelope.output, from });
      return;
    }
    const parsed = v.safeParse(DatagramSchema, json);
    if (!parsed.success) {
      this.droppedValue += 1;
      return;
    }
    const datagram = parsed.output;
    if (datagram.type === 'bye') {
      this.sightings.delete(datagram.machine);
      this.events.emit('bye', { machine: datagram.machine });
      return;
    }
    if (datagram.type === 'query') {
      const delay = randomInt(this.options.random, 0, config.queryReplyMaxDelayMs);
      clock.setTimeout(() => {
        if (this.running) this.sendTo('announce', from);
      }, delay);
    }
    const sighting = this.toSighting(datagram, from);
    this.sightings.set(datagram.machine, sighting);
    this.events.emit('sighting', sighting);
  }

  private toSighting(datagram: Datagram, from: Endpoint): Sighting {
    const endpoints: Endpoint[] = [];
    if (datagram.port > 0) {
      endpoints.push({ host: from.host, port: datagram.port });
      for (const address of datagram.addresses) {
        if (address.ip === from.host) continue;
        if (!isAcceptedSource(address.ip, this.options.allowLoopback)) continue;
        endpoints.push({ host: address.ip, port: datagram.port });
      }
    }
    return {
      machine: datagram.machine,
      instance: datagram.instance,
      appVersion: datagram.appVersion,
      protocol: datagram.protocol,
      pseudo: datagram.pseudo,
      color: datagram.color,
      computer: datagram.computer,
      setup: datagram.setup,
      duos: datagram.duos,
      from,
      endpoints,
      lastSeenAt: this.options.clock.now(),
    };
  }

  private withinRate(source: string): boolean {
    const now = this.options.clock.now();
    const { datagramsPerSecondPerSource, datagramsPerSecondTotal } = this.options.config;
    if (now - this.total.start >= 1000) this.total = { start: now, count: 0 };
    let window = this.perSource.get(source);
    if (window === undefined || now - window.start >= 1000) {
      window = { start: now, count: 0 };
      this.perSource.set(source, window);
    }
    window.count += 1;
    this.total.count += 1;
    if (this.perSource.size > 256) this.perSource.clear();
    return window.count <= datagramsPerSecondPerSource && this.total.count <= datagramsPerSecondTotal;
  }

  private expire(): void {
    const now = this.options.clock.now();
    for (const [machine, sighting] of this.sightings) {
      if (now - sighting.lastSeenAt > this.options.config.sightingExpiryMs) {
        this.sightings.delete(machine);
        this.events.emit('expired', { machine });
      }
    }
  }

  private refreshInterfaces(notify: boolean): void {
    const next = selectInterfaces(this.options.interfaces());
    const signature = (list: readonly RetainedInterface[]): string =>
      list.map((entry) => `${entry.name}/${entry.address}/${entry.netmask}`).join(',');
    const changed = signature(next) !== signature(this.retainedValue);
    this.retainedValue = next;
    if (changed && notify) {
      this.options.log('interfaces-changees', { count: next.length });
      this.events.emit('interfaces', next);
      this.queryBurst();
    }
  }

  private destinations(): Endpoint[] {
    const out: Endpoint[] = [];
    const seen = new Set<string>();
    for (const entry of this.retainedValue) {
      if (seen.has(entry.broadcast)) continue;
      seen.add(entry.broadcast);
      out.push({ host: entry.broadcast, port: this.options.broadcastPort });
    }
    return [...out, ...this.options.extraDestinations];
  }

  private encode(type: DatagramType): Uint8Array {
    const content = this.options.content();
    this.seq = (this.seq + 1) % 0xffff_ffff;
    const datagram: Datagram = {
      app: 'duo',
      envelope: 1,
      type,
      machine: content.machine,
      appVersion: content.appVersion,
      protocol: this.options.config.protocol,
      instance: content.instance,
      seq: this.seq,
      port: content.port,
      pseudo: content.pseudo.slice(0, 32),
      color: content.color.slice(0, 16),
      computer: content.computer.slice(0, 32),
      setup: content.setup,
      duos: content.duos.slice(0, 8),
      addresses: this.retainedValue.slice(0, 8).map((entry) => ({ ip: entry.address, prefix: entry.prefix })),
    };
    return encoder.encode(JSON.stringify(datagram));
  }

  private sendAll(type: DatagramType, socket: DatagramSocket | null = this.socket): void {
    if (socket === null) return;
    const data = this.encode(type);
    for (const destination of this.destinations()) socket.send(data, destination);
  }

  private sendTo(type: DatagramType, destination: Endpoint): void {
    this.socket?.send(this.encode(type), destination);
  }
}
