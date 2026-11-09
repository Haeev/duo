'use strict';
/*
  Captures PNG des maquettes de Cosy Café et planche récapitulative.
  - tous les états en 1366x768 (portable, facteur 1);
  - les états principaux en 1920x1080 (facteur 1), en 1366x768 au facteur 2 et en 1440x900 au facteur 2
    (MacBook Air M1, hypothèse);
  - quelques états avec l'interface de Duo à 150 % et en 911x512 (1366x768 à 150 % dans Windows).
  Usage, depuis la racine du dépôt: node design/maquettes/cosy-cafe/outils/capturer.cjs
  Noms: <page>-<état>-<largeur>x<hauteur>[-<taille>][@2x].png dans captures/, et planche.png.
*/
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ICI = path.join(__dirname, '..');
const DOSSIER = path.join(ICI, 'captures');

// [page, état, légende]
const ETATS = [
  ['hud', 'service', 'HUD en service : servir la table 3'],
  ['hud', 'rail', 'Rail à tickets : lire et prendre un ticket'],
  ['hud', 'caisse', 'Caisse : encaisser d’un geste'],
  ['hud', 'preparation', 'Préparation : retourner la pancarte'],
  ['hud', 'ouverture', 'Sacha propose d’ouvrir'],
  ['hud', 'ouverture-ouverte', 'Répondre : « On ouvre ! »'],
  ['hud', 'fermeture', 'Fermer à clé (maintien)'],
  ['hud', 'vide', 'Premier matin : mains vides, astuce'],
  ['hud', 'tasses', 'Plus de tasses propres'],
  ['hud', 'geste', 'Geste : mousser le lait (jauge)'],
  ['hud', 'geste-simplifie', 'Gestes simplifiés'],
  ['hud', 'proposition', 'Gros achat proposé par Sacha'],
  ['hud', 'proposition-ouverte', 'Répondre à la proposition'],
  ['hud', 'envoyee', 'Ta proposition attend Sacha'],
  ['hud', 'reprendre', 'Après la pause : reprendre la souris'],
  ['hud', 'absence', 'L’horloge attend Sacha'],
  ['hud', 'amenagement', 'Aménager : passage trop étroit'],
  ['hud', 'amenagement-ok', 'Aménager : peut se poser ici'],
  ['hud', 'amenagement-eau', 'Aménager : trop loin de l’eau'],
  ['hud', 'porter', 'Porter à deux'],
  ['tablette', 'accueil', 'Tablette : accueil'],
  ['tablette', 'commandes', 'Tablette : commandes'],
  ['tablette', 'commandes-envoyee', 'Commande envoyée'],
  ['tablette', 'catalogue', 'Tablette : catalogue'],
  ['tablette', 'catalogue-proposer', 'Proposer un gros achat'],
  ['tablette', 'catalogue-attente', 'Catalogue : propositions en attente'],
  ['tablette', 'carte', 'Tablette : carte et prix'],
  ['tablette', 'equipe', 'Équipe (vide au village)'],
  ['tablette', 'cafes', 'Nos cafés (un seul)'],
  ['tablette', 'bilans', 'Bilans'],
  ['tablette', 'projets', 'Nos projets'],
  ['tablette', 'reglages', 'Réglages pour toi'],
  ['ardoise', 'composer', 'Ardoise : composer la carte'],
  ['ardoise', 'vide', 'Ardoise vide'],
  ['ardoise', 'pleine', 'Ardoise pleine'],
  ['ardoise', 'ensemble', 'Ardoise à deux'],
  ['ardoise', 'service', 'Ardoise en service : épuisé'],
  ['bilan', 'livre', 'Bilan : le livre d’or d’abord'],
  ['bilan', 'livre-vide', 'Bilan : livre d’or vide'],
  ['bilan', 'premier', 'Bilan du premier soir'],
  ['bilan', 'appris', 'Bilan : ce qu’on retient'],
  ['bilan', 'chiffres', 'Bilan : les chiffres'],
  ['bilan', 'plusieurs', 'Bilan : nos autres cafés'],
  ['bilan', 'demain', 'Bilan : demain']
];
const PRINCIPAUX = ['hud-service', 'hud-rail', 'hud-geste', 'hud-proposition', 'hud-reprendre', 'hud-amenagement', 'tablette-accueil', 'tablette-commandes', 'tablette-catalogue-attente', 'tablette-reglages', 'ardoise-composer', 'ardoise-ensemble', 'bilan-livre', 'bilan-chiffres', 'bilan-demain'];
const GRANDE_TAILLE = ['hud-service', 'hud-rail', 'hud-amenagement', 'tablette-commandes', 'ardoise-composer', 'bilan-livre'];
const PLANCHE = ['hud-service', 'hud-rail', 'hud-caisse', 'hud-geste', 'hud-proposition', 'hud-proposition-ouverte', 'hud-reprendre', 'hud-amenagement', 'hud-porter', 'tablette-accueil', 'tablette-commandes', 'tablette-catalogue-attente', 'tablette-reglages', 'ardoise-composer', 'ardoise-ensemble', 'bilan-livre', 'bilan-appris', 'bilan-chiffres', 'bilan-demain', 'hud-vide'];

function adresse(page, etat, taille) {
  return `file://${path.join(ICI, `${page}.html`)}${taille ? `?taille=${taille}` : ''}#${etat}`;
}

async function lot(navigateur, largeur, hauteur, facteur, taille, noms) {
  const contexte = await navigateur.newContext({ viewport: { width: largeur, height: hauteur }, deviceScaleFactor: facteur });
  const page = await contexte.newPage();
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  const produits = [];
  for (const nom of noms) {
    const [p, ...reste] = nom.split('-');
    const etat = reste.join('-');
    await page.goto('about:blank');
    await page.goto(adresse(p, etat, taille));
    await page.waitForTimeout(450);
    const suffixe = `${largeur}x${hauteur}${taille ? `-${taille}` : ''}${facteur === 2 ? '@2x' : ''}`;
    const fichier = path.join(DOSSIER, `${nom}-${suffixe}.png`);
    await page.screenshot({ path: fichier });
    produits.push(fichier);
  }
  await contexte.close();
  if (erreurs.length) throw new Error(erreurs.join(' | '));
  return produits;
}

async function planche(navigateur) {
  const legendes = new Map(ETATS.map(([p, e, l]) => [`${p}-${e}`, l]));
  const vignettes = PLANCHE.map((nom) => `<figure><img src="${nom}-1366x768.png" alt=""><figcaption>${legendes.get(nom)}</figcaption></figure>`).join('');
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>
    body { margin: 0; padding: 36px 40px 40px; font-family: system-ui, sans-serif; color: #111; background: #fff; width: 2400px; }
    h1 { margin: 0; font-size: 34px; }
    p { margin: 8px 0 26px; font-size: 19px; color: #333; }
    .grille { display: grid; grid-template-columns: repeat(4, 1fr); gap: 26px 24px; }
    figure { margin: 0; }
    img { width: 100%; display: block; border: 2px solid #111; border-radius: 6px; }
    figcaption { margin-top: 8px; font-size: 19px; font-weight: 700; }
  </style></head><body>
    <h1>Cosy Café · maquettes basse fidélité de l’interface en jeu (v0.1, 7 novembre 2026)</h1>
    <p>Gris et polices du système : le style final appartient à la bible artistique. Seules couleurs : les profils Duo des deux joueurs, toujours avec leur symbole. Camille (toi) et Sacha sont des exemples. Détails : docs/jeux/cosy-cafe/ux.md.</p>
    <div class="grille">${vignettes}</div>
  </body></html>`;
  const source = path.join(DOSSIER, 'planche.html');
  fs.writeFileSync(source, html, 'utf8');
  const contexte = await navigateur.newContext({ viewport: { width: 2480, height: 1400 }, deviceScaleFactor: 1 });
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
  const tous = ETATS.map(([p, e]) => `${p}-${e}`);
  const produits = [];
  // Lots de taille raisonnable: un navigateur Playwright supporte mal des dizaines de contextes à la suite.
  for (let i = 0; i < tous.length; i += 15) produits.push(...(await lot(navigateur, 1366, 768, 1, null, tous.slice(i, i + 15))));
  produits.push(...(await lot(navigateur, 1920, 1080, 1, null, PRINCIPAUX)));
  produits.push(...(await lot(navigateur, 1366, 768, 2, null, PRINCIPAUX.slice(0, 8))));
  produits.push(...(await lot(navigateur, 1366, 768, 2, null, PRINCIPAUX.slice(8))));
  produits.push(...(await lot(navigateur, 1440, 900, 2, null, ['hud-service', 'tablette-commandes', 'bilan-livre'])));
  produits.push(...(await lot(navigateur, 1366, 768, 1, 150, GRANDE_TAILLE)));
  produits.push(...(await lot(navigateur, 911, 512, 1, null, GRANDE_TAILLE)));
  await planche(navigateur);
  await navigateur.close();
  process.stdout.write(`${produits.length} captures et planche.png générées dans ${path.relative(process.cwd(), ICI)}\n`);
})().catch((e) => {
  process.stderr.write(`Échec : ${e.message}\n`);
  process.exit(1);
});
