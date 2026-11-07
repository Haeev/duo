// Palette de l'essai Meshy: les couleurs communes, peaux, cheveux, tenues des flâneurs et couleurs
// de la maison de la bible de Cosy Café (source unique: docs/jeux/cosy-cafe/bible/source/palette.cjs),
// rangées en cases de 4 px sur une texture de 64 x 64 (16 cases par rangée), comme La Petite Ligne.
// Ce n'est pas la palette du jeu: celle-ci reste à fixer par le directeur artistique et l'artiste 3D.
//
// Usage: node exporter-palette.mjs <palette.cjs> <sortie.json>
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const [source, output] = process.argv.slice(2);
if (!source || !output) {
  process.stderr.write("usage: node exporter-palette.mjs <palette.cjs> <sortie.json>\n");
  process.exit(2);
}
const require = createRequire(import.meta.url);
const bible = require(resolve(source));

const cells = [
  ...bible.common.map((c) => ({ id: c.id, hex: c.hex, fr: c.fr })),
  ...bible.skins.map((hex, i) => ({ id: `skin_${i + 1}`, hex, fr: `peau ${i + 1}` })),
  ...bible.hair.map((hex, i) => ({ id: `hair_${i + 1}`, hex, fr: `cheveux ${i + 1}` })),
  ...bible.profiles.flaneurs.colors.map((c) => ({ id: c.id, hex: c.hex, fr: c.fr })),
  ...bible.house.map((c) => ({ id: c.id, hex: c.hex, fr: c.fr })),
];
const ids = new Set();
for (const cell of cells) {
  if (ids.has(cell.id)) throw new Error(`case en double: ${cell.id}`);
  if (!/^#[0-9A-Fa-f]{6}$/.test(cell.hex)) throw new Error(`couleur invalide: ${cell.id} ${cell.hex}`);
  ids.add(cell.id);
}
const palette = { cell_px: 4, grid: 16, size_px: 64, source: "docs/jeux/cosy-cafe/bible/source/palette.cjs", cells };
writeFileSync(output, JSON.stringify(palette, null, 2) + "\n");
process.stdout.write(`${cells.length} cases écrites dans ${output}\n`);
