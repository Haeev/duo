/**
 * Planche de contrôle des récoltables d'Aubrune, rendue par le rendu encré DU JEU: `InkKit`
 * (`src/rendu/encre/`, matière, ombres, contour, ambiances), les modèles chargés par
 * `DecorModels` (`src/rendu/lieu/decors.ts`, conversion par le nom des matériaux, variantes,
 * écarts de pose) et posés comme `lieu.ts` les pose (`inkifyModel`). Rien n'y est modifié.
 *
 * Servie par Vite depuis la racine du paquet:
 *   /assets-src/decors/recoltables-aubrune/planche/index.html
 * La page attend qu'on lui donne une vue: `await window.planche.montrer(vue)`, où `vue` est une
 * entrée de la liste écrite par `monter.py vues` (sol, modèles posés, silhouettes, caméra).
 * Elle rend les places à l'écran des étiquettes (`reperes`) et les compteurs de l'image.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

import { InkKit, inkifyModel, inkTag, KIND, LAYER } from '../../../../src/rendu/encre/index';
import { createFloorMap } from '../../../../src/rendu/encre/sol';
import { DecorModels } from '../../../../src/rendu/lieu/decors';
import { DECOR_MANIFEST, variantOf } from '../../../../src/rendu/lieu/decors-manifeste';

function linear(hex) {
  return new THREE.Color(hex);
}

/** Une boîte teintée, prête pour la matière encrée (couleur linéaire par sommet). */
function box(w, h, d, x, y, z, color, rz = 0) {
  const geometry = new THREE.BoxGeometry(w, h, d);
  geometry.rotateZ(rz);
  geometry.translate(x, y, z);
  const c = linear(color);
  const colors = new Float32Array(geometry.getAttribute('position').count * 3);
  for (let i = 0; i < colors.length; i += 3) colors.set([c.r, c.g, c.b], i);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

/** Silhouette de 1,70 m: l'échelle de la planche. */
function silhouette(material) {
  const group = new THREE.Group();
  const parts = [
    box(0.15, 0.82, 0.17, -0.1, 0.41, 0, '#587F8E'),
    box(0.15, 0.82, 0.17, 0.1, 0.41, 0, '#587F8E'),
    box(0.4, 0.56, 0.23, 0, 1.1, 0, '#C5443D'),
    box(0.1, 0.56, 0.12, -0.27, 1.06, 0, '#C5443D', -0.08),
    box(0.1, 0.56, 0.12, 0.27, 1.06, 0, '#C5443D', 0.08),
    box(0.23, 0.26, 0.22, 0, 1.53, 0, '#E8B58F'),
    box(0.26, 0.06, 0.26, 0, 1.67, 0, '#6B4A33'),
  ];
  for (const geometry of parts) {
    inkTag(geometry, { layer: LAYER.plain });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}

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
  const kit = new InkKit();
  const models = new DecorModels(DECOR_MANIFEST);
  await models.ready;
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 400);
  let scene = null;
  let floorMap = null;

  async function montrer(vue) {
    scene = new THREE.Scene();
    scene.add(kit.air);
    floorMap?.dispose();
    const [width, height] = vue.terrain;
    floorMap = createFloorMap(vue.sol, width, height, null);
    kit.setGround(floorMap, width, height);
    const groundGeometry = new THREE.PlaneGeometry(width, height);
    groundGeometry.rotateX(-Math.PI / 2);
    groundGeometry.translate(width / 2, 0, height / 2);
    const white = new Float32Array(groundGeometry.getAttribute('position').count * 3).fill(1);
    groundGeometry.setAttribute('color', new THREE.BufferAttribute(white, 3));
    inkTag(groundGeometry, { layer: LAYER.grass, kind: KIND.ground });
    const ground = new THREE.Mesh(groundGeometry, kit.volume);
    ground.receiveShadow = true;
    scene.add(ground);
    // L'eau des cases `eau`: une nappe au matériau encré, comme celle des tuiles du jeu.
    for (const area of vue.sol.areas ?? []) {
      if (area.nature !== 'eau') continue;
      const sheet = new THREE.PlaneGeometry(area.w, area.h);
      sheet.rotateX(-Math.PI / 2);
      sheet.translate(area.x + area.w / 2, 0.012, area.y + area.h / 2);
      const tint = new Float32Array(sheet.getAttribute('position').count * 3).fill(1);
      sheet.setAttribute('color', new THREE.BufferAttribute(tint, 3));
      inkTag(sheet, { layer: LAYER.plain, kind: KIND.water });
      const material = kit.material();
      material.color.set('#4d8aa0');
      scene.add(new THREE.Mesh(sheet, material));
    }
    let triangles = 0;
    const missing = [];
    const files = new Map();
    for (const item of vue.objets) {
      // Vues de famille: le modèle nommé, tel quel (on cherche une clé qui ne tire pas une autre
      // forme). Compositions (`tirage`): la forme, le cap et l'échelle tirés comme en jeu.
      let key = item.cle;
      for (let n = 0; vue.tirage !== true && n < 64; n += 1) {
        key = `${item.cle}#${n}`;
        if (variantOf(item.modele, key, DECOR_MANIFEST) === item.modele) break;
      }
      const object = models.instantiate(item.modele, key);
      if (object === null) {
        missing.push(item.modele);
        continue;
      }
      // Comme `PlaceScene.build`: conversion à la pose, ombres, quart de tour de la carte.
      inkifyModel(object, kit.volume);
      object.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          child.frustumCulled = false;
          const index = child.geometry.index;
          triangles += (index ? index.count : child.geometry.getAttribute('position').count) / 3;
        }
      });
      object.position.set(item.x, 0, item.z);
      object.rotation.y = ((item.quart ?? 0) * Math.PI) / 2;
      if (item.fusion === undefined) {
        scene.add(object);
        continue;
      }
      // File de modules (haie, berge): ce que le moteur devra faire pour qu'elle se lise d'un
      // seul tenant. Le rendu donne à chaque exemplaire posé sa propre pièce de contour (trait
      // épais à chaque raccord); fusionnés en un maillage, avec un seul code de pièce, les
      // modules n'ont plus de trait entre eux.
      object.updateMatrixWorld(true);
      object.traverse((child) => {
        if (!child.isMesh) return;
        const part = child.geometry.clone();
        part.applyMatrix4(child.matrixWorld);
        (files.get(item.fusion) ?? files.set(item.fusion, []).get(item.fusion)).push(part);
      });
    }
    for (const parts of files.values()) {
      const merged = mergeGeometries(parts);
      const ink = merged.getAttribute('aInk');
      const piece = ink.getY(0);
      for (let i = 0; i < ink.count; i += 1) ink.setY(i, piece);
      const mesh = new THREE.Mesh(merged, kit.volume);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      scene.add(mesh);
    }
    // Volumes de mise en scène (rails et traverses d'une voie): des boîtes teintées, rien de plus.
    for (const b of vue.boites ?? []) {
      const geometry = box(b.w, b.h, b.d, b.x, b.y, b.z, b.couleur);
      inkTag(geometry, { layer: LAYER[b.couche ?? 'plain'] });
      const mesh = new THREE.Mesh(geometry, kit.volume);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
    for (const person of vue.silhouettes ?? []) {
      const figure = silhouette(kit.volume);
      figure.position.set(person.x, 0, person.z);
      figure.rotation.y = person.cap ?? 0;
      scene.add(figure);
    }
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    const pitch = ((vue.plongee ?? 50) * Math.PI) / 180;
    const yaw = ((vue.lacet ?? 0) * Math.PI) / 180;
    const toCamera = {
      x: -Math.sin(yaw) * Math.cos(pitch),
      y: Math.sin(pitch),
      z: Math.cos(yaw) * Math.cos(pitch),
    };
    const [cx, cz] = vue.centre;
    const span = vue.large ?? 18;
    camera.left = -span / 2;
    camera.right = span / 2;
    camera.top = (span * h) / w / 2;
    camera.bottom = -camera.top;
    camera.position.set(cx + toCamera.x * 120, toCamera.y * 120, cz + toCamera.z * 120);
    camera.lookAt(cx, 0, cz);
    camera.updateProjectionMatrix();
    const depth = (span * h) / w / Math.sin(pitch);
    const frame = {
      dt: 1 / 30,
      minutes: vue.minutes ?? 960,
      sheet: vue.ambiance ?? null,
      weather: null,
      indoor: false,
      place: null,
      focusX: cx,
      focusZ: cz,
      viewRadius: Math.hypot(span, depth) / 2,
      toCamera,
      lights: null,
      exposure: 1,
      width: w,
      height: h,
    };
    // La mise en route des programmes est étalée et le rendu logiciel saute des images:
    // on dessine jusqu'à ce que tout soit en scène, puis quelques images de plus.
    let after = 0;
    let calls = 0;
    let drawn = 0;
    for (let i = 0; i < 600 && after < 4; i += 1) {
      renderer.info.render.calls = 0;
      kit.frame(renderer, scene, camera, frame);
      if (renderer.info.render.calls > 0) {
        calls = renderer.info.render.calls;
        drawn = renderer.info.render.triangles;
        if (kit.warm()) after += 1;
      }
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
    const reperes = (vue.etiquettes ?? []).map((label) => {
      const p = new THREE.Vector3(label.x, label.y ?? 0, label.z).project(camera);
      return { ...label, px: ((p.x + 1) / 2) * w, py: ((1 - p.y) / 2) * h };
    });
    return {
      triangles,
      manquants: missing,
      appels: calls,
      trianglesImage: drawn,
      reperes,
    };
  }

  window.planche = { pret: true, modeles: models.size, montrer };
}

start().catch((error) => {
  window.planche = { pret: false, erreur: String(error?.stack ?? error) };
});
