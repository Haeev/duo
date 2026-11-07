// Capture de la visionneuse sous Chromium (WebGL2 logiciel). Usage:
//   node capturer.mjs <sortie.png> '<paramètres d'adresse>' [<sortie2.png> '<paramètres2>' ...]
import { createRequire } from 'node:module';
import { demarrer } from './serveur.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const args = process.argv.slice(2);
const serveur = await demarrer(0);
const port = serveur.address().port;
const nav = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  for (let i = 0; i < args.length; i += 2) {
    const params = new URLSearchParams(args[i + 1]);
    const w = Number(params.get('w') || 1366);
    const h = Number(params.get('h') || 768);
    const page = await nav.newPage({ viewport: { width: w, height: h } });
    const erreurs = [];
    page.on('pageerror', (e) => erreurs.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') erreurs.push(m.text()); });
    await page.goto(`http://127.0.0.1:${port}/assets-src/modeles/verifier/vue/?${args[i + 1]}`);
    await page.waitForFunction(() => window.vue && window.vue.pret, null, { timeout: 600000 });
    const etat = await page.evaluate(() => window.vue);
    if (etat.erreur) erreurs.push(etat.erreur);
    await page.locator('canvas').screenshot({ path: args[i] });
    process.stdout.write(`${args[i]} ${JSON.stringify(etat.stats || {})} ${erreurs.join(' | ')}\n`);
    await page.close();
  }
} finally {
  await nav.close();
  serveur.close();
}
