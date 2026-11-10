#!/usr/bin/env node
// Essai court des deux gabarits de publication (moins de 2 s), dans un dossier temporaire:
// - un GLB factice déposé dans un dossier inventorié apparaît dans l'index des modèles, sans autre changement;
// - les cartes publiées gardent un cadre lisible (image, cadre en pixels, fenêtre en mètres).
// Usage: node outils/tableau-de-bord/outils/essai-inventaire.mjs
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));

/** Un GLB minimal: un noeud « chaise-factice » portant un triangle de 1 m de large et 2 m de haut. */
function glbFactice() {
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 2, 0]);
  const json = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name: 'chaise-factice', mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: 'VEC3',
        min: [0, 0, 0],
        max: [1, 2, 0],
      },
    ],
    bufferViews: [{ buffer: 0, byteLength: 36 }],
    buffers: [{ byteLength: 36 }],
  };
  let texte = JSON.stringify(json);
  while (texte.length % 4) texte += ' ';
  const corps = Buffer.from(texte, 'utf8');
  const bin = Buffer.from(positions.buffer);
  const entete = Buffer.alloc(12);
  entete.writeUInt32LE(0x46546c67, 0);
  entete.writeUInt32LE(2, 4);
  entete.writeUInt32LE(12 + 8 + corps.length + 8 + bin.length, 8);
  const bloc = (type, donnees) => {
    const t = Buffer.alloc(8);
    t.writeUInt32LE(donnees.length, 0);
    t.writeUInt32LE(type, 4);
    return Buffer.concat([t, donnees]);
  };
  return Buffer.concat([entete, bloc(0x4e4f534a, corps), bloc(0x004e4942, bin)]);
}

const temporaire = mkdtempSync(path.join(os.tmpdir(), 'tdb-inventaire-'));
try {
  const lot = path.join(temporaire, 'lot');
  mkdirSync(lot);
  writeFileSync(path.join(lot, 'factice.glb'), glbFactice());
  const sources = path.join(temporaire, 'sources.json');
  writeFileSync(
    sources,
    JSON.stringify({
      budget: { totalOctets: 1e6, fichierOctets: 1e6, fichiers: 5 },
      familles: [{ id: 'meubles', titre: 'Meubles' }],
      lots: [{ id: 'essai', titre: 'Essai', mode: 'racines', famille: 'meubles', dossier: lot }],
    }),
  );
  const sortie = path.join(temporaire, 'modeles');
  execFileSync(process.execPath, [
    path.join(ICI, 'inventaire-modeles.mjs'),
    '--sources',
    sources,
    '--sortie',
    sortie,
  ]);
  const index = JSON.parse(readFileSync(path.join(sortie, 'index.json'), 'utf8'));
  assert.equal(index.modeles.length, 1);
  const m = index.modeles[0];
  assert.equal(m.id, 'essai-chaise-factice');
  assert.equal(m.nom, 'Chaise factice');
  assert.equal(m.famille, 'meubles');
  assert.equal(m.triangles, 1);
  assert.deepEqual(m.cotes, { largeur: 1, hauteur: 2, profondeur: 0 });
  assert.ok(readFileSync(path.join(sortie, m.fichier)).length > 0);

  const cartes = JSON.parse(readFileSync(path.join(ICI, '..', 'cartes', 'index.json'), 'utf8'));
  assert.ok(cartes.cartes.length > 0);
  for (const c of cartes.cartes) {
    assert.ok(c.cadre.largeur > 0 && c.vue.largeur > 0 && c.image.largeur >= c.cadre.largeur, c.id);
    // Même échelle en x et en y: sinon les mètres lus sur le plan seraient faux dans un sens.
    assert.ok(
      Math.abs(c.cadre.largeur / c.vue.largeur - c.cadre.hauteur / c.vue.hauteur) < 0.01,
      c.id,
    );
    assert.ok(
      cartes.lieux.some((l) => l.id === c.lieu),
      c.id,
    );
  }
  process.stdout.write(
    `essai réussi: modèle factice inventorié, ${cartes.cartes.length} cartes au cadre cohérent\n`,
  );
} finally {
  rmSync(temporaire, { recursive: true, force: true });
}
