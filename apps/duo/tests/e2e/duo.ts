// Aides des tests Electron: lancer Duo sur un dossier de données jetable,
// retrouver la vue plateforme et la vue jeu parmi les pages de Playwright.
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';

export const APP_DIR = path.resolve(import.meta.dirname, '..', '..');
export const FIXTURE_GAMES = path.join(APP_DIR, 'tests', 'fixtures', 'jeux');
export const SCREENSHOTS = path.join(APP_DIR, 'test-results', 'captures');

export interface DuoInstance {
  readonly app: ElectronApplication;
  readonly platform: Page;
  readonly dataDir: string;
}

/** Dossier de données avec un nom difficile: espace, accents, apostrophe (CA-PF-013). */
export async function tempDataDir(label: string): Promise<string> {
  const base = await mkdtemp(path.join(tmpdir(), 'duo-e2e-'));
  const dir = path.join(base, `Données d'Hélène ${label}`);
  await mkdir(dir, { recursive: true });
  return dir;
}

/** Profil déjà créé et premier lancement terminé, pour aller droit à l'accueil. */
export async function seedProfile(dataDir: string, pseudo: string, color: string): Promise<void> {
  await writeFile(path.join(dataDir, 'profile.json'), JSON.stringify({ schema: 1, pseudo, color }));
  await writeFile(
    path.join(dataDir, 'settings.json'),
    JSON.stringify({
      schema: 1,
      reducedMotion: true,
      uiScale: 1,
      networkAccepted: true,
      setupDone: true,
      fullscreen: false,
    }),
  );
}

async function waitForPage(app: ElectronApplication, prefix: string, timeoutMs = 30_000): Promise<Page> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const page = app.windows().find((candidate) => candidate.url().startsWith(prefix));
    if (page !== undefined) return page;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Aucune page ${prefix} après ${timeoutMs} ms`);
}

export async function launchDuo(options: {
  dataDir: string;
  liaisonPort: number;
  gamesDir?: string;
}): Promise<DuoInstance> {
  const args = [
    APP_DIR,
    `--duo-data-dir=${options.dataDir}`,
    `--duo-liaison-port=${options.liaisonPort}`,
    // WebGL2 en rendu logiciel dans l'environnement cloud (ADR 0013, point 8).
    '--enable-unsafe-swiftshader',
  ];
  if (options.gamesDir !== undefined) args.push(`--duo-games-dir=${options.gamesDir}`);
  // Electron refuse de tourner en root sans cette option (environnement cloud seulement).
  if (process.getuid?.() === 0) args.unshift('--no-sandbox');
  const app = await electron.launch({ args, cwd: APP_DIR });
  const platform = await waitForPage(app, 'duo://app/');
  await platform.waitForSelector('[data-testid^="ecran-"]');
  return { app, platform, dataDir: options.dataDir };
}

/**
 * Vraie touche du clavier système (X11, `xdotool`), envoyée à la vue jeu après lui avoir
 * donné le focus: seul ce chemin passe par `before-input-event`, où le principal
 * intercepte Échap. Les touches simulées par Playwright arrivent directement à la page.
 */
export async function pressNativeKey(instance: DuoInstance, key: string): Promise<void> {
  await instance.app.evaluate(({ BaseWindow, webContents }) => {
    BaseWindow.getAllWindows()[0]?.focus();
    webContents
      .getAllWebContents()
      .find((contents) => contents.getURL().startsWith('duo-game://'))
      ?.focus();
  });
  await promisify(execFile)('xdotool', ['key', key]);
}

export function gamePage(instance: DuoInstance): Promise<Page> {
  return waitForPage(instance.app, 'duo-game://');
}

function within(promise: Promise<unknown>, ms: number): Promise<boolean> {
  return Promise.race([
    promise.then(
      () => true,
      () => true,
    ),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), ms)),
  ]);
}

/**
 * Ferme Duo. Pendant une partie, quitter demande confirmation (M-15): on confirme.
 * En dernier recours, le processus est tué pour ne pas bloquer la suite des tests.
 */
export async function closeDuo(instance: DuoInstance): Promise<void> {
  const closing = instance.app.close();
  if (await within(closing, 4000)) return;
  const confirm = instance.platform.getByTestId('quitter-confirmer');
  if (await confirm.isVisible().catch(() => false)) await confirm.click().catch(() => undefined);
  if (await within(closing, 6000)) return;
  instance.app.process().kill('SIGKILL');
}
