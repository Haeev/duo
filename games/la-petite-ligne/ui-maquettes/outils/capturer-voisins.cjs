'use strict';
/*
  Captures de l'onglet Voisins du carnet (0.13, lot H3) sur la page de démonstration: début de
  partie, milieu (découvertes), fin (beaucoup d'amitié), pluie (bascule du temps), un autre jour
  choisi au clavier, la carte du bourg (Entrée sur un portrait), les notifications de découverte.
  En 1366x768 et 1920x1080, facteur d'échelle 1 (et 2 avec « x2 »), taille d'interface 100 % (et
  les autres avec le cinquième argument). Contrôles: rien hors de la fenêtre, aucun défilement du
  corps du panneau, aucun texte hors de sa boîte, aucune variable vide, aucun identifiant brut,
  aucune erreur en console.

  Usage, depuis la racine du dépôt, le serveur Vite du jeu lancé
  (cd games/la-petite-ligne && npx vite --port 5287):
    node games/la-petite-ligne/ui-maquettes/outils/capturer-voisins.cjs [base] [filtre] [x2] [taille]
  Sorties: docs/jeux/jeu-1/gauntlet/captures/0-13-voisins/*.png
  Format CommonJS: playwright est installé hors du dépôt, résolu par require.
*/
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.argv[2] ?? 'http://127.0.0.1:5287/';
const FILTRE = process.argv[3] ?? '';
const DOUBLE = process.argv[4] === 'x2';
const TAILLE = process.argv[5] ?? '100';
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
  '0-13-voisins',
);

// [nom, scénario, sélecteur attendu, touches à presser dans l'ordre]
const ECRANS = [
  ['voisins-debut', 'voisins-debut', '.lpl-vitrine--neighbours', []],
  ['voisins-milieu', 'voisins-milieu', '.lpl-vitrine--neighbours', []],
  // Armand (deux portraits plus loin), puis le jeudi dans le sélecteur de jour.
  ['voisins-milieu-armand', 'voisins-milieu', '.lpl-vitrine--neighbours', ['ArrowRight']],
  [
    'voisins-milieu-autre-jour',
    'voisins-milieu',
    '.lpl-vitrine--neighbours',
    [
      'ArrowRight',
      'ArrowRight',
      'ArrowRight',
      'ArrowRight',
      'ArrowRight',
      'ArrowRight',
      'ArrowRight',
      'ArrowRight',
      'Enter',
    ],
  ],
  ['voisins-fin', 'voisins-fin', '.lpl-vitrine--neighbours', []],
  ['voisins-pluie', 'voisins-pluie', '.lpl-vitrine--neighbours', []],
  ['voisins-inconnu', 'voisins-milieu', '.lpl-vitrine--neighbours', ['ArrowDown', 'ArrowDown']],
  ['voisins-bourg', 'voisins-milieu', '.lpl-vitrine--neighbours', ['Enter']],
  ['voisins-notifications', 'voisins-notifications', '.lpl-hud', []],
];

const FENETRES = [
  [1366, 768],
  [1920, 1080],
];

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
  const panel = root.querySelector('.lpl-panel');
  if (panel !== null) {
    const r = panel.getBoundingClientRect();
    if (r.bottom > h + 1 || r.right > w + 1 || r.left < -1) out.push('panneau hors de la fenêtre');
    const body = panel.querySelector('.lpl-panel__body');
    if (body !== null && body.scrollHeight > body.clientHeight + 1)
      out.push(`défilement du corps (${body.scrollHeight} > ${body.clientHeight})`);
    if (body !== null && body.scrollWidth > body.clientWidth + 1)
      out.push(`défilement horizontal du corps (${body.scrollWidth} > ${body.clientWidth})`);
  }
  for (const box of root.querySelectorAll(
    '.lpl-panel button, .lpl-panel .lpl-pastille, .lpl-panel [data-nav-item], .lpl-toast',
  )) {
    if (!visible(box)) continue;
    const r = box.getBoundingClientRect();
    const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
    for (let t = walker.nextNode(); t !== null; t = walker.nextNode()) {
      if (t.textContent.trim() === '' || !visible(t.parentElement)) continue;
      // Noms masqués à l'œil (onglets du carnet fermés): lus par le lecteur d'écran seulement.
      if (t.parentElement.getBoundingClientRect().width <= 1) continue;
      const style = getComputedStyle(t.parentElement);
      if (
        style.opacity === '0' ||
        style.textOverflow === 'ellipsis' ||
        t.parentElement.closest('.lpl-tile__name, .lpl-toast-card__text') !== null
      )
        continue;
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
  // La fiche et la frise restent dans la boîte du détail.
  const detail = root.querySelector('.lpl-vitrine--neighbours .lpl-vitrine__detail');
  if (detail !== null) {
    const d = detail.getBoundingClientRect();
    for (const e of detail.querySelectorAll('*')) {
      if (!visible(e)) continue;
      const r = e.getBoundingClientRect();
      if (r.right > d.right + 1 || r.left < d.left - 1 || r.bottom > d.bottom + 1) {
        out.push(`fiche: ${e.getAttribute('class') ?? e.tagName} déborde`);
        break;
      }
    }
  }
  const text = root.textContent ?? '';
  const unfilled = text.match(/\{[a-zA-Z]+\}/g);
  if (unfilled !== null) out.push(`variable non remplie ${unfilled.join(' ')}`);
  const raw = text.match(/\b[a-z]+_[a-z_]+\b/g);
  if (raw !== null) out.push(`identifiant brut ${[...new Set(raw)].join(' ')}`);
  const labels = [...root.querySelectorAll('[aria-label], [title]')]
    .map((e) => `${e.getAttribute('aria-label') ?? ''} ${e.getAttribute('title') ?? ''}`)
    .join(' ');
  const rawLabel = labels.match(/\b[a-z]+_[a-z_]+\b/g);
  if (rawLabel !== null)
    out.push(`identifiant brut dans un nom accessible ${[...new Set(rawLabel)].join(' ')}`);
  const unfilledLabel = labels.match(/\{[a-zA-Z]+\}/g);
  if (unfilledLabel !== null)
    out.push(`variable non remplie dans un nom accessible ${unfilledLabel.join(' ')}`);
  return [...new Set(out)];
}

(async () => {
  fs.mkdirSync(SORTIE, { recursive: true });
  const browser = await chromium.launch();
  const problemes = [];
  for (const [nom, scenario, attente, touches] of ECRANS.filter(([n]) => n.includes(FILTRE))) {
    for (const [width, height] of FENETRES) {
      for (const dsf of DOUBLE ? [1, 2] : [1]) {
        const context = await browser.newContext({
          viewport: { width, height },
          deviceScaleFactor: dsf,
        });
        const page = await context.newPage();
        const erreurs = [];
        page.on('pageerror', (e) => erreurs.push(String(e)));
        page.on('console', (m) => {
          if (m.type() === 'error') erreurs.push(m.text());
        });
        const url = `${BASE}src/interface/demo/index.html?scenario=${scenario}&autre=fige&temps=arrete&rendu=0&taille=${TAILLE}`;
        await page.goto(url, { timeout: 600_000 });
        await page.waitForFunction(() => window.lplInterface?.ready === true, null, {
          timeout: 600_000,
        });
        await page.locator(attente).first().waitFor({ timeout: 30_000 });
        await page.waitForTimeout(scenario === 'voisins-notifications' ? 1500 : 700);
        for (const touche of touches) {
          await page.keyboard.press(touche);
          await page.waitForTimeout(250);
        }
        await page.waitForTimeout(400);
        const suffixe = `${TAILLE === '100' ? '' : `-${TAILLE}`}${dsf === 2 ? '-x2' : ''}`;
        const fichier = path.join(SORTIE, `${nom}-${width}x${height}${suffixe}.png`);
        await page.screenshot({ path: fichier });
        const d = await page.evaluate(controles);
        const focus = await page.evaluate(
          () =>
            document.activeElement?.getAttribute('data-key') ??
            document.activeElement?.textContent?.trim().slice(0, 40) ??
            '',
        );
        for (const p of [...d, ...erreurs])
          problemes.push(`${nom} ${width}x${height}${suffixe}: ${p}`);
        process.stdout.write(
          `${path.basename(fichier)} focus « ${focus} »${d.length + erreurs.length === 0 ? '' : ' (!)'}\n`,
        );
        await context.close();
      }
    }
  }
  await browser.close();
  process.stdout.write(
    problemes.length === 0
      ? 'Aucun défilement, aucun débordement, aucune variable vide, aucune erreur.\n'
      : `${problemes.join('\n')}\n`,
  );
  process.exitCode = problemes.length === 0 ? 0 : 1;
})();
