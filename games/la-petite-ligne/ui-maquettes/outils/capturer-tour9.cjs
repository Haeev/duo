'use strict';
/*
  Captures de l'interface du tour 9 sur la page de démonstration: tableau du quai (catalogue
  par rayons, annonces, chantiers et versement à deux), établi de Basile, courrier à titres,
  carnet (deux dernières commandes, annonces), écrans d'étape du jour 43 et du jour 64. Chez
  les deux joueurs, à 1366x768, taille de l'interface 100 et 150 %.
  Contrôle aussi qu'aucun élément visible ne sort de la fenêtre ni ne coupe son texte, qu'aucune
  variable n'est restée non remplie (« {day} ») et qu'aucune erreur n'arrive en console.

  Usage, depuis la racine du dépôt, le serveur Vite du jeu lancé
  (cd games/la-petite-ligne && npx vite --port 5197):
    node games/la-petite-ligne/ui-maquettes/outils/capturer-tour9.cjs [http://127.0.0.1:5197/] [filtre]
  Sorties: docs/jeux/jeu-1/gauntlet/captures/tour-09/interface-*.png
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
  'tour-09',
);

// [nom, scénario, attente (sélecteur visible), joueurs]
const ECRANS = [
  ['tableau-catalogue', 'tableau-catalogue', '.lpl-shelf', ['p1', 'p2']],
  ['tableau-catalogue-bas', 'tableau-catalogue', '.lpl-shelf', ['p2'], 'bas'],
  ['tableau-catalogue-ferme', 'tableau-catalogue-ferme', '.lpl-shelf', ['p1']],
  ['tableau-annonces', 'tableau-annonces', '.lpl-annonce', ['p1', 'p2']],
  ['tableau-annonce-faite', 'tableau-annonce-faite', '.lpl-annonce', ['p1', 'p2']],
  ['tableau-annonce-retiree', 'tableau-annonce-retiree', '.lpl-annonce', ['p1']],
  ['tableau-chantiers', 'tableau-chantiers', '.lpl-chantier', ['p1', 'p2']],
  ['tableau-chantiers-accord', 'tableau-chantiers-accord', '.lpl-chantier', ['p1', 'p2']],
  ['tableau-chantiers-tous', 'tableau-chantiers-tous', '.lpl-built', ['p1']],
  ['etabli-basile', 'etabli-basile', '.lpl-chantier', ['p1', 'p2']],
  ['etabli-basile-bas', 'etabli-basile', '.lpl-chantier', ['p1', 'p2'], 'bas'],
  ['courrier-titres', 'courrier-titres', '.lpl-letter', ['p1', 'p2']],
  ['carnet-tour9', 'carnet-tour9', '.lpl-quests', ['p1', 'p2']],
  // Le bas du carnet: les deux dernières commandes et le groupe « Annonces ».
  ['carnet-tour9-bas', 'carnet-tour9', '.lpl-quests', ['p1'], 'bas'],
  ['etape-43', 'etape-43', '.lpl-screen--stage', ['p1', 'p2']],
  ['etape-64', 'etape-64', '.lpl-screen--stage', ['p1', 'p2']],
  // Non-régression: le catalogue de la démo (avant le tableau, sans onglets) et l'écran du jour 15.
  ['regr-catalogue-demo', 'catalogue', '.lpl-shelf', ['p1']],
  ['regr-etape-15', 'etape', '.lpl-screen--stage', ['p1']],
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
    'button, .lpl-chip, .lpl-counter, .lpl-player-card, .lpl-season-card, .lpl-clock, .lpl-quest, .lpl-letter, .lpl-sheet, .lpl-panel, .lpl-annonce, .lpl-chantier, .lpl-tab, p, h1, h2, h3, h4',
  )) {
    if (!visible(node)) continue;
    const r = node.getBoundingClientRect();
    const scroller = node.closest('.lpl-panel__body, .lpl-screen');
    const inScroll = scroller !== null && scroller.scrollHeight > scroller.clientHeight + 1;
    if (r.left < -1 || r.right > w + 1)
      out.push(`${node.className || node.tagName} hors de la fenêtre (largeur)`);
    if (!inScroll && (r.top < -1 || r.bottom > h + 1))
      out.push(`${node.className || node.tagName} hors de la fenêtre (hauteur)`);
    if (
      node.scrollWidth > node.clientWidth + 1 &&
      getComputedStyle(node).overflowX !== 'visible' &&
      !node.matches('.lpl-letter-item')
    )
      out.push(
        `${node.className || node.tagName}: texte coupé « ${node.textContent.slice(0, 40)} »`,
      );
  }
  // Un texte qui dépasse de sa boîte (compteur, carte de joueur, carte de saison, bouton).
  for (const box of root.querySelectorAll(
    '.lpl-counter, .lpl-player-card, .lpl-season-card, .lpl-clock, button',
  )) {
    if (!visible(box) || box.matches('.lpl-letter-item')) continue;
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
  // Courrier (section 5.2): un titre de 26 caractères ou moins se lit en entier; au-delà, points de suspension.
  for (const t of root.querySelectorAll('.lpl-letter-item__title')) {
    if (!visible(t)) continue;
    if (t.textContent.length <= 26 && t.scrollWidth > t.clientWidth + 1)
      out.push(`titre de lettre coupé « ${t.textContent} »`);
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
  for (const [nom, scenario, attente, joueurs, defiler] of ECRANS.filter(([n]) =>
    n.includes(FILTRE),
  )) {
    for (const joueur of joueurs) {
      for (const taille of TAILLES) {
        const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
        const erreurs = [];
        page.on('pageerror', (e) => erreurs.push(String(e)));
        page.on('console', (m) => {
          if (m.type() === 'error') erreurs.push(m.text());
        });
        const temps = '&temps=arrete';
        const url = `${BASE}src/interface/demo/index.html?scenario=${scenario}&joueur=${joueur}&taille=${taille}&autre=fige${temps}&rendu=0`;
        await page.goto(url, { timeout: 600_000 });
        await page.waitForFunction(() => window.lplInterface?.ready === true, null, {
          timeout: 600_000,
        });
        await page.locator(attente).first().waitFor({ timeout: 30_000 });
        await page.waitForTimeout(800);
        if (defiler === 'bas') {
          await page.evaluate(() => {
            const body = document.querySelector('.lpl-panel__body');
            if (body !== null) body.scrollTop = body.scrollHeight;
          });
          await page.waitForTimeout(200);
        }
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
