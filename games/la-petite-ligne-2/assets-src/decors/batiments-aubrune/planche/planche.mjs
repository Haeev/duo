/**
 * Planche de contrôle des bâtiments d'Aubrune, rendue avec la matière, les ombres et la passe
 * d'encrage de la scène d'essai validée (`src/rendu/demo-encre/`, importés tels quels: rien
 * n'y est modifié). Elle charge les GLB livrés et les convertit comme le moteur devra le faire:
 * la couche de traits vient du NOM du matériau, les morceaux des sommets communs.
 *
 * Servie par Vite depuis la racine du paquet:
 *   /assets-src/decors/batiments-aubrune/planche/index.html?id=firmin
 * Paramètres: `id` (un bâtiment) ou `bourg=1` (tous, à leur place du plan), `dossier` (GLB),
 * `lacet` (degrés, 0: le haut de l'écran est au nord; par défaut face à la porte), `largeur`
 * (m), `x`, `z` (point visé), `ambiance` (jour, crepuscule, nuit, aube), `dense=1`, `plongee`.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { ambianceOf } from '../../../../src/rendu/demo-encre/ambiances';
import { InkPass, rankWeights } from '../../../../src/rendu/demo-encre/contours';
import { at, GLOW, hex, LAYER, Sculpt, sizeClass } from '../../../../src/rendu/demo-encre/formes';
import {
  applyAmbiance,
  createInkMaterials,
  createInkUniforms,
  LampShadow,
  SunShadow,
} from '../../../../src/rendu/demo-encre/matiere';
import { scatter } from '../../../../src/rendu/demo-encre/semis';
import {
  createGroundMap,
  heightFunction,
  terrainGeometry,
} from '../../../../src/rendu/demo-encre/terrain';
import { createInkLayers, createNoise } from '../../../../src/rendu/demo-encre/textures';

/** Couche de traits et nature de chaque matériau des bâtiments: la table que le moteur doit lire. */
export const MATERIAUX = {
  pierre: { layer: LAYER.face, glow: GLOW.none },
  moellon: { layer: LAYER.slab, glow: GLOW.none },
  crepi: { layer: LAYER.wall, glow: GLOW.none },
  tuile: { layer: LAYER.roof, glow: GLOW.none },
  bois: { layer: LAYER.grain, glow: GLOW.none },
  bardage: { layer: LAYER.wood, glow: GLOW.none },
  volet: { layer: LAYER.grain, glow: GLOW.none },
  vitre: { layer: LAYER.plain, glow: GLOW.window },
  metal: { layer: LAYER.plain, glow: GLOW.none },
};

const params = new URLSearchParams(window.location.search);
const num = (name, fallback) => {
  const raw = params.get(name);
  const value = raw === null ? NaN : Number(raw);
  return Number.isFinite(value) ? value : fallback;
};

function toScreen(c) {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

/**
 * Convertit un modèle livré en une géométrie de la matière encrée: couleur d'écran par sommet,
 * couche par matériau, un numéro par morceau d'un seul tenant et sa classe de taille.
 */
function inkGeometry(root, piece) {
  const positions = [];
  const normals = [];
  const colors = [];
  const uvs = [];
  const kinds = [];
  root.updateMatrixWorld(true);
  root.traverse((object) => {
    if (!object.isMesh) return;
    const rule = MATERIAUX[object.material.name];
    if (!rule) throw new Error(`matériau inconnu: ${object.material.name}`);
    const geometry = object.geometry.index
      ? object.geometry.toNonIndexed()
      : object.geometry.clone();
    geometry.applyMatrix4(object.matrixWorld);
    const p = geometry.getAttribute('position');
    const n = geometry.getAttribute('normal');
    const c = geometry.getAttribute('color');
    const t = geometry.getAttribute('uv');
    for (let i = 0; i < p.count; i += 1) {
      positions.push(p.getX(i), p.getY(i), p.getZ(i));
      normals.push(n.getX(i), n.getY(i), n.getZ(i));
      colors.push(toScreen(c.getX(i)), toScreen(c.getY(i)), toScreen(c.getZ(i)));
      uvs.push(t.getX(i), t.getY(i));
      kinds.push(rule.layer, rule.glow);
    }
  });
  const count = positions.length / 3;
  const parent = new Uint32Array(count);
  for (let i = 0; i < count; i += 1) parent[i] = i;
  const find = (i) => {
    let r = i;
    while (parent[r] !== r) r = parent[r];
    while (parent[i] !== r) {
      const next = parent[i];
      parent[i] = r;
      i = next;
    }
    return r;
  };
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };
  const seen = new Map();
  for (let i = 0; i < count; i += 1) {
    const key = `${Math.round(positions[i * 3] * 1000)},${Math.round(positions[i * 3 + 1] * 1000)},${Math.round(positions[i * 3 + 2] * 1000)}`;
    const first = seen.get(key);
    if (first === undefined) seen.set(key, i);
    else union(first, i);
  }
  for (let i = 0; i + 2 < count; i += 3) {
    union(i, i + 1);
    union(i, i + 2);
  }
  const boxes = new Map();
  for (let i = 0; i < count; i += 1) {
    const r = find(i);
    let box = boxes.get(r);
    if (!box) {
      box = { box: new THREE.Box3(), index: boxes.size };
      boxes.set(r, box);
    }
    box.box.expandByPoint(
      new THREE.Vector3(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]),
    );
  }
  const metas = new Float32Array(count * 4);
  const size = new THREE.Vector3();
  const pieceCode = (piece % 62) + 1;
  for (let i = 0; i < count; i += 1) {
    const part = boxes.get(find(i));
    metas[i * 4] = kinds[i * 2];
    metas[i * 4 + 1] = pieceCode;
    metas[i * 4 + 2] = kinds[i * 2 + 1];
    metas[i * 4 + 3] = (part.index % 62) + 1 + 64 * sizeClass(part.box.getSize(size).length());
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('aColor', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('aMeta', new THREE.BufferAttribute(metas, 4));
  geometry.setAttribute('aFoot', new THREE.Float32BufferAttribute(new Float32Array(count), 1));
  geometry.computeBoundingSphere();
  return { geometry, parts: boxes.size, triangles: count / 3 };
}

/** Silhouette de 1,70 m: l'échelle de la planche (une porte fait 2,06 m). */
function silhouette(sculpt, x, z, yaw) {
  const cloth = hex('#C5443D');
  const trousers = hex('#587F8E');
  const skin = hex('#E8B58F');
  sculpt.group(at(x, 0, z, yaw), () => {
    for (const side of [-1, 1]) {
      sculpt.box(0.15, 0.82, 0.17, at(side * 0.1, 0.41, 0), { color: trousers, wobble: 0.01 });
      sculpt.box(0.1, 0.56, 0.12, at(side * 0.27, 1.06, 0, 0, 0, side * 0.08), {
        color: cloth,
        wobble: 0.01,
      });
    }
    sculpt.box(0.4, 0.56, 0.23, at(0, 1.1, 0), { color: cloth, wobble: 0.015 });
    sculpt.blob(0.115, 0.14, 0.12, at(0, 1.56, 0), { color: skin, wobble: 0.004 });
    sculpt.box(0.25, 0.07, 0.25, at(0, 1.665, 0, 0.3), { color: hex('#6B4A33'), wobble: 0.01 });
  });
}

const FACING = { sud: 0, est: -90, nord: 180, ouest: 90 };

async function start() {
  const canvas = document.querySelector('#scene');
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(1);
  renderer.autoClear = false;
  const uniforms = createInkUniforms();
  const noise = createNoise();
  uniforms.uLayers.value = createInkLayers();
  uniforms.uNoise.value = noise;
  const materials = createInkMaterials(uniforms);
  const shadow = new SunShadow(2048);
  const lampShadow = new LampShadow(512);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 260);
  const inkPass = new InkPass(2, 2, noise);

  const folder = params.get('dossier') ?? '/assets/lieux/aubrune/batiments';
  const manifest = await (await fetch(`${folder}/batiments.json`)).json();
  const wanted = params.get('id');
  const placed = [];
  if (params.get('bourg') === '1') {
    const plan = await (await fetch('/donnees/lieux/aubrune/plan.json')).json();
    for (const b of plan.batiments) {
      const id = b.id.replaceAll('_', '-');
      if (manifest.batiments[id])
        placed.push({ id, x: b.rect[0] + b.rect[2] / 2, z: b.rect[1] + b.rect[3] / 2 });
    }
  } else {
    (wanted ?? '')
      .split(',')
      .filter(Boolean)
      .forEach((id, index, all) => {
        placed.push({ id, x: (index - (all.length - 1) / 2) * num('pas', 14), z: 0 });
      });
  }
  const loader = new GLTFLoader();
  const root = new THREE.Scene();
  const walls = [];
  const windows = [];
  const paths = [];
  const stand = [];
  let triangles = 0;
  let parts = 0;
  const people = new Sculpt(40);
  for (const [index, place] of placed.entries()) {
    const entry = manifest.batiments[place.id];
    const gltf = await loader.loadAsync(`${folder}/${entry.fichier}`);
    const built = inkGeometry(gltf.scene, index);
    triangles += built.triangles;
    parts += built.parts;
    const mesh = new THREE.Mesh(built.geometry, materials.object);
    mesh.position.set(place.x, 0, place.z);
    mesh.frustumCulled = false;
    mesh.layers.enable(1);
    mesh.layers.enable(2);
    root.add(mesh);
    const w = entry.emprise.largeur;
    const d = entry.emprise.profondeur;
    walls.push({
      x0: place.x - w / 2,
      z0: place.z - d / 2,
      x1: place.x + w / 2,
      z1: place.z + d / 2,
    });
    for (const f of entry.fenetres) {
      windows.push({
        x: place.x + f.x,
        sill: f.appui,
        z: place.z + f.z,
        width: f.largeur,
        height: f.hauteur,
        nx: f.nx,
        nz: f.nz,
      });
    }
    if (entry.porte) {
      const a = (FACING[entry.porte.facade] * Math.PI) / 180;
      const out = [-Math.sin(a), Math.cos(a)];
      const px = place.x + entry.porte.x;
      const pz = place.z + entry.porte.z;
      // Le chemin part du seuil: une porte donne toujours sur un endroit où l'on marche.
      paths.push({
        points: [
          [px + out[0] * 0.4, pz + out[1] * 0.4],
          [px + out[0] * 3.2, pz + out[1] * 3.2],
          [px + out[0] * 3.4 + out[1] * 9, pz + out[1] * 3.4 - out[0] * 9],
        ],
        width: 1.7,
      });
      paths.push({
        points: [
          [px + out[0] * 3.2, pz + out[1] * 3.2],
          [px + out[0] * 3.4 - out[1] * 9, pz + out[1] * 3.4 + out[0] * 9],
        ],
        width: 1.7,
      });
      const sx = px + out[0] * 1.7 - out[1] * 1.25;
      const sz = pz + out[1] * 1.7 + out[0] * 1.25;
      stand.push({ x0: sx - 0.5, z0: sz - 0.5, x1: sx + 0.5, z1: sz + 0.5 });
      silhouette(people, sx, sz, a + 0.5);
    }
  }
  const all = new THREE.Box3();
  walls.forEach((r) => {
    all.expandByPoint(new THREE.Vector3(r.x0, 0, r.z0));
    all.expandByPoint(new THREE.Vector3(r.x1, 0, r.z1));
  });
  const centre = all.getCenter(new THREE.Vector3());
  const span = all.getSize(new THREE.Vector3());
  const margin = 44;
  const plan = {
    origin: [all.min.x - margin, all.min.z - margin],
    size: [span.x + 2 * margin, span.z + 2 * margin],
    paths: params.get('bourg') === '1' ? [] : paths,
    ballast: [],
  };
  const spec = {
    plan,
    rolling: 0.12,
    bumps: 0.05,
    flats: walls.map((r) => ({ ...r, level: 0.02, margin: 1.2 })),
    pathDepth: 0.06,
    bank: 0.4,
    ruts: [],
    ditches: [],
    stepX: 0.6,
    fineZ: [all.min.z - 8, all.max.z + 8],
    stepZ: 0.3,
  };
  const height = heightFunction(spec);
  const ground = new THREE.Mesh(terrainGeometry(spec, height), materials.ground);
  ground.renderOrder = -1;
  ground.frustumCulled = false;
  root.add(ground);
  uniforms.uMask.value = createGroundMap(spec, height);
  uniforms.uMaskRect.value.set(...plan.origin, ...plan.size);
  if (params.get('semis') !== '0' && params.get('bourg') !== '1') {
    const area = { x0: all.min.x - 9, z0: all.min.z - 9, x1: all.max.x + 9, z1: all.max.z + 9 };
    for (const batch of scatter({ plan, height, walls, ditches: [] }, area, [...walls, ...stand])) {
      const instanced = new THREE.InstancedMesh(
        batch.geometry,
        materials.object,
        batch.matrices.length,
      );
      batch.matrices.forEach((matrix, i) => instanced.setMatrixAt(i, matrix));
      instanced.frustumCulled = false;
      if (batch.shadow) instanced.layers.enable(1);
      root.add(instanced);
    }
  }
  const figures = new THREE.Mesh(people.build(), materials.object);
  figures.frustumCulled = false;
  figures.layers.enable(1);
  root.add(figures);

  const first = placed[0] ? manifest.batiments[placed[0].id] : null;
  const facing = first?.porte ? FACING[first.porte.facade] : 0;
  const state = {
    x: num('x', centre.x),
    z: num('z', centre.z),
    width: num(
      'largeur',
      Math.max(
        15,
        Math.hypot(span.x, span.z) * 1.3 + (first ? Math.min(first.hauteur, 12) * 0.62 : 0),
      ),
    ),
    yaw: num('lacet', facing + 24),
    pitch: num('plongee', 50),
    ambiance: params.get('ambiance') ?? 'jour',
    dense: params.get('dense') !== '0',
    time: num('t', 3),
  };

  function draw() {
    const width = canvas.clientWidth;
    const heightPx = canvas.clientHeight;
    renderer.setSize(width, heightPx, false);
    inkPass.setSize(width, heightPx);
    uniforms.uScreen.value.set(width, heightPx);
    const base = ambianceOf('exterieur', state.ambiance, state.dense);
    // Soleil placé par rapport à la caméra comme sur la référence validée (derrière, un peu à gauche):
    // la façade regardée est éclairée quel que soit le côté de la porte. `soleil=plan` garde
    // l'azimut de l'ambiance (vue du bourg: tous les bâtiments sous le même soleil).
    const ambiance =
      params.get('soleil') === 'plan'
        ? base
        : {
            ...base,
            sunAzimuth: num('soleil', state.yaw + 191),
            sunElevation: num('elevation', base.sunElevation),
          };
    const yaw = (state.yaw * Math.PI) / 180;
    const pitch = (state.pitch * Math.PI) / 180;
    const target = new THREE.Vector3(state.x, num('y', (first?.hauteur ?? 6) * 0.3), state.z);
    const forward = new THREE.Vector3(Math.sin(yaw), 0, -Math.cos(yaw));
    const near = [...windows]
      .sort(
        (a, b) =>
          Math.hypot(a.x - state.x, a.z - state.z) - Math.hypot(b.x - state.x, b.z - state.z),
      )
      .slice(0, 8);
    applyAmbiance(uniforms, ambiance, [], false, 'aplat-hachure', near);
    uniforms.uTime.value = state.time;
    camera.position
      .copy(target)
      .addScaledVector(forward, -Math.cos(pitch) * 110)
      .add(new THREE.Vector3(0, Math.sin(pitch) * 110, 0));
    const aspect = width / heightPx;
    camera.left = -state.width / 2;
    camera.right = state.width / 2;
    camera.top = state.width / aspect / 2;
    camera.bottom = -state.width / aspect / 2;
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    const pixelsPerMetre = width / state.width;
    const fade = (value, a, b) => {
      const t = Math.min(1, Math.max(0, (value - a) / (b - a)));
      return t * t * (3 - 2 * t);
    };
    uniforms.uDetail.value.set(
      fade(pixelsPerMetre, 45, 85),
      fade(pixelsPerMetre, 80, 150),
      fade(pixelsPerMetre, 34, 80),
    );
    uniforms.uViewDir.value.copy(camera.position).sub(target).normalize();
    uniforms.uPainted.value = 1;
    shadow.update(renderer, root, materials.depth, uniforms, target, state.width * 0.72 + 6);
    lampShadow.update(renderer, root, materials.depth, uniforms, null, -1);
    renderer.setRenderTarget(inkPass.target);
    renderer.setClearColor(
      new THREE.Color().setRGB(...ambiance.background, THREE.SRGBColorSpace),
      1,
    );
    renderer.clear();
    renderer.render(root, camera);
    inkPass.setAmbiance(ambiance);
    const zoom = Math.min(1.7, Math.max(0.85, Math.sqrt(30 / state.width)));
    inkPass.render(renderer, camera, 1.55 * zoom * (heightPx / 768), rankWeights(pixelsPerMetre));
    const pixel = new Uint8Array(4);
    const gl = renderer.getContext();
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
  }

  window.planche = {
    pret: false,
    triangles,
    morceaux: parts,
    appels: 0,
    voir(change) {
      Object.assign(state, change);
      draw();
      draw();
      window.planche.appels = renderer.info.render.calls;
    },
  };
  draw();
  draw();
  window.planche.pret = true;
}

start().catch((error) => {
  window.planche = { pret: false, erreur: String(error?.stack ?? error) };
});
