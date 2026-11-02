'use strict';
/*
  Captures de l'interface du tour 10 (lot L6) sur la page de démonstration: icônes des besoins
  (chez soi et en petit chez l'autre), page des besoins au carnet et « Besoins en sourdine »,
  rangement à cases (et débordement), établi de Basile (« Agrandir la maisonnette », grand coffre),
  chantier d'une pièce (ouvert à Entrée par l'invite), rideaux (invite et refus de pose), sieste,
  écran de nuit « endormis ensemble », lieu de l'autre par bâtiment, création (couleur, barbe).
  Chez les deux joueurs, à 1366x768, taille de l'interface 100 et 150 %; mêmes contrôles qu'au
  tour 9 (rien hors de la fenêtre, aucune variable vide, aucune erreur en console).

  Usage, depuis la racine du dépôt, le serveur Vite du jeu lancé
  (cd games/la-petite-ligne && npx vite --port 5197):
    node games/la-petite-ligne/ui-maquettes/outils/capturer-tour10.cjs [http://127.0.0.1:5197/] [filtre]
  Sorties: docs/jeux/jeu-1/gauntlet/captures/tour-10/interface-*.png
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
  'tour-10',
);

// [nom, scénario, attente (sélecteur visible), joueurs, action]
// Actions: 'bas' (défile le panneau), 'entree' (Entrée: l'invite de la maison).
const ECRANS = [
  ['besoins-hud', 'besoins-hud', '.lpl-needs', ['p1', 'p2']],
  ['besoins-carnet', 'besoins-carnet', '.lpl-needs-page', ['p1', 'p2']],
  ['rangement', 'rangement', '.lpl-storage', ['p1', 'p2']],
  ['rangement-deborde', 'rangement-deborde', '.lpl-storage', ['p1']],
  ['etabli-pieces', 'etabli-pieces', '.lpl-room-order', ['p1', 'p2'], 'bas'],
  ['chantier-invite', 'chantier', '.lpl-invite', ['p1']],
  ['chantier', 'chantier', '.lpl-invite', ['p1', 'p2'], 'entree'],
  ['chantier-chambre', 'chantier-chambre', '.lpl-invite', ['p1'], 'entree'],
  ['rideaux', 'rideaux', '.lpl-invite', ['p1', 'p2']],
  ['rideaux-refus', 'rideaux-refus', '.lpl-build-bar', ['p1']],
  ['sieste', 'sieste', '.lpl-nap', ['p1', 'p2']],
  ['nuit-ensemble', 'nuit-ensemble', '.lpl-night__together', ['p1', 'p2']],
  ['autre-epicerie', 'autre-epicerie', '.lpl-partner', ['p1']],
  ['creation', 'creation-coiffure', '.lpl-creation', ['p1', 'p2']],
  ['creation-bas', 'creation-coiffure', '.lpl-creation', ['p2'], 'bas-ecran'],
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
        if (defiler === 'entree') {
          await page.keyboard.press('Enter');
          await page.locator('.lpl-panel').first().waitFor({ timeout: 30_000 });
          await page.waitForTimeout(400);
        }
        if (defiler === 'bas-ecran') {
          await page.evaluate(() => {
            const screen = document.querySelector('.lpl-screen');
            if (screen !== null) screen.scrollTop = screen.scrollHeight;
          });
          await page.waitForTimeout(200);
        }
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
