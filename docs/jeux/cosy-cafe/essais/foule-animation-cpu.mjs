// Essai de mesure de la section technique de Cosy Café (2026-11-07).
//
// Question: combien coûte au processeur, à chaque image, l'animation par squelettes de N
// personnages dans Three.js 0.187? C'est le seul plafond de la foule qu'aucune mesure de
// La Petite Ligne ne fixe (appels de dessin et triangles se calculent à partir de ses relevés).
//
// Mesuré, sans rendu ni WebGL (Node 22): ce que fait la boucle d'image pour chaque personnage
// avant le dessin, soit AnimationMixer.update (un clip, ou deux clips mêlés pour un quart des
// personnages), la mise à jour des matrices du monde (os compris) et Skeleton.update (matrices
// des os envoyées au GPU). Temps processeur lu par process.cpuUsage(), ramasse-miettes compté à
// part. Non mesuré: le dessin, le pilote graphique, le GPU. SwiftShader n'intervient pas ici, et
// ne représenterait de toute façon pas l'Intel UHD 620.
//
// Modèle: personnages.glb de La Petite Ligne (squelette de 18 os, clips de 20 pistes). Les images
// et textures sont retirées avant la lecture (Node n'a pas de décodeur d'images): elles ne jouent
// aucun rôle dans l'animation.
//
// Usage: node foule-animation-cpu.mjs <dossier contenant node_modules/three 0.187.0> <personnages.glb> [sortie.json]

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { performance, PerformanceObserver } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';

const [depsDir, glbPath, outPath] = process.argv.slice(2);
if (depsDir === undefined || glbPath === undefined) {
  process.stderr.write('Usage: node foule-animation-cpu.mjs <dossier des dépendances> <personnages.glb> [sortie.json]\n');
  process.exit(2);
}

const moduleUrl = (relative) => pathToFileURL(join(depsDir, 'node_modules', relative)).href;
const THREE = await import(moduleUrl('three/build/three.module.js'));
const { GLTFLoader } = await import(moduleUrl('three/examples/jsm/loaders/GLTFLoader.js'));
const SkeletonUtils = await import(moduleUrl('three/examples/jsm/utils/SkeletonUtils.js'));

const MODEL = 'villager_odette';
const CLIPS = ['walk', 'idle', 'sit', 'sit_eat', 'drink', 'talk', 'give', 'carry_one'];
const COUNTS = [1, 10, 20, 40, 60, 80, 120];
const FRAMES = 1200;
const WARMUP = 240;
const REPEATS = 5;
const DT = 1 / 60;

/** GLB sans images ni textures, BIN inchangé. */
function stripTextures(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const jsonLength = view.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength)));
  const rest = bytes.subarray(20 + jsonLength);
  delete json.images;
  delete json.textures;
  delete json.samplers;
  for (const material of json.materials ?? []) {
    const pbr = material.pbrMetallicRoughness;
    if (pbr !== undefined) {
      delete pbr.baseColorTexture;
      delete pbr.metallicRoughnessTexture;
    }
    delete material.normalTexture;
    delete material.occlusionTexture;
    delete material.emissiveTexture;
  }
  let text = JSON.stringify(json);
  while (text.length % 4 !== 0) text += ' ';
  const jsonBytes = new TextEncoder().encode(text);
  const total = 12 + 8 + jsonBytes.length + rest.length;
  const out = new Uint8Array(total);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, 0x46546c67, true);
  outView.setUint32(4, 2, true);
  outView.setUint32(8, total, true);
  outView.setUint32(12, jsonBytes.length, true);
  outView.setUint32(16, 0x4e4f534a, true);
  out.set(jsonBytes, 20);
  out.set(rest, 20 + jsonBytes.length);
  return out.buffer;
}

const gltf = await new Promise((resolve, reject) => {
  new GLTFLoader().parse(stripTextures(new Uint8Array(readFileSync(glbPath))), '', resolve, reject);
});

// Gabarit: la scène du GLB sans autre maillage que le personnage choisi (les os restent).
const template = gltf.scene;
const unwanted = [];
template.traverse((object) => {
  if (object.isMesh && object.name !== MODEL) unwanted.push(object);
});
for (const object of unwanted) object.removeFromParent();
let templateMesh = null;
template.traverse((object) => {
  if (object.isSkinnedMesh) templateMesh = object;
});
if (templateMesh === null) throw new Error(`modèle ${MODEL} introuvable ou sans squelette`);

const clips = CLIPS.map((name) => {
  const clip = THREE.AnimationClip.findByName(gltf.animations, name);
  if (clip === null) throw new Error(`clip ${name} introuvable`);
  return clip;
});

function buildCrowd(count) {
  const scene = new THREE.Scene();
  const rigs = [];
  for (let i = 0; i < count; i += 1) {
    const root = SkeletonUtils.clone(template);
    root.position.set((i % 10) * 1.2, 0, Math.floor(i / 10) * 1.2);
    scene.add(root);
    let mesh = null;
    root.traverse((object) => {
      if (object.isSkinnedMesh) mesh = object;
    });
    const mixer = new THREE.AnimationMixer(root);
    const first = mixer.clipAction(clips[i % clips.length]);
    first.play();
    first.time = (i * 0.37) % clips[i % clips.length].duration;
    if (i % 4 === 3) {
      // Un quart des personnages en transition permanente: deux clips mêlés.
      const second = mixer.clipAction(clips[(i + 1) % clips.length]);
      second.play();
      first.setEffectiveWeight(0.5);
      second.setEffectiveWeight(0.5);
    }
    rigs.push({ mixer, skeleton: mesh.skeleton });
  }
  return { scene, rigs };
}

function frame(scene, rigs) {
  for (const rig of rigs) rig.mixer.update(DT);
  scene.updateMatrixWorld();
  for (const rig of rigs) rig.skeleton.update();
}

let gcMs = 0;
const gcObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) gcMs += entry.duration;
});
gcObserver.observe({ entryTypes: ['gc'] });

const results = [];
for (const count of COUNTS) {
  const { scene, rigs } = buildCrowd(count);
  for (let f = 0; f < WARMUP; f += 1) frame(scene, rigs);
  const runs = [];
  for (let r = 0; r < REPEATS; r += 1) {
    gcMs = 0;
    const cpu0 = process.cpuUsage();
    const wall0 = performance.now();
    for (let f = 0; f < FRAMES; f += 1) frame(scene, rigs);
    const cpu = process.cpuUsage(cpu0);
    const wallMs = performance.now() - wall0;
    await new Promise((resolve) => setTimeout(resolve, 20));
    runs.push({ cpuMsPerFrame: (cpu.user + cpu.system) / 1000 / FRAMES, wallMsPerFrame: wallMs / FRAMES, gcMs });
  }
  runs.sort((a, b) => a.cpuMsPerFrame - b.cpuMsPerFrame);
  const best = runs[0];
  const median = runs[Math.floor(runs.length / 2)];
  results.push({
    count,
    bestCpuMsPerFrame: Number(best.cpuMsPerFrame.toFixed(4)),
    medianCpuMsPerFrame: Number(median.cpuMsPerFrame.toFixed(4)),
    bestWallMsPerFrame: Number(best.wallMsPerFrame.toFixed(4)),
    microsecondsPerCharacter: Number(((median.cpuMsPerFrame * 1000) / count).toFixed(1)),
    gcMsDuringBestRun: Number(best.gcMs.toFixed(2)),
  });
}
gcObserver.disconnect();

const report = {
  date: new Date().toISOString(),
  node: process.version,
  three: THREE.REVISION,
  model: MODEL,
  bones: templateMesh.skeleton.bones.length,
  triangles: templateMesh.geometry.index === null ? null : templateMesh.geometry.index.count / 3,
  clips: CLIPS,
  frames: FRAMES,
  repeats: REPEATS,
  results,
};
if (outPath !== undefined) writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
for (const row of results) {
  process.stdout.write(
    `${String(row.count).padStart(4)} personnages: ${row.medianCpuMsPerFrame.toFixed(3)} ms par image (médiane), ` +
      `${row.bestCpuMsPerFrame.toFixed(3)} ms (meilleure), ${row.microsecondsPerCharacter} µs par personnage\n`,
  );
}
