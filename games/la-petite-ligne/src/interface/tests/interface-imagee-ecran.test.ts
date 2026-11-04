/**
 * Interface imagée du patch 0.12.2 dans Chromium, sur la page de démonstration à 1366x768: pour
 * chaque écran refait, la navigation au clavier (flèches, Entrée, A et E), l'état « manque »
 * (vignette grisée, compteur barré, bouton refusé) et l'absence de défilement du panneau.
 * Ignoré sans Chromium (CI sans navigateur).
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
const SETUP_MS = 180_000;

describe.skipIf(executable === undefined)('interface imagée 0.12.2 au clavier (Chromium)', () => {
  let server: ViteDevServer;
  let browser: Browser;
  let base = '';

  beforeAll(async () => {
    server = await createServer({ root, logLevel: 'silent', server: { port: 0, host: '127.0.0.1', hmr: false, watch: null } });
    await server.listen();
    base = server.resolvedUrls?.local[0] ?? '';
    browser = await chromium.launch(executable === undefined ? {} : { executablePath: executable });
  }, SETUP_MS);

  afterAll(async () => {
    await browser.close();
    await server.close();
  });

  async function open(scenario: string, errors: string[]): Promise<Page> {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.goto(`${base}src/interface/demo/index.html?scenario=${scenario}&autre=fige&temps=arrete&rendu=0`);
    await page.waitForFunction(() => window.lplInterface?.ready === true, null, { timeout: 120_000 });
    await page.locator('.lpl-panel').waitFor();
    // Garde d'arrivée du panneau (anti-double-appui) passée.
    await page.waitForTimeout(600);
    return page;
  }

  const focusKey = (page: Page): Promise<string> => page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.key ?? '');
  const detailName = (page: Page): Promise<string> => page.locator('.lpl-vitrine__detail .lpl-detail__name').innerText();
  const intents = (page: Page, type: string): Promise<number> =>
    page.evaluate((t) => (window.lplInterface?.log.intents ?? []).filter((x) => x === t).length, type);
  const noScroll = (page: Page): Promise<boolean> =>
    page.evaluate(() => {
      const body = document.querySelector('.lpl-panel__body');
      return body !== null && body.scrollHeight <= body.clientHeight + 1;
    });

  it(
    'comptoir: les flèches changent la vignette et son détail, Entrée achète, l’argent qui manque grise la vignette',
    async () => {
      const errors: string[] = [];
      const page = await open('comptoir-0122', errors);
      expect(await focusKey(page)).toBe('item:radish_seed');
      expect(await detailName(page)).toBe('Sachet de graines de radis');
      expect(await noScroll(page)).toBe(true);
      await page.keyboard.press('ArrowRight');
      expect(await focusKey(page)).toBe('item:lettuce_seed');
      expect(await detailName(page)).toBe('Sachet de graines de laitue');
      await page.keyboard.press('Enter');
      await expect.poll(() => intents(page, 'buy')).toBe(1);
      // Vers la droite depuis la dernière colonne: les boutons du détail.
      for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
      expect(await focusKey(page)).toMatch(/^(buy|bulk):/);
      // E: l'onglet Vendre (une seule page d'achats).
      await page.keyboard.press('KeyE');
      await expect.poll(() => page.locator('.lpl-tab[aria-selected="true"]').innerText()).toMatch(/Vendre/);
      expect(errors).toEqual([]);
      await page.close();

      const poor = await open('comptoir-0122-pauvre', errors);
      const vase = poor.locator('.lpl-tile[data-key="item:picture_frame"]');
      expect(await vase.getAttribute('data-state')).toBe('missing');
      await vase.click();
      expect(await poor.locator('.lpl-vitrine__detail .lpl-pastille--missing[data-crossed="true"]').count()).toBe(1);
      expect(await poor.locator('.lpl-vitrine__detail [data-key="buy:picture_frame"]').getAttribute('aria-disabled')).toBe('true');
      // Entrée sur la vignette trop chère: rien n'est acheté.
      await poor.keyboard.press('Enter');
      await poor.waitForTimeout(200);
      expect(await intents(poor, 'buy')).toBe(0);
      expect(errors).toEqual([]);
      await poor.close();
    },
    SETUP_MS,
  );

  it(
    'réchaud: ingrédients en « possédés / requis », barrés quand ils manquent, un seul bouton refusé',
    async () => {
      const errors: string[] = [];
      const page = await open('rechaud-0122-vide', errors);
      expect(await noScroll(page)).toBe(true);
      const cards = page.locator('.lpl-recipe');
      expect(await cards.count()).toBeGreaterThan(4);
      expect(await page.locator('.lpl-recipe[data-state="missing"]').count()).toBe(await cards.count());
      expect(await page.locator('.lpl-need-count[data-missing="true"]').count()).toBeGreaterThan(4);
      expect(await page.getByText(/Il manque/).count()).toBe(0);
      const first = await focusKey(page);
      expect(first).toMatch(/^craft:/);
      await page.keyboard.press('ArrowRight');
      expect(await focusKey(page)).not.toBe(first);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(200);
      expect(await intents(page, 'craft')).toBe(0);
      expect(errors).toEqual([]);
      await page.close();

      const full = await open('rechaud-0122', errors);
      expect(await focusKey(full)).toMatch(/^craft:/);
      expect(await full.locator('.lpl-recipe[data-state="ready"]').count()).toBeGreaterThan(0);
      await full.keyboard.press('Enter');
      await expect.poll(() => intents(full, 'craft')).toBe(1);
      // La rangée « Manger »: une vignette par plat du sac.
      expect(await full.locator('.lpl-tile--food').count()).toBeGreaterThan(0);
      expect(errors).toEqual([]);
      await full.close();
    },
    SETUP_MS,
  );

  it(
    'établi: A et E passent des recettes aux commandes de Basile',
    async () => {
      const errors: string[] = [];
      const page = await open('etabli-0122', errors);
      expect(await noScroll(page)).toBe(true);
      await page.keyboard.press('KeyE');
      await expect.poll(() => page.locator('.lpl-tab[aria-selected="true"]').innerText()).toMatch(/Basile/);
      await page.keyboard.press('KeyQ');
      await expect.poll(() => page.locator('.lpl-tab[aria-selected="true"]').innerText()).toMatch(/Fabriquer/);
      await expect.poll(() => page.locator('.lpl-recipe').count()).toBeGreaterThan(0);
      expect(errors).toEqual([]);
      await page.close();
    },
    SETUP_MS,
  );

  it(
    'basse-cour: robes en français, manques barrés, cartes parcourues aux flèches',
    async () => {
      const errors: string[] = [];
      const page = await open('basse-cour-0122-debut', errors);
      expect(await noScroll(page)).toBe(true);
      const text = await page.locator('.lpl-panel').innerText();
      expect(text).not.toMatch(/hen_/);
      expect(await page.locator('.lpl-farm__robe-name').allInnerTexts()).toEqual(['Blanche', 'Rousse', 'Noire', 'Dorée', 'Cendrée', 'Coucou']);
      expect(await page.locator('.lpl-farm__robe[data-have="false"]').count()).toBe(3);
      // Grain vide, litière à changer, couvée impossible: tuiles en pointillé, conditions barrées.
      expect(await page.locator('.lpl-farm__stat[data-state="missing"]').count()).toBeGreaterThanOrEqual(2);
      expect(await page.locator('.lpl-farm__stat .lpl-need-count[data-missing="true"]').count()).toBeGreaterThan(0);
      expect(await focusKey(page)).toMatch(/^animal:/);
      const first = await focusKey(page);
      await page.keyboard.press('ArrowRight');
      expect(await focusKey(page)).toMatch(/^animal:/);
      expect(await focusKey(page)).not.toBe(first);
      await page.keyboard.press('ArrowUp');
      expect(await focusKey(page)).toMatch(/^stat:/);
      expect(errors).toEqual([]);
      await page.close();

      const full = await open('basse-cour-0122', errors);
      expect(await noScroll(full)).toBe(true);
      expect(await full.locator('.lpl-farm__card').count()).toBe(6);
      expect(await full.locator('.lpl-gauge[role="meter"]').count()).toBeGreaterThan(4);
      expect(errors).toEqual([]);
      await full.close();
    },
    SETUP_MS,
  );

  it(
    'carnet des poissons: grille au liseré de rareté, silhouette pour ceux pas encore pris, détail en icônes',
    async () => {
      const errors: string[] = [];
      const page = await open('poissons-0122', errors);
      expect(await noScroll(page)).toBe(true);
      expect(await page.locator('.lpl-tile--fish').count()).toBe(22);
      expect(await focusKey(page)).toBe('fish:gudgeon');
      expect(await detailName(page)).toBe('Goujon');
      expect(await page.locator('.lpl-vitrine__detail .lpl-icon-row').count()).toBe(2);
      expect(await page.locator('.lpl-vitrine__detail .lpl-river-map').count()).toBe(1);
      const locked = page.locator('.lpl-tile--fish[data-caught="false"]').first();
      await locked.click();
      expect(await detailName(page)).toBe('Pas encore pris');
      expect(await page.locator('.lpl-vitrine__detail .lpl-fish-silhouette').count()).toBe(1);
      expect(await page.locator('.lpl-vitrine__detail .lpl-icon-row').count()).toBe(0);
      await page.keyboard.press('ArrowRight');
      expect(await focusKey(page)).toMatch(/^fish:/);
      expect(errors).toEqual([]);
      await page.close();
    },
    SETUP_MS,
  );

  it(
    'rangement: rangement et sac côte à côte, Entrée prend ou dépose d’un geste, le râtelier à part, sans défiler',
    async () => {
      const errors: string[] = [];
      const page = await open('coffre-0122-plein', errors);
      expect(await noScroll(page)).toBe(true);
      const storeName = (): Promise<string> => page.locator('.lpl-storage__detail .lpl-detail__name').innerText();
      expect(await page.locator('.lpl-storage__strip .lpl-pastille').first().getAttribute('aria-label')).toMatch(/18 cases prises sur 26/);
      expect(await page.locator('.lpl-vitrine--store .lpl-tile[data-key]').count()).toBe(18);
      expect(await page.locator('.lpl-vitrine--store .lpl-tile--free').count()).toBe(8);
      expect(await page.locator('.lpl-vitrine--rack .lpl-tile[data-key]').count()).toBe(2);
      expect(await focusKey(page)).toBe('cell:0');
      expect(await storeName()).toBe('Plume de geai');
      await page.keyboard.press('ArrowRight');
      expect(await focusKey(page)).toBe('cell:1');
      expect(await storeName()).toBe('Poste à galène');
      // Entrée sur la vignette choisie: la case entière revient dans le sac.
      await page.keyboard.press('Enter');
      await expect.poll(() => intents(page, 'chest_take')).toBe(1);
      // Vers la droite, au bout du rangement: le sac; Entrée y dépose la pile.
      for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight');
      expect(await focusKey(page)).toMatch(/^bag:/);
      expect(await page.locator('.lpl-storage__column[data-side="bag"][data-active]').count()).toBe(1);
      expect(await page.locator('.lpl-storage__detail [data-key="deposit"]').count()).toBe(1);
      await page.keyboard.press('Enter');
      await expect.poll(() => intents(page, 'chest_deposit')).toBe(1);
      // À la souris: un premier clic choisit, un second sur la même vignette dépose.
      const tile = page.locator('.lpl-vitrine--store-bag .lpl-tile[data-key="bag:3"]');
      await tile.click();
      await page.waitForTimeout(200);
      expect(await intents(page, 'chest_deposit')).toBe(1);
      await tile.click();
      await expect.poll(() => intents(page, 'chest_deposit')).toBe(2);
      // Le râtelier, sous les grilles.
      for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowDown');
      expect(await focusKey(page)).toMatch(/^(hook:|take|deposit)/);
      expect(await noScroll(page)).toBe(true);
      expect(errors).toEqual([]);
      await page.close();
    },
    SETUP_MS,
  );

  it(
    'sac du carnet: vignettes avec quantités et belle qualité, détail en icônes, second clic qui mange',
    async () => {
      const errors: string[] = [];
      const page = await open('sac-0122', errors);
      expect(await noScroll(page)).toBe(true);
      expect(await page.locator('.lpl-tile--bag').count()).toBe(24);
      expect(await page.locator('.lpl-tile--bag .lpl-tile__badge').count()).toBeGreaterThan(6);
      expect(await page.locator('.lpl-tile--bag[data-quality="fine"] .lpl-tile__corner--fine').count()).toBe(1);
      expect(await focusKey(page)).toBe('slot:0');
      await page.keyboard.press('ArrowRight');
      expect(await focusKey(page)).toBe('slot:1');
      // Le focus est la sélection: le détail suit les flèches.
      await expect.poll(() => page.locator('.lpl-bag__detail .lpl-detail__name').innerText()).toBe('Arrosoir');
      // La belle qualité: étoile, prix chez Odette et ce qu'on en fait, en pastilles.
      await page.locator('[data-slot="10"]').click();
      await expect.poll(() => page.locator('.lpl-bag__detail .lpl-detail__name').innerText()).toBe('Radis');
      expect(await page.locator('.lpl-bag__detail .lpl-pastille--price').count()).toBe(2);
      expect(await page.locator('.lpl-bag__detail .lpl-pastille[aria-label^="Odette en donne"]').count()).toBe(1);
      expect(await page.locator('.lpl-bag__detail .lpl-pastille[aria-label^="Sert à fabriquer"]').count()).toBe(1);
      // Le pain: un clic choisit, un second clic sur la même case le mange.
      const bread = page.locator('[data-slot="7"]');
      await bread.click();
      await page.waitForTimeout(200);
      expect(await intents(page, 'eat')).toBe(0);
      await bread.click();
      await expect.poll(() => intents(page, 'eat')).toBe(1);
      // Espace prend la case, Espace sur une autre la pose (déplacer).
      await page.keyboard.press('Space');
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('Space');
      await expect.poll(() => intents(page, 'swap_slots')).toBe(1);
      expect(errors).toEqual([]);
      await page.close();
    },
    SETUP_MS,
  );

  it(
    'quêtes du carnet: cartes à l’habitant, conditions en compteurs, A et E tournent les pages, sans défiler',
    async () => {
      const errors: string[] = [];
      const page = await open('quetes-0122', errors);
      expect(await noScroll(page)).toBe(true);
      // Les sept quêtes en cours tiennent sur une page: A et E restent aux onglets.
      const cards = page.locator('.lpl-tile--quest');
      expect(await cards.count()).toBe(7);
      expect(await page.locator('.lpl-tile--quest[data-state="done"]').count()).toBe(0);
      expect(await page.locator('.lpl-pager').count()).toBe(0);
      expect(await focusKey(page)).toBe('quest:market_first');
      expect(await detailName(page)).toBe('Le premier marché');
      expect(await page.locator('.lpl-vitrine__detail .lpl-quest-detail__text').innerText()).toMatch(/3 sortes/);
      expect(await page.locator('.lpl-tile--quest .lpl-need-count').count()).toBeGreaterThan(3);
      expect(await page.locator('.lpl-tile--quest .lpl-portrait').count()).toBeGreaterThan(3);
      expect(await page.getByText(/Il manque/).count()).toBe(0);
      // Le volant de Jeanne: une plume sur quatre, chez Jeanne, 30 aubrins.
      const shuttle = page.locator('.lpl-tile--quest[data-key="quest:jeanne_shuttlecock"]');
      expect(await shuttle.locator('.lpl-need-count[data-missing="true"]').innerText()).toMatch(/1\s*\/4/);
      expect(await shuttle.locator('.lpl-quest-place').count()).toBe(1);
      expect(await shuttle.locator('.lpl-quest-card__reward').innerText()).toMatch(/30/);
      await page.keyboard.press('ArrowRight');
      expect(await focusKey(page)).toMatch(/^quest:/);
      expect(await focusKey(page)).not.toBe('quest:market_first');
      // Au clic, la carte choisie montre son texte complet au détail.
      await shuttle.click();
      expect(await detailName(page)).toBe('Le jeu de volant de Jeanne');
      // Les terminées: flèche vers le haut jusqu'à leur pastille, Entrée; A et E tournent leurs pages.
      for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowUp');
      expect(await focusKey(page)).toMatch(/^filter:/);
      if ((await focusKey(page)) === 'filter:open') await page.keyboard.press('ArrowRight');
      expect(await focusKey(page)).toBe('filter:done');
      await page.keyboard.press('Enter');
      await expect.poll(() => page.locator('[data-key="filter:done"]').getAttribute('aria-pressed')).toBe('true');
      expect(await cards.count()).toBe(8);
      expect(await page.locator('.lpl-tile--quest[data-state="done"]').count()).toBe(8);
      const pageLabel = (): Promise<string | null> => page.locator('.lpl-pager__dots').getAttribute('aria-label');
      expect(await pageLabel()).toMatch(/^Page 1 sur/);
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('KeyE');
      await expect.poll(pageLabel).toMatch(/^Page 2 sur/);
      expect(await focusKey(page)).toMatch(/^quest:/);
      await page.keyboard.press('KeyQ');
      await expect.poll(pageLabel).toMatch(/^Page 1 sur/);
      expect(await noScroll(page)).toBe(true);
      expect(errors).toEqual([]);
      await page.close();
    },
    SETUP_MS,
  );

  it(
    'fauteuil de Solange: tout tient sans défiler, une flèche change la coupe et le prix s’affiche',
    async () => {
      const errors: string[] = [];
      const page = await open('salon-0122', errors);
      expect(await noScroll(page)).toBe(true);
      expect(await page.locator('.lpl-salon__option').count()).toBe(15 + 8 + 4);
      // Mode secours (sans rendu): un petit portrait, jamais en plein panneau.
      const box = await page.locator('.lpl-salon__viewport').boundingBox();
      expect(box?.height ?? 999).toBeLessThan(200);
      expect(await focusKey(page)).toMatch(/^hair:/);
      const before = await page.locator('.lpl-salon__group').first().locator('.lpl-salon__chosen').innerText();
      await page.keyboard.press('ArrowRight');
      await expect.poll(() => page.locator('.lpl-salon__group').first().locator('.lpl-salon__chosen').innerText()).not.toBe(before);
      await expect.poll(() => page.locator('.lpl-salon__left .lpl-pastille').count()).toBe(1);
      expect(await page.locator('[data-key="confirm"]').innerText()).toBe('Valider');
      expect(errors).toEqual([]);
      await page.close();
    },
    SETUP_MS,
  );
});
