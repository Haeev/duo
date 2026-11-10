/**
 * Captures de l'interface en style encré depuis la page de démonstration.
 *
 * Usage (Vite du jeu lancé, par exemple `vite --port 5391`):
 *   NODE_PATH=/opt/node-tools/node_modules node assets-src/interface-encre/capturer.cjs \
 *     http://localhost:5391 <dossier de sortie> [largeur] [hauteur] [suffixe]
 * Sans taille: 1366x768 et les cinq fichiers `ui-encre-*.png` attendus par la refonte.
 */
const path = require('node:path');
const { chromium } = require('playwright');

const [base, out, w = '1366', h = '768', suffix = ''] = process.argv.slice(2);
if (base === undefined || out === undefined) {
  process.stderr.write('Usage: capturer.cjs <adresse de Vite> <dossier> [largeur] [hauteur]\n');
  process.exit(1);
}

const SHOTS = [
  ['hud', 'ecran=hud&fond=exterieur-jour'],
  ['dialogue', 'ecran=dialogue-choix&fond=exterieur-jour'],
  ['dialogue-suite', 'ecran=dialogue&fond=interieur-jour'],
  ['carnet', 'ecran=carnet&fond=exterieur-nuit'],
  ['boutique', 'ecran=boutique-refus&fond=interieur-jour'],
  ['boutique-achat', 'ecran=boutique&fond=interieur-jour'],
  ['planche', 'ecran=planche'],
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  for (const [name, query] of SHOTS) {
    await page.goto('about:blank');
    await page.goto(`${base}/src/interface/encre/demo/index.html?${query}`);
    await page.waitForSelector('body[data-ready="oui"]', { timeout: 15000 });
    // Les animations d'entrée sont menées à leur terme: la capture montre l'état installé.
    await page.evaluate(() => {
      for (const animation of document.getAnimations()) {
        try {
          animation.finish();
        } catch {
          // Une animation en boucle ne se termine pas: elle reste où elle est.
        }
      }
    });
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(out, `ui-encre-${name}${suffix}.png`) });
  }
  await browser.close();
  if (errors.length > 0) {
    process.stderr.write(`${errors.join('\n')}\n`);
    process.exit(1);
  }
})();
