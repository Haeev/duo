// Validateur glTF (paquet npm gltf-validator) sur les GLB livrés: erreurs, avertissements, infos.
//   node games/la-petite-ligne/assets-src/modeles/verifier/valider_glb.cjs [bourg personnages ...]
const fs = require('fs');
const path = require('path');
const validator = require('gltf-validator');

const dossier = path.join(__dirname, '..', '..', '..', 'assets', 'modeles');
const noms = process.argv.slice(2).length ? process.argv.slice(2) : ['bourg', 'ferme', 'maison', 'personnages', 'train', 'faune', 'poissons', 'elevage', 'marche', 'village013'];

(async () => {
  let erreurs = 0;
  for (const nom of noms) {
    const octets = new Uint8Array(fs.readFileSync(path.join(dossier, `${nom}.glb`)));
    const r = await validator.validateBytes(octets, { maxIssues: 50 });
    const n = r.issues;
    erreurs += n.numErrors;
    const codes = {};
    for (const m of n.messages) codes[m.code] = (codes[m.code] || 0) + 1;
    process.stdout.write(`${nom}.glb: ${n.numErrors} erreurs, ${n.numWarnings} avertissements, ${n.numInfos} infos ${JSON.stringify(codes)}\n`);
  }
  process.exit(erreurs ? 1 : 0);
})();
