'use strict';
/*
  Vérifie les maquettes de Cosy Café.
  1. Mise en page de chaque état sur plusieurs affichages (1920x1080, 1366x768, 1280x720, fenêtres et tailles
     d'interface 125 et 150 %, police large, pseudos longs): rien hors de l'écran ni de sa boîte, aucune région
     du HUD qui en chevauche une autre, aucun texte posé sur la scène sans fond, contrastes WCAG AA calculés.
  2. Parcours au clavier seul: ouvrir la tablette, changer de section, proposer un achat, répondre à une
     proposition, écrire sur l'ardoise, tourner les pages du bilan, Échap réservé à la pause de Duo,
     Retour arrière qui ferme, focus toujours visible, anti-double-appui.
  Usage, depuis la racine du dépôt: node design/maquettes/cosy-cafe/outils/verifier.cjs
  Code de sortie: 0 si tout passe, 1 sinon.
*/
const { chromium } = require('playwright');
const path = require('path');

const ICI = path.join(__dirname, '..');
const ETATS = {
  'hud.html': ['service', 'rail', 'caisse', 'preparation', 'ouverture', 'ouverture-ouverte', 'fermeture', 'vide', 'tasses', 'geste', 'geste-simplifie', 'proposition', 'proposition-ouverte', 'envoyee', 'reprendre', 'amenagement', 'amenagement-ok', 'amenagement-eau', 'porter'],
  'tablette.html': ['accueil', 'commandes', 'commandes-envoyee', 'catalogue', 'catalogue-proposer', 'catalogue-attente', 'carte', 'equipe', 'cafes', 'bilans', 'projets', 'reglages'],
  'ardoise.html': ['composer', 'vide', 'pleine', 'ensemble', 'service'],
  'bilan.html': ['livre', 'livre-vide', 'premier', 'appris', 'chiffres', 'plusieurs', 'demain']
};

// [largeur, hauteur, taille de l'interface, libellé, options]
const AFFICHAGES = [
  [1920, 1080, 100, 'Full HD'],
  [1366, 768, 100, 'portable 1366x768'],
  [1280, 720, 100, '1080p réglé à 150 % dans Windows'],
  [1366, 689, 100, '1366x768 en fenêtre agrandie'],
  [1093, 615, 100, '1366x768 à 125 % dans Windows'],
  [1366, 768, 125, '1366x768, interface à 125 %'],
  [1366, 768, 150, '1366x768, interface à 150 %'],
  [1280, 720, 150, '1280x720, interface à 150 %'],
  [1920, 1080, 150, 'Full HD, interface à 150 %'],
  [1093, 615, 125, '1093x615, interface à 125 %'],
  [1366, 768, 100, 'police large (DejaVu Sans)', { police: 'DejaVu Sans' }],
  [1280, 720, 125, 'police large, interface à 125 %', { police: 'DejaVu Sans' }],
  [1366, 768, 150, 'pseudos de 16 caractères, interface à 150 %', { pseudos: true }]
];

function adresse(fichier, etat, taille) {
  return `file://${path.join(ICI, fichier)}${taille && taille !== 100 ? `?taille=${taille}` : ''}${etat ? `#${etat}` : ''}`;
}

// ---------- Analyse exécutée dans la page ----------
function analyser() {
  const problemes = [];
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const visible = (el) => {
    if (el.closest('[hidden]')) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) return false;
    return el.getClientRects().length > 0;
  };
  const decrire = (el) => {
    const t = (el.innerText || el.getAttribute('aria-label') || '').replace(/[ \t\r\n]+/g, ' ').trim().slice(0, 48);
    return `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''} « ${t} »`;
  };
  const couleur = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return [0, 0, 0, 0];
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  };
  const melanger = (a, b) => [0, 1, 2].map((i) => a[i] * a[3] + b[i] * (1 - a[3])).concat(1);
  // Fond effectif: les fonds unis des ancêtres, composés; null si le texte est posé sur la scène.
  const fond = (el) => {
    const chaine = [];
    for (let n = el; n && n.nodeType === 1 && n !== document.body; n = n.parentElement) chaine.unshift(n);
    let c = null;
    for (const n of chaine) {
      const b = couleur(getComputedStyle(n).backgroundColor);
      if (b[3] >= 0.99) c = b;
      else if (b[3] > 0 && c) c = melanger(b, c);
    }
    return c;
  };
  const lum = (c) => {
    const v = c.slice(0, 3).map((x) => {
      const s = x / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  };
  const rapport = (a, b) => {
    const x = lum(a);
    const y = lum(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  const dedans = (r, b, marge = 1) => r.left >= b.left - marge && r.right <= b.right + marge && r.top >= b.top - marge && r.bottom <= b.bottom + marge;
  const defilable = (el) => /(auto|scroll)/.test(getComputedStyle(el).overflowY) || /(auto|scroll)/.test(getComputedStyle(el).overflowX);
  const ancetreDefilable = (el) => {
    for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) if (defilable(n)) return n;
    return null;
  };

  if (document.documentElement.scrollWidth > vw + 1) problemes.push(`défilement horizontal (${document.documentElement.scrollWidth} px pour ${vw})`);

  // Interfaces posées: entières dans l'écran.
  document.querySelectorAll('.interface, dialog[open]').forEach((el) => {
    if (!visible(el)) return;
    if (!dedans(el.getBoundingClientRect(), { left: 0, top: 0, right: vw, bottom: vh })) problemes.push(`interface hors de l'écran : ${decrire(el)}`);
  });

  // Textes: dans l'écran (ou dans la zone visible de leur conteneur qui défile), jamais plus larges que leur boîte.
  let minTexte = Infinity;
  let pireTexte = '';
  let minBord = Infinity;
  let pireBord = '';
  const marcheur = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = marcheur.nextNode(); n; n = marcheur.nextNode()) {
    if (!n.textContent.trim()) continue;
    const el = n.parentElement;
    if (!el || el.closest('svg, script, style, .visuellement-cache, .note-maquette') || !visible(el)) continue;
    const plage = document.createRange();
    plage.selectNodeContents(n);
    const zone = ancetreDefilable(el);
    const cadre = zone ? zone.getBoundingClientRect() : { left: 0, top: 0, right: vw, bottom: vh };
    for (const r of plage.getClientRects()) {
      if (r.width === 0) continue;
      const horsEcran = r.right > vw + 1 || r.left < -1 || (!zone && (r.bottom > vh + 1 || r.top < -1));
      const horsCadre = zone && (r.right > cadre.right + 1 || r.left < cadre.left - 1);
      if (horsEcran || horsCadre) {
        problemes.push(`texte hors de l'écran ou de son cadre : ${decrire(el)}`);
        break;
      }
    }
    // Contraste du texte.
    if (el.closest('button:disabled, [aria-disabled="true"]')) continue;
    const cs = getComputedStyle(el);
    const f = fond(el);
    if (!f) {
      problemes.push(`texte posé sur la scène sans fond : ${decrire(el)}`);
      continue;
    }
    const avant = couleur(cs.color);
    const texte = avant[3] < 1 ? melanger(avant, f) : avant;
    const ratio = rapport(texte, f);
    const taille = parseFloat(cs.fontSize);
    const grand = taille >= 24 || (taille >= 18.66 && Number(cs.fontWeight) >= 700);
    const seuil = grand ? 3 : 4.5;
    if (ratio < seuil) problemes.push(`contraste ${ratio.toFixed(2)}:1 < ${seuil}:1 : ${decrire(el)}`);
    if (ratio < minTexte) {
      minTexte = ratio;
      pireTexte = decrire(el);
    }
  }

  // Boîtes qui laissent déborder leur contenu (boutons, cartes, capsules, lignes).
  document.querySelectorAll('.bouton, .carte, .carte-hud, .capsule, .puce, .recette, .ligne-ardoise, .mot, .projet, .verrou, .onglet').forEach((el) => {
    if (!visible(el) || el.closest('svg')) return;
    if (el.scrollWidth > el.clientWidth + 1 && !defilable(el)) problemes.push(`contenu plus large que sa boîte : ${decrire(el)} (${el.scrollWidth} > ${el.clientWidth})`);
    const r = el.getBoundingClientRect();
    el.querySelectorAll('*').forEach((d) => {
      if (!visible(d) || d.closest('svg') !== null && d.tagName !== 'svg') return;
      const rd = d.getBoundingClientRect();
      if (rd.width === 0 || rd.height === 0) return;
      if (!dedans(rd, r, 1.5)) problemes.push(`dépasse de ${decrire(el)} : ${decrire(d)}`);
    });
    // Bord des commandes: 3:1 contre ce qui les entoure (WCAG 1.4.11).
    if (el.matches('.bouton') && !el.matches('[aria-disabled="true"], :disabled')) {
      const autour = fond(el.parentElement) || [154, 154, 154, 1];
      const bord = couleur(getComputedStyle(el).borderTopColor);
      const interieur = fond(el) || autour;
      const ratio = Math.max(rapport(bord, autour), rapport(interieur, autour));
      if (ratio < 3) problemes.push(`bord de commande peu visible ${ratio.toFixed(2)}:1 : ${decrire(el)}`);
      if (ratio < minBord) {
        minBord = ratio;
        pireBord = decrire(el);
      }
    }
  });

  // HUD: chaque élément dans l'écran, et aucune région qui en chevauche une autre.
  const ecran = { left: 0, top: 0, right: vw, bottom: vh };
  const regions = [];
  document.querySelectorAll('.hud > *').forEach((region) => {
    if (!visible(region)) return;
    const morceaux = region.matches('.hud-centre') ? [...region.children] : [region];
    morceaux.forEach((m) => {
      if (!visible(m)) return;
      const rects = [m, ...m.querySelectorAll('*')].filter((x) => visible(x) && !x.closest('svg')).map((x) => x.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0);
      if (!rects.length) return;
      const u = rects.reduce((a, r) => ({ left: Math.min(a.left, r.left), top: Math.min(a.top, r.top), right: Math.max(a.right, r.right), bottom: Math.max(a.bottom, r.bottom) }), { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
      if (!dedans(u, ecran, 1)) problemes.push(`élément du HUD hors de l'écran : ${decrire(m)}`);
      regions.push({ nom: decrire(m), r: u, centre: region.matches('.hud-centre') });
    });
  });
  for (let i = 0; i < regions.length; i += 1) {
    for (let j = i + 1; j < regions.length; j += 1) {
      const a = regions[i];
      const b = regions[j];
      if (a.centre && b.centre) continue;
      const recouvre = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left) > 2 && Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top) > 2;
      if (recouvre) problemes.push(`régions du HUD qui se chevauchent : ${a.nom} et ${b.nom}`);
    }
  }

  // Focus par défaut visible et dans sa zone.
  const actif = document.activeElement;
  let focus = '(le jeu)';
  if (actif && actif !== document.body) {
    focus = decrire(actif);
    const r = actif.getBoundingClientRect();
    const zone = ancetreDefilable(actif);
    const cadre = zone ? zone.getBoundingClientRect() : ecran;
    if (!dedans(r, cadre, 2)) problemes.push(`focus par défaut hors de la vue : ${focus}`);
  }
  return { problemes, minTexte, pireTexte, minBord, pireBord, focus };
}

// ---------- Parcours au clavier ----------
let verifications = 0;
let echecs = 0;
function verifier(condition, libelle, detail) {
  verifications += 1;
  if (!condition) echecs += 1;
  process.stdout.write(`  ${condition ? 'OK   ' : 'ÉCHEC'} ${libelle}${detail ? ` : ${detail}` : ''}\n`);
  return condition;
}

async function focusInfo(page) {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return { nom: '(aucun)', visible: false };
    const copie = el.cloneNode(true);
    copie.querySelectorAll('kbd, svg, [aria-hidden="true"]').forEach((x) => x.remove());
    const nom = (el.getAttribute('aria-label') || copie.textContent || el.value || '').replace(/[ \t\r\n]+/g, ' ').trim().slice(0, 60);
    const cs = getComputedStyle(el);
    return { nom, visible: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2 };
  });
}
const etat = (page) => page.evaluate(() => `${location.pathname.split('/').pop()}#${document.body.dataset.etat}`);
const attendre = (page, ms = 380) => page.waitForTimeout(ms);
async function ouvrir(page, fichier, e) {
  await page.goto('about:blank');
  await page.goto(adresse(fichier, e));
  await attendre(page);
}
async function touche(page, t) {
  await page.keyboard.press(t);
  await attendre(page);
}

async function parcours(navigateur, largeur, hauteur) {
  const contexte = await navigateur.newContext({ viewport: { width: largeur, height: hauteur } });
  const page = await contexte.newPage();
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  process.stdout.write(`\nParcours au clavier seul, ${largeur}x${hauteur}\n`);

  // 1. Du service à la tablette, puis sections, proposition, pause de Duo, fermeture.
  await ouvrir(page, 'hud.html', 'service');
  await touche(page, 'Tab');
  verifier(await etat(page) === 'tablette.html#accueil', 'Tab ouvre la tablette sur l’Accueil', await etat(page));
  let f = await focusInfo(page);
  verifier(f.nom === 'Répondre' && f.visible, 'focus par défaut visible sur « Répondre »', f.nom);
  await touche(page, 'KeyE');
  verifier(await etat(page) === 'tablette.html#commandes', 'E passe à la section suivante (Commandes)', await etat(page));
  f = await focusInfo(page);
  verifier(f.nom.startsWith('Commander pour demain') && f.visible, 'focus sur « Commander pour demain »', f.nom);
  await touche(page, 'ArrowUp');
  const apresFleche = await focusInfo(page);
  verifier(apresFleche.nom !== f.nom && apresFleche.visible, 'la flèche haut déplace le focus vers l’élément au-dessus', apresFleche.nom);
  await touche(page, 'KeyW');
  const apresZ = await focusInfo(page);
  verifier(apresZ.nom !== apresFleche.nom && apresZ.visible, 'Z (position KeyW) fait de même', apresZ.nom);
  await touche(page, 'KeyQ');
  verifier(await etat(page) === 'tablette.html#accueil', 'A (position KeyQ) revient à la section précédente', await etat(page));
  await touche(page, 'KeyE');
  await touche(page, 'KeyE');
  verifier(await etat(page) === 'tablette.html#catalogue', 'E deux fois : Catalogue', await etat(page));
  f = await focusInfo(page);
  verifier(f.nom === 'Proposer à Sacha' && f.visible, 'focus sur « Proposer à Sacha » (banquette)', f.nom);
  await touche(page, 'Enter');
  const fenetre = await page.evaluate(() => !!document.querySelector('#fenetre-proposer[open]'));
  f = await focusInfo(page);
  verifier(fenetre && f.nom === 'Proposer à Sacha', 'Entrée ouvre « Proposer l’achat à Sacha ? », focus sur l’action', f.nom);
  await touche(page, 'Escape');
  const pause = await page.evaluate(() => !!document.querySelector('dialog.duo-pause[open]') && !!document.querySelector('#fenetre-proposer[open]'));
  verifier(pause, 'Échap ouvre la pause de Duo, la fenêtre du jeu reste ouverte dessous');
  await touche(page, 'Enter');
  f = await focusInfo(page);
  const encore = await page.evaluate(() => !document.querySelector('dialog.duo-pause') && !!document.querySelector('#fenetre-proposer[open]'));
  verifier(encore && f.nom === 'Proposer à Sacha', 'Reprendre : la fenêtre est toujours là, le focus revient', f.nom);
  await touche(page, 'Tab');
  f = await focusInfo(page);
  verifier(f.nom === 'Annuler', 'Tab reste dans la fenêtre (Annuler)', f.nom);
  await touche(page, 'Tab');
  f = await focusInfo(page);
  verifier(f.nom === 'Proposer à Sacha', 'Tab boucle dans la fenêtre', f.nom);
  await touche(page, 'Backspace');
  f = await focusInfo(page);
  verifier(await etat(page) === 'tablette.html#catalogue' && f.nom === 'Proposer à Sacha', 'Retour arrière ferme la fenêtre, le focus revient au bouton', `${await etat(page)}, ${f.nom}`);
  await touche(page, 'Enter');
  await touche(page, 'Enter');
  verifier(await etat(page) === 'tablette.html#catalogue-attente', 'Entrée, Entrée : proposition envoyée', await etat(page));
  const enAttente = await page.evaluate(() => [...document.querySelectorAll('.article__etat')].some((p) => !p.closest('[hidden]') && p.textContent.includes('en attente de Sacha')));
  verifier(enAttente, 'la carte dit « Ta proposition · en attente de Sacha »');
  await touche(page, 'Escape');
  await touche(page, 'Enter');
  verifier(await etat(page) === 'tablette.html#catalogue-attente', 'après la pause de Duo, la tablette est toujours ouverte', await etat(page));
  await touche(page, 'Tab');
  verifier(await etat(page) === 'hud.html#service', 'Tab ferme la tablette', await etat(page));

  // 2. Anti-double-appui: un Entrée dans les 300 ms qui suivent l'arrivée est ignoré.
  await page.goto('about:blank');
  await page.goto(adresse('tablette.html', 'commandes'));
  await page.waitForTimeout(60);
  await page.keyboard.press('Enter');
  await attendre(page);
  verifier(await etat(page) === 'tablette.html#commandes', 'Entrée trop tôt après l’ouverture : ignoré', await etat(page));
  await touche(page, 'Enter');
  verifier(await etat(page) === 'tablette.html#commandes-envoyee', 'Entrée ensuite : commande envoyée', await etat(page));
  await page.keyboard.down('Enter');
  await page.keyboard.down('Enter');
  await page.keyboard.up('Enter');
  await attendre(page);
  verifier(await etat(page) === 'tablette.html#commandes', 'une touche maintenue n’active pas deux fois', await etat(page));

  // 3. Proposition reçue en jeu: elle ne vole pas le focus, Entrée l'ouvre.
  await ouvrir(page, 'hud.html', 'proposition');
  const libre = await page.evaluate(() => document.activeElement === document.body);
  verifier(libre, 'la carte de proposition ne prend pas le focus (Espace et E agissent dans le monde)');
  await touche(page, 'Enter');
  f = await focusInfo(page);
  verifier(await etat(page) === 'hud.html#proposition-ouverte' && f.nom === 'D’accord' && f.visible, 'Entrée ouvre la proposition, focus visible sur « D’accord »', f.nom);
  await touche(page, 'Tab');
  f = await focusInfo(page);
  verifier(f.nom === 'Pas maintenant', 'Tab : « Pas maintenant »', f.nom);
  await touche(page, 'Backspace');
  verifier(await etat(page) === 'hud.html#proposition', 'Retour arrière : répondre plus tard, la carte reste', await etat(page));
  await touche(page, 'Enter');
  await touche(page, 'Enter');
  verifier(await etat(page) === 'hud.html#service', 'Entrée, Entrée : d’accord, retour au service', await etat(page));

  // 4. Pause de Duo en jeu: le pointeur relâché se reprend d'un clic ou d'Entrée.
  await touche(page, 'Escape');
  verifier(await page.evaluate(() => !!document.querySelector('dialog.duo-pause[open]')), 'Échap en jeu : pause de Duo');
  await touche(page, 'Enter');
  verifier(await etat(page) === 'hud.html#reprendre', 'à la reprise : « Clique pour reprendre la souris »', await etat(page));
  await touche(page, 'Enter');
  verifier(await etat(page) === 'hud.html#service', 'Entrée reprend la souris, sans agir dans le café', await etat(page));
  await touche(page, 'Escape');
  await touche(page, 'Enter');
  await page.mouse.click(300, 300);
  await attendre(page);
  verifier(await etat(page) === 'hud.html#service', 'un clic reprend aussi la souris', await etat(page));

  // 5. Ardoise: écrire, changer un prix, pause, Tab qui boucle, fermeture.
  await ouvrir(page, 'ardoise.html', 'vide');
  f = await focusInfo(page);
  verifier(f.nom === 'Écrire' && f.visible, 'ardoise vide : focus sur « Écrire » (grand crème)', f.nom);
  await touche(page, 'ArrowDown');
  const ligne = await page.evaluate(() => document.activeElement.closest('.recette').querySelector('.recette__nom').textContent);
  verifier(ligne === 'Cappuccino', 'flèche bas : recette suivante', ligne);
  await ouvrir(page, 'ardoise.html', 'composer');
  await touche(page, 'ArrowRight');
  let nom = (await focusInfo(page)).nom;
  for (let i = 0; i < 6 && !nom.startsWith('Monter'); i += 1) {
    await touche(page, 'ArrowRight');
    nom = (await focusInfo(page)).nom;
  }
  verifier(nom.startsWith('Monter le prix'), 'flèche droite : de la liste des recettes aux prix de l’ardoise', nom);
  const avant = await page.evaluate(() => document.activeElement.parentElement.querySelector('output').textContent);
  await touche(page, 'Enter');
  const apres = await page.evaluate(() => document.activeElement.parentElement.querySelector('output').textContent);
  verifier(avant !== apres, 'Entrée sur « + » monte le prix de 10 centimes', `${avant} puis ${apres}`);
  await touche(page, 'Escape');
  await touche(page, 'Enter');
  f = await focusInfo(page);
  verifier(f.nom === nom, 'après la pause de Duo, le focus revient sur le même prix', f.nom);
  const sorties = [];
  for (let i = 0; i < 70; i += 1) {
    await page.keyboard.press('Tab');
    sorties.push(await page.evaluate(() => !!document.activeElement.closest('.ardoise-ecran')));
  }
  verifier(sorties.every(Boolean), 'Tab boucle dans l’ardoise sans en sortir (70 appuis)');
  await touche(page, 'Backspace');
  verifier(await etat(page) === 'hud.html#preparation', 'Retour arrière ferme l’ardoise', await etat(page));

  // 6. Bilan du soir: pages aux flèches et à A et E, bornes, fermeture.
  await ouvrir(page, 'bilan.html', 'livre');
  f = await focusInfo(page);
  verifier(f.nom.startsWith('Page suivante') && f.visible, 'bilan : focus sur « Page suivante »', f.nom);
  await touche(page, 'ArrowRight');
  verifier(await etat(page) === 'bilan.html#appris', 'flèche droite : page 2', await etat(page));
  await touche(page, 'KeyE');
  verifier(await etat(page) === 'bilan.html#chiffres', 'E : page 3', await etat(page));
  await touche(page, 'KeyQ');
  verifier(await etat(page) === 'bilan.html#appris', 'A : page 2', await etat(page));
  await touche(page, 'Enter');
  await touche(page, 'Enter');
  f = await focusInfo(page);
  verifier(await etat(page) === 'bilan.html#demain' && f.nom === 'Fermer le bilan', 'Entrée, Entrée : dernière page, focus sur « Fermer le bilan »', f.nom);
  await touche(page, 'ArrowRight');
  verifier(await etat(page) === 'bilan.html#demain', 'pas de page après la dernière', await etat(page));
  await touche(page, 'Backspace');
  verifier(await etat(page) === 'hud.html#fermeture', 'Retour arrière ferme le bilan', await etat(page));

  verifier(erreurs.length === 0, 'aucune erreur de script', erreurs.join(' | '));
  await contexte.close();
}

(async () => {
  const navigateur = await chromium.launch();
  let echecsMiseEnPage = 0;
  let total = 0;
  let minTexte = Infinity;
  let pireTexte = '';
  let minBord = Infinity;
  let pireBord = '';
  for (const [l, h, taille, libelle, options = {}] of AFFICHAGES) {
    const contexte = await navigateur.newContext({ viewport: { width: l, height: h } });
    const page = await contexte.newPage();
    let enDefaut = 0;
    for (const [fichier, etats] of Object.entries(ETATS)) {
      for (const e of etats) {
        await page.goto('about:blank');
        await page.goto(adresse(fichier, e, taille));
        if (options.police) await page.addStyleTag({ content: `* { font-family: "${options.police}", sans-serif !important; }` });
        if (options.pseudos) {
          await page.evaluate(() => {
            const longs = { Camille: 'Maximilien-Louis', Sacha: 'Gwendoline-Aimée' };
            const m = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            for (let n = m.nextNode(); n; n = m.nextNode()) n.textContent = n.textContent.replace(/Camille|Sacha/g, (x) => longs[x]);
          });
        }
        await page.waitForTimeout(options.police ? 260 : 140);
        const r = await page.evaluate(analyser);
        total += 1;
        if (r.minTexte < minTexte) {
          minTexte = r.minTexte;
          pireTexte = `${fichier}#${e} : ${r.pireTexte}`;
        }
        if (r.minBord < minBord) {
          minBord = r.minBord;
          pireBord = `${fichier}#${e} : ${r.pireBord}`;
        }
        if (r.problemes.length) {
          enDefaut += 1;
          echecsMiseEnPage += 1;
          process.stdout.write(`  ÉCHEC ${fichier}#${e} (${libelle})\n`);
          [...new Set(r.problemes)].slice(0, 6).forEach((p) => process.stdout.write(`        ${p}\n`));
        }
      }
    }
    const n = Object.values(ETATS).reduce((a, x) => a + x.length, 0);
    process.stdout.write(`${enDefaut === 0 ? 'OK   ' : 'ÉCHEC'} ${l}x${h} à ${taille} % (${libelle}) : ${n} états, ${enDefaut} en défaut\n`);
    await contexte.close();
  }
  process.stdout.write(`\nContraste du texte le plus faible : ${minTexte.toFixed(2)}:1 (${pireTexte})\n`);
  process.stdout.write(`Contraste de bord de commande le plus faible : ${minBord.toFixed(2)}:1 (${pireBord})\n`);
  process.stdout.write(`Mise en page : ${total} vérifications d'état, ${echecsMiseEnPage} en défaut\n`);

  await parcours(navigateur, 1280, 720);
  await parcours(navigateur, 1366, 768);
  await navigateur.close();
  process.stdout.write(`\nClavier : ${verifications} vérifications, ${echecs} en défaut\n`);
  process.exit(echecsMiseEnPage === 0 && echecs === 0 ? 0 : 1);
})().catch((e) => {
  process.stderr.write(`Erreur : ${e.stack || e.message}\n`);
  process.exit(2);
});
