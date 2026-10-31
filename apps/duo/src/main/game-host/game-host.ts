// Hébergement d'un jeu (ADR 0004): une WebContentsView par partie, sous la vue
// plateforme, dans une session non persistante; pont par MessagePort (le jeu dit
// `hello`, la plateforme répond `init`); battement de cœur; plantage, blocage et
// échec du chargement signalés une seule fois; Échap interceptée; mise en veille
// de l'écran bloquée tant que la vue existe.
import {
  MessageChannelMain,
  WebContentsView,
  powerSaveBlocker,
  type BaseWindow,
  type MessagePortMain,
  type Rectangle,
  type Session,
} from 'electron';
import type { Journal } from '../journal';
import type {
  BridgeCodec,
  GameMessage,
  InitMessage,
  PlatformMessage,
  SaveMoment,
  SaveStatus,
  StopReason,
} from './bridge';
import { Watchdog, type WatchdogExpiry } from './watchdog';

export type GameFailureReason = 'crashed' | 'hung' | 'load-timeout' | 'load-failed' | 'fatal';

export interface GameFailure {
  readonly reason: GameFailureReason;
  readonly detail: string;
}

export interface SaveWriteRequest {
  readonly moment: SaveMoment;
  readonly label: string;
  readonly progress: number | null;
  readonly dataSchema: number;
  readonly data: Uint8Array;
}

export type MatchEndMessage = Extract<GameMessage, { type: 'matchEnd' }>;
export type SessionEndMessage = Extract<GameMessage, { type: 'sessionEnd' }>;

export interface GameHostEvents {
  loading(progress: number): void;
  ready(): void;
  failure(failure: GameFailure): void;
  /** Échap interceptée par le principal (ou `pauseRequest` du SDK, par sûreté). */
  escape(): void;
  toggleFullscreen(): void;
  /** Message pour l'instance du jeu sur l'autre machine: texte JSON relayé tel quel. */
  net(channel: number, mode: 'reliable' | 'latest', data: string): void;
  saveWrite(request: SaveWriteRequest): Promise<SaveStatus>;
  matchEnd(message: MatchEndMessage): void;
  sessionEnd(message: SessionEndMessage): void;
}

export interface GameHostDeps {
  readonly window: BaseWindow;
  readonly session: Session;
  readonly preload: string;
  readonly codec: BridgeCodec;
  readonly journal: Journal;
  readonly events: GameHostEvents;
  readonly isMac: boolean;
  readonly devTools: boolean;
}

const STOP_SAVE_GRACE_MS = 2000;
export const BRIDGE_PORT_CHANNEL = 'duo:bridge-port';

export class GameHost {
  private view: WebContentsView | null = null;
  private port: MessagePortMain | null = null;
  private init: InitMessage | null = null;
  private blocker: number | null = null;
  private failed = false;
  private stopWaiter: (() => void) | null = null;
  private pendingSaves = 0;
  private readonly watchdog: Watchdog;

  constructor(private readonly deps: GameHostDeps) {
    this.watchdog = new Watchdog((reason) => {
      this.onWatchdog(reason);
    });
  }

  get active(): boolean {
    return this.view !== null;
  }

  launch(gameId: string, entryUrl: string, init: InitMessage, bounds: Rectangle): void {
    this.destroy();
    this.failed = false;
    this.init = init;
    const { journal } = this.deps;
    const view = new WebContentsView({
      webPreferences: {
        preload: this.deps.preload,
        session: this.deps.session,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true,
        webviewTag: false,
        spellcheck: false,
        backgroundThrottling: false,
        devTools: this.deps.devTools,
      },
    });
    this.view = view;
    view.setBackgroundColor('#0E1126');
    view.setBounds(bounds);
    // Index 0: la vue jeu passe sous la vue plateforme.
    this.deps.window.contentView.addChildView(view, 0);

    const contents = view.webContents;
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
    contents.on('will-navigate', (event) => {
      event.preventDefault();
    });
    contents.on('render-process-gone', (_event, details) => {
      if (this.view !== view) return;
      this.fail({ reason: 'crashed', detail: details.reason });
    });
    contents.on('did-fail-load', (_event, code, description, _url, isMainFrame) => {
      if (this.view !== view || !isMainFrame) return;
      this.fail({ reason: 'load-failed', detail: `${code} ${description}` });
    });
    contents.on('before-input-event', (event, input) => {
      if (input.code === 'Escape') {
        event.preventDefault();
        if (input.type === 'keyDown' && !input.isAutoRepeat) this.deps.events.escape();
      } else if (input.code === 'F11' && !this.deps.isMac) {
        event.preventDefault();
        if (input.type === 'keyDown' && !input.isAutoRepeat) this.deps.events.toggleFullscreen();
      }
    });
    contents.on('console-message', (event) => {
      if (event.level === 'error' || event.level === 'warning') {
        journal.write(event.level === 'error' ? 'error' : 'warn', 'game', 'console', {
          game: gameId,
          message: event.message.slice(0, 2000),
        });
      }
    });

    const { port1, port2 } = new MessageChannelMain();
    this.port = port1;
    port1.on('message', (event) => {
      if (this.view === view) this.onMessage(gameId, event.data);
    });
    port1.start();
    contents.once('dom-ready', () => {
      if (this.view === view) contents.postMessage(BRIDGE_PORT_CHANNEL, null, [port2]);
    });

    this.watchdog.start();
    this.blocker = powerSaveBlocker.start('prevent-display-sleep');
    journal.write('info', 'game-host', 'game-loading', { game: gameId });
    contents.loadURL(entryUrl).catch((error: unknown) => {
      if (this.view !== view) return;
      this.fail({ reason: 'load-failed', detail: error instanceof Error ? error.message : String(error) });
    });
  }

  send(message: PlatformMessage): void {
    this.port?.postMessage(this.deps.codec.encode(message));
  }

  setBounds(bounds: Rectangle): void {
    this.view?.setBounds(bounds);
  }

  focus(): void {
    this.view?.webContents.focus();
  }

  /** Arrête le jeu; avec `save`, lui laisse 2 s pour écrire avant de détruire la vue. */
  async stop(reason: StopReason, save: boolean): Promise<void> {
    if (this.view === null) return;
    if (!this.failed) {
      this.send({ type: 'stop', reason, save });
      if (save) {
        await new Promise<void>((resolve) => {
          const timer = setTimeout(done, STOP_SAVE_GRACE_MS);
          function done(): void {
            clearTimeout(timer);
            resolve();
          }
          this.stopWaiter = done;
        });
        this.stopWaiter = null;
      }
    }
    this.destroy();
  }

  destroy(): void {
    this.watchdog.stop();
    this.stopWaiter = null;
    this.init = null;
    const view = this.view;
    this.view = null;
    this.port?.close();
    this.port = null;
    if (this.blocker !== null) {
      powerSaveBlocker.stop(this.blocker);
      this.blocker = null;
    }
    if (view !== null) {
      this.deps.window.contentView.removeChildView(view);
      if (!view.webContents.isDestroyed()) view.webContents.close();
      // Session non persistante, mais vivante tant que Duo tourne: on la vide à chaque partie.
      this.deps.session.clearStorageData().catch(() => undefined);
      this.deps.journal.write('info', 'game-host', 'game-view-destroyed');
    }
  }

  private fail(failure: GameFailure): void {
    if (this.failed) return;
    this.failed = true;
    this.watchdog.stop();
    this.deps.journal.write('error', 'game-host', 'game-failure', { ...failure });
    this.deps.events.failure(failure);
  }

  private onWatchdog(reason: WatchdogExpiry): void {
    const view = this.view;
    if (view === null) return;
    if (reason === 'hung' && !view.webContents.isDestroyed()) {
      view.webContents.forcefullyCrashRenderer();
    }
    this.fail({ reason, detail: reason === 'hung' ? 'battement de cœur absent' : 'ready absent' });
  }

  private onMessage(gameId: string, data: unknown): void {
    const message = this.deps.codec.decode(data);
    if (message === null) {
      this.deps.journal.write('warn', 'game-host', 'bridge-invalid-message', {
        game: gameId,
        type: typeof data === 'object' && data !== null && 'type' in data ? String(data.type) : typeof data,
        keys: typeof data === 'object' && data !== null ? Object.keys(data).join(',') : '',
        detail: typeof data === 'object' && data !== null && 'data' in data ? Object.prototype.toString.call(data.data) : '',
      });
      return;
    }
    const { events } = this.deps;
    switch (message.type) {
      case 'hello':
        this.watchdog.heartbeat();
        if (!this.deps.codec.accepts(message.bridge)) {
          this.fail({ reason: 'fatal', detail: `pont ${message.bridge} du jeu incompatible avec ${this.deps.codec.version}` });
          return;
        }
        this.deps.journal.write('info', 'game-host', 'bridge-hello', { game: gameId, bridge: message.bridge, sdk: message.sdk });
        if (this.init !== null) this.send(this.init);
        return;
      case 'loading':
        this.watchdog.heartbeat();
        events.loading(message.progress);
        return;
      case 'ready':
        this.watchdog.ready();
        events.ready();
        return;
      case 'heartbeat':
        this.watchdog.heartbeat();
        return;
      case 'perf':
        return;
      case 'pauseRequest':
        events.escape();
        return;
      case 'saveWrite':
        this.pendingSaves += 1;
        void events
          .saveWrite({
            moment: message.moment,
            label: message.label,
            progress: message.progress ?? null,
            dataSchema: message.dataSchema,
            data: new Uint8Array(message.data),
          })
          .then((status) => {
            this.send({ type: 'saveResult', requestId: message.requestId, status });
          })
          .finally(() => {
            this.pendingSaves -= 1;
            // Sauvegarde de sortie écrite: le jeu n'a plus rien à dire avant sa destruction.
            if (message.moment === 'exit' && this.pendingSaves === 0) this.stopWaiter?.();
          });
        return;
      case 'matchEnd':
        events.matchEnd(message);
        return;
      case 'sessionEnd':
        events.sessionEnd(message);
        if (this.pendingSaves === 0) this.stopWaiter?.();
        return;
      case 'fatal':
        this.fail({ reason: 'fatal', detail: message.message.slice(0, 500) });
        return;
      case 'log':
        this.deps.journal.write(message.level, 'game', 'log', { game: gameId, message: message.message });
        return;
      case 'net':
        events.net(message.channel, message.mode, message.data);
        return;
    }
  }
}
