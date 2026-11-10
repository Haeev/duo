/**
 * Planche de contrôle des images « à la plume »: vignettes en 96 et 48 px (et 192 px pour juger
 * les formes), pictos en 24 et 48 px, portraits et leurs expressions, sur fond sombre (thème) et
 * sur fond clair. Rendu par Chromium, comme en jeu.
 *
 *   NODE_PATH=/opt/node-tools/node_modules node assets-src/interface-encre/planche-images.cjs \
 *     <sortie.png> [vignettes|pictos|portraits|tout] [--grand]
 */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const [out, what = 'tout', flag] = process.argv.slice(2);
if (out === undefined) {
  process.stderr.write('Usage: planche-images.cjs <sortie.png> [famille] [--grand]\n');
  process.exit(1);
}
const pkg = path.join(__dirname, '..', '..');
const dirV = path.join(pkg, 'assets', 'commun', 'interface', 'vignettes');
const dirP = path.join(pkg, 'assets', 'commun', 'interface', 'portraits');
const uri = (file) => `data:image/svg+xml;base64,${fs.readFileSync(file).toString('base64')}`;

const DARK = '#1f1b1a';
const CELL = '#2a2523';
const parts = [];
const grand = flag === '--grand';

if (what === 'tout' || what === 'vignettes') {
  const ids = fs
    .readdirSync(dirV)
    .filter((f) => f.endsWith('.svg'))
    .map((f) => f.slice(0, -4));
  const cells = ids
    .map(
      (id) => `<figure><div class="pair">
        ${grand ? `<img src="${uri(path.join(dirV, `${id}.svg`))}" width="192" height="192">` : ''}
        <span class="slot"><img src="${uri(path.join(dirV, `${id}.svg`))}" width="96" height="96"></span>
        <span class="slot s"><img src="${uri(path.join(dirV, `${id}.svg`))}" width="48" height="48"></span>
        <span class="slot s light"><img src="${uri(path.join(dirV, `${id}.svg`))}" width="48" height="48"></span>
      </div><figcaption>${id}</figcaption></figure>`,
    )
    .join('');
  parts.push(
    `<h2>Vignettes (96, 48 sur case sombre, 48 sur papier)</h2><div class="grid">${cells}</div>`,
  );
}

if (what === 'tout' || what === 'pictos') {
  const src = fs.readFileSync(path.join(pkg, 'src', 'interface', 'pictos-encre.ts'), 'utf8');
  // Tolère le fichier repassé par Prettier (clé sans guillemets, valeur à la ligne).
  const entries = [...src.matchAll(/^ {2}'?([a-z-]+)'?:\s*'([^']*)',/gm)].map((m) => [m[1], m[2]]);
  const cells = entries
    .map(
      ([id, body]) => `<figure class="pic"><div>
        <svg viewBox="0 0 24 24" width="24" height="24" style="color:#efe3c8">${body}</svg>
        <svg viewBox="0 0 24 24" width="48" height="48" style="color:#efe3c8">${body}</svg>
        <span class="acc"><svg viewBox="0 0 24 24" width="24" height="24" style="color:#1d1a17">${body}</svg></span>
      </div><figcaption>${id}</figcaption></figure>`,
    )
    .join('');
  parts.push(
    `<h2>Pictos (24 et 48 px, clair sur sombre; 24 px sur accent)</h2><div class="grid">${cells}</div>`,
  );
}

if (what === 'tout' || what === 'portraits') {
  const ids = fs
    .readdirSync(dirP)
    .filter((f) => f.endsWith('.png') && !f.startsWith('.'))
    .map((f) => f.slice(0, -4));
  const cells = ids
    .map(
      (id) =>
        `<figure><img src="data:image/png;base64,${fs.readFileSync(path.join(dirP, `${id}.png`)).toString('base64')}" width="190" height="230"><figcaption>${id}</figcaption></figure>`,
    )
    .join('');
  parts.push(`<h2>Portraits (neutre, content, soucieux)</h2><div class="grid por">${cells}</div>`);
}

const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:20px;background:${DARK};color:#efe3c8;font:600 14px system-ui,sans-serif;width:1340px}
h2{font-size:16px;margin:16px 0 8px}
.grid{display:flex;flex-wrap:wrap;gap:14px}
figure{margin:0;display:grid;gap:4px;justify-items:center}
.pair{display:flex;gap:8px;align-items:end}
.slot{display:grid;place-items:center;width:108px;height:108px;background:${CELL};outline:1.5px solid #8a7a62}
.slot.s{width:56px;height:56px}
.slot.light{background:#f6ecd2}
.pic div{display:flex;gap:8px;align-items:center;padding:6px;background:${CELL}}
.acc{background:#ffc83d;display:grid;padding:4px}
.por figure{background:#2a2523;padding:6px}
figcaption{font-size:12px;color:#c9b99a}
</style>${parts.join('')}`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1380, height: 400 } });
  await page.setContent(html);
  await page.waitForTimeout(200);
  await page.screenshot({ path: out, fullPage: true });
  await browser.close();
})();
