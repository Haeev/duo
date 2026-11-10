// Essai automatisé des onglets « Carte » et « Modèles 3D » sur le banc `banc-onglets.html`.
// Usage: node outils/tableau-de-bord/essai/capturer-onglets.cjs <dossier de sortie> [dossier du paquet three@0.128.0]
// Le second argument sert là où les CDN sont fermés (environnement cloud): `npm pack three@0.128.0`, décompressé.
// Le script échoue si la console sort une erreur, si une requête échoue, si la page déborde en largeur,
// si un modèle ne se charge pas ou si la mémoire WebGL grossit de modèle en modèle.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const RACINE = path.resolve(__dirname, '..');
const SORTIE = path.resolve(process.argv[2] || path.join(__dirname, 'captures'));
const THREE_LOCAL = process.argv[3] ? path.resolve(process.argv[3]) : null;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.glb': 'model/gltf-binary',
};
const CDN = {
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js': 'build/three.min.js',
  'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js':
    'examples/js/loaders/GLTFLoader.js',
  'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js':
    'examples/js/controls/OrbitControls.js',
};

function servir() {
  const serveur = http.createServer((req, res) => {
    const chemin = path.normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
    const fichier = path.join(RACINE, chemin);
    if (
      !fichier.startsWith(RACINE) ||
      !fs.existsSync(fichier) ||
      fs.statSync(fichier).isDirectory()
    ) {
      res.writeHead(404).end('absent');
      return;
    }
    res.writeHead(200, {
      'content-type': TYPES[path.extname(fichier)] || 'application/octet-stream',
    });
    fs.createReadStream(fichier).pipe(res);
  });
  return new Promise((ok) => serveur.listen(0, '127.0.0.1', () => ok(serveur)));
}

async function main() {
  fs.mkdirSync(SORTIE, { recursive: true });
  const serveur = await servir();
  const base = `http://127.0.0.1:${serveur.address().port}/essai/banc-onglets.html`;
  const navigateur = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const erreurs = [];
  const index = JSON.parse(fs.readFileSync(path.join(RACINE, 'modeles', 'index.json'), 'utf8'));

  async function ouvrir(taille, suffixe) {
    const contexte = await navigateur.newContext({
      viewport: taille,
      hasTouch: taille.width < 500,
      deviceScaleFactor: 1,
    });
    const page = await contexte.newPage();
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') erreurs.push(`[${m.type()}] ${m.text()}`);
    });
    page.on('pageerror', (e) => erreurs.push(`[exception] ${e.message}`));
    page.on('requestfailed', (r) => erreurs.push(`[requête] ${r.url()} ${r.failure()?.errorText}`));
    page.on('response', (r) => {
      if (r.status() >= 400) erreurs.push(`[${r.status()}] ${r.url()}`);
    });
    if (THREE_LOCAL) {
      for (const [url, relatif] of Object.entries(CDN)) {
        await page.route(url, (route) =>
          route.fulfill({ path: path.join(THREE_LOCAL, relatif), contentType: 'text/javascript' }),
        );
      }
    }
    await page.goto(base + suffixe);
    return { contexte, page };
  }
  const capture = (page, nom) => page.screenshot({ path: path.join(SORTIE, nom), timeout: 120000 });
  const sansDebordement = async (page, nom) => {
    const deborde = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    if (deborde) erreurs.push(`[largeur] la page déborde: ${nom}`);
  };
  const ecrire = async (page, texte) => {
    await page.fill('#banc-remarque', texte);
    await page.click('#banc-envoyer');
  };
  const modeleCharge = (page, id) =>
    page.waitForSelector(`#mod-fiche[data-mesure="${id}"]`, { timeout: 60000 });

  for (const [nom, taille] of [
    ['1366', { width: 1366, height: 768 }],
    ['400', { width: 400, height: 800 }],
  ]) {
    // ----- carte
    {
      const { contexte, page } = await ouvrir(
        taille,
        '?theme=' + (nom === '400' ? 'clair' : 'sombre') + '#carte',
      );
      await page.waitForSelector('#carte-choix option', { state: 'attached' });
      await page.waitForFunction(
        () => document.querySelectorAll('#carte-remarques .carte-note').length === 3,
      );
      await page.waitForTimeout(600);
      await capture(page, `carte-${nom}-1-ouverture.png`);
      const boite = await page.locator('.carte-svg').boundingBox();
      const en = (fx, fy) => [boite.x + boite.width * fx, boite.y + boite.height * fy];
      // épingle
      await page.click('#carte-outil-point');
      await page.mouse.click(...en(0.3, 0.42));
      await ecrire(page, 'Épingle d’essai: la halte est trop loin du quai.');
      // trait à main levée
      await page.click('#carte-outil-trait');
      await page.mouse.move(...en(0.18, 0.62));
      await page.mouse.down();
      for (let i = 1; i <= 12; i += 1)
        await page.mouse.move(...en(0.18 + i * 0.02, 0.62 + Math.sin(i / 2) * 0.06));
      await page.mouse.up();
      await ecrire(page, 'Trait d’essai: faire serpenter ce chemin.');
      // flèche en deux clics
      await page.click('#carte-outil-fleche');
      await page.mouse.click(...en(0.52, 0.3));
      await page.mouse.click(...en(0.62, 0.5));
      await ecrire(page, 'Flèche d’essai: déplacer ce bâtiment par ici.');
      // mesure par glissé
      await page.click('#carte-outil-mesure');
      await page.mouse.move(...en(0.2, 0.3));
      await page.mouse.down();
      await page.mouse.move(...en(0.3, 0.32));
      await page.mouse.move(...en(0.45, 0.36));
      await page.mouse.up();
      await page.waitForSelector('#carte-mesure-annoter');
      await page.waitForFunction(
        () => document.querySelectorAll('#carte-remarques .carte-note').length === 6,
      );
      await capture(page, `carte-${nom}-2-epingles-trait-mesure.png`);
      await sansDebordement(page, `carte ${nom}`);
      // calques, zoom à la molette, survol d'un bâtiment
      await page.click('#carte-calques summary');
      for (const c of ['batiments', 'chemins', 'verrous', 'ressources', 'points'])
        await page.check(`#carte-calque-${c}`);
      await page.click('#carte-calques summary');
      await page.selectOption('#carte-lieu', { label: 'La halte' });
      await page.waitForSelector('.carte-bulle:not([hidden])');
      await capture(page, `carte-${nom}-3-calques-lieu.png`);
      if (nom === '1366') {
        await page.mouse.move(...en(0.5, 0.5));
        await page.mouse.wheel(0, -600);
        await page.selectOption('#carte-choix', { label: 'Zone 1: le bourg' });
        await page.waitForTimeout(500);
        await capture(page, `carte-${nom}-4-zone-bourg.png`);
        // note globale au clavier, puis suppression avec confirmation
        await page.click('#carte-note-globale');
        await page.keyboard.type('Note globale d’essai.');
        await page.keyboard.press('Control+Enter');
        await page.waitForFunction(
          () => document.querySelectorAll('#carte-remarques .carte-note').length === 7,
        );
        await page.locator('#carte-remarques .carte-note').last().getByText('Supprimer').click();
        await page.click('#banc-oui');
        await page.waitForFunction(
          () => document.querySelectorAll('#carte-remarques .carte-note').length === 6,
        );
        // épingle au clavier: Entrée au centre de la vue
        await page.click('#carte-outil-point');
        await page.focus('.carte-svg');
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('Enter');
        await page.waitForSelector('#banc-remarque');
        await page.keyboard.press('Escape');
      }
      if (nom === '400') {
        // Pincement à deux doigts: la fenêtre du plan doit se resserrer; puis une épingle posée au doigt.
        const largeur = () =>
          page.evaluate(() =>
            Number(document.querySelector('.carte-svg').getAttribute('viewBox').split(' ')[2]),
          );
        const b = await page.locator('.carte-svg').boundingBox();
        const cx = b.x + b.width / 2;
        const cy = b.y + b.height / 2;
        const avant = await largeur();
        const cdp = await contexte.newCDPSession(page);
        const doigts = (e) => [
          { x: cx - e, y: cy, id: 1 },
          { x: cx + e, y: cy, id: 2 },
        ];
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: doigts(30) });
        for (const e of [50, 80, 110])
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: doigts(e) });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        const apres = await largeur();
        if (!(apres < avant * 0.5))
          erreurs.push(`[pincement] largeur de vue ${avant} puis ${apres}`);
        await page.click('#carte-outil-point');
        const b2 = await page.locator('.carte-svg').boundingBox();
        await page.touchscreen.tap(b2.x + b2.width / 2, b2.y + b2.height / 2);
        await page.waitForSelector('#banc-remarque');
        await ecrire(page, 'Épingle posée au doigt.');
        await page.waitForFunction(
          () => document.querySelectorAll('#carte-remarques .carte-note').length === 7,
        );
        await page.locator('.carte-vue').scrollIntoViewIfNeeded();
        await capture(page, `carte-${nom}-4-pincement-epingle-au-doigt.png`);
      }
      const formes = await page.evaluate(() => window.TDB.essai.remarques().map((r) => r.forme));
      fs.writeFileSync(
        path.join(SORTIE, `carte-${nom}-formes.json`),
        JSON.stringify(formes, null, 1),
      );
      await contexte.close();
    }

    // ----- modèles
    {
      const { contexte, page } = await ouvrir(
        taille,
        '?theme=' + (nom === '400' ? 'clair' : 'sombre') + '#modeles',
      );
      await page.waitForSelector('#mod-liste .mod-item');
      // un meuble, avec sa note globale déjà traitée
      await page.fill('#mod-recherche', 'banc de sq');
      await page.click('.mod-item[data-modele="decors-bench-park"]');
      await modeleCharge(page, 'decors-bench-park');
      await page.waitForTimeout(400);
      await capture(page, `modeles-${nom}-1-meuble.png`);
      // épingle 3D: clic au centre de la vue
      await page.click('#mod-outil-epingle');
      const toile = await page.locator('.mod-toile canvas').boundingBox();
      // Au doigt sur le petit écran, à la souris sur le grand.
      if (nom === '400')
        await page.touchscreen.tap(toile.x + toile.width * 0.5, toile.y + toile.height * 0.52);
      else await page.mouse.click(toile.x + toile.width * 0.5, toile.y + toile.height * 0.52);
      await page.waitForSelector('#banc-remarque');
      await ecrire(page, 'Épingle d’essai: cette latte dépasse.');
      await page.waitForFunction(
        () => document.querySelectorAll('#mod-remarques .mod-note').length === 2,
      );
      await page.locator('.mod-toile').scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await capture(page, `modeles-${nom}-2-epingle-angle-1.png`);
      // second angle: on tourne au clavier; puis vue de dos, où l'épingle passe derrière le modèle
      await page.focus('.mod-toile canvas');
      for (let i = 0; i < 6; i += 1) await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(300);
      await capture(page, `modeles-${nom}-3-epingle-angle-2.png`);
      await page.click('#mod-vue-dos');
      await page.waitForTimeout(900);
      await capture(page, `modeles-${nom}-4-epingle-cachee-de-dos.png`);
      await page.locator('#mod-remarques .mod-note').last().getByText('Voir l’épingle').click();
      await page.waitForTimeout(900);
      await capture(page, `modeles-${nom}-5-recadrage-sur-epingle.png`);
      await sansDebordement(page, `modèles ${nom}`);
      // un personnage animé, rendu neutre puis aplats et contour
      await page.fill('#mod-recherche', 'maelle');
      await page.click('.mod-item[data-modele="essai-maelle"]');
      await modeleCharge(page, 'essai-maelle');
      await page.selectOption('#mod-clip', 'marche');
      await page.waitForTimeout(700);
      await capture(page, `modeles-${nom}-6-personnage-anime.png`);
      await page.click('#mod-rendu');
      await page.waitForTimeout(500);
      await capture(page, `modeles-${nom}-7-aplats-contour.png`);
      if (nom === '1366') {
        await page.click('#mod-vue-echelle');
        await page.waitForTimeout(900);
        await page.click('#mod-fond');
        await page.waitForTimeout(300);
        await capture(page, `modeles-${nom}-8-fond-sombre-silhouette.png`);
        await page.click('#mod-fond');
        await page.click('#mod-rendu');
        // un petit objet texturé, une pièce de tenue sur son mannequin animé, une maison
        for (const [id, clip] of [
          ['objets-pomme', null],
          ['figurine-top-sweater', 'walk'],
          ['decors-house-town', null],
        ]) {
          await page.fill('#mod-recherche', '');
          await page.click(`.mod-item[data-modele="${id}"]`);
          await modeleCharge(page, id);
          if (clip) await page.selectOption('#mod-clip', clip);
          await page.waitForTimeout(600);
          await capture(page, `modeles-${nom}-8-${id}.png`);
        }
        // tous les modèles de l'index: chargement, triangles et cotes mesurés contre l'index, mémoire WebGL
        await page.fill('#mod-recherche', '');
        const ecarts = [];
        const memoire = [];
        for (const m of index.modeles) {
          await page.click(`.mod-item[data-modele="${m.id}"]`);
          await modeleCharge(page, m.id);
          await page.waitForTimeout(120);
          const lu = await page.evaluate(() => {
            const f = document.getElementById('mod-fiche');
            const [geometries, textures] = document
              .querySelector('.mod-toile')
              .dataset.gpu.split(' ')
              .map(Number);
            return {
              triangles: Number(f.dataset.triangles),
              cotes: f.dataset.cotes.split(' ').map(Number),
              gpu: { geometries, textures },
            };
          });
          memoire.push(lu.gpu);
          const attendu = [m.cotes.largeur, m.cotes.hauteur, m.cotes.profondeur];
          const pire = Math.max(...attendu.map((v, i) => Math.abs(v - lu.cotes[i])));
          if (lu.triangles !== m.triangles || pire > 0.02)
            ecarts.push({
              id: m.id,
              index: { t: m.triangles, c: attendu },
              mesure: { t: lu.triangles, c: lu.cotes },
            });
        }
        fs.writeFileSync(
          path.join(SORTIE, 'modeles-ecarts.json'),
          JSON.stringify({ modeles: index.modeles.length, ecarts, memoire }, null, 1),
        );
        // Second tour sur les dix premiers: la mémoire doit retrouver les mêmes valeurs qu'au premier passage.
        for (let i = 0; i < 10; i += 1) {
          const m = index.modeles[i];
          await page.click(`.mod-item[data-modele="${m.id}"]`);
          await modeleCharge(page, m.id);
          await page.waitForTimeout(120);
          const gpu = await page.evaluate(() => {
            const [geometries, textures] = document
              .querySelector('.mod-toile')
              .dataset.gpu.split(' ')
              .map(Number);
            return { geometries, textures };
          });
          if (gpu.geometries > memoire[i].geometries || gpu.textures > memoire[i].textures)
            erreurs.push(
              `[fuite] ${m.id}: ${JSON.stringify(memoire[i])} puis ${JSON.stringify(gpu)}`,
            );
        }
        // quitter l'onglet rend le contexte WebGL; y revenir le recrée
        await page.click('#onglet-carte');
        await page.waitForFunction(
          () => document.querySelectorAll('.mod-toile canvas').length === 0,
        );
        await page.click('#onglet-modeles');
        await page.waitForFunction(
          () => document.querySelectorAll('.mod-toile canvas').length === 1,
        );
        await modeleCharge(page, index.modeles[9].id);
        await page.waitForTimeout(400);
        await capture(page, `modeles-${nom}-9-retour-onglet.png`);
        process.stdout.write(
          `modèles chargés: ${index.modeles.length}, écarts avec l'index: ${ecarts.length}\n`,
        );
      }
      const formes = await page.evaluate(() =>
        window.TDB.essai
          .remarques()
          .filter((r) => r.cible.type === 'modele')
          .map((r) => r.forme),
      );
      fs.writeFileSync(
        path.join(SORTIE, `modeles-${nom}-formes.json`),
        JSON.stringify(formes, null, 1),
      );
      await contexte.close();
    }
  }

  await navigateur.close();
  serveur.close();
  if (erreurs.length) {
    process.stderr.write(`${erreurs.length} erreur(s):\n${[...new Set(erreurs)].join('\n')}\n`);
    process.exit(1);
  }
  process.stdout.write(`essai réussi, captures dans ${SORTIE}\n`);
}

main().catch((e) => {
  process.stderr.write(`${e.stack || e}\n`);
  process.exit(1);
});
