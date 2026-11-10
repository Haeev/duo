// Contrôles des maquettes de la refonte: touches, débordements à plusieurs tailles, contrastes.
// Usage (racine du dépôt): node docs/jeux/jeu-1/refonte/maquettes/verifier.cjs
const path = require('path');
const { chromium } = require('playwright');

const dir = __dirname;
const url = (f) => 'file://' + path.join(dir, f);
let echecs = 0;
function dit(ok, texte) {
  if (!ok) echecs += 1;
  process.stdout.write((ok ? 'ok    ' : 'ÉCHEC ') + texte + '\n');
}

function lum(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contraste(a, b) {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

(async () => {
  // Contrastes (WCAG 2.1): texte 4,5:1, éléments graphiques 3:1.
  const paires = [
    ['encre sur papier', '#2a2522', '#f3ebd4', 4.5],
    ['encre sur papier clair (bulles, dialogue)', '#2a2522', '#fbf6e9', 4.5],
    ['encre atténuée sur papier', '#5b4d40', '#f3ebd4', 4.5],
    ['encre atténuée sur papier creux (case refusée)', '#5b4d40', '#e6dabd', 4.5],
    ['texte clair sur bois profond (horloge)', '#fbf6e9', '#5c3d24', 4.5],
    ['texte clair sur vert (bouton principal)', '#fbf6e9', '#3f6453', 4.5],
    ['texte clair sur encre (choix au focus, étiquette)', '#fbf6e9', '#2a2522', 4.5],
    ['mot clé bleu sur papier clair', '#24408e', '#fbf6e9', 4.5],
    ['prix: encre sur doré', '#2a2522', '#f6e3b0', 4.5],
    ['anneau de besoin vert sur papier ombré', '#3f6453', '#d9ccab', 3],
    ['anneau de besoin bas (rouge tampon) sur papier ombré', '#a4463b', '#d9ccab', 3],
    ['bordure des cases sur papier', '#8a6a43', '#f3ebd4', 3],
    ['anneau de focus sur papier', '#24408e', '#f3ebd4', 3],
  ];
  for (const [nom, a, b, seuil] of paires) {
    const r = contraste(a, b);
    dit(r >= seuil, 'contraste ' + r.toFixed(1) + ':1 (seuil ' + seuil + ') ' + nom);
  }

  const browser = await chromium.launch();

  // Débordements: 1366x768, 1280x720 et 1920x1080.
  const pages = ['hud.html#jeu', 'hud.html#coup-d-oeil', 'dialogue.html#choix', 'carnet-sac.html#sac', 'carnet-sac.html#sans-sac', 'boutique.html#acheter', 'boutique.html#vendre', 'basse-cour.html#normal'];
  for (const [w, h] of [[1366, 768], [1280, 720], [1920, 1080]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    for (const p of pages) {
      await page.goto('about:blank');
      await page.goto(url(p));
      await page.waitForTimeout(1600);
      // On mesure l'état d'arrivée: les animations d'entrée sont menées à leur fin.
      const hors = await page.evaluate(() => {
        document.getAnimations().forEach((an) => {
          try {
            an.finish();
          } catch (e) {
            /* animation en boucle: sans fin */
          }
        });
        const out = [];
        document.querySelectorAll('.hud-clock, .needs, .toolbar, .dlg, .choices, .carnet, .signets, .shop, .cards, .keys, .glance-arrow').forEach((el) => {
          if (el.hidden || el.closest('[hidden]')) return;
          const r = el.getBoundingClientRect();
          if (r.width && (r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight)) out.push(el.className);
        });
        return out;
      });
      dit(hors.length === 0, w + 'x' + h + ' ' + p + (hors.length ? ' hors écran: ' + hors.join(', ') : ' dans l\'écran'));
    }
    await page.close();
  }

  // Touches.
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const etat = () => page.evaluate(() => document.body.getAttribute('data-etat'));
  await page.goto(url('hud.html'));
  await page.keyboard.press('KeyF');
  await page.waitForTimeout(300);
  dit((await etat()) === 'coup-d-oeil', 'HUD: F ouvre le coup d\'œil');
  dit(await page.isVisible('.toolbar'), 'HUD: la barre d\'outils apparaît au coup d\'œil');
  await page.waitForTimeout(3100);
  dit((await etat()) === 'jeu', 'HUD: le coup d\'œil se referme seul après 3 s');
  dit(!(await page.isVisible('.toolbar')), 'HUD: la barre d\'outils est repartie');

  await page.goto('about:blank');
  await page.goto(url('dialogue.html'));
  await page.waitForTimeout(900);
  const ecrites = () => page.evaluate(() => [document.querySelectorAll('#texte .c.on').length, document.querySelectorAll('#texte .c').length]);
  let [n, total] = await ecrites();
  dit(n > 0 && n < total, 'Dialogue: le texte s\'écrit lettre par lettre (' + n + ' sur ' + total + ' après 0,9 s)');
  await page.keyboard.press('Space');
  [n, total] = await ecrites();
  dit(n === total, 'Dialogue: Espace affiche toute la phrase');
  await page.keyboard.press('Space');
  await page.waitForTimeout(300);
  dit((await etat()) === 'choix' && (await page.isVisible('.choices')), 'Dialogue: Espace à nouveau montre les choix');
  const lignes = await page.evaluate(() => {
    const p = document.getElementById('texte');
    return Math.round(p.getBoundingClientRect().height / parseFloat(getComputedStyle(p).lineHeight));
  });
  dit(lignes <= 3, 'Dialogue: ' + lignes + ' lignes (3 au plus)');

  await page.goto('about:blank');
  await page.goto(url('boutique.html'));
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(300);
  dit((await etat()) === 'vendre', 'Boutique: E passe à Vendre');
  await page.keyboard.press('KeyQ');
  await page.waitForTimeout(300);
  dit((await etat()) === 'acheter', 'Boutique: A (code KeyQ) revient à Acheter');

  // Animations réduites: plus aucune animation en boucle.
  await page.goto('about:blank');
  await page.goto(url('hud.html?reduit#jeu'));
  await page.waitForTimeout(400);
  const enBoucle = await page.evaluate(() =>
    Array.from(document.querySelectorAll('body *')).filter((el) => {
      const c = getComputedStyle(el);
      return c.animationName !== 'none' && (c.animationIterationCount.includes('infinite') || parseFloat(c.animationDuration) > 0.01);
    }).length,
  );
  dit(enBoucle === 0, 'Animations réduites: ' + enBoucle + ' élément garde une animation longue ou en boucle sur le HUD');

  await browser.close();
  process.stdout.write(echecs ? echecs + ' échec(s)\n' : 'Tout passe.\n');
  process.exitCode = echecs ? 1 : 0;
})();
