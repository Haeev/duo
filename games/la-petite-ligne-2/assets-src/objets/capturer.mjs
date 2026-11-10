// Capture de la page de démonstration (Playwright et Chromium préinstallés).
// Usage: node capturer.mjs <adresse de la page> <sortie.png> [largeur] [hauteur]
// Lancer d'abord `npx vite --port 5297` dans le paquet.
import { createRequire } from 'node:module';

// Playwright est installé globalement: le trouver par NODE_PATH (/opt/node22/lib/node_modules).
const { chromium } = createRequire(import.meta.url)('playwright');

const [url, out, w = '1400', h = '1800'] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } });
page.on('pageerror', (e) => process.stderr.write(`erreur de page: ${e.message}\n`));
await page.goto(url);
await page.waitForSelector('body[data-pret="1"]', { timeout: 240_000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
process.stdout.write(`capture ${out}\n`);
