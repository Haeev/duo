'use strict';
// Rend les planches SVG de la bible de Cosy Café en PNG avec Chromium (Playwright), polices OFL embarquées,
// sans aucun accès réseau: les fichiers sont servis depuis le disque sous une adresse fictive (http://cc.local/),
// toute autre requête est refusée et comptée. Puis fabrique les contrôles (niveaux de gris, deutéranopie, protanopie;
// matrices de Machado 2009 appliquées par ImageMagick en RGB linéaire, comme pour l'identité de Duo).
// Pourquoi Chromium et non rsvg-convert: rsvg-convert lit les polices par fontconfig, qui ne sait pas dessiner
// les WOFF2 des paquets @fontsource (carrés vides, constaté le 2026-11-07).
// Usage: node source/rendre.cjs (depuis docs/jeux/cosy-cafe/bible, après npm ci et node source/planches.cjs)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const { imMatrix } = require('../../../../../design/identite/b/outils/couleur.cjs');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'controles');
const ORIGIN = 'http://cc.local';
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const FONTS = ['@fontsource-variable/jost/wght.css', '@fontsource-variable/dm-sans/standard.css', '@fontsource-variable/caveat/wght.css', '@fontsource/kalam/400.css', '@fontsource/kalam/700.css', '@fontsource/patrick-hand/400.css'];
const FAMILIES = ['Jost Variable', 'DM Sans Variable', 'Caveat Variable', 'Kalam', 'Patrick Hand'];
const virtual = {};
const outside = [];

async function shoot(browser, html, width, height, out) {
  const key = `__page-${Object.keys(virtual).length}.html`;
  virtual[key] = html;
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== ORIGIN) {
      outside.push(url.href);
      return route.abort();
    }
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    if (virtual[rel]) return route.fulfill({ body: virtual[rel], contentType: TYPES['.html'] });
    const file = path.normalize(path.join(ROOT, rel));
    if (!file.startsWith(ROOT) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ path: file, contentType: TYPES[path.extname(file)] || 'application/octet-stream' });
  });
  await page.goto(`${ORIGIN}/${key}`, { timeout: 120000 });
  await page.waitForFunction(() => window.planchePrete === true, null, { timeout: 120000 });
  const loaded = await page.evaluate(() => [...new Set([...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, '')))]);
  await page.screenshot({ path: out, fullPage: true, timeout: 240000 });
  await context.close();
  return loaded;
}

const pageFor = (inner, bg = '#F3EBDD') => `<!doctype html><html lang="fr"><head><meta charset="utf-8">${FONTS.map((f) => `<link rel="stylesheet" href="node_modules/${f}">`).join('')}<style>html,body{margin:0;background:${bg}}svg{display:block}</style></head><body>${inner}<script>Promise.all(${JSON.stringify(FAMILIES)}.map((f)=>document.fonts.load('20px "'+f+'"','Aéœ«»0'))).then(()=>document.fonts.ready).then(()=>Promise.all([...document.images].map((i)=>i.decode()))).then(()=>requestAnimationFrame(()=>{window.planchePrete=true}))</script></body></html>`;

const sim = (src, vision, dst) => {
  if (vision === 'gris') execFileSync('convert', [src, '-colorspace', 'Gray', dst]);
  else execFileSync('convert', [src, '-colorspace', 'RGB', '-color-matrix', imMatrix(vision), '-colorspace', 'sRGB', dst]);
};

// montage: une image par vision, en grille de deux colonnes, avec légende
async function montage(browser, base, label, width, out) {
  const views = [['normale', 'Vision normale'], ['gris', 'Niveaux de gris (ImageMagick, -colorspace Gray)'], ['deuteranopie', 'Deutéranopie (Machado 2009, sévérité 1)'], ['protanopie', 'Protanopie (Machado 2009, sévérité 1)']];
  const files = [];
  for (const [v] of views.slice(1)) {
    const f = path.join(OUT, `__${path.basename(base, '.png')}-${v}.png`);
    sim(base, v, f);
    files.push(f);
  }
  const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/');
  const imgs = views.map(([v, t], i) => `<figure><img src="${rel(i === 0 ? base : files[i - 1])}"><figcaption>${t}</figcaption></figure>`).join('');
  const html = pageFor(`<div style="width:${width}px;padding:20px;box-sizing:border-box;font:600 20px 'DM Sans Variable',sans-serif;color:#2B211C"><div style="font:500 28px 'Jost Variable',sans-serif;margin:0 0 14px">${label}</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">${imgs}</div></div><style>figure{margin:0}img{width:100%;display:block;border-radius:6px}figcaption{padding:6px 2px 0}</style>`);
  await shoot(browser, html, width, 400, out);
  for (const f of files) fs.rmSync(f);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'source', 'planches.json'), 'utf8'));
  const browser = await chromium.launch();
  const report = [];
  for (const p of manifest.planches) {
    const svg = fs.readFileSync(path.join(ROOT, p.svg), 'utf8');
    const out = path.join(ROOT, p.png);
    const fonts = await shoot(browser, pageFor(svg, p.bg || '#F3EBDD'), p.width, p.height, out);
    report.push(`${p.svg}: ${p.width} x ${p.height}, polices ${fonts.join(', ') || 'aucune'}`);
    for (const crop of p.crops || []) {
      // découpe d'une vue (vue subjective en 1366 x 768) pour ses contrôles
      const cropFile = path.join(ROOT, crop.png);
      execFileSync('convert', [out, '-crop', `${crop.w}x${crop.h}+${crop.x}+${crop.y}`, '+repage', cropFile]);
      if (crop.gray) sim(cropFile, 'gris', path.join(ROOT, crop.gray));
      if (crop.montage) await montage(browser, cropFile, crop.montageLabel, 1400, path.join(ROOT, crop.montage));
      if (crop.temporary) fs.rmSync(cropFile);
    }
    if (p.montage) await montage(browser, out, p.montageLabel, p.montageWidth || 1800, path.join(ROOT, p.montage));
  }
  await browser.close();
  for (const line of report) console.log(line);
  console.log(outside.length ? `REQUÊTES HORS DISQUE REFUSÉES: ${outside.join(', ')}` : 'aucune requête hors du disque');
  if (outside.length) process.exit(1);
})();
