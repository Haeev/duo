/**
 * Passe chaque GLB d'un dossier au validateur glTF de Khronos.
 *   NODE_PATH=<dossier où `npm install gltf-validator` a été lancé>/node_modules node valider_glb.cjs <dossier>
 * (le paquet n'est pas une dépendance du jeu: on l'installe hors du dépôt, à la demande).
 */
const fs = require('node:fs');
const path = require('node:path');
const validator = require('gltf-validator');

async function main() {
  const root = process.argv[2];
  const files = fs
    .readdirSync(root, { recursive: true })
    .filter((name) => String(name).endsWith('.glb'))
    .map((name) => path.join(root, String(name)));
  let errors = 0;
  let warnings = 0;
  for (const file of files) {
    const report = await validator.validateBytes(new Uint8Array(fs.readFileSync(file)));
    errors += report.issues.numErrors;
    warnings += report.issues.numWarnings;
    if (report.issues.numErrors + report.issues.numWarnings > 0) {
      const codes = [
        ...new Set(report.issues.messages.filter((m) => m.severity < 2).map((m) => m.code)),
      ];
      process.stdout.write(
        `${path.basename(file)}: ${report.issues.numErrors} erreur(s), ${report.issues.numWarnings} avertissement(s) ${codes.join(', ')}\n`,
      );
    }
  }
  process.stdout.write(
    `VALIDATION glTF: ${files.length} fichiers, ${errors} erreur(s), ${warnings} avertissement(s)\n`,
  );
  process.exitCode = errors > 0 ? 1 : 0;
}

main();
