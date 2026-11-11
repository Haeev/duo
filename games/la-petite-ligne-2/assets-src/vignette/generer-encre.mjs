#!/usr/bin/env node
// Vignette du jeu dans la bibliothèque de Duo (1280 x 720): une capture du jeu au rendu encré, le
// titre par-dessus. Source: `vignette-encre.html` (image de fond: une capture versionnée dans
// `docs/`). Usage: node games/la-petite-ligne-2/assets-src/vignette/generer-encre.mjs
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

// Playwright est préinstallé avec son Chromium: on le charge comme le font les bancs de capture.
const { chromium } = createRequire(import.meta.url)('playwright');
const ICI = path.dirname(fileURLToPath(import.meta.url));
const SORTIE = path.join(ICI, '..', '..', 'public', 'vignette.png');
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
});
await page.goto(pathToFileURL(path.join(ICI, 'vignette-encre.html')).href);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: SORTIE, type: 'png' });
await browser.close();
process.stdout.write(`vignette écrite: ${SORTIE}\n`);
