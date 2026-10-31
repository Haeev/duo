// Capture de la scène de la vignette, sur la page de démonstration du rendu (rendu.html):
// le vrai moteur de rendu du jeu, en qualité normale, sur la vraie carte de la Halte,
// sans interface. Sortie: scene.png, à côté de ce script, en 1920 x 1080 (le plafond de
// pixels du moteur: une fenêtre plus grande ne donnerait pas plus de détail), recadrée et
// réduite ensuite par composer.cjs.
//
// Usage, depuis la racine du dépôt, le serveur de développement du jeu lancé:
//   pnpm --filter @duo/la-petite-ligne dev        (http://127.0.0.1:5173/)
//   node games/la-petite-ligne/assets-src/vignette/capturer.cjs [adresse du serveur]
// Playwright est celui de l'environnement (require('playwright')). En rendu logiciel
// (SwiftShader), compter une à trois minutes.

const path = require('node:path');
const { chromium } = require('playwright');

// Le cadrage: matin de printemps (8 h 30, soleil bas à l'est), train à quai vu de face,
// quatrième orientation de la caméra, zoom le plus large (composer.cjs recadre ensuite).
// La caméra suit le joueur 1: il est posé sur la place, à découvert, car tout ce qui le
// masque dans un rayon de 1,7 m s'efface en tramage (materiaux.ts), ce qui se verrait.
// `vie: 0` fige la promenade de la page de démonstration.
const SCENE = {
  heure: '8:30',
  meteo: 'sunny',
  train: 'stopped',
  x: '41.5',
  y: '22',
  zoom: '2',
  orientation: '3',
  vie: '0',
  stats: '0',
};
const WIDTH = 1920;
const HEIGHT = 1080;

async function main() {
  const base = process.argv[2] ?? 'http://127.0.0.1:5173/';
  const query = new URLSearchParams(SCENE).toString();
  const browser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(new URL(`rendu.html?${query}`, base).href);
  await page.waitForFunction(
    () => window.lplRendu !== undefined && window.lplRendu.ready && window.lplRendu.frames > 8,
    null,
    { timeout: 300000 },
  );
  // Laisse l'eau, la fumée et les ombres se poser.
  await page.waitForTimeout(2000);
  const out = path.join(__dirname, 'scene.png');
  await page.screenshot({ path: out, timeout: 300000 });
  await browser.close();
  if (errors.length > 0) {
    throw new Error(`erreurs dans la page: ${errors.join(' | ')}`);
  }
  process.stdout.write(`${out}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
