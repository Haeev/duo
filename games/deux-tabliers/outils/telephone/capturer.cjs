'use strict';
/*
  Captures du téléphone en jeu sur la page d'aperçu de l'interface (src/interface/apercu/).
  node games/deux-tabliers/outils/telephone/capturer.cjs [etat...]
  Démarre Vite sur un port libre, écrit dans docs/jeux/cosy-cafe/captures/telephone/.
*/
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const { demarrer } = require('./serveur.cjs');

const SORTIE = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'docs',
  'jeux',
  'cosy-cafe',
  'captures',
  'telephone',
);
const ETATS = [
  'accueil',
  'commandes',
  'reserve',
  'catalogue',
  'carte',
  'remises',
  'faire-connaitre',
  'bilans',
  'projets',
  'reglages',
  'messages',
  'notif',
  'range',
  'autre',
];
const TAILLES = [
  { nom: '1366x768', w: 1366, h: 768, s: 1 },
  {
    nom: '1920x1080',
    w: 1920,
    h: 1080,
    s: 1,
    seulement: ['accueil', 'commandes', 'messages', 'range'],
  },
  {
    nom: '1366x768-150',
    w: 1366,
    h: 768,
    s: 1,
    taille: 150,
    seulement: ['accueil', 'commandes', 'messages'],
  },
  { nom: '1366x768@2x', w: 1366, h: 768, s: 2, seulement: ['accueil'] },
];

(async () => {
  const filtre = process.argv.slice(2);
  fs.mkdirSync(SORTIE, { recursive: true });
  const { url, fermer } = await demarrer();
  const nav = await chromium.launch();
  try {
    for (const t of TAILLES) {
      const ctx = await nav.newContext({
        viewport: { width: t.w, height: t.h },
        deviceScaleFactor: t.s,
      });
      const page = await ctx.newPage();
      for (const e of ETATS) {
        if (t.seulement && !t.seulement.includes(e)) continue;
        if (filtre.length && !filtre.includes(e)) continue;
        await page.goto('about:blank');
        const q = `?animations=reduites${t.taille ? `&taille=${String(t.taille)}` : ''}`;
        await page.goto(`${url}${q}#telephone-${e}`);
        await page.waitForSelector('body[data-ready="1"]');
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(250);
        await page.screenshot({ path: path.join(SORTIE, `${e}-${t.nom}.png`) });
      }
      await ctx.close();
    }
  } finally {
    await nav.close();
    await fermer();
  }
})().catch((err) => {
  process.stderr.write(`${String(err && err.stack ? err.stack : err)}\n`);
  process.exitCode = 1;
});
