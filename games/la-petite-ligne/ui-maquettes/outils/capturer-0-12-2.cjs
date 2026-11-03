'use strict';
/*
  Captures de l'interface imagée du patch 0.12.2 (`docs/jeux/jeu-1/interface-imagee-0-12-2.md`) sur
  la page de démonstration: comptoir d'Odette (acheter, vendre, bourse vide), mercerie, catalogue,
  réchaud (garni, vide), établi, basse-cour (garnie, début), carnet (poissons, sac, quêtes, avec la
  confidence du matin, avec un secret), rangement (garni, plein, qui déborde).
  En 1366x768 et 1920x1080, facteur d'échelle 1 (et 2 avec « x2 »). Contrôles: rien hors de la
  fenêtre, aucun défilement du corps du panneau, aucun texte hors de sa boîte, aucune variable vide,
  aucun identifiant brut (`hen_white`), aucune erreur en console.

  Usage, depuis la racine du dépôt, le serveur Vite du jeu lancé
  (cd games/la-petite-ligne && npx vite --port 5231):
    node games/la-petite-ligne/ui-maquettes/outils/capturer-0-12-2.cjs <avant|apres> [base] [filtre] [x2]
  Sorties: docs/jeux/jeu-1/gauntlet/captures/0-12-2-interface/<avant|apres>/*.png
  Format CommonJS: playwright est installé hors du dépôt, résolu par require.
*/
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PHASE = process.argv[2] === 'avant' ? 'avant' : 'apres';
const BASE = process.argv[3] ?? 'http://127.0.0.1:5231/';
const FILTRE = process.argv[4] ?? '';
const DOUBLE = process.argv[5] === 'x2';
const SORTIE = path.join(__dirname, '..', '..', '..', '..', 'docs', 'jeux', 'jeu-1', 'gauntlet', 'captures', '0-12-2-interface', PHASE);

// [nom, scénario, sélecteur attendu, touche à presser (facultative), paramètres de l'adresse]
// `rendu=leger`: le vrai rendu en mode léger, pour l'aperçu 3D du personnage (salon, création).
const ECRANS = [
  ['comptoir-acheter', 'comptoir-0122', '.lpl-panel'],
  ['comptoir-vendre', 'comptoir-0122-vendre', '.lpl-panel', 'KeyE'],
  ['comptoir-bourse-vide', 'comptoir-0122-pauvre', '.lpl-panel'],
  ['mercerie', 'mercerie-0122', '.lpl-panel'],
  ['catalogue', 'tableau-catalogue', '.lpl-panel'],
  ['rechaud', 'rechaud-0122', '.lpl-panel'],
  ['rechaud-vide', 'rechaud-0122-vide', '.lpl-panel'],
  ['etabli', 'etabli-0122', '.lpl-panel'],
  ['basse-cour', 'basse-cour-0122', '.lpl-panel'],
  ['basse-cour-debut', 'basse-cour-0122-debut', '.lpl-panel'],
  ['carnet-poissons', 'poissons-0122', '.lpl-panel'],
  ['carnet-sac', 'sac-0122', '.lpl-panel'],
  ['carnet-quetes', 'quetes-0122', '.lpl-panel'],
  // Les quêtes avec la confidence du matin (carte « Aujourd'hui ») et avec la fiche d'un secret au détail.
  ['carnet-quetes-confidence', 'carnet-confidence', '.lpl-panel'],
  ['carnet-quetes-secret', 'poules-carnet', '.lpl-panel'],
  ['coffre', 'coffre-0122', '.lpl-panel'],
  ['coffre-plein', 'coffre-0122-plein', '.lpl-panel'],
  ['coffre-deborde', 'rangement-deborde', '.lpl-panel'],
  ['salon', 'salon-0122', '.lpl-panel', undefined, '&rendu=leger'],
  ['salon-choix', 'salon-0122', '.lpl-panel', 'ArrowRight', '&rendu=leger'],
  ['salon-secours', 'salon-0122', '.lpl-panel'],
  ['salon-banc', 'salon-0122-banc', '.lpl-panel', undefined, '&rendu=leger'],
  ['creation', 'creation-coiffure', '.lpl-creation', undefined, '&rendu=leger'],
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
  }
  for (const box of root.querySelectorAll('.lpl-panel button, .lpl-panel .lpl-chip, .lpl-panel [data-nav-item]')) {
    if (!visible(box)) continue;
    const r = box.getBoundingClientRect();
    const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
    for (let t = walker.nextNode(); t !== null; t = walker.nextNode()) {
      if (t.textContent.trim() === '' || !visible(t.parentElement)) continue;
      // Étiquettes au survol (invisibles au repos) et textes à points de suspension voulus.
      const style = getComputedStyle(t.parentElement);
      if (style.opacity === '0' || style.textOverflow === 'ellipsis' || t.parentElement.closest('.lpl-tile__name') !== null) continue;
      const range = document.createRange();
      range.selectNodeContents(t);
      for (const rr of range.getClientRects()) {
        if (rr.right > r.right + 1 || rr.left < r.left - 1 || rr.bottom > r.bottom + 1)
          out.push(`${box.className || box.tagName}: texte hors de sa boîte « ${t.textContent.slice(0, 30)} »`);
      }
    }
  }
  const text = root.textContent ?? '';
  const unfilled = text.match(/\{[a-zA-Z]+\}/g);
  if (unfilled !== null) out.push(`variable non remplie ${unfilled.join(' ')}`);
  const raw = text.match(/\b[a-z]+_[a-z_]+\b/g);
  if (raw !== null) out.push(`identifiant brut ${[...new Set(raw)].join(' ')}`);
  return [...new Set(out)];
}

(async () => {
  fs.mkdirSync(SORTIE, { recursive: true });
  const browser = await chromium.launch();
  const problemes = [];
  for (const [nom, scenario, attente, touche, extra] of ECRANS.filter(([n]) => n.includes(FILTRE))) {
    for (const [width, height] of FENETRES) {
      for (const dsf of DOUBLE ? [1, 2] : [1]) {
        const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dsf });
        const page = await context.newPage();
        const erreurs = [];
        page.on('pageerror', (e) => erreurs.push(String(e)));
        page.on('console', (m) => {
          if (m.type() === 'error') erreurs.push(m.text());
        });
        const url = `${BASE}src/interface/demo/index.html?scenario=${scenario}&autre=fige&temps=arrete${extra ?? '&rendu=0'}`;
        await page.goto(url, { timeout: 600_000 });
        await page.waitForFunction(() => window.lplInterface?.ready === true, null, { timeout: 600_000 });
        await page.locator(attente).first().waitFor({ timeout: 30_000 });
        await page.waitForTimeout(extra === undefined ? 700 : 4000);
        if (touche !== undefined) {
          await page.keyboard.press(touche);
          await page.waitForTimeout(500);
        }
        const suffixe = dsf === 2 ? '-x2' : '';
        const fichier = path.join(SORTIE, `${nom}-${width}x${height}${suffixe}.png`);
        await page.screenshot({ path: fichier });
        const d = await page.evaluate(controles);
        const focus = await page.evaluate(() => document.activeElement?.textContent?.trim().slice(0, 40) ?? '');
        for (const p of [...d, ...erreurs]) problemes.push(`${nom} ${width}x${height}${suffixe}: ${p}`);
        process.stdout.write(`${path.basename(fichier)} focus « ${focus} »${d.length + erreurs.length === 0 ? '' : ' (!)'}\n`);
        await context.close();
      }
    }
  }
  await browser.close();
  process.stdout.write(problemes.length === 0 ? 'Aucun défilement, aucun débordement, aucune variable vide, aucune erreur.\n' : `${problemes.join('\n')}\n`);
  process.exitCode = problemes.length === 0 ? 0 : 1;
})();
