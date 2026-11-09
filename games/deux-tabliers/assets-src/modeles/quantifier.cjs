// Compression d'un GLB à textures externes partagées (KHR_mesh_quantization, gltf-transform 4): positions sur 16 bits
// (1 mm sur 70 m: les panneaux posés à 6 mm devant les murs ne se mêlent pas), UV sur 14 bits (carte de lumière de
// 2048 px: 1/8 de pixel), normales et couleurs sur 8 bits. Les images restent externes (`textures/<fichier>`, partagées
// entre GLB): on réécrit le GLB soi-même au lieu de laisser gltf-transform les embarquer.
// Usage: NODE_PATH=<node_modules avec @gltf-transform> node quantifier.cjs <modèle.glb> [<sortie.glb>]
const fs = require('fs');
const path = require('path');
const { NodeIO, Format } = require('@gltf-transform/core');
const { ALL_EXTENSIONS } = require('@gltf-transform/extensions');
const { quantize, dedup } = require('@gltf-transform/functions');

(async () => {
  const src = process.argv[2];
  const dst = process.argv[3] || src;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.read(src);
  await doc.transform(
    dedup(),
    quantize({ quantizePosition: 16, quantizeTexcoord: 14, quantizeNormal: 8, quantizeColor: 8 }),
  );
  const { json, resources } = await io.writeJSON(doc, { format: Format.GLTF });
  if (json.buffers.length !== 1) throw new Error(`un seul tampon attendu, ${json.buffers.length} trouvés`);
  let bin = Buffer.from(resources[json.buffers[0].uri]);
  delete json.buffers[0].uri;
  for (const im of json.images || []) {
    if (!im.uri || !im.uri.startsWith('textures/')) throw new Error(`image non externe: ${im.uri}`);
    im.mimeType = /\.jpe?g$/.test(im.uri) ? 'image/jpeg' : 'image/png';
  }
  const pad = (b, c) => (b.length % 4 ? Buffer.concat([b, Buffer.alloc(4 - (b.length % 4), c)]) : b);
  bin = pad(bin, 0);
  json.buffers[0].byteLength = bin.length;
  const js = pad(Buffer.from(JSON.stringify(json)), 0x20);
  const head = Buffer.alloc(12);
  head.writeUInt32LE(0x46546c67, 0);
  head.writeUInt32LE(2, 4);
  head.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
  const chunk = (b, type) => {
    const h = Buffer.alloc(8);
    h.writeUInt32LE(b.length, 0);
    h.writeUInt32LE(type, 4);
    return Buffer.concat([h, b]);
  };
  const before = fs.statSync(src).size;
  fs.writeFileSync(dst, Buffer.concat([head, chunk(js, 0x4e4f534a), chunk(bin, 0x004e4942)]));
  process.stdout.write(`${path.basename(dst)}: ${before} -> ${fs.statSync(dst).size} octets\n`);
})().catch((e) => {
  process.stderr.write(`${e.stack || e}\n`);
  process.exit(1);
});
