/*
 * Banc d'essai du tableau de bord: sert le dossier, enveloppe index.html dans le squelette de
 * claude.ai, injecte la fausse base (bouchon.js, donnees.js), capture chaque écran et contrôle
 * la console, les débordements en largeur, le clavier et les contrastes.
 *
 * Usage: node outils/tableau-de-bord/essai/capturer.cjs [dossier de sortie]
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const DOSSIER = path.resolve(__dirname, '..');
const DEPOT = path.resolve(DOSSIER, '..', '..');
const SORTIE = path.resolve(process.argv[2] || path.join(__dirname, 'captures'));
const PLANCHES = path.join(DEPOT, 'docs', 'jeux', 'jeu-1', 'refonte');
// Images d'essai: des planches déjà dans le dépôt, servies sous images/ le temps de l'essai.
const IMAGES = {
  'personnages/gabarits.png': 'planches/04-gabarits-encres.png',
  'personnages/visages.png': 'planches/05-visages-encres.png',
  'scene/situation.png': 'planches/textures-situation-1.png',
  'scene/nuancier.png': 'planches/06-nuancier-lieux-matieres.png',
  'plan/aubrune.png': 'carte-aubrune/plan-ensemble.png',
};
const SQUELETTE =
  '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">' +
  '<style>:root{color-scheme:light;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style></head><body>';
const TYPES = {
  '.js': 'text/javascript',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.html': 'text/html',
};
// Absences attendues: les deux onglets de l'autre lot, l'image volontairement manquante, les polices sans Internet.
const ATTENDUS = [
  /carte\.js/,
  /modeles\.js/,
  /hud-absent\.png/,
  /fonts\.(googleapis|gstatic)\.com/,
];

const serveur = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let fichier;
  if (url === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(
      SQUELETTE + fs.readFileSync(path.join(DOSSIER, 'index.html'), 'utf8') + '</body></html>',
    );
    return;
  }
  if (url.startsWith('/images/') && IMAGES[url.slice(8)])
    fichier = path.join(PLANCHES, IMAGES[url.slice(8)]);
  else fichier = path.join(DOSSIER, path.normalize(url).replace(/^([/\\])+/, ''));
  if (!fichier.startsWith(DEPOT) || !fs.existsSync(fichier) || fs.statSync(fichier).isDirectory()) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, {
    'content-type': TYPES[path.extname(fichier)] || 'application/octet-stream',
  });
  fs.createReadStream(fichier).pipe(res);
});

const defauts = [];
function verifier(condition, message) {
  if (!condition) defauts.push(message);
  return condition;
}

async function ouvrir(navigateur, base, { largeur, hauteur, theme, scenario, echelle, horloge }) {
  const contexte = await navigateur.newContext({
    viewport: { width: largeur, height: hauteur },
    colorScheme: theme,
    deviceScaleFactor: echelle || 1,
    hasTouch: false,
  });
  const page = await contexte.newPage();
  const nom = scenario + ' ' + largeur + ' ' + theme;
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const ou = (m.location() && m.location().url) || '';
    if (ATTENDUS.some((r) => r.test(ou) || r.test(m.text()))) return;
    defauts.push('console [' + nom + ']: ' + m.text() + ' ' + ou);
  });
  page.on('pageerror', (e) => defauts.push('erreur de page [' + nom + ']: ' + e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.addInitScript({ path: path.join(__dirname, 'bouchon.js') });
  await page.addInitScript({ path: path.join(__dirname, 'donnees.js') });
  await page.addInitScript((s) => window.__essai.installer(s, window.__essaiDonnees), scenario);
  if (horloge) await page.clock.install();
  await page.goto(base + '/');
  if (!horloge) await page.waitForTimeout(250);
  return { contexte, page, nom };
}

async function capturer(page, nom, etiquette) {
  // Attente bornée: une image en chargement différé hors de l'écran ne se charge jamais.
  await page.evaluate(() =>
    Promise.race([
      new Promise((ok) => setTimeout(ok, 1500)),
      Promise.all(
        Array.from(document.images).map((i) =>
          i.complete
            ? null
            : new Promise((ok) => {
                i.addEventListener('load', ok);
                i.addEventListener('error', ok);
              }),
        ),
      ),
    ]),
  );
  await page.waitForTimeout(120);
  const mesure = await page.evaluate(() => {
    const large = window.innerWidth;
    const fautifs = [];
    document.querySelectorAll('body *').forEach((e) => {
      if (e.closest('.vis__scene') || e.closest('[hidden]')) return;
      const r = e.getBoundingClientRect();
      if (r.width && (r.right > large + 1 || r.left < -1))
        fautifs.push(
          e.tagName + '.' + e.className + ' ' + Math.round(r.left) + '..' + Math.round(r.right),
        );
    });
    return { defile: document.documentElement.scrollWidth, large, fautifs: fautifs.slice(0, 5) };
  });
  verifier(
    mesure.defile <= mesure.large,
    'débordement en largeur [' +
      nom +
      ' ' +
      etiquette +
      ']: ' +
      mesure.defile +
      ' > ' +
      mesure.large,
  );
  verifier(
    mesure.fautifs.length === 0,
    'éléments hors de l’écran [' + nom + ' ' + etiquette + ']: ' + mesure.fautifs.join(' | '),
  );
  const fichier = path.join(SORTIE, etiquette + '-' + nom.replace(/ /g, '-') + '.png');
  await page.screenshot({ path: fichier });
  return fichier;
}

async function aller(page, id) {
  await page.evaluate((i) => {
    location.hash = i;
  }, id);
  await page.waitForTimeout(150);
}

async function parcoursPlein(navigateur, base, format) {
  const { contexte, page, nom } = await ouvrir(
    navigateur,
    base,
    Object.assign({ scenario: 'plein' }, format),
  );
  await capturer(page, nom, '1-accueil');
  verifier(
    (await page.locator('#onglet-questions .tdb-onglet__compte').textContent()) === '3',
    'compteur de questions attendu à 3 [' + nom + ']',
  );

  await aller(page, 'questions');
  await page.locator('label.q-option', { hasText: 'Sur le quai couvert' }).click();
  await page.fill('#q-q3-libre', 'Tendres et un peu farceurs, jamais effrayants.');
  await capturer(page, nom, '2-questions-ouvertes');
  await page.locator('[data-question="q1"] button[type=submit]').click();
  await page.waitForTimeout(150);
  verifier(
    (await page.evaluate(() => window.__essai.docs.get('questions/q1').reponse)) ===
      'Sur le quai couvert',
    'réponse à q1 non écrite [' + nom + ']',
  );
  verifier(
    (await page.inputValue('#q-q3-libre')) === 'Tendres et un peu farceurs, jamais effrayants.',
    'le brouillon de q3 a été perdu après l’envoi de q1 [' + nom + ']',
  );
  verifier(
    (await page.locator('#onglet-questions .tdb-onglet__compte').textContent()) === '2',
    'compteur de questions attendu à 2 [' + nom + ']',
  );
  await page.locator('[data-question="q4"] summary').click();
  await page.locator('[data-question="q1"]').scrollIntoViewIfNeeded();
  await capturer(page, nom, '3-questions-repondue');

  await aller(page, 'images');
  await capturer(page, nom, '4-galerie');
  await page.locator('[data-image="gabarits"]').click();
  await page.waitForFunction(
    () =>
      document.querySelector('.vis__img') && document.querySelector('.vis__img').naturalWidth > 0,
  );
  await page.waitForTimeout(150);
  const scene = await page.locator('.vis__scene').boundingBox();
  await page.mouse.click(scene.x + scene.width * 0.5, scene.y + scene.height * 0.62);
  await page.fill('#tdb-remarque-vis-brouillon', 'Ce pied dépasse du cadre.');
  await page.keyboard.press('Control+Enter');
  await page.waitForTimeout(150);
  await page.click('#vis-mode-trait');
  await page.mouse.move(scene.x + scene.width * 0.3, scene.y + scene.height * 0.25);
  await page.mouse.down();
  for (let k = 1; k <= 12; k++)
    await page.mouse.move(
      scene.x + scene.width * (0.3 + 0.012 * k),
      scene.y + scene.height * (0.25 + 0.02 * k * (k % 2 ? 1 : 0.8)),
    );
  await page.mouse.up();
  await page.fill('#tdb-remarque-vis-brouillon', 'Ce pli de veste ne tombe pas droit.');
  await page.keyboard.press('Control+Enter');
  await page.waitForTimeout(200);
  const formes = await page.evaluate(() =>
    Array.from(window.__essai.docs.entries())
      .filter(([c]) => c.startsWith('remarques/essai'))
      .map(([, d]) => d.forme.sorte),
  );
  verifier(
    formes.join() === 'point,trait',
    'épingle et trait attendus dans la base, trouvé: ' + formes.join() + ' [' + nom + ']',
  );
  verifier(
    (await page.locator('.vis__scene button.vis__epingle').count()) === 4,
    'quatre marques attendues sur l’image [' + nom + ']',
  );
  await page.locator('.vis__cote').evaluate((e) => {
    e.scrollTop = 0;
  });
  await capturer(page, nom, '5-image-ouverte');
  await page.click('#vis-zoom-plus');
  await page.click('#vis-zoom-plus');
  for (const i of [0, 1, 2, 3]) {
    await page.locator('.vis__scene button.vis__epingle').nth(i).focus();
    const etatScene = await page.locator('.vis__scene').evaluate((e) => {
      const r = e.getBoundingClientRect();
      const b = document.activeElement.getBoundingClientRect();
      return {
        defile: e.scrollLeft + e.scrollTop,
        dedans: b.left >= r.left && b.right <= r.right && b.top >= r.top && b.bottom <= r.bottom,
      };
    });
    verifier(
      etatScene.defile === 0 && etatScene.dedans,
      'marque ' +
        (i + 1) +
        ' focalisée: visible et cadre immobile attendus ' +
        JSON.stringify(etatScene) +
        ' [' +
        nom +
        ']',
    );
  }
  await page.locator('.vis__remarques').scrollIntoViewIfNeeded();
  await capturer(page, nom, '6-image-zoom-remarques');
  await page.keyboard.press('Escape');
  await aller(page, 'regles');
  await page.fill('#rg-recherche', 'train');
  verifier(
    (await page.locator('.rg-regle').count()) === 1,
    'la recherche « train » doit garder une règle [' + nom + ']',
  );
  await capturer(page, nom, '7-regles');
  await contexte.close();
}

async function parcoursVide(navigateur, base, format) {
  for (const scenario of ['vide', 'horsligne']) {
    const { contexte, page, nom } = await ouvrir(
      navigateur,
      base,
      Object.assign({ scenario }, format),
    );
    await capturer(page, nom, '8-accueil');
    for (const id of ['questions', 'images', 'regles']) {
      await aller(page, id);
      verifier(
        (await page.locator('#panneau-' + id + ' .tdb-vide').count()) >= 1,
        'état vide attendu dans ' + id + ' [' + nom + ']',
      );
      if (id !== 'regles' || scenario === 'vide') await capturer(page, nom, '9-' + id);
    }
    await contexte.close();
  }
}

async function parcoursClavier(navigateur, base) {
  const { contexte, page, nom } = await ouvrir(navigateur, base, {
    largeur: 1366,
    hauteur: 768,
    theme: 'dark',
    scenario: 'plein',
  });
  const actif = () =>
    page.evaluate(() =>
      document.activeElement
        ? document.activeElement.id ||
          document.activeElement.className ||
          document.activeElement.tagName
        : '',
    );
  await page.focus('#onglet-avancement');
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(100);
  verifier(
    (await page.evaluate(() => location.hash)) === '#questions' &&
      (await actif()) === 'onglet-questions',
    'flèche droite: onglet Questions attendu',
  );
  await page.focus('#q-q2-o0');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Tab');
  await page.keyboard.type('Avec une nuit courte.');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  const q2 = await page.evaluate(() => window.__essai.docs.get('questions/q2'));
  verifier(
    q2.statut === 'repondue' &&
      q2.reponse === '20 minutes' &&
      q2.reponseLibre === 'Avec une nuit courte.',
    'réponse au clavier à q2: ' + JSON.stringify(q2),
  );
  verifier(
    (await page.evaluate(() => document.activeElement.getAttribute('data-modifier'))) === 'q2',
    'après l’envoi, le focus va sur « Modifier ma réponse »',
  );
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  verifier(
    (await page.locator('[data-question="q2"] form').count()) === 1,
    'Modifier rouvre le formulaire',
  );

  await page.focus('#onglet-questions');
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(150);
  await page.focus('[data-image="gabarits"]');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('.vis__img').naturalWidth > 0);
  verifier(
    (await actif()) === 'vis__scene',
    'à l’ouverture, le focus est sur l’image: ' + (await actif()),
  );
  await page.keyboard.press('+');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  verifier((await actif()) === 'tdb-remarque-vis-brouillon', 'Entrée ouvre le champ de remarque');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(350);
  verifier(
    await page.locator('dialog.vis').evaluate((d) => d.open),
    'Échap annule le brouillon sans fermer la visionneuse',
  );
  verifier((await actif()) === 'vis__scene', 'après Échap, le focus revient sur l’image');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Posée au clavier.');
  await page.keyboard.press('Control+Enter');
  await page.waitForTimeout(150);
  verifier(
    await page.evaluate(() =>
      Array.from(window.__essai.docs.values()).some(
        (d) =>
          d.texte === 'Posée au clavier.' &&
          d.forme.sorte === 'point' &&
          d.auteur === 'lecteur-essai',
      ),
    ),
    'épingle au clavier enregistrée',
  );
  await page.focus('#vis-note-7');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  verifier(
    (await page.evaluate(
      () => window.__essai.docs.get('remarques/note-image-gabarits').forme.valeur,
    )) === 9,
    'note 9 au clavier',
  );
  verifier(
    (await actif()) === 'vis-note-9',
    'le focus reste sur la note choisie: ' + (await actif()),
  );
  const avant = await page.evaluate(() => window.__essai.docs.size);
  await page.locator('.vis__remarque button', { hasText: 'Supprimer' }).first().focus();
  await page.keyboard.press('Enter');
  verifier(
    await page.locator('#tdb-confirmer').evaluate((d) => d.open),
    'la suppression demande confirmation dans la page',
  );
  await page.keyboard.press('Escape');
  await page.waitForTimeout(350);
  verifier(
    (await page.evaluate(() => window.__essai.docs.size)) === avant,
    'Échap dans la confirmation ne supprime rien',
  );
  verifier(
    await page.locator('dialog.vis').evaluate((d) => d.open),
    'Échap dans la confirmation ne ferme pas la visionneuse',
  );
  await page.locator('.vis__remarque button', { hasText: 'Supprimer' }).first().focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  verifier(
    (await page.evaluate(() => window.__essai.docs.size)) === avant - 1,
    'confirmation au clavier: une remarque en moins',
  );
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  verifier(
    !(await page.locator('dialog.vis').evaluate((d) => d.open)),
    'Échap ferme la visionneuse',
  );
  verifier(
    (await page.evaluate(() => document.activeElement.getAttribute('data-image'))) === 'gabarits',
    'à la fermeture, le focus revient sur la vignette',
  );
  await capturer(page, nom, '10-apres-clavier');
  await contexte.close();
}

async function parcoursLectureEtLent(navigateur, base) {
  let s = await ouvrir(navigateur, base, {
    largeur: 1366,
    hauteur: 768,
    theme: 'dark',
    scenario: 'lecture',
  });
  verifier(
    (await s.page.locator('#tdb-lien').textContent()) === 'Lecture seule',
    'état « Lecture seule » attendu',
  );
  await aller(s.page, 'questions');
  verifier(
    (await s.page.locator('#panneau-questions form').count()) === 0,
    'aucun formulaire en lecture seule',
  );
  await capturer(s.page, s.nom, '11-questions');
  await aller(s.page, 'images');
  await s.page.locator('[data-image="gabarits"]').click();
  await s.page.waitForFunction(() => document.querySelector('.vis__img').naturalWidth > 0);
  await capturer(s.page, s.nom, '12-image');
  await s.contexte.close();

  s = await ouvrir(navigateur, base, {
    largeur: 400,
    hauteur: 800,
    theme: 'dark',
    scenario: 'lent',
    horloge: true,
  });
  await s.page.clock.runFor(500);
  verifier(
    (await s.page.locator('#panneau-avancement .tdb-vide__titre').first().textContent()).includes(
      'Chargement',
    ),
    'état de chargement attendu',
  );
  await s.page.clock.runFor(10500);
  verifier(
    (await s.page.locator('#panneau-avancement .tdb-vide').first().textContent()).includes(
      'ne répond pas encore',
    ),
    'après 10 s, le chargement doit dire que la base tarde',
  );
  verifier(
    (await s.page.locator('#tdb-lien').textContent()) === 'La base tarde à répondre',
    'indicateur de retard attendu',
  );
  await capturer(s.page, s.nom, '13-accueil-apres-10s');
  await s.contexte.close();
}

async function contrastes(navigateur, base) {
  const paires = [
    ['--texte', '--fond', 4.5],
    ['--texte', '--panneau', 4.5],
    ['--texte', '--panneau-haut', 4.5],
    ['--texte', '--creux', 4.5],
    ['--texte-doux', '--fond', 4.5],
    ['--texte-doux', '--panneau', 4.5],
    ['--texte-doux', '--panneau-haut', 4.5],
    ['--texte-doux', '--creux', 4.5],
    ['--sur-accent', '--accent', 4.5],
    ['--accent-texte', '--fond', 4.5],
    ['--accent-texte', '--panneau', 4.5],
    ['--accent-texte', '--creux', 4.5],
    ['--ok', '--panneau', 4.5],
    ['--ok', '--fond', 4.5],
    ['--alerte', '--panneau', 4.5],
    ['--alerte', '--fond', 4.5],
    ['--fond', '--texte', 4.5],
    ['--filet-fort', '--panneau', 3],
    ['--filet-fort', '--fond', 3],
    ['--bord-accent', '--panneau', 3],
  ];
  const lignes = [];
  for (const theme of ['dark', 'light']) {
    const { contexte, page } = await ouvrir(navigateur, base, {
      largeur: 800,
      hauteur: 600,
      theme,
      scenario: 'vide',
    });
    const valeurs = await page.evaluate(
      (noms) => {
        const st = getComputedStyle(document.documentElement);
        return Object.fromEntries(noms.map((n) => [n, st.getPropertyValue(n).trim()]));
      },
      Array.from(new Set(paires.flatMap((p) => [p[0], p[1]]))),
    );
    const lum = (hex) => {
      const c = [1, 3, 5]
        .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    for (const [a, b, mini] of paires) {
      const la = lum(valeurs[a]);
      const lb = lum(valeurs[b]);
      const r = (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
      lignes.push(
        theme +
          ' ' +
          a +
          ' sur ' +
          b +
          ': ' +
          r.toFixed(2) +
          (r < mini ? '  INSUFFISANT (< ' + mini + ')' : ''),
      );
      verifier(
        r >= mini,
        'contraste ' + theme + ' ' + a + ' sur ' + b + ': ' + r.toFixed(2) + ' < ' + mini,
      );
    }
    await contexte.close();
  }
  return lignes;
}

(async () => {
  fs.mkdirSync(SORTIE, { recursive: true });
  await new Promise((ok) => serveur.listen(0, '127.0.0.1', ok));
  const base = 'http://127.0.0.1:' + serveur.address().port;
  const formats = [];
  for (const theme of ['dark', 'light'])
    for (const [largeur, hauteur] of [
      [1366, 768],
      [400, 800],
    ])
      formats.push({ largeur, hauteur, theme });
  for (const format of formats) {
    const navigateur = await chromium.launch();
    await parcoursPlein(navigateur, base, format);
    await parcoursVide(navigateur, base, format);
    await navigateur.close();
  }
  const navigateur = await chromium.launch();
  await parcoursClavier(navigateur, base);
  await parcoursLectureEtLent(navigateur, base);
  const lignes = await contrastes(navigateur, base);
  // Écran Retina: une capture à l'échelle 2 pour juger la netteté des marques.
  const retina = await ouvrir(navigateur, base, {
    largeur: 1920,
    hauteur: 1080,
    theme: 'dark',
    scenario: 'plein',
    echelle: 2,
  });
  await capturer(retina.page, retina.nom + ' x2', '14-accueil');
  await retina.contexte.close();
  await navigateur.close();
  serveur.close();
  process.stdout.write(lignes.join('\n') + '\n');
  process.stdout.write('Captures: ' + SORTIE + '\n');
  if (defauts.length) {
    process.stdout.write('DÉFAUTS (' + defauts.length + '):\n- ' + defauts.join('\n- ') + '\n');
    process.exit(1);
  }
  process.stdout.write(
    'Aucun défaut: console propre, aucun débordement, clavier et contrastes conformes.\n',
  );
})().catch((e) => {
  process.stdout.write(
    'Échec du banc: ' +
      (e && e.stack ? e.stack : e) +
      '\n' +
      (defauts.length ? '- ' + defauts.join('\n- ') + '\n' : ''),
  );
  process.exit(1);
});
