// Scène d'essai de style du café du village (Three.js 0.187), deux variantes de la même scène.
// Paramètres: ?v=A|B (variante), &vue=1|2|3 (point de vue), &w=&h= (taille du rendu, sinon la fenêtre).
// Lumière: la coque, les meubles, la vaisselle et la rue sont cuits dans Blender (carte de lumière de fin
// d'après-midi, livrée dans le GLB comme texture d'occlusion sur la seconde UV et rebranchée ici en lightMap):
// ils sont dessinés sans aucune lumière dynamique. Les personnages sont dans une seconde scène, éclairée par
// quatre lumières réelles (hémisphérique, soleil sans ombre, deux suspensions du comptoir), dessinée par-dessus
// avec le même tampon de profondeur. Aucune carte d'ombre (C10), aucun reflet calculé à chaque image (C11).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const q = new URLSearchParams(location.search);
const V = q.get('v') === 'B' ? 'B' : 'A';
const VUE = q.get('vue') || '1';
const W = Number(q.get('w')) || innerWidth;
const H = Number(q.get('h')) || innerHeight;

// Points de vue (coordonnées du plan: x vers l'est, z vers le sud; yeux à 1,65 m, champ vertical de 60 degrés)
const VUES = {
  // 1. derrière le comptoir, près de la passe, face à la salle et à la place (la vue de la planche de la bible)
  1: { pos: [7.75, 1.65, 7.95], cible: [8.25, 1.32, 12.5] },
  // 2. depuis l'entrée vers le comptoir, l'ardoise et la caisse
  2: { pos: [9.4, 1.65, 12.1], cible: [8.75, 1.3, 7.1] },
  // 3. gros plan à hauteur de main: la machine et la tasse sous le premier groupe
  3: { pos: [9.32, 1.5, 8.18], cible: [9.02, 1.06, 8.95] },
};

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = V === 'A' ? 1.55 : 1.5;
renderer.autoClear = false;
renderer.info.autoReset = false;
document.body.appendChild(renderer.domElement);

const fixe = new THREE.Scene();
const vivant = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, W / H, 0.05, 80);
// contrôle de près: &pos=x,y,z&cible=x,y,z remplace le point de vue
const vue = q.get('pos') ? { pos: q.get('pos').split(',').map(Number), cible: q.get('cible').split(',').map(Number) } : VUES[VUE];
camera.position.set(...vue.pos);
camera.lookAt(...vue.cible);

// Ciel de fin d'après-midi (bible 2.4): haut gris-mauve, horizon doré, dégradé par sommets
function ciel() {
  const geo = new THREE.SphereGeometry(70, 32, 16);
  const haut = new THREE.Color('#C9C9D6');
  const horizon = new THREE.Color('#F5D3A8');
  const col = [];
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = Math.max(0, Math.min(1, p.getY(i) / 40));
    const c = horizon.clone().lerp(haut, Math.pow(t, 0.6));
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const m = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false, fog: false });
  const s = new THREE.Mesh(geo, m);
  s.position.set(8, 0, 20);
  s.renderOrder = -1;
  return s;
}

// L'environnement de B: une capture unique de la salle cuite, au chargement (aucun rendu de reflet par image)
function environnement(position) {
  const cible = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType });
  const cube = new THREE.CubeCamera(0.05, 80, cible);
  cube.position.set(...position);
  fixe.add(cube);
  const tm = renderer.toneMapping;
  renderer.toneMapping = THREE.NoToneMapping;
  cube.update(renderer, fixe);
  renderer.toneMapping = tm;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromCubemap(cible.texture).texture;
  pmrem.dispose();
  cible.dispose();
  fixe.remove(cube);
  return env;
}

// B: l'environnement ne donne que le reflet spéculaire; l'éclairage diffus vient de la carte de lumière seule
function speculaireSeul(mat) {
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <lights_fragment_maps>',
      THREE.ShaderChunk.lights_fragment_maps.replace('iblIrradiance += getIBLIrradiance( geometryNormal );', ''),
    );
  };
  mat.customProgramCacheKey = () => 'speculaire-seul';
}

// Ardoise murale: texte à la craie (Caveat, OFL), écrit par le jeu (bible 10)
async function ardoise() {
  await document.fonts.load('64px Caveat');
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 904;
  const g = c.getContext('2d');
  g.textBaseline = 'alphabetic';
  g.fillStyle = '#E9C98A';
  g.font = '700 132px Caveat';
  g.textAlign = 'center';
  g.fillText('La carte du jour', 512, 150);
  g.fillStyle = '#F1EDE3';
  g.font = '600 124px Caveat';
  const lignes = [['Café', '1,80'], ['Crème', '3,20'], ['Chocolat', '3,50'], ['Croissant', '1,30']];
  lignes.forEach(([a, b], i) => {
    const y = 320 + i * 158;
    g.textAlign = 'left';
    g.fillText(a, 70, y);
    g.textAlign = 'right';
    g.fillText(b, 960, y);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, color: new THREE.Color(0.86, 0.84, 0.8), toneMapped: true });
  // surface d'ardoise du modèle: x 8,83 à 9,85, hauteur 1,27 à 2,17, nu à z = 7,145
  const plan = new THREE.Mesh(new THREE.PlaneGeometry(1.02, 0.9), m);
  plan.position.set(9.34, 1.72, 7.1465);
  return plan;
}

// Tickets du rail (papier, encre, Patrick Hand): le contenu est écrit par le jeu; ici quatre commandes
async function tickets() {
  await document.fonts.load('40px "Patrick Hand"');
  const groupe = new THREE.Group();
  const contenus = [
    ['Table 3', '2 crèmes', '1 croissant'],
    ['Comptoir', '1 café', '1 chocolat'],
    ['Table 1', '1 thé', '1 tartine'],
    ['Caisse', '2 cafés', 'à emporter'],
  ];
  // centres des tickets (x du plan, de l'est à l'ouest vus du barista), face nord à z = 9,2955
  [8.06, 8.25, 8.44, 8.62].forEach((x, i) => {
    const c = document.createElement('canvas');
    c.width = 240;
    c.height = 340;
    const g = c.getContext('2d');
    g.fillStyle = '#2B2622';
    g.textBaseline = 'alphabetic';
    const [titre, l1, l2] = contenus[i];
    g.font = '56px "Patrick Hand"';
    g.fillText(titre, 18, i === 3 ? 150 : 110);
    g.font = '50px "Patrick Hand"';
    g.fillText(l1, 18, i === 3 ? 220 : 190);
    g.fillText(l2, 18, i === 3 ? 285 : 255);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, color: new THREE.Color(0.9, 0.86, 0.8) });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.17), m);
    p.rotation.y = Math.PI;
    p.position.set(x, 1.88 - 0.105, 9.2925);
    groupe.add(p);
  });
  return groupe;
}

// Ombre ronde sous chaque personnage (décalque, bible 6)
function ombreRonde() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const d = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  d.addColorStop(0, 'rgba(42,30,24,0.55)');
  d.addColorStop(1, 'rgba(42,30,24,0)');
  g.fillStyle = d;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  return new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
}

async function main() {
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(`../modeles/cafe_${V}.glb`);
  const racine = gltf.scene;
  let K = 1;
  racine.traverse((o) => { if (o.userData && o.userData.lightmap_scale) K = o.userData.lightmap_scale; });
  const persos = [];
  const statiques = [];
  for (const enfant of [...racine.children]) {
    if (enfant.name.startsWith('char_')) persos.push(enfant);
    else statiques.push(enfant);
  }
  statiques.forEach((o) => fixe.add(o));
  persos.forEach((o) => vivant.add(o));
  fixe.add(ciel());

  const aRemplacer = [];
  fixe.traverse((o) => {
    if (!o.isMesh || o.material.vertexColors) return;
    const m = o.material;
    const kind = m.userData.kind;
    if (kind === 'glass') {
      o.material = new THREE.MeshBasicMaterial({ color: m.color, transparent: true, opacity: 0.13, depthWrite: false, side: THREE.DoubleSide });
      o.renderOrder = 2;
    } else if (kind === 'emit') {
      o.material = new THREE.MeshBasicMaterial({ color: m.emissive.clone().multiplyScalar(1.15) });
    } else if (m.aoMap) {
      const lm = m.aoMap;
      lm.colorSpace = THREE.SRGBColorSpace;
      lm.channel = 1;
      lm.needsUpdate = true;
      // dehors en plein soleil: la lumière cuite y est ramenée, sinon la place sort blanche derrière les vitres
      const k = m.name.startsWith('ext_') ? K * Math.PI * 0.42 : K * Math.PI;
      if (V === 'A') {
        o.material = new THREE.MeshBasicMaterial({ map: m.map, color: m.color, lightMap: lm, lightMapIntensity: k });
      } else {
        m.lightMap = lm;
        m.lightMapIntensity = k;
        m.aoMap = null;
        aRemplacer.push(m);
      }
    }
  });
  fixe.add(await ardoise());
  fixe.add(await tickets());

  if (V === 'B') {
    const env = environnement([8.6, 1.4, 10.2]);
    for (const m of aRemplacer) {
      m.envMap = env;
      m.envMapIntensity = 1.0;
      speculaireSeul(m);
      m.needsUpdate = true;
    }
  }

  // Personnages: matériaux propres à la variante, quatre lumières réelles
  const ombre = ombreRonde();
  for (const p of persos) {
    p.traverse((o) => {
      if (!o.isMesh) return;
      const src = o.material;
      o.material = V === 'A'
        ? new THREE.MeshLambertMaterial({ map: src.map })
        : new THREE.MeshStandardMaterial({ map: src.map, roughness: 0.78, metalness: 0 });
    });
    const b = new THREE.Box3().setFromObject(p);
    const disque = new THREE.Mesh(new THREE.CircleGeometry(0.34, 20).rotateX(-Math.PI / 2), ombre);
    disque.position.set((b.min.x + b.max.x) / 2, 0.004, (b.min.z + b.max.z) / 2);
    vivant.add(disque);
  }
  vivant.add(new THREE.HemisphereLight('#E8DCCB', '#A65A3E', V === 'A' ? 1.5 : 1.3));
  const soleil = new THREE.DirectionalLight('#FFC788', 1.0);
  soleil.position.set(8 - 7.3, 3.6, 10 + 16.4);
  soleil.target.position.set(8, 0, 10);
  vivant.add(soleil, soleil.target);
  for (const [x, z] of [[9.15, 8.72], [10.6, 8.85]]) {
    const l = new THREE.PointLight('#FFC27A', 1.6, 4.5, 2);
    l.position.set(x, 2.16, z);
    vivant.add(l);
  }

  function rendre() {
    renderer.info.reset();
    renderer.clear();
    renderer.render(fixe, camera);
    renderer.render(vivant, camera);
  }
  rendre();
  rendre();

  // mesures
  // une image partagée par plusieurs matériaux n'est envoyée qu'une fois au GPU (Source commune): comptée une fois
  const parSource = new Map();
  const visite = (s) => s.traverse((o) => {
    if (!o.isMesh) return;
    for (const k of ['map', 'lightMap', 'envMap', 'alphaMap']) if (o.material[k]) parSource.set(o.material[k].source ? o.material[k].source.uuid : o.material[k].uuid, o.material[k]);
  });
  visite(fixe);
  visite(vivant);
  const textures = new Set(parSource.values());
  let octets = 0;
  const liste = [];
  for (const t of textures) {
    const img = t.image;
    let w = img?.width || 0;
    let h = img?.height || 0;
    if (t.isRenderTargetTexture || t.mapping === THREE.CubeUVReflectionMapping) {
      // PMREM: atlas en demi-flottants (8 octets par texel)
      w = img?.width || 768;
      h = img?.height || 1024;
      octets += w * h * 8;
      liste.push({ nom: 'environnement (PMREM)', w, h });
      continue;
    }
    const mip = t.generateMipmaps !== false && t.minFilter !== THREE.NearestFilter && t.minFilter !== THREE.LinearFilter ? 4 / 3 : 1;
    octets += w * h * 4 * mip;
    liste.push({ nom: t.name || img?.constructor?.name, w, h });
  }
  const tris = { fixe: 0, personnages: 0 };
  fixe.traverse((o) => { if (o.isMesh) tris.fixe += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
  vivant.traverse((o) => { if (o.isMesh) tris.personnages += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
  window.essai = {
    pret: true,
    variante: V,
    vue: VUE,
    stats: {
      appels: renderer.info.render.calls,
      triangles_dessines: renderer.info.render.triangles,
      triangles_charges: tris,
      programmes: renderer.info.programs.length,
      programmes_noms: renderer.info.programs.map((p) => p.name),
      textures: liste,
      memoire_textures_mo: Math.round((octets / 1048576) * 10) / 10,
      lumieres_dynamiques: 4,
      cartes_ombre: 0,
      echelle_carte_lumiere: K,
    },
  };
}

main().catch((e) => {
  window.essai = { pret: true, erreur: String(e && e.stack ? e.stack : e) };
});
