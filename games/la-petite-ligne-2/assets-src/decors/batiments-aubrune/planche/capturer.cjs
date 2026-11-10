/**
 * Capture des vues de la page de planche (Playwright, Chromium en rendu logiciel).
 *   NODE_PATH=/opt/node22/lib/node_modules node capturer.cjs <url de base> <dossier de sortie> <vues.json>
 * `vues.json`: liste de { nom, requete, largeur, hauteur }. Une image `<nom>.png` par vue, et
 * `mesures.json` (triangles, morceaux, appels de dessin de chaque vue).
 */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

async function main() {
  const [base, out, listFile] = process.argv.slice(2);
  const views = JSON.parse(fs.readFileSync(listFile, 'utf8'));
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const measures = {};
  for (const view of views) {
    const page = await browser.newPage({
      viewport: { width: view.largeur ?? 960, height: view.hauteur ?? 720 },
    });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.goto(
      `${base}/assets-src/decors/batiments-aubrune/planche/index.html?${view.requete}`,
    );
    try {
      await page.waitForFunction(
        () => window.planche && (window.planche.pret || window.planche.erreur),
        null,
        { timeout: 240000 },
      );
    } catch (error) {
      process.stdout.write(`${view.nom}: délai dépassé ${errors.join(' | ')}\n`);
      await page.close();
      continue;
    }
    const state = await page.evaluate(() => ({
      erreur: window.planche.erreur ?? null,
      triangles: window.planche.triangles,
      morceaux: window.planche.morceaux,
    }));
    if (state.erreur) {
      process.stdout.write(`${view.nom}: ERREUR ${state.erreur}\n`);
    } else {
      await page.locator('#scene').screenshot({ path: path.join(out, `${view.nom}.png`) });
      measures[view.nom] = state;
      process.stdout.write(
        `${view.nom}: ${state.triangles} triangles, ${state.morceaux} morceaux ${errors.join(' | ')}\n`,
      );
    }
    await page.close();
  }
  fs.writeFileSync(path.join(out, 'mesures.json'), `${JSON.stringify(measures, null, 1)}\n`);
  await browser.close();
}

main().catch((error) => {
  process.stderr.write(`${String(error?.stack ?? error)}\n`);
  process.exitCode = 1;
});
