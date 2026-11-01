'use strict';
/*
  Planche de contrôle des vignettes du carnet (symboles memory-* de icones.svg) et contrôle de palette.
  1. Palette: chaque couleur écrite dans un symbole memory-* appartient à palette.py (décor et personnages),
     à l'encre #2A2522 ou à la lueur des vers luisants (#B8F05A, moments.json). Pour chaque vignette:
     L* du disque, couleurs du sujet (hors encre et disque) avec leur L* et l'écart au disque.
  2. Planche PNG: chaque vignette à 40, 60 et 190 px sur le papier du carnet, en couleur puis en niveaux de gris.

  Usage, depuis la racine du dépôt (régénérer d'abord le sprite avec generer-icones.mjs):
    node games/la-petite-ligne/ui-maquettes/outils/planche-vignettes.cjs [sortie.png]
  Sort en erreur (code 1) si une couleur est hors palette.
*/
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ICI = __dirname;
const JEU = path.join(ICI, '..', '..');
const SORTIE =
  process.argv[2] ??
  path.join(
    JEU,
    '..',
    '..',
    'docs',
    'jeux',
    'jeu-1',
    'gauntlet',
    'captures',
    'tour-09',
    'vignettes-planche.png',
  );

const ENCRE = '#2A2522';
const LUEUR_VERS_LUISANTS = '#B8F05A';
const PAPIER = '#fbf6e9';

const sprite = fs.readFileSync(path.join(ICI, '..', 'icones.svg'), 'utf8');
const palettePy = fs.readFileSync(path.join(JEU, 'assets-src', 'modeles', 'palette.py'), 'utf8');
const palette = new Set(
  [...palettePy.matchAll(/#[0-9A-Fa-f]{6}\b/g)].map((m) => m[0].toUpperCase()),
);
palette.add(ENCRE);
palette.add(LUEUR_VERS_LUISANTS);

/** L* (CIELAB, D65) d'une couleur sRGB #RRGGBB. */
function lightness(hex) {
  const lin = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const y = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  const f = y > 216 / 24389 ? Math.cbrt(y) : ((24389 / 27) * y + 16) / 116;
  return 116 * f - 16;
}

const symboles = [
  ...sprite.matchAll(/<symbol id="(memory-[a-z-]+)"[^>]*>([\s\S]*?)<\/symbol>/g),
].map((m) => ({ id: m[1], corps: m[2] }));

let horsPalette = 0;
const lignes = [];
for (const { id, corps } of symboles) {
  const couleurs = [...corps.matchAll(/#[0-9A-Fa-f]{6}\b/g)].map((m) => m[0].toUpperCase());
  const disque = /<circle cx="20" cy="20" r="18" fill="(#[0-9A-Fa-f]{6})"/
    .exec(corps)?.[1]
    ?.toUpperCase();
  for (const c of new Set(couleurs)) {
    if (!palette.has(c)) {
      horsPalette += 1;
      lignes.push(`${id}: ${c} hors palette`);
    }
  }
  if (disque === undefined) {
    lignes.push(`${id}: pas de disque de rayon 18 centré`);
    horsPalette += 1;
    continue;
  }
  const ld = lightness(disque);
  const sujet = [...new Set(couleurs)].filter((c) => c !== ENCRE && c !== disque);
  const detail = sujet
    .map((c) => `${c} L*${lightness(c).toFixed(0)} (${(lightness(c) - ld).toFixed(0)})`)
    .join(', ');
  lignes.push(`${id}: disque ${disque} L*${ld.toFixed(0)}; ${sujet.length} couleurs: ${detail}`);
}
process.stdout.write(`${lignes.join('\n')}\n`);

const TAILLES = [40, 60, 190];
const cellule = ({ id }) => `
  <div class="cell">
    <div class="nom">${id}</div>
    <div class="rang">${TAILLES.map((t) => `<svg width="${t}" height="${t}"><use href="#${id}"/></svg>`).join('')}</div>
  </div>`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  body { margin: 0; font: 13px sans-serif; background: #e9e2d0; color: #2a2522; }
  h1 { font-size: 15px; margin: 6px 10px; }
  .grille { display: grid; grid-template-columns: repeat(4, 330px); gap: 8px; padding: 0 8px 8px; }
  .cell { background: ${PAPIER}; padding: 6px 8px; }
  .rang { display: flex; align-items: center; gap: 10px; }
  .gris .grille { filter: grayscale(1); }
</style></head><body>
  ${sprite.replace('<svg ', '<svg width="0" height="0" style="position:absolute" ')}
  <h1>Vignettes du carnet: 40, 60 et 190 px, en couleur</h1>
  <div class="grille">${symboles.map(cellule).join('')}</div>
  <div class="gris"><h1>En niveaux de gris</h1>
  <div class="grille">${symboles.map(cellule).join('')}</div></div>
</body></html>`;

(async () => {
  fs.mkdirSync(path.dirname(SORTIE), { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1376, height: 800 } });
  await page.setContent(html);
  await page.screenshot({ path: SORTIE, fullPage: true });
  await browser.close();
  process.stdout.write(`${SORTIE}\n`);
  process.exitCode = horsPalette === 0 ? 0 : 1;
})();
