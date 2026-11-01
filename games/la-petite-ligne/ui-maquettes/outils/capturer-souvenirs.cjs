'use strict';
/*
  Captures de l'onglet Souvenirs du carnet (tour 7, S-15) sur la page de démonstration de
  l'interface, chez les deux joueurs, à 1366x768, taille de l'interface 100 et 150 %. Contrôle
  aussi qu'aucune entrée ne sort de la fenêtre ni ne coupe son texte, et qu'aucun compteur de
  collection n'apparaît (S-11: ni « sur 12 », ni « / », ni « % »).

  Usage, depuis la racine du dépôt, le serveur Vite du jeu lancé
  (cd games/la-petite-ligne && npx vite --port 5197):
    node games/la-petite-ligne/ui-maquettes/outils/capturer-souvenirs.cjs [http://127.0.0.1:5197/] [filtre]
  Sorties: docs/jeux/jeu-1/gauntlet/captures/tour-07/souvenirs-*.png
  Format CommonJS: playwright est installé hors du dépôt, résolu par require.
*/
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.argv[2] ?? 'http://127.0.0.1:5197/';
const FILTRE = process.argv[3] ?? '';
const SORTIE = path.join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'docs',
  'jeux',
  'jeu-1',
  'gauntlet',
  'captures',
  'tour-07',
);

// [nom, scénario, joueur, attente (sélecteur visible), défiler jusqu'au bas de la page]
const ECRANS = [
  ['vide-p1', 'souvenirs-vide', 'p1', '.lpl-memories', false],
  ['vide-p2', 'souvenirs-vide', 'p2', '.lpl-memories', false],
  ['premier-p1', 'souvenirs-premier', 'p1', '.lpl-memory[data-fresh]', false],
  ['premier-p2', 'souvenirs-premier', 'p2', '.lpl-memory[data-fresh]', false],
  ['secret-p1', 'souvenirs-secret', 'p1', '.lpl-memory', false],
  ['secret-p2', 'souvenirs-secret', 'p2', '.lpl-memory', false],
  ['plusieurs-p1', 'souvenirs-plusieurs', 'p1', '.lpl-memory[data-fresh]', false],
  ['plusieurs-p2', 'souvenirs-plusieurs', 'p2', '.lpl-memory[data-fresh]', false],
  ['deux-annees-p1', 'souvenirs-deux-annees', 'p1', '.lpl-memory', false],
  ['deux-annees-p2', 'souvenirs-deux-annees', 'p2', '.lpl-memory', false],
  ['deux-annees-bas-p1', 'souvenirs-deux-annees', 'p1', '.lpl-memory', true],
  ['deux-annees-bas-p2', 'souvenirs-deux-annees', 'p2', '.lpl-memory', true],
];

const TAILLES = [100, 150];

/** Ce qui sort de la fenêtre, déborde de sa boîte, ou ressemble à un compteur de collection. */
function controles() {
  const out = [];
  const w = window.innerWidth;
  const h = window.innerHeight;
  const panel = document.querySelector('.lpl-panel');
  if (panel === null) return ['carnet absent'];
  const p = panel.getBoundingClientRect();
  if (p.left < -1 || p.top < -1 || p.right > w + 1 || p.bottom > h + 1)
    out.push(
      `carnet hors fenêtre ${Math.round(p.left)},${Math.round(p.top)},${Math.round(p.right)},${Math.round(p.bottom)}`,
    );
  const body = panel.querySelector('.lpl-panel__body').getBoundingClientRect();
  if (body.width > w) out.push('corps du carnet plus large que la fenêtre');
  for (const node of document.querySelectorAll(
    '.lpl-memory, .lpl-rumor, .lpl-memories__empty, .lpl-memories__divider',
  )) {
    const r = node.getBoundingClientRect();
    if (r.right > body.right + 1 || r.left < body.left - 1)
      out.push(`${node.className} plus large que le carnet`);
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    for (let t = walker.nextNode(); t !== null; t = walker.nextNode()) {
      if (t.textContent.trim() === '' || t.parentElement.closest('.lpl-sr-only')) continue;
      const range = document.createRange();
      range.selectNodeContents(t);
      for (const rr of range.getClientRects()) {
        if (rr.right > r.right + 1 || rr.left < r.left - 1)
          out.push(`${node.className}: texte hors de sa boîte « ${t.textContent.slice(0, 30)} »`);
      }
    }
  }
  // Un titre d'entrée coupé (ellipse, débordement caché) à 150 %.
  for (const title of document.querySelectorAll('.lpl-memory__title')) {
    if (title.scrollWidth > title.clientWidth + 1)
      out.push(`titre coupé « ${title.textContent.slice(0, 30)} »`);
  }
  const text = document.querySelector('.lpl-memories')?.textContent ?? '';
  for (const bad of ['sur 12', '/', '%'])
    if (text.includes(bad)) out.push(`compteur interdit « ${bad} » dans la page`);
  return [...new Set(out)];
}

(async () => {
  fs.mkdirSync(SORTIE, { recursive: true });
  const browser = await chromium.launch();
  const problemes = [];
  for (const [nom, scenario, joueur, attente, bas] of ECRANS.filter(([n]) => n.includes(FILTRE))) {
    for (const taille of TAILLES) {
      const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
      const erreurs = [];
      page.on('pageerror', (e) => erreurs.push(String(e)));
      page.on('console', (m) => {
        if (m.type() === 'error') erreurs.push(m.text());
      });
      const url = `${BASE}src/interface/demo/index.html?scenario=${scenario}&joueur=${joueur}&taille=${taille}&autre=fige&temps=arrete&rendu=0&onglet=souvenirs`;
      await page.goto(url);
      await page.waitForFunction(() => window.lplInterface?.ready === true, null, {
        timeout: 240_000,
      });
      await page.locator(attente).first().waitFor({ timeout: 30_000 });
      await page.waitForTimeout(700);
      if (bas) {
        await page.evaluate(() => {
          const body = document.querySelector('.lpl-panel__body');
          if (body) body.scrollTop = body.scrollHeight;
        });
        await page.waitForTimeout(150);
      }
      const fichier = path.join(SORTIE, `souvenirs-${nom}-${taille}.png`);
      await page.screenshot({ path: fichier });
      const d = await page.evaluate(controles);
      for (const p of [...d, ...erreurs]) problemes.push(`${nom} ${taille} %: ${p}`);
      process.stdout.write(
        `${path.basename(fichier)}${d.length + erreurs.length === 0 ? '' : ' (!)'}\n`,
      );
      await page.close();
    }
  }
  await browser.close();
  process.stdout.write(
    problemes.length === 0
      ? 'Aucun débordement, aucun compteur, aucune erreur en console.\n'
      : `${problemes.join('\n')}\n`,
  );
  process.exitCode = problemes.length === 0 ? 0 : 1;
})();
