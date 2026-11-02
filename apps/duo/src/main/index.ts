// Point d'entrée du processus principal (ADR 0003). Ordre imposé: dossier de
// données (`--duo-data-dir`), puis verrou d'instance unique (pris dans ce
// dossier), puis protocoles privilégiés, puis tout le reste après `ready`.
import os from 'node:os';
import path from 'node:path';
import {
  BaseWindow,
  Menu,
  app,
  crashReporter,
  dialog,
  ipcMain,
  net,
  session,
  type IpcMainInvokeEvent,
} from 'electron';
import {
  IPC_GET_STATE,
  IPC_INTENT_PREFIX,
  INTENT_CHANNELS,
  type IntentChannel,
} from '../shared/ipc';
import { parseCommandLine } from './args';
import { LocalSaves } from './data/local-saves';
import { MachineStore } from './data/store';
import { scanGames, type Catalog, type GameEntry, type GameRoot } from './games/catalog';
import { GameInstaller, type InstallOutcome } from './games/installer';
import { trustedKeys } from './games/trusted-keys';
import { CATALOGUE_URL, GameUpdater } from './games/updater';
import { bridgeCodec } from './game-host/bridge';
import { GameHost } from './game-host/game-host';
import { checkIntent } from './ipc-schemas';
import { createJournal, systemSanitizer, type Journal } from './journal';
import { NetworkLiaison } from './liaison/network-liaison';
import { buildApplicationMenu } from './menu';
import { Platform } from './platform';
import { APP_ORIGIN, handleAppProtocol, handleGameProtocol, registerSchemes } from './protocols';
import { hardenSession } from './security';
import { AppWindow } from './window';

const APP_USER_MODEL_ID = 'io.github.haeev.duo';
const GAME_PARTITION = 'duo-jeux';

const options = parseCommandLine(process.argv, process.cwd());
if (options.dataDir !== null) {
  app.setPath('userData', options.dataDir);
}
app.setAppUserModelId(APP_USER_MODEL_ID);

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  registerSchemes();
  crashReporter.start({ uploadToServer: false });
  void app.whenReady().then(start);
}

const isMac = process.platform === 'darwin';
const devTools = !app.isPackaged;
const outDir = path.resolve(import.meta.dirname, '..');

function gameRoots(): GameRoot[] {
  const roots: GameRoot[] = [];
  if (options.gamesDir !== null) roots.push({ source: 'extra', dir: options.gamesDir });
  if (!app.isPackaged) {
    // Développement: jeux construits du dépôt (apps/duo/out/main vers la racine).
    roots.push({ source: 'dev', dir: path.resolve(outDir, '../../../games') });
  }
  roots.push({ source: 'installed', dir: installedGamesDir() });
  roots.push({ source: 'bundled', dir: path.join(process.resourcesPath, 'games') });
  return roots;
}

function installedGamesDir(): string {
  return path.join(app.getPath('userData'), 'games');
}

/**
 * Adresse du catalogue. Une version de test ne lit que `DUO_TEST_CATALOGUE_URL`
 * (faux catalogue local), et ne cherche rien sans elle: tests reproductibles.
 */
function catalogueUrl(): string | null {
  if (DUO_TEST) return process.env.DUO_TEST_CATALOGUE_URL ?? null;
  return CATALOGUE_URL;
}

/** Paquets téléchargés en https; une version de test admet aussi la boucle locale. */
function allowPackageUrl(url: string): boolean {
  if (url.startsWith('https://')) return true;
  return DUO_TEST && /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(url);
}

function platformName(): 'darwin' | 'win32' | 'linux' {
  return process.platform === 'darwin' || process.platform === 'win32' ? process.platform : 'linux';
}

function registerIpc(
  platform: Platform,
  journal: Journal,
  isPlatformSender: (event: IpcMainInvokeEvent) => boolean,
): void {
  ipcMain.handle(IPC_GET_STATE, (event) => {
    if (!isPlatformSender(event)) throw new Error('émetteur refusé');
    return platform.snapshot();
  });
  for (const channel of INTENT_CHANNELS) {
    ipcMain.handle(`${IPC_INTENT_PREFIX}${channel}`, async (event, raw: unknown) => {
      if (!isPlatformSender(event)) {
        journal.write('warn', 'ipc', 'sender-refused', { channel });
        return { ok: false, error: 'émetteur refusé' };
      }
      return handle(platform, journal, channel, raw);
    });
  }
}

async function handle(
  platform: Platform,
  journal: Journal,
  channel: IntentChannel,
  raw: unknown,
): Promise<unknown> {
  const check = checkIntent(channel, raw);
  if (!check.ok) {
    journal.write('warn', 'ipc', 'invalid-argument', { channel, error: check.error });
    return { ok: false, error: 'argument invalide' };
  }
  try {
    return await platform.handleIntent(channel, check.value);
  } catch (error) {
    journal.write('error', 'ipc', 'intent-failed', {
      channel,
      message: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, error: 'échec' };
  }
}

async function start(): Promise<void> {
  const userData = app.getPath('userData');
  const journal = createJournal(path.join(userData, 'logs'), systemSanitizer());
  journal.write('info', 'app', 'starting', {
    version: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    platform: process.platform,
    arch: process.arch,
    test: DUO_TEST,
  });

  Menu.setApplicationMenu(isMac ? buildApplicationMenu() : null);

  const store = new MachineStore(userData);
  const loaded = await store.load();
  if ('kind' in loaded) {
    // M-29 (données d'une version plus récente): écran dédié au lot L9.
    journal.write('error', 'data', 'format-too-new', { format: loaded.format });
    app.quit();
    return;
  }
  for (const file of loaded.recovered) journal.write('warn', 'data', 'file-recovered', { file });

  let gameRootById = new Map<string, string>();
  const loadCatalog = async (): Promise<Catalog> => {
    const scanned = await scanGames(gameRoots());
    for (const problem of scanned.problems) {
      journal.write('warn', 'games', 'manifest-invalid', {
        folder: problem.folder,
        problems: problem.problems,
      });
    }
    journal.write('info', 'games', 'catalog', {
      games: scanned.games.map(
        (game: GameEntry) => `${game.manifest.id}@${game.manifest.version} (${game.source})`,
      ),
    });
    gameRootById = new Map(scanned.games.map((game) => [game.manifest.id, game.root]));
    return scanned;
  };
  const catalog = await loadCatalog();

  const defaultSession = session.defaultSession;
  const gameSession = session.fromPartition(GAME_PARTITION);
  hardenSession(defaultSession, { allowGamePermissions: false });
  hardenSession(gameSession, { allowGamePermissions: true });

  const rendererDir = path.join(outDir, 'renderer');
  handleAppProtocol(defaultSession, rendererDir);
  // Vignettes dans le lanceur et pages des jeux dans leur session.
  handleGameProtocol(defaultSession, (id) => gameRootById.get(id) ?? null);
  handleGameProtocol(gameSession, (id) => gameRootById.get(id) ?? null);

  for (const option of options.network.invalid) {
    journal.write('warn', 'app', 'option-invalide', { option: option.split('=')[0] });
  }
  // Réseau local de dev-reseau (ADR 0007 et 0008). Rien n'écoute avant l'accord de E03:
  // `start()` est appelé par `startLiaisonIfAllowed`.
  const liaison = new NetworkLiaison({
    journal,
    network: options.network,
    storePath: path.join(userData, 'reseau.json'),
    computerName: os.hostname(),
    electron: process.versions.electron,
    os: process.platform,
    arch: process.arch,
  });

  const gamesDir = installedGamesDir();
  const installer = new GameInstaller({
    gamesDir,
    trustedKeys: trustedKeys(),
    effectiveVersion: (id) => platform.gameVersion(id),
  });
  /** Installation réussie: catalogue relu (Duo est au repos), puis bibliothèque publiée. */
  const afterInstall = async (outcome: InstallOutcome): Promise<void> => {
    if (outcome.ok) await platform.setGames((await loadCatalog()).games);
  };
  const pickPackage = async (): Promise<string | null> => {
    // Version de test: fichier désigné par l'essai, sans boîte de dialogue.
    if (DUO_TEST && process.env.DUO_TEST_FICHIER_JEU !== undefined) {
      return process.env.DUO_TEST_FICHIER_JEU;
    }
    const parent = appWindow?.window;
    const options: Electron.OpenDialogOptions = {
      title: 'Installer un jeu depuis un fichier',
      filters: [{ name: 'Jeu Duo', extensions: ['duogame'] }],
      properties: ['openFile'],
    };
    const chosen =
      parent === undefined
        ? await dialog.showOpenDialog(options)
        : await dialog.showOpenDialog(parent, options);
    return chosen.canceled ? null : (chosen.filePaths[0] ?? null);
  };
  const installFromFile = async (): Promise<InstallOutcome | null> => {
    const file = await pickPackage();
    if (file === null) return null;
    const outcome = await installer.install({ archive: file, move: false });
    journal.write(outcome.ok ? 'info' : 'warn', 'games', 'import', {
      ok: outcome.ok,
      ...(outcome.ok
        ? { id: outcome.id, version: outcome.version }
        : { reason: outcome.reason, ...('detail' in outcome ? { detail: outcome.detail } : {}) }),
    });
    await afterInstall(outcome);
    return outcome;
  };
  const url = catalogueUrl();
  const updater =
    url === null
      ? null
      : new GameUpdater({
          catalogueUrl: url,
          // `net.fetch`: pile réseau de Chromium, avec le mandataire du système.
          fetch: (target, init) => net.fetch(target, { signal: init.signal }),
          incomingDir: path.join(gamesDir, '.incoming'),
          install: (request) => installer.install(request),
          effectiveVersion: (id) => platform.gameVersion(id),
          isIdle: () => platform.isIdle(),
          allowUrl: allowPackageUrl,
          onInstalled: async (outcome) => {
            await afterInstall(outcome);
            platform.announceInstalled(outcome);
          },
          journal,
        });
  let updaterStarted = false;

  const platform = new Platform({
    journal,
    store,
    saves: new LocalSaves(userData),
    liaison,
    machineId: loaded.machineId,
    appVersion: app.getVersion(),
    platform: platformName(),
    profile: loaded.profile,
    settings: loaded.settings,
    games: catalog.games,
    installFromFile,
    onIdleChange: (idle) => {
      if (idle) updater?.resume();
      else updater?.suspend();
    },
    requestQuit: () => {
      app.quit();
    },
  });
  await platform.refreshSaveSummaries();

  let appWindow: AppWindow | null = null;
  const devServer = process.env.ELECTRON_RENDERER_URL;
  const launcherUrl =
    !app.isPackaged && devServer !== undefined ? devServer : `${APP_ORIGIN}/index.html`;

  const isPlatformSender = (event: IpcMainInvokeEvent): boolean => {
    const frameUrl = event.senderFrame?.url ?? '';
    const expected = appWindow?.platformView.webContents;
    return (
      expected !== undefined &&
      event.sender === expected &&
      frameUrl.startsWith(launcherUrl.replace(/index\.html$/, ''))
    );
  };
  registerIpc(platform, journal, isPlatformSender);

  const createWindow = (): void => {
    if (appWindow?.alive === true) {
      appWindow.window.focus();
      return;
    }
    const created = new AppWindow({
      platformPreload: path.join(outDir, 'preload', 'platform.cjs'),
      launcherUrl,
      fullscreen: loaded.settings.fullscreen,
      devTools,
      isMac,
      onClose: (event) => {
        if (platform.interceptClose()) event.preventDefault();
      },
      onClosed: () => {
        gameHost.destroy();
        platform.detachWindow();
        appWindow = null;
      },
      onLauncherLoaded: () => {
        journal.write('info', 'app', 'launcher-ready');
        // Recherche des jeux une fois le lanceur affiché (CA-PF-088), une seule fois par lancement.
        if (!updaterStarted) {
          updaterStarted = true;
          updater?.start();
        }
      },
      onFullscreenChange: (fullscreen) => {
        platform.onFullscreenChange(fullscreen);
      },
      onResize: (bounds) => {
        platform.onResize(bounds);
      },
    });
    appWindow = created;
    gameHost = new GameHost({
      window: created.window,
      session: gameSession,
      preload: path.join(outDir, 'preload', 'game.cjs'),
      codec: bridgeCodec,
      journal,
      events: platform.gameEvents,
      isMac,
      devTools,
    });
    platform.attachGameHost(gameHost);
    platform.attachWindow(created);
    platform.publish();
  };

  let gameHost: GameHost;
  createWindow();
  await platform.startLiaisonIfAllowed();

  app.on('second-instance', () => {
    createWindow();
  });
  app.on('activate', () => {
    createWindow();
  });
  app.on('window-all-closed', () => {
    if (!isMac) app.quit();
  });
  let shutdownDone = false;
  app.on('before-quit', (event) => {
    if (shutdownDone) return;
    event.preventDefault();
    // ⌘Q pendant une partie: même confirmation que la fermeture de la fenêtre (M-15).
    if (platform.interceptClose()) return;
    updater?.stop();
    void platform.shutdown().finally(() => {
      shutdownDone = true;
      app.quit();
    });
  });

  if (DUO_TEST) {
    // Crochets de test (ADR 0013): absents des versions publiées.
    (globalThis as { __duoTest?: unknown }).__duoTest = {
      state: () => platform.snapshot(),
      liaison: () => liaison.stats(),
      dataDir: userData,
      checkGames: () => updater?.check() ?? null,
      platformView: () => ({
        visible: appWindow?.platformView.getVisible() ?? null,
        bounds: appWindow?.platformView.getBounds() ?? null,
        windows: BaseWindow.getAllWindows().length,
      }),
    };
  }
}
