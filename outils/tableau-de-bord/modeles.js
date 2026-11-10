// Onglet « Modèles 3D » du tableau de bord: visionneuse des modèles du jeu, à annoter (épingles 3D, note globale).
// La liste vient de `modeles/index.json` (voir `outils/inventaire-modeles.mjs`): un modèle de plus dans l'index
// apparaît ici sans toucher à ce fichier. Three.js r128 n'est chargé qu'à la première ouverture de l'onglet.
// Repère d'une épingle: celui du fichier glTF (mètres, Y vers le haut), noeud racine du modèle ramené à l'origine.
(function () {
  'use strict';

  var BIBLIOTHEQUES = [
    'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js',
    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js',
  ];
  var MEMOIRE = 'tdb-modeles';
  var SEUIL_CLIC = 6;
  var TAILLE_SILHOUETTE = 1.7;
  var FONDS = {
    clair: {
      fond: 0xe8e5de,
      grille: 0xa8a399,
      axe: 0x6f6a61,
      encre: 0x2a2320,
      silhouette: 'rgba(60,70,90,0.42)',
    },
    sombre: {
      fond: 0x23272c,
      grille: 0x4a5058,
      axe: 0x8a9099,
      encre: 0x0d0a0c,
      silhouette: 'rgba(210,220,235,0.4)',
    },
  };
  var COULEUR_NOTE = '#c2185b';
  var COULEUR_TRAITEE = '#2e7d32';

  var STYLE = [
    '.mod-racine{--m-panneau:var(--panneau,#1d2126);--m-creux:var(--creux,var(--fond,#14171a));--m-texte:var(--texte,#f1ede4);',
    '--m-doux:var(--texte-doux,#a9a399);--m-filet:var(--filet,var(--trait,#3a4048));--m-accent:var(--accent,#f2c14e);',
    '--m-sur-accent:var(--sur-accent,#1c1a14);--m-accent-texte:var(--accent-texte,var(--accent,#f2c14e));',
    '--m-danger:var(--alerte,var(--danger,#e5604d));--m-ok:var(--ok,#5fb878);--m-rayon:var(--rayon-petit,8px);',
    // La vue 3D a son propre fond, clair ou sombre au choix, pour juger couleurs et contours hors du thème.
    '--mod-note:#c2185b;--mod-traitee:#2e7d32;--mod-papier:#fffdf5;--mod-encre:#241d19;',
    'display:grid;grid-template-columns:minmax(200px,250px) minmax(0,1fr) minmax(250px,320px);gap:12px;align-items:start;color:var(--m-texte);min-width:0}',
    '.mod-colonne{display:grid;gap:8px;min-width:0}',
    '.mod-btn{font:inherit;color:var(--m-texte);background:var(--m-panneau);border:1px solid var(--m-filet);border-radius:var(--m-rayon);padding:8px 12px;min-height:40px;cursor:pointer;line-height:1.2}',
    '.mod-btn:hover{border-color:var(--m-accent-texte)}',
    '.mod-btn[aria-pressed="true"]{background:var(--m-accent);color:var(--m-sur-accent);border-color:var(--m-accent);font-weight:700}',
    '.mod-btn[disabled]{opacity:.5;cursor:default}',
    '.mod-btn--petit{padding:4px 10px;min-height:32px;font-size:.9em}',
    '.mod-btn--danger{color:var(--m-danger)}',
    '.mod-btn:focus-visible,.mod-champ:focus-visible,.mod-item:focus-visible,.mod-toile canvas:focus-visible,.mod-select:focus-visible{outline:3px solid var(--m-accent-texte);outline-offset:2px}',
    '.mod-champ,.mod-select{font:inherit;color:var(--m-texte);background:var(--m-creux);border:1px solid var(--m-filet);border-radius:var(--m-rayon);padding:8px 10px;min-height:40px;width:100%;box-sizing:border-box}',
    '.mod-select{width:auto;max-width:100%;background:var(--m-panneau)}',
    '.mod-zone{font:inherit;color:var(--m-texte);background:var(--m-creux);border:1px solid var(--m-filet);border-radius:var(--m-rayon);padding:8px;min-height:84px;width:100%;box-sizing:border-box;resize:vertical}',
    '.mod-groupe{display:flex;flex-wrap:wrap;gap:4px;align-items:center}',
    '.mod-liste{list-style:none;margin:0;padding:0;display:grid;gap:2px;max-height:clamp(240px,62vh,640px);overflow:auto;border:1px solid var(--m-filet);border-radius:var(--m-rayon);background:var(--m-panneau)}',
    '.mod-famille{position:sticky;top:0;background:var(--m-panneau);color:var(--m-doux);font-size:.8em;text-transform:uppercase;letter-spacing:.06em;padding:8px 10px 4px;z-index:1}',
    '.mod-item{font:inherit;color:var(--m-texte);background:transparent;border:0;border-left:3px solid transparent;text-align:left;width:100%;padding:8px 10px;min-height:38px;cursor:pointer;display:flex;gap:6px;align-items:center;justify-content:space-between}',
    '.mod-item:hover{background:var(--m-creux)}',
    '.mod-item[aria-current="true"]{border-left-color:var(--m-accent-texte);background:var(--m-creux);font-weight:700}',
    '.mod-compte{flex:none;min-width:20px;height:20px;border-radius:10px;background:var(--mod-note);color:var(--mod-papier);font-size:.75em;font-weight:700;display:inline-flex;align-items:center;justify-content:center;padding:0 5px;box-sizing:border-box}',
    '.mod-doux{color:var(--m-doux);font-size:.88em;margin:0}',
    '.mod-toile{position:relative;height:clamp(300px,62vh,620px);border:1px solid var(--m-filet);border-radius:var(--m-rayon);overflow:hidden;background:var(--m-creux)}',
    '.mod-toile canvas{display:block;width:100%;height:100%;touch-action:none;cursor:grab}',
    '.mod-toile[data-outil="epingle"] canvas{cursor:crosshair}',
    '.mod-etat{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:16px;color:var(--mod-encre);pointer-events:none;font-weight:700}',
    '.mod-toile[data-fond="sombre"] .mod-etat,.mod-toile[data-fond="sombre"] .mod-legende{color:var(--mod-papier)}',
    '.mod-legende{position:absolute;left:10px;bottom:8px;font-size:12px;color:var(--mod-encre);pointer-events:none;opacity:.85}',
    '.mod-mire{position:absolute;left:50%;top:50%;width:26px;height:26px;margin:-13px 0 0 -13px;pointer-events:none;display:none;border:2px solid var(--mod-note);border-radius:50%;box-sizing:border-box}',
    '.mod-mire::after{content:"";position:absolute;left:50%;top:50%;width:4px;height:4px;margin:-2px 0 0 -2px;background:var(--mod-note);border-radius:50%}',
    '.mod-toile[data-clavier="1"][data-outil="epingle"] .mod-mire{display:block}',
    '.mod-barre{display:flex;flex-wrap:wrap;gap:8px;align-items:center}',
    '.mod-titre{margin:0;font-size:1.1em;font-family:var(--police-titre,inherit)}',
    '.mod-fiche{margin:0;display:grid;grid-template-columns:auto 1fr;gap:2px 10px;font-size:.9em}',
    '.mod-fiche dt{color:var(--m-doux)}',
    '.mod-fiche dd{margin:0;overflow-wrap:anywhere}',
    '.mod-carte{border:1px solid var(--m-filet);border-radius:var(--m-rayon);padding:10px;background:var(--m-panneau);display:grid;gap:8px}',
    '.mod-edition{border:2px solid var(--m-accent-texte);border-radius:var(--m-rayon);padding:10px;background:var(--m-panneau);display:grid;gap:8px}',
    '.mod-edition-titre{margin:0;font-weight:700}',
    '.mod-notes{list-style:none;margin:0;padding:0;display:grid;gap:8px;max-height:clamp(200px,44vh,460px);overflow:auto}',
    '.mod-note{border:1px solid var(--m-filet);border-radius:var(--m-rayon);padding:10px;background:var(--m-panneau);display:grid;gap:6px}',
    '.mod-note[data-choisie="1"]{border-color:var(--m-accent-texte);box-shadow:inset 3px 0 0 var(--m-accent-texte)}',
    '.mod-note-tete{display:flex;gap:8px;align-items:center;flex-wrap:wrap}',
    '.mod-num{display:inline-flex;align-items:center;justify-content:center;min-width:26px;height:26px;border-radius:13px;background:var(--mod-note);color:var(--mod-papier);font-weight:700;font-size:.9em;padding:0 6px;box-sizing:border-box}',
    '.mod-num[data-statut="traitee"]{background:var(--mod-traitee)}',
    '.mod-statut{font-size:.8em;border:1px solid var(--m-filet);border-radius:999px;padding:1px 8px;color:var(--m-doux)}',
    '.mod-statut[data-statut="traitee"]{color:var(--m-ok);border-color:var(--m-ok)}',
    '.mod-note-texte{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}',
    '.mod-reponse{margin:0;border-left:3px solid var(--m-ok);padding:4px 8px;background:var(--m-creux);border-radius:0 6px 6px 0;white-space:pre-wrap;overflow-wrap:anywhere}',
    '.mod-reponse b{display:block;font-size:.8em;color:var(--m-ok)}',
    '.mod-vide{margin:0;color:var(--m-doux);border:1px dashed var(--m-filet);border-radius:var(--m-rayon);padding:14px}',
    '@media (max-width:1100px){.mod-racine{grid-template-columns:minmax(180px,230px) minmax(0,1fr)}.mod-colonne--notes{grid-column:1 / -1}}',
    '@media (max-width:700px){.mod-racine{grid-template-columns:minmax(0,1fr)}.mod-liste{max-height:190px}.mod-toile{height:clamp(280px,54vh,480px)}.mod-notes{max-height:none}}',
    '@media (prefers-reduced-motion:reduce){.mod-racine *{transition:none!important;scroll-behavior:auto!important}}',
  ].join('\n');

  // ---------------------------------------------------------------- petits outils

  function h(balise, attributs) {
    var el = document.createElement(balise);
    for (var cle in attributs || {}) {
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
  function vider(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }
  function nombre(v, decimales) {
    return Number(v).toLocaleString('fr-FR', {
      maximumFractionDigits: decimales === undefined ? 2 : decimales,
    });
  }
  function poidsLisible(octets) {
    return octets >= 1048576
      ? nombre(octets / 1048576, 1) + ' Mo'
      : nombre(octets / 1024, 0) + ' Ko';
  }
  function sansAccent(t) {
    return String(t).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
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
      // Confort seulement.
    }
  }
  function mouvementReduit() {
    return (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  var bibliotheques = null;
  /** Charge Three.js et ses deux compléments, l'un après l'autre (ils étendent le global `THREE`). */
  function chargerBibliotheques() {
    if (bibliotheques) return bibliotheques;
    var un = function (url) {
      return new Promise(function (ok, echec) {
        var script = document.createElement('script');
        script.src = url;
        script.onload = function () {
          ok();
        };
        script.onerror = function () {
          echec(new Error('script non chargé: ' + url));
        };
        document.head.appendChild(script);
      });
    };
    var deja = window.THREE && window.THREE.REVISION === '128';
    bibliotheques = (deja ? Promise.resolve() : un(BIBLIOTHEQUES[0]))
      .then(function () {
        return window.THREE.GLTFLoader ? null : un(BIBLIOTHEQUES[1]);
      })
      .then(function () {
        return window.THREE.OrbitControls ? null : un(BIBLIOTHEQUES[2]);
      })
      .then(function () {
        return window.THREE;
      });
    bibliotheques.catch(function () {
      bibliotheques = null;
    });
    return bibliotheques;
  }

  // ---------------------------------------------------------------- fichiers

  var tampons = new Map();
  /** Octets d'un fichier publié; les six derniers restent en mémoire pour passer vite d'un modèle au voisin. */
  function octetsDe(url) {
    if (tampons.has(url)) {
      var connu = tampons.get(url);
      tampons.delete(url);
      tampons.set(url, connu);
      return connu;
    }
    var promesse = fetch(url).then(function (r) {
      if (!r.ok) throw new Error(url + ': ' + r.status);
      return r.arrayBuffer();
    });
    tampons.set(url, promesse);
    promesse.catch(function () {
      tampons.delete(url);
    });
    while (tampons.size > 6) tampons.delete(tampons.keys().next().value);
    return promesse;
  }

  function imageDepuis(octets, type) {
    var blob = new Blob([octets], { type: type || 'image/png' });
    if (typeof createImageBitmap !== 'function')
      return Promise.reject(new Error('createImageBitmap absent'));
    // Sans prémultiplication: le canal alpha de certains atlas porte une hauteur, pas une transparence.
    return createImageBitmap(blob, {
      premultiplyAlpha: 'none',
      colorSpaceConversion: 'none',
    }).catch(function () {
      return createImageBitmap(blob);
    });
  }

  /**
   * Sort les images d'un GLB avant de le confier à GLTFLoader, qui les chargerait par des adresses `blob:`
   * que la page publiée peut refuser. Rend le GLB sans textures et, par matériau, l'image de couleur à reposer.
   */
  function separerTextures(tampon) {
    var vue = new DataView(tampon);
    if (vue.byteLength < 20 || vue.getUint32(0, true) !== 0x46546c67)
      return { tampon: tampon, images: [] };
    var longueurJson = vue.getUint32(12, true);
    var json = JSON.parse(new TextDecoder().decode(new Uint8Array(tampon, 20, longueurJson)));
    if (!json.images || !json.images.length) return { tampon: tampon, images: [] };
    var debutBin = 20 + longueurJson + 8;
    var images = [];
    (json.materials || []).forEach(function (m, indice) {
      var pbr = m.pbrMetallicRoughness || {};
      var ref = pbr.baseColorTexture;
      if (ref) {
        var texture = (json.textures || [])[ref.index] || {};
        var image = json.images[texture.source];
        var bv =
          image && image.bufferView !== undefined ? json.bufferViews[image.bufferView] : null;
        if (bv) {
          var echantillon = (json.samplers || [])[texture.sampler] || {};
          images.push({
            materiau: indice,
            type: image.mimeType,
            octets: tampon.slice(
              debutBin + (bv.byteOffset || 0),
              debutBin + (bv.byteOffset || 0) + bv.byteLength,
            ),
            net: echantillon.magFilter === 9728,
          });
        }
      }
      delete pbr.baseColorTexture;
      delete pbr.metallicRoughnessTexture;
      delete m.normalTexture;
      delete m.occlusionTexture;
      delete m.emissiveTexture;
    });
    delete json.images;
    delete json.textures;
    delete json.samplers;
    var texte = new TextEncoder().encode(JSON.stringify(json));
    var bourrage = (4 - (texte.length % 4)) % 4;
    var reste = new Uint8Array(tampon, 20 + longueurJson);
    var sortie = new Uint8Array(20 + texte.length + bourrage + reste.length);
    var v2 = new DataView(sortie.buffer);
    v2.setUint32(0, 0x46546c67, true);
    v2.setUint32(4, 2, true);
    v2.setUint32(8, sortie.length, true);
    v2.setUint32(12, texte.length + bourrage, true);
    v2.setUint32(16, 0x4e4f534a, true);
    sortie.set(texte, 20);
    for (var i = 0; i < bourrage; i += 1) sortie[20 + texte.length + i] = 0x20;
    sortie.set(reste, 20 + texte.length + bourrage);
    return { tampon: sortie.buffer, images: images };
  }

  // ---------------------------------------------------------------- la scène 3D

  /** Tout ce qui occupe de la mémoire WebGL pour un modèle, à rendre d'un coup. */
  function Sac() {
    this.geometries = new Set();
    this.materiaux = new Set();
    this.textures = new Set();
    this.squelettes = new Set();
  }
  Sac.prototype.ramasser = function (objet) {
    var sac = this;
    objet.traverse(function (o) {
      if (o.geometry) sac.geometries.add(o.geometry);
      // Chaque squelette garde une texture de matrices d'os sur la carte graphique.
      if (o.skeleton) sac.squelettes.add(o.skeleton);
      var mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      mats.forEach(function (m) {
        sac.materiaux.add(m);
      });
    });
  };
  Sac.prototype.vider = function () {
    var sac = this;
    this.materiaux.forEach(function (m) {
      [
        'map',
        'alphaMap',
        'emissiveMap',
        'normalMap',
        'aoMap',
        'roughnessMap',
        'metalnessMap',
      ].forEach(function (cle) {
        if (m[cle]) sac.textures.add(m[cle]);
      });
      m.dispose();
    });
    this.geometries.forEach(function (g) {
      g.dispose();
    });
    this.textures.forEach(function (t) {
      t.dispose();
      if (t.image && typeof t.image.close === 'function') t.image.close();
    });
    this.squelettes.forEach(function (q) {
      q.dispose();
    });
    this.squelettes.clear();
    this.geometries.clear();
    this.materiaux.clear();
    this.textures.clear();
  };

  function creerScene(THREE, toile, rappels) {
    var rendu = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'low-power',
    });
    rendu.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    rendu.outputEncoding = THREE.sRGBEncoding;
    var canevas = rendu.domElement;
    canevas.tabIndex = 0;
    canevas.setAttribute('role', 'application');
    canevas.setAttribute(
      'aria-label',
      'Vue 3D du modèle. Flèches pour tourner, plus et moins pour zoomer, Entrée pour poser une épingle au centre.',
    );
    toile.insertBefore(canevas, toile.firstChild);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
    scene.add(camera);
    // Éclairage neutre: ciel et sol très proches, plus une lampe qui suit la caméra (jamais de face à contre-jour).
    scene.add(new THREE.HemisphereLight(0xffffff, 0xb9b2a6, 0.72));
    var lampe = new THREE.DirectionalLight(0xffffff, 0.62);
    lampe.position.set(-0.6, 0.9, 0.7);
    camera.add(lampe);
    camera.add(lampe.target);
    lampe.target.position.set(0, 0, -1);

    var controles = new THREE.OrbitControls(camera, canevas);
    controles.enableDamping = false;
    controles.screenSpacePanning = true;
    controles.addEventListener('change', demander);

    var decor = new THREE.Group(); // grille, silhouette, boîte des cotes
    var socle = new THREE.Group(); // le modèle
    var epingles = new THREE.Group();
    scene.add(decor, socle, epingles);
    var sacDecor = new Sac();
    var sacModele = new Sac();
    var sacEpingles = new Sac();

    var etat = {
      fond: 'clair',
      rendu: 'neutre',
      silhouette: true,
      cotes: false,
      boite: new THREE.Box3(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 1, 0.5)),
      rayon: 1,
      cibles: [], // maillages visés par le lancer de rayon (pose de repos)
      maillages: [], // maillages affichés, avec leurs deux matériaux
      melangeur: null,
      clips: [],
      action: null,
      horloge: new THREE.Clock(),
      glissement: null,
      numero: 0, // chargement en cours: un chargement plus récent annule le précédent
      pastilles: [],
      image: 0,
      detruit: false,
    };
    var rayon = new THREE.Raycaster();
    var v1 = new THREE.Vector3();
    var v2 = new THREE.Vector3();
    var souris = new THREE.Vector2();

    // ----- boucle de rendu à la demande: rien ne tourne quand rien ne bouge
    function demander() {
      if (etat.detruit || etat.image) return;
      etat.image = requestAnimationFrame(dessiner);
    }
    function dessiner(maintenant) {
      etat.image = 0;
      if (etat.detruit) return;
      var encore = false;
      var dt = Math.min(etat.horloge.getDelta(), 0.1);
      if (etat.melangeur && etat.action && !etat.action.paused) {
        etat.melangeur.update(dt);
        encore = true;
      }
      if (etat.glissement) {
        var g = etat.glissement;
        var t = Math.min(1, (maintenant - g.debut) / g.duree);
        var k = t * t * (3 - 2 * t);
        camera.position.lerpVectors(g.deP, g.versP, k);
        controles.target.lerpVectors(g.deC, g.versC, k);
        camera.lookAt(controles.target);
        if (t >= 1) {
          etat.glissement = null;
          controles.update();
        } else encore = true;
      }
      var silhouette = decor.getObjectByName('silhouette');
      if (silhouette)
        silhouette.rotation.y = Math.atan2(
          camera.position.x - silhouette.position.x,
          camera.position.z - silhouette.position.z,
        );
      rendu.render(scene, camera);
      // Repère lu par l'essai automatisé des fuites: objets WebGL vivants après cette image.
      toile.dataset.gpu = rendu.info.memory.geometries + ' ' + rendu.info.memory.textures;
      if (encore) demander();
    }
    function redimensionner() {
      var l = toile.clientWidth;
      var ht = toile.clientHeight;
      if (!l || !ht) return;
      rendu.setSize(l, ht, false);
      camera.aspect = l / ht;
      camera.updateProjectionMatrix();
      demander();
    }

    // ----- décor: grille métrique, silhouette de 1,70 m, boîte des cotes
    function dessinerSilhouette() {
      var c = document.createElement('canvas');
      c.width = 192;
      c.height = 608; // 0,60 m x 1,90 m: la silhouette, puis son étiquette au-dessus
      var g = c.getContext('2d');
      var px = c.height / 1.9;
      var y = function (m) {
        return c.height - m * px;
      };
      g.fillStyle = FONDS[etat.fond].silhouette;
      g.beginPath();
      g.arc(96, y(1.585), 0.115 * px, 0, Math.PI * 2);
      g.fill();
      var bloc = function (x, haut, bas, largeur, r) {
        g.beginPath();
        var x0 = 96 + x * px - (largeur * px) / 2;
        g.moveTo(x0 + r, y(haut));
        g.arcTo(x0 + largeur * px, y(haut), x0 + largeur * px, y(bas), r);
        g.arcTo(x0 + largeur * px, y(bas), x0, y(bas), r);
        g.arcTo(x0, y(bas), x0, y(haut), r);
        g.arcTo(x0, y(haut), x0 + largeur * px, y(haut), r);
        g.fill();
      };
      bloc(0, 1.44, 0.82, 0.4, 14); // buste
      bloc(-0.245, 1.42, 0.78, 0.085, 10); // bras
      bloc(0.245, 1.42, 0.78, 0.085, 10);
      bloc(-0.1, 0.86, 0, 0.17, 10); // jambes
      bloc(0.1, 0.86, 0, 0.17, 10);
      g.font = '700 30px sans-serif';
      g.textAlign = 'center';
      g.fillText('1,70 m', 96, y(1.76));
      var texture = new THREE.CanvasTexture(c);
      texture.encoding = THREE.sRGBEncoding;
      return texture;
    }
    function refaireDecor() {
      while (decor.children.length) decor.remove(decor.children[0]);
      sacDecor.vider();
      var couleurs = FONDS[etat.fond];
      rendu.setClearColor(couleurs.fond, 1);
      toile.dataset.fond = etat.fond;
      var b = etat.boite;
      var portee = Math.max(
        Math.abs(b.min.x),
        Math.abs(b.max.x),
        Math.abs(b.min.z),
        Math.abs(b.max.z),
      );
      var taille = Math.max(4, Math.ceil(portee + 1.5) * 2);
      var grille = new THREE.GridHelper(taille, taille, couleurs.axe, couleurs.grille);
      grille.position.y = Math.min(0, b.min.y) - 0.0005;
      decor.add(grille);
      var petit = Math.max(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z) < 1.2;
      if (petit) {
        var fine = new THREE.GridHelper(2, 20, couleurs.grille, couleurs.grille);
        fine.position.y = grille.position.y;
        fine.material.transparent = true;
        fine.material.opacity = 0.55;
        decor.add(fine);
      }
      rappels.legende(
        petit
          ? 'Grille: grand carreau de 1 m, petit carreau de 10 cm'
          : 'Grille: un carreau de 1 m',
      );
      if (etat.silhouette) {
        var plan = new THREE.Mesh(
          new THREE.PlaneGeometry(0.6, 1.9),
          new THREE.MeshBasicMaterial({
            map: dessinerSilhouette(),
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
          }),
        );
        plan.name = 'silhouette';
        plan.position.set(b.min.x - 0.45, grille.position.y + 0.95, (b.min.z + b.max.z) / 2);
        plan.renderOrder = 1;
        decor.add(plan);
      }
      if (etat.cotes) decor.add(new THREE.Box3Helper(etat.boite, couleurs.axe));
      sacDecor.ramasser(decor);
      demander();
    }

    // ----- cadrage
    function cadrer(boite, direction, anime) {
      var centre = boite.getCenter(new THREE.Vector3());
      var r = Math.max(boite.getSize(v1).length() / 2, 0.02);
      var demiV = (camera.fov * Math.PI) / 360;
      var demiH = Math.atan(Math.tan(demiV) * camera.aspect);
      var distance = (r / Math.sin(Math.min(demiV, demiH))) * 1.08;
      var dir = (direction || new THREE.Vector3(0.55, 0.36, 1)).clone().normalize();
      allerVers(centre.clone().addScaledVector(dir, distance), centre, anime);
    }
    /** Le modèle, avec la silhouette quand elle aide à lire l'échelle (inutile à côté d'une pomme de 8 cm). */
    function cadrageParDefaut(anime, sansSilhouette) {
      var b = etat.boite.clone();
      // Une pièce de tenue se regarde de près, avec un peu de son mannequin autour.
      if (etat.boiteEntiere && !etat.boiteEntiere.equals(etat.boite))
        b.expandByScalar(etat.rayon * 0.15);
      var silhouette = decor.getObjectByName('silhouette');
      var taille = b.getSize(v1);
      if (silhouette && !sansSilhouette && Math.max(taille.x, taille.y, taille.z) >= 0.35) {
        b.union(new THREE.Box3().setFromCenterAndSize(silhouette.position, v2.set(0.6, 1.9, 0.1)));
      }
      cadrer(b, null, anime);
    }
    function allerVers(positionCamera, cible, anime) {
      var portee = Math.max(etat.rayon, 0.05);
      camera.near = Math.max(portee / 200, 0.002);
      camera.far = Math.max(portee * 60, 60);
      camera.updateProjectionMatrix();
      controles.minDistance = portee * 0.12;
      controles.maxDistance = Math.max(portee * 14, 9);
      if (anime && !mouvementReduit()) {
        etat.glissement = {
          deP: camera.position.clone(),
          versP: positionCamera,
          deC: controles.target.clone(),
          versC: cible,
          debut: performance.now(),
          duree: 380,
        };
      } else {
        etat.glissement = null;
        camera.position.copy(positionCamera);
        controles.target.copy(cible);
        controles.update();
      }
      demander();
    }
    function tourner(dTheta, dPhi, facteur) {
      var decalage = v1.copy(camera.position).sub(controles.target);
      var s = new THREE.Spherical().setFromVector3(decalage);
      s.theta += dTheta;
      s.phi = Math.min(Math.PI - 0.05, Math.max(0.05, s.phi + dPhi));
      s.radius = Math.min(
        controles.maxDistance,
        Math.max(controles.minDistance, s.radius * (facteur || 1)),
      );
      camera.position.copy(controles.target).add(decalage.setFromSpherical(s));
      controles.update();
      demander();
    }

    // ----- matériaux: rendu neutre du fichier, ou aplats et contour approchés
    var degrade = null;
    function texturesDeTons() {
      if (degrade) return degrade;
      degrade = new THREE.DataTexture(
        new Uint8Array([120, 120, 120, 205, 205, 205, 255, 255, 255]),
        3,
        1,
        THREE.RGBFormat,
      );
      degrade.minFilter = THREE.NearestFilter;
      degrade.magFilter = THREE.NearestFilter;
      degrade.needsUpdate = true;
      return degrade;
    }
    /** Dessine les traits du visage (seconde UV, première case de l'atlas des traits) par-dessus la couleur. */
    function avecTraits(materiau, traits) {
      materiau.onBeforeCompile = function (programme) {
        programme.uniforms.cartesTraits = { value: traits.texture };
        programme.vertexShader = programme.vertexShader
          .replace(
            '#include <common>',
            '#include <common>\nattribute vec2 uv2;\nvarying vec2 vTraits;',
          )
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTraits = uv2;');
        programme.fragmentShader = programme.fragmentShader
          .replace(
            '#include <common>',
            '#include <common>\nuniform sampler2D cartesTraits;\nvarying vec2 vTraits;',
          )
          .replace(
            '#include <map_fragment>',
            '#include <map_fragment>\nif (vTraits.x > 0.0 && vTraits.x < 1.0 && vTraits.y > 0.0 && vTraits.y < 1.0) {\n' +
              '  vec4 trait = sRGBToLinear(texture2D(cartesTraits, vec2(vTraits.x / ' +
              traits.colonnes.toFixed(1) +
              ', vTraits.y / ' +
              traits.rangees.toFixed(1) +
              ')));\n' +
              '  diffuseColor.rgb = mix(diffuseColor.rgb, trait.rgb, clamp(trait.a * 1.5, 0.0, 1.0));\n}',
          );
      };
      materiau.customProgramCacheKey = function () {
        return 'traits-' + traits.colonnes + 'x' + traits.rangees;
      };
    }
    function materiauAplat(source, traits) {
      var m = new THREE.MeshToonMaterial({
        color: source.color ? source.color.clone() : 0xffffff,
        map: source.map || null,
        gradientMap: texturesDeTons(),
        vertexColors: source.vertexColors,
        side: source.side,
        skinning: source.skinning === true,
        morphTargets: source.morphTargets === true,
        morphNormals: source.morphNormals === true,
      });
      if (traits && source.name === 'tete') avecTraits(m, traits);
      return m;
    }
    /** Contour par coque retournée: le maillage redessiné en encre, gonflé le long des normales, faces arrière seules. */
    function coqueDe(maillage, epaisseur) {
      var m = new THREE.MeshBasicMaterial({
        color: FONDS[etat.fond].encre,
        side: THREE.BackSide,
        skinning: maillage.isSkinnedMesh === true,
        morphTargets: !!maillage.morphTargetInfluences,
      });
      m.onBeforeCompile = function (programme) {
        programme.uniforms.epaisseur = { value: epaisseur };
        programme.vertexShader = programme.vertexShader
          .replace('#include <common>', '#include <common>\nuniform float epaisseur;')
          .replace(
            '#include <begin_vertex>',
            'vec3 transformed = vec3(position) + normalize(normal) * epaisseur;',
          );
      };
      m.customProgramCacheKey = function () {
        return 'coque';
      };
      var coque = maillage.isSkinnedMesh
        ? new THREE.SkinnedMesh(maillage.geometry, m)
        : new THREE.Mesh(maillage.geometry, m);
      if (maillage.isSkinnedMesh) coque.bind(maillage.skeleton, maillage.bindMatrix);
      if (maillage.morphTargetInfluences)
        coque.morphTargetInfluences = maillage.morphTargetInfluences;
      coque.userData.outil = true;
      coque.frustumCulled = false;
      coque.visible = false;
      maillage.add(coque);
      return coque;
    }
    function appliquerRendu() {
      etat.maillages.forEach(function (e) {
        e.maillage.material = etat.rendu === 'aplats' ? e.aplat : e.neutre;
        e.coque.visible = etat.rendu === 'aplats';
        e.coque.material.color.setHex(FONDS[etat.fond].encre);
      });
      demander();
    }

    // ----- chargement d'un modèle
    function liberer() {
      if (etat.melangeur) {
        etat.melangeur.stopAllAction();
        etat.melangeur.uncacheRoot(socle);
      }
      etat.melangeur = null;
      etat.action = null;
      etat.clips = [];
      etat.cibles = [];
      etat.maillages = [];
      while (socle.children.length) socle.remove(socle.children[0]);
      sacModele.vider();
      rendu.renderLists.dispose();
    }
    function analyserGlb(url) {
      return octetsDe(url).then(function (tampon) {
        var separe = separerTextures(tampon);
        return new Promise(function (ok, echec) {
          new THREE.GLTFLoader().parse(separe.tampon, '', ok, echec);
        }).then(function (gltf) {
          sacModele.ramasser(gltf.scene);
          return Promise.all(
            separe.images.map(function (image) {
              return imageDepuis(image.octets, image.type).then(
                function (bitmap) {
                  var texture = new THREE.Texture(bitmap);
                  texture.flipY = false;
                  texture.encoding = THREE.sRGBEncoding;
                  texture.wrapS = THREE.RepeatWrapping;
                  texture.wrapT = THREE.RepeatWrapping;
                  if (image.net) texture.magFilter = THREE.NearestFilter;
                  texture.needsUpdate = true;
                  sacModele.textures.add(texture);
                  gltf.parser.associations.forEach(function (ref, objet) {
                    if (
                      ref &&
                      ref.type === 'materials' &&
                      ref.index === image.materiau &&
                      objet.isMaterial
                    ) {
                      objet.map = texture;
                      objet.needsUpdate = true;
                    }
                  });
                },
                function () {
                  // Image illisible: le modèle s'affiche sans sa texture plutôt que pas du tout.
                },
              );
            }),
          ).then(function () {
            return gltf;
          });
        });
      });
    }
    /** Ne garde, dans une scène glTF, que les maillages du noeud nommé (les os restent pour l'animation). */
    function isoler(racine, nom) {
      if (!nom) return racine;
      var propre = THREE.PropertyBinding.sanitizeNodeName(nom);
      var garde = null;
      racine.traverse(function (o) {
        if (!garde && (o.name === propre || o.name === nom)) garde = o;
      });
      if (!garde) return racine;
      var aRetirer = [];
      racine.traverse(function (o) {
        if (!o.isMesh) return;
        var dedans = false;
        for (var p = o; p; p = p.parent) if (p === garde) dedans = true;
        if (!dedans) aRetirer.push(o);
      });
      aRetirer.forEach(function (o) {
        o.parent.remove(o);
      });
      // Les modèles d'un même fichier sont rangés côte à côte: celui qu'on montre revient à l'origine.
      if (garde.parent === racine && !garde.isBone) garde.position.set(0, 0, 0);
      return garde;
    }
    function maillagesDe(objet) {
      var liste = [];
      objet.traverse(function (o) {
        if (o.isMesh && !o.userData.outil) liste.push(o);
      });
      return liste;
    }
    /** Copie figée d'un maillage à squelette dans sa pose de repos: r128 ne sait pas lancer un rayon sur une peau. */
    function figer(maillage) {
      var source = maillage.geometry.attributes.position;
      var positions = new Float32Array(source.count * 3);
      for (var i = 0; i < source.count; i += 1) {
        maillage.boneTransform(i, v1);
        positions[i * 3] = v1.x;
        positions[i * 3 + 1] = v1.y;
        positions[i * 3 + 2] = v1.z;
      }
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      if (maillage.geometry.index) g.setIndex(maillage.geometry.index);
      var fige = new THREE.Mesh(
        g,
        new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }),
      );
      fige.userData.outil = true;
      maillage.add(fige);
      fige.updateMatrixWorld(true);
      return fige;
    }
    function charger(modele) {
      var numero = (etat.numero += 1);
      liberer();
      rappels.etat('Chargement de « ' + modele.nom + ' »…');
      var base = 'modeles/';
      // Le mannequin n'est qu'un support: il ne compte ni dans les triangles ni dans les cotes du modèle.
      var morceaux = [
        { fichier: modele.fichier, noeud: modele.noeud, os: null, principal: true },
      ].concat(
        (modele.pieces || []).map(function (p) {
          return {
            fichier: p.fichier,
            noeud: p.noeud,
            os: p.os,
            principal: p.role !== 'mannequin',
          };
        }),
      );
      var textures = modele.textures || {};
      var charge = function (url) {
        return octetsDe(base + url).then(function (octets) {
          return imageDepuis(octets, 'image/png');
        });
      };
      return Promise.all([
        Promise.all(
          morceaux.map(function (m) {
            return analyserGlb(base + m.fichier);
          }),
        ),
        textures.atlas
          ? charge(textures.atlas).catch(function () {
              return null;
            })
          : null,
        textures.traits
          ? charge(textures.traits.fichier).catch(function () {
              return null;
            })
          : null,
      ]).then(function (resultat) {
        if (numero !== etat.numero || etat.detruit) {
          // Un autre modèle a été demandé entre-temps: ce chargement est rendu tout de suite.
          var perdu = new Sac();
          resultat[0].forEach(function (g) {
            perdu.ramasser(g.scene);
          });
          perdu.vider();
          [resultat[1], resultat[2]].forEach(function (b) {
            if (b && b.close) b.close();
          });
          return null;
        }
        var gltfs = resultat[0];
        var enTexture = function (bitmap) {
          if (!bitmap) return null;
          var t = new THREE.Texture(bitmap);
          t.flipY = false;
          t.encoding = THREE.sRGBEncoding;
          t.needsUpdate = true;
          sacModele.textures.add(t);
          return t;
        };
        var atlas = enTexture(resultat[1]);
        var traitsTexture = enTexture(resultat[2]);
        var traits = traitsTexture
          ? {
              texture: traitsTexture,
              colonnes: textures.traits.colonnes,
              rangees: textures.traits.rangees,
            }
          : null;

        // Le squelette de référence est celui du fichier qui porte les clips; les autres peaux s'y rattachent.
        var reference = 0;
        gltfs.forEach(function (g, i) {
          if (g.animations && g.animations.length && !(gltfs[reference].animations || []).length)
            reference = i;
        });
        var osParNom = {};
        gltfs[reference].scene.traverse(function (o) {
          if (o.isBone) osParNom[o.name] = o;
        });
        var gardes = gltfs.map(function (g, i) {
          var garde = isoler(g.scene, morceaux[i].noeud);
          maillagesDe(garde).forEach(function (o) {
            o.userData.principal = morceaux[i].principal;
          });
          return garde;
        });
        socle.add(gltfs[reference].scene);
        socle.updateMatrixWorld(true);
        gltfs.forEach(function (g, i) {
          if (i === reference) return;
          var m = morceaux[i];
          var os = m.os ? osParNom[m.os] : null;
          if (os) {
            // Pièce rigide (coiffure, col): modelée en place, elle suit l'os qui la porte.
            socle.add(g.scene);
            g.scene.updateMatrixWorld(true);
            os.attach(g.scene);
            return;
          }
          var peaux = maillagesDe(gardes[i]).filter(function (o) {
            return o.isSkinnedMesh;
          });
          if (peaux.length && Object.keys(osParNom).length) {
            g.scene.updateMatrixWorld(true);
            peaux.forEach(function (peau) {
              var os2 = peau.skeleton.bones.map(function (b) {
                return osParNom[b.name] || b;
              });
              socle.attach(peau);
              peau.bind(new THREE.Skeleton(os2, peau.skeleton.boneInverses), peau.bindMatrix);
              sacModele.squelettes.add(peau.skeleton);
            });
          } else socle.add(g.scene);
        });
        socle.updateMatrixWorld(true);

        // Matériaux et contours
        var principaux = [];
        var tous = maillagesDe(socle);
        var triangles = 0;
        tous.forEach(function (o) {
          if (o.morphTargetInfluences) o.morphTargetInfluences.fill(0);
          o.frustumCulled = false;
          var neutre = o.material;
          if (neutre.metalness !== undefined) neutre.metalness = Math.min(neutre.metalness, 0.2);
          if (atlas && !neutre.map) {
            neutre.map = atlas;
            neutre.needsUpdate = true;
          }
          if (traits && neutre.name === 'tete') avecTraits(neutre, traits);
          var aplat = materiauAplat(neutre, traits);
          sacModele.materiaux.add(aplat);
          etat.maillages.push({ maillage: o, neutre: neutre, aplat: aplat, coque: null });
        });
        // Pose de repos figée pour le pointage et les mesures
        var boite = new THREE.Box3();
        var boitePrincipale = new THREE.Box3();
        tous.forEach(function (o) {
          var cible = o.isSkinnedMesh ? figer(o) : o;
          if (cible !== o) sacModele.ramasser(cible);
          cible.geometry.computeBoundingBox();
          var b = cible.geometry.boundingBox.clone().applyMatrix4(cible.matrixWorld);
          boite.union(b);
          // Échelle réelle du maillage: taille affichée sur taille brute de sa géométrie. Pour une peau, la
          // matrice du noeud ne dit rien (les os portent l'échelle); elle sert à l'épaisseur du contour.
          if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
          var brute = o.geometry.boundingBox.getSize(v1).length();
          o.userData.echelle = brute > 0 ? b.getSize(v2).length() / brute : 1;
          if (o.userData.principal) {
            boitePrincipale.union(b);
            principaux.push(o);
            triangles +=
              (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) /
              3;
          }
          etat.cibles.push(cible);
        });
        if (boitePrincipale.isEmpty()) boitePrincipale.copy(boite);
        if (boite.isEmpty())
          boite.set(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 1, 0.5));
        etat.boite = boitePrincipale.clone();
        etat.boiteEntiere = boite;
        etat.rayon = Math.max(boite.getSize(v1).length() / 2, 0.02);
        var epaisseur = Math.max(etat.rayon * 0.007, 0.0006);
        etat.maillages.forEach(function (e) {
          e.coque = coqueDe(e.maillage, epaisseur / (e.maillage.userData.echelle || 1));
          sacModele.materiaux.add(e.coque.material);
        });

        etat.clips = [];
        gltfs.forEach(function (g) {
          (g.animations || []).forEach(function (c) {
            etat.clips.push(c);
          });
        });
        etat.melangeur = etat.clips.length ? new THREE.AnimationMixer(socle) : null;
        appliquerRendu();
        refaireDecor();
        cadrageParDefaut(false);
        rappels.etat('');
        var taille = boitePrincipale.getSize(new THREE.Vector3());
        return {
          triangles: Math.round(triangles),
          cotes: { largeur: taille.x, hauteur: taille.y, profondeur: taille.z },
          clips: etat.clips.map(function (c) {
            return { nom: c.name, duree: c.duration };
          }),
        };
      });
    }

    // ----- animation
    function jouer(nom) {
      if (!etat.melangeur) return;
      etat.melangeur.stopAllAction();
      etat.action = null;
      var clip = etat.clips.filter(function (c) {
        return c.name === nom;
      })[0];
      if (clip) {
        etat.action = etat.melangeur.clipAction(clip);
        etat.action.reset().play();
        etat.horloge.getDelta();
      }
      demander();
    }
    function pause(oui) {
      if (!etat.action) return;
      etat.action.paused = oui;
      etat.horloge.getDelta();
      demander();
    }

    // ----- épingles
    function texturePastille(numero, couleur, choisie) {
      var c = document.createElement('canvas');
      c.width = 96;
      c.height = 96;
      var g = c.getContext('2d');
      if (choisie) {
        g.beginPath();
        g.arc(48, 48, 45, 0, Math.PI * 2);
        g.fillStyle = '#fffdf5';
        g.fill();
        g.beginPath();
        g.arc(48, 48, 40, 0, Math.PI * 2);
        g.fillStyle = '#241d19';
        g.fill();
      }
      g.beginPath();
      g.arc(48, 48, 34, 0, Math.PI * 2);
      g.fillStyle = couleur;
      g.fill();
      g.lineWidth = 5;
      g.strokeStyle = '#fffdf5';
      g.stroke();
      g.fillStyle = '#fffdf5';
      g.font = '700 ' + (String(numero).length > 2 ? 30 : 40) + 'px sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(numero), 48, 51);
      var t = new THREE.CanvasTexture(c);
      t.encoding = THREE.sRGBEncoding;
      return t;
    }
    /** `liste`: [{ id, numero, position: [x, y, z], normale: [x, y, z], couleur, choisie }] dans le repère du modèle. */
    function poserEpingles(liste) {
      while (epingles.children.length) epingles.remove(epingles.children[0]);
      sacEpingles.vider();
      etat.pastilles = [];
      var tige = Math.max(etat.rayon * 0.14, 0.012);
      liste.forEach(function (e) {
        var pied = new THREE.Vector3().fromArray(e.position);
        var tete = pied
          .clone()
          .addScaledVector(new THREE.Vector3().fromArray(e.normale).normalize(), tige);
        var ligne = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([pied, tete]),
          new THREE.LineBasicMaterial({ color: e.couleur }),
        );
        var pastille = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: texturePastille(e.numero, e.couleur, e.choisie),
            sizeAttenuation: false,
            depthTest: true,
            transparent: true,
          }),
        );
        pastille.position.copy(tete);
        pastille.scale.setScalar(e.choisie ? 0.085 : 0.066);
        pastille.userData.note = e.id;
        // Le point exact: un grain au pied de la tige, visible même quand la pastille le survole.
        var grain = new THREE.Mesh(
          new THREE.SphereGeometry(Math.max(etat.rayon * 0.011, 0.0012), 10, 8),
          new THREE.MeshBasicMaterial({ color: e.couleur }),
        );
        grain.position.copy(pied);
        epingles.add(ligne, grain, pastille);
        etat.pastilles.push(pastille);
      });
      sacEpingles.ramasser(epingles);
      demander();
    }
    function viser(clientX, clientY) {
      var r = canevas.getBoundingClientRect();
      souris.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      scene.updateMatrixWorld(true);
      rayon.setFromCamera(souris, camera);
    }
    function pastilleSous(clientX, clientY) {
      viser(clientX, clientY);
      var touche = rayon.intersectObjects(etat.pastilles, false)[0];
      return touche ? touche.object.userData.note : null;
    }
    /** Point du modèle sous le pointeur, dans le repère du modèle, avec la normale de la face touchée. */
    function pointSous(clientX, clientY) {
      viser(clientX, clientY);
      var touche = rayon.intersectObjects(etat.cibles, false)[0];
      if (!touche) return null;
      var normale = touche.face
        ? touche.face.normal.clone().transformDirection(touche.object.matrixWorld)
        : new THREE.Vector3(0, 1, 0);
      // Face vue de dos (matériau à deux faces): la tige de l'épingle doit sortir vers la caméra.
      if (normale.dot(rayon.ray.direction) > 0) normale.negate();
      var arrondi = function (v) {
        return [
          Math.round(v.x * 1e4) / 1e4,
          Math.round(v.y * 1e4) / 1e4,
          Math.round(v.z * 1e4) / 1e4,
        ];
      };
      return {
        position: arrondi(socle.worldToLocal(touche.point.clone())),
        normale: arrondi(normale),
      };
    }
    function regarder(position, normale) {
      var cible = new THREE.Vector3().fromArray(position);
      var n = new THREE.Vector3().fromArray(normale).normalize();
      // On regarde l'épingle un peu de biais et d'en haut: de face, la pastille cacherait l'endroit pointé.
      var dir = n
        .clone()
        .add(new THREE.Vector3(0.25, 0.3, 0.25))
        .normalize();
      var distance = Math.max(etat.rayon * 2.1, 0.2);
      allerVers(cible.clone().addScaledVector(dir, distance), cible, true);
    }

    // ----- gestes: OrbitControls tourne et zoome; un appui sans glissé est un clic
    var appui = null;
    canevas.addEventListener('pointerdown', function (ev) {
      appui = { x: ev.clientX, y: ev.clientY, id: ev.pointerId };
      delete toile.dataset.clavier;
    });
    canevas.addEventListener('pointerup', function (ev) {
      if (!appui || appui.id !== ev.pointerId) return;
      var clic = Math.hypot(ev.clientX - appui.x, ev.clientY - appui.y) < SEUIL_CLIC;
      appui = null;
      if (clic) rappels.clic(ev.clientX, ev.clientY);
    });
    canevas.addEventListener('keydown', function (ev) {
      var pasAngle = 0.12;
      if (ev.key === 'ArrowLeft') tourner(-pasAngle, 0);
      else if (ev.key === 'ArrowRight') tourner(pasAngle, 0);
      else if (ev.key === 'ArrowUp') tourner(0, -pasAngle);
      else if (ev.key === 'ArrowDown') tourner(0, pasAngle);
      else if (ev.key === '+' || ev.key === '=') tourner(0, 0, 1 / 1.2);
      else if (ev.key === '-' || ev.key === '_') tourner(0, 0, 1.2);
      else if (ev.key === '0') cadrer(etat.boiteEntiere || etat.boite, null, true);
      else if (ev.key === 'Enter' || ev.key === ' ') {
        var r = canevas.getBoundingClientRect();
        rappels.clic(r.left + r.width / 2, r.top + r.height / 2);
      } else return;
      toile.dataset.clavier = '1';
      ev.preventDefault();
    });
    canevas.addEventListener('blur', function () {
      delete toile.dataset.clavier;
    });
    canevas.addEventListener('webglcontextlost', function (ev) {
      ev.preventDefault();
      rappels.perdu();
    });
    var observateur =
      typeof ResizeObserver === 'function' ? new ResizeObserver(redimensionner) : null;
    if (observateur) observateur.observe(toile);
    redimensionner();
    refaireDecor();

    return {
      charger: charger,
      poserEpingles: poserEpingles,
      pastilleSous: pastilleSous,
      pointSous: pointSous,
      regarder: regarder,
      jouer: jouer,
      pause: pause,
      enPause: function () {
        return !etat.action || etat.action.paused;
      },
      cadrer: function (avecSilhouette) {
        if (!avecSilhouette) {
          cadrageParDefaut(true, true);
          return;
        }
        var b = (etat.boiteEntiere || etat.boite).clone();
        var silhouette = decor.getObjectByName('silhouette');
        if (silhouette)
          b.union(
            new THREE.Box3().setFromCenterAndSize(
              silhouette.position,
              new THREE.Vector3(0.6, 1.9, 0.1),
            ),
          );
        cadrer(b, null, true);
      },
      vue: function (direction) {
        cadrer(etat.boiteEntiere || etat.boite, new THREE.Vector3().fromArray(direction), true);
      },
      regler: function (cle, valeur) {
        etat[cle] = valeur;
        if (cle === 'rendu') appliquerRendu();
        else {
          refaireDecor();
          appliquerRendu();
        }
      },
      detruire: function () {
        etat.detruit = true;
        if (etat.image) cancelAnimationFrame(etat.image);
        if (observateur) observateur.disconnect();
        liberer();
        while (epingles.children.length) epingles.remove(epingles.children[0]);
        sacEpingles.vider();
        while (decor.children.length) decor.remove(decor.children[0]);
        sacDecor.vider();
        if (degrade) degrade.dispose();
        controles.dispose();
        rendu.dispose();
        rendu.forceContextLoss();
        if (canevas.parentNode) canevas.parentNode.removeChild(canevas);
      },
    };
  }

  // ---------------------------------------------------------------- l'onglet

  function mount(el, ctx) {
    var style = document.createElement('style');
    style.textContent = STYLE;
    el.appendChild(style);

    var memoire = lireMemoire();
    var etat = {
      index: null,
      famille: 'toutes',
      recherche: '',
      modele: null,
      mesure: null, // triangles et cotes mesurés sur le modèle affiché
      notes: [],
      choisie: null,
      brouillon: null,
      editeur: null,
      arret: null,
      outil: 'tourner',
      rendu: memoire.rendu === 'aplats' ? 'aplats' : 'neutre',
      fond: memoire.fond === 'sombre' ? 'sombre' : 'clair',
      silhouette: memoire.silhouette !== false,
      cotes: memoire.cotes === true,
      scene: null,
      THREE: null,
    };

    // ----- squelette
    var racine = h('div', { class: 'mod-racine' });
    var recherche = h('input', {
      type: 'search',
      id: 'mod-recherche',
      class: 'mod-champ',
      placeholder: 'Chercher un modèle',
      'aria-label': 'Chercher un modèle',
    });
    var familles = h('div', { class: 'mod-groupe', role: 'group', 'aria-label': 'Familles' });
    var liste = h('ul', { class: 'mod-liste', id: 'mod-liste' });
    var compteur = h('p', { class: 'mod-doux', 'aria-live': 'polite' });
    var colListe = h('div', { class: 'mod-colonne' }, recherche, familles, compteur, liste);

    var titre = h('h3', { class: 'mod-titre', texte: 'Modèles 3D' });
    var toile = h('div', { class: 'mod-toile', 'data-outil': 'tourner', 'data-fond': etat.fond });
    var message = h('div', {
      class: 'mod-etat',
      role: 'status',
      texte: 'Choisis un modèle dans la liste.',
    });
    var legende = h('div', { class: 'mod-legende' });
    toile.appendChild(message);
    toile.appendChild(legende);
    toile.appendChild(h('div', { class: 'mod-mire' }));

    function bascule(id, texte, actif, action) {
      var b = h('button', {
        type: 'button',
        id: id,
        class: 'mod-btn mod-btn--petit',
        'aria-pressed': actif ? 'true' : 'false',
        texte: texte,
      });
      b.addEventListener('click', function () {
        var nouveau = b.getAttribute('aria-pressed') !== 'true';
        b.setAttribute('aria-pressed', nouveau ? 'true' : 'false');
        action(nouveau);
      });
      return b;
    }
    function bouton(id, texte, action, classe) {
      return h('button', {
        type: 'button',
        id: id,
        class: classe || 'mod-btn mod-btn--petit',
        texte: texte,
        onclick: action,
      });
    }
    var bEpingle = h('button', {
      type: 'button',
      id: 'mod-outil-epingle',
      class: 'mod-btn',
      'aria-pressed': 'false',
      texte: 'Poser une épingle',
    });
    bEpingle.addEventListener('click', function () {
      choisirOutil(etat.outil === 'epingle' ? 'tourner' : 'epingle');
    });
    var bGlobale = bouton(
      'mod-note-globale',
      'Note globale',
      function () {
        ouvrirBrouillon({ sorte: 'globale' });
      },
      'mod-btn',
    );
    var aide = h('p', { class: 'mod-doux', 'aria-live': 'polite' });
    var clips = h('select', { id: 'mod-clip', class: 'mod-select', 'aria-label': 'Animation' });
    var bLecture = bouton('mod-lecture', 'Pause', function () {
      if (!etat.scene) return;
      var enPause = etat.scene.enPause();
      etat.scene.pause(!enPause);
      bLecture.textContent = enPause ? 'Pause' : 'Lecture';
    });
    var zoneAnimation = h(
      'div',
      { class: 'mod-groupe', hidden: true },
      h('span', { class: 'mod-doux', texte: 'Animation:' }),
      clips,
      bLecture,
    );
    var reglages = h(
      'div',
      { class: 'mod-barre' },
      h(
        'div',
        { class: 'mod-groupe', role: 'group', 'aria-label': 'Affichage' },
        bascule('mod-rendu', 'Aplats et contour', etat.rendu === 'aplats', function (oui) {
          regler('rendu', oui ? 'aplats' : 'neutre');
        }),
        bascule('mod-fond', 'Fond sombre', etat.fond === 'sombre', function (oui) {
          regler('fond', oui ? 'sombre' : 'clair');
        }),
        bascule('mod-silhouette', 'Silhouette de 1,70 m', etat.silhouette, function (oui) {
          regler('silhouette', oui);
        }),
        bascule('mod-cotes', 'Boîte des cotes', etat.cotes, function (oui) {
          regler('cotes', oui);
        }),
      ),
      h(
        'div',
        { class: 'mod-groupe', role: 'group', 'aria-label': 'Points de vue' },
        bouton('mod-vue-recadrer', 'Modèle seul', function () {
          if (etat.scene) etat.scene.cadrer(false);
        }),
        bouton('mod-vue-echelle', 'Avec la silhouette', function () {
          if (etat.scene) etat.scene.cadrer(true);
        }),
        bouton('mod-vue-face', 'Face', function () {
          if (etat.scene) etat.scene.vue([0, 0.12, 1]);
        }),
        bouton('mod-vue-cote', 'Côté', function () {
          if (etat.scene) etat.scene.vue([1, 0.12, 0]);
        }),
        bouton('mod-vue-dos', 'Dos', function () {
          if (etat.scene) etat.scene.vue([0, 0.12, -1]);
        }),
        bouton('mod-vue-dessus', 'Dessus', function () {
          if (etat.scene) etat.scene.vue([0, 1, 0.02]);
        }),
      ),
    );
    var colVue = h(
      'div',
      { class: 'mod-colonne' },
      titre,
      toile,
      h('div', { class: 'mod-barre' }, bEpingle, bGlobale, zoneAnimation),
      aide,
      reglages,
    );

    var fiche = h('dl', { class: 'mod-fiche', id: 'mod-fiche' });
    var zoneEdition = h('div', { hidden: true });
    var titreNotes = h('h3', { class: 'mod-titre', texte: 'Tes remarques sur ce modèle' });
    var listeNotes = h('ul', { class: 'mod-notes', id: 'mod-remarques' });
    var colNotes = h(
      'div',
      { class: 'mod-colonne mod-colonne--notes' },
      h('div', { class: 'mod-carte' }, fiche),
      zoneEdition,
      titreNotes,
      listeNotes,
    );

    racine.appendChild(colListe);
    racine.appendChild(colVue);
    racine.appendChild(colNotes);
    el.appendChild(racine);

    function majMemoire() {
      ecrireMemoire({
        modele: etat.modele ? etat.modele.id : null,
        rendu: etat.rendu,
        fond: etat.fond,
        silhouette: etat.silhouette,
        cotes: etat.cotes,
      });
    }
    function regler(cle, valeur) {
      etat[cle] = valeur;
      if (cle === 'fond') toile.dataset.fond = valeur;
      if (etat.scene) etat.scene.regler(cle, valeur);
      majMemoire();
    }
    function choisirOutil(outil) {
      etat.outil = outil;
      toile.dataset.outil = outil;
      bEpingle.setAttribute('aria-pressed', outil === 'epingle' ? 'true' : 'false');
      if (outil === 'epingle') {
        // Les épingles se posent sur la pose de repos: l'animation s'arrête le temps du pointage.
        if (etat.scene && clips.value) {
          clips.value = '';
          etat.scene.jouer('');
          bLecture.disabled = true;
        }
        aide.textContent =
          'Clique l’endroit du modèle à corriger. Tu peux toujours tourner la vue en glissant.';
      } else
        aide.textContent =
          'Glisse pour tourner, molette ou pincement pour zoomer, clic droit ou deux doigts pour déplacer.';
    }

    // ----- liste des modèles
    function comptes() {
      var resultat = {};
      if (!etat.index) return resultat;
      etat.index.modeles.forEach(function (m) {
        var notes = ctx.notes.list('modele', m.id);
        if (Array.isArray(notes)) {
          resultat[m.id] = notes.filter(function (n) {
            return n.statut !== 'traitee';
          }).length;
        }
      });
      return resultat;
    }
    function dessinerListe() {
      vider(liste);
      var cherche = sansAccent(etat.recherche.trim());
      var ouverts = comptes();
      var visibles = etat.index.modeles.filter(function (m) {
        if (etat.famille !== 'toutes' && m.famille !== etat.famille) return false;
        return !cherche || sansAccent(m.nom + ' ' + m.id).indexOf(cherche) >= 0;
      });
      compteur.textContent =
        visibles.length +
        (visibles.length > 1 ? ' modèles' : ' modèle') +
        ' sur ' +
        etat.index.modeles.length;
      var famille = null;
      visibles.forEach(function (m) {
        if (m.famille !== famille) {
          famille = m.famille;
          var titreFamille = (etat.index.familles || []).filter(function (f) {
            return f.id === famille;
          })[0];
          liste.appendChild(
            h('li', { class: 'mod-famille', texte: titreFamille ? titreFamille.titre : famille }),
          );
        }
        var b = h(
          'button',
          {
            type: 'button',
            class: 'mod-item',
            'data-modele': m.id,
            'aria-current': etat.modele && etat.modele.id === m.id ? 'true' : null,
          },
          h('span', { texte: m.nom }),
        );
        if (ouverts[m.id])
          b.appendChild(
            h('span', {
              class: 'mod-compte',
              title: 'Remarques en attente',
              texte: String(ouverts[m.id]),
            }),
          );
        b.addEventListener('click', function () {
          ouvrir(m.id);
        });
        liste.appendChild(h('li', {}, b));
      });
      if (!visibles.length)
        liste.appendChild(
          h(
            'li',
            {},
            h('p', { class: 'mod-vide', texte: 'Aucun modèle ne correspond à cette recherche.' }),
          ),
        );
    }
    liste.addEventListener('keydown', function (ev) {
      if (ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp') return;
      var items = Array.prototype.slice.call(liste.querySelectorAll('.mod-item'));
      var i = items.indexOf(document.activeElement);
      var suivant = items[i + (ev.key === 'ArrowDown' ? 1 : -1)];
      if (suivant) {
        suivant.focus();
        ev.preventDefault();
      }
    });
    recherche.addEventListener('input', function () {
      etat.recherche = recherche.value;
      dessinerListe();
    });
    function dessinerFamilles() {
      vider(familles);
      [{ id: 'toutes', titre: 'Tous' }].concat(etat.index.familles || []).forEach(function (f) {
        var b = h('button', {
          type: 'button',
          id: 'mod-famille-' + f.id,
          class: 'mod-btn mod-btn--petit',
          'aria-pressed': etat.famille === f.id ? 'true' : 'false',
          texte: f.titre,
        });
        b.addEventListener('click', function () {
          etat.famille = f.id;
          dessinerFamilles();
          dessinerListe();
        });
        familles.appendChild(b);
      });
    }

    // ----- fiche du modèle
    function dessinerFiche() {
      vider(fiche);
      var m = etat.modele;
      if (!m) return;
      var mesure = etat.mesure;
      var ligne = function (nom, valeur) {
        fiche.appendChild(h('dt', { texte: nom }));
        fiche.appendChild(h('dd', { texte: valeur }));
      };
      var triangles = mesure ? mesure.triangles : m.triangles;
      var c = mesure ? mesure.cotes : m.cotes;
      // Repère lu par les essais automatisés: le modèle dont les mesures sont affichées.
      fiche.dataset.mesure = mesure ? m.id : '';
      fiche.dataset.triangles = String(triangles);
      if (c)
        fiche.dataset.cotes = [c.largeur, c.hauteur, c.profondeur]
          .map(function (v) {
            return v.toFixed(3);
          })
          .join(' ');
      ligne('Triangles', nombre(triangles, 0));
      if (c)
        ligne(
          'Cotes',
          nombre(c.largeur) +
            ' × ' +
            nombre(c.profondeur) +
            ' × ' +
            nombre(c.hauteur) +
            ' m (largeur × profondeur × hauteur)',
        );
      ligne(
        'Poids',
        poidsLisible(m.poids) +
          (m.partage > 1 ? ' (fichier partagé par ' + m.partage + ' modèles)' : ''),
      );
      ligne(
        'Animations',
        m.clips && m.clips.length
          ? m.clips
              .map(function (k) {
                return k.nom + ' (' + nombre(k.duree, 1) + ' s)';
              })
              .join(', ')
          : 'aucune',
      );
      if (
        m.pieces &&
        m.pieces.some(function (p) {
          return p.role === 'mannequin';
        })
      )
        ligne('Montré sur', 'le mannequin du jeu (corps et tête de base)');
      ligne('Fichier', m.source + (m.noeud ? ' · noeud « ' + m.noeud + ' »' : ''));
    }

    // ----- remarques
    function numeroDe(note) {
      return etat.notes.indexOf(note) + 1;
    }
    function estPoint(forme) {
      return (
        forme &&
        forme.sorte === 'point3d' &&
        Array.isArray(forme.position) &&
        forme.position.length === 3 &&
        Array.isArray(forme.normale) &&
        forme.normale.length === 3
      );
    }
    function majEpingles() {
      if (!etat.scene) return;
      var liste3d = etat.notes
        .filter(function (n) {
          return estPoint(n.forme);
        })
        .map(function (n) {
          return {
            id: n.id,
            numero: numeroDe(n),
            position: n.forme.position,
            normale: n.forme.normale,
            couleur: n.statut === 'traitee' ? COULEUR_TRAITEE : COULEUR_NOTE,
            choisie: etat.choisie === n.id,
          };
        });
      if (etat.brouillon && etat.brouillon.sorte === 'point3d') {
        liste3d.push({
          id: null,
          numero: etat.notes.length + 1,
          position: etat.brouillon.position,
          normale: etat.brouillon.normale,
          couleur: COULEUR_NOTE,
          choisie: true,
        });
      }
      etat.scene.poserEpingles(liste3d);
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
    function texteTechnique(forme) {
      if (!estPoint(forme)) return 'Note globale sur le modèle';
      var p = forme.position;
      return (
        'Épingle · x ' +
        nombre(p[0]) +
        ' m, y ' +
        nombre(p[1]) +
        ' m (hauteur), z ' +
        nombre(p[2]) +
        ' m'
      );
    }
    function dessinerNotes() {
      vider(listeNotes);
      var ouvertes = etat.notes.filter(function (n) {
        return n.statut !== 'traitee';
      }).length;
      titreNotes.textContent =
        'Tes remarques sur ce modèle (' +
        etat.notes.length +
        (etat.notes.length ? ', dont ' + ouvertes + ' en attente' : '') +
        ')';
      if (!etat.modele) return;
      if (!etat.notes.length) {
        listeNotes.appendChild(
          h(
            'li',
            {},
            h('p', {
              class: 'mod-vide',
              texte:
                'Aucune remarque sur ce modèle. « Poser une épingle » pointe un endroit précis à corriger; « Note globale » donne ton avis sur l’ensemble.',
            }),
          ),
        );
        return;
      }
      etat.notes.forEach(function (note) {
        var traitee = note.statut === 'traitee';
        var actions = h('div', { class: 'mod-groupe' });
        actions.appendChild(
          bouton(
            null,
            estPoint(note.forme) ? 'Voir l’épingle' : 'Voir le modèle entier',
            function () {
              choisir(note.id, true);
            },
          ),
        );
        if (!traitee) {
          actions.appendChild(
            bouton(null, 'C’est réglé', function () {
              Promise.resolve(ctx.notes.resolve(note.id)).then(function (ok) {
                if (ok && ctx.ui && ctx.ui.toast)
                  ctx.ui.toast('Remarque ' + numeroDe(note) + ' marquée comme traitée.');
              });
            }),
          );
        }
        actions.appendChild(
          bouton(
            null,
            'Supprimer',
            function () {
              var question =
                'Supprimer la remarque ' + numeroDe(note) + ' ? Cette action est définitive.';
              var demande =
                ctx.ui && typeof ctx.ui.confirm === 'function'
                  ? ctx.ui.confirm(question, { ok: 'Supprimer', annuler: 'Garder' })
                  : Promise.resolve(false);
              Promise.resolve(demande).then(function (oui) {
                if (!oui) return;
                if (etat.choisie === note.id) etat.choisie = null;
                ctx.notes.remove(note.id);
              });
            },
            'mod-btn mod-btn--petit mod-btn--danger',
          ),
        );
        listeNotes.appendChild(
          h(
            'li',
            {
              class: 'mod-note',
              'data-note': note.id,
              'data-choisie': etat.choisie === note.id ? '1' : '0',
            },
            h(
              'div',
              { class: 'mod-note-tete' },
              h('span', {
                class: 'mod-num',
                'data-statut': note.statut || 'ouverte',
                texte: String(numeroDe(note)),
              }),
              h('span', {
                class: 'mod-statut',
                'data-statut': note.statut || 'ouverte',
                texte: traitee ? 'Traitée' : 'Ouverte',
              }),
              h('span', { class: 'mod-doux', texte: dateLisible(note.creeLe) }),
            ),
            h('p', { class: 'mod-note-texte', texte: note.texte || '' }),
            h('p', { class: 'mod-doux', texte: texteTechnique(note.forme) }),
            note.reponseManager
              ? h(
                  'p',
                  { class: 'mod-reponse' },
                  h('b', { texte: 'Réponse du studio' }),
                  String(note.reponseManager),
                )
              : null,
            actions,
          ),
        );
      });
    }
    function choisir(id, recadrer) {
      etat.choisie = id;
      var note = etat.notes.filter(function (n) {
        return n.id === id;
      })[0];
      majEpingles();
      dessinerNotes();
      if (note && recadrer && etat.scene) {
        if (estPoint(note.forme)) etat.scene.regarder(note.forme.position, note.forme.normale);
        else etat.scene.cadrer(false);
        toile.scrollIntoView({ block: 'nearest' });
      } else if (note) {
        var item = listeNotes.querySelector('[data-note="' + String(id).replace(/"/g, '') + '"]');
        if (item) item.scrollIntoView({ block: 'nearest' });
      }
    }
    function fermerEdition() {
      if (etat.editeur && typeof etat.editeur.destroy === 'function') etat.editeur.destroy();
      etat.editeur = null;
      etat.brouillon = null;
      vider(zoneEdition);
      zoneEdition.hidden = true;
      majEpingles();
    }
    function ouvrirBrouillon(forme) {
      if (!etat.modele) return;
      fermerEdition();
      etat.brouillon = forme;
      var cible = etat.modele;
      var titreEdition =
        forme.sorte === 'globale'
          ? 'Note globale sur « ' + cible.nom + ' »'
          : 'Remarque ' + (etat.notes.length + 1) + ' (' + texteTechnique(forme) + ')';
      var corps = h('div');
      zoneEdition.appendChild(
        h(
          'div',
          { class: 'mod-edition' },
          h('p', { class: 'mod-edition-titre', texte: titreEdition }),
          corps,
          bouton('mod-abandon', 'Abandonner cette remarque', fermerEdition),
        ),
      );
      zoneEdition.hidden = false;
      var envoyer = function (texte) {
        var propre = String(texte || '').trim();
        if (!propre) return false;
        return Promise.resolve(
          ctx.notes.add({ cible: { type: 'modele', id: cible.id }, forme: forme, texte: propre }),
        ).then(function (id) {
          if (!id) return false;
          fermerEdition();
          if (forme.sorte !== 'globale') etat.choisie = id;
          if (ctx.ui && ctx.ui.toast) ctx.ui.toast('Remarque enregistrée.');
          majEpingles();
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
          forme.sorte === 'globale'
            ? 'Ton avis d’ensemble sur ce modèle'
            : 'Ce qu’il faut corriger à cet endroit',
        bouton: 'Enregistrer',
        valeur: '',
      };
      if (ctx.ui && typeof ctx.ui.noteEditor === 'function')
        etat.editeur = ctx.ui.noteEditor(corps, options) || null;
      else {
        var champ = h('textarea', {
          id: 'mod-remarque',
          class: 'mod-zone',
          placeholder: options.placeholder,
          'aria-label': options.label,
        });
        champ.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) envoyer(champ.value);
          if (ev.key === 'Escape') fermerEdition();
        });
        corps.appendChild(champ);
        corps.appendChild(
          bouton(
            null,
            options.bouton,
            function () {
              envoyer(champ.value);
            },
            'mod-btn',
          ),
        );
        etat.editeur = {
          focus: function () {
            champ.focus();
          },
        };
      }
      majEpingles();
      zoneEdition.scrollIntoView({ block: 'nearest' });
      if (etat.editeur && typeof etat.editeur.focus === 'function') etat.editeur.focus();
    }
    function ecouterNotes() {
      if (etat.arret) etat.arret();
      etat.arret = null;
      etat.notes = [];
      if (!etat.modele) return;
      var retour = ctx.notes.watch('modele', etat.modele.id, function (notes) {
        etat.notes = Array.isArray(notes) ? notes.slice() : [];
        if (
          etat.choisie &&
          !etat.notes.some(function (n) {
            return n.id === etat.choisie;
          })
        )
          etat.choisie = null;
        majEpingles();
        dessinerNotes();
        dessinerListe();
      });
      etat.arret = typeof retour === 'function' ? retour : null;
    }

    // ----- vue 3D: créée à la demande, rendue quand l'onglet est caché
    var rappels = {
      etat: function (texte) {
        message.textContent = texte;
        message.hidden = !texte;
      },
      legende: function (texte) {
        legende.textContent = texte;
      },
      clic: function (x, y) {
        if (!etat.scene || !etat.modele) return;
        var note = etat.scene.pastilleSous(x, y);
        if (note) {
          choisir(note, false);
          return;
        }
        if (etat.outil !== 'epingle') return;
        var point = etat.scene.pointSous(x, y);
        if (!point) {
          if (ctx.ui && ctx.ui.toast)
            ctx.ui.toast('Clique sur le modèle lui-même pour poser l’épingle.');
          return;
        }
        ouvrirBrouillon({ sorte: 'point3d', position: point.position, normale: point.normale });
      },
      perdu: function () {
        fermerScene();
        rappels.etat(
          'L’affichage 3D s’est interrompu. Choisis de nouveau un modèle pour le relancer.',
        );
      },
    };
    function fermerScene() {
      if (!etat.scene) return;
      etat.scene.detruire();
      etat.scene = null;
    }
    function ouvrirScene() {
      if (etat.scene) return Promise.resolve(etat.scene);
      rappels.etat('Chargement de la vue 3D…');
      return chargerBibliotheques().then(function (THREE) {
        if (etat.scene) return etat.scene;
        etat.THREE = THREE;
        etat.scene = creerScene(THREE, toile, rappels);
        ['rendu', 'fond', 'silhouette', 'cotes'].forEach(function (cle) {
          etat.scene.regler(cle, etat[cle]);
        });
        return etat.scene;
      });
    }
    function montrer() {
      var m = etat.modele;
      if (!m) return Promise.resolve();
      return ouvrirScene()
        .then(function (scene) {
          return scene.charger(m);
        })
        .then(function (mesure) {
          if (!mesure || etat.modele !== m) return;
          etat.mesure = mesure;
          dessinerFiche();
          vider(clips);
          clips.appendChild(h('option', { value: '', texte: 'Pose de repos' }));
          mesure.clips.forEach(function (c) {
            clips.appendChild(
              h('option', { value: c.nom, texte: c.nom + ' (' + nombre(c.duree, 1) + ' s)' }),
            );
          });
          zoneAnimation.hidden = mesure.clips.length === 0;
          bLecture.disabled = true;
          bLecture.textContent = 'Pause';
          majEpingles();
        })
        .catch(function () {
          if (etat.modele === m)
            rappels.etat(
              'Ce modèle n’a pas pu être affiché. Vérifie ta connexion, puis choisis-le de nouveau.',
            );
        });
    }
    clips.addEventListener('change', function () {
      if (!etat.scene) return;
      if (clips.value && etat.outil === 'epingle') choisirOutil('tourner');
      etat.scene.jouer(clips.value);
      bLecture.disabled = !clips.value;
      bLecture.textContent = 'Pause';
    });
    function ouvrir(id) {
      var m = etat.index.modeles.filter(function (x) {
        return x.id === id;
      })[0];
      if (!m) return Promise.resolve();
      etat.modele = m;
      etat.mesure = null;
      etat.choisie = null;
      fermerEdition();
      titre.textContent = m.nom;
      dessinerFiche();
      ecouterNotes();
      dessinerListe();
      majMemoire();
      return montrer();
    }

    // L'onglet caché rend sa mémoire WebGL; il la reprend quand on y revient.
    if (typeof IntersectionObserver === 'function') {
      new IntersectionObserver(function () {
        var cache = racine.getClientRects().length === 0;
        if (cache) fermerScene();
        else if (!etat.scene && etat.modele) montrer();
      }).observe(racine);
    }
    window.addEventListener('pagehide', fermerScene);

    choisirOutil('tourner');
    return fetch('modeles/index.json')
      .then(function (r) {
        if (!r.ok) throw new Error('index: ' + r.status);
        return r.json();
      })
      .then(function (index) {
        if (!index || !Array.isArray(index.modeles) || !index.modeles.length)
          throw new Error('index vide');
        etat.index = index;
        dessinerFamilles();
        dessinerListe();
        dessinerNotes();
        if (ctx.ready && typeof ctx.ready.then === 'function') ctx.ready.then(dessinerListe);
        var depart = index.modeles.filter(function (m) {
          return m.id === memoire.modele;
        })[0];
        // Sans attendre la fin du chargement 3D: la liste est déjà utilisable.
        ouvrir((depart || index.modeles[0]).id);
        return null;
      })
      .catch(function () {
        vider(racine);
        racine.appendChild(
          h('p', {
            class: 'mod-vide',
            texte:
              'La liste des modèles n’a pas pu être chargée. Recharge la page; si cela dure, préviens le studio (fichier « modeles/index.json » absent).',
          }),
        );
      });
  }

  function enregistrer() {
    window.TDB.registerTab({ id: 'modeles', title: 'Modèles 3D', order: 60, mount: mount });
  }
  if (window.TDB && typeof window.TDB.registerTab === 'function') enregistrer();
  else window.addEventListener('tdb:pret', enregistrer, { once: true });
})();
