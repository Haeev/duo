// Liaison de Duo sur `@duo/liaison` (dev-reseau, ADR 0007 et 0008): découverte sur le
// réseau local, liaison WebSocket authentifiée par la clé du duo, vivacité, reprise
// numérotée, heure de session et relais des messages de jeu. Le salon et la partie
// restent ceux de la plateforme (`session-machine.ts`, l'hôte fait autorité): leurs
// messages passent par les messages fiables de la liaison (salon externe).
import { randomInt, randomUUID } from 'node:crypto';
import * as v from 'valibot';
import {
  createConfig,
  createFileStore,
  createLiaison,
  createMemoryStore,
  createNodeDriver,
  type Liaison as NetworkLink,
  type LinkStore,
  type NetworkCommandLine,
  type NetworkConfig,
  type NetworkDriver,
  type PartnerState,
} from '@duo/liaison';
import { ProfileSchema } from '../data/store';
import type { Journal, LogLevel } from '../journal';
import type { Profile } from '../../shared/state';
import type {
  GameRelayMessage,
  Liaison,
  LiaisonEvent,
  LinkQualityView,
  LocalIdentity,
  PeerInfo,
  SessionsView,
  StopReason,
} from './liaison';
import { GuestIntentSchema, HostSessionSchema, type GuestIntent } from './local/wire';
import {
  EMPTY_SESSION,
  nextDeadline,
  reduceSession,
  type EndSummary,
  type HostSession,
  type SalonGame,
  type SessionInput,
  type SessionTools,
} from './session-machine';

/** Une liaison perdue hors séance (salon ouvert sans invité) vaut absence après ce délai. */
const ABSENT_AFTER_LOST_MS = 6000;
const QUALITY_EVERY_MS = 1000;
/** `MAX_NET_MESSAGE_BYTES` du pont (64 Kio): le SDK n'envoie rien de plus gros. */
const MAX_GAME_TEXT = 65_536;

/**
 * Plafonds de débit des messages de jeu relevés pour la démo: un monde complet de
 * La Petite Ligne part plusieurs fois par seconde. Le jeu et la plateforme sont de
 * confiance; ces plafonds ne gardent que d'un emballement.
 */
const APP_NETWORK_CONFIG: Partial<NetworkConfig> = {
  gameMessagesPerSecond: 600,
  gameBurstMessages: 1200,
  gameBytesPerSecond: 4 * 1024 * 1024,
  gameBurstBytes: 8 * 1024 * 1024,
};

const WARN_EVENTS = new Set([
  'appel-entrant-refuse',
  'appel-sortant-echoue',
  'message-invalide',
  'tampon-deborde',
  'udp-erreur',
  'liaison-fermee',
  'jeu-debit-depasse',
  'erreur-ecouteur',
  'memoire-non-ecrite',
]);

const SessionMessageSchema = v.object({ session: HostSessionSchema, sentAt: v.number() });

/** Compteurs du relais et état du lien (crochets de test, journal). */
export interface RelayStats {
  readonly gameSent: number;
  readonly gameReceived: number;
  readonly appSent: number;
  readonly appReceived: number;
  readonly partner: 'connected' | 'unstable' | 'lost' | 'absent';
}
const IntentMessageSchema = v.object({ intent: GuestIntentSchema });

export interface NetworkLiaisonOptions {
  readonly journal: Journal;
  /** Options `--duo-port`, `--duo-peer` et `--duo-allow-loopback`. */
  readonly network: Pick<NetworkCommandLine, 'peers' | 'allowLoopback'> & {
    readonly port?: number;
  };
  /** Mémoire de la liaison (clés des duos, adresses retenues): `<userData>/reseau.json`. */
  readonly storePath?: string;
  readonly store?: LinkStore;
  /** Nom de l'ordinateur (E04), annoncé sur le réseau local, jamais journalisé. */
  readonly computerName: string;
  readonly electron?: string;
  readonly os?: string;
  readonly arch?: string;
  /** Pilote injecté (réseau simulé des tests); Node par défaut. */
  readonly driver?: NetworkDriver;
  readonly config?: Partial<NetworkConfig>;
  /** Horloge de l'interface: les heures des salons lui sont rapportées (`Date.now()`). */
  readonly displayNow?: () => number;
}

export class NetworkLiaison implements Liaison {
  private readonly listeners = new Set<(event: LiaisonEvent) => void>();
  private readonly tools: SessionTools = {
    newMatchId: () => randomUUID(),
    newSeed: () => randomInt(0, 2 ** 31),
  };
  private readonly driver: NetworkDriver;
  private readonly configOverrides: Partial<NetworkConfig>;
  private readonly displayNow: () => number;
  private link: NetworkLink | null = null;
  private identity: LocalIdentity | null = null;
  private peer: PeerInfo | null = null;
  private partnerLink: 'connected' | 'unstable' | 'lost' | null = null;
  private lastPeerInstance: string | null = null;
  private own: HostSession = EMPTY_SESSION;
  private peerSession: HostSession | null = null;
  private linkDown = false;
  private active = false;
  private deadlineTimer: (() => void) | null = null;
  private absentTimer: (() => void) | null = null;
  private qualityTimer: (() => void) | null = null;
  private relayRefused = 0;
  private readonly counters = { gameSent: 0, gameReceived: 0, appSent: 0, appReceived: 0 };

  constructor(private readonly options: NetworkLiaisonOptions) {
    this.configOverrides = {
      ...APP_NETWORK_CONFIG,
      ...options.config,
      ...(options.network.port === undefined ? {} : { basePort: options.network.port }),
    };
    this.driver =
      options.driver ??
      createNodeDriver({
        config: createConfig(this.configOverrides),
        allowLoopback: options.network.allowLoopback,
        // Deux instances sur une machine: écoute sur la boucle locale seulement.
        listenHost: options.network.allowLoopback ? '127.0.0.1' : '0.0.0.0',
      });
    this.displayNow = options.displayNow ?? Date.now;
  }

  /** Horloge de la liaison: `performance.timeOrigin + performance.now()` en production. */
  private now(): number {
    return this.driver.clock.now();
  }

  async start(identity: LocalIdentity): Promise<void> {
    if (this.link !== null) return;
    this.identity = identity;
    const { options } = this;
    const store =
      options.store ??
      (options.storePath === undefined ? createMemoryStore() : createFileStore(options.storePath));
    const link = createLiaison({
      identity: {
        machine: identity.machineId,
        appVersion: identity.appVersion,
        computer: options.computerName.slice(0, 32),
        ...(options.electron === undefined ? {} : { electron: options.electron }),
        ...(options.os === undefined ? {} : { os: options.os }),
        ...(options.arch === undefined ? {} : { arch: options.arch }),
      },
      profile: { pseudo: identity.profile.pseudo, color: identity.profile.color },
      store,
      peers: options.network.peers,
      allowLoopback: options.network.allowLoopback,
      listenHost: options.network.allowLoopback ? '127.0.0.1' : '0.0.0.0',
      externalSession: true,
      // Prototype: un duo se forme avec le Duo rencontré (question ouverte, ADR 0009 point 2).
      pairingPolicy: 'any',
      config: this.configOverrides,
      driver: this.driver,
      log: (event, data) => {
        const level: LogLevel = WARN_EVENTS.has(event) ? 'warn' : 'info';
        this.options.journal.write(level, 'reseau', event, { ...data });
      },
    });
    this.link = link;
    link.on('partner', (state) => {
      this.onPartner(state);
    });
    link.on('app', ({ type, body }) => {
      this.onApp(type, body);
    });
    link.on('game', ({ channel, payload }) => {
      this.onGame(channel, payload);
    });
    link.on('incompatible', (info) => {
      this.options.journal.write('warn', 'reseau', 'protocole-different', {
        protocol: info.protocol,
        update: info.update,
      });
    });
    const report = await link.start();
    this.options.journal.write(report.tcpPort === null ? 'warn' : 'info', 'reseau', 'ecoute', {
      tcp: report.tcpPort,
      udp: report.udpPort,
      problems: report.problems.length,
    });
    this.armQuality();
  }

  async stop(): Promise<void> {
    for (const cancel of [this.deadlineTimer, this.absentTimer, this.qualityTimer]) cancel?.();
    this.deadlineTimer = null;
    this.absentTimer = null;
    this.qualityTimer = null;
    const link = this.link;
    this.link = null;
    if (link !== null) await link.stop();
  }

  setProfile(profile: Profile): void {
    if (this.identity !== null) this.identity = { ...this.identity, profile };
    this.link?.updateProfile({ pseudo: profile.pseudo, color: profile.color });
  }

  sessionOffsetMs(): number {
    // L'hôte de la partie (ou du salon) donne l'heure; l'invité la lit par l'écart d'horloge.
    if (this.own.match !== null || this.own.salon !== null) return 0;
    if ((this.peerSession?.match ?? null) !== null || this.joinedPeer()) {
      return this.link?.quality()?.clockOffsetMs ?? 0;
    }
    return 0;
  }

  /** Compteurs du relais, pour les crochets de test et le journal. */
  stats(): RelayStats {
    return { ...this.counters, partner: this.partnerLink ?? 'absent' };
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
    if (salon === undefined || salon === null || salon.guestJoined || this.peer === null) return;
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

  reportSummary(matchId: string, summary: EndSummary): void {
    if (this.own.lastEnd?.matchId === matchId) this.applyOwn({ type: 'summary', matchId, summary });
  }

  sendGame(message: GameRelayMessage): void {
    const link = this.link;
    if (link === null) return;
    // Le texte JSON du SDK part tel quel, en trame binaire: ni second encodage, ni échappement.
    const result = link.match.send(
      message.channel,
      new TextEncoder().encode(message.data),
      message.mode,
    );
    if (result.ok) {
      this.counters.gameSent += 1;
      return;
    }
    this.relayRefused += 1;
    if (this.relayRefused % 100 === 1) {
      this.options.journal.write('warn', 'reseau', 'jeu-envoi-refuse', {
        reason: result.reason,
        count: this.relayRefused,
      });
    }
  }

  // Salon et partie ----------------------------------------------------------

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
    if (this.link?.sendApp('intent', { intent }) === true) this.counters.appSent += 1;
  }

  private sendOwnSession(): void {
    if (this.link?.sendApp('session', { session: this.own, sentAt: this.now() }) === true) {
      this.counters.appSent += 1;
    }
  }

  private applyOwn(input: SessionInput): void {
    const next = reduceSession(this.own, input, this.now(), this.tools);
    if (next === this.own) return;
    this.own = next;
    this.armDeadline();
    this.sendOwnSession();
    this.emitSessions();
  }

  private armDeadline(): void {
    this.deadlineTimer?.();
    this.deadlineTimer = null;
    const deadline = nextDeadline(this.own);
    if (deadline === null) return;
    this.deadlineTimer = this.driver.clock.setTimeout(
      () => {
        this.deadlineTimer = null;
        this.applyOwn({ type: 'tick' });
        // Un minuteur de Node peut sonner une fraction de milliseconde avant l'échéance lue
        // sur `performance.now()`: le tick ne change alors rien, et l'on réarme (sans effet
        // si le tick a fait avancer l'état: `armDeadline` repart toujours de l'état courant).
        this.armDeadline();
      },
      Math.max(0, deadline - this.now()) + 1,
    );
  }

  private inSession(): boolean {
    return this.own.match !== null || this.own.salon?.guestJoined === true || this.joinedPeer();
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

  // Événements de la liaison -------------------------------------------------

  private onPartner(state: PartnerState): void {
    if (state.kind === 'absent') {
      this.onAbsent();
      return;
    }
    const partner = state.partner;
    const restarted = this.lastPeerInstance !== null && this.lastPeerInstance !== partner.instance;
    const wasConnected = this.peer !== null && this.partnerLink === 'connected';
    this.lastPeerInstance = partner.instance;
    this.partnerLink = state.link;
    const peer: PeerInfo = {
      machineId: partner.machine,
      instanceId: partner.instance,
      appVersion: partner.appVersion,
      profile: this.peerProfile(partner.pseudo, partner.color),
    };
    const changed =
      this.peer?.machineId !== peer.machineId ||
      this.peer.instanceId !== peer.instanceId ||
      this.peer.profile.pseudo !== peer.profile.pseudo ||
      this.peer.profile.color !== peer.profile.color;
    if (changed) {
      this.peer = peer;
      this.emit({ type: 'peer', peer });
    }
    if (restarted) {
      // L'autre Duo a redémarré: ce qu'il savait du salon est perdu, la reprise est impossible.
      this.options.journal.write('info', 'reseau', 'autre-redemarre');
      this.peerSession = null;
      this.applyOwn({ type: 'guest-gone' });
    }
    if (state.link === 'lost') {
      this.onLost();
    } else if (state.link === 'connected') {
      this.absentTimer?.();
      this.absentTimer = null;
      if (this.linkDown) {
        this.linkDown = false;
        this.applyOwn({ type: 'link', up: true });
        this.emit({ type: 'link', up: true });
      }
      // Liaison neuve ou revenue: l'autre reçoit l'état complet de mon salon.
      if (!wasConnected) this.sendOwnSession();
    }
    this.emitQuality();
    this.emitSessions();
  }

  private onLost(): void {
    if (this.inSession()) {
      if (this.linkDown) return;
      this.linkDown = true;
      this.options.journal.write('warn', 'reseau', 'liaison-perdue', { inSession: true });
      this.applyOwn({ type: 'link', up: false });
      this.emit({ type: 'link', up: false });
      return;
    }
    // Hors séance (salon ouvert sans invité): absence après le délai du repos.
    if (this.absentTimer !== null) return;
    this.absentTimer = this.driver.clock.setTimeout(() => {
      this.absentTimer = null;
      if (this.partnerLink === 'lost') this.onAbsent();
    }, ABSENT_AFTER_LOST_MS);
  }

  private onAbsent(): void {
    this.absentTimer?.();
    this.absentTimer = null;
    const hadPeer = this.peer !== null || this.peerSession !== null;
    this.partnerLink = null;
    this.peer = null;
    this.peerSession = null;
    this.lastPeerInstance = null;
    this.options.journal.write('info', 'reseau', 'autre-absent');
    // L'autre est parti (fermeture de Duo, processus arrêté): plus d'invité chez moi.
    this.applyOwn({ type: 'guest-gone' });
    if (hadPeer) this.emit({ type: 'peer', peer: null });
    this.updateActive();
    this.emitSessions();
  }

  private peerProfile(pseudo: string, color: string): Profile {
    const full = v.safeParse(ProfileSchema, { pseudo, color });
    if (full.success) return full.output;
    const pseudoOnly = v.safeParse(ProfileSchema, { pseudo, color: 'crescent' });
    if (pseudoOnly.success) return pseudoOnly.output;
    return this.peer?.profile ?? { pseudo: '?', color: 'crescent' };
  }

  private onApp(type: string, body: Readonly<Record<string, unknown>>): void {
    this.counters.appReceived += 1;
    if (type === 'session') {
      const parsed = v.safeParse(SessionMessageSchema, body);
      if (!parsed.success) {
        this.options.journal.write('warn', 'reseau', 'salon-invalide');
        return;
      }
      this.peerSession = this.peerToLocal(parsed.output.session, parsed.output.sentAt);
      this.emitSessions();
      return;
    }
    if (type === 'intent') {
      const parsed = v.safeParse(IntentMessageSchema, body);
      if (!parsed.success) {
        this.options.journal.write('warn', 'reseau', 'intention-invalide');
        return;
      }
      this.applyOwn(this.guestInput(parsed.output.intent));
    }
  }

  /**
   * Heures de l'hôte vers mon horloge: par l'écart mesuré par la liaison dès qu'un
   * battement est revenu (juste même pour un message réémis après une coupure), sinon
   * par le temps écoulé depuis l'envoi.
   */
  private peerToLocal(session: HostSession, sentAt: number): HostSession {
    const quality = this.link?.quality() ?? null;
    const now = this.now();
    const measured = quality !== null && quality.rttMs !== null;
    const offset = quality?.clockOffsetMs ?? 0;
    const shift = (at: number): number => (measured ? at - offset : now + (at - sentAt));
    return shiftTimes(session, (at) => (at === null ? null : shift(at)));
  }

  private onGame(channel: number, payload: unknown): void {
    const data =
      payload instanceof Uint8Array
        ? new TextDecoder().decode(payload)
        : typeof payload === 'string'
          ? payload
          : null;
    if (data === null || data.length > MAX_GAME_TEXT) return;
    this.counters.gameReceived += 1;
    // Le mode n'est pas transporté: il ne sert qu'à l'émetteur (réémission).
    this.emit({ type: 'game', message: { channel, mode: 'reliable', data } });
  }

  // Émission -----------------------------------------------------------------

  private emit(event: LiaisonEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  private updateActive(): void {
    const active =
      this.own.salon !== null ||
      this.own.match !== null ||
      (this.peerSession?.salon ?? null) !== null ||
      (this.peerSession?.match ?? null) !== null;
    if (active === this.active) return;
    this.active = active;
    this.link?.setActive(active);
  }

  /** La plateforme et l'interface comptent en `Date.now()`: les heures leur sont rapportées. */
  private emitSessions(): void {
    this.updateActive();
    const toDisplay = this.displayNow() - this.now();
    const display = (session: HostSession): HostSession =>
      toDisplay === 0
        ? session
        : shiftTimes(session, (at) => (at === null ? null : at + toDisplay));
    const sessions: SessionsView = {
      own: display(this.own),
      peer: this.peerSession === null ? null : display(this.peerSession),
    };
    this.emit({ type: 'sessions', sessions });
  }

  private qualityView(): LinkQualityView | null {
    const quality = this.link?.quality() ?? null;
    if (quality === null) return null;
    return {
      rttMs: quality.rttMs ?? 0,
      jitterMs: quality.jitterMs ?? 0,
      state: this.partnerLink === 'connected' ? quality.state : 'unstable',
      clockOffsetMs: this.sessionOffsetMs(),
    };
  }

  private emitQuality(): void {
    const quality = this.qualityView();
    if (quality !== null) this.emit({ type: 'quality', quality });
  }

  private armQuality(): void {
    this.qualityTimer = this.driver.clock.setTimeout(() => {
      if (this.link === null) return;
      if (this.peer !== null) this.emitQuality();
      this.armQuality();
    }, QUALITY_EVERY_MS);
  }
}

/** Applique `shift` à chaque heure d'un état de salon (décompte, reprise, début du jeu). */
function shiftTimes(
  session: HostSession,
  shift: (at: number | null) => number | null,
): HostSession {
  return {
    ...session,
    salon:
      session.salon === null
        ? null
        : { ...session.salon, countdownEndsAt: shift(session.salon.countdownEndsAt) },
    match:
      session.match === null
        ? null
        : {
            ...session.match,
            resumeEndsAt: shift(session.match.resumeEndsAt),
            playingSince: shift(session.match.playingSince),
          },
  };
}
