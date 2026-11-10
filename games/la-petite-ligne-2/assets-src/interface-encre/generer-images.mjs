/**
 * Génère les images « à la plume » de l'interface depuis leurs sources (moteur: `encrer.mjs`).
 *
 * Lancer depuis le paquet (Chromium de Playwright, rsvg-convert de la boîte à outils):
 *   NODE_PATH=/opt/node-tools/node_modules node assets-src/interface-encre/generer-images.mjs \
 *     [vignettes|pictos|portraits] [identifiant[,identifiant...]]
 *
 * - `vignettes/<objet>.svg` (grille 96) -> `assets/commun/interface/vignettes/<objet>.svg`,
 *   `<objet>-96.png` et `<objet>-48.png`. L'interface prend le SVG dès qu'il existe.
 * - `pictos/pictos.svg` (un `<symbol id>` par picto, grille 24) -> `src/interface/pictos-encre.ts`.
 * - `portraits/<habitant>.svg` (grille 190 x 230, calques d'expression) ->
 *   `assets/commun/interface/portraits/<habitant>.svg`, plus un PNG par expression (revue).
 * Le tirage est fixe (graine par identifiant): relancer sur une source intacte ne change rien.
 * Les fichiers dont le nom commence par `_` (gabarits) sont ignorés.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { encrer } from './encrer.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const here = path.dirname(fileURLToPath(import.meta.url));
const pkg = path.join(here, '..', '..');
const OUT_ASSETS = path.join(pkg, 'assets', 'commun', 'interface');
const [only, onlyId] = process.argv.slice(2);

const sources = (family) =>
  readdirSync(path.join(here, family))
    .filter((f) => f.endsWith('.svg') && !f.startsWith('_'))
    .map((f) => ({ id: f.slice(0, -4), text: readFileSync(path.join(here, family, f), 'utf8') }))
    .filter((s) => onlyId === undefined || onlyId.split(',').includes(s.id));

const png = (svgFile, size, out, height = size) =>
  execFileSync('rsvg-convert', ['-w', String(size), '-h', String(height), svgFile, '-o', out]);

const browser = await chromium.launch();
const page = await browser.newPage();

if (only === undefined || only === 'vignettes') {
  const dir = path.join(OUT_ASSETS, 'vignettes');
  mkdirSync(dir, { recursive: true });
  for (const s of sources('vignettes')) {
    const svg = await encrer(page, s.text, { id: s.id, prefix: `v-${s.id}-` });
    const file = path.join(dir, `${s.id}.svg`);
    writeFileSync(file, `${svg}\n`);
    png(file, 96, path.join(dir, `${s.id}-96.png`));
    png(file, 48, path.join(dir, `${s.id}-48.png`));
    process.stdout.write(`vignette ${s.id}: ${String(Math.round(svg.length / 1024))} Ko\n`);
  }
}

if (only === undefined || only === 'pictos') {
  // Un seul fichier source: un `<symbol id>` par picto, sur la grille de la racine.
  const text = readFileSync(path.join(here, 'pictos', 'pictos.svg'), 'utf8');
  const root = text.match(/<svg[^>]*>/);
  if (root === null) throw new Error('pictos.svg: racine absente');
  const all = [...text.matchAll(/<symbol id="([a-z-]+)">([\s\S]*?)<\/symbol>/g)].map((m) => ({
    id: m[1],
    text: `${root[0]}${m[2]}</svg>`,
  }));
  const entries = [];
  for (const s of all) {
    const body = await encrer(page, s.text, { id: s.id, digits: 1, minSeg: 0.32 });
    entries.push(`  '${s.id}': '${body}',`);
  }
  const ts = `/**
 * Pictos de l'interface dessinés à la plume (grille 24, encre en \`currentColor\`). Fichier généré
 * par \`assets-src/interface-encre/generer-images.mjs pictos\` depuis \`assets-src/interface-encre/pictos/\`:
 * ne pas le retoucher à la main.
 */
export const INK_PICTOS: Readonly<Record<string, string>> = {
${entries.join('\n')}
};
`;
  if (onlyId !== undefined)
    throw new Error('pictos: régénérer la famille entière (fichier unique)');
  const file = path.join(pkg, 'src', 'interface', 'pictos-encre.ts');
  writeFileSync(file, ts);
  // Mise en forme du dépôt, pour qu'une régénération sans changement ne laisse aucun écart.
  execFileSync('npx', ['prettier', '--write', file], { cwd: pkg });
  process.stdout.write(`pictos: ${String(entries.length)}\n`);
}

if (only === undefined || only === 'portraits') {
  const dir = path.join(OUT_ASSETS, 'portraits');
  mkdirSync(dir, { recursive: true });
  for (const s of sources('portraits')) {
    // Préfixe remplacé à l'affichage (`portrait.ts`): deux portraits dans la page, deux préfixes.
    const svg = await encrer(page, s.text, { id: s.id, prefix: '__P__' });
    const file = path.join(dir, `${s.id}.svg`);
    writeFileSync(file, `${svg}\n`);
    const exprs = [...svg.matchAll(/class="expr expr--([a-z]+)"/g)].map((m) => m[1]);
    for (const e of exprs) {
      // Une expression à la fois pour la revue: les autres calques sont retirés.
      const one = svg
        .replace(/__P__/g, 'p-')
        .replace(
          new RegExp(`<g class="expr expr--(?!${e}")[a-z]+">.*?</g>(?=<g class="expr|</svg>)`, 'g'),
          '',
        );
      const tmp = path.join(dir, `.${s.id}-${e}.svg`);
      writeFileSync(tmp, one);
      png(tmp, 190, path.join(dir, `${s.id}-${e}.png`), 230);
      execFileSync('rm', [tmp]);
    }
    process.stdout.write(`portrait ${s.id}: ${exprs.join(', ')}\n`);
  }
}

await browser.close();
