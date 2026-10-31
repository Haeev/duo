'use strict';
/*
  Vérifie les maquettes de l'interface en jeu.
  Usage, depuis la racine du dépôt: node games/la-petite-ligne/ui-maquettes/outils/verifier.cjs
  1. Mise en page, pour chaque état, en 1920x1080 et en 1366x768 à 100, 125 et 150 %:
     aucun défilement horizontal, aucun texte plus large que sa boîte, rien hors de l'écran.
  2. Contrastes WCAG 2.1 calculés: texte 4,5:1 (3:1 pour le grand texte), sauf commandes désactivées.
  3. Clavier seul: un scénario par écran (focus par défaut, flèches, Entrée, Retour arrière,
     touche du panneau, Échap sans effet sur les panneaux du jeu, anti-double-appui, focus visible).
  Sort en erreur (code 1) au premier problème trouvé dans la liste.
*/
const { chromium } = require('playwright');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const ETATS = {
  'titre.html': ['accueil', 'attente', 'reprise'],
  'creation.html': ['edition', 'erreur', 'fini', 'prets'],
  'petit-dejeuner.html': ['matin', 'petite-forme', 'parti'],
  'hud.html': ['jour', 'vide', 'pluie', 'veillee', 'attente', 'fatigue', 'train', 'notifications'],
  'dialogue.html': ['scene', 'choix-autre', 'attente', 'reponses', 'odette', 'basile', 'carte'],
  'carnet.html': ['sac', 'sac-plein', 'sac-vide', 'quetes', 'courrier'],
  'caisse.html': ['caisse', 'caisse-vide', 'complete', 'tableau', 'parti'],
  'catalogue.html': ['catalogue', 'attente', 'trop-cher', 'ferme', 'livre'],
  'achat.html': ['recue', 'envoyee', 'acceptee', 'refusee', 'manque'],
  'amenagement.html': ['pose', 'bloque', 'deja-pris'],
  'nuit.html': ['choix', 'attente', 'desaccord', 'fin'],
  'fin.html': ['complete', 'partielle', 'attente'],
};
const AFFICHAGES = [
  [1920, 1080, 100],
  [1366, 768, 100],
  [1366, 768, 125],
  [1366, 768, 150],
];

function url(fichier, etat, taille) {
  return `file://${path.join(RACINE, fichier)}${taille && taille !== 100 ? `?taille=${taille}` : ''}${etat ? `#${etat}` : ''}`;
}

// Exécutée dans la page.
function analyser() {
  const problemes = [];
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const visible = (el) => {
    if (el.closest('[hidden]')) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0)
      return false;
    return el.getClientRects().length > 0;
  };
  const decrire = (el) => {
    const t = (el.innerText || el.getAttribute('aria-label') || '')
      .replace(/[ \t\r\n]+/g, ' ')
      .trim()
      .slice(0, 48);
    return `${el.tagName.toLowerCase()}.${(el.getAttribute('class') || '').split(' ')[0]} « ${t} »`;
  };
  const couleur = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return [0, 0, 0, 0];
    const p = m[1]
      .split(/[\s,/]+/)
      .filter(Boolean)
      .map(Number);
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  };
  const melanger = (a, b) => [0, 1, 2].map((i) => a[i] * a[3] + b[i] * (1 - a[3])).concat(1);
  const fond = (el) => {
    const chaine = [];
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) chaine.unshift(n);
    let c = [255, 255, 255, 1];
    let opaque = false;
    for (const n of chaine) {
      const b = couleur(getComputedStyle(n).backgroundColor);
      if (b[3] > 0) {
        c = melanger(b, c);
        if (n.closest('.lpl-ui') && b[3] === 1) opaque = true;
      }
    }
    return { c, opaque };
  };
  const lum = (c) => {
    const v = c.slice(0, 3).map((x) => {
      const s = x / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  };
  const rapport = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

  if (document.documentElement.scrollWidth > vw + 1)
    problemes.push(`défilement horizontal (${document.documentElement.scrollWidth} pour ${vw})`);
  let pire = Infinity;
  document.querySelectorAll('.lpl-ui *').forEach((el) => {
    if (!visible(el) || el.closest('svg')) return;
    const cs = getComputedStyle(el);
    const aDuTexte = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    const r = el.getBoundingClientRect();
    const dansDefilement = el.closest('.lpl-panel__body, .lpl-screen');
    if (aDuTexte || el.matches('button, input')) {
      if (!dansDefilement && (r.right > vw + 1 || r.left < -1 || r.bottom > vh + 1 || r.top < -1))
        problemes.push(`hors de l'écran : ${decrire(el)}`);
      // Débordement mesuré sur les nœuds de texte eux-mêmes: les badges en position absolue
      // (qualité, coche d'une option, tampon) dépassent exprès de leur case.
      const defile = /(auto|scroll)/.test(cs.overflowX);
      if (cs.display !== 'inline' && !defile) {
        const gauche = r.left + parseFloat(cs.borderLeftWidth);
        const droite = r.right - parseFloat(cs.borderRightWidth);
        for (const n of el.childNodes) {
          if (n.nodeType !== 3 || !n.textContent.trim()) continue;
          const plage = document.createRange();
          plage.selectNodeContents(n);
          const rt = plage.getBoundingClientRect();
          if (rt.right > droite + 1 || rt.left < gauche - 1)
            problemes.push(
              `texte plus large que sa boîte : ${decrire(el)} (${Math.round(rt.width)} px)`,
            );
        }
        if (el.matches('input') && el.scrollWidth > el.clientWidth + 1)
          problemes.push(`texte plus large que son champ : ${decrire(el)}`);
      }
    }
    if (
      el.matches('.lpl-panel, .lpl-proposal, .lpl-dialogue, .lpl-sheet') &&
      !el.closest('.lpl-screen')
    ) {
      if (r.top < -1 || r.bottom > vh + 1 || r.left < -1 || r.right > vw + 1)
        problemes.push(`fenêtre hors de l'écran : ${decrire(el)}`);
    }
    if (aDuTexte && !el.closest('button:disabled, [aria-disabled="true"]')) {
      const { c: f, opaque } = fond(el);
      if (!opaque) {
        problemes.push(`texte posé sur la scène sans fond : ${decrire(el)}`);
        return;
      }
      const t = couleur(cs.color);
      const ratio = rapport(t[3] < 1 ? melanger(t, f) : t, f);
      const taille = parseFloat(cs.fontSize);
      const grand = taille >= 24 || (taille >= 18.66 && Number(cs.fontWeight) >= 700);
      const seuil = grand ? 3 : 4.5;
      pire = Math.min(pire, ratio);
      if (ratio < seuil)
        problemes.push(`contraste ${ratio.toFixed(2)}:1 < ${seuil}:1 : ${decrire(el)}`);
    }
  });
  return { problemes, pire };
}

async function verifierMiseEnPage(navigateur) {
  const problemes = [];
  let pire = Infinity;
  let pages = 0;
  for (const [l, h, taille] of AFFICHAGES) {
    const contexte = await navigateur.newContext({ viewport: { width: l, height: h } });
    const page = await contexte.newPage();
    page.on('pageerror', (e) => problemes.push(`erreur de script : ${e.message}`));
    for (const [fichier, etats] of Object.entries(ETATS)) {
      for (const etat of etats) {
        await page.goto('about:blank');
        await page.goto(url(fichier, etat, taille));
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(80);
        const r = await page.evaluate(analyser);
        pages += 1;
        pire = Math.min(pire, r.pire);
        r.problemes.forEach((p) =>
          problemes.push(`${fichier}#${etat} ${l}x${h} ${taille} % : ${p}`),
        );
      }
    }
    await contexte.close();
  }
  return { problemes, pire, pages };
}

// Scénarios au clavier seul.
async function verifierClavier(navigateur) {
  const echecs = [];
  const contexte = await navigateur.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await contexte.newPage();
  const ouvrir = async (fichier, etat) => {
    await page.goto('about:blank');
    await page.goto(url(fichier, etat));
    await page.evaluate(() => document.fonts.ready);
  };
  const attendre = () => page.waitForTimeout(320);
  // Textes comparés sans les espaces insécables de la typographie (U+00A0, U+202F).
  const focus = () =>
    page.evaluate(() =>
      (
        document.activeElement?.innerText ||
        document.activeElement?.getAttribute('aria-label') ||
        document.activeElement?.value ||
        ''
      )
        .replace(/[ \t\r\n\u00a0\u202f]+/g, ' ')
        .trim(),
    );
  const focusVisible = () =>
    page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return false;
      const cible = el.matches('input[type="radio"]') ? el.closest('.lpl-option') : el;
      return getComputedStyle(cible).outlineStyle !== 'none' && el.matches(':focus-visible');
    });
  // Le changement d'état passe par hashchange, asynchrone: on lui laisse un instant.
  const etat = async () => {
    await page.waitForTimeout(60);
    return page.evaluate(() => document.body.dataset.state);
  };
  const panneauOuvert = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('.lpl-panel')].some(
        (p) => !p.hidden && p.getClientRects().length,
      ),
    );
  const verifier = (nom, ok, detail = '') => {
    if (!ok) echecs.push(`${nom}${detail ? ` (${detail})` : ''}`);
    return ok;
  };
  const scenarios = [];

  // Écran titre: anti-double-appui, focus par défaut, Entrée.
  await ouvrir('titre.html', 'accueil');
  await page.keyboard.press('Enter');
  verifier('titre: Entrée ignorée pendant 300 ms', (await etat()) === 'accueil');
  await attendre();
  verifier(
    'titre: focus sur « Commencer la semaine »',
    (await focus()) === 'Commencer la semaine',
    await focus(),
  );
  verifier('titre: focus visible', await focusVisible());
  await page.keyboard.press('Enter');
  verifier('titre: Entrée passe en attente', (await etat()) === 'attente');
  verifier('titre: focus sur « Pas encore »', (await focus()) === 'Pas encore', await focus());
  scenarios.push('titre');

  // Création: champ, Retour arrière dans le champ, Tab, flèches des boutons radio, validation.
  await ouvrir('creation.html', 'edition');
  await attendre();
  verifier('création: focus dans le prénom', (await focus()) === 'Camille', await focus());
  await page.keyboard.press('Backspace');
  verifier(
    'création: Retour arrière efface une lettre',
    (await page.inputValue('#prenom')) === 'Camill',
  );
  await page.keyboard.press('Tab');
  await page.keyboard.press('ArrowRight');
  verifier(
    'création: les flèches changent de coiffure',
    await page.evaluate(
      () => document.querySelector('input[name="coiffure"]:checked').value === 'messy',
    ),
  );
  verifier('création: focus visible sur l’option', await focusVisible());
  await page.focus('#prenom');
  await page.keyboard.press('Enter');
  verifier('création: Entrée valide le personnage', (await etat()) === 'fini');
  scenarios.push('création');

  // HUD: chiffres facultatifs et molette.
  await ouvrir('hud.html', 'jour');
  await attendre();
  await page.keyboard.press('Digit3');
  verifier(
    'HUD: 3 choisit la hache',
    await page.evaluate(
      () => document.querySelector('.lpl-toolbar__label [data-label]').textContent === 'Hache',
    ),
  );
  await page.mouse.move(683, 400);
  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(100);
  verifier(
    'HUD: la molette passe à l’outil suivant',
    await page.evaluate(() =>
      document
        .querySelector('.lpl-toolbar__label [data-label]')
        .textContent.startsWith('Graines de radis'),
    ),
  );
  scenarios.push('HUD');

  // Carnet: focus par défaut, flèches et ZQSD, onglets A et E, Échap sans effet, Tab ferme.
  await ouvrir('carnet.html', 'sac');
  await attendre();
  verifier(
    'carnet: focus sur le pain',
    (await focus()).startsWith('Pain') ||
      (await page.evaluate(() => document.activeElement.getAttribute('aria-label'))) === 'Pain, 1',
  );
  verifier('carnet: focus visible', await focusVisible());
  await page.keyboard.press('ArrowDown');
  const apresBas = await page.evaluate(() => document.activeElement.getAttribute('aria-label'));
  verifier(
    'carnet: flèche bas passe de la barre au sac',
    apresBas === 'Case vide' || apresBas.startsWith('Boîte') || apresBas.startsWith('Pissenlits'),
    apresBas,
  );
  await page.keyboard.press('KeyW');
  verifier(
    'carnet: Z remonte dans la barre',
    await page.evaluate(() => !!document.activeElement.closest('.lpl-inventory--toolbar')),
  );
  await page.keyboard.press('KeyQ');
  verifier(
    'carnet: A passe à l’onglet Courrier',
    await page.evaluate(
      () => document.querySelector('#onglet-courrier').getAttribute('aria-selected') === 'true',
    ),
  );
  await page.keyboard.press('KeyE');
  await page.keyboard.press('KeyE');
  verifier(
    'carnet: E revient au sac en passant par la fin',
    await page.evaluate(
      () => document.querySelector('#onglet-quetes').getAttribute('aria-selected') === 'true',
    ),
  );
  await page.keyboard.press('Escape');
  verifier('carnet: Échap ne ferme pas le carnet', await panneauOuvert());
  await page.keyboard.press('Tab');
  verifier('carnet: Tab ferme le carnet', !(await panneauOuvert()));
  scenarios.push('carnet');

  // Caisse: focus par défaut, Retour arrière ferme, Échap non.
  await ouvrir('caisse.html', 'caisse');
  await attendre();
  verifier(
    'caisse: focus sur « Déposer 3 œufs »',
    (await focus()) === 'Déposer 3 œufs',
    await focus(),
  );
  await page.keyboard.press('ArrowUp');
  verifier(
    'caisse: flèche haut va à la ligne au-dessus',
    (await focus()) === 'Rien à déposer',
    await focus(),
  );
  await page.keyboard.press('Escape');
  verifier('caisse: Échap ne ferme pas', await panneauOuvert());
  await page.keyboard.press('Backspace');
  verifier('caisse: Retour arrière ferme', !(await panneauOuvert()));
  scenarios.push('caisse');

  // Catalogue: flèches entre les cartes.
  await ouvrir('catalogue.html', 'catalogue');
  await attendre();
  verifier('catalogue: focus sur le tapis', (await focus()).startsWith('Tapis'), await focus());
  await page.keyboard.press('ArrowRight');
  verifier(
    'catalogue: flèche droite va aux rideaux',
    (await focus()).startsWith('Rideaux'),
    await focus(),
  );
  await page.keyboard.press('KeyD');
  verifier('catalogue: D va au poste à galène', (await focus()).startsWith('Poste'), await focus());
  scenarios.push('catalogue');

  // Dialogue: choix aux flèches, Entrée choisit, attente de l'autre.
  await ouvrir('dialogue.html', 'scene');
  await attendre();
  verifier(
    'dialogue: focus sur la première réplique',
    (await focus()).includes('On s’y met'),
    await focus(),
  );
  await page.keyboard.press('ArrowDown');
  verifier(
    'dialogue: flèche bas va à la seconde',
    (await focus()).includes('Vingt ans'),
    await focus(),
  );
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  verifier('dialogue: Entrée choisit et attend Sacha', (await etat()) === 'attente');
  scenarios.push('dialogue');

  // Proposition: rien ne vole le focus, Entrée y amène, Entrée accepte.
  await ouvrir('achat.html', 'recue');
  await attendre();
  verifier(
    'proposition: le focus reste au jeu',
    await page.evaluate(() => document.activeElement === document.body),
  );
  await page.keyboard.press('Enter');
  verifier(
    'proposition: Entrée amène le focus sur « D’accord »',
    (await focus()) === 'D’accord',
    await focus(),
  );
  await page.keyboard.press('Enter');
  verifier('proposition: Entrée accepte', (await etat()) === 'acceptee');
  scenarios.push('proposition');

  // Nuit: Continuer par défaut, flèche vers Finir la séance.
  await ouvrir('nuit.html', 'choix');
  await attendre();
  verifier('nuit: focus sur « Continuer »', (await focus()) === 'Continuer', await focus());
  await page.keyboard.press('ArrowRight');
  verifier(
    'nuit: flèche droite va à « Finir la séance »',
    (await focus()) === 'Finir la séance',
    await focus(),
  );
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter');
  verifier(
    'nuit: Entrée choisit Continuer',
    (await etat()) === 'attente' &&
      (await page.evaluate(() =>
        document.querySelector('[data-toggle-group="nuit"]').getAttribute('aria-pressed'),
      )) === 'true',
  );
  scenarios.push('nuit');

  // Petit-déjeuner et fin: focus par défaut.
  await ouvrir('petit-dejeuner.html', 'matin');
  await attendre();
  verifier(
    'petit-déjeuner: focus sur « Commencer ma journée »',
    (await focus()) === 'Commencer ma journée',
    await focus(),
  );
  await ouvrir('fin.html', 'complete');
  await attendre();
  verifier('fin: focus sur « Continuer »', (await focus()) === 'Continuer', await focus());
  await page.keyboard.press('Enter');
  verifier('fin: Entrée passe en attente de Sacha', (await etat()) === 'attente');
  scenarios.push('petit-déjeuner', 'fin');

  // Tab boucle dans un panneau (piège à focus).
  await ouvrir('caisse.html', 'caisse');
  await attendre();
  for (let i = 0; i < 12; i += 1) await page.keyboard.press('Tab');
  verifier(
    'caisse: Tab reste dans le panneau',
    await page.evaluate(() => !!document.activeElement.closest('.lpl-panel')),
  );
  scenarios.push('piège à focus');

  await contexte.close();
  return { echecs, scenarios };
}

(async () => {
  const navigateur = await chromium.launch();
  const mise = await verifierMiseEnPage(navigateur);
  const clavier = await verifierClavier(navigateur);
  await navigateur.close();
  process.stdout.write(
    `Mise en page et contrastes : ${mise.pages} pages analysées, ${mise.problemes.length} problème(s). Contraste le plus faible : ${mise.pire.toFixed(2)}:1\n`,
  );
  mise.problemes.slice(0, 60).forEach((p) => process.stdout.write(`  ${p}\n`));
  process.stdout.write(
    `Clavier : ${clavier.scenarios.length} scénarios, ${clavier.echecs.length} échec(s)\n`,
  );
  clavier.echecs.forEach((e) => process.stdout.write(`  ${e}\n`));
  if (mise.problemes.length || clavier.echecs.length) process.exit(1);
})().catch((e) => {
  process.stderr.write(`Échec : ${e.stack}\n`);
  process.exit(1);
});
