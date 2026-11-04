/**
 * Onglet Souvenirs dans Chromium (tour 7): S-11 sur le texte du DOM (aucun compteur de
 * collection, aucun moment jamais vu hors rumeur), chez les deux joueurs; l'onglet s'atteint au
 * clavier (A et E selon le clavier réel) et à la souris, les entrées se parcourent aux flèches.
 * Page de démonstration sans rendu 3D, simulation arrêtée. Ignoré sans Chromium.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { type Browser, type Page, chromium } from '@playwright/test';
import { type ViteDevServer, createServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { CharacterId } from '../../etat/types';
import { setupScenario } from '../demo/scenarios';
import { apply, newSim } from './aides';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const executable = [
  process.env.DUO_CHROMIUM,
  '/opt/pw-browsers/chromium',
  chromium.executablePath(),
].find((path): path is string => path !== undefined && path !== '' && existsSync(path));
const SETUP_MS = 90_000;
const PAGE_MS = 240_000;

const plain = (s: string): string =>
  s
    .replace(/[\u00a0\u202f]/g, ' ')
    .replace(/\u2019/g, "'")
    .replace(/\s+/g, ' ')
    .toLowerCase();

/** Les moments que la situation n'a jamais montrés ensemble: leur nom et le début de leur souvenir. */
function unseen(scenario: string): string[] {
  const sim = newSim();
  apply(sim, 'p1', { type: 'title_ready', ready: true });
  apply(sim, 'p2', { type: 'title_ready', ready: true });
  setupScenario(sim, scenario, 'p1')?.();
  const seen = new Set(sim.world.memories.moments.map((m) => m.id));
  return sim.content.moments
    .filter((m) => !seen.has(m.id))
    .flatMap((m) => [
      plain(m.name),
      plain((sim.content.texts.messages[m.texts.memory] ?? '').split(',')[0] ?? ''),
    ]);
}

describe.skipIf(executable === undefined)(
  'onglet Souvenirs dans Chromium (S-11, clavier et souris)',
  () => {
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
      browser = await chromium.launch(
        executable === undefined ? {} : { executablePath: executable },
      );
    }, SETUP_MS);

    afterAll(async () => {
      await browser.close();
      await server.close();
    });

    async function open(scenario: string, me: CharacterId, extra = ''): Promise<Page> {
      const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
      // `goto` attend la fin du module de la page, qui prépare la situation en faisant jouer les
      // robots jusqu'au jour 12 (93 161 pas): 25 à 27 s en 0.12.2, 28 à 30 s en 0.13 (habitants et
      // plannings), modules chargés en 1 à 2 s. Les 30 s par défaut de Playwright ne suffisent plus.
      await page.goto(
        `${base}src/interface/demo/index.html?scenario=${scenario}&joueur=${me}&autre=fige&rendu=0&temps=arrete${extra}`,
        { timeout: PAGE_MS },
      );
      await page.waitForFunction(() => window.lplInterface?.ready === true, null, {
        timeout: PAGE_MS,
      });
      await page.waitForTimeout(700);
      return page;
    }

    for (const me of ['p1', 'p2'] as const) {
      it(
        `chez ${me}: ni « sur 12 », ni « / », ni « % », ni moment jamais vu hors rumeur; une rumeur en bas`,
        async () => {
          const forbidden = unseen('souvenirs-plusieurs');
          expect(forbidden.length).toBeGreaterThan(4);
          const page = await open('souvenirs-plusieurs', me, '&onglet=souvenirs');
          const shown = await page.evaluate(() => {
            const memories = document.querySelector('.lpl-memories');
            const clone = memories?.cloneNode(true) as HTMLElement | undefined;
            clone?.querySelector('.lpl-rumor')?.remove();
            const labels = [...(memories?.querySelectorAll('[aria-label]') ?? [])].map(
              (n) => n.getAttribute('aria-label') ?? '',
            );
            return {
              text: `${clone?.textContent ?? ''} ${labels.join(' ')}`,
              rumor: document.querySelector('.lpl-rumor__text')?.textContent ?? '',
              entries: document.querySelectorAll('.lpl-memory').length,
              vignettes: [...document.querySelectorAll('.lpl-memory__icon use')].map(
                (u) => u.getAttribute('href') ?? '',
              ),
            };
          });
          await page.close();
          const text = plain(shown.text);
          for (const bad of ['sur 12', '/', '%']) expect(text, `« ${bad} »`).not.toContain(bad);
          for (const s of forbidden) expect(text, `« ${s} »`).not.toContain(s);
          expect(shown.entries).toBe(4);
          expect(
            shown.vignettes.every((h) => h.startsWith('#memory-') && h !== '#memory-generic'),
          ).toBe(true);
          expect(shown.rumor.length).toBeGreaterThan(10);
        },
        PAGE_MS * 2,
      );
    }

    it(
      "au clavier: E jusqu'aux Souvenirs, les flèches d'une entrée à l'autre; à la souris: un clic sur l'onglet",
      async () => {
        const page = await open('souvenirs-plusieurs', 'p1');
        const keycaps = await page.evaluate(() =>
          [...document.querySelectorAll('.lpl-tabs__key')].map((k) => k.textContent),
        );
        // Clavier AZERTY de la page de démonstration: Q et E du clavier physique s'affichent A et E.
        expect(keycaps).toEqual(['A', 'E']);
        const selected = (): Promise<string | null> =>
          page.evaluate(
            () =>
              document.querySelector('.lpl-tab[aria-selected="true"]')?.getAttribute('data-tab') ??
              null,
          );
        expect(await selected()).toBe('quests');
        // E passe à l'onglet suivant, dans l'ordre de la page (0.12: « Poissons » avant « Souvenirs »).
        const tabs = await page.evaluate(() =>
          [...document.querySelectorAll('.lpl-tab')].map((t) => t.getAttribute('data-tab')),
        );
        const target = tabs.indexOf('memories');
        expect(target).toBeGreaterThan(0);
        const seen: (string | null)[] = [];
        for (let i = 1; i <= target; i++) {
          await page.keyboard.press('KeyE');
          await page.waitForTimeout(150);
          seen.push(await selected());
        }
        expect(seen).toEqual(tabs.slice(1, target + 1));
        expect(await selected()).toBe('memories');
        await page.waitForTimeout(200);
        const focused = (): Promise<string | null> =>
          page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.key ?? null);
        const first = await focused();
        expect(first).toMatch(/^(moment|secret):/);
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(150);
        const second = await focused();
        expect(second).toMatch(/^(moment|secret):/);
        expect(second).not.toBe(first);
        // Q revient à l'onglet d'avant (0.12: « Poissons »).
        await page.keyboard.press('KeyQ');
        await page.waitForTimeout(150);
        expect(await selected()).toBe(tabs[target - 1]);
        await page.click('.lpl-tab[data-tab="memories"]');
        await page.waitForTimeout(150);
        expect(await selected()).toBe('memories');
        expect(await page.locator('.lpl-memory').count()).toBeGreaterThan(2);
        await page.close();
      },
      PAGE_MS * 2,
    );
  },
);
