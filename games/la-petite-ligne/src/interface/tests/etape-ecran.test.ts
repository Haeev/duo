/**
 * Écran d'étape dans Chromium (tour 8, section 1.2), sur la page de démonstration partie de la
 * sauvegarde de référence du jour 15: focus sur « Rester à la Halte », Retour arrière et Échap ne
 * ferment rien, flèches et Entrée au clavier, clic à la souris, choix de l'autre visible, reprise
 * à l'accord avec la notification « La Halte continue ». Ignoré sans Chromium (CI sans navigateur).
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { type Browser, type Page, chromium } from '@playwright/test';
import { type ViteDevServer, createServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const executable = [
  process.env.DUO_CHROMIUM,
  '/opt/pw-browsers/chromium',
  chromium.executablePath(),
].find((path): path is string => path !== undefined && path !== '' && existsSync(path));
const SETUP_MS = 120_000;

describe.skipIf(executable === undefined)(
  "écran d'étape au clavier et à la souris (Chromium)",
  () => {
    let server: ViteDevServer;
    let browser: Browser;
    let base = '';

    beforeAll(async () => {
      // Serveur sans rechargement ni surveillance: les modifications des autres membres ne le troublent pas.
      server = await createServer({
        root,
        logLevel: 'silent',
        server: { port: 0, host: '127.0.0.1', hmr: false, watch: null },
      });
      await server.listen();
      base = server.resolvedUrls?.local[0] ?? '';
      browser = await chromium.launch(
        executable === undefined ? {} : { executablePath: executable },
      );
    }, SETUP_MS);

    afterAll(async () => {
      await browser.close();
      await server.close();
    });

    async function openStage(errors: string[]): Promise<Page> {
      const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('response', (r) => {
        if (r.status() >= 400) errors.push(`${String(r.status())} ${r.url()}`);
      });
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
      });
      await page.goto(`${base}src/interface/demo/index.html?scenario=etape&autre=fige&rendu=0`);
      await page.waitForFunction(() => window.lplInterface?.ready === true, null, {
        timeout: 90_000,
      });
      await page.locator('.lpl-screen--stage').waitFor();
      // Garde d'arrivée de l'écran (anti-double-appui) passée.
      await page.waitForTimeout(600);
      return page;
    }

    const focused = (page: Page): Promise<string> =>
      page.evaluate(() => document.activeElement?.textContent.trim() ?? '');
    const choices = (page: Page): Promise<number> =>
      page.evaluate(
        () => (window.lplInterface?.log.intents ?? []).filter((t) => t === 'stage_choice').length,
      );
    const chips = (page: Page): Promise<string[]> =>
      page.locator('.lpl-screen--stage .lpl-player-card .lpl-chip').allInnerTexts();

    it(
      'focus sur « Rester »; Retour arrière et Échap ne ferment rien; flèche et Entrée choisissent « Finir »',
      async () => {
        const errors: string[] = [];
        const page = await openStage(errors);
        expect(await focused(page)).toBe('Rester à la Halte');
        await page.keyboard.press('Backspace');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
        expect(await page.locator('.lpl-screen--stage').count()).toBe(1);
        expect(await choices(page)).toBe(0);
        await page.keyboard.press('ArrowRight');
        expect(await focused(page)).toBe('Finir la séance');
        await page.keyboard.press('Enter');
        await expect.poll(() => chips(page)).toEqual(['Veut finir', 'Pas encore']);
        expect(
          await page.getByRole('button', { name: 'Finir la séance' }).getAttribute('aria-pressed'),
        ).toBe('true');
        expect(await choices(page)).toBe(1);
        // L'autre veut rester: le désaccord se lit, rien ne se ferme.
        await page.evaluate(() => {
          window.lplInterface?.partner({ type: 'stage_choice', choice: 'stay' });
        });
        await expect.poll(() => chips(page)).toEqual(['Veut finir', 'Veut rester']);
        expect(await page.locator('.lpl-stage__message').innerText()).toMatch(
          /^Sacha veut rester\. Vos choix diffèrent/,
        );
        expect(errors).toEqual([]);
        await page.close();
      },
      SETUP_MS,
    );

    it(
      'un clic sur « Rester », l’autre aussi: l’écran se ferme chez soi et « La Halte continue » s’affiche',
      async () => {
        const errors: string[] = [];
        const page = await openStage(errors);
        await page.getByRole('button', { name: 'Rester à la Halte' }).click();
        await expect.poll(() => chips(page)).toEqual(['Veut rester', 'Pas encore']);
        expect(await page.locator('.lpl-stage__message').innerText()).toBe('En attente de Sacha…');
        await page.evaluate(() => {
          window.lplInterface?.partner({ type: 'stage_choice', choice: 'stay' });
        });
        await page.locator('.lpl-screen--stage').waitFor({ state: 'detached' });
        await page.locator('.lpl-toast', { hasText: 'La Halte continue' }).waitFor();
        expect(await page.locator('.lpl-clock__season').innerText()).toBe('Printemps · jour 15');
        expect(await page.locator('.lpl-objective').innerText()).toMatch(
          /La commande du samedi 22/,
        );
        expect(errors).toEqual([]);
        await page.close();
      },
      SETUP_MS,
    );
  },
);
