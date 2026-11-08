'use strict';
/*
  Comportement de la maquette du téléphone (ux-telephone.md, sections 4 et 5).
  États par ancre: #accueil, #notif, #commandes, #carte, #remises, #connaitre, #messages,
  #range (téléphone rangé, proposition reçue), #autre (ce que voit l'autre joueur).
  Paramètres: ?taille=125 ou 150 (taille du texte de Duo), ?reduit (réduire les animations).
  Touches lues par position (KeyboardEvent.code), comme dans le jeu.
*/
(function () {
  const APPS = ['accueil', 'commandes', 'reserve', 'catalogue', 'carte', 'remises', 'connaitre', 'bilans', 'projets', 'messages', 'reglages'];
  const NOMS = { accueil: 'Accueil', commandes: 'Commandes', reserve: 'Réserve', catalogue: 'Catalogue', carte: 'Carte et prix', remises: 'Remises', connaitre: 'Faire connaître', bilans: 'Bilans', projets: 'Nos projets', messages: 'Messages', reglages: 'Réglages' };
  const tel = document.querySelector('.tel');
  const corps = document.querySelector('.corps');
  const params = new URLSearchParams(location.search);
  const taille = Number(params.get('taille') || '100');
  document.documentElement.style.setProperty('--ui', String(taille / 100));
  if (params.has('reduit')) document.body.classList.add('reduit');

  // Jetons des joueurs: disque de nuit cerclé d'encre, symbole dans la couleur du profil.
  document.querySelectorAll('[data-joueur]').forEach((el) => {
    const p = window.SYMBOLES_JOUEURS[el.dataset.joueur];
    el.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${p.chemin}" fill="${p.couleur}"/></svg>`;
    if (!el.closest('[aria-hidden]')) el.setAttribute('aria-hidden', 'true');
  });

  let app = 'accueil';
  let pile = [];
  let ouvertA = 0;

  function sorti() { return !tel.hasAttribute('data-range'); }

  function annoncer() {
    // Ce que l'autre joueur lit dans sa carte du HUD (ici simulé dans la même page).
    document.body.dataset.place = sorti() ? `Sur son téléphone : ${NOMS[app]}` : '';
  }

  function montrer(nom, opts) {
    const o = opts || {};
    if (!o.sansPile && nom !== app) pile.push(app);
    app = nom;
    document.querySelectorAll('[data-app]').forEach((s) => { s.hidden = s.dataset.app !== nom; });
    corps.scrollTop = 0;
    annoncer();
    if (!o.sansFocus) focusParDefaut();
  }

  function visibles() {
    return [...tel.querySelectorAll('button:not([disabled]), [tabindex="0"]')].filter((b) => {
      if (b.closest('[hidden]')) return false;
      const r = b.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
  }

  function focusParDefaut() {
    const sec = tel.querySelector(`[data-app="${app}"]`);
    const cible = sec.querySelector('[data-focus]:not([disabled])') || sec.querySelector('button:not([disabled])') || tel.querySelector('[data-aller="accueil"]');
    cible.focus({ preventScroll: true });
    cible.scrollIntoView({ block: 'nearest' });
  }

  function sortir(nom) {
    tel.removeAttribute('data-range');
    document.body.classList.add('tel-sorti');
    document.querySelectorAll('[data-si="range"]').forEach((e) => { e.hidden = true; });
    document.querySelectorAll('[data-si-pas="range"]').forEach((e) => { e.hidden = false; });
    ouvertA = performance.now();
    pile = [];
    montrer(nom || app, { sansPile: true });
  }

  function ranger() {
    tel.setAttribute('data-range', '');
    document.body.classList.remove('tel-sorti');
    document.querySelectorAll('[data-si-pas="range"]').forEach((e) => { e.hidden = true; });
    if (document.activeElement && tel.contains(document.activeElement)) document.activeElement.blur();
    annoncer();
  }

  function retour() {
    if (pile.length > 0) { montrer(pile.pop(), { sansPile: true }); return; }
    if (app !== 'accueil') { montrer('accueil', { sansPile: true }); return; }
    ranger();
  }

  // Navigation spatiale: distance de bord à bord dans l'axe, plus deux fois l'écart de centre en travers.
  function voisin(dx, dy) {
    const cur = document.activeElement;
    const liste = visibles();
    if (!cur || !liste.includes(cur)) { focusParDefaut(); return; }
    const a = cur.getBoundingClientRect();
    let meilleur = null; let score = Infinity;
    for (const b of liste) {
      if (b === cur) continue;
      const r = b.getBoundingClientRect();
      let axe; let travers;
      if (dx !== 0) {
        axe = dx > 0 ? r.left - a.right : a.left - r.right;
        if ((dx > 0 ? r.left + r.width / 2 <= a.left + a.width / 2 : r.left + r.width / 2 >= a.left + a.width / 2)) continue;
        travers = Math.abs((r.top + r.height / 2) - (a.top + a.height / 2));
      } else {
        axe = dy > 0 ? r.top - a.bottom : a.top - r.bottom;
        if ((dy > 0 ? r.top + r.height / 2 <= a.top + a.height / 2 : r.top + r.height / 2 >= a.top + a.height / 2)) continue;
        travers = Math.abs((r.left + r.width / 2) - (a.left + a.width / 2));
      }
      const s = Math.max(axe, 0) + 2 * travers;
      if (s < score) { score = s; meilleur = b; }
    }
    if (meilleur) { meilleur.focus({ preventScroll: true }); meilleur.scrollIntoView({ block: 'nearest' }); }
  }

  const DIRS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0], KeyD: [1, 0] };

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Tab') {
      e.preventDefault();
      if (e.repeat) return;
      if (sorti()) ranger(); else sortir();
      return;
    }
    if (!sorti()) {
      // Téléphone rangé: Entrée va chercher la proposition (elle ne vole jamais le focus).
      if (e.code === 'Enter' && !document.querySelector('.hud__alerte').hidden) { e.preventDefault(); sortir('messages'); }
      return;
    }
    const garde = performance.now() - ouvertA < 300;
    if (e.code === 'Backspace') { e.preventDefault(); retour(); return; }
    if (e.code === 'Home') { e.preventDefault(); montrer('accueil'); return; }
    if (e.code === 'KeyQ' || e.code === 'KeyE') {
      e.preventDefault();
      const i = APPS.indexOf(app);
      const j = (i + (e.code === 'KeyE' ? 1 : -1) + APPS.length) % APPS.length;
      montrer(APPS[j], { sansPile: true });
      return;
    }
    if (DIRS[e.code]) { e.preventDefault(); voisin(DIRS[e.code][0], DIRS[e.code][1]); return; }
    if ((e.code === 'Enter' || e.code === 'Space') && (garde || e.repeat)) { e.preventDefault(); }
    if (e.code === 'Space' && !e.defaultPrevented) {
      e.preventDefault();
      if (document.activeElement && tel.contains(document.activeElement)) document.activeElement.click();
    }
  });

  document.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!sorti()) return;
    if (!tel.contains(e.target)) { ranger(); return; }
    if (!t) return;
    if (t.dataset.aller) {
      if (t.classList.contains('banniere')) t.hidden = true;
      montrer(t.dataset.aller);
    } else if (t.hasAttribute('data-retour')) retour();
    else if (t.getAttribute('role') === 'switch') {
      const v = t.getAttribute('aria-checked') !== 'true';
      t.setAttribute('aria-checked', String(v));
      const lib = t.childNodes[t.childNodes.length - 1];
      if (lib && lib.nodeType === 3 && lib.textContent.trim()) lib.textContent = v ? 'Active' : 'Coupée';
    } else if (t.classList.contains('puce')) {
      const groupe = t.closest('[aria-label="Taux"]');
      if (groupe) groupe.querySelectorAll('.puce').forEach((p) => p.setAttribute('aria-pressed', String(p === t)));
      else t.setAttribute('aria-pressed', String(t.getAttribute('aria-pressed') !== 'true'));
    }
  });

  function etat() {
    const h = (location.hash || '#accueil').slice(1);
    document.querySelector('.banniere').hidden = h !== 'notif';
    document.querySelector('.hud__alerte').hidden = h !== 'range';
    document.querySelector('[data-autre]').textContent = h === 'autre' ? 'Sur son téléphone : Commandes' : 'À la caisse';
    if (h === 'range' || h === 'autre') {
      ranger();
      document.querySelectorAll('[data-si="range"]').forEach((e) => { e.hidden = h !== 'range' && e.classList.contains('hud__alerte'); });
      if (h === 'range') document.querySelector('.hud__alerte').classList.add('vibre');
      return;
    }
    sortir(h === 'notif' ? 'accueil' : (APPS.includes(h) ? h : 'accueil'));
  }
  window.addEventListener('hashchange', etat);
  etat();
  window.Maquette = { app: () => app, sorti, ranger, sortir };
})();
