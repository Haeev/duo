'use strict';
/*
  Planche de contrôle du sprite des icônes (icones.svg) et contrôle de palette.
  1. Palette: chaque couleur écrite dans un symbole appartient à palette.py (décor et personnages), à
     l'encre #2A2522 ou aux papiers de jeton.css. Les symboles d'avant la 0.12.2 qui avaient déjà des
     teintes à eux sont listés dans HERITES: signalés, pas en erreur.
  2. Planche PNG: chaque symbole à taille réelle, 24 et 48 px, sur le papier du carnet (#F3EBD4) puis
     sur son bois sombre (#5C3D24, en-tête des panneaux et fond du sac).

  Usage, depuis la racine du dépôt (régénérer d'abord le sprite avec generer-icones.mjs):
    node games/la-petite-ligne/ui-maquettes/outils/planche-icones.cjs [sortie.png] [préfixe,préfixe...]
  Le second argument limite la planche aux symboles dont l'identifiant commence par l'un des préfixes
  (planche partielle, pour regarder une famille de près); ZOOM=3 agrandit la capture. Sort en erreur (code 1) si une couleur est hors palette.
*/
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ICI = __dirname;
const JEU = path.join(ICI, '..', '..');
const SORTIE = process.argv[2] ?? path.join(ICI, '..', 'planche-icones.png');
const PREFIXES = (process.argv[3] ?? '').split(',').filter((p) => p !== '');

const ENCRE = '#2A2522';
const PAPIERS = ['#FBF6E9', '#F3EBD4', '#E6DABD', '#D9CCAB'];
const LUEUR_VERS_LUISANTS = '#B8F05A';
/** Teintes propres aux symboles d'avant la 0.12.2 (tolérées, signalées). */
const HERITES = new Set([
  'watering-can',
  'hen',
  'gift',
  'picture-frame',
  'weather-rain',
  'weather-cloud',
  'ui-coin-aubrin',
  'ui-star',
]);

const sprite = fs.readFileSync(path.join(ICI, '..', 'icones.svg'), 'utf8');
const palettePy = fs.readFileSync(path.join(JEU, 'assets-src', 'modeles', 'palette.py'), 'utf8');
const palette = new Set(
  [...palettePy.matchAll(/#[0-9A-Fa-f]{6}\b/g)].map((m) => m[0].toUpperCase()),
);
palette.add(ENCRE);
palette.add(LUEUR_VERS_LUISANTS);
for (const p of PAPIERS) palette.add(p);

const symboles = [
  ...sprite.matchAll(/<symbol id="([a-z0-9-]+)" viewBox="([^"]+)"[^>]*>([\s\S]*?)<\/symbol>/g),
].map((m) => ({ id: m[1], viewBox: m[2], corps: m[3] }));

let erreurs = 0;
const avis = [];
for (const { id, corps } of symboles) {
  const hors = [
    ...new Set([...corps.matchAll(/#[0-9A-Fa-f]{6}\b/g)].map((m) => m[0].toUpperCase())),
  ].filter((c) => !palette.has(c));
  if (hors.length === 0) continue;
  if (HERITES.has(id)) avis.push(`${id}: ${hors.join(' ')} (hérité)`);
  else {
    erreurs += 1;
    avis.push(`${id}: ${hors.join(' ')} HORS PALETTE`);
  }
}

const choisis = symboles.filter(
  (s) => PREFIXES.length === 0 || PREFIXES.some((p) => s.id.startsWith(p)),
);
const spriteCache = sprite.replace(/<svg /, '<svg width="0" height="0" style="position:absolute" ');

function cellule(id) {
  const use = `<use href="#${id}"/>`;
  return `<figure><div class="clair"><svg width="24" height="24">${use}</svg><svg width="48" height="48">${use}</svg></div><div class="sombre"><svg width="24" height="24">${use}</svg><svg width="48" height="48">${use}</svg></div><figcaption>${id}</figcaption></figure>`;
}

const page = `<!doctype html><html><head><meta charset="utf-8"><style>
  body { margin: 0; padding: 12px; background: #e6dabd; font: 11px/1.2 sans-serif; color: #2a2522; width: 1296px; }
  main { display: grid; grid-template-columns: repeat(6, 208px); gap: 6px 8px; }
  figure { margin: 0; }
  figure > div { display: inline-flex; gap: 8px; align-items: center; padding: 6px 8px; height: 50px; }
  .clair { background: #f3ebd4; border-radius: 6px 0 0 6px; }
  .sombre { background: #5c3d24; border-radius: 0 6px 6px 0; color: #fbf6e9; }
  figcaption { padding: 2px 4px; font-family: monospace; }
  svg { display: block; }
</style></head><body>${spriteCache}<main>${choisis.map((s) => cellule(s.id)).join('')}</main></body></html>`;

(async () => {
  const browser = await chromium.launch();
  const tab = await browser.newPage({
    deviceScaleFactor: Number(process.env.ZOOM ?? 1),
    viewport: { width: 1320, height: 800 },
  });
  await tab.setContent(page);
  await tab.screenshot({ path: SORTIE, fullPage: true });
  await browser.close();
  for (const ligne of avis) process.stdout.write(`${ligne}\n`);
  process.stdout.write(
    `${choisis.length} symboles sur la planche (${symboles.length} dans le sprite): ${SORTIE}\n`,
  );
  if (erreurs > 0) {
    process.stdout.write(`${erreurs} symbole(s) hors palette\n`);
    process.exitCode = 1;
  }
})();
