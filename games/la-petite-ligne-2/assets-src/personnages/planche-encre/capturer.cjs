/**
 * Capture des vues de la planche des tenues (Playwright, Chromium en rendu logiciel).
 *   NODE_PATH=/opt/node22/lib/node_modules node capturer.cjs <url de base> <dossier de sortie> <vues.json>
 * `vues.json`: liste écrite par `planche_tenues.py vues`; une image `<nom>.png` par vue.
 */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

async function main() {
  const [base, out, listFile] = process.argv.slice(2);
  const views = JSON.parse(fs.readFileSync(listFile, 'utf8'));
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.setDefaultTimeout(600000);
  await page.goto(`${base}/assets-src/personnages/planche-encre/index.html`);
  await page.waitForFunction(() => window.planche?.pret === true, null, { timeout: 240000 });
  for (const view of views) {
    try {
      const url = await page.evaluate((v) => window.planche.vue(v), view);
      fs.writeFileSync(path.join(out, `${view.nom}.png`), Buffer.from(url.split(',')[1], 'base64'));
    } catch (error) {
      process.stdout.write(`${view.nom}: ERREUR ${String(error)} ${errors.join(' | ')}\n`);
      process.exitCode = 1;
    }
  }
  process.stdout.write(
    `${views.length} vues${errors.length ? `, erreurs: ${errors.join(' | ')}` : ''}\n`,
  );
  await browser.close();
}

main().catch((error) => {
  process.stderr.write(`${String(error?.stack ?? error)}\n`);
  process.exitCode = 1;
});
