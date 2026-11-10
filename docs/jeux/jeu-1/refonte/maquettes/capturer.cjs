// Captures des maquettes de la refonte à 1366x768.
// Usage (racine du dépôt): node docs/jeux/jeu-1/refonte/maquettes/capturer.cjs [filtre]
// Sorties: maquettes/captures/<nom>.png (palette réduite si pngquant ou ImageMagick est là).
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const dir = __dirname;
const out = path.join(dir, 'captures');
const shots = [
  ['hud-jeu', 'hud.html#jeu', 1200],
  ['hud-coup-d-oeil', 'hud.html#coup-d-oeil', 900],
  ['dialogue-ecriture', 'dialogue.html#parle', 1300],
  ['dialogue-choix', 'dialogue.html#choix', 900],
  ['carnet-sac', 'carnet-sac.html#sac', 1800],
  ['carnet-sans-sac', 'carnet-sac.html#sans-sac', 1800],
  ['boutique-acheter', 'boutique.html#acheter', 1200],
  ['boutique-vendre', 'boutique.html#vendre', 1200],
  ['basse-cour', 'basse-cour.html#normal', 1500],
  ['basse-cour-vide', 'basse-cour.html#vide', 1500],
];

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const filtre = process.argv[2] || '';
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(String(e)));
  page.on('requestfailed', (r) => erreurs.push('échec: ' + r.url()));
  for (const [nom, url, attente] of shots) {
    if (!nom.includes(filtre)) continue;
    if (!fs.existsSync(path.join(dir, url.split('#')[0]))) continue;
    await page.goto('about:blank');
    await page.goto('file://' + path.join(dir, url));
    await page.waitForTimeout(attente);
    // Les animations d'entrée sont menées à leur fin: la capture montre l'écran installé.
    const debord = await page.evaluate(() => {
      document.getAnimations().forEach((an) => {
        try {
          an.finish();
        } catch (e) {
          /* animation en boucle: sans fin */
        }
      });
      const d = document.documentElement;
      return d.scrollWidth > innerWidth || d.scrollHeight > innerHeight;
    });
    const fichier = path.join(out, nom + '.png');
    await page.screenshot({ path: fichier });
    try {
      execFileSync('convert', [fichier, '+dither', '-colors', '255', '-define', 'png:compression-level=9', fichier]);
    } catch (e) {
      /* sans ImageMagick, la capture reste telle quelle */
    }
    process.stdout.write(nom + ' ' + Math.round(fs.statSync(fichier).size / 1024) + ' Ko' + (debord ? ' DÉBORDE' : '') + '\n');
  }
  await browser.close();
  if (erreurs.length) {
    process.stdout.write('Erreurs:\n' + erreurs.join('\n') + '\n');
    process.exitCode = 1;
  }
})();
