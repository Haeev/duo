'use strict';
/*
  Captures PNG des maquettes de l'interface en jeu et planche récapitulative.
  Usage, depuis la racine du dépôt: node games/la-petite-ligne/ui-maquettes/outils/capturer.cjs
  Sorties: captures/*.png et planche.png, dans games/la-petite-ligne/ui-maquettes/.

  - tous les états en 1366x768 (portable du PC de référence), l'état principal de chaque écran en 1920x1080;
  - taille de l'interface 125 et 150 % en 1366x768 pour les écrans principaux;
  - facteur d'échelle 2 (Retina, Windows à 200 %) pour deux écrans.
  Le format CommonJS (.cjs) est voulu: playwright est installé hors du dépôt, résolu par require.
*/
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const DOSSIER = path.join(RACINE, 'captures');

// [nom, page#état, légende]
const ECRANS = [
  ['titre', 'titre.html#accueil', 'Écran titre'],
  ['titre-attente', 'titre.html#attente', 'Écran titre, en attente de Sacha'],
  ['titre-reprise', 'titre.html#reprise', 'Écran titre, semaine enregistrée (P1)'],
  ['creation', 'creation.html#edition', 'Création du personnage'],
  ['creation-erreur', 'creation.html#erreur', 'Création, prénom vide'],
  ['creation-fini', 'creation.html#fini', 'Création finie la première: la lettre'],
  ['creation-prets', 'creation.html#prets', 'Création, les deux sont prêts'],
  ['petit-dejeuner', 'petit-dejeuner.html#matin', 'Petit-déjeuner'],
  [
    'petit-dejeuner-petite-forme',
    'petit-dejeuner.html#petite-forme',
    'Petit-déjeuner, petite forme',
  ],
  ['petit-dejeuner-parti', 'petit-dejeuner.html#parti', 'Petit-déjeuner, Sacha est parti'],
  ['hud-jour', 'hud.html#jour', 'HUD, une matinée'],
  ['hud-vide', 'hud.html#vide', 'HUD, premier jour, mains vides'],
  ['hud-pluie', 'hud.html#pluie', 'HUD, pluie et fatigue'],
  ['hud-veillee', 'hud.html#veillee', 'HUD, veillée (horloge arrêtée)'],
  ['hud-attente', 'hud.html#attente', 'HUD, l’horloge attend Sacha'],
  ['hud-fatigue', 'hud.html#fatigue', 'HUD, plus d’énergie'],
  ['hud-train', 'hud.html#train', 'HUD, samedi, le train part bientôt'],
  ['hud-notifications', 'hud.html#notifications', 'HUD, ligne de notifications'],
  ['dialogue-scene', 'dialogue.html#scene', 'Scène à deux, choix de la réplique'],
  ['dialogue-choix-autre', 'dialogue.html#choix-autre', 'Scène à deux, Sacha a choisi'],
  ['dialogue-attente', 'dialogue.html#attente', 'Scène à deux, en attente de Sacha'],
  ['dialogue-reponses', 'dialogue.html#reponses', 'Scène à deux, réponse aux deux choix'],
  ['dialogue-odette', 'dialogue.html#odette', 'Conversation avec Odette (comptoir)'],
  ['dialogue-basile', 'dialogue.html#basile', 'Réplique sans choix (Basile)'],
  ['dialogue-carte', 'dialogue.html#carte', 'La carte d’énigme'],
  ['carnet-sac', 'carnet.html#sac', 'Carnet, sac'],
  ['carnet-sac-plein', 'carnet.html#sac-plein', 'Carnet, sac plein'],
  ['carnet-sac-vide', 'carnet.html#sac-vide', 'Carnet, sac vide'],
  ['carnet-quetes', 'carnet.html#quetes', 'Carnet, quêtes'],
  ['carnet-courrier', 'carnet.html#courrier', 'Carnet, courrier'],
  ['caisse', 'caisse.html#caisse', 'Caisse de la coopérative'],
  ['caisse-vide', 'caisse.html#caisse-vide', 'Caisse, rien de déposé'],
  ['caisse-complete', 'caisse.html#complete', 'Caisse, commande complète'],
  ['caisse-tableau', 'caisse.html#tableau', 'Tableau de la halte, commande'],
  ['caisse-parti', 'caisse.html#parti', 'Caisse, le train est parti'],
  ['catalogue', 'catalogue.html#catalogue', 'Catalogue de la coopérative'],
  ['catalogue-attente', 'catalogue.html#attente', 'Catalogue, gros achat proposé'],
  ['catalogue-trop-cher', 'catalogue.html#trop-cher', 'Catalogue, bourse insuffisante'],
  ['catalogue-ferme', 'catalogue.html#ferme', 'Catalogue fermé'],
  ['catalogue-livre', 'catalogue.html#livre', 'Catalogue, colis livrés'],
  ['achat-recue', 'achat.html#recue', 'Gros achat, proposition reçue'],
  ['achat-envoyee', 'achat.html#envoyee', 'Gros achat, proposition envoyée'],
  ['achat-acceptee', 'achat.html#acceptee', 'Gros achat, accepté'],
  ['achat-refusee', 'achat.html#refusee', 'Gros achat, refusé'],
  ['achat-manque', 'achat.html#manque', 'Achat refusé, il manque des sous'],
  ['amenagement', 'amenagement.html#pose', 'Aménagement, le meuble peut se poser'],
  ['amenagement-bloque', 'amenagement.html#bloque', 'Aménagement, emplacement refusé'],
  ['amenagement-deja-pris', 'amenagement.html#deja-pris', 'Aménagement, meuble tenu par Sacha'],
  ['nuit', 'nuit.html#choix', 'Écran de nuit'],
  ['nuit-attente', 'nuit.html#attente', 'Nuit, en attente de Sacha'],
  ['nuit-desaccord', 'nuit.html#desaccord', 'Nuit, choix différents'],
  ['nuit-fin', 'nuit.html#fin', 'Nuit, fin de la séance'],
  ['fin', 'fin.html#complete', 'Fin de la démo'],
  ['fin-partielle', 'fin.html#partielle', 'Fin de la démo, commande partielle'],
  ['fin-attente', 'fin.html#attente', 'Fin de la démo, en attente de Sacha'],
];

const PRINCIPAUX = [
  'titre',
  'creation',
  'petit-dejeuner',
  'hud-jour',
  'hud-veillee',
  'dialogue-scene',
  'carnet-sac',
  'caisse',
  'catalogue',
  'achat-recue',
  'amenagement',
  'nuit',
  'fin',
];
const TAILLES_INTERFACE = [
  'hud-jour',
  'hud-notifications',
  'dialogue-scene',
  'carnet-sac',
  'caisse',
  'catalogue',
  'amenagement',
  'nuit',
  'creation',
];
const RETINA = ['hud-jour', 'carnet-sac'];

const PLANCHE = [
  'titre',
  'creation-fini',
  'petit-dejeuner',
  'hud-jour',
  'hud-veillee',
  'hud-notifications',
  'dialogue-choix-autre',
  'dialogue-odette',
  'carnet-sac',
  'carnet-quetes',
  'caisse',
  'catalogue-attente',
  'achat-recue',
  'amenagement',
  'nuit-desaccord',
  'fin',
];

function adresse(cible, taille) {
  const [fichier, etat] = cible.split('#');
  return (
    'file://' +
    path.join(RACINE, fichier) +
    (taille ? `?taille=${taille}` : '') +
    (etat ? '#' + etat : '')
  );
}

async function capturer(
  navigateur,
  nom,
  cible,
  largeur,
  hauteur,
  { facteur = 1, taille = 0 } = {},
) {
  const contexte = await navigateur.newContext({
    viewport: { width: largeur, height: hauteur },
    deviceScaleFactor: facteur,
  });
  const page = await contexte.newPage();
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') erreurs.push(m.text());
  });
  await page.goto(adresse(cible, taille));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(450);
  let suffixe = `${largeur}x${hauteur}`;
  if (taille) suffixe += `-${taille}`;
  if (facteur !== 1) suffixe += `@${facteur}x`;
  const fichier = path.join(DOSSIER, `${nom}-${suffixe}.png`);
  await page.screenshot({ path: fichier });
  await contexte.close();
  if (erreurs.length) throw new Error(`${nom}: ${erreurs.join(' | ')}`);
  return fichier;
}

async function planche(navigateur) {
  const legendes = new Map(ECRANS.map(([nom, , legende]) => [nom, legende]));
  const vignettes = PLANCHE.map(
    (nom) =>
      `<figure><img src="${nom}-1366x768.png" alt=""><figcaption>${legendes.get(nom)}</figcaption></figure>`,
  ).join('');
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
    <link rel="stylesheet" href="../support/polices.css"><style>
    body { margin: 0; padding: 36px 40px 40px; font-family: 'Nunito Sans Variable', system-ui, sans-serif; color: #2a2522; background: #f3ebd4; width: 2000px; }
    h1 { margin: 0; font: 600 38px/1.1 'Fraunces Variable', serif; font-variation-settings: 'SOFT' 100; }
    p { margin: 8px 0 26px; font-size: 19px; font-weight: 600; color: #5b4d40; }
    .grille { display: grid; grid-template-columns: repeat(4, 1fr); gap: 26px 24px; }
    figure { margin: 0; }
    img { width: 100%; display: block; border: 3px solid #5c3d24; border-radius: 8px; }
    figcaption { margin-top: 8px; font-size: 19px; font-weight: 750; }
  </style></head><body>
    <h1>La Petite Ligne · interface en jeu de la démo (maquettes v0.1)</h1>
    <p>Captures en 1366x768, taille de l’interface 100 %. Exemples : Camille (toi, astre aqua) et Sacha (croissant mauve). Scène provisoire : la vraie scène est en 3D. Détails dans games/la-petite-ligne/ui-maquettes/README.md.</p>
    <div class="grille">${vignettes}</div>
  </body></html>`;
  const source = path.join(DOSSIER, 'planche.html');
  fs.writeFileSync(source, html, 'utf8');
  const contexte = await navigateur.newContext({
    viewport: { width: 2080, height: 1200 },
    deviceScaleFactor: 1,
  });
  const page = await contexte.newPage();
  await page.goto('file://' + source);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(RACINE, 'planche.png'), fullPage: true });
  await contexte.close();
  fs.unlinkSync(source);
}

(async () => {
  fs.mkdirSync(DOSSIER, { recursive: true });
  for (const f of fs.readdirSync(DOSSIER))
    if (f.endsWith('.png')) fs.unlinkSync(path.join(DOSSIER, f));
  const navigateur = await chromium.launch();
  let total = 0;
  const cibleDe = (nom) => ECRANS.find((e) => e[0] === nom)[1];
  for (const [nom, cible] of ECRANS) {
    await capturer(navigateur, nom, cible, 1366, 768);
    total += 1;
  }
  for (const nom of PRINCIPAUX) {
    await capturer(navigateur, nom, cibleDe(nom), 1920, 1080);
    total += 1;
  }
  for (const nom of TAILLES_INTERFACE) {
    for (const taille of [125, 150]) {
      await capturer(navigateur, nom, cibleDe(nom), 1366, 768, { taille });
      total += 1;
    }
  }
  for (const nom of RETINA) {
    await capturer(navigateur, nom, cibleDe(nom), 1366, 768, { facteur: 2 });
    total += 1;
  }
  await planche(navigateur);
  await navigateur.close();
  process.stdout.write(`${total} captures et planche.png générées\n`);
})().catch((e) => {
  process.stderr.write(`Échec : ${e.message}\n`);
  process.exit(1);
});
