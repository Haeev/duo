'use strict';
/*
  Comportements de référence des maquettes de Cosy Café. Le jeu les réimplémente: ce n'est pas du code de production.
  - États par ancre (#service, #commandes...): body[data-etats] liste les états, [data-si="a b"] n'apparaît que dans ces états.
  - Scène provisoire choisie par état: body[data-scenes="nomScene:etat1 etat2;autreScene:etat3"], injectée dans [data-scene].
  - Dessins: jetons des joueurs [data-joueur="orb"], icônes [data-icone], boutons de souris [data-souris].
  - Focus par défaut: l'élément visible [data-focus] de plus forte priorité.
  - Interfaces du jeu ([data-panneau-jeu]): navigation spatiale aux flèches et à Z Q S D (positions KeyW, KeyA, KeyS, KeyD);
    A et E (KeyQ, KeyE) passent à la section ou à la page voisine ([data-sections]); Entrée et Espace activent;
    Retour arrière ou la touche de l'interface (body[data-touche-fermer]) ou un clic hors de l'interface la ferment.
  - Échap: pause de Duo (superposition simulée, au premier plan), jamais la fermeture d'une interface du jeu.
  - Anti-double-appui: Entrée et Espace ignorés 300 ms après un changement d'état, et jamais en répétition automatique.
  - ?taille=125 ou 150: taille de l'interface de Duo; ?animations=reduites: réduction des animations.
*/
(function () {
  const corps = document.body;
  const Maquette = { surEtat: null, surTouche: null, surRetour: null, apresPause: null, fermer: null };
  window.Maquette = Maquette;

  let gardeJusqua = 0;
  function garde(ms) {
    gardeJusqua = performance.now() + (ms === undefined ? 300 : ms);
  }

  // ---------- Dessins ----------
  function injecterSymboles() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.position = 'absolute';
    svg.innerHTML = Object.entries(window.SYMBOLES_JOUEURS)
      .map(([id, p]) => `<symbol id="joueur-${id}" viewBox="0 0 24 24"><path d="${p.chemin}"/></symbol>`)
      .join('');
    corps.prepend(svg);
  }

  function jeton(id) {
    const p = window.SYMBOLES_JOUEURS[id];
    return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="11" fill="#1A1F3D" stroke="#111" stroke-width="1.6"/>` +
      `<use href="#joueur-${id}" x="4.4" y="4.4" width="15.2" height="15.2" fill="${p.couleur}"/></svg>`;
  }

  const T = 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2"';
  const ICONES = {
    coche: `<path d="M4 12.5l5 5L20 6.5" ${T} stroke-width="3"/>`,
    case: `<rect x="4.5" y="4.5" width="15" height="15" rx="2.5" ${T}/>`,
    caseCochee: `<rect x="4.5" y="4.5" width="15" height="15" rx="2.5" ${T}/><path d="M8 12.2l2.8 2.8L16.5 9" ${T} stroke-width="2.6"/>`,
    croix: `<path d="M6 6l12 12M18 6L6 18" ${T} stroke-width="3"/>`,
    sablier: `<path d="M6 3h12l-6 9 6 9H6l6-9z" ${T}/>`,
    alerte: `<path d="M12 3L22 20H2z" ${T}/><path d="M12 9v5" ${T} stroke-width="2.6"/><circle cx="12" cy="17" r="1.4" fill="currentColor"/>`,
    horloge: `<circle cx="12" cy="12" r="9" ${T}/><path d="M12 7v5l3.5 2" ${T}/>`,
    pause: `<circle cx="12" cy="12" r="9" ${T}/><path d="M10 8.5v7M14 8.5v7" ${T} stroke-width="2.6"/>`,
    cloche: `<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z" ${T}/><path d="M10 20.5a2 2 0 0 0 4 0" ${T}/>`,
    carton: `<path d="M3 7.5L12 3l9 4.5v9L12 21l-9-4.5z" ${T}/><path d="M3 7.5l9 4.5 9-4.5M12 12v9" ${T}/>`,
    tasse: `<path d="M4 8h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" ${T}/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16" ${T}/><path d="M7 3.5c0 1.2 1 1.2 1 2.4M11 3.5c0 1.2 1 1.2 1 2.4" ${T}/>`,
    fleche: `<path d="M4 12h15M13 6l6 6-6 6" ${T} stroke-width="2.6"/>`,
    main: `<path d="M8 12V6a1.5 1.5 0 0 1 3 0v5M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v8a7 7 0 0 1-7 7h-.5A6.5 6.5 0 0 1 4 15.5V12a1.5 1.5 0 0 1 3 0v1" ${T} stroke-width="1.8"/>`,
    etoile: `<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z" ${T} stroke-width="1.8"/>`,
    etoilePleine: `<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z" fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>`,
    coeur: `<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" ${T}/>`,
    info: `<circle cx="12" cy="12" r="9.5" ${T}/><path d="M12 11v6" ${T} stroke-width="2.6"/><circle cx="12" cy="7.5" r="1.4" fill="currentColor"/>`,
    eau: `<path d="M12 3Q6 11 6 14.5a6 6 0 0 0 12 0Q18 11 12 3z" ${T}/>`,
    cadenas: `<rect x="5" y="10.5" width="14" height="10" rx="2" ${T}/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" ${T}/>`,
    four: `<rect x="3.5" y="4" width="17" height="16" rx="2" ${T}/><rect x="6.5" y="9" width="11" height="8" rx="1" ${T}/><path d="M7 6.5h2M11 6.5h2" ${T}/>`,
    signe: `<path d="M12 21s-6-6.2-6-11a6 6 0 0 1 12 0c0 4.8-6 11-6 11z" ${T}/><circle cx="12" cy="10" r="2.2" fill="currentColor"/>`,
    plus: `<path d="M12 5v14M5 12h14" ${T} stroke-width="2.8"/>`,
    moins: `<path d="M5 12h14" ${T} stroke-width="2.8"/>`,
    livre: `<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" ${T}/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5" ${T}/>`,
    bulle: `<path d="M4 5h16v11H10l-6 4z" ${T}/><path d="M8 9.5h8M8 12.5h5" ${T}/>`,
    thermometre: `<path d="M10 4a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0z" ${T}/><circle cx="12" cy="16.5" r="1.6" fill="currentColor"/>`,
    vaisselle: `<rect x="4" y="3" width="16" height="18" rx="2" ${T}/><path d="M4 8h16" ${T}/><circle cx="12" cy="14.5" r="3.5" ${T}/>`,
    tourner: `<path d="M19 12a7 7 0 1 1-2.05-4.95M19 4v4h-4" ${T}/>`,
    soleil: `<circle cx="12" cy="12" r="4.5" ${T}/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" ${T}/>`,
    pluie: `<path d="M7 15a4.5 4.5 0 0 1 .5-9 5.5 5.5 0 0 1 10.3 1.8A3.6 3.6 0 0 1 17.5 15z" ${T}/><path d="M9 18l-1 2.5M13 18l-1 2.5M17 18l-1 2.5" ${T}/>`,
    tablette: `<rect x="4" y="2.5" width="16" height="19" rx="2.5" ${T}/><path d="M10 18.5h4" ${T}/>`,
    reglages: `<circle cx="12" cy="12" r="3" ${T}/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.9 1.9M16.6 16.6l1.9 1.9M5.5 18.5l1.9-1.9M16.6 7.4l1.9-1.9" ${T}/>`
  };

  function souris(bouton) {
    const zones = {
      gauche: '<path d="M8 2.2A6.3 6.3 0 0 0 1.9 8.5V10H8z" fill="currentColor"/>',
      droit: '<path d="M8 2.2A6.3 6.3 0 0 1 14.1 8.5V10H8z" fill="currentColor"/>',
      milieu: '<rect x="6.4" y="3.6" width="3.2" height="5.6" rx="1.6" fill="currentColor"/>',
      molette: '<rect x="6.4" y="3.6" width="3.2" height="5.6" rx="1.6" fill="currentColor"/><path d="M8 12.5v6M5.8 16.4L8 18.6l2.2-2.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
      deplacer: '<path d="M8 12.5v7M4.5 16h7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'
    };
    return `<svg viewBox="0 0 16 24" aria-hidden="true" focusable="false"><rect x="1.5" y="1.5" width="13" height="21" rx="6.5" fill="none" stroke="currentColor" stroke-width="1.8"/>` +
      `<path d="M1.6 10H14.4M8 1.6V10" fill="none" stroke="currentColor" stroke-width="1.4"/>${zones[bouton] || ''}</svg>`;
  }

  const NOMS_SOURIS = { gauche: 'clic gauche', droit: 'clic droit', milieu: 'clic du milieu', molette: 'molette', deplacer: 'mouvement de la souris' };

  function dessiner(racine) {
    racine.querySelectorAll('[data-joueur]').forEach((el) => {
      el.innerHTML = jeton(el.dataset.joueur);
    });
    racine.querySelectorAll('[data-icone]').forEach((el) => {
      const i = ICONES[el.dataset.icone];
      if (i) el.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${i}</svg>`;
    });
    racine.querySelectorAll('[data-souris]').forEach((el) => {
      el.innerHTML = souris(el.dataset.souris);
      el.classList.add('souris');
      if (!el.hasAttribute('aria-hidden')) {
        el.setAttribute('role', 'img');
        el.setAttribute('aria-label', NOMS_SOURIS[el.dataset.souris] || 'souris');
      }
    });
  }

  // ---------- États ----------
  function visible(el) {
    if (!el || el.closest('[hidden]')) return false;
    if (el.getClientRects().length === 0) return false;
    return getComputedStyle(el).visibility !== 'hidden';
  }

  function etatCourant() {
    const etats = (corps.dataset.etats || '').split(/\s+/).filter(Boolean);
    const ancre = decodeURIComponent(location.hash.slice(1));
    return etats.includes(ancre) ? ancre : etats[0] || '';
  }

  let sceneCourante = null;
  function choisirScene(etat) {
    const hote = document.querySelector('[data-scene]');
    if (!hote) return;
    let nom = hote.dataset.scene;
    (corps.dataset.scenes || '').split(';').forEach((bloc) => {
      const [scene, etats] = bloc.split(':');
      if (etats && etats.trim().split(/\s+/).includes(etat)) nom = scene.trim();
    });
    if (nom !== sceneCourante && window.SCENES[nom]) {
      hote.innerHTML = window.SCENES[nom]();
      sceneCourante = nom;
    }
  }

  function focusParDefaut() {
    const candidats = [...document.querySelectorAll('[data-focus]')].filter(visible);
    candidats.sort((a, b) => Number(b.dataset.focus || 1) - Number(a.dataset.focus || 1));
    // Section vide: le focus reste sur l'onglet de la section, pour que A, E et les flèches répondent.
    const cible = candidats[0] || [...document.querySelectorAll('[data-sections] [aria-selected="true"]')].find(visible);
    if (!cible) {
      if (document.activeElement && document.activeElement !== corps) document.activeElement.blur();
      return;
    }
    cible.focus({ preventScroll: true });
    if (cible.matches('input[type="text"]')) cible.setSelectionRange(cible.value.length, cible.value.length);
  }

  function appliquerEtat() {
    const etat = etatCourant();
    corps.dataset.etat = etat;
    choisirScene(etat);
    document.querySelectorAll('[data-si]').forEach((el) => {
      // toggleAttribute: les éléments SVG n'ont pas de propriété hidden.
      el.toggleAttribute('hidden', !el.dataset.si.split(/\s+/).includes(etat));
    });
    document.querySelectorAll('[data-sections] [data-section-etats]').forEach((b) => {
      const actif = b.dataset.sectionEtats.split(/\s+/).includes(etat);
      b.setAttribute('aria-selected', String(actif));
      b.tabIndex = actif ? 0 : -1;
    });
    if (typeof Maquette.surEtat === 'function') Maquette.surEtat(etat);
    focusParDefaut();
    garde();
  }

  function aller(etat) {
    if (location.hash.slice(1) === etat) appliquerEtat();
    else location.hash = etat;
  }

  // ---------- Notes de maquette ----------
  let minuteurNote = 0;
  function note(texte) {
    let el = document.querySelector('.note-maquette');
    if (!el) {
      el = document.createElement('div');
      el.className = 'note-maquette';
      el.setAttribute('role', 'status');
      corps.append(el);
    }
    el.textContent = texte;
    el.hidden = false;
    clearTimeout(minuteurNote);
    minuteurNote = setTimeout(() => {
      el.hidden = true;
    }, 3200);
  }

  // ---------- Pause de Duo simulée ----------
  let pause = null;
  let focusAvantPause = null;
  function ouvrirPause() {
    focusAvantPause = document.activeElement;
    pause = document.createElement('dialog');
    pause.className = 'duo-pause';
    pause.setAttribute('aria-labelledby', 'duo-pause-titre');
    pause.innerHTML = `<div class="duo-pause__panneau"><h2 id="duo-pause-titre">Pause</h2><p>Tu as mis la partie en pause.</p>` +
      `<button class="bouton bouton--principal" data-reprendre>Reprendre <kbd>Échap</kbd></button>` +
      `<p class="duo-pause__note">Superposition de Duo, simulée ici. En vrai, la reprise attend « Reprendre » sur les deux ordinateurs, puis « Reprise dans 3 ». Ce qui est ouvert dans le jeu reste ouvert dessous.</p></div>`;
    corps.append(pause);
    pause.showModal();
    pause.querySelector('[data-reprendre]').addEventListener('click', reprendre);
    pause.querySelector('[data-reprendre]').focus();
    garde();
  }
  function reprendre() {
    if (!pause) return;
    pause.close();
    pause.remove();
    pause = null;
    garde();
    if (typeof Maquette.apresPause === 'function' && Maquette.apresPause() === true) return;
    if (focusAvantPause && document.contains(focusAvantPause) && visible(focusAvantPause)) focusAvantPause.focus();
    else focusParDefaut();
  }

  // ---------- Interfaces du jeu ----------
  function interfaceOuverte() {
    return [...document.querySelectorAll('[data-panneau-jeu]')].find(visible) || null;
  }
  function fermerInterface() {
    if (typeof Maquette.fermer === 'function' && Maquette.fermer() === true) return true;
    if (corps.dataset.retour) {
      location.href = corps.dataset.retour;
      return true;
    }
    return false;
  }

  const FOCALISABLES = 'button:not(:disabled), [href], input:not(:disabled), select, textarea, [tabindex]:not([tabindex="-1"])';

  // Navigation spatiale: l'élément focalisable le plus proche dans la direction de la flèche.
  const DIRECTIONS = {
    ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
    KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0], KeyD: [1, 0]
  };
  function navigationSpatiale(e) {
    const direction = DIRECTIONS[e.code];
    if (!direction) return false;
    const depart = document.activeElement;
    if (!depart || depart === corps) return false;
    const groupe = depart.closest('[data-nav]');
    if (!groupe) return false;
    if (depart.matches('input[type="text"], textarea')) return false;
    // Un curseur garde ses flèches gauche et droite pour changer sa valeur.
    if (depart.matches('input[type="range"]') && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) return false;
    const elements = [...groupe.querySelectorAll(FOCALISABLES)].filter((el) => visible(el) && !el.closest('[data-hors-nav]'));
    const centre = (el) => {
      const r = el.getBoundingClientRect();
      return [r.left + r.width / 2, r.top + r.height / 2, r];
    };
    const [x0, y0, r0] = centre(depart);
    let meilleur = null;
    let score = Infinity;
    for (const el of elements) {
      if (el === depart || el.contains(depart) || depart.contains(el)) continue;
      const [x, y, r] = centre(el);
      // Distance mesurée de bord à bord dans l'axe, de centre à centre en travers.
      const axe = direction[0] !== 0
        ? (direction[0] > 0 ? r.left - r0.right : r0.left - r.right)
        : (direction[1] > 0 ? r.top - r0.bottom : r0.top - r.bottom);
      if (axe < -4) continue;
      const travers = direction[0] !== 0 ? Math.abs(y - y0) : Math.abs(x - x0);
      const s = Math.max(axe, 0) + travers * 2;
      if (s < score) {
        score = s;
        meilleur = el;
      }
    }
    if (meilleur) meilleur.focus();
    return true;
  }

  function sectionVoisine(sens) {
    const liste = [...document.querySelectorAll('[data-sections]')].find(visible);
    if (!liste) return false;
    const boutons = [...liste.querySelectorAll('[data-section-etats]')].filter(visible);
    const i = boutons.findIndex((b) => b.getAttribute('aria-selected') === 'true');
    if (i < 0) return false;
    const bornee = liste.hasAttribute('data-sans-boucle');
    let j = i + sens;
    if (bornee && (j < 0 || j >= boutons.length)) return true;
    j = (j + boutons.length) % boutons.length;
    boutons[j].click();
    return true;
  }

  // Piège à focus: Tab et Maj+Tab bouclent dans la fenêtre ou l'interface du dessus.
  function piegerTab(e) {
    const conteneur = [...document.querySelectorAll('dialog[open]')].pop() || [...document.querySelectorAll('[data-piege]')].find(visible);
    if (!conteneur) return false;
    const liste = [...conteneur.querySelectorAll(FOCALISABLES)].filter((el) => visible(el) && el.tabIndex >= 0);
    if (!liste.length) return false;
    const premier = liste[0];
    const dernier = liste[liste.length - 1];
    if (!conteneur.contains(document.activeElement)) {
      e.preventDefault();
      premier.focus();
      return true;
    }
    if (e.shiftKey && document.activeElement === premier) {
      e.preventDefault();
      dernier.focus();
      return true;
    }
    if (!e.shiftKey && document.activeElement === dernier) {
      e.preventDefault();
      premier.focus();
      return true;
    }
    return false;
  }

  document.addEventListener('keydown', (e) => {
    const champ = e.target instanceof Element && e.target.matches('input[type="text"], textarea');
    const activation = e.key === 'Enter' || e.key === ' ';
    if (activation && (e.repeat || performance.now() < gardeJusqua)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    if (pause) {
      if (e.key === 'Escape') {
        e.preventDefault();
        reprendre();
      } else if (e.key === 'Tab') {
        e.preventDefault();
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      ouvrirPause();
      return;
    }
    const fenetre = [...document.querySelectorAll('dialog[open]')].pop();
    if (e.key === 'Backspace' && !champ) {
      e.preventDefault();
      if (fenetre) {
        fenetre.close('retour');
        return;
      }
      if (typeof Maquette.surRetour === 'function' && Maquette.surRetour() === true) return;
      if (interfaceOuverte()) fermerInterface();
      return;
    }
    if (!fenetre && !champ && corps.dataset.toucheFermer && e.code === corps.dataset.toucheFermer && interfaceOuverte()) {
      e.preventDefault();
      fermerInterface();
      return;
    }
    if (!fenetre && !champ && (e.code === 'KeyQ' || e.code === 'KeyE') && interfaceOuverte()) {
      if (sectionVoisine(e.code === 'KeyQ' ? -1 : 1)) {
        e.preventDefault();
        return;
      }
    }
    if (typeof Maquette.surTouche === 'function' && Maquette.surTouche(e, { champ, fenetre }) === true) {
      e.preventDefault();
      return;
    }
    if (!champ && (fenetre || interfaceOuverte()) && navigationSpatiale(e)) {
      e.preventDefault();
      return;
    }
    if (e.key === 'Tab') piegerTab(e);
  }, true);

  // Échap ne ferme jamais une fenêtre du jeu: il est réservé à la pause de Duo.
  document.addEventListener('cancel', (e) => {
    if (e.target !== pause) e.preventDefault();
  }, true);

  // Retour du focus à l'élément qui a ouvert une fenêtre.
  document.addEventListener('close', (e) => {
    const f = e.target;
    if (f.tagName === 'DIALOG' && f._ouvreur && visible(f._ouvreur)) f._ouvreur.focus();
  }, true);

  function ouvrirFenetre(id, ouvreur) {
    const f = document.getElementById(id);
    if (!f) return;
    f._ouvreur = ouvreur || document.activeElement;
    f.showModal();
    const premier = f.querySelector('[data-focus]') || f.querySelector(FOCALISABLES);
    if (premier) premier.focus();
    garde();
  }

  // ---------- Clics ----------
  function formater(valeur, format) {
    if (format === 'euro') return `${valeur.toFixed(2).replace('.', ',')} €`;
    if (format === 'litre') return `${String(valeur).replace('.', ',')} L`;
    if (format === 'kilo') return `${String(valeur).replace('.', ',')} kg`;
    return String(valeur);
  }

  document.addEventListener('click', (e) => {
    if (pause) return;
    const cible = e.target instanceof Element ? e.target : null;
    if (!cible) return;
    const allerA = cible.closest('[data-aller]');
    if (allerA && allerA.getAttribute('aria-disabled') !== 'true') {
      const dest = allerA.dataset.aller;
      if (dest.startsWith('#')) aller(dest.slice(1));
      else location.href = dest;
      return;
    }
    const ouvrir = cible.closest('[data-ouvrir]');
    if (ouvrir) {
      ouvrirFenetre(ouvrir.dataset.ouvrir, ouvrir);
      return;
    }
    const fermerF = cible.closest('[data-fermer-fenetre]');
    if (fermerF) {
      const f = fermerF.closest('dialog');
      if (f) f.close(fermerF.dataset.fermerFenetre || '');
      return;
    }
    const pas = cible.closest('[data-pas]');
    if (pas && pas.getAttribute('aria-disabled') !== 'true') {
      const sortie = document.getElementById(pas.dataset.cible);
      const v = Math.round((Number(sortie.dataset.valeur) + Number(pas.dataset.pas)) * 100) / 100;
      const min = Number(sortie.dataset.min ?? -Infinity);
      const max = Number(sortie.dataset.max ?? Infinity);
      const borne = Math.min(max, Math.max(min, v));
      sortie.dataset.valeur = String(borne);
      sortie.textContent = formater(borne, sortie.dataset.format);
      sortie.dispatchEvent(new CustomEvent('valeur', { bubbles: true }));
      return;
    }
    const choix = cible.closest('[data-groupe-choix]');
    if (choix) {
      document.querySelectorAll(`[data-groupe-choix="${choix.dataset.groupeChoix}"]`).forEach((b) => {
        b.setAttribute('aria-pressed', String(b === choix));
      });
      choix.dispatchEvent(new CustomEvent('choix', { bubbles: true }));
      return;
    }
    const bascule = cible.closest('[data-bascule]');
    if (bascule) {
      const attr = bascule.getAttribute('role') === 'switch' ? 'aria-checked' : 'aria-pressed';
      bascule.setAttribute(attr, String(bascule.getAttribute(attr) !== 'true'));
      bascule.dispatchEvent(new CustomEvent('bascule', { bubbles: true }));
      return;
    }
    const fermer = cible.closest('[data-fermer-interface]');
    if (fermer) {
      fermerInterface();
      return;
    }
    // Clic hors de l'interface ouverte: elle se ferme (le monde reste derrière).
    if (cible.closest('.scene, .voile-jeu') && interfaceOuverte() && !document.querySelector('dialog[open]')) fermerInterface();
  });

  // ---------- Réglages de la maquette ----------
  const parametres = new URLSearchParams(location.search);
  const taille = Number(parametres.get('taille'));
  if ([100, 125, 150].includes(taille)) document.documentElement.style.setProperty('--ui', String(taille / 100));
  if (parametres.get('animations') === 'reduites') document.documentElement.dataset.motion = 'reduced';

  Object.assign(Maquette, { note, aller, appliquerEtat, focusParDefaut, visible, dessiner, ouvrirFenetre, ouvrirPause, garde });

  document.addEventListener('DOMContentLoaded', () => {
    injecterSymboles();
    dessiner(document);
    appliquerEtat();
  });
  window.addEventListener('hashchange', appliquerEtat);
})();
