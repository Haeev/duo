// Fenêtre de Duo (ADR 0003, module `window`; ADR 0004, point 2): une BaseWindow,
// la vue plateforme au-dessus (transparente pendant une partie), la vue jeu
// dessous, créée par l'hébergement des jeux.
import { BaseWindow, WebContentsView, type Rectangle } from 'electron';
import { IPC_STATE } from '../shared/ipc';
import type { AppState } from '../shared/state';

export type PlatformLayer =
  /** Interface pleine fenêtre, au-dessus du jeu s'il y en a un. */
  | { readonly kind: 'full'; readonly focus: boolean }
  /** Bandeau d'indication en haut, le jeu garde le clavier. */
  | { readonly kind: 'hint' }
  /** Masquée: le jeu reçoit clavier et souris. */
  | { readonly kind: 'hidden' };

export interface AppWindowOptions {
  readonly platformPreload: string;
  readonly launcherUrl: string;
  readonly fullscreen: boolean;
  readonly devTools: boolean;
  readonly isMac: boolean;
  readonly onClose: (event: Electron.Event) => void;
  readonly onClosed: () => void;
  readonly onLauncherLoaded: () => void;
  readonly onFullscreenChange: (fullscreen: boolean) => void;
  readonly onResize: (bounds: Rectangle) => void;
}

const HINT_WIDTH = 360;
const HINT_HEIGHT = 72;

export class AppWindow {
  readonly window: BaseWindow;
  readonly platformView: WebContentsView;
  private layer: PlatformLayer = { kind: 'full', focus: true };

  constructor(private readonly options: AppWindowOptions) {
    this.window = new BaseWindow({
      title: 'Duo',
      width: 1280,
      height: 800,
      minWidth: 960,
      minHeight: 600,
      backgroundColor: '#0E1126',
      show: false,
      fullscreenable: true,
    });
    this.platformView = new WebContentsView({
      webPreferences: {
        preload: options.platformPreload,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true,
        webviewTag: false,
        spellcheck: false,
        devTools: options.devTools,
      },
    });
    // Le fond est peint par la page; transparent pour laisser voir le jeu dessous.
    this.platformView.setBackgroundColor('#00000000');
    this.window.contentView.addChildView(this.platformView);

    const contents = this.platformView.webContents;
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
    contents.on('will-navigate', (event) => {
      event.preventDefault();
    });
    contents.on('will-attach-webview', (event) => {
      event.preventDefault();
    });
    contents.on('before-input-event', (event, input) => {
      if (input.code === 'F11' && !options.isMac && input.type === 'keyDown') {
        event.preventDefault();
        if (!input.isAutoRepeat) this.toggleFullscreen();
      }
    });
    contents.once('did-finish-load', () => {
      this.window.show();
      contents.focus();
      options.onLauncherLoaded();
    });

    this.window.on('resize', () => {
      this.layout();
    });
    this.window.on('enter-full-screen', () => {
      options.onFullscreenChange(true);
      this.layout();
    });
    this.window.on('leave-full-screen', () => {
      options.onFullscreenChange(false);
      this.layout();
    });
    this.window.on('close', (event) => {
      options.onClose(event);
    });
    this.window.on('closed', () => {
      options.onClosed();
    });
    this.window.on('focus', () => {
      if (this.layer.kind === 'full') contents.focus();
    });

    this.window.maximize();
    if (options.fullscreen) this.window.setFullScreen(true);
    this.layout();
    void contents.loadURL(options.launcherUrl);
  }

  get alive(): boolean {
    return !this.window.isDestroyed();
  }

  contentBounds(): Rectangle {
    const [width = 0, height = 0] = this.window.getContentSize();
    return { x: 0, y: 0, width, height };
  }

  publish(state: AppState): void {
    if (!this.platformView.webContents.isDestroyed()) {
      this.platformView.webContents.send(IPC_STATE, state);
    }
  }

  setLayer(layer: PlatformLayer): void {
    const previous = this.layer;
    this.layer = layer;
    this.layout();
    if (layer.kind === 'full' && layer.focus && (previous.kind !== 'full' || !previous.focus)) {
      this.platformView.webContents.focus();
    }
  }

  toggleFullscreen(): void {
    this.window.setFullScreen(!this.window.isFullScreen());
  }

  focusPlatform(): void {
    this.platformView.webContents.focus();
  }

  private layout(): void {
    if (this.window.isDestroyed()) return;
    const bounds = this.contentBounds();
    switch (this.layer.kind) {
      case 'full':
        this.platformView.setBounds(bounds);
        this.platformView.setVisible(true);
        break;
      case 'hint':
        this.platformView.setBounds({
          x: Math.round((bounds.width - HINT_WIDTH) / 2),
          y: 0,
          width: Math.min(HINT_WIDTH, bounds.width),
          height: HINT_HEIGHT,
        });
        this.platformView.setVisible(true);
        break;
      case 'hidden':
        this.platformView.setVisible(false);
        break;
    }
    this.options.onResize(bounds);
  }
}
