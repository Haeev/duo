// Capture des témoins de la qualité visuelle dans Three.js (Chromium, rendu logiciel).
//   node games/la-petite-ligne/assets-src/modeles/verifier/temoins.cjs <sortie.png> <vues|visages|zoom1> <apres.glb> [avant.glb] [LxH]
// Three.js est lu dans games/la-petite-ligne/node_modules (ou dans l'arbre principal si on est dans un worktree:
// variable LPL_THREE).
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const [out, mode, apres, avant, taille] = process.argv.slice(2);
const here = __dirname;
const game = path.resolve(here, '..', '..', '..');
const three = process.env.LPL_THREE || path.join(game, 'node_modules', 'three');
const files = { '/apres.glb': path.resolve(apres) };
if (avant && avant.endsWith('.glb')) files['/avant.glb'] = path.resolve(avant);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let file;
  if (files[url]) file = files[url];
  else if (url.startsWith('/three/')) file = path.join(three, url.slice(7));
  else file = path.join(here, url.slice(1) || 'temoins.html');
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

(async () => {
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const [w, h] = (taille || (mode === 'zoom1' ? '1366x768' : '1800x1000')).split('x').map(Number);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on('pageerror', (e) => console.log('ERREUR PAGE', e.message));
  const b = files['/avant.glb'] ? '&b=/avant.glb' : '';
  await page.goto(`http://localhost:${port}/temoins.html?mode=${mode}&a=/apres.glb${b}&w=${w}&h=${h}`);
  await page.waitForFunction(() => window.__report, null, { timeout: 600000 });
  const rep = await page.evaluate(() => window.__report);
  await page.screenshot({ path: out });
  console.log(JSON.stringify(rep));
  await browser.close();
  server.close();
})();
