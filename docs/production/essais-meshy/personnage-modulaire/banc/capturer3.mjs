// Essai 3: sert le dépôt (banc, GLB et données du paquet la-petite-ligne-2, Three.js du dépôt) et capture une planche.
// Usage: node capturer3.mjs <dossier three> <sortie.png> <largeur> <hauteur> "<paramètres d'adresse>" [mesures.json]
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../../../..');
const [threeArg, out, width, height, query, measures] = process.argv.slice(2);
const threeDir = path.resolve(threeArg);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary' };
const server = createServer(async (req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const target = url.startsWith('/three/') ? path.join(threeDir, url.slice(7)) : path.join(repo, url);
  try {
    const body = await readFile(target);
    res.writeHead(200, { 'content-type': types[path.extname(target)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(width), height: Number(height) } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`http://127.0.0.1:${server.address().port}/docs/production/essais-meshy/personnage-modulaire/banc/essai3.html?${query}`);
try {
  await page.waitForFunction(() => window.banc?.pret, null, { timeout: 180000 });
  const png = await page.evaluate(() => document.querySelector('canvas').toDataURL('image/png'));
  await writeFile(path.resolve(out), Buffer.from(png.split(',')[1], 'base64'));
  const data = await page.evaluate(() => window.banc.mesures);
  if (measures) await writeFile(path.resolve(measures), JSON.stringify(data, null, 1) + '\n');
  process.stdout.write(JSON.stringify({ mesures: data, errors }) + '\n');
} catch (error) {
  process.stdout.write(JSON.stringify({ echec: String(error), errors }) + '\n');
}
await browser.close();
server.close();
