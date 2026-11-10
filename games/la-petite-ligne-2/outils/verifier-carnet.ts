/**
 * Banc du carnet en petite fenêtre (`pnpm verifier-carnet`): ouvre la page de démonstration de
 * l'interface dans Chromium à 1366x768 et à 1280x720 et vérifie, pour chaque onglet:
 *  - le livre et tous les signets (le signet ouvert, son nom compris) restent dans l'écran;
 *  - sur un contenu très long (`-long`, `-malle`), la page défile dans sa zone (molette, touches
 *    de pages, focus qui suit au clavier) et rien ne sort du livre;
 *  - « Équiper » envoie l'intention quand elle est possible et répond par une phrase; un refus
 *    prévisible n'envoie rien et se lit à l'écran.
 * Lancé par Node tel quel (types effacés), avec le Chromium préinstallé de l'environnement cloud.
 */
import { existsSync } from 'node:fs';
import { createServer } from 'vite';
import { chromium, type Page } from '@playwright/test';

const SIZES = [
  { width: 1366, height: 768 },
  { width: 1280, height: 720 },
] as const;
const TABS = ['sac', 'quetes', 'habitants', 'collections', 'carte', 'tenues', 'reglages'] as const;
const LONG = ['quetes', 'habitants', 'collections'] as const;

const failures: string[] = [];
let checks = 0;
function check(ok: boolean, message: string): void {
  checks += 1;
  if (!ok) failures.push(message);
}

interface Box {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

async function open(page: Page, base: string, anchor: string): Promise<void> {
  await page.goto('about:blank');
  await page.goto(`${base}/src/interface/demo/index.html?rendu=0#${anchor}`);
  await page.waitForSelector('.carnet .page__zone', { timeout: 15_000 });
  await page.waitForTimeout(1500);
}

/** Rectangles des signets et du livre; faux si quelque chose sort de l'écran ou du livre. */
async function geometry(page: Page): Promise<{
  book: Box;
  signets: Box[];
  zones: Box[];
  outside: string[];
}> {
  return page.evaluate(() => {
    const box = (r: DOMRect): Box => ({
      left: r.left,
      top: r.top,
      right: r.right,
      bottom: r.bottom,
    });
    const bookNode = document.querySelector('.carnet .book');
    if (bookNode === null) throw new Error('livre absent');
    const book = bookNode.getBoundingClientRect();
    const outside: string[] = [];
    // Tout ce qui est hors d'une zone qui défile doit rester dans le livre.
    for (const node of bookNode.querySelectorAll('.page > :not(.page__zone), .page > .foot *')) {
      const r = node.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.bottom > book.bottom + 1 || r.right > book.right + 1)
        outside.push(
          `${node.className} ${String(Math.round(r.right))}x${String(Math.round(r.bottom))}`,
        );
    }
    return {
      book: box(book),
      signets: [...document.querySelectorAll('.carnet .signet')].map((n) =>
        box(n.getBoundingClientRect()),
      ),
      zones: [...document.querySelectorAll('.carnet .page__zone')].map((n) =>
        box(n.getBoundingClientRect()),
      ),
      outside,
    };
  });
}

async function checkFits(page: Page, label: string, w: number, h: number): Promise<void> {
  const g = await geometry(page);
  check(
    g.book.left >= 0 && g.book.right <= w && g.book.top >= 0 && g.book.bottom <= h,
    `${label}: livre hors de l'écran`,
  );
  check(g.signets.length === 7, `${label}: ${String(g.signets.length)} signets au lieu de 7`);
  for (const [i, s] of g.signets.entries())
    check(
      s.left >= 0 && s.right <= w && s.top >= 0 && s.bottom <= h,
      `${label}: signet ${String(i + 1)} hors de l'écran (droite ${String(Math.round(s.right))})`,
    );
  for (const z of g.zones)
    check(
      z.right <= g.book.right + 1 && z.bottom <= g.book.bottom + 1,
      `${label}: zone hors du livre`,
    );
  check(g.outside.length === 0, `${label}: hors du livre: ${g.outside.join(', ')}`);
}

async function scrollState(page: Page): Promise<{ top: number; max: number; box: Box }[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.carnet .page__zone')].map((z) => {
      const r = z.getBoundingClientRect();
      return {
        top: z.scrollTop,
        max: z.scrollHeight - z.clientHeight,
        box: { left: r.left, top: r.top, right: r.right, bottom: r.bottom },
      };
    }),
  );
}

async function focusInZone(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const target = document.querySelector<HTMLElement>('.carnet .page__zone .focus');
    const zone = target?.closest<HTMLElement>('.page__zone');
    if (target === null || zone === null || zone === undefined) return false;
    const t = target.getBoundingClientRect();
    const z = zone.getBoundingClientRect();
    return t.top >= z.top - 1 && t.bottom <= z.bottom + 1;
  });
}

async function main(): Promise<void> {
  const server = await createServer({ server: { port: 0 }, logLevel: 'silent' });
  await server.listen();
  const address = server.httpServer?.address();
  if (address === null || address === undefined || typeof address === 'string')
    throw new Error('serveur Vite sans adresse');
  const base = `http://localhost:${String(address.port)}`;
  const preinstalled = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(
    process.env.DUO_CHROMIUM !== undefined || existsSync(preinstalled)
      ? { executablePath: process.env.DUO_CHROMIUM ?? preinstalled }
      : {},
  );
  try {
    for (const size of SIZES) {
      const page = await browser.newPage({ viewport: size });
      const at = `${String(size.width)}x${String(size.height)}`;

      for (const tab of TABS) {
        await open(page, base, tab === 'sac' ? 'carnet-sac' : `carnet-${tab}`);
        await checkFits(page, `${at} ${tab}`, size.width, size.height);
      }
      for (const tab of LONG) {
        const label = `${at} ${tab} long`;
        await open(page, base, `carnet-${tab}-long`);
        await checkFits(page, label, size.width, size.height);
        const before = await scrollState(page);
        const scrolling = before.findIndex((z) => z.max > 2);
        check(scrolling >= 0, `${label}: aucune zone ne défile`);
        if (scrolling < 0) continue;
        const zone = before[scrolling];
        if (zone === undefined) continue;
        // Molette.
        await page.mouse.move(
          (zone.box.left + zone.box.right) / 2,
          (zone.box.top + zone.box.bottom) / 2,
        );
        await page.mouse.wheel(0, 300);
        await page.waitForTimeout(300);
        const wheeled = (await scrollState(page))[scrolling];
        check((wheeled?.top ?? 0) > 0, `${label}: la molette ne fait pas défiler`);
        await checkFits(page, `${label} (après molette)`, size.width, size.height);
        // Touches: le focus descend loin dans la liste et reste visible.
        if (tab !== 'quetes') {
          for (let i = 0; i < 9; i += 1) await page.keyboard.press('ArrowDown');
          await page.waitForTimeout(200);
          check(await focusInZone(page), `${label}: le focus sort de la zone au clavier`);
          const moved = (await scrollState(page))[scrolling];
          check((moved?.top ?? 0) > 0, `${label}: le clavier ne fait pas défiler`);
        } else {
          await open(page, base, 'carnet-quetes-long');
          await page.keyboard.press('PageDown');
          await page.waitForTimeout(300);
          const paged = (await scrollState(page)).some((z) => z.top > 0);
          check(paged, `${label}: PageBas ne fait pas défiler`);
        }
      }
      // Sac de 20 cases: la grille défile, le focus reste visible.
      await open(page, base, 'carnet-sac-malle');
      await checkFits(page, `${at} sac de 20 cases`, size.width, size.height);
      for (let i = 0; i < 4; i += 1) await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(200);
      check(await focusInZone(page), `${at} sac de 20 cases: le focus sort de la zone`);

      // Équiper: possible.
      await open(page, base, 'carnet-sac-equiper');
      await checkFits(page, `${at} équiper`, size.width, size.height);
      check(
        (await page.locator('.btn--primary', { hasText: 'Équiper' }).count()) === 1,
        `${at}: bouton Équiper absent`,
      );
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      const sent = (await page.locator('#envoi').textContent()) ?? '';
      check(sent.includes('"equip_bag"'), `${at}: Entrée n'envoie pas equip_bag (${sent})`);
      check(
        (await page.locator('.equip-note--ok').count()) === 1,
        `${at}: pas de retour de succès après Équiper`,
      );
      await checkFits(page, `${at} équiper (réponse)`, size.width, size.height);

      // Équiper: refus expliqué, rien n'est envoyé.
      await open(page, base, 'carnet-sac-refus');
      const off = page.locator('.btn--off', { hasText: 'Équiper' });
      check((await off.count()) === 1, `${at}: bouton Équiper refusé absent`);
      check(
        (await off.getAttribute('aria-disabled')) === 'true',
        `${at}: bouton refusé sans aria-disabled`,
      );
      check(
        (await page.locator('.equip-note--refus').count()) === 1,
        `${at}: refus sans explication`,
      );
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);
      check(
        !((await page.locator('#envoi').textContent()) ?? '').includes('equip_bag'),
        `${at}: un refus connu envoie quand même l'intention`,
      );
      await checkFits(page, `${at} équiper (refus)`, size.width, size.height);
      await page.close();
    }
  } finally {
    await browser.close();
    await server.close();
  }
  process.stdout.write(`${String(checks)} contrôles, ${String(failures.length)} échec(s)\n`);
  for (const f of failures) process.stdout.write(`ÉCHEC ${f}\n`);
  process.exitCode = failures.length === 0 ? 0 : 1;
}

await main();
