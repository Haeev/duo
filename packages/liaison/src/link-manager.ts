import { endpointKey } from './addresses.ts';
import type { Endpoint } from './addresses.ts';
import type { CancelTimer, Clock } from './clock.ts';
import type { NetworkConfig } from './config.ts';
import { duoFingerprint } from './crypto.ts';
import { Emitter } from './emitter.ts';
import { runCalleeHandshake, runCallerHandshake } from './handshake.ts';
import type {
  CalleeDecision,
  CallerKeyDecision,
  HandshakeFailure,
  HandshakeResult,
  SelfIdentity,
} from './handshake.ts';
import { Link } from './link.ts';
import type { GamePayload, LinkHealth, PeerInfo, ReliableMessage } from './link.ts';
import type { FrozenEnvelope, Hello, RejectReason, Welcome } from './protocol.ts';
import { fromBase64Url, randomId, toBase64Url } from './random.ts';
import type { RandomSource } from './random.ts';
import type { LinkMemory, PairingRecord } from './store.ts';
import type { Connection, DialFailure, Dialer } from './transport.ts';

/** Politique de formation d'un duo avec une machine inconnue (ADR 0009, point 2: question ouverte). */
export type PairingPolicy = 'any' | 'first-partner-only';

/** Pourquoi une liaison s'est fermée pour de bon. */
export type LinkCloseReason = 'bye' | 'refused' | 'overflow' | 'stopped' | 'reset';

/** Résultat d'une connexion par adresse saisie (M-09, M-10, M-27). */
export type ManualConnectResult =
  | { readonly ok: true; readonly already: boolean }
  | {
      readonly ok: false;
      readonly failure: DialFailure | HandshakeFailure;
      readonly peer?: FrozenEnvelope;
    };

export interface LinkManagerEvents {
  established: { readonly link: Link; readonly resumed: boolean; readonly replaced: Link | null };
  health: { readonly link: Link; readonly health: LinkHealth };
  closed: { readonly link: Link; readonly reason: LinkCloseReason };
  message: { readonly link: Link; readonly message: ReliableMessage };
  game: { readonly link: Link; readonly channel: number; readonly payload: GamePayload };
  activity: { readonly link: Link };
  incompatible: { readonly peer: FrozenEnvelope };
}

export interface LinkManagerOptions {
  readonly config: NetworkConfig;
  readonly clock: Clock;
  readonly random: RandomSource;
  readonly dialer: Dialer;
  readonly self: () => SelfIdentity;
  readonly memory: () => LinkMemory;
  readonly remember: (update: (memory: LinkMemory) => LinkMemory) => void;
  readonly pairingPolicy: PairingPolicy;
  readonly log: (event: string, data?: Readonly<Record<string, unknown>>) => void;
}

interface Attempt {
  readonly id: number;
  readonly machine: string | null;
  /** Une connexion est ouverte et la poignée de main est en cours. */
  handshaking: boolean;
  readonly cancel: () => void;
}

interface Target {
  readonly machine: string | null;
  readonly endpoints: readonly Endpoint[];
  readonly staggerMs: number;
  readonly dialTimeoutMs: number;
  readonly onResult: (result: HandshakeResult<Link>, failures: readonly DialFailure[]) => void;
}

const FAILURE_RANK: Record<DialFailure, number> = { refused: 4, 'not-duo': 3, unreachable: 2, timeout: 1, error: 0 };

/**
 * Tient la liaison avec le partenaire: appels sur les adresses connues, poignées
 * de main entrantes, règle de l'appel croisé, reconnexion anticipée et relance
 * sans fin (reseau.md, sections 5.4, 6 et 8).
 */
export class LinkManager {
  readonly events: Emitter<LinkManagerEvents>;
  private readonly options: LinkManagerOptions;
  private linkValue: Link | null = null;
  private readonly attempts = new Map<number, Attempt>();
  private nextAttemptId = 1;
  private readonly lastDialAt = new Map<string, number>();
  private readonly quarantine = new Map<string, number>();
  private readonly candidates = new Map<string, Endpoint[]>();
  private reconnectTimer: CancelTimer | null = null;
  private reconnectStartedAt = 0;
  private readonly incoming = new Set<() => void>();
  private stopped = false;

  constructor(options: LinkManagerOptions) {
    this.options = options;
    this.events = new Emitter((error) => {
      options.log('erreur-ecouteur', { error: String(error) });
    });
  }

  get link(): Link | null {
    return this.linkValue;
  }

  /** Adresses candidates d'une machine (balises, réponses, adresses retenues). */
  setCandidates(machine: string, endpoints: readonly Endpoint[]): void {
    this.candidates.set(machine, dedupe(endpoints));
  }

  /** Une machine Duo a été vue sur le réseau: on l'appelle si rien ne nous relie encore. */
  noteSighting(machine: string, endpoints: readonly Endpoint[]): void {
    if (this.stopped) return;
    this.setCandidates(machine, [...endpoints, ...(this.candidates.get(machine) ?? [])]);
    const link = this.linkValue;
    if (link !== null) return;
    if (!this.mayPairOrKnows(machine)) return;
    // Une seule poignée de main à la fois: deux liaisons établies en parallèle se remplaceraient.
    if (this.attempts.size > 0 || this.incoming.size > 0) return;
    const now = this.options.clock.now();
    if (now - (this.lastDialAt.get(machine) ?? -Infinity) < this.options.config.dialCooldownMs) return;
    this.lastDialAt.set(machine, now);
    this.dialTarget({
      machine,
      endpoints: this.endpointsFor(machine),
      staggerMs: this.options.config.dialStaggerMs,
      dialTimeoutMs: this.options.config.dialTimeoutMs,
      onResult: () => undefined,
    });
  }

  /** Sonde une adresse retenue (sans savoir quelle machine y répond). */
  probe(endpoint: Endpoint): void {
    if (this.stopped || this.linkValue !== null) return;
    const key = `sonde:${endpointKey(endpoint)}`;
    const now = this.options.clock.now();
    if (now - (this.lastDialAt.get(key) ?? -Infinity) < this.options.config.dialCooldownMs) return;
    if (this.attempts.size > 0 || this.incoming.size > 0) return;
    this.lastDialAt.set(key, now);
    this.dialTarget({
      machine: null,
      endpoints: [endpoint],
      staggerMs: 0,
      dialTimeoutMs: this.options.config.dialTimeoutMs,
      onResult: () => undefined,
    });
  }

  /** Connexion par adresse saisie: les ports de Duo essayés ensemble. */
  connectManual(host: string): Promise<ManualConnectResult> {
    const link = this.linkValue;
    if (link?.health === 'connected') return Promise.resolve({ ok: true, already: true });
    const { basePort, tcpFallbacks, manualDialTimeoutMs } = this.options.config;
    const endpoints: Endpoint[] = [];
    for (let offset = 0; offset <= tcpFallbacks; offset += 1) endpoints.push({ host, port: basePort + offset });
    return new Promise((resolve) => {
      this.dialTarget({
        machine: null,
        endpoints,
        staggerMs: 0,
        dialTimeoutMs: manualDialTimeoutMs,
        onResult: (result, failures) => {
          if (result.ok) {
            resolve({ ok: true, already: false });
            return;
          }
          if (result.failure === 'closed' && failures.length > 0) {
            resolve({ ok: false, failure: worstFailure(failures) });
            return;
          }
          resolve(
            result.peer === undefined
              ? { ok: false, failure: result.failure }
              : { ok: false, failure: result.failure, peer: result.peer },
          );
        },
      });
    });
  }

  /** Une connexion entrante (déjà filtrée par le serveur) commence sa poignée de main. */
  handleIncoming(connection: Connection): void {
    if (this.stopped || this.incoming.size >= this.options.config.maxUnauthenticatedConnections) {
      connection.close(1013, 'busy');
      return;
    }
    const host = connection.remote.host;
    if ((this.quarantine.get(host) ?? -Infinity) > this.options.clock.now()) {
      connection.close(4004, 'quarantine');
      return;
    }
    let abort: () => void = () => undefined;
    abort = runCalleeHandshake({
      connection,
      clock: this.options.clock,
      config: this.options.config,
      random: this.options.random,
      self: this.options.self(),
      decide: (hello) => this.decideIncoming(hello),
      onIncompatible: (peer) => {
        this.events.emit('incompatible', { peer });
      },
      onDone: (result) => {
        this.incoming.delete(abort);
        if (!result.ok) {
          if (result.failure === 'bad-proof') this.quarantineHost(host);
          this.options.log('appel-entrant-refuse', { failure: result.failure });
          return;
        }
        const { hello, link: linkId, resumed, key, duo, newDuo } = result.value;
        if (newDuo) this.savePairing(duo, hello.machine, key);
        const peer = peerFromHello(hello);
        const resumeReceived = hello.resume?.received ?? 0;
        this.install(linkId, peer, resumed, connection, 'callee', resumeReceived, null);
      },
    });
    this.incoming.add(abort);
  }

  /**
   * Adieu reçu par UDP. Si la liaison vit encore, son propre `bye` fait foi; sinon
   * l'autre Duo s'est fermé pendant la coupure: présence retirée aussitôt.
   */
  peerQuit(machine: string): void {
    const link = this.linkValue;
    if (link?.peer.machine !== machine) return;
    if (link.hasConnection && link.health === 'connected') return;
    this.closeLink(link, 'bye');
  }

  /** Arrêt: `bye` sur la liaison, tentatives abandonnées. */
  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.stopReconnect();
    for (const attempt of [...this.attempts.values()]) attempt.cancel();
    for (const abort of [...this.incoming]) abort();
    const link = this.linkValue;
    if (link !== null) {
      this.linkValue = null;
      link.close('quit', true);
      this.events.emit('closed', { link, reason: 'stopped' });
    }
  }

  private mayPairOrKnows(machine: string): boolean {
    const pairings = this.options.memory().pairings;
    if (pairings.some((pairing) => pairing.partner === machine)) return true;
    return this.options.pairingPolicy === 'any' || pairings.length === 0;
  }

  private attemptFor(machine: string): Attempt | undefined {
    for (const attempt of this.attempts.values()) {
      if (attempt.machine === machine) return attempt;
    }
    return undefined;
  }

  private endpointsFor(machine: string): Endpoint[] {
    const link = this.linkValue;
    const fromLink = link !== null && link.peer.machine === machine && link.endpoint !== null ? [link.endpoint] : [];
    const retained = this.options
      .memory()
      .addresses.filter((address) => address.partner === machine)
      .map((address) => ({ host: address.host, port: address.port }));
    return dedupe([...fromLink, ...(this.candidates.get(machine) ?? []), ...retained]);
  }

  private quarantineHost(host: string): void {
    this.quarantine.set(host, this.options.clock.now() + this.options.config.badProofQuarantineMs);
  }

  private savePairing(duo: string, partner: string, key: Uint8Array): void {
    const record: PairingRecord = {
      duo,
      partner,
      key: toBase64Url(key),
      createdAt: new Date().toISOString(),
    };
    this.options.remember((memory) => ({
      ...memory,
      pairings: [record, ...memory.pairings.filter((entry) => entry.duo !== duo)].slice(0, 16),
    }));
    this.options.log('duo-forme', { duo: duo.slice(0, 8) });
  }

  private knownKey(machine: string, fingerprints: readonly string[]): { key: Uint8Array; duo: string } | null {
    for (const pairing of this.options.memory().pairings) {
      if (pairing.partner === machine && fingerprints.includes(duoFingerprint(pairing.duo))) {
        return { key: fromBase64Url(pairing.key), duo: pairing.duo };
      }
    }
    return null;
  }

  /** Règles de l'appelé: soi-même, occupé, appel croisé, reprise, clé (reseau.md, sections 5.4 et 8.3). */
  private decideIncoming(hello: Hello): CalleeDecision {
    const self = this.options.self();
    const link = this.linkValue;
    if (link !== null && link.peer.machine !== hello.machine) {
      return { kind: 'reject', reason: 'busy' };
    }
    const ours = this.attemptFor(hello.machine);
    if (ours !== undefined) {
      if (ours.handshaking && self.machine < hello.machine) {
        // Appel croisé: on garde l'appel de la machine au plus petit identifiant, le nôtre.
        return { kind: 'reject', reason: 'duplicate' };
      }
      ours.cancel();
    }
    const sameInstance = link?.peer.instance === hello.instance;
    const sameSession = sameInstance && hello.resume?.link === link.id;
    if (
      sameInstance &&
      hello.resume === undefined &&
      link.connectionRole === 'caller' &&
      link.health === 'connected' &&
      self.machine < hello.machine
    ) {
      // Appel croisé arrivé après coup: notre liaison, établie par l'appelant au plus petit identifiant, reste.
      return { kind: 'reject', reason: 'duplicate' };
    }
    const known = this.knownKey(hello.machine, hello.duos);
    let key: Extract<CalleeDecision, { kind: 'accept' }>['key'];
    if (known !== null) {
      key = { kind: 'existing', key: known.key, duo: known.duo };
    } else if (this.mayPairOrKnows(hello.machine)) {
      key = { kind: 'new-duo', duo: randomId(this.options.random) };
    } else {
      return { kind: 'reject', reason: 'not-paired' };
    }
    if (sameSession) {
      return { kind: 'accept', link: link.id, resumed: true, received: link.received, key };
    }
    return { kind: 'accept', link: randomId(this.options.random), resumed: false, received: 0, key };
  }

  private decideKeyAsCaller(welcome: Welcome): CallerKeyDecision {
    const known = this.knownKey(welcome.machine, welcome.duos);
    if (welcome.pairing === undefined) {
      return known === null ? { kind: 'refuse', reason: 'not-paired' } : { kind: 'existing', ...known };
    }
    if (known !== null || this.mayPairOrKnows(welcome.machine)) return { kind: 'new-duo-allowed' };
    return { kind: 'refuse', reason: 'not-paired' };
  }

  /** Appelle une cible: une tentative par adresse, décalées; la première connexion ouverte l'emporte. */
  private dialTarget(target: Target): void {
    const id = this.nextAttemptId++;
    const { clock } = this.options;
    const cancels: CancelTimer[] = [];
    const failures: DialFailure[] = [];
    let opened = false;
    let finished = false;
    let abortHandshake: () => void = () => undefined;

    const finish = (result: HandshakeResult<Link>): void => {
      if (finished) return;
      finished = true;
      this.attempts.delete(id);
      for (const cancel of cancels) cancel();
      target.onResult(result, failures);
    };

    const attempt: Attempt = {
      id,
      machine: target.machine,
      handshaking: false,
      cancel: () => {
        abortHandshake();
        finish({ ok: false, failure: 'closed' });
      },
    };
    this.attempts.set(id, attempt);

    if (target.endpoints.length === 0) {
      finish({ ok: false, failure: 'timeout' });
      return;
    }

    target.endpoints.forEach((endpoint, index) => {
      cancels.push(
        clock.setTimeout(() => {
          if (opened || finished) return;
          cancels.push(
            this.options.dialer.dial(endpoint, target.dialTimeoutMs, {
              onFail: (failure) => {
                failures.push(failure);
                if (!opened && failures.length === target.endpoints.length) {
                  finish({ ok: false, failure: 'closed' });
                }
              },
              onOpen: (connection) => {
                if (opened || finished || this.stopped) {
                  connection.close(1000, 'unneeded');
                  return;
                }
                opened = true;
                attempt.handshaking = true;
                this.runOutgoing(connection, endpoint, (result) => {
                  finish(result);
                }, (abort) => {
                  abortHandshake = abort;
                });
              },
            }),
          );
        }, index * target.staggerMs),
      );
    });
  }

  private runOutgoing(
    connection: Connection,
    endpoint: Endpoint,
    onResult: (result: HandshakeResult<Link>) => void,
    setAbort: (abort: () => void) => void,
  ): void {
    const current = this.linkValue;
    const resume =
      current === null || current.closed ? undefined : { link: current.id, received: current.received };
    const abort = runCallerHandshake({
      connection,
      clock: this.options.clock,
      config: this.options.config,
      random: this.options.random,
      self: this.options.self(),
      ...(resume === undefined ? {} : { resume }),
      decideKey: (welcome) => this.decideKeyAsCaller(welcome),
      onDone: (result) => {
        if (!result.ok) {
          if (result.failure === 'bad-proof') this.quarantineHost(endpoint.host);
          if (result.failure === 'protocol' && result.peer !== undefined) {
            this.events.emit('incompatible', { peer: result.peer });
          }
          this.options.log('appel-sortant-echoue', { failure: result.failure });
          onResult(result);
          return;
        }
        if (this.stopped) {
          connection.close(1001, 'stopped');
          onResult({ ok: false, failure: 'closed' });
          return;
        }
        const { welcome, key, duo, newDuo } = result.value;
        if (newDuo) this.savePairing(duo, welcome.machine, key);
        this.options.remember((memory) => ({
          ...memory,
          addresses: [
            {
              host: endpoint.host,
              port: endpoint.port,
              partner: welcome.machine,
              lastSuccessAt: new Date().toISOString(),
            },
            ...memory.addresses.filter(
              (entry) => !(entry.host === endpoint.host && entry.port === endpoint.port),
            ),
          ].slice(0, 8),
        }));
        const link = this.install(
          welcome.link,
          peerFromWelcome(welcome),
          welcome.resumed,
          connection,
          'caller',
          welcome.received,
          endpoint,
        );
        onResult({ ok: true, value: link });
      },
    });
    setAbort(abort);
  }

  /** Établissement ou reprise: la liaison prend la nouvelle connexion. */
  private install(
    linkId: string,
    peer: PeerInfo,
    resumed: boolean,
    connection: Connection,
    role: 'caller' | 'callee',
    peerReceived: number,
    endpoint: Endpoint | null,
  ): Link {
    const current = this.linkValue;
    if (resumed && current?.id === linkId && !current.closed) {
      current.peer = peer;
      current.attach(connection, role, peerReceived, endpoint);
      this.stopReconnect();
      this.options.log('liaison-reprise', { link: linkId, role });
      this.events.emit('established', { link: current, resumed: true, replaced: null });
      return current;
    }
    let replaced: Link | null = null;
    if (current !== null) {
      replaced = current;
      this.linkValue = null;
      current.close('reset', false);
      this.events.emit('closed', { link: current, reason: 'reset' });
    }
    this.stopReconnect();
    const link = this.createLink(linkId, peer);
    this.linkValue = link;
    link.attach(connection, role, peerReceived, endpoint);
    this.options.log('liaison-etablie', { link: linkId, role });
    this.events.emit('established', { link, resumed: false, replaced });
    return link;
  }

  private createLink(id: string, peer: PeerInfo): Link {
    const link: Link = new Link({
      id,
      peer,
      config: this.options.config,
      clock: this.options.clock,
      callbacks: {
        onMessage: (message) => {
          this.events.emit('message', { link, message });
        },
        onGame: (channel, payload) => {
          this.events.emit('game', { link, channel, payload });
        },
        onHealth: (health) => {
          this.events.emit('health', { link, health });
        },
        onConnectionTrouble: (kind) => {
          this.onTrouble(link, kind);
        },
        onBye: (reason) => {
          this.closeLink(link, reason === 'quit' ? 'bye' : 'reset');
        },
        onOverflow: () => {
          this.closeLink(link, 'overflow');
        },
        onActivityChange: () => {
          this.events.emit('activity', { link });
        },
        log: this.options.log,
      },
    });
    return link;
  }

  private closeLink(link: Link, reason: LinkCloseReason): void {
    if (this.linkValue !== link) return;
    this.linkValue = null;
    this.stopReconnect();
    link.close(reason === 'bye' ? 'quit' : 'reset', false);
    this.options.log('liaison-fermee', { link: link.id, reason });
    this.events.emit('closed', { link, reason });
  }

  private onTrouble(link: Link, kind: 'closed' | 'silent'): void {
    if (this.stopped || this.linkValue !== link) return;
    this.options.log('liaison-trouble', { link: link.id, kind });
    if (this.reconnectTimer !== null) return;
    const delay = link.connectionRole === 'caller' ? 0 : this.options.config.calleeRedialDelayMs;
    this.reconnectStartedAt = this.options.clock.now();
    this.reconnectTimer = this.options.clock.setTimeout(() => {
      this.reconnectTick(link);
    }, delay);
  }

  /** Relance: toutes les 250 ms pendant 10 s, puis chaque seconde, sans fin (reseau.md, section 8.2). */
  private reconnectTick(link: Link): void {
    this.reconnectTimer = null;
    if (this.stopped || this.linkValue !== link || link.closed) return;
    const { config, clock } = this.options;
    const healthy = link.hasConnection && link.silenceMs() < config.earlyReconnectMs;
    if (healthy) return;
    const machine = link.peer.machine;
    if (this.attemptFor(machine) === undefined) {
      this.dialTarget({
        machine,
        endpoints: this.endpointsFor(machine),
        staggerMs: config.dialStaggerMs,
        dialTimeoutMs: config.dialTimeoutMs,
        onResult: (result, failures) => {
          if (result.ok || this.linkValue !== link) return;
          const refused = failures.length > 0 && failures.every((failure) => failure === 'refused');
          if (refused && !link.isActive() && !link.hasConnection) {
            // Au repos, un refus net veut dire que Duo est fermé de l'autre côté: présence retirée aussitôt.
            this.closeLink(link, 'refused');
          }
        },
      });
    }
    const elapsed = clock.now() - this.reconnectStartedAt;
    const period = elapsed < config.redialFastDurationMs ? config.redialFastMs : config.redialSlowMs;
    this.reconnectTimer = clock.setTimeout(() => {
      this.reconnectTick(link);
    }, period);
  }

  private stopReconnect(): void {
    if (this.reconnectTimer !== null) {
      this.reconnectTimer();
      this.reconnectTimer = null;
    }
  }
}

function dedupe(endpoints: readonly Endpoint[]): Endpoint[] {
  const seen = new Set<string>();
  const out: Endpoint[] = [];
  for (const endpoint of endpoints) {
    const key = endpointKey(endpoint);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(endpoint);
  }
  return out;
}

function worstFailure(failures: readonly DialFailure[]): DialFailure {
  let best: DialFailure = 'timeout';
  for (const failure of failures) {
    if (FAILURE_RANK[failure] > FAILURE_RANK[best]) best = failure;
  }
  return best;
}

function optionalFields(source: Hello | Welcome): Partial<PeerInfo> {
  const fields: {
    bridge?: readonly string[];
    electron?: string;
    dataFormat?: number;
    os?: string;
    arch?: string;
  } = {};
  if (source.bridge !== undefined) fields.bridge = source.bridge;
  if (source.electron !== undefined) fields.electron = source.electron;
  if (source.dataFormat !== undefined) fields.dataFormat = source.dataFormat;
  if (source.os !== undefined) fields.os = source.os;
  if (source.arch !== undefined) fields.arch = source.arch;
  return fields;
}

function peerFromHello(hello: Hello): PeerInfo {
  return {
    machine: hello.machine,
    instance: hello.instance,
    appVersion: hello.appVersion,
    protocol: hello.protocol,
    pseudo: hello.profile.pseudo,
    color: hello.profile.color,
    computer: hello.computer,
    games: hello.games,
    ...optionalFields(hello),
  };
}

function peerFromWelcome(welcome: Welcome): PeerInfo {
  return {
    machine: welcome.machine,
    instance: welcome.instance,
    appVersion: welcome.appVersion,
    protocol: welcome.protocol,
    pseudo: welcome.profile.pseudo,
    color: welcome.profile.color,
    computer: welcome.computer,
    games: welcome.games,
    ...optionalFields(welcome),
  };
}

export type { RejectReason };
