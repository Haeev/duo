// Palette de l'essai Meshy: les couleurs communes, peaux, cheveux, tenues des flâneurs et des pressés,
// couleurs de la maison de la bible de Cosy Café (source unique: docs/jeux/cosy-cafe/bible/source/palette.cjs),
// rangées en cases de 4 px sur une texture de 64 x 64 (16 cases par rangée), comme La Petite Ligne.
// Ce n'est pas la palette du jeu: celle-ci reste à fixer par le directeur artistique et l'artiste 3D.
//
// Les cases ne bougent jamais: les modèles pointent une case par ses coordonnées de texture. Si le
// fichier de sortie existe, chaque couleur garde sa case (sa teinte suit la bible), une nouvelle
// couleur prend la première case libre en fin de liste, et une couleur retirée de la bible garde sa
// case, marquée `retired`.
//
// Usage: node exporter-palette.mjs <palette.cjs> <sortie.json>
import { createRequire } from "node:module";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const [source, output] = process.argv.slice(2);
if (!source || !output) {
  process.stderr.write("usage: node exporter-palette.mjs <palette.cjs> <sortie.json>\n");
  process.exit(2);
}
const require = createRequire(import.meta.url);
const bible = require(resolve(source));

const wanted = [
  ...bible.common.map((c) => ({ id: c.id, hex: c.hex, fr: c.fr })),
  ...bible.skins.map((hex, i) => ({ id: `skin_${i + 1}`, hex, fr: `peau ${i + 1}` })),
  ...bible.hair.map((hex, i) => ({ id: `hair_${i + 1}`, hex, fr: `cheveux ${i + 1}` })),
  ...bible.profiles.flaneurs.colors.map((c) => ({ id: c.id, hex: c.hex, fr: c.fr })),
  ...bible.profiles.presses.colors.map((c) => ({ id: c.id, hex: c.hex, fr: c.fr })),
  ...bible.house.map((c) => ({ id: c.id, hex: c.hex, fr: c.fr })),
];
const byId = new Map();
for (const cell of wanted) {
  if (byId.has(cell.id)) throw new Error(`couleur en double dans la bible: ${cell.id}`);
  if (!/^#[0-9A-Fa-f]{6}$/.test(cell.hex)) throw new Error(`couleur invalide: ${cell.id} ${cell.hex}`);
  byId.set(cell.id, cell);
}

const previous = existsSync(output) ? JSON.parse(readFileSync(output, "utf-8")).cells : [];
const changes = [];
const cells = previous.map((old) => {
  const now = byId.get(old.id);
  if (!now) {
    if (!old.retired) changes.push(`retirée de la bible, case gardée: ${old.id}`);
    return { ...old, retired: true };
  }
  if (now.hex !== old.hex) changes.push(`teinte changée: ${old.id} ${old.hex} -> ${now.hex}`);
  return now;
});
const placed = new Set(cells.map((c) => c.id));
for (const cell of wanted) {
  if (!placed.has(cell.id)) {
    cells.push(cell);
    changes.push(`nouvelle case ${cells.length - 1}: ${cell.id}`);
  }
}
if (cells.length > 256) throw new Error(`${cells.length} cases: la texture de 64 x 64 n'en tient que 256`);
const palette = { cell_px: 4, grid: 16, size_px: 64, source: "docs/jeux/cosy-cafe/bible/source/palette.cjs", cells };
writeFileSync(output, JSON.stringify(palette, null, 2) + "\n");
process.stdout.write(`${cells.length} cases écrites dans ${output}\n${changes.map((c) => `  ${c}\n`).join("")}`);
