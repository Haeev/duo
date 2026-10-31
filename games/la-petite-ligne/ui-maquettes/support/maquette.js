// Maquettes seulement: comportements de référence de l'interface (états, clavier, souris).
// Le jeu les réimplémente dans son propre code; ce fichier montre ce qui est attendu.
//
// - États par ancre (#etat): les éléments [data-when="a b"] ne s'affichent que dans ces états;
//   [data-on-etat="attr=valeur;attr2=valeur"] pose des attributs dans un état donné.
// - Focus par défaut: [data-autofocus] visible.
// - Navigation aux flèches (et ZQSD dans les panneaux du jeu): [data-nav="list|row|grid"].
// - Fermeture des panneaux du jeu: Retour arrière, ou la touche du panneau ([data-panel-key]).
// - Échap: réservé à la pause de Duo, sans effet sur les panneaux du jeu.
// - Onglets du carnet: A et E (KeyQ et KeyE), comme la rotation de la caméra hors du carnet.
// - Barre d'outils: molette et rangée des chiffres (facultative).
// - Proposition reçue: Entrée y amène le focus, sans le voler pendant qu'on joue.
(function () {
  const corps = document.body;
  const etats = (corps.dataset.states || '').split(/\s+/).filter(Boolean);
  const debut = performance.now();

  function etatCourant() {
    const ancre = decodeURIComponent(location.hash.replace('#', ''));
    return etats.includes(ancre) ? ancre : etats[0] || '';
  }

  function visible(el) {
    return el.getClientRects().length > 0 && !el.closest('[hidden]');
  }

  function appliquerEtat() {
    const etat = etatCourant();
    corps.dataset.state = etat;
    document.querySelectorAll('[data-when]').forEach((el) => {
      // toggleAttribute: les éléments SVG n'ont pas de propriété hidden.
      el.toggleAttribute('hidden', !el.dataset.when.split(/\s+/).includes(etat));
    });
    document.querySelectorAll('*').forEach((el) => {
      for (const attr of [...el.attributes]) {
        if (!attr.name.startsWith('data-on-')) continue;
        if (attr.name.slice(8) !== etat) continue;
        attr.value.split(';').forEach((paire) => {
          const [nom, ...reste] = paire.split('=');
          if (!nom) return;
          const valeur = reste.join('=');
          if (valeur === '!') el.removeAttribute(nom.trim());
          else el.setAttribute(nom.trim(), valeur);
        });
      }
    });
    poserFocus();
  }

  function poserFocus() {
    const candidats = [...document.querySelectorAll('[data-autofocus]')].filter(visible);
    candidats.sort((a, b) => Number(b.dataset.autofocus || 0) - Number(a.dataset.autofocus || 0));
    const cible = candidats[0];
    if (!cible) return;
    cible.focus({ preventScroll: true });
    // Champ prérempli (le pseudo Duo): curseur à la fin, pour corriger sans tout retaper.
    if (cible.matches('input[type="text"]'))
      cible.setSelectionRange(cible.value.length, cible.value.length);
  }

  // Note de maquette (hors interface): explique ce que ferait le jeu ou la plateforme.
  let minuteurNote = 0;
  function note(texte) {
    let el = document.querySelector('.maquette-note');
    if (!el) {
      el = document.createElement('div');
      el.className = 'maquette-note';
      el.setAttribute('role', 'status');
      corps.append(el);
    }
    el.textContent = texte;
    el.hidden = false;
    clearTimeout(minuteurNote);
    minuteurNote = setTimeout(() => {
      el.hidden = true;
    }, 2600);
  }

  function fermerPanneau() {
    const ouverts = [
      ...document.querySelectorAll('.lpl-panel, .lpl-dialogue[data-closable]'),
    ].filter(visible);
    if (!ouverts.length) return false;
    ouverts.forEach((p) => {
      p.hidden = true;
    });
    corps.dataset.closed = 'true';
    note('Panneau fermé : retour au jeu.');
    document.activeElement?.blur();
    return true;
  }

  // Navigation aux flèches dans un groupe.
  const DIRECTIONS = {
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    KeyW: [0, -1],
    KeyS: [0, 1],
    KeyA: [-1, 0],
    KeyD: [1, 0],
  };

  // Navigation spatiale: l'élément le plus proche dans la direction de la flèche, ce qui
  // couvre les listes, les rangées et les grilles de formes différentes (barre d'outils et sac).
  function naviguer(evenement) {
    const groupe = evenement.target.closest('[data-nav]');
    if (!groupe) return false;
    if (evenement.code.startsWith('Key') && !groupe.closest('[data-game-panel]')) return false;
    if (evenement.target.matches('input[type="text"]')) return false;
    const direction = DIRECTIONS[evenement.code];
    if (!direction) return false;
    const elements = [...groupe.querySelectorAll('[data-nav-item]')].filter(visible);
    const depart = evenement.target.closest('[data-nav-item]');
    if (!depart || !elements.includes(depart)) return false;
    const centre = (el) => {
      const r = el.getBoundingClientRect();
      return [r.left + r.width / 2, r.top + r.height / 2];
    };
    const [x0, y0] = centre(depart);
    let meilleur = null;
    let score = Infinity;
    for (const el of elements) {
      if (el === depart) continue;
      const [x, y] = centre(el);
      const axe = (x - x0) * direction[0] + (y - y0) * direction[1];
      if (axe <= 4) continue;
      const travers = Math.abs((x - x0) * direction[1]) + Math.abs((y - y0) * direction[0]);
      const s = axe + travers * 2.5;
      if (s < score) {
        score = s;
        meilleur = el;
      }
    }
    if (!meilleur) return true;
    if (groupe.dataset.roving !== undefined)
      elements.forEach((el) => (el.tabIndex = el === meilleur ? 0 : -1));
    meilleur.focus();
    if (groupe.dataset.selectOnFocus !== undefined) meilleur.click();
    return true;
  }

  // Onglets.
  function choisirOnglet(onglet) {
    const liste = onglet.closest('[role="tablist"]');
    liste.querySelectorAll('[role="tab"]').forEach((t) => {
      const actif = t === onglet;
      t.setAttribute('aria-selected', String(actif));
      t.tabIndex = actif ? 0 : -1;
      const panneau = document.getElementById(t.getAttribute('aria-controls'));
      if (panneau) panneau.hidden = !actif;
    });
  }

  function ongletVoisin(sens) {
    const liste = document.querySelector('[role="tablist"][data-tab-keys]');
    if (!liste || !visible(liste)) return false;
    const onglets = [...liste.querySelectorAll('[role="tab"]')];
    const actif = onglets.findIndex((t) => t.getAttribute('aria-selected') === 'true');
    const suivant = onglets[(actif + sens + onglets.length) % onglets.length];
    choisirOnglet(suivant);
    const premier = document
      .getElementById(suivant.getAttribute('aria-controls'))
      ?.querySelector('[data-autofocus], [data-nav-item], button');
    (premier || suivant).focus();
    return true;
  }

  // Barre d'outils: sélection d'une case et libellé.
  function choisirCase(index) {
    const barre = document.querySelector('.lpl-toolbar__slots');
    if (!barre) return;
    const cases = [...barre.querySelectorAll('.lpl-slot')];
    if (!cases[index]) return;
    cases.forEach((c, i) => c.setAttribute('aria-selected', String(i === index)));
    const libelle = document.querySelector('.lpl-toolbar__label [data-label]');
    if (libelle) libelle.textContent = cases[index].getAttribute('aria-label') || 'Main libre';
  }

  function caseCourante() {
    const cases = [...document.querySelectorAll('.lpl-toolbar__slots .lpl-slot')];
    return cases.findIndex((c) => c.getAttribute('aria-selected') === 'true');
  }

  document.addEventListener(
    'wheel',
    (evenement) => {
      if (!document.querySelector('.lpl-toolbar__slots') || evenement.target.closest('.lpl-panel'))
        return;
      const total = document.querySelectorAll('.lpl-toolbar__slots .lpl-slot').length;
      choisirCase((caseCourante() + (evenement.deltaY > 0 ? 1 : -1) + total) % total);
    },
    { passive: true },
  );

  // Bascule de choix (répliques, Continuer et Finir la séance, tenues).
  document.addEventListener('click', (evenement) => {
    const bouton = evenement.target.closest('[data-toggle-group]');
    if (bouton && bouton.getAttribute('aria-disabled') !== 'true') {
      const groupe = bouton.dataset.toggleGroup;
      document
        .querySelectorAll(`[data-toggle-group="${groupe}"]`)
        .forEach((b) => b.setAttribute('aria-pressed', String(b === bouton)));
      if (bouton.dataset.goto) {
        location.hash = bouton.dataset.goto;
      }
      return;
    }
    const aller = evenement.target.closest('[data-goto]');
    if (aller) {
      location.hash = aller.dataset.goto;
      return;
    }
    const onglet = evenement.target.closest('[role="tab"]');
    if (onglet) {
      choisirOnglet(onglet);
      return;
    }
    const fermer = evenement.target.closest('[data-close]');
    if (fermer) {
      fermerPanneau();
      return;
    }
    const caseOutil = evenement.target.closest('.lpl-toolbar__slots .lpl-slot');
    if (caseOutil) {
      choisirCase([...caseOutil.parentElement.children].indexOf(caseOutil));
      return;
    }
    const caseSac = evenement.target.closest('[data-bag-slot]');
    if (caseSac) {
      document
        .querySelectorAll('[data-bag-slot]')
        .forEach((c) => c.setAttribute('aria-checked', String(c === caseSac)));
      const detail = document.querySelector('[data-item-name]');
      if (detail) detail.textContent = caseSac.getAttribute('aria-label') || '';
      return;
    }
    // Clic hors d'un panneau du jeu: il se ferme (cahier, section 5.1).
    if (
      evenement.target.closest('.scene-maquette') &&
      document.querySelector('.lpl-panel:not([hidden])')
    ) {
      fermerPanneau();
    }
  });

  document.addEventListener('keydown', (evenement) => {
    const dansChamp = evenement.target.matches('input[type="text"], textarea');
    // Anti-double-appui: 300 ms après l'arrivée sur l'écran, et jamais de répétition automatique.
    if (
      (evenement.key === 'Enter' || evenement.key === ' ') &&
      (performance.now() - debut < 300 || evenement.repeat)
    ) {
      if (!dansChamp) evenement.preventDefault();
      return;
    }
    if (evenement.key === 'Escape') {
      evenement.preventDefault();
      note(
        'Échap : pause de Duo sur les deux ordinateurs. Le panneau du jeu reste ouvert dessous.',
      );
      return;
    }
    if (evenement.key === 'Backspace' && !dansChamp) {
      if (fermerPanneau()) evenement.preventDefault();
      return;
    }
    const cleDuPanneau = document.querySelector('[data-panel-key]:not([hidden])');
    if (cleDuPanneau && evenement.code === cleDuPanneau.dataset.panelKey && visible(cleDuPanneau)) {
      evenement.preventDefault();
      fermerPanneau();
      return;
    }
    if ((evenement.code === 'KeyQ' || evenement.code === 'KeyE') && !dansChamp) {
      if (ongletVoisin(evenement.code === 'KeyQ' ? -1 : 1)) {
        evenement.preventDefault();
        return;
      }
    }
    if (evenement.key === 'Enter' && !dansChamp) {
      const proposition = [...document.querySelectorAll('.lpl-proposal')].find(visible);
      if (proposition && !proposition.contains(evenement.target)) {
        evenement.preventDefault();
        proposition.querySelector('[data-proposal-default]')?.focus();
        return;
      }
    }
    if (
      /^Digit\d$/.test(evenement.code) &&
      !dansChamp &&
      document.querySelector('.lpl-toolbar__slots')
    ) {
      const chiffre = Number(evenement.code.slice(5));
      choisirCase(chiffre === 0 ? 9 : chiffre - 1);
      return;
    }
    if (naviguer(evenement)) {
      evenement.preventDefault();
      return;
    }
    // Piège à focus des panneaux et fenêtres du jeu: Tab boucle à l'intérieur.
    if (evenement.key === 'Tab') {
      const piege = [...document.querySelectorAll('[data-trap]')].find(visible);
      if (!piege) return;
      const focusables = [
        ...piege.querySelectorAll('button, input, [tabindex="0"], a[href]'),
      ].filter((el) => visible(el) && !el.disabled && el.tabIndex >= 0);
      if (!focusables.length) return;
      const premier = focusables[0];
      const dernier = focusables[focusables.length - 1];
      if (evenement.shiftKey && document.activeElement === premier) {
        evenement.preventDefault();
        dernier.focus();
      } else if (!evenement.shiftKey && document.activeElement === dernier) {
        evenement.preventDefault();
        premier.focus();
      } else if (!piege.contains(document.activeElement)) {
        evenement.preventDefault();
        premier.focus();
      }
    }
  });

  // Taille de l'interface et animations: ?taille=125 et ?animations=reduites pour les captures.
  const parametres = new URLSearchParams(location.search);
  const taille = Number(parametres.get('taille'));
  if ([100, 125, 150].includes(taille))
    document.documentElement.style.setProperty('--lpl-ui-scale', String(taille / 100));
  if (parametres.get('animations') === 'reduites')
    document.documentElement.dataset.motion = 'reduced';

  window.addEventListener('hashchange', appliquerEtat);
  appliquerEtat();
  window.lplMaquette = { note, choisirCase, appliquerEtat };
})();
