'use strict';
/*
  Vérifie la mise en page des wireframes: aucun texte qui déborde, aucun défilement horizontal,
  pas de défilement vertical jusqu'à 1280x720, action par défaut visible en fenêtre sur petit écran,
  et contrastes WCAG AA calculés (texte 4,5:1, grand texte 3:1, bordures des commandes 3:1).
  Usage: node design/maquettes/plateforme-wireframes/verifier-mise-en-page.js
*/
const { chromium } = require('playwright');
const path = require('path');

const ICI = __dirname;
const ECRANS = [
  'premier-lancement.html#bienvenue', 'premier-lancement.html#profil', 'premier-lancement.html#reseau-macos',
  'premier-lancement.html#reseau-windows', 'premier-lancement.html#recherche', 'premier-lancement.html#trouve',
  'accueil.html#normal', 'accueil.html#invitation', 'accueil.html#absent', 'accueil.html#versions', 'accueil.html#nouveau',
  'bibliotheque.html',
  'salon-hote.html#rejoint', 'salon-hote.html#attente', 'salon-hote.html#decompte', 'salon-hote.html#chargement',
  'salon-invite.html#rejoint', 'salon-invite.html#nouveau-choix',
  'superposition.html#pause', 'superposition.html#deconnexion', 'superposition.html#reconnexion',
  'fin-de-partie.html#affrontement', 'fin-de-partie.html#cooperation',
  'historique.html#liste', 'historique.html#vide',
  'reglages.html#profil', 'reglages.html#son', 'reglages.html#affichage', 'reglages.html#touches',
  'reglages.html#reseau', 'reglages.html#apropos',
  'diagnostic.html#windows', 'diagnostic.html#macos'
];

// [largeur, hauteur, sans défilement vertical exigé, libellé]
const TAILLES = [
  [1920, 1080, true, 'plein écran Full HD'],
  [1366, 768, true, 'portable 1366x768 en plein écran'],
  [1280, 720, true, 'écran 1080p réglé à 150 %'],
  [1366, 689, false, 'portable 1366x768 en fenêtre agrandie'],
  [1280, 640, false, 'écran 1080p à 150 % en fenêtre agrandie'],
  [1093, 615, false, 'portable 1366x768 avec interface à 125 %']
];

// Analyse exécutée dans la page.
function analyser(sansDefilementVertical) {
  const problemes = [];
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  function visible(el) {
    if (el.closest('[hidden]')) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') return false;
    return el.getClientRects().length > 0;
  }
  function decrire(el) {
    const texte = (el.innerText || el.value || el.placeholder || '').replace(/\s+/g, ' ').trim().slice(0, 50);
    return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''} « ${texte} »`;
  }
  function couleur(chaine) {
    const m = chaine.match(/rgba?\(([^)]+)\)/);
    if (!m) return [0, 0, 0, 0];
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  }
  function melanger(dessus, dessous) {
    const a = dessus[3];
    return [0, 1, 2].map((i) => dessus[i] * a + dessous[i] * (1 - a)).concat(1);
  }
  function fond(el) {
    // Compose les fonds des ancêtres, du plus lointain au plus proche, sur du blanc.
    const chaine = [];
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) chaine.unshift(n);
    let c = [255, 255, 255, 1];
    for (const n of chaine) {
      const cs = getComputedStyle(n);
      // Les dégradés décoratifs (vignettes, décor du jeu) sont ignorés: seule la couleur unie compte.
      const b = couleur(cs.backgroundColor);
      if (b[3] > 0) c = melanger(b, c);
    }
    return c;
  }
  function luminance(c) {
    const v = c.slice(0, 3).map((x) => {
      const s = x / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  }
  function rapport(a, b) {
    const la = luminance(a);
    const lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  if (document.documentElement.scrollWidth > vw + 1) problemes.push(`défilement horizontal (${document.documentElement.scrollWidth} px pour ${vw})`);

  const contenu = document.querySelector('.contenu');
  if (sansDefilementVertical && contenu && contenu.scrollHeight > contenu.clientHeight + 1) {
    problemes.push(`défilement vertical de la zone principale (${contenu.scrollHeight} px pour ${contenu.clientHeight})`);
  }
  document.querySelectorAll('.panneau, .bandeau-invitation, dialog[open]').forEach((el) => {
    if (!visible(el)) return;
    const r = el.getBoundingClientRect();
    if (r.top < -1 || r.bottom > vh + 1 || r.left < -1 || r.right > vw + 1) problemes.push(`fenêtre hors de l'écran : ${decrire(el)}`);
  });

  // Textes qui débordent de leur boîte ou de l'écran.
  let minTexte = Infinity;
  let pireTexte = '';
  let minBordure = Infinity;
  let pireBordure = '';
  document.querySelectorAll('body *').forEach((el) => {
    if (!visible(el) || el.closest('svg') || el.closest('.visuellement-cache')) return;
    const cs = getComputedStyle(el);
    const aDuTexte = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    const r = el.getBoundingClientRect();
    if (aDuTexte || el.matches('button, input, select, kbd')) {
      if (r.right > vw + 1 || r.left < -1) problemes.push(`hors de l'écran : ${decrire(el)}`);
      const defilable = /(auto|scroll)/.test(cs.overflowX) || /(auto|scroll)/.test(cs.overflowY);
      if (cs.display !== 'inline' && !defilable && el.scrollWidth > el.clientWidth + 1 && el.tagName !== 'SELECT') {
        problemes.push(`texte plus large que sa boîte : ${decrire(el)} (${el.scrollWidth} > ${el.clientWidth})`);
      }
    }
    // Descendants qui sortent des cartes, boutons et puces.
    if (el.matches('.bloc, .carte-joueur, .carte-jeu, .bouton, .puce, .panneau, .bandeau-invitation, .notification, .tuile-choix, .option-liste, .fiche, .verif, .mini-joueur')) {
      el.querySelectorAll('*').forEach((d) => {
        if (!visible(d) || d.closest('svg') || d.closest('.defile')) return;
        const rd = d.getBoundingClientRect();
        if (rd.width === 0 || rd.height === 0) return;
        if (rd.left < r.left - 1 || rd.right > r.right + 1 || rd.top < r.top - 1 || rd.bottom > r.bottom + 1) {
          if (!d.classList.contains('coche-choix') && !d.classList.contains('badge')) problemes.push(`dépasse de ${decrire(el)} : ${decrire(d)}`);
        }
      });
    }
    // Contraste du texte.
    if (aDuTexte && !el.closest('[aria-hidden="true"].jeu')) {
      const desactive = el.closest('button:disabled, input:disabled, [aria-disabled="true"]');
      if (!desactive) {
        const avant = couleur(cs.color);
        const fondEl = fond(el);
        const texte = avant[3] < 1 ? melanger(avant, fondEl) : avant;
        const ratio = rapport(texte, fondEl);
        const taille = parseFloat(cs.fontSize);
        const grand = taille >= 24 || (taille >= 18.66 && Number(cs.fontWeight) >= 700);
        const seuil = grand ? 3 : 4.5;
        if (ratio < seuil) problemes.push(`contraste ${ratio.toFixed(2)}:1 < ${seuil}:1 : ${decrire(el)}`);
        if (ratio < minTexte) { minTexte = ratio; pireTexte = decrire(el); }
      }
    }
    // Contraste des bordures des commandes (WCAG 1.4.11).
    if (el.matches('button.bouton:not(.lien):not(:disabled), input[type="text"], select, .option-liste, .tuile-choix:not(:has(input:disabled))')) {
      const bord = couleur(cs.borderTopColor);
      const autour = fond(el.parentElement);
      const interieur = fond(el);
      const ratio = Math.max(rapport(bord, autour), rapport(interieur, autour));
      if (ratio < 3) problemes.push(`bordure peu visible ${ratio.toFixed(2)}:1 : ${decrire(el)}`);
      if (ratio < minBordure) { minBordure = ratio; pireBordure = decrire(el); }
    }
  });
  // Texte indicatif des champs.
  document.querySelectorAll('input[placeholder]').forEach((el) => {
    if (!visible(el)) return;
    const ratio = rapport(couleur(getComputedStyle(el, '::placeholder').color), fond(el));
    if (ratio < 4.5) problemes.push(`texte indicatif ${ratio.toFixed(2)}:1 : ${decrire(el)}`);
    if (ratio < minTexte) { minTexte = ratio; pireTexte = decrire(el) + ' (indicatif)'; }
  });

  // L'action par défaut reste visible sans défiler.
  const actif = document.activeElement;
  let focus = 'aucun';
  if (actif && actif !== document.body) {
    const r = actif.getBoundingClientRect();
    focus = decrire(actif);
    if (r.bottom > vh + 1 || r.top < -1) problemes.push(`action par défaut hors de la vue : ${focus}`);
  }
  return { problemes, minTexte, pireTexte, minBordure, pireBordure, focus };
}

(async () => {
  const navigateur = await chromium.launch();
  let echecs = 0;
  let verifications = 0;
  let minTexte = Infinity;
  let pireTexte = '';
  let minBordure = Infinity;
  let pireBordure = '';
  const passes = TAILLES.map(([l, h, v, libelle]) => ({ l, h, v, libelle, police: null }));
  // Test d'effort: police environ 10 % plus large que Segoe UI et SF Pro.
  passes.push({ l: 1366, h: 768, v: true, libelle: 'police large (DejaVu Sans), 1366x768', police: 'DejaVu Sans' });
  passes.push({ l: 1280, h: 720, v: true, libelle: 'police large (DejaVu Sans), 1280x720', police: 'DejaVu Sans' });

  for (const passe of passes) {
    const contexte = await navigateur.newContext({ viewport: { width: passe.l, height: passe.h } });
    let echecsPasse = 0;
    for (const cible of ECRANS) {
      const page = await contexte.newPage();
      const [fichier, etat] = cible.split('#');
      await page.goto('file://' + path.join(ICI, fichier) + (etat ? '#' + etat : ''));
      if (passe.police) await page.addStyleTag({ content: `* { font-family: "${passe.police}", sans-serif !important; }` });
      await page.waitForTimeout(passe.police ? 250 : 120);
      const r = await page.evaluate(analyser, passe.v);
      verifications += 1;
      if (r.minTexte < minTexte) { minTexte = r.minTexte; pireTexte = `${cible} : ${r.pireTexte}`; }
      if (r.minBordure < minBordure) { minBordure = r.minBordure; pireBordure = `${cible} : ${r.pireBordure}`; }
      if (r.problemes.length) {
        echecs += 1;
        echecsPasse += 1;
        process.stdout.write(`  ÉCHEC ${cible} (${passe.l}x${passe.h})\n`);
        r.problemes.slice(0, 8).forEach((p) => process.stdout.write(`        ${p}\n`));
      }
      await page.close();
    }
    process.stdout.write(`${echecsPasse === 0 ? 'OK   ' : 'ÉCHEC'} ${passe.l}x${passe.h} (${passe.libelle}) : ${ECRANS.length} écrans, ${echecsPasse} en défaut\n`);
    await contexte.close();
  }
  await navigateur.close();
  process.stdout.write(`\nContraste du texte le plus faible : ${minTexte.toFixed(2)}:1 (${pireTexte})\n`);
  process.stdout.write(`Contraste de bordure de commande le plus faible : ${minBordure.toFixed(2)}:1 (${pireBordure})\n`);
  process.stdout.write(`Résultat : ${verifications} vérifications d'écran, ${echecs} en défaut\n`);
  process.exit(echecs === 0 ? 0 : 1);
})().catch((e) => {
  process.stderr.write(`Erreur : ${e.message}\n`);
  process.exit(2);
});
