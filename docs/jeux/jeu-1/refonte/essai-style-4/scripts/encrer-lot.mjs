// Encre un lot de sources SVG avec le moteur « à la plume » de l'interface (réutilisé tel quel).
// Usage: node encrer-lot.mjs <lot.json>   (lot: [{ "id": "...", "entree": "a.svg", "sortie": "b.svg" }, ...])
// Lancé par `traits.py` et `plis.py`; une seule page Chromium pour tout le lot.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../../../../..');
const { encrer } = await import(path.join(repo, 'games/la-petite-ligne-2/assets-src/interface-encre/encrer.mjs'));
const { chromium } = createRequire(import.meta.url)('playwright');

const lot = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const browser = await chromium.launch();
const page = await browser.newPage();
for (const t of lot) {
  const svg = await encrer(page, readFileSync(t.entree, 'utf8'), { id: t.id, prefix: `${t.id}-`, digits: 2, minSeg: 0.3 });
  writeFileSync(t.sortie, `${svg}\n`);
}
await browser.close();
process.stdout.write(`ENCRE ${String(lot.length)}\n`);
