// Onglet « Carte » du tableau de bord: le plan d'un lieu vu du dessus, à annoter (épingles, traits, flèches,
// mesures, note globale). Les vues viennent de `cartes/index.json` (voir `outils/publier-cartes.mjs`).
// Toutes les vues d'un même lieu partagent leurs remarques: la cible est le lieu, les coordonnées vont de 0 à 1
// sur le plan entier du lieu, et `forme.metres` donne la même position en mètres pour le level designer.
(function () {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var MEMOIRE = 'tdb-carte';
  var ZOOM_MAX = 40; // pixels d'écran par pixel d'image
  var SEUIL_CLIC = 6; // pixels d'écran: en dessous, un appui est un clic et non un glissé

  var OUTILS = [
    {
      id: 'main',
      titre: 'Déplacer',
      aide: 'Glisse pour déplacer le plan. Clique un bâtiment pour lire sa raison d’être.',
    },
    {
      id: 'point',
      titre: 'Épingle',
      aide: 'Clique l’endroit à commenter, puis écris ta remarque.',
    },
    {
      id: 'trait',
      titre: 'Trait',
      aide: 'Dessine à main levée (un chemin à déplacer, une zone à revoir), puis écris ta remarque.',
    },
    {
      id: 'fleche',
      titre: 'Flèche',
      aide: 'Glisse du départ à l’arrivée, ou clique deux points, puis écris ta remarque.',
    },
    {
      id: 'mesure',
      titre: 'Mesurer',
      aide: 'Glisse entre deux points, ou clique deux points: la distance s’affiche en mètres.',
    },
  ];

  var STYLE = [
    '.carte-racine{--c-fond:var(--fond,#14171a);--c-panneau:var(--panneau,#1d2126);--c-creux:var(--creux,var(--fond,#14171a));',
    '--c-texte:var(--texte,#f1ede4);--c-doux:var(--texte-doux,#a9a399);--c-filet:var(--filet,var(--trait,#3a4048));',
    '--c-accent:var(--accent,#f2c14e);--c-sur-accent:var(--sur-accent,#1c1a14);--c-accent-texte:var(--accent-texte,var(--accent,#f2c14e));',
    '--c-danger:var(--alerte,var(--danger,#e5604d));--c-ok:var(--ok,#5fb878);--c-rayon:var(--rayon-petit,8px);',
    // Le plan est une image claire dans les deux thèmes: ce qui se dessine dessus garde des encres fixes.
    '--carte-encre:#241d19;--carte-papier:#fffdf5;--carte-note:#c2185b;--carte-traitee:#2e7d32;--carte-mesure:#0b57d0;--carte-calque:#5b3fb5;',
    'display:grid;gap:12px;color:var(--c-texte);min-width:0}',
    '.carte-barre{display:flex;flex-wrap:wrap;gap:8px;align-items:center}',
    '.carte-groupe{display:flex;flex-wrap:wrap;gap:4px;align-items:center}',
    '.carte-btn{font:inherit;color:var(--c-texte);background:var(--c-panneau);border:1px solid var(--c-filet);border-radius:var(--c-rayon);',
    'padding:8px 12px;min-height:40px;cursor:pointer;line-height:1.2}',
    '.carte-btn:hover{border-color:var(--c-accent-texte)}',
    '.carte-btn[aria-pressed="true"]{background:var(--c-accent);color:var(--c-sur-accent);border-color:var(--c-accent);font-weight:700}',
    '.carte-btn--petit{padding:4px 10px;min-height:32px;font-size:.9em}',
    '.carte-btn--danger{color:var(--c-danger)}',
    '.carte-btn:focus-visible,.carte-select:focus-visible,.carte-svg:focus-visible,.carte-note:focus-visible,.carte-menu summary:focus-visible{outline:3px solid var(--c-accent-texte);outline-offset:2px}',
    '.carte-select{font:inherit;color:var(--c-texte);background:var(--c-panneau);border:1px solid var(--c-filet);border-radius:var(--c-rayon);padding:8px 10px;min-height:40px;max-width:100%}',
    '.carte-etiquette{font-size:.85em;color:var(--c-doux)}',
    '.carte-menu{position:relative}',
    '.carte-menu summary{list-style:none;cursor:pointer;border:1px solid var(--c-filet);border-radius:var(--c-rayon);padding:8px 12px;min-height:40px;box-sizing:border-box;background:var(--c-panneau);display:flex;align-items:center}',
    '.carte-menu summary::-webkit-details-marker{display:none}',
    '.carte-menu[open] summary{border-color:var(--c-accent-texte)}',
    '.carte-menu-corps{position:absolute;z-index:5;top:calc(100% + 4px);left:0;min-width:230px;background:var(--c-panneau);border:1px solid var(--c-filet);border-radius:var(--c-rayon);padding:8px 12px;display:grid;gap:2px;box-shadow:0 8px 24px var(--ombre,rgba(0,0,0,.35))}',
    '.carte-coche{display:flex;gap:8px;align-items:center;min-height:36px;cursor:pointer}',
    '.carte-coche input{width:18px;height:18px;accent-color:var(--c-accent)}',
    '.carte-aide{margin:0;color:var(--c-doux);font-size:.92em;min-height:1.3em}',
    '.carte-corps{display:grid;grid-template-columns:minmax(0,1fr) minmax(260px,340px);gap:12px;align-items:start}',
    '.carte-vue{position:relative;height:clamp(320px,64vh,640px);border:1px solid var(--c-filet);border-radius:var(--c-rayon);overflow:hidden;background:var(--carte-papier)}',
    '.carte-svg{display:block;width:100%;height:100%;touch-action:none;cursor:grab;user-select:none;-webkit-user-select:none}',
    '.carte-svg[data-outil="point"],.carte-svg[data-outil="trait"],.carte-svg[data-outil="fleche"],.carte-svg[data-outil="mesure"]{cursor:crosshair}',
    '.carte-svg[data-glisse="1"]{cursor:grabbing}',
    '.carte-svg text{font-family:inherit;pointer-events:none}',
    '.carte-echelle{position:absolute;left:10px;bottom:10px;pointer-events:none;color:var(--carte-encre);font-size:12px;font-weight:700;text-shadow:0 0 3px var(--carte-papier),0 0 3px var(--carte-papier)}',
    '.carte-echelle-barre{height:6px;border:2px solid var(--carte-encre);border-top:0;margin-top:2px;background:transparent}',
    '.carte-position{position:absolute;right:10px;bottom:10px;pointer-events:none;color:var(--carte-encre);font-size:12px;background:var(--carte-papier);border-radius:6px;padding:2px 6px;opacity:.9}',
    '.carte-zoom{position:absolute;right:10px;top:10px;display:grid;gap:4px}',
    '.carte-zoom .carte-btn{width:40px;padding:0;font-size:1.2em;font-weight:700}',
    '.carte-mire{position:absolute;left:50%;top:50%;width:26px;height:26px;margin:-13px 0 0 -13px;pointer-events:none;display:none;border:2px solid var(--carte-note);border-radius:50%;box-sizing:border-box}',
    '.carte-mire::after{content:"";position:absolute;left:50%;top:50%;width:4px;height:4px;margin:-2px 0 0 -2px;background:var(--carte-note);border-radius:50%}',
    '.carte-vue[data-clavier="1"] .carte-mire{display:block}',
    '.carte-bulle{position:absolute;z-index:3;max-width:min(300px,calc(100% - 20px));background:var(--c-panneau);color:var(--c-texte);border:1px solid var(--c-filet);border-radius:var(--c-rayon);padding:8px 10px;font-size:.9em;box-shadow:0 6px 18px var(--ombre,rgba(0,0,0,.35));pointer-events:none}',
    '.carte-bulle[data-fixe="1"]{pointer-events:auto}',
    '.carte-bulle-sorte{color:var(--c-doux);font-size:.85em}',
    '.carte-bulle-nom{font-weight:700}',
    '.carte-bulle p{margin:4px 0 0}',
    '.carte-panneau{display:grid;gap:10px;min-width:0}',
    '.carte-edition{border:2px solid var(--c-accent-texte);border-radius:var(--c-rayon);padding:10px;background:var(--c-panneau);display:grid;gap:8px}',
    '.carte-edition-titre{margin:0;font-weight:700}',
    '.carte-champ{font:inherit;color:var(--c-texte);background:var(--c-creux);border:1px solid var(--c-filet);border-radius:var(--c-rayon);padding:8px;min-height:84px;width:100%;box-sizing:border-box;resize:vertical}',
    '.carte-resultat{border:1px solid var(--c-filet);border-radius:var(--c-rayon);padding:10px;background:var(--c-panneau);display:grid;gap:8px}',
    '.carte-resultat strong{font-size:1.15em}',
    '.carte-liste{list-style:none;margin:0;padding:0;display:grid;gap:8px;max-height:clamp(220px,52vh,520px);overflow:auto}',
    '.carte-note{border:1px solid var(--c-filet);border-radius:var(--c-rayon);padding:10px;background:var(--c-panneau);display:grid;gap:6px}',
    '.carte-note[data-choisie="1"]{border-color:var(--c-accent-texte);box-shadow:inset 3px 0 0 var(--c-accent-texte)}',
    '.carte-note-tete{display:flex;gap:8px;align-items:center;flex-wrap:wrap}',
    '.carte-num{display:inline-flex;align-items:center;justify-content:center;min-width:26px;height:26px;border-radius:13px;background:var(--carte-note);color:var(--carte-papier);font-weight:700;font-size:.9em;padding:0 6px;box-sizing:border-box}',
    '.carte-num[data-statut="traitee"]{background:var(--carte-traitee)}',
    '.carte-statut{font-size:.8em;border:1px solid var(--c-filet);border-radius:999px;padding:1px 8px;color:var(--c-doux)}',
    '.carte-statut[data-statut="traitee"]{color:var(--c-ok);border-color:var(--c-ok)}',
    '.carte-note-texte{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}',
    '.carte-note-tech{margin:0;color:var(--c-doux);font-size:.85em}',
    '.carte-reponse{margin:0;border-left:3px solid var(--c-ok);padding:4px 8px;background:var(--c-creux);border-radius:0 6px 6px 0;white-space:pre-wrap;overflow-wrap:anywhere}',
    '.carte-reponse b{display:block;font-size:.8em;color:var(--c-ok)}',
    '.carte-vide{margin:0;color:var(--c-doux);border:1px dashed var(--c-filet);border-radius:var(--c-rayon);padding:14px}',
    '.carte-titre{margin:0;font-size:1em;font-family:var(--police-titre,inherit)}',
    '@media (max-width:520px){.carte-groupe .carte-btn{padding:8px 9px;font-size:.92em}.carte-barre>.carte-select{flex:1 1 100%}.carte-barre>#carte-lieu{flex:1 1 120px;min-width:0}}',
    '@media (max-width:820px){.carte-corps{grid-template-columns:minmax(0,1fr)}.carte-vue{height:clamp(300px,56vh,520px)}.carte-liste{max-height:none}}',
    '@media (prefers-reduced-motion:reduce){.carte-racine *{transition:none!important;scroll-behavior:auto!important}}',
  ].join('\n');

  // ---------------------------------------------------------------- petits outils

  function h(balise, attributs) {
    var el = document.createElement(balise);
    var cle;
    for (cle in attributs || {}) {
      if (!Object.prototype.hasOwnProperty.call(attributs, cle)) continue;
      var v = attributs[cle];
      if (v === null || v === undefined || v === false) continue;
      if (cle === 'texte') el.textContent = String(v);
      else if (cle.slice(0, 2) === 'on' && typeof v === 'function')
        el.addEventListener(cle.slice(2), v);
      else el.setAttribute(cle, v === true ? '' : String(v));
    }
    for (var i = 2; i < arguments.length; i += 1) {
      var enfant = arguments[i];
      if (enfant === null || enfant === undefined || enfant === false) continue;
      el.appendChild(typeof enfant === 'string' ? document.createTextNode(enfant) : enfant);
    }
    return el;
  }

  function s(balise, attributs) {
    var el = document.createElementNS(SVG_NS, balise);
    for (var cle in attributs || {}) {
      if (!Object.prototype.hasOwnProperty.call(attributs, cle)) continue;
      if (cle === 'texte') el.textContent = String(attributs[cle]);
      else if (attributs[cle] !== null && attributs[cle] !== undefined)
        el.setAttribute(cle, String(attributs[cle]));
    }
    for (var i = 2; i < arguments.length; i += 1) if (arguments[i]) el.appendChild(arguments[i]);
    return el;
  }

  function vider(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function nombre(v, decimales) {
    return Number(v).toLocaleString('fr-FR', {
      maximumFractionDigits: decimales === undefined ? 1 : decimales,
    });
  }

  function borne(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  function lireMemoire() {
    try {
      return JSON.parse(window.localStorage.getItem(MEMOIRE) || '{}') || {};
    } catch (e) {
      return {};
    }
  }

  function ecrireMemoire(valeur) {
    try {
      window.localStorage.setItem(MEMOIRE, JSON.stringify(valeur));
    } catch (e) {
      // Confort seulement: sans stockage, l'onglet repart de la vue d'ensemble.
    }
  }

  function chargerJson(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(url + ': ' + r.status);
      return r.json();
    });
  }

  /** Allège un tracé à main levée (Ramer, Douglas et Peucker) pour ne stocker que les points utiles. */
  function simplifier(points, tolerance) {
    if (points.length < 3) return points.slice();
    var garde = new Array(points.length).fill(false);
    garde[0] = true;
    garde[points.length - 1] = true;
    var pile = [[0, points.length - 1]];
    while (pile.length) {
      var segment = pile.pop();
      var a = points[segment[0]];
      var b = points[segment[1]];
      var dx = b[0] - a[0];
      var dy = b[1] - a[1];
      var longueur = Math.hypot(dx, dy) || 1e-9;
      var pire = 0;
      var indice = -1;
      for (var i = segment[0] + 1; i < segment[1]; i += 1) {
        var d = Math.abs(dy * (points[i][0] - a[0]) - dx * (points[i][1] - a[1])) / longueur;
        if (d > pire) {
          pire = d;
          indice = i;
        }
      }
      if (indice >= 0 && pire > tolerance) {
        garde[indice] = true;
        pile.push([segment[0], indice], [indice, segment[1]]);
      }
    }
    return points.filter(function (_, i) {
      return garde[i];
    });
  }

  // ---------------------------------------------------------------- l'onglet

  function mount(el, ctx) {
    var style = document.createElement('style');
    style.textContent = STYLE;
    el.appendChild(style);

    var memoire = lireMemoire();
    var etat = {
      index: null,
      carte: null, // vue affichée (entrée de l'index)
      lieu: null, // entrée de l'index
      donnees: null, // lieu.json du lieu affiché
      vue: { x: 0, y: 0, l: 100 }, // fenêtre en pixels d'image: coin haut gauche et largeur
      outil: 'main',
      calques: {},
      traitees: memoire.traitees !== false,
      notes: [],
      choisie: null,
      brouillon: null, // forme en attente de son texte
      mesure: null, // { a: [mx, my], b: [mx, my] }
      attente: null, // premier point d'une flèche ou d'une mesure posée en deux clics
      arret: null, // fonction d'arrêt de l'écoute des remarques
      editeur: null,
    };
    (memoire.calques || []).forEach(function (id) {
      etat.calques[id] = true;
    });
    var donneesParLieu = {};

    // ----- squelette
    var racine = h('div', { class: 'carte-racine' });
    var choix = h('select', {
      id: 'carte-choix',
      class: 'carte-select',
      'aria-label': 'Vue du plan',
    });
    var allerA = h('select', {
      id: 'carte-lieu',
      class: 'carte-select',
      'aria-label': 'Aller à un lieu nommé',
    });
    var groupeOutils = h('div', { class: 'carte-groupe', role: 'group', 'aria-label': 'Outils' });
    var boutons = {};
    OUTILS.forEach(function (o) {
      boutons[o.id] = h('button', {
        type: 'button',
        id: 'carte-outil-' + o.id,
        class: 'carte-btn',
        'aria-pressed': 'false',
        texte: o.titre,
        onclick: function () {
          choisirOutil(o.id);
        },
      });
      groupeOutils.appendChild(boutons[o.id]);
    });
    var boutonGlobale = h('button', {
      type: 'button',
      id: 'carte-note-globale',
      class: 'carte-btn',
      texte: 'Note globale',
      onclick: function () {
        ouvrirBrouillon({ sorte: 'globale' });
      },
    });
    var menuCalques = h(
      'details',
      { class: 'carte-menu', id: 'carte-calques' },
      h('summary', { texte: 'Calques' }),
    );
    var corpsCalques = h('div', { class: 'carte-menu-corps' });
    menuCalques.appendChild(corpsCalques);
    var aide = h('p', { class: 'carte-aide', 'aria-live': 'polite' });

    var svg = s('svg', {
      class: 'carte-svg',
      tabindex: '0',
      role: 'application',
      'aria-label':
        'Plan annotable. Flèches pour déplacer, plus et moins pour zoomer, Entrée pour agir au centre.',
    });
    var image = s('image', { x: 0, y: 0, preserveAspectRatio: 'none' });
    // Rien ne se dessine hors du cadre du plan: une vue de zone a sa légende à côté, qu'il ne faut pas couvrir.
    var decoupe = s('rect', {});
    var gCalques = s('g', { 'pointer-events': 'none', 'clip-path': 'url(#carte-decoupe)' });
    var gNotes = s('g', { 'clip-path': 'url(#carte-decoupe)' });
    var gTemp = s('g', { 'pointer-events': 'none', 'clip-path': 'url(#carte-decoupe)' });
    svg.appendChild(s('defs', {}, s('clipPath', { id: 'carte-decoupe' }, decoupe)));
    svg.appendChild(image);
    svg.appendChild(gCalques);
    svg.appendChild(gNotes);
    svg.appendChild(gTemp);
    var echelleTexte = h('div');
    var echelleBarre = h('div', { class: 'carte-echelle-barre' });
    var echelle = h('div', { class: 'carte-echelle' }, echelleTexte, echelleBarre);
    var position = h('div', { class: 'carte-position', hidden: true });
    var bulle = h('div', { class: 'carte-bulle', hidden: true, role: 'status' });
    var zoom = h(
      'div',
      { class: 'carte-zoom' },
      h('button', {
        type: 'button',
        id: 'carte-zoom-plus',
        class: 'carte-btn',
        'aria-label': 'Zoomer',
        texte: '+',
        onclick: function () {
          zoomer(1.5);
        },
      }),
      h('button', {
        type: 'button',
        id: 'carte-zoom-moins',
        class: 'carte-btn',
        'aria-label': 'Dézoomer',
        texte: '−',
        onclick: function () {
          zoomer(1 / 1.5);
        },
      }),
      h('button', {
        type: 'button',
        id: 'carte-zoom-tout',
        class: 'carte-btn',
        'aria-label': 'Voir tout le plan',
        texte: '⤢',
        onclick: function () {
          cadrerTout();
        },
      }),
    );
    var vue = h(
      'div',
      { class: 'carte-vue' },
      svg,
      h('div', { class: 'carte-mire' }),
      echelle,
      position,
      zoom,
      bulle,
    );

    var zoneEdition = h('div', { hidden: true });
    var zoneResultat = h('div', { hidden: true });
    var titreListe = h('h3', { class: 'carte-titre', texte: 'Tes remarques sur ce plan' });
    var liste = h('ul', { class: 'carte-liste', id: 'carte-remarques' });
    var panneau = h(
      'div',
      { class: 'carte-panneau' },
      zoneEdition,
      zoneResultat,
      titreListe,
      liste,
    );

    racine.appendChild(
      h('div', { class: 'carte-barre' }, choix, groupeOutils, boutonGlobale, menuCalques, allerA),
    );
    racine.appendChild(aide);
    racine.appendChild(h('div', { class: 'carte-corps' }, vue, panneau));
    el.appendChild(racine);

    // ----- conversions
    function versPixels(mx, my) {
      var c = etat.carte;
      return [
        c.cadre.x + ((mx - c.vue.x) / c.vue.largeur) * c.cadre.largeur,
        c.cadre.y + ((my - c.vue.y) / c.vue.hauteur) * c.cadre.hauteur,
      ];
    }
    function versMetres(ix, iy) {
      var c = etat.carte;
      return [
        c.vue.x + ((ix - c.cadre.x) / c.cadre.largeur) * c.vue.largeur,
        c.vue.y + ((iy - c.cadre.y) / c.cadre.hauteur) * c.vue.hauteur,
      ];
    }
    function pixelsParMetre() {
      return etat.carte.cadre.largeur / etat.carte.vue.largeur;
    }
    function ecranVersPixels(cx, cy) {
      var r = svg.getBoundingClientRect();
      var k = etat.vue.l / (r.width || 1);
      return [etat.vue.x + (cx - r.left) * k, etat.vue.y + (cy - r.top) * k];
    }
    function ecranVersMetres(cx, cy) {
      var p = ecranVersPixels(cx, cy);
      return versMetres(p[0], p[1]);
    }
    /** Pixels d'image par pixel d'écran: sert à garder épingles et étiquettes à taille constante. */
    function pas() {
      return etat.vue.l / (svg.clientWidth || 1);
    }
    /** Ramène un point dans la fenêtre de la vue affichée (elle-même dans le lieu). */
    function dansLeLieu(m) {
      var v = etat.carte.vue;
      return [
        borne(m[0], Math.max(0, v.x), Math.min(etat.lieu.largeur, v.x + v.largeur)),
        borne(m[1], Math.max(0, v.y), Math.min(etat.lieu.hauteur, v.y + v.hauteur)),
      ];
    }
    function arrondiMetres(m) {
      return [Math.round(m[0] * 10) / 10, Math.round(m[1] * 10) / 10];
    }
    function normalise(m) {
      return [
        Math.round((m[0] / etat.lieu.largeur) * 1e5) / 1e5,
        Math.round((m[1] / etat.lieu.hauteur) * 1e5) / 1e5,
      ];
    }
    function metresDe(n) {
      return [n[0] * etat.lieu.largeur, n[1] * etat.lieu.hauteur];
    }
    function visibleDansLaVue(m) {
      var v = etat.carte.vue;
      return m[0] >= v.x && m[0] <= v.x + v.largeur && m[1] >= v.y && m[1] <= v.y + v.hauteur;
    }

    // ----- fenêtre (déplacement et zoom)
    function appliquerVue() {
      var l = svg.clientWidth || 1;
      var ht = svg.clientHeight || 1;
      var img = etat.carte.image;
      var lMax = Math.max(img.largeur, (img.hauteur * l) / ht) * 1.15;
      etat.vue.l = borne(etat.vue.l, l / ZOOM_MAX, lMax);
      var hauteur = (etat.vue.l * ht) / l;
      // On garde toujours un bout du plan à l'écran.
      etat.vue.x = borne(etat.vue.x, -etat.vue.l * 0.8, img.largeur - etat.vue.l * 0.2);
      etat.vue.y = borne(etat.vue.y, -hauteur * 0.8, img.hauteur - hauteur * 0.2);
      svg.setAttribute('viewBox', etat.vue.x + ' ' + etat.vue.y + ' ' + etat.vue.l + ' ' + hauteur);
      var k = pas();
      var fixes = svg.querySelectorAll('[data-fx]');
      for (var i = 0; i < fixes.length; i += 1) placerFixe(fixes[i], k);
      majEchelle();
    }
    function placerFixe(g, k) {
      g.setAttribute(
        'transform',
        'translate(' +
          g.dataset.fx +
          ' ' +
          g.dataset.fy +
          ') scale(' +
          k +
          ') rotate(' +
          (g.dataset.fa || 0) +
          ')',
      );
    }
    function fixe(px, attributs, angle) {
      var g = s('g', attributs);
      g.dataset.fx = String(px[0]);
      g.dataset.fy = String(px[1]);
      if (angle) g.dataset.fa = String(angle);
      placerFixe(g, pas());
      return g;
    }
    function cadrerTout() {
      var l = svg.clientWidth || 1;
      var ht = svg.clientHeight || 1;
      var img = etat.carte.image;
      // Sur un écran étroit, on cadre le plan seul: sa légende, à droite, reste à portée d'un glissé.
      var zone =
        l < 600 ? etat.carte.cadre : { x: 0, y: 0, largeur: img.largeur, hauteur: img.hauteur };
      etat.vue.l = Math.max(zone.largeur, (zone.hauteur * l) / ht) * 1.02;
      var hauteur = (etat.vue.l * ht) / l;
      etat.vue.x = zone.x + (zone.largeur - etat.vue.l) / 2;
      etat.vue.y = zone.y + (zone.hauteur - hauteur) / 2;
      appliquerVue();
    }
    function zoomer(facteur, cx, cy) {
      var r = svg.getBoundingClientRect();
      if (cx === undefined) {
        cx = r.left + r.width / 2;
        cy = r.top + r.height / 2;
      }
      var avant = ecranVersPixels(cx, cy);
      etat.vue.l = borne(etat.vue.l / facteur, r.width / ZOOM_MAX, etat.carte.image.largeur * 4);
      var k = etat.vue.l / (r.width || 1);
      etat.vue.x = avant[0] - (cx - r.left) * k;
      etat.vue.y = avant[1] - (cy - r.top) * k;
      appliquerVue();
    }
    function centrerSur(m, largeurMetres) {
      var p = versPixels(m[0], m[1]);
      var l = svg.clientWidth || 1;
      var ht = svg.clientHeight || 1;
      if (largeurMetres) etat.vue.l = largeurMetres * pixelsParMetre();
      etat.vue.x = p[0] - etat.vue.l / 2;
      etat.vue.y = p[1] - (etat.vue.l * ht) / l / 2;
      appliquerVue();
    }
    function majEchelle() {
      var pxEcranParMetre = pixelsParMetre() / pas();
      var pasMetres = [1, 2, 5, 10, 20, 50, 100, 200, 500];
      var choisi = pasMetres[pasMetres.length - 1];
      for (var i = 0; i < pasMetres.length; i += 1) {
        if (pasMetres[i] * pxEcranParMetre >= 70) {
          choisi = pasMetres[i];
          break;
        }
      }
      echelleBarre.style.width = Math.round(choisi * pxEcranParMetre) + 'px';
      var marche = etat.lieu && etat.lieu.vitesses && etat.lieu.vitesses.marche;
      echelleTexte.textContent =
        choisi + ' m' + (marche ? ' (' + nombre(choisi / marche, 0) + ' s de marche)' : '');
    }

    // ----- calques et lieux nommés
    function dessinerCalques() {
      vider(gCalques);
      if (!etat.donnees) return;
      var ppm = pixelsParMetre();
      if (etat.calques.chemins) {
        etat.donnees.chemins.forEach(function (c) {
          var a = versPixels(c.a[0], c.a[1]);
          var b = versPixels(c.b[0], c.b[1]);
          gCalques.appendChild(
            s('line', {
              x1: a[0],
              y1: a[1],
              x2: b[0],
              y2: b[1],
              stroke: c.verrou ? 'var(--carte-note)' : 'var(--carte-calque)',
              'stroke-width': c.classe === 'sentier' ? 2 : 3,
              'stroke-dasharray': c.classe === 'sentier' ? '6 5' : null,
              'stroke-linecap': 'round',
              'vector-effect': 'non-scaling-stroke',
              opacity: 0.85,
            }),
          );
        });
      }
      etat.donnees.elements.forEach(function (e) {
        if (!etat.calques[e.calque]) return;
        if (e.rect) {
          var coin = versPixels(e.rect[0], e.rect[1]);
          gCalques.appendChild(
            s('rect', {
              x: coin[0],
              y: coin[1],
              width: e.rect[2] * ppm,
              height: e.rect[3] * ppm,
              fill: 'var(--carte-calque)',
              'fill-opacity': 0.16,
              stroke: 'var(--carte-calque)',
              'stroke-width': 2,
              'stroke-dasharray': e.calque === 'ressources' ? '5 4' : null,
              'vector-effect': 'non-scaling-stroke',
            }),
          );
          return;
        }
        var g = fixe(versPixels(e.x, e.y));
        if (e.calque === 'verrous') {
          g.appendChild(
            s('rect', {
              x: -9,
              y: -9,
              width: 18,
              height: 18,
              rx: 3,
              fill: 'var(--carte-papier)',
              stroke: 'var(--carte-note)',
              'stroke-width': 2.5,
            }),
          );
          g.appendChild(
            s('text', {
              x: 0,
              y: 4,
              'text-anchor': 'middle',
              'font-size': 11,
              'font-weight': 700,
              fill: 'var(--carte-note)',
              texte: 'V',
            }),
          );
        } else if (e.calque === 'ressources') {
          g.appendChild(
            s('circle', {
              r: 8,
              fill: 'var(--carte-papier)',
              stroke: 'var(--carte-calque)',
              'stroke-width': 2,
            }),
          );
          var initiale = /\((.)/.exec(e.sorte);
          g.appendChild(
            s('text', {
              x: 0,
              y: 4,
              'text-anchor': 'middle',
              'font-size': 10,
              'font-weight': 700,
              fill: 'var(--carte-calque)',
              texte: initiale ? initiale[1].toUpperCase() : 'R',
            }),
          );
        } else if (e.calque === 'points') {
          g.appendChild(
            s('circle', {
              r: 5,
              fill: 'var(--carte-calque)',
              stroke: 'var(--carte-papier)',
              'stroke-width': 1.5,
            }),
          );
        } else {
          g.appendChild(
            s('path', {
              d: 'M0,-9 L9,0 L0,9 L-9,0 Z',
              fill: 'var(--carte-papier)',
              stroke: 'var(--carte-calque)',
              'stroke-width': 2.5,
            }),
          );
        }
        gCalques.appendChild(g);
      });
    }

    /** Lieu nommé sous un point en mètres: un rectangle qui le contient, sinon le repère le plus proche. */
    function lieuSous(m, rayonMetres) {
      if (!etat.donnees) return null;
      var trouve = null;
      var meilleur = Infinity;
      etat.donnees.elements.forEach(function (e) {
        var d;
        if (e.rect) {
          var dedans =
            m[0] >= e.rect[0] &&
            m[0] <= e.rect[0] + e.rect[2] &&
            m[1] >= e.rect[1] &&
            m[1] <= e.rect[1] + e.rect[3];
          if (!dedans) return;
          // Un bâtiment prime sur les repères voisins; le plus petit rectangle gagne.
          d = -1 / (1 + e.rect[2] * e.rect[3]) - (e.calque === 'batiments' ? 1 : 0);
        } else {
          d = Math.hypot(e.x - m[0], e.y - m[1]);
          if (d > Math.max(rayonMetres, e.r || 0)) return;
          // Un calque masqué ne répond qu'à défaut d'autre chose (les bâtiments répondent toujours).
          if (!etat.calques[e.calque] && e.calque !== 'batiments') d += rayonMetres;
        }
        if (d < meilleur) {
          meilleur = d;
          trouve = e;
        }
      });
      return trouve;
    }
    function batimentProche(m) {
      if (!etat.donnees) return null;
      var trouve = null;
      var meilleur = 15;
      etat.donnees.elements.forEach(function (e) {
        if (e.calque !== 'batiments') return;
        var d = e.rect
          ? Math.hypot(
              Math.max(e.rect[0] - m[0], 0, m[0] - e.rect[0] - e.rect[2]),
              Math.max(e.rect[1] - m[1], 0, m[1] - e.rect[1] - e.rect[3]),
            )
          : Math.hypot(e.x - m[0], e.y - m[1]);
        if (d < meilleur) {
          meilleur = d;
          trouve = e;
        }
      });
      return trouve ? trouve.nom : null;
    }
    function montrerBulle(e, cx, cy, fixee) {
      if (!e) {
        if (!fixee && bulle.dataset.fixe === '1') return;
        bulle.hidden = true;
        bulle.dataset.fixe = '0';
        return;
      }
      if (!fixee && bulle.dataset.fixe === '1') return;
      vider(bulle);
      bulle.appendChild(
        h('div', {
          class: 'carte-bulle-sorte',
          texte: e.sorte + (e.acte ? ' · ouvert à l’acte ' + e.acte : ''),
        }),
      );
      bulle.appendChild(h('div', { class: 'carte-bulle-nom', texte: e.nom }));
      if (e.texte) bulle.appendChild(h('p', { texte: e.texte }));
      bulle.dataset.fixe = fixee ? '1' : '0';
      bulle.hidden = false;
      var r = vue.getBoundingClientRect();
      var x = borne(cx - r.left + 14, 8, Math.max(8, r.width - bulle.offsetWidth - 8));
      var y = cy - r.top + 16;
      if (y + bulle.offsetHeight > r.height - 8)
        y = Math.max(8, cy - r.top - bulle.offsetHeight - 12);
      bulle.style.left = x + 'px';
      bulle.style.top = y + 'px';
    }

    // ----- remarques
    function numeroDe(note) {
      return etat.notes.indexOf(note) + 1;
    }
    function couleurDe(note) {
      return note.statut === 'traitee' ? 'var(--carte-traitee)' : 'var(--carte-note)';
    }
    function pastille(px, numero, couleur, choisie) {
      var g = fixe(px, { style: 'cursor:pointer' });
      var texte = String(numero);
      var demi = Math.max(12, 5 + texte.length * 4.2);
      if (choisie)
        g.appendChild(
          s('rect', {
            x: -demi - 5,
            y: -17,
            width: demi * 2 + 10,
            height: 34,
            rx: 17,
            fill: 'none',
            stroke: couleur,
            'stroke-width': 2.5,
          }),
        );
      g.appendChild(
        s('rect', {
          x: -demi,
          y: -12,
          width: demi * 2,
          height: 24,
          rx: 12,
          fill: couleur,
          stroke: 'var(--carte-papier)',
          'stroke-width': 2,
        }),
      );
      g.appendChild(
        s('text', {
          x: 0,
          y: 4.5,
          'text-anchor': 'middle',
          'font-size': 13,
          'font-weight': 700,
          fill: 'var(--carte-papier)',
          texte: texte,
        }),
      );
      return g;
    }
    function tracer(groupe, pointsMetres, couleur, enFleche, epaisseur) {
      var px = pointsMetres.map(function (m) {
        return versPixels(m[0], m[1]);
      });
      var d = px
        .map(function (p, i) {
          return (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1);
        })
        .join(' ');
      // Liseré clair sous le trait: il reste lisible sur les aplats sombres du plan.
      groupe.appendChild(
        s('path', {
          d: d,
          fill: 'none',
          stroke: 'var(--carte-papier)',
          'stroke-width': epaisseur + 3,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          'vector-effect': 'non-scaling-stroke',
          opacity: 0.85,
        }),
      );
      groupe.appendChild(
        s('path', {
          d: d,
          fill: 'none',
          stroke: couleur,
          'stroke-width': epaisseur,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          'vector-effect': 'non-scaling-stroke',
        }),
      );
      if (enFleche && px.length >= 2) {
        var a = px[px.length - 2];
        var b = px[px.length - 1];
        var pointe = fixe(b, null, (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI);
        pointe.appendChild(
          s('path', {
            d: 'M4,0 L-13,-8 L-9,0 L-13,8 Z',
            fill: couleur,
            stroke: 'var(--carte-papier)',
            'stroke-width': 1.5,
            'stroke-linejoin': 'round',
          }),
        );
        groupe.appendChild(pointe);
      }
      return px;
    }
    function pointsDe(forme) {
      if (forme.sorte === 'point') return [metresDe([forme.x, forme.y])];
      if (forme.sorte === 'trait' && Array.isArray(forme.points)) return forme.points.map(metresDe);
      return [];
    }
    function dessinerNotes() {
      vider(gNotes);
      etat.notes.forEach(function (note) {
        var forme = note.forme || {};
        if (note.statut === 'traitee' && !etat.traitees) return;
        var pts = pointsDe(forme);
        if (!pts.length) return;
        var choisie = etat.choisie === note.id;
        var groupe = s('g', { 'data-note': note.id });
        var ancre;
        if (forme.sorte === 'trait') {
          var px = tracer(groupe, pts, couleurDe(note), forme.fleche === true, choisie ? 5 : 3.5);
          ancre = px[0];
        } else {
          ancre = versPixels(pts[0][0], pts[0][1]);
        }
        var p = pastille(ancre, numeroDe(note), couleurDe(note), choisie);
        p.appendChild(
          s('title', { texte: 'Remarque ' + numeroDe(note) + ': ' + (note.texte || '') }),
        );
        groupe.appendChild(p);
        groupe.addEventListener('click', function (ev) {
          ev.stopPropagation();
          choisir(note.id, false);
        });
        gNotes.appendChild(groupe);
      });
    }
    function texteTechnique(forme) {
      if (!forme || forme.sorte === 'globale') return 'Note globale sur le plan';
      var pts = pointsDe(forme);
      if (!pts.length) return '';
      var debut = 'x ' + nombre(pts[0][0]) + ' m, y ' + nombre(pts[0][1]) + ' m';
      var pres = forme.pres ? ' · près de: ' + forme.pres : '';
      if (forme.sorte === 'point') return 'Épingle · ' + debut + pres;
      var fin = pts[pts.length - 1];
      var longueur = 0;
      for (var i = 1; i < pts.length; i += 1)
        longueur += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      return (
        (forme.fleche ? 'Flèche' : 'Trait') +
        ' · de ' +
        debut +
        ' à x ' +
        nombre(fin[0]) +
        ' m, y ' +
        nombre(fin[1]) +
        ' m · ' +
        nombre(longueur) +
        ' m' +
        pres
      );
    }
    function dateLisible(v) {
      if (!v) return '';
      if (ctx.ui && typeof ctx.ui.date === 'function') {
        try {
          return String(ctx.ui.date(v));
        } catch (e) {
          // Repli ci-dessous.
        }
      }
      var d = new Date(v);
      return Number.isNaN(d.getTime())
        ? String(v)
        : d.toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Europe/Paris',
          });
    }
    function dessinerListe() {
      vider(liste);
      if (!etat.notes.length) {
        liste.appendChild(
          h(
            'li',
            {},
            h('p', {
              class: 'carte-vide',
              texte:
                'Aucune remarque pour l’instant. Choisis « Épingle », « Trait » ou « Flèche », puis pointe l’endroit à revoir. « Note globale » sert pour un avis sur tout le plan.',
            }),
          ),
        );
        return;
      }
      etat.notes.forEach(function (note) {
        var traitee = note.statut === 'traitee';
        var localisee = pointsDe(note.forme || {}).length > 0;
        var actions = h('div', { class: 'carte-groupe' });
        if (localisee)
          actions.appendChild(
            h('button', {
              type: 'button',
              class: 'carte-btn carte-btn--petit',
              texte: 'Voir sur le plan',
              onclick: function () {
                choisir(note.id, true);
              },
            }),
          );
        if (!traitee) {
          actions.appendChild(
            h('button', {
              type: 'button',
              class: 'carte-btn carte-btn--petit',
              texte: 'C’est réglé',
              onclick: function () {
                Promise.resolve(ctx.notes.resolve(note.id)).then(function (ok) {
                  if (ok && ctx.ui && ctx.ui.toast)
                    ctx.ui.toast('Remarque ' + numeroDe(note) + ' marquée comme traitée.');
                });
              },
            }),
          );
        }
        actions.appendChild(
          h('button', {
            type: 'button',
            class: 'carte-btn carte-btn--petit carte-btn--danger',
            texte: 'Supprimer',
            onclick: function () {
              supprimer(note);
            },
          }),
        );
        var item = h(
          'li',
          {
            class: 'carte-note',
            'data-note': note.id,
            'data-choisie': etat.choisie === note.id ? '1' : '0',
            tabindex: '-1',
          },
          h(
            'div',
            { class: 'carte-note-tete' },
            h('span', {
              class: 'carte-num',
              'data-statut': note.statut || 'ouverte',
              texte: String(numeroDe(note)),
            }),
            h('span', {
              class: 'carte-statut',
              'data-statut': note.statut || 'ouverte',
              texte: traitee ? 'Traitée' : 'Ouverte',
            }),
            h('span', { class: 'carte-etiquette', texte: dateLisible(note.creeLe) }),
          ),
          h('p', { class: 'carte-note-texte', texte: note.texte || '' }),
          h('p', { class: 'carte-note-tech', texte: texteTechnique(note.forme) }),
          note.reponseManager
            ? h(
                'p',
                { class: 'carte-reponse' },
                h('b', { texte: 'Réponse du studio' }),
                String(note.reponseManager),
              )
            : null,
          actions,
        );
        liste.appendChild(item);
      });
    }
    function supprimer(note) {
      var question = 'Supprimer la remarque ' + numeroDe(note) + ' ? Cette action est définitive.';
      var demande =
        ctx.ui && typeof ctx.ui.confirm === 'function'
          ? ctx.ui.confirm(question, { ok: 'Supprimer', annuler: 'Garder' })
          : Promise.resolve(false);
      Promise.resolve(demande).then(function (oui) {
        if (!oui) return;
        if (etat.choisie === note.id) etat.choisie = null;
        ctx.notes.remove(note.id);
      });
    }
    function choisir(id, recadrer) {
      etat.choisie = id;
      var note = etat.notes.filter(function (n) {
        return n.id === id;
      })[0];
      if (note && recadrer) {
        var pts = pointsDe(note.forme || {});
        if (pts.length) {
          // Une remarque posée hors de la vue courante ramène à la première vue qui la contient.
          if (!visibleDansLaVue(pts[0])) {
            var autre = etat.index.cartes.filter(function (c) {
              var v = c.vue;
              return (
                c.lieu === etat.lieu.id &&
                pts[0][0] >= v.x &&
                pts[0][0] <= v.x + v.largeur &&
                pts[0][1] >= v.y &&
                pts[0][1] <= v.y + v.hauteur
              );
            })[0];
            if (autre) {
              ouvrirCarte(autre.id).then(function () {
                choisir(id, true);
              });
              return;
            }
          }
          var minX = Infinity,
            maxX = -Infinity,
            minY = Infinity,
            maxY = -Infinity;
          pts.forEach(function (p) {
            minX = Math.min(minX, p[0]);
            maxX = Math.max(maxX, p[0]);
            minY = Math.min(minY, p[1]);
            maxY = Math.max(maxY, p[1]);
          });
          centrerSur(
            [(minX + maxX) / 2, (minY + maxY) / 2],
            Math.max(60, (maxX - minX) * 1.8, (maxY - minY) * 2.4),
          );
          vue.scrollIntoView({ block: 'nearest' });
        }
      }
      dessinerNotes();
      dessinerListe();
      if (!recadrer) {
        var item = liste.querySelector('[data-note="' + String(id).replace(/"/g, '') + '"]');
        if (item) item.scrollIntoView({ block: 'nearest' });
      }
    }

    // ----- brouillon (forme posée, texte en attente) et mesure
    function dessinerTemp(apercu) {
      vider(gTemp);
      var b = etat.brouillon;
      if (b && b.sorte === 'point')
        gTemp.appendChild(
          pastille(
            versPixels(b.metres[0], b.metres[1]),
            etat.notes.length + 1,
            'var(--carte-note)',
            true,
          ),
        );
      if (b && b.sorte === 'trait') {
        var px = tracer(gTemp, b.metresPoints, 'var(--carte-note)', b.fleche, 4);
        gTemp.appendChild(pastille(px[0], etat.notes.length + 1, 'var(--carte-note)', true));
      }
      if (apercu)
        tracer(
          gTemp,
          apercu.points,
          apercu.mesure ? 'var(--carte-mesure)' : 'var(--carte-note)',
          apercu.fleche,
          3.5,
        );
      if (etat.attente) {
        var pa = fixe(versPixels(etat.attente[0], etat.attente[1]));
        pa.appendChild(
          s('circle', {
            r: 6,
            fill: 'var(--carte-papier)',
            stroke: etat.outil === 'mesure' ? 'var(--carte-mesure)' : 'var(--carte-note)',
            'stroke-width': 3,
          }),
        );
        gTemp.appendChild(pa);
      }
      var m = apercu && apercu.mesure ? { a: apercu.points[0], b: apercu.points[1] } : etat.mesure;
      if (m) {
        if (!apercu) tracer(gTemp, [m.a, m.b], 'var(--carte-mesure)', false, 3.5);
        [m.a, m.b].forEach(function (p) {
          var bout = fixe(versPixels(p[0], p[1]));
          bout.appendChild(
            s('circle', {
              r: 5,
              fill: 'var(--carte-papier)',
              stroke: 'var(--carte-mesure)',
              'stroke-width': 3,
            }),
          );
          gTemp.appendChild(bout);
        });
        var milieu = fixe(versPixels((m.a[0] + m.b[0]) / 2, (m.a[1] + m.b[1]) / 2));
        var texte = nombre(Math.hypot(m.b[0] - m.a[0], m.b[1] - m.a[1])) + ' m';
        var demi = 8 + texte.length * 3.6;
        milieu.appendChild(
          s('rect', {
            x: -demi,
            y: -30,
            width: demi * 2,
            height: 20,
            rx: 6,
            fill: 'var(--carte-mesure)',
            stroke: 'var(--carte-papier)',
            'stroke-width': 1.5,
          }),
        );
        milieu.appendChild(
          s('text', {
            x: 0,
            y: -16,
            'text-anchor': 'middle',
            'font-size': 12,
            'font-weight': 700,
            fill: 'var(--carte-papier)',
            texte: texte,
          }),
        );
        gTemp.appendChild(milieu);
      }
    }
    function fermerEdition() {
      if (etat.editeur && typeof etat.editeur.destroy === 'function') etat.editeur.destroy();
      etat.editeur = null;
      etat.brouillon = null;
      vider(zoneEdition);
      zoneEdition.hidden = true;
      dessinerTemp();
    }
    function formeDuBrouillon(b) {
      if (b.sorte === 'globale') return { sorte: 'globale', vue: etat.carte.id };
      var pres = batimentProche(b.sorte === 'point' ? b.metres : b.metresPoints[0]);
      if (b.sorte === 'point') {
        var n = normalise(b.metres);
        var point = {
          sorte: 'point',
          x: n[0],
          y: n[1],
          metres: arrondiMetres(b.metres),
          vue: etat.carte.id,
        };
        if (pres) point.pres = pres;
        return point;
      }
      var trait = {
        sorte: 'trait',
        points: b.metresPoints.map(normalise),
        metres: b.metresPoints.map(arrondiMetres),
        fleche: b.fleche === true,
        vue: etat.carte.id,
      };
      if (pres) trait.pres = pres;
      return trait;
    }
    function ouvrirBrouillon(b, texteInitial) {
      fermerEdition();
      montrerBulle(null, 0, 0, true);
      etat.brouillon = b;
      etat.attente = null;
      var forme = formeDuBrouillon(b);
      var titre =
        b.sorte === 'globale'
          ? 'Note globale sur ce plan'
          : 'Remarque ' + (etat.notes.length + 1) + ' (' + texteTechnique(forme) + ')';
      var corps = h('div');
      var annuler = h('button', {
        type: 'button',
        class: 'carte-btn carte-btn--petit',
        texte: 'Abandonner cette remarque',
        onclick: fermerEdition,
      });
      zoneEdition.appendChild(
        h(
          'div',
          { class: 'carte-edition' },
          h('p', { class: 'carte-edition-titre', texte: titre }),
          corps,
          annuler,
        ),
      );
      zoneEdition.hidden = false;
      var envoyer = function (texte) {
        var propre = String(texte || '').trim();
        if (!propre) return false;
        return Promise.resolve(
          ctx.notes.add({
            cible: { type: 'carte', id: etat.lieu.id },
            forme: forme,
            texte: propre,
          }),
        ).then(function (id) {
          if (!id) return false;
          fermerEdition();
          if (b.sorte !== 'globale') etat.choisie = id;
          if (ctx.ui && ctx.ui.toast) ctx.ui.toast('Remarque enregistrée.');
          dessinerNotes();
          dessinerListe();
          return true;
        });
      };
      var options = {
        onSubmit: envoyer,
        onCancel: fermerEdition,
        label: 'Ta remarque',
        placeholder:
          b.sorte === 'globale'
            ? 'Ton avis d’ensemble sur ce plan'
            : 'Ce qu’il faut changer ici, et pourquoi',
        bouton: 'Enregistrer',
        valeur: texteInitial || '',
      };
      if (ctx.ui && typeof ctx.ui.noteEditor === 'function') {
        etat.editeur = ctx.ui.noteEditor(corps, options) || null;
      } else {
        // Repli si le socle n'offre pas d'éditeur: un champ simple, mêmes raccourcis.
        var champ = h('textarea', {
          id: 'carte-remarque',
          class: 'carte-champ',
          placeholder: options.placeholder,
          'aria-label': options.label,
        });
        champ.value = options.valeur;
        champ.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) envoyer(champ.value);
          if (ev.key === 'Escape') fermerEdition();
        });
        corps.appendChild(champ);
        corps.appendChild(
          h('button', {
            type: 'button',
            class: 'carte-btn',
            texte: options.bouton,
            onclick: function () {
              envoyer(champ.value);
            },
          }),
        );
        etat.editeur = {
          focus: function () {
            champ.focus();
          },
        };
      }
      dessinerTemp();
      zoneEdition.scrollIntoView({ block: 'nearest' });
      if (etat.editeur && typeof etat.editeur.focus === 'function') etat.editeur.focus();
    }
    function montrerMesure() {
      vider(zoneResultat);
      zoneResultat.hidden = !etat.mesure;
      if (!etat.mesure) return;
      var m = etat.mesure;
      var d = Math.hypot(m.b[0] - m.a[0], m.b[1] - m.a[1]);
      var v = (etat.lieu && etat.lieu.vitesses) || {};
      var temps = [];
      if (v.marche) temps.push(nombre(d / v.marche, 0) + ' s de marche');
      if (v.course) temps.push(nombre(d / v.course, 0) + ' s en courant');
      zoneResultat.appendChild(
        h(
          'div',
          { class: 'carte-resultat', role: 'status' },
          h('strong', { texte: 'Distance: ' + nombre(d) + ' m' }),
          temps.length
            ? h('span', { class: 'carte-etiquette', texte: 'Soit ' + temps.join(', ') + '.' })
            : null,
          h(
            'div',
            { class: 'carte-groupe' },
            h('button', {
              type: 'button',
              id: 'carte-mesure-annoter',
              class: 'carte-btn carte-btn--petit',
              texte: 'En faire une remarque',
              onclick: function () {
                var points = [m.a, m.b];
                etat.mesure = null;
                montrerMesure();
                ouvrirBrouillon(
                  { sorte: 'trait', metresPoints: points, fleche: false },
                  'Distance mesurée: ' + nombre(d) + ' m. ',
                );
              },
            }),
            h('button', {
              type: 'button',
              id: 'carte-mesure-effacer',
              class: 'carte-btn carte-btn--petit',
              texte: 'Effacer la mesure',
              onclick: function () {
                etat.mesure = null;
                montrerMesure();
                dessinerTemp();
              },
            }),
          ),
        ),
      );
    }

    // ----- outils
    function choisirOutil(id) {
      etat.outil = id;
      etat.attente = null;
      montrerBulle(null, 0, 0, true);
      svg.dataset.outil = id;
      OUTILS.forEach(function (o) {
        boutons[o.id].setAttribute('aria-pressed', o.id === id ? 'true' : 'false');
        if (o.id === id) aide.textContent = o.aide;
      });
      dessinerTemp();
    }
    /** Termine un outil à deux points (flèche ou mesure). */
    function finirDeuxPoints(a, b) {
      etat.attente = null;
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.2) {
        dessinerTemp();
        return;
      }
      if (etat.outil === 'mesure') {
        etat.mesure = { a: a, b: b };
        montrerMesure();
        dessinerTemp();
      } else {
        ouvrirBrouillon({ sorte: 'trait', metresPoints: [a, b], fleche: true });
      }
    }
    /** Action de l'outil courant sur un point (clic sans glissé, ou Entrée au centre de la vue). */
    function agirSur(m, cx, cy) {
      if (etat.outil === 'main') {
        var e = lieuSous(m, (12 * pas()) / pixelsParMetre());
        montrerBulle(e, cx, cy, true);
        return;
      }
      var p = dansLeLieu(m);
      if (etat.outil === 'point' || etat.outil === 'trait') {
        // Un simple clic avec l'outil « Trait » pose une épingle: rien n'est perdu.
        ouvrirBrouillon({ sorte: 'point', metres: p });
        return;
      }
      if (etat.attente) finirDeuxPoints(etat.attente, p);
      else {
        etat.attente = p;
        if (etat.outil === 'mesure') {
          etat.mesure = null;
          montrerMesure();
        }
        aide.textContent = 'Premier point posé. Clique le second point.';
        dessinerTemp();
      }
    }

    // ----- pointeurs: un doigt ou la souris agit, deux doigts déplacent et zooment
    var pointeurs = new Map();
    var geste = null;
    function debutPincement() {
      var pts = Array.from(pointeurs.values());
      geste = {
        sorte: 'pince',
        ecart: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1,
        cx: (pts[0].x + pts[1].x) / 2,
        cy: (pts[0].y + pts[1].y) / 2,
      };
      dessinerTemp();
    }
    svg.addEventListener('pointerdown', function (ev) {
      if (ev.pointerType === 'mouse' && ev.button !== 0 && ev.button !== 1) return;
      try {
        svg.setPointerCapture(ev.pointerId);
      } catch (e) {
        // Pointeur déjà relâché: sans capture, le geste s'arrête au bord de la vue.
      }
      pointeurs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (pointeurs.size === 2) {
        debutPincement();
        return;
      }
      if (pointeurs.size > 2) return;
      var deplacer = etat.outil === 'main' || ev.button === 1;
      geste = {
        sorte: deplacer ? 'glisse' : etat.outil,
        x0: ev.clientX,
        y0: ev.clientY,
        x: ev.clientX,
        y: ev.clientY,
        bouge: false,
        depart: dansLeLieu(ecranVersMetres(ev.clientX, ev.clientY)),
        points: [],
      };
      if (geste.sorte === 'trait') geste.points.push(geste.depart);
      if (ev.button === 1) ev.preventDefault();
    });
    svg.addEventListener('pointermove', function (ev) {
      var connu = pointeurs.get(ev.pointerId);
      if (connu) {
        connu.x = ev.clientX;
        connu.y = ev.clientY;
      }
      var m = ecranVersMetres(ev.clientX, ev.clientY);
      if (ev.pointerType === 'mouse') {
        position.hidden = false;
        position.textContent = 'x ' + nombre(m[0], 0) + ' m, y ' + nombre(m[1], 0) + ' m';
      }
      if (!geste || !connu) {
        if (ev.pointerType === 'mouse')
          montrerBulle(lieuSous(m, (10 * pas()) / pixelsParMetre()), ev.clientX, ev.clientY, false);
        return;
      }
      if (geste.sorte === 'pince') {
        if (pointeurs.size < 2) return;
        var pts = Array.from(pointeurs.values());
        var ecart = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
        var cx = (pts[0].x + pts[1].x) / 2;
        var cy = (pts[0].y + pts[1].y) / 2;
        var k = pas();
        etat.vue.x -= (cx - geste.cx) * k;
        etat.vue.y -= (cy - geste.cy) * k;
        zoomer(ecart / geste.ecart, cx, cy);
        geste.ecart = ecart;
        geste.cx = cx;
        geste.cy = cy;
        return;
      }
      if (!geste.bouge && Math.hypot(ev.clientX - geste.x0, ev.clientY - geste.y0) > SEUIL_CLIC)
        geste.bouge = true;
      if (!geste.bouge) return;
      if (geste.sorte === 'glisse') {
        var pasImage = pas();
        etat.vue.x -= (ev.clientX - geste.x) * pasImage;
        etat.vue.y -= (ev.clientY - geste.y) * pasImage;
        geste.x = ev.clientX;
        geste.y = ev.clientY;
        svg.dataset.glisse = '1';
        montrerBulle(null, 0, 0, true);
        appliquerVue();
      } else if (geste.sorte === 'trait') {
        var dernier = geste.points[geste.points.length - 1];
        var p = dansLeLieu(m);
        if (Math.hypot(p[0] - dernier[0], p[1] - dernier[1]) * pixelsParMetre() > 2 * pas())
          geste.points.push(p);
        dessinerTemp({ points: geste.points, fleche: false });
      } else if (geste.sorte === 'fleche' || geste.sorte === 'mesure') {
        dessinerTemp({
          points: [etat.attente || geste.depart, dansLeLieu(m)],
          fleche: geste.sorte === 'fleche',
          mesure: geste.sorte === 'mesure',
        });
      }
    });
    function finPointeur(ev) {
      var connu = pointeurs.delete(ev.pointerId);
      delete svg.dataset.glisse;
      if (!connu || !geste) return;
      if (geste.sorte === 'pince') {
        // Le doigt restant ne doit pas dessiner: le geste se termine avec le pincement.
        if (pointeurs.size === 0) geste = null;
        return;
      }
      var g = geste;
      geste = null;
      if (ev.type === 'pointercancel') {
        dessinerTemp();
        return;
      }
      var m = ecranVersMetres(ev.clientX, ev.clientY);
      if (!g.bouge) {
        if (g.sorte !== 'glisse' || etat.outil === 'main') agirSur(m, ev.clientX, ev.clientY);
        return;
      }
      if (g.sorte === 'trait') {
        var tolerance = (1.5 * pas()) / pixelsParMetre();
        var points = simplifier(g.points, tolerance).slice(0, 200);
        if (points.length >= 2)
          ouvrirBrouillon({ sorte: 'trait', metresPoints: points, fleche: false });
        else dessinerTemp();
      } else if (g.sorte === 'fleche' || g.sorte === 'mesure') {
        finirDeuxPoints(etat.attente || g.depart, dansLeLieu(m));
      }
    }
    svg.addEventListener('pointerup', finPointeur);
    svg.addEventListener('pointercancel', finPointeur);
    svg.addEventListener('pointerleave', function () {
      position.hidden = true;
      montrerBulle(null, 0, 0, false);
    });
    svg.addEventListener(
      'wheel',
      function (ev) {
        ev.preventDefault();
        var delta = ev.deltaMode === 1 ? ev.deltaY * 30 : ev.deltaY;
        zoomer(Math.exp(-delta * 0.0018), ev.clientX, ev.clientY);
      },
      { passive: false },
    );
    svg.addEventListener('keydown', function (ev) {
      var r = svg.getBoundingClientRect();
      var k = pas();
      var deplacement = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      }[ev.key];
      if (deplacement) {
        etat.vue.x += deplacement[0] * r.width * 0.12 * k;
        etat.vue.y += deplacement[1] * r.height * 0.12 * k;
        appliquerVue();
      } else if (ev.key === '+' || ev.key === '=') zoomer(1.4);
      else if (ev.key === '-' || ev.key === '_') zoomer(1 / 1.4);
      else if (ev.key === '0') cadrerTout();
      else if (ev.key === 'Enter' || ev.key === ' ')
        agirSur(
          ecranVersMetres(r.left + r.width / 2, r.top + r.height / 2),
          r.left + r.width / 2,
          r.top + r.height / 2,
        );
      else if (ev.key === 'Escape') {
        etat.attente = null;
        montrerBulle(null, 0, 0, true);
        dessinerTemp();
      } else return;
      vue.dataset.clavier = '1';
      ev.preventDefault();
    });
    svg.addEventListener('blur', function () {
      delete vue.dataset.clavier;
    });
    svg.addEventListener('pointerdown', function () {
      delete vue.dataset.clavier;
    });

    // ----- chargement d'une vue
    function majMemoire() {
      ecrireMemoire({
        carte: etat.carte ? etat.carte.id : null,
        calques: Object.keys(etat.calques).filter(function (k) {
          return etat.calques[k];
        }),
        traitees: etat.traitees,
      });
    }
    function remplirCalques() {
      vider(corpsCalques);
      var disponibles = (etat.index.calques || []).filter(function (c) {
        return (etat.carte.calques || []).indexOf(c.id) >= 0;
      });
      disponibles.forEach(function (c) {
        var coche = h('input', { type: 'checkbox', id: 'carte-calque-' + c.id });
        coche.checked = !!etat.calques[c.id];
        coche.addEventListener('change', function () {
          etat.calques[c.id] = coche.checked;
          dessinerCalques();
          majMemoire();
        });
        corpsCalques.appendChild(
          h('label', { class: 'carte-coche', for: 'carte-calque-' + c.id }, coche, c.titre),
        );
      });
      var traitees = h('input', { type: 'checkbox', id: 'carte-calque-traitees' });
      traitees.checked = etat.traitees;
      traitees.addEventListener('change', function () {
        etat.traitees = traitees.checked;
        dessinerNotes();
        majMemoire();
      });
      corpsCalques.appendChild(
        h(
          'label',
          { class: 'carte-coche', for: 'carte-calque-traitees' },
          traitees,
          'Remarques traitées',
        ),
      );
    }
    function remplirAllerA() {
      vider(allerA);
      allerA.appendChild(h('option', { value: '', texte: 'Aller à…' }));
      if (!etat.donnees) return;
      etat.donnees.elements
        .map(function (e, i) {
          return { e: e, i: i };
        })
        .filter(function (o) {
          return o.e.calque === 'batiments';
        })
        .sort(function (a, b) {
          return a.e.nom.localeCompare(b.e.nom, 'fr');
        })
        .forEach(function (o) {
          allerA.appendChild(h('option', { value: String(o.i), texte: o.e.nom }));
        });
    }
    allerA.addEventListener('change', function () {
      var e = etat.donnees && etat.donnees.elements[Number(allerA.value)];
      if (allerA.value === '' || !e) return;
      allerA.value = '';
      var montrer = function () {
        centrerSur([e.x, e.y], Math.min(etat.carte.vue.largeur, 90));
        var r = svg.getBoundingClientRect();
        montrerBulle(e, r.left + r.width / 2, r.top + r.height / 2, true);
      };
      if (visibleDansLaVue([e.x, e.y])) montrer();
      else {
        var ensemble = etat.index.cartes.filter(function (c) {
          return c.lieu === etat.lieu.id;
        })[0];
        ouvrirCarte(ensemble.id).then(montrer);
      }
    });
    function ecouterNotes() {
      if (etat.arret) etat.arret();
      etat.arret = null;
      var recu = function (notes) {
        etat.notes = Array.isArray(notes) ? notes.slice() : [];
        if (
          etat.choisie &&
          !etat.notes.some(function (n) {
            return n.id === etat.choisie;
          })
        )
          etat.choisie = null;
        var ouvertes = etat.notes.filter(function (n) {
          return n.statut !== 'traitee';
        }).length;
        titreListe.textContent =
          'Tes remarques sur ce plan (' +
          etat.notes.length +
          (etat.notes.length ? ', dont ' + ouvertes + ' en attente' : '') +
          ')';
        dessinerNotes();
        dessinerListe();
        dessinerTemp();
      };
      var retour = ctx.notes.watch('carte', etat.lieu.id, recu);
      etat.arret = typeof retour === 'function' ? retour : null;
    }
    function ouvrirCarte(id) {
      var carte =
        etat.index.cartes.filter(function (c) {
          return c.id === id;
        })[0] || etat.index.cartes[0];
      var lieu = etat.index.lieux.filter(function (l) {
        return l.id === carte.lieu;
      })[0];
      var changeDeLieu = !etat.lieu || etat.lieu.id !== lieu.id;
      etat.carte = carte;
      etat.lieu = lieu;
      etat.attente = null;
      choix.value = carte.id;
      image.setAttribute('href', 'cartes/' + carte.fichier);
      image.setAttribute('width', carte.image.largeur);
      image.setAttribute('height', carte.image.hauteur);
      decoupe.setAttribute('x', carte.cadre.x);
      decoupe.setAttribute('y', carte.cadre.y);
      decoupe.setAttribute('width', carte.cadre.largeur);
      decoupe.setAttribute('height', carte.cadre.hauteur);
      montrerBulle(null, 0, 0, true);
      remplirCalques();
      cadrerTout();
      majMemoire();
      if (changeDeLieu) {
        etat.donnees = null;
        etat.mesure = null;
        fermerEdition();
        montrerMesure();
        ecouterNotes();
      }
      dessinerNotes();
      dessinerTemp();
      if (!donneesParLieu[lieu.id]) {
        donneesParLieu[lieu.id] = chargerJson('cartes/' + lieu.donnees).catch(function () {
          return null;
        });
      }
      return donneesParLieu[lieu.id].then(function (donnees) {
        if (etat.lieu !== lieu) return;
        etat.donnees = donnees;
        if (changeDeLieu) remplirAllerA();
        dessinerCalques();
      });
    }
    choix.addEventListener('change', function () {
      ouvrirCarte(choix.value);
    });

    choisirOutil('main');
    aide.textContent = 'Chargement du plan…';
    if (typeof ResizeObserver === 'function') {
      new ResizeObserver(function () {
        if (etat.carte && svg.clientWidth > 0) appliquerVue();
      }).observe(vue);
    }

    return chargerJson('cartes/index.json')
      .then(function (index) {
        if (
          !index ||
          !Array.isArray(index.cartes) ||
          !index.cartes.length ||
          !Array.isArray(index.lieux)
        )
          throw new Error('index vide');
        return index;
      })
      .then(
        function (index) {
          etat.index = index;
          index.cartes.forEach(function (c) {
            choix.appendChild(
              h('option', {
                value: c.id,
                texte: index.lieux.length > 1 ? c.lieu + ': ' + c.titre : c.titre,
              }),
            );
          });
          choisirOutil('main');
          return ouvrirCarte(memoire.carte);
        },
        function () {
          vider(racine);
          racine.appendChild(
            h('p', {
              class: 'carte-vide',
              texte:
                'Le plan n’a pas pu être chargé. Recharge la page; si cela dure, préviens le studio (fichier « cartes/index.json » absent).',
            }),
          );
        },
      );
  }

  function enregistrer() {
    window.TDB.registerTab({ id: 'carte', title: 'Carte', order: 50, mount: mount });
  }
  if (window.TDB && typeof window.TDB.registerTab === 'function') enregistrer();
  else window.addEventListener('tdb:pret', enregistrer, { once: true });
})();
