// Validateur glTF (paquet npm gltf-validator) sur tous les GLB d'un dossier, images externes comprises.
// Usage: NODE_PATH=<dossier node_modules> node valider.cjs <dossier des GLB> [sortie.json]
const fs = require('fs');
const path = require('path');
const validator = require('gltf-validator');

const dir = process.argv[2];
const out = process.argv[3];
(async () => {
  const res = {};
  let fautes = 0;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.glb')).sort()) {
    const data = new Uint8Array(fs.readFileSync(path.join(dir, f)));
    const r = await validator.validateBytes(data, {
      uri: f,
      externalResourceFunction: (uri) => new Promise((ok, ko) => {
        try { ok(new Uint8Array(fs.readFileSync(path.join(dir, decodeURIComponent(uri))))); } catch (e) { ko(e.toString()); }
      }),
    });
    const i = r.issues;
    res[f] = { erreurs: i.numErrors, avertissements: i.numWarnings, infos: i.numInfos, messages: i.messages.filter((m) => m.severity <= 1).slice(0, 5).map((m) => `${m.code} ${m.pointer || ''}`) };
    if (i.numErrors) fautes += 1;
    process.stdout.write(`${f}: ${i.numErrors} erreur(s), ${i.numWarnings} avertissement(s)${res[f].messages.length ? ' ' + res[f].messages.join('; ') : ''}\n`);
  }
  if (out) fs.writeFileSync(out, JSON.stringify(res, null, 1));
  process.stdout.write(`${Object.keys(res).length} fichiers, ${fautes} avec erreurs\n`);
  process.exit(fautes ? 1 : 0);
})();
