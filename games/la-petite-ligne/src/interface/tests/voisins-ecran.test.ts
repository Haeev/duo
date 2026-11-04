/**
 * Onglet Voisins du carnet (0.13, lot H3) dans Chromium, sur la page de démonstration à 1366x768:
 * au clavier seul, les flèches parcourent les portraits et la fiche suit, vers la droite le
 * sélecteur de jour (Entrée change la frise), Entrée sur un portrait ouvre la carte du bourg sur
 * son lieu, Entrée sur un lieu revient aux voisins; A et E passent aux onglets voisins. Aucun
 * défilement du panneau, aucune erreur. Ignoré sans Chromium (CI sans navigateur).
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
const SETUP_MS = 180_000;

describe.skipIf(executable === undefined)('onglet Voisins au clavier (Chromium)', () => {
  let server: ViteDevServer;
  let browser: Browser;
  let base = '';

  beforeAll(async () => {
    server = await createServer({
      root,
      logLevel: 'silent',
      server: { port: 0, host: '127.0.0.1', hmr: false, watch: null },
    });
    await server.listen();
    base = server.resolvedUrls?.local[0] ?? '';
    browser = await chromium.launch(executable === undefined ? {} : { executablePath: executable });
  }, SETUP_MS);

  afterAll(async () => {
    await browser.close();
    await server.close();
  });

  async function open(
    scenario: string,
    errors: string[],
    viewport = { width: 1366, height: 768 },
  ): Promise<Page> {
    const page = await browser.newPage({ viewport });
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.goto(
      `${base}src/interface/demo/index.html?scenario=${scenario}&autre=fige&temps=arrete&rendu=0`,
    );
    await page.waitForFunction(() => window.lplInterface?.ready === true, null, {
      timeout: 120_000,
    });
    await page.locator('.lpl-vitrine--neighbours').waitFor();
    await page.waitForTimeout(600);
    return page;
  }

  const focusKey = (page: Page): Promise<string> =>
    page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.key ?? '');
  const detailName = (page: Page): Promise<string> =>
    page.locator('.lpl-vitrine__detail .lpl-detail__name').innerText();
  const selectedTab = (page: Page): Promise<string | null> =>
    page.evaluate(
      () =>
        document.querySelector('.lpl-tab[aria-selected="true"]')?.getAttribute('data-tab') ?? null,
    );
  const noScroll = (page: Page): Promise<boolean> =>
    page.evaluate(() => {
      const body = document.querySelector('.lpl-panel__body');
      return (
        body !== null &&
        body.scrollHeight <= body.clientHeight + 1 &&
        body.scrollWidth <= body.clientWidth + 1
      );
    });
  const timeline = (page: Page): Promise<string> =>
    page.evaluate(() =>
      [...document.querySelectorAll('.lpl-frise__segment')]
        .map((s) => s.getAttribute('aria-label') ?? '')
        .join('|'),
    );

  it(
    'flèches, Entrée, A et E: la fiche suit le portrait, le jour change la frise, le bourg et retour',
    async () => {
      const errors: string[] = [];
      const page = await open('voisins-milieu', errors);
      expect(await selectedTab(page)).toBe('neighbours');
      expect(await page.locator('.lpl-tile--neighbour').count()).toBe(21);
      expect(await page.locator('.lpl-tile--neighbour[data-met="false"]').count()).toBe(7);
      expect(await focusKey(page)).toBe('villager:lucie');
      expect(await detailName(page)).toBe('Lucie');
      expect(await noScroll(page)).toBe(true);

      // Flèches: le portrait voisin, la fiche suit.
      await page.keyboard.press('ArrowRight');
      expect(await focusKey(page)).toBe('villager:armand');
      expect(await detailName(page)).toBe('Armand');
      await page.keyboard.press('ArrowDown');
      expect(await focusKey(page)).toMatch(/^villager:/);
      expect(await focusKey(page)).not.toBe('villager:armand');
      // Un portrait pas encore rencontré: « Une personne inconnue », sans métier.
      const unmetKey = await page.evaluate(
        () =>
          document.querySelector<HTMLElement>('.lpl-tile--neighbour[data-met="false"]')?.dataset
            .key ?? '',
      );
      await page.locator(`[data-key="${unmetKey}"]`).focus();
      expect(await detailName(page)).toBe('Une personne inconnue');
      expect(await page.locator('.lpl-vitrine__detail .lpl-neighbour__job').count()).toBe(0);

      // Retour à Lucie, puis vers la droite jusqu'au sélecteur de jour: Entrée choisit le jour, la frise change.
      await page.locator('[data-key="villager:lucie"]').focus();
      const before = await timeline(page);
      for (let i = 0; i < 12 && !(await focusKey(page)).startsWith('day:'); i++)
        await page.keyboard.press('ArrowRight');
      expect(await focusKey(page)).toMatch(/^day:/);
      await page.keyboard.press('ArrowRight');
      const day = await focusKey(page);
      expect(day).toMatch(/^day:[1-6]$/);
      await page.keyboard.press('Enter');
      await expect
        .poll(() => page.locator(`[data-key="${day}"]`).getAttribute('aria-pressed'))
        .toBe('true');
      expect(await focusKey(page)).toBe(day);
      await expect.poll(() => timeline(page)).not.toBe(before);
      expect(await noScroll(page)).toBe(true);

      // Entrée sur un portrait: la carte du bourg, son lieu en avant et le focus dessus.
      await page.locator('[data-key="villager:lucie"]').focus();
      await page.keyboard.press('Enter');
      await page.locator('.lpl-town__map').waitFor();
      await expect.poll(() => focusKey(page)).toMatch(/^spot:/);
      expect(await page.locator('.lpl-town__spot[data-highlight]').count()).toBe(1);
      expect(await noScroll(page)).toBe(true);
      // Entrée sur un lieu habité: retour aux voisins, sur le premier qu'on y trouve.
      await page.keyboard.press('Enter');
      await page.locator('.lpl-vitrine--neighbours').waitFor();
      await expect.poll(() => focusKey(page)).toBe('villager:lucie');

      // A et E: les onglets voisins (une seule page de portraits).
      await page.keyboard.press('KeyQ');
      await expect.poll(() => selectedTab(page)).toBe('quests');
      await page.keyboard.press('KeyE');
      await expect.poll(() => selectedTab(page)).toBe('neighbours');
      await page.keyboard.press('KeyE');
      await expect.poll(() => selectedTab(page)).toBe('mail');
      expect(errors).toEqual([]);
      await page.close();
    },
    SETUP_MS,
  );

  it(
    'début, fin et pluie: aucun défilement à 1366x768 ni à 1920x1080, aucun identifiant brut',
    async () => {
      for (const scenario of ['voisins-debut', 'voisins-fin', 'voisins-pluie']) {
        for (const viewport of [
          { width: 1366, height: 768 },
          { width: 1920, height: 1080 },
        ]) {
          const errors: string[] = [];
          const page = await open(scenario, errors, viewport);
          expect(await noScroll(page), `${scenario} ${String(viewport.width)}`).toBe(true);
          const text = await page.locator('.lpl-panel').innerText();
          expect(text).not.toMatch(/\b[a-z]+_[a-z_]+\b/);
          expect(text).not.toMatch(/\{[a-zA-Z]+\}/);
          if (scenario === 'voisins-pluie')
            expect(
              await page.locator('[data-key="weather:rain"]').getAttribute('aria-pressed'),
            ).toBe('true');
          expect(errors).toEqual([]);
          await page.close();
        }
      }
    },
    SETUP_MS * 2,
  );
});
