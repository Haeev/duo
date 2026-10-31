// Composition de la vignette de bibliothèque: public/vignette.png, 640 x 360 (16:9, PNG),
// à partir de scene.png (capturer.cjs) et du titre titre.svg.
//
// Usage, depuis la racine du dépôt:
//   node games/la-petite-ligne/assets-src/vignette/composer.cjs
// Outils: Playwright de l'environnement (Chromium, pour la police Fraunces du jeu) et
// ImageMagick (`convert`) pour la réduction finale.
//
// Méthode: Chromium pose le cadrage de la scène et le titre au double de la taille
// finale (1280 x 720), la police étant celle du jeu (@fontsource-variable/fraunces,
// soft.css); ImageMagick réduit ensuite de moitié (Lanczos), ce qui lisse les arêtes
// de la 3D et du titre comme un suréchantillonnage.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');

const HERE = __dirname;
const GAME = path.resolve(HERE, '..', '..');
const FONTS = path.join(GAME, 'node_modules', '@fontsource-variable', 'fraunces');
const OUT = path.join(GAME, 'public', 'vignette.png');

// Taille finale, fixée par la bibliothèque de Duo (cadre 16:9, 30 rem au plus).
const WIDTH = 640;
const HEIGHT = 360;
const SUPERSAMPLE = 2;

// Cadrage dans scene.png (1920 x 1080): rectangle 16:9 gardé, en pixels de la capture.
const CROP = { x: 330, y: 180, width: 1440, height: 810 };

const TYPES = {
  '.css': 'text/css',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function page() {
  const w = WIDTH * SUPERSAMPLE;
  const h = HEIGHT * SUPERSAMPLE;
  const scale = w / CROP.width;
  const svg = fs.readFileSync(path.join(HERE, 'titre.svg'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<link rel="stylesheet" href="/polices/soft.css">
<style>
  html, body { margin: 0; width: ${w}px; height: ${h}px; overflow: hidden; background: #1a2340; }
  #cadre { position: absolute; inset: 0; overflow: hidden; }
  #scene {
    position: absolute;
    left: ${-CROP.x * scale}px;
    top: ${-CROP.y * scale}px;
    width: ${1920 * scale}px;
    height: ${1080 * scale}px;
  }
  #titre { position: absolute; inset: 0; }
  #titre svg { width: 100%; height: 100%; display: block; }
</style>
</head>
<body>
<div id="cadre">
  <img id="scene" src="/scene.png" alt="">
  <div id="titre">${svg}</div>
</div>
</body>
</html>`;
}

async function main() {
  if (!fs.existsSync(path.join(HERE, 'scene.png'))) {
    throw new Error('scene.png absent: lancer capturer.cjs d\'abord');
  }
  const browser = await chromium.launch();
  const tab = await browser.newPage({
    viewport: { width: WIDTH * SUPERSAMPLE, height: HEIGHT * SUPERSAMPLE },
  });
  const refused = [];
  // Adresse fictive: la page lit les fichiers du disque, toute autre requête est refusée.
  await tab.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://duo.local') {
      refused.push(url.href);
      return route.abort();
    }
    if (url.pathname === '/') {
      return route.fulfill({ body: page(), contentType: 'text/html; charset=utf-8' });
    }
    // soft.css appelle ./files/*.woff2; le reste vient de ce dossier.
    const name = path.basename(url.pathname);
    let file = path.join(HERE, name);
    if (url.pathname.startsWith('/polices/files/')) {
      file = path.join(FONTS, 'files', name);
    } else if (url.pathname.startsWith('/polices/')) {
      file = path.join(FONTS, name);
    }
    return route.fulfill({
      body: fs.readFileSync(file),
      contentType: TYPES[path.extname(file)] ?? 'application/octet-stream',
    });
  });
  await tab.goto('http://duo.local/');
  await tab.evaluate(() => document.fonts.ready);
  const fontOk = await tab.evaluate(() => document.fonts.check('700 44px "Fraunces Variable"'));
  await tab.waitForFunction(() => {
    const img = document.getElementById('scene');
    return img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0;
  });
  if (!fontOk) {
    throw new Error('police Fraunces non chargée');
  }
  if (refused.length > 0) {
    throw new Error(`requêtes refusées: ${refused.join(', ')}`);
  }
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vignette-')), 'double.png');
  await tab.screenshot({ path: tmp });
  await browser.close();
  execFileSync('convert', [
    tmp,
    '-filter',
    'Lanczos',
    '-resize',
    `${WIDTH}x${HEIGHT}!`,
    '-strip',
    '-define',
    'png:compression-level=9',
    `PNG24:${OUT}`,
  ]);
  process.stdout.write(`${OUT}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
