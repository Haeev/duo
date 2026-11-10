/**
 * Capture des vues de la planche des récoltables (Playwright, Chromium en rendu logiciel).
 *   NODE_PATH=/opt/node22/lib/node_modules node capturer.cjs <url de base> <dossier de sortie> <vues.json> [nom,nom]
 * `vues.json`: liste écrite par `monter.py vues`. Une image `<nom>.png` par vue, et
 * `mesures.json` (triangles, appels de dessin, places des étiquettes de chaque vue).
 */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

async function main() {
  const [base, out, listFile, only] = process.argv.slice(2);
  const wanted = only ? new Set(only.split(',')) : null;
  const views = JSON.parse(fs.readFileSync(listFile, 'utf8')).filter(
    (view) => wanted === null || wanted.has(view.nom),
  );
  fs.mkdirSync(out, { recursive: true });
  const measuresFile = path.join(out, 'mesures.json');
  const measures = fs.existsSync(measuresFile)
    ? JSON.parse(fs.readFileSync(measuresFile, 'utf8'))
    : {};
  const browser = await chromium.launch();
  for (const view of views) {
    const page = await browser.newPage({
      viewport: { width: view.largeur, height: view.hauteur },
    });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.goto(`${base}/assets-src/decors/recoltables-aubrune/planche/index.html`);
    try {
      await page.waitForFunction(() => window.planche !== undefined, null, { timeout: 240000 });
      const ready = await page.evaluate(() => ({
        erreur: window.planche.erreur ?? null,
        modeles: window.planche.modeles,
      }));
      if (ready.erreur) throw new Error(ready.erreur);
      page.setDefaultTimeout(600000);
      const state = await page.evaluate((v) => window.planche.montrer(v), view);
      await page.locator('#scene').screenshot({ path: path.join(out, `${view.nom}.png`) });
      measures[view.nom] = state;
      process.stdout.write(
        `${view.nom}: ${state.triangles} triangles de modèles, ${state.trianglesImage} dessinés, ${state.appels} appels` +
          `${state.manquants.length > 0 ? `, MANQUANTS ${state.manquants.join(' ')}` : ''} ${errors.join(' | ')}\n`,
      );
    } catch (error) {
      process.stdout.write(`${view.nom}: ERREUR ${String(error)} ${errors.join(' | ')}\n`);
      process.exitCode = 1;
    }
    await page.close();
  }
  fs.writeFileSync(measuresFile, `${JSON.stringify(measures, null, 1)}\n`);
  await browser.close();
}

main().catch((error) => {
  process.stderr.write(`${String(error?.stack ?? error)}\n`);
  process.exitCode = 1;
});
