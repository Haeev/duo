import * as v from 'valibot';
import { parseEndpoint, parseManualAddress } from './addresses.ts';
import type { Endpoint, RetainedInterface } from './addresses.ts';
import type { CancelTimer } from './clock.ts';
import { every } from './clock.ts';
import { createConfig } from './config.ts';
import type { NetworkConfig } from './config.ts';
import { duoFingerprint } from './crypto.ts';
import { Discovery } from './discovery.ts';
import type { Sighting } from './discovery.ts';
import { Emitter } from './emitter.ts';
import type { Unsubscribe } from './emitter.ts';
import type { SelfIdentity } from './handshake.ts';
import type { ChannelMode, GamePayload, LinkHealth, LinkQuality, PeerInfo } from './link.ts';
import { LinkManager } from './link-manager.ts';
import type { ManualConnectResult, PairingPolicy } from './link-manager.ts';
import { createNodeDriver } from './node-driver.ts';
import { GamesUpdateSchema, ProfileUpdateSchema } from './protocol.ts';
import type { FrozenEnvelope, InstalledGame } from './protocol.ts';
import { randomId } from './random.ts';
import { SessionController } from './session.ts';
import type {
  ActionResult,
  LobbyGame,
  MatchEndReason,
  SendResult,
  SessionNotice,
  SessionView,
} from './session.ts';
import { EMPTY_MEMORY, createMemoryStore } from './store.ts';
import type { LinkMemory, LinkStore } from './store.ts';
import type { DatagramSocket, NetworkDriver, StreamServer } from './transport.ts';

/** Identité de cette machine, fournie par le principal (`machine.json`, ADR 0009). */
export interface LiaisonIdentity {
  /** Identifiant stable de la machine (8 à 64 caractères: lettres, chiffres, tirets). */
  readonly machine: string;
  /** Version de Duo (SemVer). */
  readonly appVersion: string;
  /** Nom de l'ordinateur, tronqué à 32 caractères (E04). Jamais écrit dans le journal. */
  readonly computer: string;
  /** Tiré à chaque démarrage si absent: distingue une reprise d'un redémarrage. */
  readonly instance?: string;
  readonly bridge?: readonly string[];
  readonly electron?: string;
  readonly dataFormat?: number;
  readonly os?: string;
  readonly arch?: string;
}

export interface LiaisonProfile {
  readonly pseudo: string;
  readonly color: string;
}

/** Journal du module (ADR 0015): événements courts, sans pseudo, nom d'ordinateur ni adresse matérielle. */
export type LiaisonLogger = (event: string, data?: Readonly<Record<string, unknown>>) => void;

export interface LiaisonOptions {
  readonly identity: LiaisonIdentity;
  readonly profile: LiaisonProfile;
  readonly games?: readonly InstalledGame[];
  readonly setup?: 'done' | 'in-progress';
  /** Clés des duos et adresses retenues (`createFileStore(<userData>/reseau.json)` en production). */
  readonly store?: LinkStore;
  /** Port UDP et TCP de base (`--duo-port`). */
  readonly port?: number;
  /** Destinations directes en plus des diffusions (`--duo-peer=<adresse>:<port>`, répétable). */
  readonly peers?: readonly (Endpoint | string)[];
  /** Sources 127.0.0.0/8 admises (`--duo-allow-loopback`). */
  readonly allowLoopback?: boolean;
  readonly listenHost?: string;
  /** Formation d'un duo avec une machine inconnue; `any` par défaut pour le prototype. */
  readonly pairingPolicy?: PairingPolicy;
  readonly config?: Partial<NetworkConfig>;
  /** Pilote réseau injecté (réseau simulé des tests); Node par défaut. */
  readonly driver?: NetworkDriver;
  readonly log?: LiaisonLogger;
}

/** L'autre machine du duo, telle que la liaison la connaît. */
export type PartnerInfo = PeerInfo;

/**
 * Présence du partenaire (M-30). `present` dès que la liaison est authentifiée;
 * `link` dit si elle tient (`connected`), se rattrape (`unstable`) ou est perdue
 * en salon ou en partie (`lost`). Au repos, une liaison perdue vaut `absent`.
 */
export type PartnerState =
  | { readonly kind: 'absent' }
  | { readonly kind: 'present'; readonly partner: PartnerInfo; readonly link: LinkHealth };

/** Un Duo de protocole différent: la machine à mettre à jour est la plus ancienne (M-27, ADR 0006). */
export interface IncompatibleInfo {
  readonly machine: string;
  readonly appVersion: string;
  readonly protocol: number;
  readonly update: 'self' | 'peer' | 'both';
}

export interface StartReport {
  /** Port TCP obtenu, ou `null` si aucune écoute n'a pu s'ouvrir. */
  readonly tcpPort: number | null;
  /** Port UDP obtenu; un port éphémère si le port de base était pris (on voit sans être vu). */
  readonly udpPort: number | null;
  readonly problems: readonly string[];
}

export type ConnectResult =
  | ManualConnectResult
  | { readonly ok: false; readonly failure: 'invalid-address' }
  | { readonly ok: false; readonly failure: 'not-started' };

export interface LiaisonEvents {
  partner: PartnerState;
  session: SessionView;
  game: { readonly channel: number; readonly payload: GamePayload };
  notice: SessionNotice;
  incompatible: IncompatibleInfo;
  /** Autres ordinateurs avec Duo vus sur le réseau, hors partenaire relié (Réglages > Réseau). */
  others: readonly Sighting[];
  interfaces: readonly RetainedInterface[];
}

export interface LobbyApi {
  /** Ouvre son salon (devient l'hôte) ou change de jeu s'il est déjà ouvert. */
  open(game: LobbyGame): ActionResult;
  select(game: LobbyGame): ActionResult;
  /** Rejoint le salon de l'autre; vaut « C'est parti ». */
  join(): ActionResult;
  setReady(ready: boolean): ActionResult;
  /** Quitte (invité) ou ferme (hôte) le salon. */
  leave(): ActionResult;
}

export interface MatchApi {
  /** Le jeu de cette machine a chargé; le départ est fixé quand les deux l'ont dit. */
  reportLoaded(): ActionResult;
  pause(): ActionResult;
  resume(): ActionResult;
  /** Hôte seulement: fin de partie avec le résultat de son jeu. */
  end(result: unknown, reason?: MatchEndReason): ActionResult;
  /** Message du jeu vers l'autre machine (canal de 0 à 15, JSON ou `Uint8Array`, 64 Kio au plus). */
  send(channel: number, payload: GamePayload, mode: ChannelMode): SendResult;
}

export interface Liaison {
  start(): Promise<StartReport>;
  /** Fermeture propre: `bye` sur la liaison et trois adieux UDP (CA-PF-009). */
  stop(): Promise<void>;
  on<K extends keyof LiaisonEvents>(
    event: K,
    listener: (payload: LiaisonEvents[K]) => void,
  ): Unsubscribe;
  partner(): PartnerState;
  session(): SessionView;
  quality(): LinkQuality | null;
  /** Heure de session (horloge de l'hôte), en millisecondes. */
  sessionTime(): number;
  /** Horloge locale du module (`performance.now()` en production). */
  now(): number;
  interfaces(): readonly RetainedInterface[];
  others(): readonly Sighting[];
  /** Connexion par adresse saisie (recours, M-09 et M-10): les trois ports, 5 s au plus. */
  connectTo(address: string): Promise<ConnectResult>;
  /** Série de requêtes immédiate (ouverture de E04 ou E17). */
  searchNow(): void;
  updateProfile(profile: LiaisonProfile): void;
  updateGames(games: readonly InstalledGame[]): void;
  readonly lobby: LobbyApi;
  readonly match: MatchApi;
}

function compareSemver(a: string, b: string): number {
  const parse = (text: string): number[] =>
    (text.split(/[-+]/)[0] ?? '').split('.').map((part) => Number.parseInt(part, 10) || 0);
  const left = parse(a);
  const right = parse(b);
  for (let index = 0; index < 3; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

/** Crée le réseau de Duo pour le processus principal. Rien n'écoute avant `start()` (CA-PF-079). */
export function createLiaison(options: LiaisonOptions): Liaison {
  const config = createConfig({
    ...options.config,
    ...(options.port === undefined ? {} : { basePort: options.port }),
  });
  const allowLoopback = options.allowLoopback ?? false;
  const driver =
    options.driver ??
    createNodeDriver({
      config,
      allowLoopback,
      ...(options.listenHost === undefined ? {} : { listenHost: options.listenHost }),
    });
  const log: LiaisonLogger = options.log ?? (() => undefined);
  const store = options.store ?? createMemoryStore();
  const instance = options.identity.instance ?? randomId(driver.random);
  const peers: Endpoint[] = [];
  for (const peer of options.peers ?? []) {
    const endpoint = typeof peer === 'string' ? parseEndpoint(peer) : peer;
    if (endpoint === null) log('pair-ignore', { raison: 'format' });
    else peers.push(endpoint);
  }

  let profile = options.profile;
  let games = options.games ?? [];
  let memory: LinkMemory = EMPTY_MEMORY;
  let tcpPort = 0;
  let server: StreamServer | null = null;
  let socket: DatagramSocket | null = null;
  let started = false;
  const timers: CancelTimer[] = [];
  const events = new Emitter<LiaisonEvents>((error) => {
    log('erreur-ecouteur', { error: String(error) });
  });

  const duos = (): string[] => memory.pairings.map((pairing) => duoFingerprint(pairing.duo));
  const self = (): SelfIdentity => {
    const identity = options.identity;
    return {
      machine: identity.machine,
      appVersion: identity.appVersion,
      instance,
      pseudo: profile.pseudo.slice(0, 32),
      color: profile.color.slice(0, 16),
      computer: identity.computer.slice(0, 32),
      games,
      duos: duos(),
      ...(identity.bridge === undefined ? {} : { bridge: identity.bridge }),
      ...(identity.electron === undefined ? {} : { electron: identity.electron }),
      ...(identity.dataFormat === undefined ? {} : { dataFormat: identity.dataFormat }),
      ...(identity.os === undefined ? {} : { os: identity.os }),
      ...(identity.arch === undefined ? {} : { arch: identity.arch }),
    };
  };

  const links = new LinkManager({
    config,
    clock: driver.clock,
    random: driver.random,
    dialer: driver.dialer,
    self,
    memory: () => memory,
    remember: (update) => {
      memory = update(memory);
      store.save(memory).catch((error: unknown) => {
        log('memoire-non-ecrite', { error: String(error) });
      });
    },
    pairingPolicy: options.pairingPolicy ?? 'any',
    log,
  });

  const session = new SessionController({
    config,
    clock: driver.clock,
    random: driver.random,
    selfMachine: () => options.identity.machine,
    links,
    log,
  });

  const discovery = new Discovery({
    config,
    clock: driver.clock,
    random: driver.random,
    interfaces: () => driver.interfaces(),
    content: () => ({
      machine: options.identity.machine,
      appVersion: options.identity.appVersion,
      instance,
      port: tcpPort,
      pseudo: profile.pseudo,
      color: profile.color,
      computer: options.identity.computer,
      setup: options.setup ?? 'done',
      duos: duos(),
    }),
    extraDestinations: peers,
    broadcastPort: config.basePort,
    allowLoopback,
    isLinked: () => links.link?.health === 'connected',
    log,
  });

  let partnerState: PartnerState = { kind: 'absent' };
  const computePartner = (): PartnerState => {
    const link = links.link;
    if (link === null || link.closed) return { kind: 'absent' };
    if (link.health === 'lost' && !link.isActive()) return { kind: 'absent' };
    return { kind: 'present', partner: link.peer, link: link.health };
  };
  const refreshPartner = (): void => {
    const next = computePartner();
    const same =
      next.kind === partnerState.kind &&
      (next.kind === 'absent' ||
        (partnerState.kind === 'present' &&
          next.partner === partnerState.partner &&
          next.link === partnerState.link));
    if (same) return;
    partnerState = next;
    events.emit('partner', next);
    events.emit('others', others());
  };

  const others = (): Sighting[] => {
    const partner = links.link?.peer.machine;
    return discovery.seen().filter((sighting) => sighting.machine !== partner);
  };

  const udpErrors = new Map<string, { count: number; loggedAt: number }>();
  const incompatibleSeen = new Map<string, string>();
  const onIncompatible = (peer: FrozenEnvelope): void => {
    const key = `${peer.appVersion}/${String(peer.protocol)}`;
    if (incompatibleSeen.get(peer.machine) === key) return;
    incompatibleSeen.set(peer.machine, key);
    const order = compareSemver(options.identity.appVersion, peer.appVersion);
    events.emit('incompatible', {
      machine: peer.machine,
      appVersion: peer.appVersion,
      protocol: peer.protocol,
      update: order < 0 ? 'self' : order > 0 ? 'peer' : 'both',
    });
  };

  links.events.on('established', () => {
    refreshPartner();
  });
  links.events.on('health', () => {
    refreshPartner();
  });
  links.events.on('activity', () => {
    refreshPartner();
  });
  links.events.on('closed', () => {
    refreshPartner();
  });
  links.events.on('incompatible', ({ peer }) => {
    onIncompatible(peer);
  });
  links.events.on('message', ({ link, message }) => {
    if (message.type === 'profile.update') {
      const parsed = v.safeParse(ProfileUpdateSchema, message.body);
      if (!parsed.success) return;
      link.peer = { ...link.peer, pseudo: parsed.output.pseudo, color: parsed.output.color };
      refreshPartner();
    } else if (message.type === 'games.update') {
      const parsed = v.safeParse(GamesUpdateSchema, message.body);
      if (!parsed.success) return;
      link.peer = { ...link.peer, games: parsed.output.games };
      refreshPartner();
    }
  });
  session.events.on('view', (view) => {
    events.emit('session', view);
  });
  session.events.on('game', (message) => {
    events.emit('game', message);
  });
  session.events.on('notice', (notice) => {
    events.emit('notice', notice);
  });
  discovery.events.on('sighting', (sighting) => {
    links.noteSighting(sighting.machine, sighting.endpoints);
    if (sighting.machine !== links.link?.peer.machine) events.emit('others', others());
  });
  discovery.events.on('incompatible', ({ peer }) => {
    onIncompatible(peer);
  });
  discovery.events.on('bye', ({ machine }) => {
    links.peerQuit(machine);
    events.emit('others', others());
  });
  discovery.events.on('expired', () => {
    events.emit('others', others());
  });
  discovery.events.on('interfaces', (list) => {
    events.emit('interfaces', list);
  });

  const listenWithFallback = async (problems: string[]): Promise<void> => {
    for (let offset = 0; offset <= config.tcpFallbacks; offset += 1) {
      try {
        server = await driver.listen({
          port: config.basePort + offset,
          onConnection: (connection) => {
            links.handleIncoming(connection);
          },
        });
        tcpPort = server.port;
        return;
      } catch (error) {
        problems.push(`tcp-${String(config.basePort + offset)}: ${String(error)}`);
      }
    }
  };

  const bindUdp = async (problems: string[]): Promise<void> => {
    const handlers = {
      onMessage: (data: Uint8Array, from: Endpoint) => {
        discovery.handleDatagram(data, from);
      },
      onError: (error: Error) => {
        // Un Mac sans l'autorisation « Réseau local » refuse chaque envoi: une entrée par cause et par minute.
        const code = 'code' in error ? String(error.code) : error.name;
        const now = driver.clock.now();
        const previous = udpErrors.get(code);
        const count = (previous?.count ?? 0) + 1;
        if (previous === undefined || now - previous.loggedAt >= 60_000) {
          udpErrors.set(code, { count, loggedAt: now });
          log('udp-erreur', { code, count });
        } else {
          udpErrors.set(code, { count, loggedAt: previous.loggedAt });
        }
      },
    };
    try {
      socket = await driver.bindDatagram({ port: config.basePort, ...handlers });
    } catch (error) {
      problems.push(`udp-${String(config.basePort)}: ${String(error)}`);
      try {
        socket = await driver.bindDatagram({ port: 0, ...handlers });
      } catch (fallbackError) {
        problems.push(`udp-ephemere: ${String(fallbackError)}`);
      }
    }
  };

  const liaison: Liaison = {
    start: async () => {
      if (started) {
        return { tcpPort: server?.port ?? null, udpPort: socket?.port ?? null, problems: [] };
      }
      started = true;
      memory = await store.load();
      const problems: string[] = [];
      // Écoute TCP d'abord: c'est elle qui déclenche l'alerte du pare-feu de Windows (ADR 0008).
      await listenWithFallback(problems);
      await bindUdp(problems);
      if (socket !== null) discovery.start(socket);
      timers.push(
        every(
          driver.clock,
          () => config.retainedProbeMs,
          () => {
            if (links.link !== null) return;
            for (const address of memory.addresses)
              links.probe({ host: address.host, port: address.port });
          },
        ),
      );
      log('demarre', { tcp: tcpPort, udp: socket?.port ?? 0, problems: problems.length });
      return { tcpPort: server === null ? null : tcpPort, udpPort: socket?.port ?? null, problems };
    },
    stop: async () => {
      if (!started) return;
      started = false;
      for (const cancel of timers) cancel();
      timers.length = 0;
      links.stop();
      await discovery.stop(true);
      socket = null;
      await server?.close();
      server = null;
      session.dispose();
      log('arrete', {});
    },
    on: (event, listener) => events.on(event, listener),
    partner: () => partnerState,
    session: () => session.view(),
    quality: () => links.link?.quality() ?? null,
    sessionTime: () => session.sessionTime(),
    now: () => driver.clock.now(),
    interfaces: () => discovery.retainedInterfaces,
    others,
    connectTo: async (address) => {
      if (!started) return { ok: false, failure: 'not-started' };
      const parsed = parseManualAddress(address);
      if (!parsed.ok) return { ok: false, failure: 'invalid-address' };
      return links.connectManual(parsed.host);
    },
    searchNow: () => {
      discovery.queryBurst();
    },
    updateProfile: (next) => {
      profile = next;
      links.link?.sendReliable('profile.update', {
        pseudo: next.pseudo.slice(0, 32),
        color: next.color.slice(0, 16),
      });
    },
    updateGames: (next) => {
      games = next;
      links.link?.sendReliable('games.update', { games: next });
    },
    lobby: {
      open: (game) => session.open(game),
      select: (game) => session.select(game),
      join: () => session.join(),
      setReady: (ready) => session.setReady(ready),
      leave: () => session.leave(),
    },
    match: {
      reportLoaded: () => session.reportLoaded(),
      pause: () => session.pause(),
      resume: () => session.resume(),
      end: (result, reason) => session.endMatch(result, reason),
      send: (channel, payload, mode) => session.sendGame(channel, payload, mode),
    },
  };
  return liaison;
}
