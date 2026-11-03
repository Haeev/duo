'use strict';
/*
  Captures de la mercerie, de la garde-robe et de la création de la 0.12 (contrat
  docs/jeux/jeu-1/garde-robe-0-12.md) sur la page de démonstration, chez les deux joueurs, à
  1366x768, taille de l'interface 100 et 150 %. Contrôles: rien hors de la fenêtre, aucun texte
  hors de sa boîte, aucune variable vide, aucune erreur en console.

  Usage, depuis la racine du dépôt, le serveur Vite du jeu lancé
  (cd games/la-petite-ligne && npx vite --port 5197):
    node games/la-petite-ligne/ui-maquettes/outils/capturer-garde-robe.cjs [http://127.0.0.1:5197/] [filtre]
  Sorties: docs/jeux/jeu-1/gauntlet/captures/0-12/garde-robe-*.png
*/
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.argv[2] ?? 'http://127.0.0.1:5197/';
const FILTRE = process.argv[3] ?? '';
const SORTIE =
  process.env.SORTIE ??
  path.join(
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
    '0-12',
  );

// [nom, scénario, attente, joueurs, action]
const ECRANS = [
  ['mercerie', 'mercerie', '.lpl-clothes', ['p1', 'p2']],
  ['mercerie-essai', 'mercerie', '.lpl-clothes', ['p1'], 'essai'],
  ['mercerie-chapeaux', 'mercerie', '.lpl-clothes', ['p2'], 'chapeaux'],
  ['mercerie-court', 'mercerie-court', '.lpl-clothes', ['p1']],
  ['garde-robe', 'garde-robe', '.lpl-storage', ['p1', 'p2'], 'garde-robe'],
  ['creation', 'creation-coiffure', '.lpl-creation', ['p1', 'p2']],
];

const TAILLES = [100, 150];

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
    'button, .lpl-chip, .lpl-panel, .lpl-tab, .lpl-clothes__card, .lpl-option, p, h1, h2, strong',
  )) {
    if (!visible(node)) continue;
    const r = node.getBoundingClientRect();
    const scroller = node.closest('.lpl-panel__body, .lpl-screen');
    const inScroll = scroller !== null && scroller.scrollHeight > scroller.clientHeight + 1;
    if (r.left < -1 || r.right > w + 1)
      out.push(`${node.className || node.tagName} hors de la fenêtre (largeur)`);
    if (!inScroll && (r.top < -1 || r.bottom > h + 1))
      out.push(`${node.className || node.tagName} hors de la fenêtre (hauteur)`);
  }
  for (const box of root.querySelectorAll('button, .lpl-chip, .lpl-clothes__card, .lpl-option')) {
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
  const unfilled = (root.textContent ?? '').match(/\{[a-zA-Z]+\}/g);
  if (unfilled !== null) out.push(`variable non remplie ${unfilled.join(' ')}`);
  return [...new Set(out)];
}

(async () => {
  fs.mkdirSync(SORTIE, { recursive: true });
  const browser = await chromium.launch();
  const problemes = [];
  for (const [nom, scenario, attente, joueurs, action] of ECRANS.filter(([n]) =>
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
        const url = `${BASE}src/interface/demo/index.html?scenario=${scenario}&joueur=${joueur}&taille=${taille}&autre=fige&temps=arrete&rendu=0`;
        await page.goto(url, { timeout: 600_000 });
        await page.waitForFunction(() => window.lplInterface?.ready === true, null, {
          timeout: 600_000,
        });
        await page.locator(attente).first().waitFor({ timeout: 30_000 });
        await page.waitForTimeout(700);
        if (action === 'garde-robe') {
          await page.locator('[data-key="wardrobe"]').click();
          await page.locator('.lpl-clothes').first().waitFor({ timeout: 30_000 });
          await page.waitForTimeout(500);
          // Au clavier: E tourne l'aperçu, la flèche droite passe à la vignette suivante.
          await page.keyboard.press('KeyE');
          await page.keyboard.press('ArrowRight');
          await page.waitForTimeout(200);
        }
        if (action === 'essai') {
          await page.locator('[data-key="try:pull_moutarde"]').click();
          await page.keyboard.press('KeyE');
          await page.keyboard.press('KeyE');
          await page.locator('[data-key="tab:outer"]').click();
          await page.waitForTimeout(200);
          await page.locator('.lpl-clothes__card').nth(1).hover();
          await page.waitForTimeout(200);
        }
        if (action === 'chapeaux') {
          await page.locator('[data-key="tab:hat"]').click();
          await page.waitForTimeout(200);
          await page.locator('.lpl-clothes__card').first().hover();
          await page.waitForTimeout(200);
        }
        const fichier = path.join(SORTIE, `garde-robe-${nom}-${joueur}-${taille}.png`);
        await page.screenshot({ path: fichier });
        const d = await page.evaluate(controles);
        const focus = await page.evaluate(
          () => document.activeElement?.textContent?.trim().slice(0, 30) ?? '',
        );
        const intents = await page.evaluate(
          () => window.lplInterface?.log.intents.slice(-4).join(',') ?? '',
        );
        for (const p of [...d, ...erreurs]) problemes.push(`${nom} ${joueur} ${taille} %: ${p}`);
        process.stdout.write(
          `${path.basename(fichier)} focus « ${focus} » intentions ${intents}${d.length + erreurs.length === 0 ? '' : ' (!)'}\n`,
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
