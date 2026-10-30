'use strict';
// Rend les planches d'identité en PNG 1920x1080 (Playwright, Chromium), puis le comparatif
// et les vues de contrôle (niveaux de gris, deutéranopie, protanopie) avec ImageMagick.
// Usage: node rendre.cjs [dossier-des-vues-pleine-taille]
// Playwright est celui préinstallé dans l'environnement (require, résolu par NODE_PATH).
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const ICI = __dirname;
const PISTES = ['a', 'b', 'c'];
const CONTROLES = path.join(ICI, 'controles');
const VUES_COMPLETES = process.argv[2] ? path.resolve(process.argv[2]) : null;

// Machado, Oliveira et Fernandes (2009), sévérité 1, à appliquer en RGB linéaire.
const MATRICES = {
  deuteranopie: '0.367322 0.860646 -0.227968 0.280085 0.672501 0.047413 -0.011820 0.042940 0.968881',
  protanopie: '0.152286 1.052583 -0.204868 0.114503 0.786281 0.099216 -0.003882 -0.048116 1.051998',
};

async function capturer(navigateur, fichierHtml, fichierPng, hauteur) {
  const page = await navigateur.newPage({ viewport: { width: 1920, height: hauteur }, deviceScaleFactor: 1 });
  const horsDisque = [];
  page.on('request', (requete) => {
    const url = requete.url();
    if (!url.startsWith('file:') && !url.startsWith('data:')) horsDisque.push(url);
  });
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  page.on('requestfailed', (r) => erreurs.push('échec de chargement: ' + r.url()));
  await page.goto(pathToFileURL(fichierHtml).href, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const polices = await page.evaluate(() =>
    [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, '')),
  );
  await page.screenshot({ path: fichierPng });
  await page.close();
  const uniques = [...new Set(polices)].sort();
  console.log(`${path.basename(fichierPng)}: polices chargées [${uniques.join(', ')}], requêtes hors disque: ${horsDisque.length}, erreurs: ${erreurs.length}`);
  for (const e of erreurs) console.log('  ' + e);
  if (horsDisque.length > 0 || erreurs.length > 0) process.exitCode = 1;
}

function vuesDeControle(piste) {
  const source = path.join(ICI, `piste-${piste}.png`);
  const dossier = VUES_COMPLETES || fs.mkdtempSync(path.join(require('os').tmpdir(), 'duo-controles-'));
  fs.mkdirSync(dossier, { recursive: true });
  const gris = path.join(dossier, `piste-${piste}-gris.png`);
  execFileSync('convert', [source, '-colorspace', 'Gray', gris]);
  const vues = [[source, 'original'], [gris, 'niveaux de gris']];
  for (const [nom, matrice] of Object.entries(MATRICES)) {
    const sortie = path.join(dossier, `piste-${piste}-${nom}.png`);
    execFileSync('convert', [source, '-colorspace', 'RGB', '-color-matrix', matrice, '-colorspace', 'sRGB', sortie]);
    vues.push([sortie, nom === 'deuteranopie' ? 'deutéranopie (Machado 2009)' : 'protanopie (Machado 2009)']);
  }
  // Montage 2x2 à mi-taille: 1920x1080 au total, chaque vue légendée.
  const legendees = vues.map(([fichier, legende], i) => {
    const sortie = path.join(dossier, `piste-${piste}-vue-${i}.png`);
    execFileSync('convert', [
      fichier, '-resize', '960x540', '+repage', '-gravity', 'NorthWest', '-fill', '#000000', '-draw', 'rectangle 0,0 420,34',
      '-font', 'DejaVu-Sans-Bold', '-pointsize', '18', '-fill', '#FFFFFF', '-annotate', '+10+7', legende, sortie,
    ]);
    return sortie;
  });
  fs.mkdirSync(CONTROLES, { recursive: true });
  const montage = path.join(CONTROLES, `piste-${piste}-controles.png`);
  execFileSync('convert', [
    '(', legendees[0], legendees[1], '+append', ')', '(', legendees[2], legendees[3], '+append', ')', '-append', '+repage', montage,
  ]);
  if (!VUES_COMPLETES) fs.rmSync(dossier, { recursive: true, force: true });
  console.log(`controles/piste-${piste}-controles.png: original, gris, deutéranopie, protanopie`);
}

(async () => {
  const navigateur = await chromium.launch();
  const presentes = PISTES.filter((p) => fs.existsSync(path.join(ICI, `piste-${p}.html`)));
  for (const piste of presentes) {
    await capturer(navigateur, path.join(ICI, `piste-${piste}.html`), path.join(ICI, `piste-${piste}.png`), 1080);
  }
  const comparatif = path.join(ICI, 'comparatif.html');
  if (presentes.length === PISTES.length && fs.existsSync(comparatif)) {
    await capturer(navigateur, comparatif, path.join(ICI, 'comparatif.png'), 560);
  }
  await navigateur.close();
  for (const piste of presentes) vuesDeControle(piste);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
