'use strict';
// Captures de la maquette du téléphone: node design/maquettes/cosy-cafe/telephone/outils/capturer.cjs [etat...]
const path = require('path');
const { chromium } = require('playwright');
const ici = path.resolve(__dirname, '..');
const ETATS = ['accueil', 'notif', 'commandes', 'carte', 'remises', 'connaitre', 'messages', 'range', 'autre'];
const TAILLES = [
  { nom: '1366x768', w: 1366, h: 768, s: 1 },
  { nom: '1366x768@2x', w: 1366, h: 768, s: 2, seulement: ['accueil', 'commandes'] },
  { nom: '1920x1080', w: 1920, h: 1080, s: 1 },
  { nom: '1920x1080@2x', w: 1920, h: 1080, s: 2, seulement: ['messages'] },
  { nom: '1366x768-150', w: 1366, h: 768, s: 1, taille: 150, seulement: ['accueil', 'commandes', 'messages'] },
  { nom: '1280x720', w: 1280, h: 720, s: 1, seulement: ['commandes'] },
];
(async () => {
  const filtre = process.argv.slice(2);
  const nav = await chromium.launch();
  for (const t of TAILLES) {
    const ctx = await nav.newContext({ viewport: { width: t.w, height: t.h }, deviceScaleFactor: t.s });
    const page = await ctx.newPage();
    for (const e of ETATS) {
      if (t.seulement && !t.seulement.includes(e)) continue;
      if (filtre.length && !filtre.includes(e)) continue;
      await page.goto('about:blank');
      const q = t.taille ? `?taille=${t.taille}&reduit` : '?reduit';
      await page.goto(`file://${ici}/telephone.html${q}#${e}`);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(150);
      await page.screenshot({ path: path.join(ici, 'captures', `${e}-${t.nom}.png`) });
    }
    await ctx.close();
  }
  await nav.close();
})();
