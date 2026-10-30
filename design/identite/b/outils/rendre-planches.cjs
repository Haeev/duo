'use strict';
// Rend les planches de l'identité B avec Chromium (Playwright), sans aucun accès réseau:
// les pages sont servies depuis le disque sous une adresse fictive (http://duo.local/), toute autre requête
// est refusée et signalée. Produit:
//   controles/joueurs.png et controles/joueurs-controles.png (vision normale, protanopie, deutéranopie,
//     tritanopie, niveaux de gris: matrices de Machado 2009 appliquées par ImageMagick en RGB linéaire);
//   controles/icones-app-petites-tailles.png;
//   controles/logo-fidelite.png (lettres vectorisées contre le texte en Jost Light, écart compté en pixels);
//   planche-identite.png;
// et vérifie les polices réellement employées, dont le repli des espaces fines insécables.
// Usage: node outils/rendre-planches.cjs  (ou npm run planches)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const { imMatrix } = require('./couleur.cjs');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'controles');
const ORIGIN = 'http://duo.local';
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const virtualPages = {};
const outside = [];

async function openPage(browser, rel, width, height = 800) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== ORIGIN) {
      outside.push(url.href);
      return route.abort();
    }
    const relPath = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    if (virtualPages[relPath]) return route.fulfill({ body: virtualPages[relPath], contentType: TYPES['.html'] });
    const file = path.normalize(path.join(ROOT, relPath));
    if (!file.startsWith(ROOT) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ path: file, contentType: TYPES[path.extname(file)] || 'application/octet-stream' });
  });
  await page.goto(`${ORIGIN}/${rel}`);
  await page.waitForFunction(() => window.planchePrete === true, null, { timeout: 15000 });
  await page.evaluate(() => document.fonts.ready);
  const fonts = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, '')));
  return { page, context, fonts: [...new Set(fonts)] };
}

async function shoot(browser, rel, width, out) {
  const { page, context, fonts } = await openPage(browser, rel, width);
  await page.screenshot({ path: out, fullPage: true });
  await context.close();
  return fonts;
}

const simulate = (src, vision, dst) => {
  if (vision === 'gris') execFileSync('convert', [src, '-colorspace', 'Gray', dst]);
  else execFileSync('convert', [src, '-colorspace', 'RGB', '-color-matrix', imMatrix(vision), '-colorspace', 'sRGB', dst]);
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const report = [];

  // 1. joueurs et simulations
  const joueurs = path.join(OUT, 'joueurs.png');
  report.push(['planches/joueurs.html', await shoot(browser, 'planches/joueurs.html', 1600, joueurs)]);
  const views = [['normale', 'Vision normale'], ['protanopie', 'Protanopie'], ['deuteranopie', 'Deutéranopie'], ['tritanopie', 'Tritanopie'], ['gris', 'Niveaux de gris']];
  for (const [v] of views.slice(1)) simulate(joueurs, v, path.join(OUT, `joueurs-${v}.png`));
  virtualPages['controles/montage-joueurs.html'] = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><link rel="stylesheet" href="../node_modules/@fontsource-variable/dm-sans/standard.css"><style>
    body{margin:0;width:1640px;background:#05060F;color:#F3F1FA;font:600 18px 'DM Sans Variable',sans-serif;padding:16px;box-sizing:border-box}
    .g{display:grid;grid-template-columns:1fr 1fr;gap:14px} figure{margin:0} img{width:100%;display:block;border-radius:8px} figcaption{padding:6px 2px 0}
  </style></head><body><div class="g">${views.map(([v, t]) => `<figure><img src="${v === 'normale' ? 'joueurs.png' : `joueurs-${v}.png`}"><figcaption>${t}</figcaption></figure>`).join('')}</div><script>Promise.all([...document.images].map(i=>i.decode())).then(()=>{window.planchePrete=true})</script></body></html>`;
  report.push(['montage', await shoot(browser, 'controles/montage-joueurs.html', 1640, path.join(OUT, 'joueurs-controles.png'))]);

  // 2. icône d'application en petites tailles
  report.push(['planches/icones-app.html', await shoot(browser, 'planches/icones-app.html', 1280, path.join(OUT, 'icones-app-petites-tailles.png'))]);

  // 3. fidélité du logo: lettres vectorisées contre le même texte composé en Jost Variable 300
  const logo = fs.readFileSync(path.join(ROOT, 'logo/logo.svg'), 'utf8');
  const viewBox = logo.match(/viewBox="([^"]+)"/)[1];
  const letters = logo.match(/<path fill="[^"]+" d="([^"]+)"/)[1];
  const page = (inner) => `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="node_modules/@fontsource-variable/jost/wght.css"><style>body{margin:0;background:#fff}</style></head><body><svg width="1210" height="599" viewBox="${viewBox}">${inner}</svg><script>document.fonts.ready.then(()=>{window.planchePrete=true})</script></body></html>`;
  virtualPages['__logo-texte.html'] = page('<text x="0" y="780" font-family="Jost Variable" font-weight="300" font-size="1000" fill="#000">du</text>');
  virtualPages['__logo-traces.html'] = page(`<path fill="#000" d="${letters}"/>`);
  const tText = path.join(OUT, 'logo-texte.tmp.png');
  const tPath = path.join(OUT, 'logo-traces.tmp.png');
  await shoot(browser, '__logo-texte.html', 1210, tText);
  await shoot(browser, '__logo-traces.html', 1210, tPath);
  let differing = '';
  try {
    differing = execFileSync('compare', ['-metric', 'AE', '-fuzz', '25%', tText, tPath, 'null:'], { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
  } catch (e) {
    differing = (e.stderr || '').toString();
  }
  const inked = execFileSync('convert', [tText, '-threshold', '50%', '-format', '%[fx:(1-mean)*w*h]', 'info:']).toString();
  execFileSync('convert', [tText, tPath, '-compose', 'difference', '-composite', '-negate', path.join(OUT, 'logo-fidelite.png')]);
  fs.rmSync(tText);
  fs.rmSync(tPath);
  const diff = Number(differing.trim().split(/\s/)[0]);
  console.log(`logo: ${diff} pixels différents (seuil 25 %) sur ${Math.round(Number(inked))} pixels encrés, à 1210 px de large`);

  // 4. polices réellement employées, dont les caractères absents des deux polices
  virtualPages['__polices.html'] = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><link rel="stylesheet" href="node_modules/@fontsource-variable/jost/wght.css"><link rel="stylesheet" href="node_modules/@fontsource-variable/dm-sans/standard.css"><link rel="stylesheet" href="jetons.css"></head><body>
    <p id="titre" style="font-family:var(--font-display)">Bonsoir, Camille</p>
    <p id="texte" style="font-family:var(--font-text)">Sacha est là. Œuvre, déjà vu, à côté.</p>
    <p id="fine" style="font-family:var(--font-text)"> </p>
    <p id="insecable" style="font-family:var(--font-text)"> </p>
    <p id="trait" style="font-family:var(--font-text)">‑</p>
    <p id="cmd" style="font-family:var(--font-text)">⌘</p>
    <script>document.fonts.ready.then(()=>{window.planchePrete=true})</script></body></html>`;
  const fontsCheck = await openPage(browser, '__polices.html', 800);
  const client = await fontsCheck.context.newCDPSession(fontsCheck.page);
  await client.send('DOM.enable');
  await client.send('CSS.enable');
  const { root } = await client.send('DOM.getDocument');
  for (const id of ['titre', 'texte', 'fine', 'insecable', 'trait', 'cmd']) {
    const { nodeId } = await client.send('DOM.querySelector', { nodeId: root.nodeId, selector: `#${id}` });
    const { fonts } = await client.send('CSS.getPlatformFontsForNode', { nodeId });
    console.log(`polices pour #${id}: ${fonts.map((f) => `${f.familyName}${f.isCustomFont ? ' (embarquée)' : ' (système)'} x${f.glyphCount}`).join(', ')}`);
  }
  await fontsCheck.context.close();

  // 5. planche récapitulative
  report.push(['planche-identite.html', await shoot(browser, 'planche-identite.html', 1920, path.join(ROOT, 'planche-identite.png'))]);

  await browser.close();
  for (const [name, fonts] of report) console.log(`${name}: polices chargées ${fonts.join(', ') || 'aucune'}`);
  console.log(outside.length ? `REQUÊTES HORS DISQUE REFUSÉES: ${outside.join(', ')}` : 'aucune requête hors du disque');
  if (outside.length) process.exit(1);
})();
