// Captures de la page d'essai du rendu encré (vrai rendu Three.js, 1366x768, sans retouche).
//
// 1. Dans games/la-petite-ligne-2: npx vite --port 5311 --strictPort
// 2. node capturer.mjs <dossier de sortie> "<nom>=<json de réglages>" ...
//    Réglages: ceux de `State` dans src/rendu/demo-encre/main.ts (scene, ambiance, contour, shadow,
//    dense, hierarchy, x, z, width, yaw), plus "view": "large" ou "proche".
//    Exemple: node capturer.mjs sortie 'jour={"scene":"exterieur","ambiance":"jour","view":"large"}'
// Chaque ligne affichée donne les mesures de l'image: appels de dessin, triangles (toutes passes),
// millisecondes (rendu logiciel: indicatif) et programmes.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const game = path.resolve(here, '../../../../../../games/la-petite-ligne-2/');
const { chromium } = createRequire(path.join(game, 'package.json'))('playwright');

const [, , out, ...shots] = process.argv;
if (!out || shots.length === 0) {
  process.stderr.write('Usage: node capturer.mjs <dossier> "<nom>=<json>" ...\n');
  process.exit(1);
}
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
page.on('pageerror', (error) => process.stderr.write(`[erreur] ${String(error).slice(0, 1500)}\n`));
await page.goto('http://localhost:5311/src/rendu/demo-encre/index.html?panneau=0', { waitUntil: 'load' });
await page.waitForFunction(() => (window.encre?.frames ?? 0) >= 2, null, { timeout: 180000 });
for (const shot of shots) {
  const cut = shot.indexOf('=');
  const name = shot.slice(0, cut);
  const result = await page.evaluate(async (change) => {
    const next = (count) =>
      new Promise((resolve) => {
        const target = window.encre.frames + count;
        const wait = () => (window.encre.frames >= target ? resolve() : requestAnimationFrame(wait));
        wait();
      });
    window.encre.set(change);
    await next(2);
    // Quelques images de plus: la mesure du temps se stabilise.
    for (let i = 0; i < 6; i += 1) {
      window.encre.set({});
      await next(1);
    }
    return { stats: window.encre.stats, url: document.querySelector('#scene').toDataURL('image/png') };
  }, JSON.parse(shot.slice(cut + 1)));
  fs.writeFileSync(path.join(out, `${name}.png`), Buffer.from(result.url.split(',')[1], 'base64'));
  process.stdout.write(`${name} ${JSON.stringify(result.stats)}\n`);
}
await browser.close();
