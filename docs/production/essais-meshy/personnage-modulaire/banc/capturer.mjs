// Sert le banc d'essai (Three.js du dépôt) et capture une planche par combinaison.
// Usage: node capturer.mjs <dossier three> <dossier des captures>   (depuis n'importe où)
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const [threeDir, outDir] = process.argv.slice(2).map((p) => path.resolve(p));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary' };
const server = createServer(async (req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = url.startsWith('/three/') ? path.join(threeDir, url.slice(7)) : path.join(root, url);
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 620 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const catalogue = JSON.parse(await readFile(path.join(here, 'catalogue.json'), 'utf8'));
const mesures = {};
for (const combo of [...Object.keys(catalogue.combinaisons), 'corps']) {
  await page.goto(`http://127.0.0.1:${port}/banc/index.html?planche=1&combo=${combo === 'corps' ? '' : combo}`);
  await page.waitForFunction(() => window.banc?.pret, null, { timeout: 120000 });
  mesures[combo] = await page.evaluate(() => window.banc.mesures);
  const data = await page.evaluate(() => document.querySelector('canvas').toDataURL('image/png'));
  await writeFile(path.join(outDir, `combinaison-${combo}.png`), Buffer.from(data.split(',')[1], 'base64'));
}
await writeFile(path.join(outDir, 'mesures.json'), JSON.stringify(mesures, null, 1) + '\n');
process.stdout.write(JSON.stringify({ mesures, errors }, null, 1) + '\n');
await browser.close();
server.close();
