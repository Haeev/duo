// Visionneuse de contrôle des modèles de Deux Tabliers (Three.js 0.187): la coque cuite, ses extensions, une disposition
// de meubles (JSON) et des personnages. Paramètres d'adresse:
//   disposition=<chemin sous /assets/modeles/>  ext=terrasse,fond  cam=px,py,pz;cx,cy,cz  fov=70  dessus=1  w=1366 h=768
//   persos=char_simone@x,z,rot;...  (clip idle au temps 1 s)
// Repère: x = x du plan, y = hauteur, z = y du plan. window.vue = { pret, stats, erreur }.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const q = new URLSearchParams(location.search);
const W = Number(q.get('w') || 1366);
const H = Number(q.get('h') || 768);
window.vue = { pret: false };
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(W, H);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.autoClear = false;
document.body.appendChild(renderer.domElement);
const fixe = new THREE.Scene();
fixe.background = new THREE.Color('#cfd6d8');
const vivant = new THREE.Scene();
const loader = new GLTFLoader();
const charger = (u) => new Promise((ok, ko) => loader.load(u, ok, undefined, ko));
const BASE = '/assets/modeles/';

function lumiereCuite(racine) {
  racine.traverse((o) => {
    if (!o.isMesh) return;
    const m = o.material;
    const K = (o.userData && o.userData.lightmap_scale) || (o.parent && o.parent.userData.lightmap_scale) || 1;
    if (m.name === 'dt_verre') {
      o.material = new THREE.MeshBasicMaterial({ color: m.color, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide });
      o.renderOrder = 2;
    } else if (m.name === 'dt_ciel') {
      o.material = new THREE.MeshBasicMaterial({ map: m.map, vertexColors: true, fog: false });
      o.frustumCulled = false;
    } else if (m.name === 'dt_lampe') {
      o.material = new THREE.MeshBasicMaterial({ color: new THREE.Color('#FFE6BE') });
    } else if (m.aoMap) {
      const lm = m.aoMap;
      lm.colorSpace = THREE.SRGBColorSpace;
      lm.channel = 1;
      lm.needsUpdate = true;
      m.lightMap = lm;
      m.lightMapIntensity = (m.name.startsWith('street_') ? 0.42 : 1.0) * K * Math.PI;
      m.aoMap = null;
      m.needsUpdate = true;
    }
  });
}

async function principal() {
  const coque = await charger(BASE + 'shell_village.glb');
  const K = coque.scene.children.find((c) => c.userData.lightmap_scale)?.userData.lightmap_scale || 1;
  coque.scene.traverse((o) => { o.userData.lightmap_scale = K; });
  const ext = (q.get('ext') || '').split(',').filter(Boolean);
  if (ext.includes('fond')) {
    const f = await charger(BASE + 'shell_village_ext_fond.glb');
    f.scene.traverse((o) => { o.userData.lightmap_scale = K; });
    lumiereCuite(f.scene);
    fixe.add(f.scene);
    const ferme = coque.scene.getObjectByName('shell_village_fond_ferme');
    if (ferme) ferme.visible = false;
  }
  lumiereCuite(coque.scene);
  fixe.add(coque.scene);
  // la place du Tilleul: sa propre carte de lumière (lightmap_scale du nœud)
  const place = q.get('place') === '0' ? null : await charger(BASE + 'shell_village_place.glb').catch(() => null);
  if (place) {
    const Kp = place.scene.children.find((c) => c.userData.lightmap_scale)?.userData.lightmap_scale || 1;
    place.scene.traverse((o) => { o.userData.lightmap_scale = Kp; });
    lumiereCuite(place.scene);
    fixe.add(place.scene);
  }
  if (ext.includes('terrasse')) {
    const t = await charger(BASE + 'shell_village_ext_terrasse.glb');
    vivant.add(t.scene);
  }
  const dessus = q.get('dessus') === '1';
  if (dessus) {
    coque.scene.traverse((o) => {
      if (o.isMesh && ['shell_ceiling', 'shell_beams', 'dt_lampe'].includes(o.material.name)) o.visible = false;
      if (o.isMesh && /lamps|glow/.test(o.name)) o.visible = false;
    });
  }
  // reflets des métaux et émaux des objets: environnement neutre calculé une fois (sans lui, cuivre et laiton sortent noirs)
  const pmrem = new THREE.PMREMGenerator(renderer);
  vivant.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  vivant.environmentIntensity = 0.45;
  // lumières réelles des meubles et personnages: hémisphérique, soleil sans ombre, deux suspensions du comptoir
  vivant.add(new THREE.HemisphereLight('#f4ead8', '#8a6a52', 1.6));
  const soleil = new THREE.DirectionalLight('#ffe2b8', 1.6);
  soleil.position.set(-4, 3, 9);
  vivant.add(soleil);
  for (const [x, z] of [[9.15, 8.72], [10.6, 8.85]]) {
    const l = new THREE.PointLight('#ffc27a', 2.5, 6, 2);
    l.position.set(x, 2.15, z);
    vivant.add(l);
  }
  const posees = [];
  const disp = q.get('disposition');
  if (disp) {
    const objets = [];
    for (const f of disp.split(',')) objets.push(...(await (await fetch(BASE + f)).json()).objets);
    const cache = new Map();
    for (const it of objets) {
      if (!cache.has(it.id)) cache.set(it.id, charger(BASE + it.id + '.glb').catch(() => null));
      const g = await cache.get(it.id);
      if (!g) continue;
      const o = g.scene.clone(true);
      o.position.set(it.x, it.y || 0, it.z);
      o.rotation.y = THREE.MathUtils.degToRad(it.rotation_deg || 0);
      o.traverse((m) => {
        if (!m.isMesh) return;
        if (m.material.name === 'dt_verre') { m.material = new THREE.MeshBasicMaterial({ color: '#c9d6d3', transparent: true, opacity: 0.25, depthWrite: false }); m.renderOrder = 2; }
        if (m.material.name === 'dt_lampe') m.material = new THREE.MeshBasicMaterial({ color: '#FFE6BE' });
      });
      vivant.add(o);
      posees.push(o);
    }
  }
  const mixers = [];
  for (const p of (q.get('persos') || '').split(';').filter(Boolean)) {
    const [id, rest] = p.split('@');
    const [x, z, r, clip] = rest.split(',');
    const g = await charger(BASE + id + '.glb');
    const o = g.scene;
    o.position.set(Number(x), 0, Number(z));
    o.rotation.y = THREE.MathUtils.degToRad(Number(r || 0));
    vivant.add(o);
    const mx = new THREE.AnimationMixer(o);
    const a = g.animations.find((c) => c.name === (clip || 'idle')) || g.animations[0];
    if (a) { mx.clipAction(a).play(); mx.setTime(1.0); }
    mixers.push(mx);
  }
  let camera;
  if (dessus) {
    const [x0, z0, x1, z1] = (q.get('cadre') || '3.6,6.5,11.5,13.2').split(',').map(Number);
    const asp = W / H;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    let hw = (x1 - x0) / 2, hh = (z1 - z0) / 2;
    if (hw / hh > asp) hh = hw / asp; else hw = hh * asp;
    camera = new THREE.OrthographicCamera(-hw, hw, hh, -hh, 0.1, 50);
    camera.position.set(cx, 20, cz);
    camera.up.set(0, 0, -1);
    camera.lookAt(cx, 0, cz);
  } else {
    const [p, c] = (q.get('cam') || '9.5,1.65,8.2;7,1.0,12').split(';').map((s) => s.split(',').map(Number));
    camera = new THREE.PerspectiveCamera(Number(q.get('fov') || 70), W / H, 0.05, Number(q.get('far') || 80));
    camera.position.set(...p);
    camera.lookAt(new THREE.Vector3(...c));
  }
  renderer.info.autoReset = false;
  renderer.info.reset();
  renderer.clear();
  renderer.render(fixe, camera);
  renderer.render(vivant, camera);
  window.vue = { pret: true, stats: { appels: renderer.info.render.calls, triangles: renderer.info.render.triangles, programmes: renderer.info.programs.length } };
}

principal().catch((e) => { window.vue = { pret: true, erreur: String(e && e.stack || e) }; });
