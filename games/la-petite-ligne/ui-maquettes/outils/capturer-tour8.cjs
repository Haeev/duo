'use strict';
/*
  Captures de l'interface de la suite après le jour 15 (tour 8) sur la page de démonstration:
  écran d'étape (jour 15 et jour 43, chaque combinaison de choix), carte de saison, brume au
  lever, saison sous la date, quête de la semaine au carnet, au HUD, à la caisse et à la nuit,
  lettres de la semaine. Chez les deux joueurs, à 1366x768, taille de l'interface 100 et 150 %.
  Contrôle aussi qu'aucun élément visible ne sort de la fenêtre ni ne coupe son texte, qu'aucune
  variable n'est restée non remplie (« {day} ») et qu'aucune erreur n'arrive en console.

  Usage, depuis la racine du dépôt, le serveur Vite du jeu lancé
  (cd games/la-petite-ligne && npx vite --port 5197):
    node games/la-petite-ligne/ui-maquettes/outils/capturer-tour8.cjs [http://127.0.0.1:5197/] [filtre]
  Sorties: docs/jeux/jeu-1/gauntlet/captures/tour-08/interface-*.png
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
  'tour-08',
);

// [nom, scénario, attente (sélecteur visible), joueurs]
const ECRANS = [
  ['etape-15', 'etape', '.lpl-screen--stage', ['p1', 'p2']],
  ['etape-15-moi-reste', 'etape-moi-reste', '.lpl-screen--stage', ['p1']],
  ['etape-15-autre-reste', 'etape-autre-reste', '.lpl-screen--stage', ['p1']],
  ['etape-15-autre-finit', 'etape-autre-finit', '.lpl-screen--stage', ['p2']],
  ['etape-15-desaccord', 'etape-desaccord', '.lpl-screen--stage', ['p1', 'p2']],
  ['etape-15-finir', 'etape-finir', '.lpl-screen--stage', ['p1']],
  ['reprise', 'reprise', '.lpl-toast', ['p1']],
  ['etape-43', 'etape-43', '.lpl-screen--stage', ['p1', 'p2']],
  ['etape-43-autre-finit', 'etape-43-finir', '.lpl-screen--stage', ['p1']],
  ['saison-ete', 'saison-ete', '.lpl-season-card', ['p1', 'p2']],
  ['brume-matin', 'brume-matin', '.lpl-breakfast__head', ['p1']],
  ['ete-hud', 'ete-hud', '.lpl-clock__season', ['p1']],
  ['ete-carnet', 'ete-carnet', '.lpl-panel', ['p1', 'p2']],
  ['ete-courrier', 'ete-courrier', '.lpl-letter', ['p1']],
  ['ete-caisse', 'ete-caisse', '.lpl-order', ['p1']],
  ['ete-nuit', 'ete-nuit', '.lpl-screen--night', ['p1']],
  // Non-régression: l'horloge a une ligne de plus (la saison), les panneaux commencent plus bas.
  ['regr-caisse', 'caisse-commande2', '.lpl-order', ['p1']],
  ['regr-comptoir', 'comptoir', '.lpl-panel', ['p1']],
  ['regr-carnet', 'carnet', '.lpl-panel', ['p1']],
  ['regr-achat', 'achat', '.lpl-proposal', ['p1']],
  ['regr-moment', 'moment-ensemble', '.lpl-clock', ['p1']],
];

const TAILLES = [100, 150];

/** Ce qui sort de la fenêtre, déborde de sa boîte, ou garde une variable non remplie. */
function controles() {
  const out = [];
  const w = window.innerWidth;
  const h = window.innerHeight;
  const root = document.querySelector('.lpl-ui');
  if (root === null) return ['interface absente'];
  const visible = (e) => {
    const s = getComputedStyle(e);
    if (s.visibility === 'hidden' || s.display === 'none') return false;
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && e.closest('[hidden]') === null;
  };
  for (const node of root.querySelectorAll(
    'button, .lpl-chip, .lpl-counter, .lpl-player-card, .lpl-season-card, .lpl-clock, .lpl-quest, .lpl-letter, .lpl-sheet, .lpl-panel, p, h1, h2',
  )) {
    if (!visible(node)) continue;
    const r = node.getBoundingClientRect();
    const scroller = node.closest('.lpl-panel__body, .lpl-screen');
    const inScroll = scroller !== null && scroller.scrollHeight > scroller.clientHeight + 1;
    if (r.left < -1 || r.right > w + 1)
      out.push(`${node.className || node.tagName} hors de la fenêtre (largeur)`);
    if (!inScroll && (r.top < -1 || r.bottom > h + 1))
      out.push(`${node.className || node.tagName} hors de la fenêtre (hauteur)`);
    if (node.scrollWidth > node.clientWidth + 1 && getComputedStyle(node).overflowX !== 'visible')
      out.push(
        `${node.className || node.tagName}: texte coupé « ${node.textContent.slice(0, 40)} »`,
      );
  }
  // Un texte qui dépasse de sa boîte (compteur, carte de joueur, carte de saison, bouton).
  for (const box of root.querySelectorAll(
    '.lpl-counter, .lpl-player-card, .lpl-season-card, .lpl-clock, button',
  )) {
    if (!visible(box)) continue;
    const r = box.getBoundingClientRect();
    const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
    for (let t = walker.nextNode(); t !== null; t = walker.nextNode()) {
      if (t.textContent.trim() === '' || !visible(t.parentElement)) continue;
      const range = document.createRange();
      range.selectNodeContents(t);
      for (const rr of range.getClientRects()) {
        if (rr.right > r.right + 1 || rr.left < r.left - 1 || rr.bottom > r.bottom + 1)
          out.push(
            `${box.className || box.tagName}: texte hors de sa boîte « ${t.textContent.slice(0, 30)} »`,
          );
      }
    }
  }
  const screen = document.querySelector('.lpl-screen');
  if (screen !== null && screen.scrollHeight > screen.clientHeight + 1)
    out.push(`écran plein cadre à défiler (${screen.scrollHeight} > ${screen.clientHeight})`);
  const text = root.textContent ?? '';
  const unfilled = text.match(/\{[a-zA-Z]+\}/g);
  if (unfilled !== null) out.push(`variable non remplie ${unfilled.join(' ')}`);
  if (/\b1 lignes\b/.test(text)) out.push('« 1 lignes »');
  return [...new Set(out)];
}

(async () => {
  fs.mkdirSync(SORTIE, { recursive: true });
  const browser = await chromium.launch();
  const problemes = [];
  for (const [nom, scenario, attente, joueurs] of ECRANS.filter(([n]) => n.includes(FILTRE))) {
    for (const joueur of joueurs) {
      for (const taille of TAILLES) {
        const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
        const erreurs = [];
        page.on('pageerror', (e) => erreurs.push(String(e)));
        page.on('console', (m) => {
          if (m.type() === 'error') erreurs.push(m.text());
        });
        const temps = scenario === 'reprise' ? '' : '&temps=arrete';
        const url = `${BASE}src/interface/demo/index.html?scenario=${scenario}&joueur=${joueur}&taille=${taille}&autre=fige${temps}&rendu=0`;
        await page.goto(url, { timeout: 600_000 });
        await page.waitForFunction(() => window.lplInterface?.ready === true, null, {
          timeout: 600_000,
        });
        await page.locator(attente).first().waitFor({ timeout: 30_000 });
        await page.waitForTimeout(800);
        const fichier = path.join(SORTIE, `interface-${nom}-${joueur}-${taille}.png`);
        await page.screenshot({ path: fichier });
        const d = await page.evaluate(controles);
        const focus = await page.evaluate(
          () => document.activeElement?.textContent?.trim().slice(0, 30) ?? '',
        );
        for (const p of [...d, ...erreurs]) problemes.push(`${nom} ${joueur} ${taille} %: ${p}`);
        process.stdout.write(
          `${path.basename(fichier)} focus « ${focus} »${d.length + erreurs.length === 0 ? '' : ' (!)'}\n`,
        );
        await page.close();
      }
    }
  }
  await browser.close();
  process.stdout.write(
    problemes.length === 0
      ? 'Aucun débordement, aucune variable vide, aucune erreur en console.\n'
      : `${problemes.join('\n')}\n`,
  );
  process.exitCode = problemes.length === 0 ? 0 : 1;
})();
