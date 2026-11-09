// Fausse plateforme: côté plateforme du pont pour une instance du jeu, reliée à l'autre machine
// par un PeerLink. Sans DOM: testée dans Node avec le vrai SDK.
import {
  BRIDGE_VERSION,
  HEARTBEAT_INTERVAL_MS,
  PLAYER_COLOR_IDS,
  PLAYER_COLORS,
  parseGameMessage,
  type GameManifest,
  type GameMessage,
  type GameSettings,
  type PlatformMessage,
  type PlayerInfo,
  type Role,
  type StopReason,
} from '@duo/protocol';
import type { LinkEvent, PeerLink } from './lien';
import type { PeerMessage, Profile } from './pair';
import type { HistoryEntry, SaveStore } from './stockage';

/** Ce que l'interface du faux hôte affiche. */
export type PlatformStatus =
  | { readonly kind: 'waiting-peer' }
  | { readonly kind: 'loading'; readonly progress: number }
  | { readonly kind: 'waiting-start' }
  | { readonly kind: 'running' }
  | { readonly kind: 'paused'; readonly by: string | null }
  | { readonly kind: 'ended'; readonly summary: string }
  | { readonly kind: 'stopped'; readonly reason: StopReason }
  | { readonly kind: 'error'; readonly message: string };

export interface PlatformLogEntry {
  readonly level: 'info' | 'warn' | 'error';
  readonly message: string;
  readonly data?: unknown;
}

export interface FakePlatformOptions {
  readonly role: Role;
  readonly manifest: GameManifest;
  readonly profile: Profile;
  readonly link: PeerLink;
  /** Hôte seulement: où lire et écrire les sauvegardes et l'historique. */
  readonly store?: SaveStore;
  /** Hôte seulement: emplacement choisi (1 par défaut si le jeu a des sauvegardes). */
  readonly slot?: number;
  /** Hôte seulement: `false` pour une nouvelle partie dans l'emplacement (sinon reprise s'il est plein). */
  readonly resume?: boolean;
  readonly settings?: GameSettings;
  /** Graine imposée (tests); tirée au hasard sinon. */
  readonly seed?: number;
  readonly onStatus?: (status: PlatformStatus) => void;
  readonly onLog?: (entry: PlatformLogEntry) => void;
}

export interface FakePlatform {
  readonly role: Role;
  /** Branche le port côté plateforme d'un MessageChannel dont l'autre port est remis au jeu. */
  attachGame(port: MessagePort): void;
  status(): PlatformStatus;
  players(): readonly PlayerInfo[] | null;
  /** Pause demandée par ce joueur (bouton ou Échap). */
  pause(): void;
  resume(): void;
  /** Quitter la partie: l'hôte arrête tout, l'invité le demande à l'hôte. */
  quit(): void;
  setSettings(settings: GameSettings): void;
  dispose(): void;
}

export const DEFAULT_SETTINGS: GameSettings = {
  volumes: { master: 0.8, music: 0.7, effects: 0.9, interface: 0.8 },
  uiScale: 1,
  reducedMotion: false,
  bindings: {},
};

const PING_INTERVAL_MS = 500;
const START_DELAY_MS = 300;
// Mêmes seuils que Duo (ADR 0004, amendé le 2026-10-31).
const LOADING_HEARTBEAT_TIMEOUT_MS = 30_000;
const RUNNING_HEARTBEAT_TIMEOUT_MS = 8_000;
const EXIT_SAVE_WAIT_MS = 2_000;

const clock = (): number => performance.timeOrigin + performance.now();

/** Identifiant aléatoire au format UUID v4 (`crypto.randomUUID` exige un contexte sécurisé, absent en http sur le LAN). */
export function randomId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function randomSeed(): number {
  const word = new Uint32Array(1);
  crypto.getRandomValues(word);
  return word[0] ?? 0;
}

/** Couleur de l'invité: la sienne, ou la suivante libre dans l'ordre de la palette si l'hôte a la même (M-02). */
export function resolveGuestColor(
  host: Profile['color'],
  guest: Profile['color'],
): Profile['color'] {
  if (host !== guest) return guest;
  const index = PLAYER_COLOR_IDS.indexOf(guest);
  return PLAYER_COLOR_IDS[(index + 1) % PLAYER_COLOR_IDS.length] ?? 'crescent';
}

export function createFakePlatform(options: FakePlatformOptions): FakePlatform {
  const { role, manifest, link } = options;
  let settings = options.settings ?? DEFAULT_SETTINGS;
  let status: PlatformStatus = { kind: 'waiting-peer' };
  let port: MessagePort | null = null;
  let gameHello = false;
  let gameReady = false;
  let peerReady = false;
  let initSent = false;
  let setup: { matchId: string; seed: number; players: [PlayerInfo, PlayerInfo] } | null = null;
  let clockOffsetMs = 0;
  let lastHeartbeat = clock();
  let disposed = false;
  let stopping = false;
  // Mesures de la liaison.
  let pingId = 0;
  const rttSamples: { rtt: number; offset: number }[] = [];
  let jitterMs = 0;
  let lastRtt = 0;
  let lastPong = clock();
  // Partie (hôte): durée jouée hors pauses, dernière progression, fin annoncée.
  let startedAt: string | null = null;
  let playedMs = 0;
  let runningSince: number | null = null;
  let lastProgress: number | undefined;
  let historyWritten = false;
  let sessionEndWaiter: (() => void) | null = null;
  let autosaveTimer: ReturnType<typeof setInterval> | undefined;
  const timers: ReturnType<typeof setInterval>[] = [];

  const log = (level: PlatformLogEntry['level'], message: string, data?: unknown): void => {
    options.onLog?.(data === undefined ? { level, message } : { level, message, data });
  };

  const setStatus = (next: PlatformStatus): void => {
    status = next;
    if (next.kind === 'running') {
      runningSince ??= clock();
    } else if (runningSince !== null) {
      playedMs += clock() - runningSince;
      runningSince = null;
    }
    options.onStatus?.(next);
  };

  const toGame = (message: PlatformMessage, transfer?: Transferable[]): void => {
    if (port === null) return;
    if (transfer === undefined) port.postMessage(message);
    else port.postMessage(message, transfer);
  };
  const toPeer = (message: PeerMessage): void => {
    link.send(message);
  };
  // L'hôte peut avoir distingué l'identifiant de l'invité: on lit celui de la partie.
  const localId = (): string =>
    setup?.players.find((p) => p.role === role)?.id ?? options.profile.id;

  const sendInit = async (): Promise<void> => {
    if (initSent || setup === null || !gameHello) return;
    initSent = true;
    let save: Extract<PlatformMessage, { type: 'init' }>['save'] = null;
    const slot = role === 'host' && manifest.saves !== null ? (options.slot ?? 1) : null;
    if (
      role === 'host' &&
      slot !== null &&
      options.store !== undefined &&
      options.resume !== false
    ) {
      try {
        const stored = await options.store.read(manifest.id, slot);
        if (stored !== null) {
          const data = new TextEncoder().encode(stored.data).buffer;
          save = {
            slot,
            label: stored.label,
            dataSchema: stored.dataSchema,
            gameVersion: stored.gameVersion,
            data,
            ...(stored.progress === undefined ? {} : { progress: stored.progress }),
          };
          lastProgress = stored.progress;
        }
      } catch (error) {
        log('error', 'lecture de la sauvegarde impossible: nouvelle partie', String(error));
      }
    }
    const message: PlatformMessage = {
      type: 'init',
      bridge: BRIDGE_VERSION,
      matchId: setup.matchId,
      role,
      localPlayerId: localId(),
      players: setup.players,
      seed: setup.seed,
      game: { id: manifest.id, version: manifest.version },
      settings,
      saveSlot: slot,
      save,
      clockOffsetMs,
    };
    toGame(message, save === null ? undefined : [save.data]);
    setStatus({ kind: 'loading', progress: 0 });
  };

  /** Arrêt sur erreur: plantage local (`tellPeer`), plantage chez l'autre, ou coupure. */
  const fail = (
    message: string,
    tellPeer: boolean,
    reason: StopReason = tellPeer ? 'stopped' : 'peer-crash',
  ): void => {
    if (status.kind === 'error') return;
    log('error', message);
    if (tellPeer) toPeer({ t: 'crash', message });
    if (role === 'host')
      void writeHistory(
        reason === 'disconnect-stop' ? 'interrupted: disconnect-stop' : 'interrupted: crash',
      );
    toGame({ type: 'stop', reason, save: false });
    setStatus({ kind: 'error', message });
  };

  const writeHistory = async (
    outcome: string,
    stats: HistoryEntry['stats'] = [],
  ): Promise<void> => {
    if (
      role !== 'host' ||
      historyWritten ||
      setup === null ||
      startedAt === null ||
      options.store === undefined
    )
      return;
    historyWritten = true;
    const running = runningSince === null ? 0 : clock() - runningSince;
    const entry: HistoryEntry = {
      id: setup.matchId,
      gameId: manifest.id,
      gameVersion: manifest.version,
      play: manifest.play,
      startedAt,
      playedMs: Math.round(playedMs + running),
      players: setup.players.map((p) => ({ id: p.id, name: p.name, role: p.role })),
      outcome,
      stats,
      ...(lastProgress === undefined ? {} : { progress: lastProgress }),
    };
    try {
      await options.store.appendHistory(manifest.id, entry);
    } catch (error) {
      log('error', "écriture de l'historique impossible", String(error));
    }
  };

  const startIfBothReady = (): void => {
    if (role !== 'host' || !gameReady || !peerReady || status.kind !== 'waiting-start') return;
    const atSessionMs = clock() + START_DELAY_MS;
    toPeer({ t: 'start', atSessionMs });
    beginRunning(atSessionMs);
  };

  const beginRunning = (atSessionMs: number): void => {
    startedAt ??= new Date().toISOString();
    toGame({ type: 'start', atSessionMs });
    setStatus({ kind: 'running' });
    const autosave =
      manifest.saves?.moments.includes('auto') === true
        ? manifest.saves.autosaveSeconds
        : undefined;
    if (role === 'host' && autosave !== undefined && autosaveTimer === undefined) {
      autosaveTimer = setInterval(() => {
        if (status.kind === 'running') toGame({ type: 'saveRequest', moment: 'auto' });
      }, autosave * 1000);
    }
  };

  const applyPause = (by: string | null): void => {
    if (status.kind !== 'running') return;
    toGame({ type: 'pause', reason: 'request', by });
    setStatus({ kind: 'paused', by });
    if (role === 'host' && manifest.saves?.moments.includes('auto') === true) {
      toGame({ type: 'saveRequest', moment: 'auto' });
    }
  };
  const applyResume = (): void => {
    if (status.kind !== 'paused') return;
    toGame({ type: 'resume' });
    setStatus({ kind: 'running' });
  };

  /** Hôte: arrête la partie des deux côtés, après la sauvegarde de sortie. */
  const hostStop = async (reason: StopReason): Promise<void> => {
    if (stopping) return;
    stopping = true;
    const wantsExitSave =
      manifest.saves?.moments.includes('exit') === true && status.kind !== 'loading';
    const waitEnd =
      manifest.play === 'session' && !historyWritten
        ? new Promise<void>((resolve) => {
            sessionEndWaiter = resolve;
            setTimeout(resolve, EXIT_SAVE_WAIT_MS);
          })
        : new Promise<void>((resolve) => setTimeout(resolve, wantsExitSave ? 300 : 0));
    toGame({ type: 'stop', reason, save: wantsExitSave });
    toPeer({ t: 'stop', reason });
    await waitEnd;
    await writeHistory(reason === 'end' ? 'session' : `interrupted: ${reason}`);
    setStatus({ kind: 'stopped', reason });
  };

  const handleSaveWrite = async (
    message: Extract<GameMessage, { type: 'saveWrite' }>,
  ): Promise<void> => {
    const reply = (
      statusValue: Extract<PlatformMessage, { type: 'saveResult' }>['status'],
    ): void => {
      toGame({ type: 'saveResult', requestId: message.requestId, status: statusValue });
    };
    const saves = manifest.saves;
    const slot = options.slot ?? 1;
    if (role !== 'host' || saves === null || options.store === undefined) {
      reply('refused');
      return;
    }
    if (!saves.moments.includes(message.moment)) {
      reply('moment-not-declared');
      return;
    }
    if (message.data.byteLength > saves.maxBytes) {
      reply('too-large');
      return;
    }
    try {
      const data = new TextDecoder().decode(message.data);
      JSON.parse(data);
      await options.store.write(manifest.id, {
        slot,
        label: message.label,
        dataSchema: message.dataSchema,
        gameVersion: manifest.version,
        moment: message.moment,
        savedAt: new Date().toISOString(),
        data,
        ...(message.progress === undefined ? {} : { progress: message.progress }),
      });
      if (message.progress !== undefined) lastProgress = message.progress;
      reply('ok');
      log('info', `sauvegarde écrite: ${message.label} (${message.moment})`);
    } catch (error) {
      log('error', 'écriture de la sauvegarde impossible', String(error));
      reply('write-error');
    }
  };

  const onGameMessage = (raw: unknown): void => {
    const message = parseGameMessage(raw);
    if (message === null) {
      log('warn', 'message du jeu non conforme, ignoré', raw);
      return;
    }
    switch (message.type) {
      case 'hello':
        gameHello = true;
        if (message.bridge.split('.')[0] !== BRIDGE_VERSION.split('.')[0]) {
          fail(`pont ${message.bridge} du jeu incompatible avec ${BRIDGE_VERSION}`, true);
          return;
        }
        void sendInit();
        return;
      case 'loading':
        if (status.kind === 'loading') setStatus({ kind: 'loading', progress: message.progress });
        return;
      case 'ready':
        gameReady = true;
        toPeer({ t: 'ready' });
        setStatus({ kind: 'waiting-start' });
        startIfBothReady();
        return;
      case 'heartbeat':
        lastHeartbeat = clock();
        return;
      case 'perf':
        return;
      case 'pauseRequest':
        if (status.kind === 'running') platform.pause();
        else if (status.kind === 'paused') platform.resume();
        return;
      case 'saveWrite':
        void handleSaveWrite(message);
        return;
      case 'matchEnd': {
        if (role !== 'host') return;
        const summary = message.outcome.kind;
        void writeHistory(summary, message.stats);
        toPeer({ t: 'ended' });
        setStatus({ kind: 'ended', summary: 'Partie terminée' });
        return;
      }
      case 'sessionEnd':
        if (role !== 'host') return;
        if (message.progress !== undefined) lastProgress = message.progress;
        void writeHistory(message.finished ? 'session-finished' : 'session', message.stats);
        sessionEndWaiter?.();
        sessionEndWaiter = null;
        if (message.finished) {
          toPeer({ t: 'ended' });
          setStatus({ kind: 'ended', summary: 'Séance terminée, inscrite à l’historique' });
        }
        return;
      case 'net':
        toPeer({ t: 'net', channel: message.channel, data: message.data });
        return;
      case 'fatal':
        fail(`Le jeu s’est arrêté sur une erreur (${message.message}).`, true);
        return;
      case 'log':
        log(message.level, `[jeu] ${message.message}`, message.data);
        return;
      // Le carnet de séance n'existe que dans Duo: le banc de développement l'ignore.
      case 'notebookEnable':
      case 'notebookTyping':
      case 'notebookWrite':
        return;
    }
  };

  const updateLink = (): void => {
    const best = rttSamples.reduce<{ rtt: number; offset: number } | null>(
      (acc, s) => (acc === null || s.rtt < acc.rtt ? s : acc),
      null,
    );
    if (best !== null && role === 'guest') clockOffsetMs = best.offset;
    const silent = clock() - lastPong > 1500;
    toGame({
      type: 'link',
      rttMs: lastRtt,
      jitterMs,
      state: silent || jitterMs > 30 ? 'unstable' : 'good',
      clockOffsetMs,
    });
  };

  const onPeer = (message: PeerMessage): void => {
    switch (message.t) {
      case 'hello': {
        if (role !== 'host') return;
        if (message.gameId !== manifest.id || message.gameVersion !== manifest.version) {
          toPeer({
            t: 'refuse',
            message: `L’hôte joue à ${manifest.id} ${manifest.version}, l’invité à ${message.gameId} ${message.gameVersion}.`,
          });
          return;
        }
        if (setup === null) {
          const hostColor = options.profile.color;
          const guestColor = resolveGuestColor(hostColor, message.profile.color);
          const hostId = options.profile.id;
          // Deux navigateurs peuvent tirer le même identifiant de profil s'il a été copié: l'invité est alors distingué.
          const guestId =
            message.profile.id === hostId ? `${message.profile.id}-invite` : message.profile.id;
          setup = {
            matchId: randomId(),
            seed: options.seed ?? randomSeed(),
            players: [
              {
                id: hostId,
                role: 'host',
                name: options.profile.name,
                color: hostColor,
                colorHex: PLAYER_COLORS[hostColor].hex,
                local: false,
              },
              {
                id: guestId,
                role: 'guest',
                name: message.profile.name,
                color: guestColor,
                colorHex: PLAYER_COLORS[guestColor].hex,
                local: false,
              },
            ],
          };
          void sendInit();
        }
        toPeer({ t: 'setup', matchId: setup.matchId, seed: setup.seed, players: setup.players });
        return;
      }
      case 'setup':
        if (role !== 'guest' || setup !== null) return;
        setup = { matchId: message.matchId, seed: message.seed, players: message.players };
        void sendInit();
        return;
      case 'refuse':
        fail(message.message, false);
        return;
      case 'ready':
        peerReady = true;
        startIfBothReady();
        return;
      case 'start':
        if (role === 'guest' && (status.kind === 'waiting-start' || status.kind === 'loading'))
          beginRunning(message.atSessionMs);
        return;
      case 'pause':
        applyPause(message.by);
        return;
      case 'resume':
        applyResume();
        return;
      case 'stopRequest':
        if (role === 'host') void hostStop(status.kind === 'ended' ? 'end' : 'quit');
        return;
      case 'stop':
        if (role !== 'guest' || stopping) return;
        stopping = true;
        toGame({ type: 'stop', reason: message.reason, save: false });
        setStatus({ kind: 'stopped', reason: message.reason });
        return;
      case 'ended':
        setStatus({ kind: 'ended', summary: 'Séance terminée' });
        return;
      case 'crash':
        fail(`Partie arrêtée chez l’autre joueur. ${message.message}`, false);
        return;
      case 'net':
        toGame({ type: 'net', channel: message.channel, data: message.data });
        return;
      case 'ping':
        toPeer({ t: 'pong', id: message.id, at: message.at, peerAt: clock() });
        return;
      case 'pong': {
        const now = clock();
        const rtt = Math.max(0, now - message.at);
        jitterMs = jitterMs * 0.8 + Math.abs(rtt - lastRtt) * 0.2;
        lastRtt = rtt;
        lastPong = now;
        rttSamples.push({ rtt, offset: message.peerAt + rtt / 2 - now });
        if (rttSamples.length > 16) rttSamples.shift();
        updateLink();
        return;
      }
    }
  };

  const onLink = (event: LinkEvent): void => {
    switch (event.kind) {
      case 'message':
        onPeer(event.message);
        return;
      case 'peer':
        if (event.present && role === 'guest') {
          toPeer({
            t: 'hello',
            profile: options.profile,
            gameId: manifest.id,
            gameVersion: manifest.version,
          });
        }
        if (
          !event.present &&
          setup !== null &&
          status.kind !== 'stopped' &&
          status.kind !== 'ended'
        ) {
          fail(
            'L’autre ordinateur s’est déconnecté. La dernière sauvegarde est gardée: relance la partie.',
            false,
            'disconnect-stop',
          );
        }
        return;
      case 'closed':
        if (status.kind === 'stopped' || status.kind === 'ended') return;
        // Refus du serveur avant toute partie (rôle déjà pris): son message suffit.
        if (setup === null) fail(event.reason, false, 'disconnect-stop');
        else
          fail(
            `Connexion perdue (${event.reason}). La dernière sauvegarde est gardée: relance la partie.`,
            false,
            'disconnect-stop',
          );
        return;
    }
  };
  const offLink = link.on(onLink);

  timers.push(
    setInterval(() => {
      if (setup === null) return;
      toPeer({ t: 'ping', id: ++pingId, at: clock() });
    }, PING_INTERVAL_MS),
    setInterval(() => {
      if (
        !initSent ||
        status.kind === 'error' ||
        status.kind === 'stopped' ||
        status.kind === 'ended'
      )
        return;
      const limit =
        status.kind === 'loading' ? LOADING_HEARTBEAT_TIMEOUT_MS : RUNNING_HEARTBEAT_TIMEOUT_MS;
      if (clock() - lastHeartbeat > limit) fail('Le jeu ne répond plus.', true);
    }, HEARTBEAT_INTERVAL_MS),
  );

  const platform: FakePlatform = {
    role,
    attachGame(gamePort) {
      port = gamePort;
      lastHeartbeat = clock();
      gamePort.onmessage = (event: MessageEvent): void => {
        onGameMessage(event.data);
      };
    },
    status: () => status,
    players: () => setup?.players ?? null,
    pause() {
      if (status.kind !== 'running') return;
      toPeer({ t: 'pause', by: localId() });
      applyPause(localId());
    },
    resume() {
      if (status.kind !== 'paused') return;
      toPeer({ t: 'resume' });
      applyResume();
    },
    quit() {
      if (role === 'host') void hostStop(status.kind === 'ended' ? 'end' : 'quit');
      else toPeer({ t: 'stopRequest' });
    },
    setSettings(next) {
      settings = next;
      toGame({ type: 'settings', settings });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      offLink();
      for (const timer of timers) clearInterval(timer);
      if (autosaveTimer !== undefined) clearInterval(autosaveTimer);
      if (port !== null) {
        port.onmessage = null;
        port.close();
      }
      port = null;
    },
  };

  // L'invité se présente dès que le lien est prêt; il renouvelle sa présentation jusqu'à la réponse de l'hôte.
  if (role === 'guest') {
    timers.push(
      setInterval(() => {
        if (setup === null && status.kind === 'waiting-peer') {
          toPeer({
            t: 'hello',
            profile: options.profile,
            gameId: manifest.id,
            gameVersion: manifest.version,
          });
        }
      }, 1000),
    );
  }
  return platform;
}
