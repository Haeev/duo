'use strict';
/*
  Génère les captures PNG des wireframes et la planche récapitulative.
  Usage: node design/maquettes/plateforme-wireframes/capturer.js
  Sorties: captures/*.png et planche.png, à côté de ce script.
*/
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ICI = __dirname;
const DOSSIER = path.join(ICI, 'captures');

// [nom du fichier, écran#état, légende]
const ECRANS = [
  ['premier-lancement-bienvenue', 'premier-lancement.html#bienvenue', 'E01 Bienvenue'],
  ['premier-lancement-profil', 'premier-lancement.html#profil', 'E02 Profil'],
  ['premier-lancement-reseau-macos', 'premier-lancement.html#reseau-macos', 'E03 Autorisation réseau, macOS'],
  ['premier-lancement-reseau-windows', 'premier-lancement.html#reseau-windows', 'E03 Autorisation réseau, Windows'],
  ['premier-lancement-recherche', 'premier-lancement.html#recherche', 'E04 Recherche de l’autre ordinateur'],
  ['premier-lancement-trouve', 'premier-lancement.html#trouve', 'E04 L’autre ordinateur est trouvé'],
  ['accueil', 'accueil.html#normal', 'E05 Accueil (vu par Camille)'],
  ['accueil-invitation', 'accueil.html#invitation', 'E06 Invitation reçue (vu par Sacha)'],
  ['accueil-absent', 'accueil.html#absent', 'E05 Accueil, Sacha n’est pas visible'],
  ['accueil-versions', 'accueil.html#versions', 'E18 Accueil, versions de Duo différentes'],
  ['accueil-nouveau-jeu', 'accueil.html#nouveau', 'E19 Notification de nouveau jeu'],
  ['bibliotheque', 'bibliotheque.html', 'E07 Bibliothèque et fiche du jeu'],
  ['salon-hote', 'salon-hote.html#rejoint', 'E08 Salon, côté hôte (Camille)'],
  ['salon-hote-attente', 'salon-hote.html#attente', 'E08 Salon, en attente de Sacha'],
  ['salon-hote-decompte', 'salon-hote.html#decompte', 'E08 Compte à rebours'],
  ['salon-hote-chargement', 'salon-hote.html#chargement', 'E09 Chargement'],
  ['salon-invite', 'salon-invite.html#rejoint', 'E08 Salon, côté invité (Sacha)'],
  ['salon-invite-nouveau-choix', 'salon-invite.html#nouveau-choix', 'E08 Invité, sauvegarde changée'],
  ['superposition-pause', 'superposition.html#pause', 'E11 Pause'],
  ['superposition-deconnexion', 'superposition.html#deconnexion', 'E12 Connexion perdue'],
  ['superposition-reconnexion', 'superposition.html#reconnexion', 'E12 Retour après la coupure'],
  ['fin-de-partie', 'fin-de-partie.html#affrontement', 'E14 Fin de partie, affrontement'],
  ['fin-de-partie-cooperation', 'fin-de-partie.html#cooperation', 'E14 Fin de partie, coopération'],
  ['historique', 'historique.html#liste', 'E15 Historique et scores'],
  ['historique-vide', 'historique.html#vide', 'E15 Historique vide'],
  ['reglages-profil', 'reglages.html#profil', 'E16 Réglages, profil'],
  ['reglages-affichage', 'reglages.html#affichage', 'E16 Réglages, affichage'],
  ['reglages-touches', 'reglages.html#touches', 'E16 Réglages, touches'],
  ['diagnostic-windows', 'diagnostic.html#windows', 'E17 Diagnostic, Windows'],
  ['diagnostic-macos', 'diagnostic.html#macos', 'E17 Diagnostic, macOS']
];

// Petits écrans: portable 1366x768, et Mac Retina vu comme 1280x720 au facteur 2.
const PETITS = ['accueil', 'accueil-invitation', 'salon-hote', 'salon-invite'];
const RETINA = ['accueil', 'salon-hote'];

// Écrans de la planche, dans l'ordre du parcours.
const PLANCHE = [
  'premier-lancement-profil', 'premier-lancement-reseau-macos', 'premier-lancement-reseau-windows', 'premier-lancement-trouve',
  'accueil', 'accueil-invitation', 'bibliotheque', 'salon-hote',
  'salon-invite', 'salon-hote-decompte', 'superposition-pause', 'superposition-deconnexion',
  'fin-de-partie', 'historique', 'reglages-touches', 'diagnostic-windows',
  'accueil-versions', 'accueil-absent', 'fin-de-partie-cooperation', 'reglages-profil'
];

function adresse(cible) {
  const [fichier, etat] = cible.split('#');
  return 'file://' + path.join(ICI, fichier) + (etat ? '#' + etat : '');
}

async function capturer(navigateur, nom, cible, largeur, hauteur, facteur) {
  const contexte = await navigateur.newContext({ viewport: { width: largeur, height: hauteur }, deviceScaleFactor: facteur });
  const page = await contexte.newPage();
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await page.goto(adresse(cible));
  await page.waitForTimeout(450);
  const suffixe = facteur === 1 ? `${largeur}x${hauteur}` : `${largeur}x${hauteur}@${facteur}x`;
  const fichier = path.join(DOSSIER, `${nom}-${suffixe}.png`);
  await page.screenshot({ path: fichier });
  await contexte.close();
  if (erreurs.length) throw new Error(`${nom}: ${erreurs.join(' | ')}`);
  return path.relative(ICI, fichier);
}

async function planche(navigateur) {
  const legendes = new Map(ECRANS.map(([nom, , legende]) => [nom, legende]));
  const vignettes = PLANCHE.map((nom) => `
    <figure><img src="${nom}-1920x1080.png" alt=""><figcaption>${legendes.get(nom)}</figcaption></figure>`).join('');
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>
    body { margin: 0; padding: 36px 40px 40px; font-family: system-ui, sans-serif; color: #111; background: #fff; width: 2000px; }
    h1 { margin: 0; font-size: 34px; }
    p { margin: 8px 0 26px; font-size: 18px; color: #3d3d3d; }
    .grille { display: grid; grid-template-columns: repeat(4, 1fr); gap: 26px 24px; }
    figure { margin: 0; }
    img { width: 100%; display: block; border: 2px solid #111; border-radius: 6px; }
    figcaption { margin-top: 8px; font-size: 18px; font-weight: 700; }
  </style></head><body>
    <h1>Duo · wireframes basse fidélité de la plateforme (v0.1, 30 octobre 2026)</h1>
    <p>Niveaux de gris et polices du système, sans identité visuelle. Textes réels, tutoiement provisoire. Exemples : Camille sur le Mac, Sacha sur le PC. Détails dans docs/plateforme/ux/parcours.md.</p>
    <div class="grille">${vignettes}</div>
  </body></html>`;
  const source = path.join(DOSSIER, 'planche.html');
  fs.writeFileSync(source, html, 'utf8');
  const contexte = await navigateur.newContext({ viewport: { width: 2080, height: 1200 }, deviceScaleFactor: 1 });
  const page = await contexte.newPage();
  await page.goto('file://' + source);
  await page.waitForLoadState('load');
  await page.screenshot({ path: path.join(ICI, 'planche.png'), fullPage: true });
  await contexte.close();
  fs.unlinkSync(source);
}

(async () => {
  fs.mkdirSync(DOSSIER, { recursive: true });
  const navigateur = await chromium.launch();
  const produits = [];
  for (const [nom, cible] of ECRANS) produits.push(await capturer(navigateur, nom, cible, 1920, 1080, 1));
  for (const nom of PETITS) {
    const cible = ECRANS.find((e) => e[0] === nom)[1];
    produits.push(await capturer(navigateur, nom, cible, 1366, 768, 1));
  }
  for (const nom of RETINA) {
    const cible = ECRANS.find((e) => e[0] === nom)[1];
    produits.push(await capturer(navigateur, nom, cible, 1280, 720, 2));
  }
  await planche(navigateur);
  await navigateur.close();
  process.stdout.write(`${produits.length} captures et planche.png générées\n`);
})().catch((e) => {
  process.stderr.write(`Échec : ${e.message}\n`);
  process.exit(1);
});
