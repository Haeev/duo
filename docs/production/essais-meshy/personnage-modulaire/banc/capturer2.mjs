// Essai 2: sert le banc (Three.js du dépôt) et capture une bande de cinq vues par personnage de essai2.json.
// Usage: node capturer2.mjs <dossier three> <dossier des captures> [identifiant ...]
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const [threeArg, outArg, ...only] = process.argv.slice(2);
const threeDir = path.resolve(threeArg);
const outDir = path.resolve(outArg);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary' };
const server = createServer(async (req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = url.startsWith('/three/') ? path.join(threeDir, url.slice(7)) : path.join(root, url);
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 2000, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const data = JSON.parse(await readFile(path.join(here, 'essai2.json'), 'utf8'));
const mesures = {};
for (const id of Object.keys(data.personnages)) {
  if (only.length && !only.includes(id)) continue;
  await page.goto(`http://127.0.0.1:${server.address().port}/banc/essai2.html?planche=1&perso=${id}`);
  await page.waitForFunction(() => window.banc?.pret, null, { timeout: 180000 });
  mesures[id] = { titre: data.personnages[id].titre, ...(await page.evaluate(() => window.banc.mesures)) };
  const png = await page.evaluate(() => document.querySelector('canvas').toDataURL('image/png'));
  await writeFile(path.join(outDir, `essai-2-${id}.png`), Buffer.from(png.split(',')[1], 'base64'));
}
await writeFile(path.join(outDir, 'essai-2-mesures.json'), JSON.stringify(mesures, null, 1) + '\n');
process.stdout.write(JSON.stringify({ mesures, errors }, null, 1) + '\n');
await browser.close();
server.close();
