// Planche comparative pour le client: les variantes côte à côte, mêmes vues, avec leurs mesures.
// Usage: node planche.mjs [variantes=A,B]  ->  ../planche-comparative.png
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { demarrer } from './serveur.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ici = path.dirname(fileURLToPath(import.meta.url));
const racine = path.resolve(ici, '..');
const variantes = (process.argv[2] || 'A,B').split(',');
const mesures = JSON.parse(readFileSync(path.join(racine, 'captures', 'mesures.json'), 'utf8'));
const NOMS = { A: 'A. Stylisé chaleureux', B: 'B. Semi-réaliste', C: 'C. Mélange' };
const RESUMES = {
  A: 'Formes arrondies, biseaux généreux, aplats de la palette, lumière dorée cuite: la maquette peinte de la bible.',
  B: 'Proportions réelles, bois veiné, tomettes, faïence, chaux, métaux et émaux qui brillent, même lumière cuite.',
  C: '',
};
const VUES = ['Derrière le comptoir, vers la salle et la place', 'Depuis l\'entrée, vers le comptoir', 'À hauteur de main: la machine et la tasse'];

const colonnes = variantes.map((v) => {
  const m = mesures[`${v}-vue1-1366x768`] || {};
  const m2 = mesures[`${v}-vue2-1366x768`] || {};
  const cells = [1, 2, 3].map((n) => `<figure><img src="/captures/${v}-vue${n}-1366x768.png"><figcaption>${n}. ${VUES[n - 1]}</figcaption></figure>`).join('');
  return `<section><h2>${NOMS[v]}</h2><p class="resume">${RESUMES[v]}</p>${cells}
  <p class="mesures">Vue 1: ${m.triangles_dessines ?? '?'} triangles, ${m.appels ?? '?'} appels, ${m.programmes ?? '?'} programmes. Vue 2: ${m2.triangles_dessines ?? '?'} triangles, ${m2.appels ?? '?'} appels. Textures: ${m.memoire_textures_mo ?? '?'} Mo. Budget du village: 150 000 triangles, 80 appels, 10 programmes, 128 Mo de textures.</p></section>`;
}).join('');

const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>
@font-face { font-family: 'Jost'; src: url('/polices/jost/files/jost-latin-wght-normal.woff2'); font-weight: 100 900; }
@font-face { font-family: 'DM Sans'; src: url('/polices/dm-sans/files/dm-sans-latin-wght-normal.woff2'); font-weight: 100 900; }
body { margin: 0; background: #F6EEDF; color: #2B211C; font-family: 'DM Sans'; width: ${variantes.length * 1000 + 80}px; }
header { padding: 36px 40px 8px; } h1 { font-family: 'Jost'; font-weight: 600; font-size: 44px; margin: 0 0 6px; }
header p { margin: 0; font-size: 20px; color: #5C4A3E; }
main { display: flex; gap: 40px; padding: 20px 40px 40px; }
section { width: 960px; } h2 { font-family: 'Jost'; font-size: 32px; margin: 8px 0 4px; }
.resume { font-size: 19px; margin: 0 0 14px; min-height: 52px; }
figure { margin: 0 0 14px; } img { width: 960px; display: block; border-radius: 4px; }
figcaption { font-size: 17px; color: #5C4A3E; margin-top: 5px; } .mesures { font-size: 16px; color: #5C4A3E; }
</style></head><body><header><h1>Cosy Café: essai de style 3D, le café du village</h1>
<p>Même scène, même cadrage, même lumière de fin d'après-midi: seule la direction de rendu change. Captures de la scène Three.js 0.187 à 1366 x 768, yeux à 1,65 m (1,30 m pour le gros plan), champ vertical de 60 degrés.</p></header>
<main>${colonnes}</main></body></html>`;
writeFileSync(path.join(racine, 'captures', 'planche.html'), html);

const serveur = await demarrer(0);
const navigateur = await chromium.launch();
const page = await navigateur.newPage({ viewport: { width: variantes.length * 1000 + 80, height: 1000 } });
await page.goto(`http://127.0.0.1:${serveur.address().port}/captures/planche.html`);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: path.join(racine, 'planche-comparative.png'), fullPage: true });
await navigateur.close();
serveur.close();
