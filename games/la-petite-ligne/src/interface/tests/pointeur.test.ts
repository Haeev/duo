/**
 * Clavier et souris dans Chromium, sur la page de démonstration de
 * l'interface (vraie simulation, sans rendu 3D). Ignoré sans Chromium (CI
 * sans navigateur): ces cas tournent dans l'environnement du studio.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { type Browser, type Page, chromium } from '@playwright/test';
import { type ViteDevServer, createServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const executable = [process.env.DUO_CHROMIUM, '/opt/pw-browsers/chromium', chromium.executablePath()].find(
  (path): path is string => path !== undefined && path !== '' && existsSync(path),
);
const SETUP_MS = 90_000;

describe.skipIf(executable === undefined)('interface au pointeur et au clavier (Chromium)', () => {
  let server: ViteDevServer;
  let browser: Browser;
  let base = '';

  beforeAll(async () => {
    // Serveur sans rechargement ni surveillance: les modifications des autres membres ne le troublent pas.
    server = await createServer({ root, logLevel: 'silent', server: { port: 0, host: '127.0.0.1', hmr: false, watch: null } });
    await server.listen();
    base = server.resolvedUrls?.local[0] ?? '';
    browser = await chromium.launch({ executablePath: executable });
  }, SETUP_MS);

  afterAll(async () => {
    await browser.close();
    await server.close();
  });

  async function openHud(): Promise<Page> {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    await page.goto(`${base}src/interface/demo/index.html?scenario=hud&autre=fige&rendu=0`);
    await page.waitForFunction(() => window.lplInterface?.ready === true, null, { timeout: 60_000 });
    await page.locator('.lpl-hud:not([hidden]) .lpl-shortcut').first().waitFor();
    return page;
  }

  it("un clic sur le bouton de caméra ne lui laisse pas le clavier: Espace va au jeu, la caméra n'est commandée qu'une fois", async () => {
    const page = await openHud();
    await page.getByRole('button', { name: /^Tourner la caméra à gauche/ }).click();
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
    await page.keyboard.press('Space');
    await page.waitForTimeout(150);
    const log = await page.evaluate(() => window.lplInterface?.log ?? { camera: [], intents: [] });
    expect(log.camera).toEqual(['rotate_left']);
    expect(log.intents.filter((type) => type === 'act')).toHaveLength(1);
    await page.close();
  }, SETUP_MS);

  it('le carnet garde la navigation au clavier: Tab l’ouvre avec le focus dedans, Retour arrière le ferme', async () => {
    const page = await openHud();
    await page.keyboard.press('Tab');
    await page.locator('.lpl-panel').waitFor();
    await page.waitForTimeout(350);
    expect(await page.evaluate(() => document.activeElement?.closest('.lpl-panel') !== null)).toBe(true);
    await page.keyboard.press('KeyE');
    await expect.poll(() => page.evaluate(() => document.querySelector('.lpl-tab[aria-selected="true"]')?.getAttribute('data-tab'))).toBe('mail');
    await page.keyboard.press('Backspace');
    await page.locator('.lpl-panel').waitFor({ state: 'detached' });
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
    await page.close();
  }, SETUP_MS);
});
