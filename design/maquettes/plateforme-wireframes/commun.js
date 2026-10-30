'use strict';
/*
  Comportements partagés des wireframes de Duo (références pour dev-plateforme, pas du code de production).
  - États d'un écran choisis par l'ancre de l'adresse (#attente, #pause...): [data-si="etat1 etat2"].
  - Focus par défaut: l'élément visible [data-focus] de plus forte priorité.
  - Échap: ferme la fenêtre ouverte, sinon revient à [data-retour] du body, sinon Duo.surEchap.
  - Anti-double-appui: Entrée et Espace ignorés 300 ms après un changement d'écran, et jamais en répétition.
*/
(function () {
  const FORMES = {
    rond: '<circle cx="12" cy="12" r="9.5"/>',
    carre: '<rect x="3" y="3" width="18" height="18" rx="1.5"/>',
    triangle: '<polygon points="12,2.5 22,20.5 2,20.5"/>',
    losange: '<polygon points="12,1.5 22.5,12 12,22.5 1.5,12"/>',
    etoile: '<polygon points="12,2 14.59,8.94 21.99,9.26 16.18,13.86 18.17,21 12,16.9 5.83,21 7.82,13.86 2.01,9.26 9.41,8.94"/>',
    hexagone: '<polygon points="22,12 17,20.66 7,20.66 2,12 7,3.34 17,3.34"/>'
  };
  const T = 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"';
  const ICONES = {
    coche: `<path d="M4 12.5l5 5L20 6.5" ${T} stroke-width="3"/>`,
    sablier: `<path d="M6 3h12l-6 9 6 9H6l6-9z" ${T} stroke-width="2"/>`,
    alerte: `<path d="M12 3L22 20H2z" ${T} stroke-width="2"/><path d="M12 9v5" ${T} stroke-width="2.4"/><circle cx="12" cy="17" r="1.4" fill="currentColor"/>`,
    probleme: '<circle cx="12" cy="12" r="10.5" fill="currentColor"/><path d="M8 8l8 8M16 8l-8 8" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>',
    reussi: `<circle cx="12" cy="12" r="10" ${T} stroke-width="2"/><path d="M7 12.5l3.5 3.5L17 9" ${T} stroke-width="2.6"/>`,
    question: `<circle cx="12" cy="12" r="10" ${T} stroke-width="2" stroke-dasharray="3 2.2"/><path d="M9.2 9.3a2.9 2.9 0 1 1 4.3 2.5c-1 .6-1.5 1.1-1.5 2.2" ${T} stroke-width="2.2"/><circle cx="12" cy="17.2" r="1.3" fill="currentColor"/>`,
    info: `<circle cx="12" cy="12" r="10" ${T} stroke-width="2"/><path d="M12 11v6" ${T} stroke-width="2.4"/><circle cx="12" cy="7.5" r="1.4" fill="currentColor"/>`,
    retour: `<path d="M15 5l-7 7 7 7" ${T} stroke-width="2.6"/>`,
    pause: '<rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/>',
    enregistre: `<path d="M4 4h13l3 3v13H4z" ${T} stroke-width="2"/><path d="M8 4v5h7V4M8 20v-6h8v6" ${T} stroke-width="2"/>`,
    nouveau: '<circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M12 6.5v11M6.5 12h11" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>',
    telechargement: `<path d="M12 4v11M7 10l5 5 5-5M5 20h14" ${T} stroke-width="2.4"/>`,
    ecran: `<rect x="2.5" y="4" width="19" height="13" rx="1.5" ${T} stroke-width="2"/><path d="M8 21h8M12 17v4" ${T} stroke-width="2"/>`
  };

  function dessiner(racine) {
    racine.querySelectorAll('[data-forme]').forEach((el) => {
      const forme = FORMES[el.dataset.forme];
      if (!forme) return;
      const ton = el.dataset.ton || 'fonce';
      el.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" class="forme ${ton}">${forme}</svg>`;
    });
    racine.querySelectorAll('[data-icone]').forEach((el) => {
      const icone = ICONES[el.dataset.icone];
      if (!icone) return;
      el.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${icone}</svg>`;
    });
  }

  function visible(el) {
    if (!el || el.closest('[hidden]')) return false;
    if (el.getClientRects().length === 0) return false;
    return getComputedStyle(el).visibility !== 'hidden';
  }

  // Anti-double-appui
  let gardeJusqua = 0;
  function garde(ms) { gardeJusqua = performance.now() + (ms === undefined ? 300 : ms); }
  document.addEventListener('keydown', (e) => {
    const activation = e.key === 'Enter' || e.key === ' ';
    if (!activation) return;
    if (e.repeat || performance.now() < gardeJusqua) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);

  function etatCourant() {
    return decodeURIComponent(location.hash.slice(1)) || document.body.dataset.etatDefaut || '';
  }

  function focusParDefaut() {
    const candidats = [...document.querySelectorAll('[data-focus]')].filter(visible);
    candidats.sort((a, b) => Number(b.dataset.focus || 1) - Number(a.dataset.focus || 1));
    if (candidats[0]) candidats[0].focus();
  }

  function appliquerEtat() {
    const etat = etatCourant();
    document.body.dataset.etat = etat;
    document.querySelectorAll('[data-si]').forEach((el) => {
      el.hidden = !el.dataset.si.split(/\s+/).includes(etat);
    });
    if (typeof Duo.surEtat === 'function') Duo.surEtat(etat);
    focusParDefaut();
    garde();
  }

  // Navigation entre écrans
  document.addEventListener('click', (e) => {
    const lien = e.target.closest('[data-aller]');
    if (lien && !lien.disabled) {
      e.preventDefault();
      location.href = lien.dataset.aller;
      return;
    }
    const ouvrir = e.target.closest('[data-ouvrir]');
    if (ouvrir) {
      const fenetre = document.getElementById(ouvrir.dataset.ouvrir);
      if (fenetre) ouvrirFenetre(fenetre, ouvrir);
      return;
    }
    const fermer = e.target.closest('[data-fermer]');
    if (fermer) {
      const fenetre = fermer.closest('dialog');
      if (fenetre) fenetre.close(fermer.dataset.fermer || '');
    }
  });

  function ouvrirFenetre(fenetre, ouvreur) {
    fenetre._ouvreur = ouvreur || document.activeElement;
    fenetre.showModal();
    const sur = fenetre.querySelector('[autofocus]');
    if (sur) sur.focus();
    garde();
  }
  document.addEventListener('close', (e) => {
    const fenetre = e.target;
    if (fenetre.tagName === 'DIALOG' && fenetre._ouvreur && visible(fenetre._ouvreur)) {
      fenetre._ouvreur.focus();
    }
  }, true);

  // Fenêtre modale: Tab et Maj+Tab bouclent à l'intérieur.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const fenetre = document.querySelector('dialog[open]');
    if (!fenetre) return;
    const focalisables = [...fenetre.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
      .filter((el) => !el.disabled && visible(el));
    if (focalisables.length === 0) return;
    const premier = focalisables[0];
    const dernier = focalisables[focalisables.length - 1];
    if (e.shiftKey && document.activeElement === premier) {
      e.preventDefault();
      dernier.focus();
    } else if (!e.shiftKey && document.activeElement === dernier) {
      e.preventDefault();
      premier.focus();
    }
  });

  // Échap: fenêtre ouverte (gérée par le navigateur), sinon action de l'écran, sinon retour.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (document.querySelector('dialog[open]')) return;
    if (typeof Duo.surEchap === 'function' && Duo.surEchap(e) === true) {
      e.preventDefault();
      return;
    }
    const retour = document.body.dataset.retour;
    if (retour) {
      e.preventDefault();
      location.href = retour;
    }
  });

  // Raccourcis de section: Ctrl+1 à Ctrl+4 (⌘ sur Mac), lus par position de touche.
  document.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || !/^Digit[1-4]$/.test(e.code)) return;
    const cible = document.querySelector(`[data-raccourci="${e.code.slice(5)}"]`);
    if (cible) {
      e.preventDefault();
      cible.click();
    }
  });

  // Grille à focus mobile (bibliothèque): flèches, Origine, Fin.
  function grille(conteneur, surCellule) {
    const cellules = () => [...conteneur.querySelectorAll('[data-cellule]')].filter(visible);
    function choisir(cible) {
      cellules().forEach((c) => { c.tabIndex = c === cible ? 0 : -1; });
      cible.focus();
    }
    conteneur.addEventListener('keydown', (e) => {
      const liste = cellules();
      const i = liste.indexOf(document.activeElement);
      if (i < 0) return;
      let cible = null;
      if (e.key === 'ArrowRight') cible = liste[i + 1];
      else if (e.key === 'ArrowLeft') cible = liste[i - 1];
      else if (e.key === 'Home') cible = liste[0];
      else if (e.key === 'End') cible = liste[liste.length - 1];
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const r = liste[i].getBoundingClientRect();
        const bas = e.key === 'ArrowDown';
        const autres = liste.filter((c) => {
          const rc = c.getBoundingClientRect();
          return bas ? rc.top >= r.bottom - 2 : rc.bottom <= r.top + 2;
        });
        autres.sort((a, b) => {
          const ra = a.getBoundingClientRect();
          const rb = b.getBoundingClientRect();
          const dy = bas ? ra.top - rb.top : rb.top - ra.top;
          return dy !== 0 ? dy : Math.abs(ra.left - r.left) - Math.abs(rb.left - r.left);
        });
        cible = autres[0];
      }
      if (cible) {
        e.preventDefault();
        choisir(cible);
      }
    });
    conteneur.addEventListener('focusin', (e) => {
      const c = e.target.closest('[data-cellule]');
      if (!c) return;
      cellules().forEach((x) => { x.tabIndex = x === c ? 0 : -1; });
      if (surCellule) surCellule(c);
    });
  }

  // Onglets (réglages): flèches, Origine, Fin, activation automatique.
  function onglets(liste, surActivation) {
    const tabs = [...liste.querySelectorAll('[role="tab"]')];
    const vertical = liste.getAttribute('aria-orientation') === 'vertical';
    function activer(t, avecFocus) {
      tabs.forEach((x) => {
        const choisi = x === t;
        x.setAttribute('aria-selected', String(choisi));
        x.tabIndex = choisi ? 0 : -1;
        const panneau = document.getElementById(x.getAttribute('aria-controls'));
        if (panneau) panneau.hidden = !choisi;
      });
      if (avecFocus) t.focus();
      if (surActivation) surActivation(t);
    }
    liste.addEventListener('keydown', (e) => {
      const i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      const suivant = vertical ? 'ArrowDown' : 'ArrowRight';
      const precedent = vertical ? 'ArrowUp' : 'ArrowLeft';
      let cible = null;
      if (e.key === suivant) cible = tabs[(i + 1) % tabs.length];
      else if (e.key === precedent) cible = tabs[(i - 1 + tabs.length) % tabs.length];
      else if (e.key === 'Home') cible = tabs[0];
      else if (e.key === 'End') cible = tabs[tabs.length - 1];
      if (cible) {
        e.preventDefault();
        activer(cible, true);
      }
    });
    tabs.forEach((t) => t.addEventListener('click', () => activer(t, true)));
    return { activer, tabs };
  }

  // Compte à rebours annulable. Retourne une fonction d'annulation.
  function decompte(options) {
    const { element, chiffre, depuis, fin } = options;
    let n = depuis || 3;
    element.hidden = false;
    chiffre.textContent = String(n);
    const minuteur = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        clearInterval(minuteur);
        if (fin) fin();
      } else {
        chiffre.textContent = String(n);
      }
    }, 1000);
    return function annuler() {
      clearInterval(minuteur);
      element.hidden = true;
    };
  }

  // Notification passagère (ne prend pas le focus).
  function notifier(zone, texte) {
    if (!zone) return;
    const p = zone.querySelector('[data-texte]');
    if (p) p.textContent = texte;
    zone.hidden = false;
    clearTimeout(zone._minuteur);
    zone._minuteur = setTimeout(() => { zone.hidden = true; }, 6000);
  }

  const Duo = {
    garde, grille, onglets, decompte, notifier, visible, focusParDefaut, appliquerEtat, dessiner,
    surEtat: null,
    surEchap: null
  };
  window.Duo = Duo;

  document.addEventListener('DOMContentLoaded', () => {
    dessiner(document);
    appliquerEtat();
  });
  window.addEventListener('hashchange', appliquerEtat);
  // Filet de sécurité: si le chargement a retiré le focus (défilement vers une ancre), on le repose.
  window.addEventListener('load', () => {
    if (document.activeElement === document.body) focusParDefaut();
  });
})();
