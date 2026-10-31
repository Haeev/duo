'use strict';
/*
  Captures des écrans du tour 6 (moments rares, informations propres) sur la page de
  démonstration de l'interface, chez l'informé et chez l'autre, à 1366x768, taille de
  l'interface 100 et 150 %. Contrôle aussi qu'aucun élément nouveau ne sort de la fenêtre.

  Usage, depuis la racine du dépôt, le serveur Vite du jeu lancé
  (cd games/la-petite-ligne && npx vite --port 5197):
    node games/la-petite-ligne/ui-maquettes/outils/capturer-tour6.cjs [http://127.0.0.1:5197/] [filtre]
  Sorties: docs/jeux/jeu-1/gauntlet/captures/tour-06/interface-*.png
  Format CommonJS: playwright est installé hors du dépôt, résolu par require.
*/
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.argv[2] ?? 'http://127.0.0.1:5197/';
// Facultatif: ne refaire que les écrans dont le nom contient ce texte.
const FILTRE = process.argv[3] ?? '';
const SORTIE = path.join(__dirname, '..', '..', '..', '..', 'docs', 'jeux', 'jeu-1', 'gauntlet', 'captures', 'tour-06');

// [nom, scénario, joueur, paramètres en plus, attente (sélecteur visible)]
const ECRANS = [
  ['moment-ensemble', 'moment-ensemble', 'p1', 'temps=arrete', '.lpl-watch:not([hidden])'],
  ['moment-autre-manque', 'moment-partenaire', 'p1', 'temps=arrete', '.lpl-watch:not([hidden])'],
  ['moment-autre-manque-chez-l-autre', 'moment-partenaire', 'p2', 'temps=arrete', '.lpl-hud'],
  ['moment-pose', 'moment-pose', 'p1', 'temps=arrete', '.lpl-watch:not([hidden])'],
  ['moment-pose-chez-l-autre', 'moment-pose', 'p2', 'temps=arrete', '.lpl-watch:not([hidden])'],
  ['moment-oies-trop-tot', 'moment-oies', 'p1', 'temps=arrete', '.lpl-watch:not([hidden])'],
  ['moment-echelle-lachee', 'moment-echelle', 'p1', 'temps=arrete&rendu=0', '.lpl-watch:not([hidden])'],
  ['moment-echelle-lachee-chez-l-autre', 'moment-echelle', 'p2', 'temps=arrete&rendu=0', '.lpl-watch:not([hidden])'],
  ['confidence-informe', 'confidence', 'p1', 'temps=arrete&rendu=0', '.lpl-confidence:not([hidden])'],
  ['confidence-autre', 'confidence', 'p2', 'temps=arrete&rendu=0', '.lpl-breakfast__head'],
  ['carnet-confidence-informe', 'carnet-confidence', 'p1', 'temps=arrete&rendu=0', '.lpl-confidence'],
  ['carnet-poules-informe', 'poules-carnet', 'p1', 'temps=arrete&rendu=0', '.lpl-secret'],
  ['carnet-poules-autre', 'poules-carnet', 'p2', 'temps=arrete&rendu=0', '.lpl-secret'],
  ['carnet-coup-de-coude-informe', 'poules-coup-de-coude-carnet', 'p1', 'temps=arrete&rendu=0', '.lpl-secret__nudge'],
  ['carnet-lucie-informe', 'lucie-carnet', 'p2', 'temps=arrete&rendu=0', '.lpl-secret'],
  ['carnet-lucie-autre', 'lucie-carnet', 'p1', 'temps=arrete&rendu=0', '.lpl-secret'],
  ['appel-poule-autre', 'poules-appel', 'p2', 'temps=arrete', '.lpl-dialogue'],
  ['appel-poule-informe', 'poules-appel', 'p1', 'temps=arrete', '.lpl-hud'],
  // Notifications: sans scène 3D (le rendu logiciel retarde la capture au-delà de leurs 6 s).
  ['appel-erreur-autre', 'poules-erreur', 'p2', 'temps=arrete&rendu=0', '.lpl-toast--hen'],
  ['coup-de-coude-informe', 'poules-coup-de-coude', 'p1', 'temps=arrete&rendu=0', '.lpl-toast--whisper'],
];

const TAILLES = [100, 150];

/** Éléments du tour 6 qui sortent de la fenêtre ou dont le texte déborde de sa boîte. */
function debordements() {
  const out = [];
  const w = window.innerWidth;
  const h = window.innerHeight;
  const sel = '.lpl-watch__pill, .lpl-watch-ring, .lpl-confidence, .lpl-secret, .lpl-dialogue, .lpl-toast, .lpl-choice, .lpl-panel';
  for (const node of document.querySelectorAll(sel)) {
    const r = node.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    // Dans un corps de panneau qui défile, seul ce qui est dans sa zone visible compte.
    const scroller = node.parentElement?.closest('.lpl-panel__body');
    if (scroller) {
      const b = scroller.getBoundingClientRect();
      if (r.bottom <= b.top || r.top >= b.bottom) continue;
      if (r.right > b.right + 1 || r.left < b.left - 1) out.push(`${node.className} plus large que son panneau`);
    }
    if (scroller && (r.top < 0 || r.bottom > h)) continue;
    if (r.left < -1 || r.top < -1 || r.right > w + 1 || r.bottom > h + 1) out.push(`${node.className} hors fenêtre ${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}`);
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    for (let t = walker.nextNode(); t !== null; t = walker.nextNode()) {
      if (t.textContent.trim() === '') continue;
      const range = document.createRange();
      range.selectNodeContents(t);
      for (const rr of range.getClientRects()) {
        if (rr.right > r.right + 1 || rr.left < r.left - 1) out.push(`${node.className}: texte hors de sa boîte « ${t.textContent.slice(0, 30)} »`);
      }
    }
  }
  return [...new Set(out)];
}

(async () => {
  fs.mkdirSync(SORTIE, { recursive: true });
  const browser = await chromium.launch();
  const problemes = [];
  for (const [nom, scenario, joueur, extra, attente] of ECRANS.filter(([n]) => n.includes(FILTRE))) {
    for (const taille of TAILLES) {
      const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
      const erreurs = [];
      page.on('pageerror', (e) => erreurs.push(String(e)));
      page.on('console', (m) => {
        if (m.type() === 'error') erreurs.push(m.text());
      });
      const url = `${BASE}src/interface/demo/index.html?scenario=${scenario}&joueur=${joueur}&taille=${taille}&autre=fige&${extra}`;
      await page.goto(url);
      await page.waitForFunction(() => window.lplInterface?.ready === true, null, { timeout: 240_000 });
      await page.locator(attente).first().waitFor({ timeout: 30_000 });
      // La ligne d'observation tient 450 ms avant d'apparaître; les notifications glissent.
      await page.waitForTimeout(900);
      // Carnet: la quête à secret est souvent plus bas (coups de main): on l'amène au milieu.
      await page.evaluate(() => document.querySelector('.lpl-panel .lpl-secret')?.closest('li')?.scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(150);
      const fichier = path.join(SORTIE, `interface-${nom}-${taille}.png`);
      await page.screenshot({ path: fichier });
      const d = await page.evaluate(debordements);
      for (const p of [...d, ...erreurs]) problemes.push(`${nom} ${taille} %: ${p}`);
      process.stdout.write(`${path.basename(fichier)}${d.length + erreurs.length === 0 ? '' : ' (!)'}\n`);
      await page.close();
    }
  }
  await browser.close();
  process.stdout.write(problemes.length === 0 ? 'Aucun débordement, aucune erreur en console.\n' : `${problemes.join('\n')}\n`);
  process.exitCode = problemes.length === 0 ? 0 : 1;
})();
