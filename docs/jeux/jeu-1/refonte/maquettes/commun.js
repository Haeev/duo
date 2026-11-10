/*
 * Maquettes de la refonte: pictos, décor figuré et états par ancre.
 * Tout est dessiné ici en SVG (création du studio): aucune ressource externe.
 * Les dessins tiennent lieu des objets et du décor 3D du jeu (provisoires).
 */
(function () {
  'use strict';

  var S = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  var K = 'stroke="#2a2522" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"';
  var sym = {
    // Pictos au trait
    soleil: '<g ' + S + '><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></g>',
    lune: '<path ' + S + ' d="M19 14.5A8 8 0 0 1 9.5 5a8 8 0 1 0 9.500 9.500z"/>',
    bol: '<g ' + S + '><path d="M3 11h18a9 9 0 0 1-18 0z"/><path d="M9 7c0-2 2-2 2-4M14 7c0-2 2-2 2-4"/></g>',
    goutte: '<path ' + S + ' d="M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z"/>',
    sac: '<g ' + S + '><path d="M6 9h12l1.500 10a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2z"/><path d="M9 9V7a3 3 0 0 1 6 0v2"/><path d="M9 14h6"/></g>',
    plume: '<g ' + S + '><path d="M20 4c-8 0-13 5-14 13l3-3c6 0 10-4 11-10z"/><path d="M4 20l6-8"/></g>',
    gens: '<g ' + S + '><circle cx="9" cy="8" r="3.500"/><path d="M2.500 20c0-4 3-6 6.500-6s6.500 2 6.500 6"/><path d="M17.500 5.500c1-1.500 3.500-1 3.500 1 0 1.500-2 2.800-3.500 4-1.500-1.200-3.500-2.500-3.500-4 0-2 2.500-2.500 3.500-1z"/></g>',
    album: '<g ' + S + '><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M12 8l1.200 2.500 2.800.4-2 2 .5 2.700-2.500-1.300-2.500 1.300.5-2.700-2-2 2.800-.4z"/></g>',
    carte: '<g ' + S + '><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/></g>',
    tenue: '<path ' + S + ' d="M8 3l4 2 4-2 5 4-3 3-2-1v11H8V9l-2 1-3-3z"/>',
    rouage: '<g ' + S + '><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/><circle cx="12" cy="12" r="7"/></g>',
    coeur: '<path fill="currentColor" stroke="#2a2522" stroke-width="1.5" stroke-linejoin="round" d="M12 20.500C5 15.500 3 12 3 8.800 3 6 5 4 7.500 4c1.800 0 3.500 1 4.500 2.800C13 5 14.700 4 16.500 4 19 4 21 6 21 8.800c0 3.200-2 6.700-9 11.700z"/>',
    main: '<path ' + S + ' d="M8 12V5a1.500 1.500 0 0 1 3 0v5V4a1.500 1.500 0 0 1 3 0v6V5.500a1.500 1.500 0 0 1 3 0V14c0 4-2.500 7-6 7-3 0-4.500-1.500-6-4l-2-3.500c-.6-1.200 1-2.300 2-1.300z"/>',
    parler: '<g ' + S + '><path d="M4 5h16v11H11l-5 4v-4H4z"/><path d="M8 9h8M8 12h5"/></g>',
    cadeau: '<g ' + S + '><rect x="4" y="10" width="16" height="10" rx="1"/><path d="M3 7h18v3H3zM12 7v13M12 7c-2-4-6-3-5-1 .5 1 3 1 5 1zm0 0c2-4 6-3 5-1-.5 1-3 1-5 1z"/></g>',
    lit: '<g ' + S + '><path d="M3 18V7M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-8v5"/><circle cx="6.500" cy="11" r="1.500"/></g>',
    etagere: '<g ' + S + '><rect x="3" y="3" width="18" height="18" rx="1"/><path d="M3 12h18M7 12V8h3v4M14 12V7h4v5M7 21v-4h4v4"/></g>',
    fleche: '<path ' + S + ' d="M5 12h14M13 6l6 6-6 6"/>',
    coche: '<path ' + S + ' stroke-width="3" d="M5 12.500l4.500 4.500L19 7"/>',
    cadenas: '<g ' + S + '><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></g>',
    couronne: '<path fill="#e8c77a" ' + K + ' d="M3 18l-1-10 5.500 4L12 5l4.500 7L22 8l-1 10z"/>',
    refus: '<g ' + S + '><circle cx="12" cy="12" r="9"/><path d="M5.500 5.500l13 13"/></g>',
    losange: '<path fill="#e8c77a" ' + K + ' d="M12 2l8 10-8 10-8-10z"/>',
    sortie: '<g ' + S + '><path d="M10 4H5v16h5M10 12h10M16 8l4 4-4 4"/></g>',
    moins: '<path ' + S + ' stroke-width="3" d="M6 12h12"/>',
    plus: '<path ' + S + ' stroke-width="3" d="M6 12h12M12 6v12"/>',
    patte: '<g fill="currentColor"><ellipse cx="12" cy="15.500" rx="5" ry="4"/><circle cx="5.500" cy="10" r="2"/><circle cx="10" cy="6" r="2"/><circle cx="15" cy="6" r="2"/><circle cx="19" cy="10.500" r="2"/></g>',
    // Objets en couleur (tiennent lieu des modèles 3D)
    arrosoir: '<g ' + K + '><path fill="#6f9fb8" d="M6 9h10v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z"/><path fill="none" d="M16 11l5-4M20 5l2.500 3M6 11c-4 0-4 6 0 6"/><path fill="#8fb8cc" d="M6 9h10v3H6z"/></g>',
    houe: '<g ' + K + '><path fill="#a97749" d="M5 21L17 7l1.500 1.500L6.500 22.500z" transform="translate(0 -1.500)"/><path fill="#9aa3a8" d="M15 4l6 2-1 4-5-3z"/></g>',
    hache: '<g ' + K + '><path fill="#a97749" d="M5 20L15 8l1.500 1.500-10 12z"/><path fill="#9aa3a8" d="M13 5c3-2 6-1 8 2-2 1-3 3-3 6-2-1-4-3-5-8z"/></g>',
    canne: '<g ' + K + ' fill="none"><path stroke="#765130" stroke-width="2.500" d="M4 21L18 4"/><path d="M18 4v11c0 2 3 2 3 0"/><circle cx="8" cy="16" r="2" fill="#a4463b"/></g>',
    oeuf: '<path fill="#fbf1dc" ' + K + ' d="M12 3c4 0 7 6 7 10.500a7 7 0 0 1-14 0C5 9 8 3 12 3z"/><path fill="none" stroke="#fff" stroke-width="1.500" stroke-linecap="round" d="M9 9c.500-1.500 1.500-2.500 2.500-3"/>',
    radis: '<g ' + K + '><path fill="#6fa055" d="M12 9c-3-1-5-4-4-6 2 0 4 2 4 4 0-2 2-4 4-4 1 2-1 5-4 6z"/><path fill="#d45a6a" d="M12 9c4 0 6 3 5 6s-3 5-5 7c-2-2-4-4-5-7s1-6 5-6z"/></g>',
    poisson: '<g ' + K + '><path fill="#7fa9c4" d="M3 12c3-5 9-6 13-2l5-4v12l-5-4c-4 4-10 3-13-2z"/><circle cx="7.500" cy="11" r="1" fill="#2a2522"/></g>',
    pain: '<g ' + K + '><path fill="#d9a05b" d="M3 13c0-5 4-7 9-7s9 2 9 7c0 3-2 5-9 5s-9-2-9-5z"/><path fill="none" d="M8 9l1.500 4M12 8.500l1.500 4M16 9l1.500 4"/></g>',
    brioche: '<g ' + K + '><path fill="#c98a45" d="M5 13h14l-2 7H7z"/><path fill="#e2b06a" d="M4 13c0-3 2-4 4-4 0-3 2-4 4-4s4 1 4 4c2 0 4 1 4 4z"/></g>',
    tarte: '<g ' + K + '><path fill="#e2b06a" d="M2 14h20l-3 5H5z"/><path fill="#a4463b" d="M4 14c0-4 4-6 8-6s8 2 8 6z"/><path fill="none" d="M8 14l4-6 4 6"/></g>',
    gateau: '<g ' + K + '><path fill="#f3d9c0" d="M4 12h16v8H4z"/><path fill="#d45a6a" d="M4 12c0-3 3-4 8-4s8 1 8 4c-2 2-3 0-5 1.500-2 1.500-3-1-5 0s-4 .500-6-1.500z"/><path fill="#f4c542" d="M11 4h2v4h-2z"/></g>',
    farine: '<g ' + K + '><path fill="#efe6cf" d="M6 7h12l2 13H4z"/><path fill="#d9ccab" d="M7 3h10l1 4H6z"/><path fill="none" d="M9 13h6"/></g>',
    confiture: '<g ' + K + '><rect x="6" y="8" width="12" height="13" rx="2" fill="#8a3a5c"/><rect x="5" y="4" width="14" height="4" rx="1" fill="#e8c77a"/><rect x="8" y="12" width="8" height="5" fill="#fbf6e9"/></g>',
    lait: '<g ' + K + '><path fill="#fbf6e9" d="M9 3h6v4l2 4v10H7V11l2-4z"/><path fill="#7fa9c4" d="M7 13h10v4H7z"/></g>',
    buche: '<g ' + K + '><rect x="3" y="8" width="16" height="9" rx="4.500" fill="#8a5a33"/><ellipse cx="18" cy="12.500" rx="3" ry="4.500" fill="#d3a66d"/><ellipse cx="18" cy="12.500" rx="1" ry="1.800" fill="none"/></g>',
    planche: '<g ' + K + '><path fill="#d3a66d" d="M2 15L17 5l5 3L7 19z"/><path fill="none" d="M6 14.500l10-6.500M9 16l10-6.500"/></g>',
    pomme: '<g ' + K + '><path fill="#c9483f" d="M12 8c3-2 8-1 8 5s-4 9-8 8c-4 1-8-2-8-8s5-7 8-5z"/><path fill="#6fa055" d="M12 8c0-3 2-5 5-5 0 3-2 5-5 5z"/></g>',
    grain: '<g ' + K + '><path fill="#c9a66b" d="M6 8c-3 5-3 13 1 13h10c4 0 4-8 1-13z"/><path fill="#a97749" d="M8 4h8l2 4H6z"/><path fill="#f4c542" stroke="none" d="M10 13a1 1.500 0 1 0 .01 0M14 12a1 1.500 0 1 0 .01 0M12 16a1 1.500 0 1 0 .01 0"/></g>',
    poule: '<g ' + K + '><path fill="#c9483f" d="M14 4c1-2 3-1 2.500 1 1.500-.500 2 1 1 2z"/><path fill="#fbf1dc" d="M4 10c1 0 2 1 3 3 3-1 6-1 7-4 0-3 4-4 5-1 1 4 0 12-8 12-5 0-8-4-7-10z"/><path fill="#f4c542" d="M19 8.500l3 1-3 1z"/><circle cx="16.500" cy="8" r=".8" fill="#2a2522"/></g>',
  };
  var out = '<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0" aria-hidden="true">';
  Object.keys(sym).forEach(function (id) {
    out += '<symbol id="i-' + id + '" viewBox="0 0 24 24">' + sym[id] + '</symbol>';
  });
  out += '</svg>';
  document.body.insertAdjacentHTML('afterbegin', out);

  // <i data-i="oeuf" class="ic|obj"></i> devient un SVG.
  document.querySelectorAll('[data-i]').forEach(function (el) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', el.className || 'ic');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    if (el.getAttribute('style')) svg.setAttribute('style', el.getAttribute('style'));
    svg.innerHTML = '<use href="#i-' + el.getAttribute('data-i') + '"/>';
    el.replaceWith(svg);
  });

  // Personnage figuré (proportions actuelles gardées, réponse 45).
  function perso(x, y, s, c) {
    return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')" stroke="#2a2522" stroke-width="2" stroke-linejoin="round">' +
      '<ellipse cx="0" cy="2" rx="26" ry="8" fill="rgb(42 37 34 / .25)" stroke="none"/>' +
      '<rect x="-13" y="-52" width="11" height="52" rx="5" fill="' + c.bas + '"/><rect x="2" y="-52" width="11" height="52" rx="5" fill="' + c.bas + '"/>' +
      '<rect x="-19" y="-112" width="38" height="68" rx="14" fill="' + c.haut + '"/>' +
      '<rect x="-28" y="-106" width="11" height="48" rx="5.500" fill="' + c.haut + '"/><rect x="17" y="-106" width="11" height="48" rx="5.500" fill="' + c.haut + '"/>' +
      '<circle cx="0" cy="-134" r="22" fill="' + c.peau + '"/>' +
      '<path d="M-22 -134c-2 -30 46 -30 44 0c-6 -10 -12 -14 -22 -14s-16 4 -22 14z" fill="' + c.cheveux + '"/>' +
      (c.dos ? '<path d="M-22 -136c0 -26 44 -26 44 0v10c-10 8 -34 8 -44 0z" fill="' + c.cheveux + '"/>' : '<circle cx="-8" cy="-132" r="2.500" fill="#2a2522" stroke="none"/><circle cx="8" cy="-132" r="2.500" fill="#2a2522" stroke="none"/><path d="M-6 -122q6 5 12 0" fill="none"/>') +
      '</g>';
  }
  var C = {
    moi: { bas: '#3d5a80', haut: '#5ce1e6', peau: '#e9b98f', cheveux: '#5c3d24', dos: true },
    autre: { bas: '#5b4d40', haut: '#8d6cff', peau: '#b9835a', cheveux: '#2a2522' },
    odette: { bas: '#765130', haut: '#d98a4e', peau: '#f0c9a4', cheveux: '#c9c2b4' },
    anselme: { bas: '#3f6453', haut: '#fbf6e9', peau: '#d9a074', cheveux: '#8a5a33' },
  };

  function arbre(x, y, s) {
    return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')" stroke="#2a2522" stroke-width="2"><rect x="-7" y="-70" width="14" height="72" fill="#765130"/><circle cx="0" cy="-110" r="52" fill="#5f8f4a"/><circle cx="-22" cy="-126" r="20" fill="#74a65a" stroke="none"/></g>';
  }

  var scenes = {
    bourg: function () {
      return '<svg viewBox="0 0 1366 768" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
        '<defs><linearGradient id="ciel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a9d3e6"/><stop offset="1" stop-color="#f3ebd4"/></linearGradient></defs>' +
        '<rect width="1366" height="300" fill="url(#ciel)"/>' +
        '<path d="M0 250q200 -70 420 -20t420 -30t526 30V320H0z" fill="#8fb38a"/>' +
        '<path d="M0 290q340 -40 700 -10t666 -10V768H0z" fill="#9cba6a"/>' +
        '<path d="M560 768C600 560 700 420 900 330l60 0C820 430 800 560 860 768z" fill="#d9b98a" stroke="#b8935f" stroke-width="3"/>' +
        '<g stroke="#2a2522" stroke-width="2.500" stroke-linejoin="round"><path d="M930 180l130 -70l130 70v150H930z" fill="#efe2c4"/><path d="M910 190l150 -90l150 90l-20 14l-130 -74l-130 74z" fill="#a4463b"/><rect x="1030" y="250" width="50" height="80" fill="#765130"/><rect x="960" y="230" width="44" height="44" fill="#bfe0ee"/><rect x="1110" y="230" width="44" height="44" fill="#bfe0ee"/></g>' +
        arbre(180, 360, 1.3) + arbre(1280, 420, 1.5) + arbre(760, 300, 0.7) +
        '<g stroke="#2a2522" stroke-width="2.500"><path d="M250 520l230 -40l90 70l-240 50z" fill="#6b4a2e"/><path d="M290 524l190 -33M330 548l195 -36" stroke="#4d3520" fill="none"/></g>' +
        '<g id="plants" stroke="#2a2522" stroke-width="2" fill="#6fa055"><path d="M330 520q-14 -30 0 -40q14 10 0 40z"/><path d="M400 508q-14 -30 0 -40q14 10 0 40z"/><path d="M470 560q-16 -34 0 -46q16 12 0 46z"/><path d="M395 572q-16 -34 0 -46q16 12 0 46z"/></g>' +
        '<g stroke="#2a2522" stroke-width="2"><path d="M40 470h180M40 500h180" fill="none" stroke="#765130" stroke-width="6"/><path d="M60 450v70M130 450v70M200 450v70" stroke="#765130" stroke-width="8"/></g>' +
        perso(900, 470, 0.85, C.odette) + perso(1090, 560, 1.05, C.autre) + perso(620, 640, 1.35, C.moi) +
        '</svg>';
    },
  };
  document.querySelectorAll('[data-scene]').forEach(function (el) {
    var f = scenes[el.getAttribute('data-scene')];
    if (f) el.innerHTML = f();
  });

  // Buste figuré d'un habitant (tient lieu du buste 3D vivant).
  function buste(c, bouche) {
    return '<svg viewBox="0 0 200 240" aria-hidden="true"><g stroke="#2a2522" stroke-width="3" stroke-linejoin="round">' +
      '<path d="M20 240c0 -50 30 -72 80 -72s80 22 80 72z" fill="' + c.haut + '"/>' +
      '<rect x="86" y="140" width="28" height="36" fill="' + c.peau + '"/>' +
      '<ellipse cx="100" cy="98" rx="56" ry="60" fill="' + c.peau + '"/>' +
      '<path d="M44 96c-8 -78 120 -78 112 0c-14 -30 -30 -40 -56 -40s-42 10 -56 40z" fill="' + c.cheveux + '"/>' +
      '<circle cx="78" cy="100" r="5.500" fill="#2a2522" stroke="none"/><circle cx="122" cy="100" r="5.500" fill="#2a2522" stroke="none"/>' +
      '<path d="M68 86q10 -8 20 -2M112 84q10 -6 20 2" fill="none"/>' +
      '<circle cx="64" cy="118" r="8" fill="#e58f7c" stroke="none" opacity=".6"/><circle cx="136" cy="118" r="8" fill="#e58f7c" stroke="none" opacity=".6"/>' +
      (bouche ? '<ellipse class="bouche" cx="100" cy="128" rx="11" ry="7" fill="#7a2f2a"/>' : '<path d="M84 124q16 14 32 0" fill="none"/>') +
      '</g></svg>';
  }
  document.querySelectorAll('[data-buste]').forEach(function (el) {
    el.innerHTML = buste(C[el.getAttribute('data-buste')], el.hasAttribute('data-parle'));
  });

  // États par ancre: <body data-etat>, éléments [data-si="a b"].
  function etat() {
    var e = location.hash.replace('#', '') || document.body.getAttribute('data-defaut') || '';
    document.body.setAttribute('data-etat', e);
    document.querySelectorAll('[data-si]').forEach(function (el) {
      el.hidden = el.getAttribute('data-si').split(' ').indexOf(e) < 0;
    });
    document.dispatchEvent(new CustomEvent('etat', { detail: e }));
  }
  window.addEventListener('hashchange', etat);
  etat();
  if (new URLSearchParams(location.search).has('reduit')) document.documentElement.setAttribute('data-motion', 'reduced');
})();
