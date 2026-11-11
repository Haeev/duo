/**
 * Planches de contrôle des vignettes des collections, par famille du carnet (`category` des
 * entrées de `donnees/commun/carnet/`, plus les graines et plants des fleurs): chaque vignette en
 * 192 px, puis en 96 et 44 px (case de la barre du sac, la plus petite taille d'affichage) sur la
 * case sombre du thème encré, puis en 44 px sur le papier du carnet.
 *
 *   NODE_PATH=/opt/node-tools/node_modules node assets-src/interface-encre/planche-collections.cjs \
 *     <dossier de sortie> <famille|id,id,...>
 * Familles: poissons, insectes, fleurs, graines, tresors, plats. Écrit
 * `<dossier>/vignettes-collections-<famille>.png` (ou `-essai.png` pour une liste d'ids).
 */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const [outDir, what] = process.argv.slice(2);
if (outDir === undefined || what === undefined) {
  process.stderr.write('Usage: planche-collections.cjs <dossier> <famille|id,id>\n');
  process.exit(1);
}
const pkg = path.join(__dirname, '..', '..');
const dirV = path.join(pkg, 'assets', 'commun', 'interface', 'vignettes');
const data = path.join(pkg, 'donnees', 'commun');

const CATEGORY = {
  poissons: 'poissons',
  insectes: 'insectes',
  fleurs: 'fleurs',
  tresors: 'tresors',
  fossiles: 'tresors',
  recettes: 'plats',
  plats: 'plats',
};
/** Entrées du carnet: id -> [famille, nom]. */
const entries = new Map();
for (const f of fs.readdirSync(path.join(data, 'carnet')).filter((n) => n.endsWith('.json'))) {
  const e = JSON.parse(fs.readFileSync(path.join(data, 'carnet', f), 'utf8'));
  const fam = CATEGORY[e.category];
  // Une recette montre la vignette de son plat (`source.item`), comme dans le carnet.
  const id = e.source?.type === 'item' && typeof e.source.item === 'string' ? e.source.item : e.id;
  if (fam !== undefined) entries.set(id, [fam, e.name]);
}
for (const f of fs.readdirSync(path.join(data, 'objets')).filter((n) => n.endsWith('.json'))) {
  const o = JSON.parse(fs.readFileSync(path.join(data, 'objets', f), 'utf8'));
  if (o.family === 'seed' && !o.id.endsWith('radis') && !o.id.endsWith('tomate'))
    entries.set(o.id, ['graines', o.name]);
}

const ids = what.includes(',')
  ? what.split(',')
  : [...entries].filter(([, [fam]]) => fam === what).map(([id]) => id);
ids.sort();
const label = what.includes(',') ? 'essai' : what;
const uri = (id) =>
  `data:image/svg+xml;base64,${fs.readFileSync(path.join(dirV, `${id}.svg`)).toString('base64')}`;
const has = (id) => fs.existsSync(path.join(dirV, `${id}.svg`));

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1480, height: 400 } });
  const cells = ids
    .map((id) => {
      const name = entries.get(id)?.[1] ?? id;
      if (!has(id))
        return `<figure><div class="pair"><span class="slot g miss">?</span></div><figcaption>${name}</figcaption></figure>`;
      const u = uri(id);
      return `<figure><div class="pair">
        <span class="slot g"><img src="${u}" width="192" height="192"></span>
        <span class="col"><span class="slot m"><img src="${u}" width="96" height="96"></span>
        <span class="duo"><span class="slot s"><img src="${u}" width="44" height="44"></span>
        <span class="slot s p"><img src="${u}" width="44" height="44"></span></span></span>
      </div><figcaption>${name}</figcaption></figure>`;
    })
    .join('');
  const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:20px;background:#1f1b1a;color:#efe3c8;font:600 14px system-ui,sans-serif;width:1440px}
h2{font-size:16px;margin:0 0 12px}
.grid{display:flex;flex-wrap:wrap;gap:16px 22px}
figure{margin:0;display:grid;gap:4px;justify-items:center}
.pair{display:flex;gap:8px;align-items:end}
.col{display:grid;gap:8px}
.duo{display:flex;gap:8px}
.slot{display:grid;place-items:center;background:#221d1b;outline:1.5px solid #8a7a62}
.slot.g{width:204px;height:204px}
.slot.m{width:108px;height:108px}
.slot.s{width:50px;height:50px}
.slot.p{background:#efe2c4;outline-color:#cfb98f}
.miss{color:#c5443d;font-size:40px}
figcaption{font-size:12px;color:#c9b99a}
</style><h2>Collections d'Aubrune, ${label} (${String(ids.length)}): 192, 96 et 44 px sur case sombre, 44 px sur papier</h2><div class="grid">${cells}</div>`;
  await page.setContent(html);
  await page.waitForTimeout(200);
  const out = path.join(outDir, `vignettes-collections-${label}.png`);
  await page.screenshot({ path: out, fullPage: true });
  process.stdout.write(`${out}\n`);
  await browser.close();
})();
