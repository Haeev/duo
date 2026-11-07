// Captures de l'essai sous Chromium (WebGL2 logiciel, SwiftShader) et mesures de renderer.info.
// Usage: node capturer.mjs [variantes=A,B] [vues=1,2,3] [tailles=1366x768,1920x1080]
// Écrit ../captures/<variante>-vue<n>-<w>x<h>.png et ../captures/mesures.json (fusionné avec l'existant).
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { demarrer } from './serveur.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ici = path.dirname(fileURLToPath(import.meta.url));
const sortie = path.resolve(ici, '..', 'captures');
mkdirSync(sortie, { recursive: true });

const variantes = (process.argv[2] || 'A,B').split(',');
const vues = (process.argv[3] || '1,2,3').split(',');
const tailles = (process.argv[4] || '1366x768').split(',').map((t) => t.split('x').map(Number));
// vues de contrôle: nom=px,py,pz;cx,cy,cz (5e argument, séparées par |)
const controles = Object.fromEntries((process.argv[5] || '').split('|').filter(Boolean).map((e) => { const [n, r] = e.split('='); const [p, c] = r.split(';'); return [n, `&pos=${p}&cible=${c}`]; }));

const serveur = await demarrer(0);
const port = serveur.address().port;
const navigateur = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const fichierMesures = path.join(sortie, 'mesures.json');
const mesures = existsSync(fichierMesures) ? JSON.parse(readFileSync(fichierMesures, 'utf8')) : {};
try {
  for (const v of variantes) {
    for (const vue of vues) {
      for (const [w, h] of tailles) {
        const page = await navigateur.newPage({ viewport: { width: w, height: h } });
        const erreurs = [];
        page.on('pageerror', (e) => erreurs.push(String(e)));
        page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
        const t0 = Date.now();
        await page.goto(`http://127.0.0.1:${port}/scene/?v=${v}&vue=${vue}&w=${w}&h=${h}${controles[vue] || ''}`);
        await page.waitForFunction(() => window.essai && window.essai.pret, null, { timeout: 300000 });
        const etat = await page.evaluate(() => window.essai);
        if (etat.erreur) throw new Error(etat.erreur);
        const nom = controles[vue] ? `controle-${v}-${vue}.png` : `${v}-vue${vue}-${w}x${h}.png`;
        await page.locator('canvas').screenshot({ path: path.join(sortie, nom) });
        if (!controles[vue]) mesures[`${v}-vue${vue}-${w}x${h}`] = { ...etat.stats, duree_chargement_ms: Date.now() - t0, erreurs };
        process.stdout.write(`${nom} ${JSON.stringify({ appels: etat.stats.appels, tri: etat.stats.triangles_dessines, prog: etat.stats.programmes, mo: etat.stats.memoire_textures_mo })} ${erreurs.join(' | ')}\n`);
        await page.close();
      }
    }
  }
} finally {
  writeFileSync(fichierMesures, JSON.stringify(mesures, null, 1));
  await navigateur.close();
  serveur.close();
}
