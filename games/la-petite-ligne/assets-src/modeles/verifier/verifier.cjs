// Charge chaque GLB dans Three.js (Chromium, rendu logiciel), capture une vue et rend compte.
// Lancer depuis la racine du dépôt: node games/la-petite-ligne/assets-src/modeles/verifier/verifier.cjs
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const here = __dirname;
const game = path.resolve(here, '..', '..', '..');
const roots = {
  '/three/': path.join(game, 'node_modules', 'three'),
  '/modeles/': path.join(game, 'assets', 'modeles'),
  '/': here,
};
const types = { '.html': 'text/html', '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const prefix = Object.keys(roots).find((p) => url.startsWith(p));
  const file = path.join(roots[prefix], url.slice(prefix.length) || 'verifier.html');
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

(async () => {
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  page.on('pageerror', (e) => console.log('ERREUR PAGE', e.message));
  const files = process.argv.slice(2).length ? process.argv.slice(2) : ['personnages.glb', 'ferme.glb', 'bourg.glb', 'train.glb', 'maison.glb'];
  for (const f of files) {
    await page.goto(`http://localhost:${port}/verifier.html?f=${f}`);
    await page.waitForFunction(() => window.__report, null, { timeout: 120000 });
    const rep = await page.evaluate(() => window.__report);
    const out = path.join(here, '..', 'planches', `threejs-${f.replace('.glb', '')}.png`);
    await page.screenshot({ path: out });
    console.log(JSON.stringify({ ...rep, roots: rep.roots.length }, null, 0));
  }
  await browser.close();
  server.close();
})();
