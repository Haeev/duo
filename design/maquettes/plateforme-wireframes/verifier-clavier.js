'use strict';
/*
  Prouve qu'on parcourt l'accueil et le salon au clavier seul (Tab, Maj+Tab, Entrée, Échap, flèches),
  avec un focus toujours visible, et compte les actions: l'hôte lance en 3, l'invité rejoint en 1.
  Usage: node design/maquettes/plateforme-wireframes/verifier-clavier.js
  Code de sortie: 0 si tout passe, 1 sinon.
*/
const { chromium } = require('playwright');
const path = require('path');

const ICI = __dirname;
const LARGEUR = 1280;
const HAUTEUR = 720;
// Les wireframes ignorent Entrée pendant 300 ms après un changement d'écran (anti-double-appui).
const PAUSE_APRES_ECRAN = 350;

let verifications = 0;
let echecs = 0;

function verifier(condition, libelle, detail) {
  verifications += 1;
  if (!condition) echecs += 1;
  process.stdout.write(`  ${condition ? 'OK   ' : 'ÉCHEC'} ${libelle}${detail ? ` : ${detail}` : ''}\n`);
  return condition;
}
function titre(texte) {
  process.stdout.write(`\n${texte}\n`);
}
function adresse(cible) {
  const [fichier, etat] = cible.split('#');
  return 'file://' + path.join(ICI, fichier) + (etat ? '#' + etat : '');
}
function fichierCourant(page) {
  const url = new URL(page.url());
  return path.basename(url.pathname) + url.hash;
}

// Nom lisible de l'élément qui a le focus, et visibilité de son focus.
async function focus(page) {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return { nom: '(aucun)', visible: false, element: false };
    let nom = el.getAttribute('aria-label') || '';
    if (!nom) {
      if (el.tagName === 'INPUT' || el.tagName === 'SELECT') {
        const etiquette = el.closest('label') || (el.id && document.querySelector(`label[for="${el.id}"]`));
        nom = etiquette ? etiquette.innerText : el.value;
        if (el.tagName === 'SELECT') nom = `${nom.split('\n')[0]} (liste)`;
      } else {
        const copie = el.cloneNode(true);
        copie.querySelectorAll('kbd, .visuellement-cache, svg, [aria-hidden="true"]').forEach((n) => n.remove());
        nom = copie.textContent;
      }
    }
    nom = nom.replace(/[ \t\r\n]+/g, ' ').trim().slice(0, 60);
    // Pour une case ou un bouton radio masqué, l'anneau est porté par l'étiquette.
    const porteur = (el.matches('input[type="radio"], input[type="checkbox"]') && getComputedStyle(el).opacity === '0') ? el.closest('label') : el;
    const cs = getComputedStyle(porteur);
    const anneau = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2;
    return { nom, visible: anneau, element: true };
  });
}

// Parcourt la page avec Tab jusqu'à revenir au point de départ.
async function parcoursTab(page, maximum) {
  const depart = await page.evaluate(() => {
    document.querySelectorAll('[data-verif]').forEach((e) => e.removeAttribute('data-verif'));
    const visible = (el) => !el.closest('[hidden]') && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
    const candidats = [...document.querySelectorAll('button, a[href], input, select, textarea, [tabindex]')]
      .filter((el) => visible(el) && !el.disabled && el.tabIndex >= 0)
      .filter((el) => !(el.type === 'radio' && !el.checked && document.querySelector(`input[type="radio"][name="${el.name}"]:checked`)));
    candidats.forEach((el, i) => el.setAttribute('data-verif', String(i)));
    return { attendus: candidats.length, debut: document.activeElement ? document.activeElement.getAttribute('data-verif') : null };
  });
  const arrets = [];
  const vus = new Set();
  let sansFocusVisible = [];
  for (let i = 0; i < maximum; i += 1) {
    await page.keyboard.press('Tab');
    const k = await page.evaluate(() => (document.activeElement ? document.activeElement.getAttribute('data-verif') : null));
    if (k === null) continue;
    if (vus.has(k)) break;
    vus.add(k);
    const f = await focus(page);
    arrets.push(f.nom);
    if (!f.visible) sansFocusVisible.push(f.nom);
  }
  return { arrets, attendus: depart.attendus, sansFocusVisible };
}

async function ouvrir(page, cible) {
  await page.goto('about:blank');
  await page.goto(adresse(cible));
  await page.waitForTimeout(PAUSE_APRES_ECRAN);
}

async function nouvellePage(navigateur, cible) {
  const contexte = await navigateur.newContext({ viewport: { width: LARGEUR, height: HAUTEUR } });
  const page = await contexte.newPage();
  await page.goto(adresse(cible));
  await page.waitForTimeout(PAUSE_APRES_ECRAN);
  return { page, contexte };
}

async function appuyer(page, touche, attendreEcran) {
  if (attendreEcran) {
    await Promise.all([page.waitForEvent('load'), page.keyboard.press(touche)]);
    await page.waitForTimeout(PAUSE_APRES_ECRAN);
  } else {
    await page.keyboard.press(touche);
    await page.waitForTimeout(120);
  }
}

async function texte(page, selecteur) {
  return page.evaluate((s) => {
    const el = document.querySelector(s);
    return el ? el.textContent.replace(/[ \t\r\n]+/g, ' ').trim() : null;
  }, selecteur);
}
async function estVisible(page, selecteur) {
  return page.evaluate((s) => {
    const el = document.querySelector(s);
    return !!el && !el.hidden && !el.closest('[hidden]') && el.getClientRects().length > 0;
  }, selecteur);
}

(async () => {
  const navigateur = await chromium.launch();
  process.stdout.write(`Vérification au clavier seul des wireframes de Duo (fenêtre ${LARGEUR}x${HAUTEUR})\n`);

  // 1. Accueil
  titre('Accueil, vu par Camille (accueil.html)');
  {
    const { page, contexte } = await nouvellePage(navigateur, 'accueil.html#normal');
    let f = await focus(page);
    verifier(f.nom === 'Héberger une partie' && f.visible, 'focus par défaut, visible', `« ${f.nom} »`);
    const t = await parcoursTab(page, 40);
    verifier(t.arrets.length === t.attendus, `Tab atteint chaque élément actif une fois (${t.arrets.length} sur ${t.attendus})`, t.arrets.join(' > '));
    verifier(t.sansFocusVisible.length === 0, 'focus visible sur chaque arrêt', t.sansFocusVisible.join(', ') || 'aucun arrêt sans anneau');
    await ouvrir(page, 'accueil.html#normal');
    await appuyer(page, 'Shift+Tab');
    f = await focus(page);
    verifier(f.nom === 'Réglages', 'Maj+Tab revient en arrière', `« ${f.nom} »`);
    const avant = fichierCourant(page);
    await appuyer(page, 'Escape');
    verifier(fichierCourant(page) === avant, 'Échap sans effet sur l’accueil', fichierCourant(page));
    await contexte.close();
  }

  // 2. Parcours de l'hôte: trois appuis sur Entrée, sans Tab.
  titre('Hôte : lancer une partie depuis l’accueil, Entrée seulement');
  {
    const { page, contexte } = await nouvellePage(navigateur, 'accueil.html#normal');
    let actions = 0;
    await appuyer(page, 'Enter', true); actions += 1;
    let f = await focus(page);
    verifier(fichierCourant(page) === 'bibliotheque.html', 'action 1, Entrée sur « Héberger une partie » : bibliothèque', `focus sur « ${f.nom} »`);
    await appuyer(page, 'Enter', true); actions += 1;
    f = await focus(page);
    verifier(fichierCourant(page) === 'salon-hote.html#attente', 'action 2, Entrée sur le jeu : salon ouvert, invitation envoyée', `focus sur « ${f.nom} »`);
    await appuyer(page, 'Enter'); actions += 1;
    verifier(await texte(page, '#puce-moi') === 'C’est parti', 'action 3, Entrée sur « C’est parti ! » : puce de Camille à « C’est parti »');
    await page.waitForTimeout(1700);
    verifier(await estVisible(page, '#zone-decompte'), 'Sacha rejoint (simulé) : compte à rebours sans autre action', await texte(page, '#zone-decompte p'));
    await page.waitForTimeout(3200);
    verifier(await estVisible(page, '#zone-chargement'), 'fin du compte à rebours : chargement du jeu', await texte(page, '#zone-chargement h1'));
    verifier(actions <= 3, `nombre d'actions de l'hôte : ${actions} (critère : 3 au plus)`);
    await contexte.close();
  }

  // 3. Choix d'un autre jeu aux flèches dans la bibliothèque (déplacement, pas une action).
  titre('Bibliothèque : choisir un autre jeu aux flèches');
  {
    const { page, contexte } = await nouvellePage(navigateur, 'bibliotheque.html');
    await appuyer(page, 'ArrowRight');
    const f = await focus(page);
    const fiche = await page.evaluate(() => [...document.querySelectorAll('[data-fiche]')].filter((x) => !x.hidden).map((x) => x.querySelector('h2').textContent).join());
    verifier(f.nom.includes('Jeu témoin') && fiche === 'Jeu témoin', 'Flèche droite : focus et fiche sur « Jeu témoin »', `fiche « ${fiche} »`);
    await appuyer(page, 'Escape', true);
    verifier(fichierCourant(page) === 'accueil.html', 'Échap : retour à l’accueil', fichierCourant(page));
    await contexte.close();
  }

  // 4. Salon côté hôte
  titre('Salon côté hôte, Sacha a rejoint (salon-hote.html)');
  {
    const { page, contexte } = await nouvellePage(navigateur, 'salon-hote.html#rejoint');
    let f = await focus(page);
    verifier(f.nom === 'C’est parti !' && f.visible, 'focus par défaut, visible', `« ${f.nom} »`);
    const t = await parcoursTab(page, 40);
    verifier(t.arrets.length === t.attendus, `Tab atteint chaque élément actif une fois (${t.arrets.length} sur ${t.attendus})`, t.arrets.join(' > '));
    verifier(t.sansFocusVisible.length === 0, 'focus visible sur chaque arrêt', t.sansFocusVisible.join(', ') || 'aucun arrêt sans anneau');

    // Sauvegarde: Tab jusqu'au groupe, flèche bas.
    await ouvrir(page, 'salon-hote.html#rejoint');
    for (let i = 0; i < 10; i += 1) {
      f = await focus(page);
      if (f.nom.startsWith('Continuer')) break;
      await appuyer(page, 'Tab');
    }
    verifier(f.nom.startsWith('Continuer'), 'Tab entre dans le choix de sauvegarde sur la sauvegarde choisie', `« ${f.nom} »`);
    await appuyer(page, 'ArrowDown');
    f = await focus(page);
    const puces = `${await texte(page, '#puce-moi')} / ${await texte(page, '#puce-autre')}`;
    verifier(f.nom.startsWith('Niveau 1') && puces === 'Pas encore / Pas encore', 'Flèche bas : « Niveau 1 » choisi, les deux puces reviennent à « Pas encore »', puces);
    verifier((await texte(page, '#notification [data-texte]')) === 'Nouveau choix envoyé à Sacha.', 'notification à l’hôte', await texte(page, '#notification [data-texte]'));

    // Échap: fenêtre de confirmation, focus piégé, retour du focus.
    await appuyer(page, 'Escape');
    await page.waitForTimeout(PAUSE_APRES_ECRAN);
    f = await focus(page);
    const ouverte = await estVisible(page, '#fenetre-fermer');
    verifier(ouverte && f.nom === 'Rester', 'Échap : « Fermer le salon ? », focus sur le choix sûr', `« ${f.nom} »`);
    await appuyer(page, 'Tab');
    const f1 = await focus(page);
    await appuyer(page, 'Tab');
    const f2 = await focus(page);
    verifier(f1.nom === 'Fermer le salon' && f2.nom === 'Rester', 'Tab boucle dans la fenêtre', `${f1.nom} > ${f2.nom}`);
    await appuyer(page, 'Escape');
    f = await focus(page);
    verifier(!(await estVisible(page, '#fenetre-fermer')) && f.nom.startsWith('Niveau 1'), 'Échap ferme la fenêtre, le focus revient où il était', `« ${f.nom} »`);

    // Compte à rebours annulé par Échap.
    await ouvrir(page, 'salon-hote.html#rejoint');
    await appuyer(page, 'Enter');
    f = await focus(page);
    verifier(await estVisible(page, '#zone-decompte') && f.nom === 'Pas encore', 'Entrée sur « C’est parti ! » : compte à rebours, focus sur « Pas encore »', `« ${f.nom} »`);
    await appuyer(page, 'Escape');
    f = await focus(page);
    verifier(!(await estVisible(page, '#zone-decompte')) && (await texte(page, '#puce-moi')) === 'Pas encore' && f.nom === 'C’est parti !', 'Échap annule le compte à rebours', `puce « ${await texte(page, '#puce-moi')} », focus « ${f.nom} »`);

    // Fermer le salon au clavier.
    await appuyer(page, 'Escape');
    await page.waitForTimeout(PAUSE_APRES_ECRAN);
    await appuyer(page, 'Tab');
    await appuyer(page, 'Enter', true);
    verifier(fichierCourant(page) === 'accueil.html', 'Échap, Tab, Entrée sur « Fermer le salon » : retour à l’accueil', fichierCourant(page));
    await contexte.close();
  }

  // 5. Invité: une seule action depuis l'invitation.
  titre('Invité : rejoindre depuis l’invitation (accueil.html#invitation, vu par Sacha)');
  {
    const { page, contexte } = await nouvellePage(navigateur, 'accueil.html#invitation');
    let f = await focus(page);
    verifier(f.nom === 'Rejoindre' && f.visible, 'le bandeau d’invitation prend le focus sur « Rejoindre »', `« ${f.nom} »`);
    let actions = 0;
    await appuyer(page, 'Enter', true); actions += 1;
    const dansLeSalon = fichierCourant(page) === 'salon-invite.html' && (await texte(page, '#puce-moi')) === 'C’est parti';
    verifier(dansLeSalon, 'action 1, Entrée : salon, puce de Sacha à « C’est parti »', fichierCourant(page));
    verifier(dansLeSalon && actions === 1, `nombre d’actions de l’invité : ${actions} (critère : 1)`);
    await contexte.close();
  }
  {
    // Anti-double-appui: un second Entrée trop rapide ne défait pas « C'est parti ».
    const { page, contexte } = await nouvellePage(navigateur, 'accueil.html#invitation');
    await Promise.all([page.waitForEvent('load'), page.keyboard.press('Enter')]);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    verifier((await texte(page, '#puce-moi')) === 'C’est parti', 'double Entrée rapide : la puce reste à « C’est parti » (anti-double-appui)');
    await contexte.close();
  }
  {
    // Plus tard: Échap met l'invitation de côté, elle reste dans le bloc Rejoindre.
    const { page, contexte } = await nouvellePage(navigateur, 'accueil.html#invitation');
    await appuyer(page, 'Escape');
    const f = await focus(page);
    verifier(!(await estVisible(page, '#bandeau')) && f.nom === 'Rejoindre', 'Échap : bandeau fermé, focus sur « Rejoindre » du bloc Rejoindre', `« ${f.nom} »`);
    await appuyer(page, 'Enter', true);
    verifier(fichierCourant(page) === 'salon-invite.html', 'Entrée : salon de Camille', fichierCourant(page));
    await contexte.close();
  }

  // 6. Salon côté invité
  titre('Salon côté invité (salon-invite.html)');
  {
    const { page, contexte } = await nouvellePage(navigateur, 'salon-invite.html#rejoint');
    let f = await focus(page);
    verifier(f.nom === 'Pas encore' && f.visible, 'focus par défaut, visible', `« ${f.nom} »`);
    const t = await parcoursTab(page, 40);
    verifier(t.arrets.length === t.attendus, `Tab atteint chaque élément actif une fois (${t.arrets.length} sur ${t.attendus})`, t.arrets.join(' > '));
    verifier(t.sansFocusVisible.length === 0, 'focus visible sur chaque arrêt', t.sansFocusVisible.join(', ') || 'aucun arrêt sans anneau');
    await ouvrir(page, 'salon-invite.html#rejoint');
    await appuyer(page, 'Enter');
    verifier((await texte(page, '#puce-moi')) === 'Pas encore', 'Entrée sur « Pas encore » : la puce de Sacha bascule');
    await appuyer(page, 'Enter');
    verifier((await texte(page, '#puce-moi')) === 'C’est parti', 'Entrée à nouveau : retour à « C’est parti »');
    await appuyer(page, 'Escape');
    await page.waitForTimeout(PAUSE_APRES_ECRAN);
    f = await focus(page);
    verifier((await estVisible(page, '#fenetre-quitter')) && f.nom === 'Rester', 'Échap : « Quitter le salon ? », focus sur « Rester »', `« ${f.nom} »`);
    await appuyer(page, 'Tab');
    await appuyer(page, 'Enter', true);
    verifier(fichierCourant(page) === 'accueil.html#normal', 'Tab, Entrée sur « Quitter le salon » : retour à l’accueil', fichierCourant(page));
    await contexte.close();
  }

  await navigateur.close();
  process.stdout.write(`\nRésultat : ${verifications} vérifications, ${echecs} échec${echecs > 1 ? 's' : ''}\n`);
  process.exit(echecs === 0 ? 0 : 1);
})().catch((e) => {
  process.stderr.write(`Erreur : ${e.stack}\n`);
  process.exit(2);
});
