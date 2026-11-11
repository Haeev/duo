// `connect`: ouvre le pont, attend `init` et construit le contexte du jeu, typé par rôle.
import {
  BRIDGE_VERSION,
  HEARTBEAT_INTERVAL_MS,
  parseBridgeVersion,
  parseManifest,
  type GameManifest,
  type GameMessage,
  type GameSettings,
  type InitMessage,
  type PlatformMessage,
  type SaveMoment,
  type SaveStatus,
} from '@duo/protocol';
import type {
  ConnectOptions,
  DuoContext,
  DuoEvents,
  GuestContext,
  HostContext,
  HostResults,
  HostSaves,
  LifecycleState,
  LoadedSave,
  Logger,
  Notebook,
  Player,
  SaveSnapshot,
  SessionSummary,
  UiSettings,
  Unsubscribe,
} from './api';
import { createAudio } from './audio';
import { createGameBridge, waitForPort, type GameBridge } from './bridge';
import { createInput } from './input';
import { createLoop } from './loop';
import { createNet } from './net';
import { createNotebook, type NotebookInternal } from './notebook';
import { createRandom, deriveSeed } from './random';
import { boundProgress, boundStats } from './results';
import { SDK_VERSION } from './version';

const DEFAULT_TIMEOUT_MS = 15_000;
/** Temps laissé à l'écriture de la sauvegarde de sortie (la plateforme en laisse 2 s, ADR 0004). */
const EXIT_SAVE_TIMEOUT_MS = 1500;
const MAX_START_DELAY_MS = 3000;

function waitForInit(bridge: GameBridge, timeoutMs: number): Promise<InitMessage> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      off();
      reject(new Error(`Duo: pas de message init en ${timeoutMs} ms`));
    }, timeoutMs);
    const off = bridge.onMessage((message) => {
      if (message.type !== 'init') return;
      clearTimeout(timer);
      off();
      resolve(message);
    });
  });
}

function decodeSave(init: InitMessage, log: Logger): LoadedSave | null {
  if (init.save === null) return null;
  const { data, ...meta } = init.save;
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(data));
    return { ...meta, data: parsed };
  } catch (error) {
    log.error('sauvegarde illisible: nouvelle partie', String(error));
    return null;
  }
}

function errorDetails(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return error.stack === undefined
      ? { message: error.message }
      : { message: error.message, stack: error.stack };
  }
  return { message: String(error) };
}

/**
 * Point d'entrée du jeu. Attend le pont de la plateforme (Duo ou le faux hôte), puis `init`,
 * et renvoie le contexte de la partie. Le paramètre de type nomme les actions du manifeste.
 *
 * ```ts
 * type Action = 'up' | 'down' | 'left' | 'right' | 'act';
 * const duo = await connect<Action>({ manifest });
 * ```
 */
export async function connect<TAction extends string = string>(
  options: ConnectOptions,
): Promise<DuoContext<TAction>> {
  const parsed = parseManifest(options.manifest);
  if (!parsed.ok) {
    throw new Error(`Duo: manifeste invalide\n${parsed.issues.join('\n')}`);
  }
  const manifest = parsed.manifest;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const port = options.port ?? (await waitForPort(timeoutMs));
  const bridge = createGameBridge(port);
  const initPromise = waitForInit(bridge, timeoutMs);
  bridge.send({ type: 'hello', bridge: BRIDGE_VERSION, sdk: SDK_VERSION });
  const init = await initPromise;

  // Même majeure exigée; une mineure plus récente de la plateforme reste compatible (ADR 0005, point 6).
  if (parseBridgeVersion(init.bridge)?.major !== parseBridgeVersion(BRIDGE_VERSION)?.major) {
    const message = `Duo: pont ${init.bridge} de la plateforme incompatible avec le pont ${BRIDGE_VERSION} du jeu`;
    bridge.send({ type: 'fatal', message });
    throw new Error(message);
  }
  return createContext<TAction>(manifest, bridge, init);
}

function createContext<TAction extends string>(
  manifest: GameManifest,
  bridge: GameBridge,
  init: InitMessage,
): DuoContext<TAction> {
  const send = (message: GameMessage, transfer?: Transferable[]): void => {
    bridge.send(message, transfer);
  };
  const disposers: (() => void)[] = [];

  // Créé plus bas, après les entrées; le journal et Échap le consultent dès qu'il existe.
  let notebook: NotebookInternal | null = null;
  const sendLog = (level: 'info' | 'warn' | 'error', message: string, data?: unknown): void => {
    notebook?.recordLog(level, message, data);
    try {
      send(
        data === undefined
          ? { type: 'log', level, message }
          : { type: 'log', level, message, data },
      );
    } catch {
      // Donnée non clonable: le message seul.
      send({ type: 'log', level, message });
    }
  };
  const log: Logger = {
    info: (message, data) => {
      sendLog('info', message, data);
    },
    warn: (message, data) => {
      sendLog('warn', message, data);
    },
    error: (message, data) => {
      sendLog('error', message, data);
    },
  };

  disposers.push(
    bridge.onInvalid((raw) => {
      log.warn('pont: message de la plateforme non conforme, ignoré', raw);
    }),
  );

  const host: Player = { ...init.players[0], local: init.players[0].id === init.localPlayerId };
  const guest: Player = { ...init.players[1], local: init.players[1].id === init.localPlayerId };
  const players: readonly [Player, Player] = [host, guest];
  const localPlayer = host.local ? host : guest;
  const remotePlayer = host.local ? guest : host;
  const playerById = (id: string | null): Player | null => players.find((p) => p.id === id) ?? null;

  let state: LifecycleState = 'loading';
  let settings: GameSettings = init.settings;
  let clockOffsetMs = init.clockOffsetMs;

  const listeners = new Map<keyof DuoEvents, Set<(payload: never) => void>>();
  const emit = <K extends keyof DuoEvents>(event: K, payload: DuoEvents[K]): void => {
    const set = listeners.get(event);
    if (set === undefined) return;
    for (const listener of set) (listener as (p: DuoEvents[K]) => void)(payload);
  };

  const hasDom = typeof window !== 'undefined' && typeof document !== 'undefined';
  const resolveUrl = (path: string): string =>
    hasDom ? new URL(path, document.baseURI).href : path;

  const input = createInput<TAction>(manifest.actions, settings.bindings, {
    onEscape: () => {
      send({ type: 'pauseRequest' });
    },
    escapeTaken: () => notebook?.typing === true,
    // Jamais hors de `running`: pendant une pause, un second `pauseRequest` vaudrait « reprendre ».
    onPointerEscape: () => {
      if (state === 'running') send({ type: 'pauseRequest' });
    },
  });
  disposers.push(() => {
    input.dispose();
  });

  const loop = createLoop({
    isPaused: () => state !== 'running',
    afterStep: () => {
      input.endStep();
    },
    afterRender: () => {
      notebook?.afterRender();
    },
  });
  disposers.push(() => {
    loop.dispose();
  });

  const localName = init.players.find((p) => p.id === init.localPlayerId)?.name ?? '';
  const notebookInternal = createNotebook({
    offer: init.notebook,
    send: (message) => {
      send(message);
    },
    releaseKeys: () => {
      input.releaseAll();
    },
    describe: () => ({
      jeu: `${manifest.name} ${init.game.version}`,
      jeuId: init.game.id,
      role: init.role === 'host' ? 'hôte' : 'invité',
      joueur: localName,
      partie: init.matchId,
      sdk: SDK_VERSION,
      pontPlateforme: init.bridge,
      etatDuCycle: state,
    }),
  });
  notebook = notebookInternal;
  disposers.push(() => {
    notebookInternal.dispose();
  });

  const audio = createAudio(settings.volumes, resolveUrl);
  disposers.push(() => {
    audio.dispose();
  });

  const net = createNet({
    role: init.role,
    send: (channel, mode, json) => {
      send({ type: 'net', channel, mode, data: json });
    },
    warn: (message, data) => {
      log.warn(message, data);
    },
    clockOffsetMs: () => clockOffsetMs,
  });
  disposers.push(() => {
    net.dispose();
  });

  // Sauvegardes et résultats (hôte).
  let saveProvider: (() => SaveSnapshot | null) | null = null;
  let nextRequestId = 1;
  const pendingSaves = new Map<number, (status: SaveStatus) => void>();
  let lastProgress: number | undefined = init.save?.progress;
  let sessionEnded = false;
  let summaryProvider: (() => SessionSummary | null) | null = null;

  /** `sessionEnd` borné aux limites du pont; sans progression du jeu, celle de la dernière sauvegarde. */
  const sessionEndMessage = (summary: SessionSummary | null, finished: boolean): GameMessage => {
    const progress = boundProgress(summary?.progress) ?? lastProgress;
    return {
      type: 'sessionEnd',
      stats: boundStats(summary?.stats),
      finished,
      ...(progress === undefined ? {} : { progress }),
    };
  };

  /** Résumé du fournisseur du jeu; s'il échoue, c'est journalisé et la séance se termine quand même. */
  const providedSummary = (): SessionSummary | null => {
    if (summaryProvider === null) return null;
    try {
      return summaryProvider();
    } catch (error) {
      log.error('résumé de séance: le fournisseur a échoué', String(error));
      return null;
    }
  };

  const writeSave = (moment: SaveMoment, snapshot: SaveSnapshot): Promise<SaveStatus> => {
    if (init.role !== 'host') return Promise.resolve('refused');
    if (!manifest.saves?.moments.includes(moment)) {
      log.warn(`sauvegarde: moment ${moment} non déclaré dans le manifeste`);
      return Promise.resolve('moment-not-declared');
    }
    let json: string;
    try {
      json = JSON.stringify(snapshot.data);
    } catch (error) {
      log.error('sauvegarde: données non sérialisables', String(error));
      return Promise.resolve('write-error');
    }
    const bytes = new TextEncoder().encode(json);
    if (bytes.byteLength > manifest.saves.maxBytes) {
      log.error(
        `sauvegarde: ${bytes.byteLength} octets, plus que maxBytes (${manifest.saves.maxBytes})`,
      );
      return Promise.resolve('too-large');
    }
    const requestId = nextRequestId++;
    const buffer = bytes.buffer;
    if (snapshot.progress !== undefined) lastProgress = snapshot.progress;
    return new Promise((resolve) => {
      pendingSaves.set(requestId, resolve);
      const message: GameMessage = {
        type: 'saveWrite',
        requestId,
        moment,
        label: snapshot.label.slice(0, 40) || 'Sauvegarde',
        dataSchema: snapshot.dataSchema,
        data: buffer,
        ...(snapshot.progress === undefined ? {} : { progress: snapshot.progress }),
      };
      send(message, [buffer]);
    });
  };

  const saveFromProvider = async (moment: 'auto' | 'exit'): Promise<void> => {
    if (saveProvider === null) return;
    let snapshot: SaveSnapshot | null;
    try {
      snapshot = saveProvider();
    } catch (error) {
      log.error('sauvegarde: le fournisseur a levé une erreur', String(error));
      return;
    }
    if (snapshot === null) return;
    const status = await writeSave(moment, snapshot);
    if (status !== 'ok') log.warn(`sauvegarde ${moment}: ${status}`);
  };

  const withTimeout = (promise: Promise<void>, ms: number): Promise<void> =>
    Promise.race([promise, new Promise<void>((resolve) => setTimeout(resolve, ms))]);

  let readyResolve: (() => void) | null = null;
  let startTimer: ReturnType<typeof setTimeout> | undefined;

  const handle = (message: PlatformMessage): void => {
    switch (message.type) {
      case 'init':
        log.warn('pont: second message init ignoré');
        return;
      case 'start': {
        if (state !== 'ready' && state !== 'loading') return;
        // Borné: une horloge de session encore mal estimée ne doit pas retarder le départ indéfiniment.
        const delay = Math.min(
          MAX_START_DELAY_MS,
          Math.max(0, message.atSessionMs - net.sessionTimeMs()),
        );
        startTimer = setTimeout(() => {
          state = 'running';
          emit('start', { atSessionMs: message.atSessionMs });
          readyResolve?.();
          readyResolve = null;
        }, delay);
        return;
      }
      case 'pause':
        if (state !== 'running') return;
        state = 'paused';
        input.releaseAll();
        emit('pause', { reason: message.reason, by: playerById(message.by) });
        return;
      case 'resume':
        if (state !== 'paused') return;
        state = 'running';
        emit('resume', {});
        return;
      case 'settings':
        settings = message.settings;
        input.setBindings(settings.bindings);
        audio.setVolumes(settings.volumes);
        emit('settings', settings);
        return;
      case 'saveRequest':
        void saveFromProvider(message.moment);
        return;
      case 'saveResult': {
        const resolve = pendingSaves.get(message.requestId);
        pendingSaves.delete(message.requestId);
        resolve?.(message.status);
        return;
      }
      case 'stop': {
        if (state === 'stopped') return;
        const previous = state;
        state = 'stopped';
        loop.stop();
        input.releaseAll();
        const exitSave = Promise.all([
          init.role === 'host' && message.save && previous !== 'loading'
            ? withTimeout(saveFromProvider('exit'), EXIT_SAVE_TIMEOUT_MS)
            : Promise.resolve(),
          // Les images d'après d'une note en cours partent avant la fin de la partie.
          withTimeout(notebookInternal.flush(), EXIT_SAVE_TIMEOUT_MS),
        ]);
        void exitSave.then(() => {
          if (init.role === 'host' && manifest.play === 'session' && !sessionEnded) {
            sessionEnded = true;
            send(sessionEndMessage(providedSummary(), false));
          }
          emit('stop', { reason: message.reason });
        });
        return;
      }
      case 'net':
        net.receive(message.channel, message.data);
        return;
      case 'notebookResult':
        notebookInternal.receiveResult(message.requestId, message.status);
        return;
      case 'link':
        clockOffsetMs = message.clockOffsetMs;
        net.setQuality({ rttMs: message.rttMs, jitterMs: message.jitterMs, state: message.state });
        emit('link', net.quality());
        return;
    }
  };
  disposers.push(bridge.onMessage(handle));

  // Battement de cœur et mesures, chaque seconde (ADR 0004).
  const heartbeat = setInterval(() => {
    send({ type: 'heartbeat' });
    const sample = loop.takePerfSample();
    send({ type: 'perf', fps: sample.fps, frameMs: sample.frameMs, stepHz: sample.stepHz });
  }, HEARTBEAT_INTERVAL_MS);
  disposers.push(() => {
    clearInterval(heartbeat);
  });

  // Toute erreur non rattrapée est fatale: l'état de la simulation n'est plus sûr (ADR 0004).
  const onError = (event: ErrorEvent): void => {
    send({ type: 'fatal', ...errorDetails(event.error ?? event.message) });
  };
  const onRejection = (event: PromiseRejectionEvent): void => {
    send({ type: 'fatal', ...errorDetails(event.reason) });
  };
  if (hasDom) {
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    disposers.push(() => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    });
  }

  const ui = (): UiSettings => ({ scale: settings.uiScale, reducedMotion: settings.reducedMotion });

  const base = {
    matchId: init.matchId,
    manifest,
    seed: init.seed,
    players,
    host,
    guest,
    localPlayer,
    remotePlayer,
    get state() {
      return state;
    },
    get settings() {
      return settings;
    },
    get ui() {
      return ui();
    },
    on<K extends keyof DuoEvents>(
      event: K,
      listener: (payload: DuoEvents[K]) => void,
    ): Unsubscribe {
      let set = listeners.get(event);
      if (set === undefined) {
        set = new Set();
        listeners.set(event, set);
      }
      const stored = listener as (payload: never) => void;
      set.add(stored);
      return () => set.delete(stored);
    },
    reportLoading(progress: number) {
      if (state !== 'loading') return;
      send({
        type: 'loading',
        progress: Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0)),
      });
    },
    ready(): Promise<void> {
      if (state === 'running' || state === 'paused') return Promise.resolve();
      if (state === 'stopped') return Promise.reject(new Error('Duo: partie déjà arrêtée'));
      return new Promise<void>((resolve) => {
        const previous = readyResolve;
        readyResolve = () => {
          previous?.();
          resolve();
        };
        if (state === 'loading') {
          state = 'ready';
          send({ type: 'ready' });
        }
      });
    },
    random(label?: string) {
      return createRandom(label === undefined ? init.seed : deriveSeed(init.seed, label));
    },
    loop,
    input,
    net,
    audio,
    assets: { url: resolveUrl },
    log,
    notebook: notebookInternal as Notebook,
    dispose() {
      if (startTimer !== undefined) clearTimeout(startTimer);
      for (const dispose of disposers.splice(0).reverse()) dispose();
      listeners.clear();
      pendingSaves.clear();
      bridge.close();
    },
  };

  if (init.role === 'guest') {
    // Object.assign garde les accesseurs de `base` (état, réglages), qu'un étalement figerait.
    const guestContext: GuestContext<TAction> = Object.assign(base, { role: 'guest' as const });
    return guestContext;
  }

  const saves: HostSaves = {
    slot: init.saveSlot,
    loaded: decodeSave(init, log),
    provide(provider) {
      saveProvider = provider;
    },
    write: (moment, snapshot) => writeSave(moment, snapshot),
  };
  const results: HostResults = {
    endMatch(result) {
      if (manifest.play !== 'match') {
        log.warn('results.endMatch: réservé aux jeux match');
        return;
      }
      const progress = boundProgress(result.progress);
      send({
        type: 'matchEnd',
        outcome: result.outcome,
        scores: { ...result.scores },
        stats: boundStats(result.stats),
        ...(progress === undefined ? {} : { progress }),
        ...(result.replayLabel === undefined ? {} : { replayLabel: result.replayLabel }),
      });
    },
    endSession(summary) {
      if (manifest.play !== 'session') {
        log.warn('results.endSession: réservé aux jeux session');
        return;
      }
      if (sessionEnded) return;
      sessionEnded = true;
      send(sessionEndMessage(summary ?? providedSummary(), true));
    },
    provideSummary(provider) {
      if (manifest.play !== 'session') {
        log.warn('results.provideSummary: réservé aux jeux session');
        return;
      }
      summaryProvider = provider;
    },
  };
  const hostContext: HostContext<TAction> = Object.assign(base, {
    role: 'host' as const,
    saves,
    results,
  });
  return hostContext;
}
