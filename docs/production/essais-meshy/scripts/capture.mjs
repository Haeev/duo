// Capture en vue subjective d'un ou plusieurs GLB dans Three.js 0.187 sous Chromium (Playwright),
// avec un coin de café minimal (sol, mur, comptoir à 0,90 m) et un repère de 1,80 m, puis mesures:
// triangles et appels de dessin de l'image (renderer.info), programmes, triangles et appels propres
// à chaque modèle, poids du fichier, mémoire des textures (mipmaps comprises).
//
// Usage: node capture.mjs <dossier de three> <config.json> <sortie.png> <mesures.json>
//   <dossier de three>: le paquet three@0.187.0 (dossier qui contient build/ et examples/)
//   config.json: { width, height, fov, eye: [x,y,z], target: [x,y,z], counter: bool,
//                  marker: [x,z], models: [{ file (relatif à config.json), position: [x,y,z],
//                  rotationY (degrés), clip (nom ou null), time (s) }] }
import { createServer } from "node:http";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const [threeDir, configPath, outPng, outJson] = process.argv.slice(2);
if (!threeDir || !configPath || !outPng || !outJson) {
  process.stderr.write("usage: node capture.mjs <dossier de three> <config.json> <sortie.png> <mesures.json>\n");
  process.exit(2);
}
const config = JSON.parse(readFileSync(configPath, "utf-8"));
// Chemins des modèles relatifs au fichier de configuration.
const models = config.models.map((m, i) => {
  const file = resolve(dirname(configPath), m.file);
  return { ...m, file, url: `/modele-${i}.glb`, bytes: statSync(file).size };
});

const page = `<!doctype html><html><head><meta charset="utf-8">
<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
<style>html,body{margin:0;background:#000}canvas{display:block}</style></head><body>
<script type="module">
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
const cfg = ${JSON.stringify({ ...config, models: models.map(({ file, ...rest }) => rest) })};
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(cfg.width, cfg.height);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color("#2a2420");
const camera = new THREE.PerspectiveCamera(cfg.fov, cfg.width / cfg.height, 0.05, 80);
camera.position.set(...cfg.eye);
camera.lookAt(new THREE.Vector3(...cfg.target));
// Lumières du budget: une hémisphérique, une directionnelle sans ombre (C9, C10).
scene.add(new THREE.HemisphereLight("#fff3e0", "#5a4636", 1.6));
const sun = new THREE.DirectionalLight("#ffe2b8", 2.2);
sun.position.set(-2, 4, 3);
scene.add(sun);
const mat = (hex) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.9 });
const decor = new THREE.Group();
const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), mat("#A65A3E"));
floor.rotation.x = -Math.PI / 2;
decor.add(floor);
const wall = new THREE.Mesh(new THREE.PlaneGeometry(8, 3), mat("#D5C4A5"));
wall.position.set(0, 1.5, -0.6);
decor.add(wall);
if (cfg.counter) {
  const front = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.86, 0.6), mat("#7E937B"));
  front.position.set(0, 0.43, -0.05);
  decor.add(front);
  const top = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.04, 0.66), mat("#5E4130"));
  top.position.set(0, 0.88, -0.05);
  decor.add(top);
}
// Repère de 1,80 m: perche à bandes de 10 cm, chapeau rouge à 1,80 m.
const marker = new THREE.Group();
for (let i = 0; i < 18; i++) {
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.1, 8), mat(i % 2 ? "#F5F0E6" : "#2B2622"));
  band.position.y = 0.05 + i * 0.1;
  marker.add(band);
}
const cap = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.012, 0.012), mat("#B0302A"));
cap.position.y = 1.8;
marker.add(cap);
marker.position.set(cfg.marker[0], 0, cfg.marker[1]);
decor.add(marker);
scene.add(decor);

const loader = new GLTFLoader();
const perModel = [];
const mixers = [];
for (const m of cfg.models) {
  const gltf = await loader.loadAsync(m.url);
  const root = gltf.scene;
  root.position.set(...m.position);
  root.rotation.y = THREE.MathUtils.degToRad(m.rotationY || 0);
  scene.add(root);
  let triangles = 0, calls = 0, bones = 0;
  const textures = new Map();
  root.traverse((o) => {
    if (o.isMesh) {
      calls += 1;
      const g = o.geometry;
      triangles += (g.index ? g.index.count : g.attributes.position.count) / 3;
      for (const mt of Array.isArray(o.material) ? o.material : [o.material]) {
        for (const key of ["map", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap", "aoMap"]) {
          const t = mt[key];
          if (t && t.image) textures.set(t.uuid, { slot: key, w: t.image.width, h: t.image.height });
        }
      }
      if (o.isSkinnedMesh) bones = Math.max(bones, o.skeleton.bones.length);
    }
  });
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  let clipInfo = null;
  if (gltf.animations.length) {
    const mixer = new THREE.AnimationMixer(root);
    const clip = (m.clip && THREE.AnimationClip.findByName(gltf.animations, m.clip)) || null;
    if (clip) {
      mixer.clipAction(clip).play();
      mixer.setTime(m.time || 0);
      clipInfo = clip.name;
    }
    mixers.push(mixer);
  }
  const texList = [...textures.values()];
  perModel.push({
    url: m.url,
    triangles,
    drawCalls: calls,
    bones,
    clips: gltf.animations.map((a) => ({ name: a.name, duration: Number(a.duration.toFixed(3)), tracks: a.tracks.length })),
    playing: clipInfo,
    sizeM: [size.x, size.y, size.z].map((v) => Number(v.toFixed(3))),
    textures: texList,
    textureBytesWithMips: Math.round(texList.reduce((s, t) => s + t.w * t.h * 4 * (4 / 3), 0)),
  });
}
renderer.info.autoReset = false;
renderer.info.reset();
renderer.render(scene, camera);
let decorTriangles = 0, decorCalls = 0;
decor.traverse((o) => { if (o.isMesh) { decorCalls += 1; decorTriangles += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; } });
window.__result = {
  frame: { triangles: renderer.info.render.triangles, calls: renderer.info.render.calls, programs: renderer.info.programs.length, textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries },
  decor: { triangles: decorTriangles, calls: decorCalls },
  models: perModel,
  png: renderer.domElement.toDataURL("image/png"),
};
</script></body></html>`;

const types = { ".js": "text/javascript", ".glb": "model/gltf-binary", ".html": "text/html" };
const server = createServer((req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  try {
    let body;
    let type;
    if (url === "/") {
      body = page;
      type = types[".html"];
    } else if (url.startsWith("/modele-")) {
      body = readFileSync(models[Number(url.slice(8, -4))].file);
      type = types[".glb"];
    } else if (url.startsWith("/three/")) {
      const path = resolve(join(threeDir, url.slice(7)));
      if (!path.startsWith(resolve(threeDir))) throw new Error("hors du dossier de three");
      body = readFileSync(path);
      type = types[extname(path)] ?? "application/octet-stream";
    } else {
      throw new Error("introuvable");
    }
    res.writeHead(200, { "content-type": type });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const port = server.address().port;
const browser = await chromium.launch();
try {
  const tab = await browser.newPage({ viewport: { width: config.width, height: config.height }, deviceScaleFactor: 1 });
  const errors = [];
  tab.on("pageerror", (e) => errors.push(String(e)));
  await tab.goto(`http://127.0.0.1:${port}/`);
  await tab.waitForFunction(() => window.__result !== undefined || false, null, { timeout: 180_000 });
  const result = await tab.evaluate(() => window.__result);
  writeFileSync(outPng, Buffer.from(result.png.split(",")[1], "base64"));
  delete result.png;
  result.models = result.models.map((m, i) => ({ file: models[i].file.split("/").pop(), fileBytes: models[i].bytes, ...m }));
  result.viewport = [config.width, config.height];
  result.fovVertical = config.fov;
  result.pageErrors = errors;
  writeFileSync(outJson, JSON.stringify(result, null, 2) + "\n");
  process.stdout.write(`${JSON.stringify(result.frame)}\n`);
} finally {
  await browser.close();
  server.close();
}
