// Écrans du lanceur dans Chromium seul, avec le faux pont (niveau P2 de l'ADR 0013):
// chaque scénario tient dans 1280x720 points sans défilement horizontal (UX 0.8),
// et son action principale reste visible sans défiler.
import { createServer, type Server } from 'node:http';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, expect, test, type Browser } from '@playwright/test';
import { APP_DIR, SCREENSHOTS } from './duo';

const RENDERER = path.join(APP_DIR, 'out', 'renderer');
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

let server: Server;
let origin = '';
let browser: Browser;

test.beforeAll(async () => {
  server = createServer((request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    const file = path.join(RENDERER, pathname === '/' ? 'index.html' : pathname);
    if (!file.startsWith(RENDERER)) {
      response.writeHead(403).end();
      return;
    }
    readFile(file)
      .then((body) => {
        response.writeHead(200, {
          'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream',
        });
        response.end(body);
      })
      .catch(() => {
        response.writeHead(404).end();
      });
  });
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve();
    });
  });
  const address = server.address();
  origin =
    typeof address === 'object' && address !== null ? `http://127.0.0.1:${address.port}` : '';
  browser = await chromium.launch(await chromiumOptions());
});

/** Navigateur de Playwright s'il est installé, sinon le Chromium préinstallé de l'environnement cloud. */
async function chromiumOptions(): Promise<{ executablePath?: string }> {
  if (existsSync(chromium.executablePath())) return {};
  const base = '/opt/pw-browsers';
  const folders = await readdir(base).catch(() => []);
  for (const folder of folders
    .filter((name) => name.startsWith('chromium-'))
    .sort()
    .reverse()) {
    const candidate = path.join(base, folder, 'chrome-linux64', 'chrome');
    if (existsSync(candidate)) return { executablePath: candidate };
  }
  return {};
}

test.afterAll(async () => {
  await browser.close();
  server.close();
});

const SCENARIOS: readonly { name: string; screen: string; primary: string | null }[] = [
  { name: 'premier-lancement', screen: 'ecran-bienvenue', primary: 'bienvenue-commencer' },
  { name: 'accueil', screen: 'ecran-accueil', primary: 'accueil-heberger' },
  { name: 'accueil-absent', screen: 'ecran-accueil', primary: 'accueil-heberger' },
  { name: 'invitation', screen: 'invitation', primary: 'invitation-rejoindre' },
  { name: 'salon-hote', screen: 'ecran-salon-hote', primary: 'salon-pret' },
  { name: 'salon-attente', screen: 'ecran-salon-hote', primary: 'salon-pret' },
  { name: 'salon-invite', screen: 'ecran-salon-invite', primary: 'salon-pret' },
  { name: 'decompte', screen: 'decompte', primary: 'decompte-pas-encore' },
  { name: 'chargement', screen: 'ecran-chargement', primary: null },
  { name: 'pause', screen: 'superposition-pause', primary: 'pause-reprendre' },
  { name: 'coupure', screen: 'superposition-coupure', primary: 'coupure-arreter' },
  { name: 'fin', screen: 'ecran-fin', primary: 'fin-retour-salon' },
  { name: 'arret', screen: 'ecran-salon-hote', primary: 'arret-jeu-compris' },
  { name: 'quitter', screen: 'superposition-pause', primary: 'quitter-retour' },
];

for (const scenario of SCENARIOS) {
  test(`écran ${scenario.name} à 1280x720`, async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto(`${origin}/?scenario=${scenario.name}`);
    await expect(page.getByTestId(scenario.screen)).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    if (scenario.primary !== null) {
      const primary = page.getByTestId(scenario.primary);
      await expect(primary).toBeVisible();
      const box = await primary.boundingBox();
      expect(box, 'action principale visible sans défiler').not.toBeNull();
      expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(720);
    }
    const overflowX = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflowX).toBe(false);
    await page.screenshot({ path: path.join(SCREENSHOTS, `ecran-${scenario.name}.png`) });
    await page.close();
  });
}

test('salon: quoi de neuf, pastille et toutes les notes', async () => {
  // Animations réduites: la capture montre la fenêtre des notes posée, pas en fondu.
  const page = await browser.newPage({
    viewport: { width: 1366, height: 768 },
    reducedMotion: 'reduce',
  });
  await page.goto(`${origin}/?scenario=salon-hote`);
  const news = page.getByTestId('salon-nouveautes');
  await expect(news).toContainText('Version 1.0.0 installée');
  await expect(page.getByTestId('salon-nouveau')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(SCREENSHOTS, 'ecran-salon-nouveautes.png') });
  await page.getByTestId('salon-toutes-les-notes').click();
  await expect(page.getByTestId('notes-liste')).toContainText('Première version');
  await page.screenshot({ path: path.join(SCREENSHOTS, 'ecran-salon-notes.png') });
  // Échap ferme la liste sans quitter le salon.
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('notes-liste')).toBeHidden();
  await expect(page.getByTestId('ecran-salon-hote')).toBeVisible();
  await page.close();
});

test('salon: dernières séances, libellés longs de La Petite Ligne', async () => {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await page.goto(`${origin}/?scenario=salon-hote`);
  const history = page.getByTestId('salon-historique');
  await expect(history.getByTestId('historique-entree')).toHaveCount(2);
  await expect(history).toContainText('Entrées de collection ajoutées');
  await expect(history).toContainText('Interrompue');
  await page.evaluate(() => document.fonts.ready);
  await history.scrollIntoViewIfNeeded();
  // Aucun libellé ne déborde de sa colonne.
  const overflow = await history.evaluate((block) =>
    [...block.querySelectorAll('dt, dd')].some((cell) => cell.scrollWidth > cell.clientWidth),
  );
  expect(overflow).toBe(false);
  await page.screenshot({
    path: path.join(
      APP_DIR,
      '..',
      '..',
      'docs',
      'plateforme',
      'captures',
      'salon-historique-libelles-longs.png',
    ),
  });
  await page.close();
});

test('réglages: la case Plein écran et sa touche', async () => {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await page.goto(`${origin}/?scenario=accueil`);
  await page.getByTestId('onglet-reglages').click();
  const box = page.getByTestId('reglages-plein-ecran');
  await expect(box).not.toBeChecked();
  // Le faux pont se présente comme un Mac.
  await expect(page.getByTestId('ecran-reglages')).toContainText('Ctrl+Cmd+F');
  await box.check();
  await expect(box).toBeChecked();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(SCREENSHOTS, 'ecran-reglages.png') });
  await page.close();
});
