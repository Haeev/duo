/**
 * Planches de contrôle de la série des vignettes, par famille: chaque vignette en 96 et 48 px sur
 * case sombre (taille du jeu), avec son identifiant; `--grand` ajoute un rendu 192 px pour juger
 * les formes. Familles tirées des données (`family` des objets, `placeable` des meubles).
 *
 *   NODE_PATH=/opt/node-tools/node_modules node assets-src/interface-encre/planche-serie.cjs \
 *     <dossier de sortie> [famille|id,id,...] [--grand]
 * Écrit `<dossier>/ui-encre-vignettes-serie-<famille>.png` (ou `-essai.png` pour une liste d'ids).
 */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const [outDir, what, flag] = process.argv.slice(2);
if (outDir === undefined) {
  process.stderr.write('Usage: planche-serie.cjs <dossier> [famille|id,id] [--grand]\n');
  process.exit(1);
}
const pkg = path.join(__dirname, '..', '..');
const dirV = path.join(pkg, 'assets', 'commun', 'interface', 'vignettes');
const data = path.join(pkg, 'donnees', 'commun');
const grand = flag === '--grand';

/** Famille de planche de chaque identifiant (objets puis meubles posables). */
const GROUP = {
  tool: 'outils',
  catch: 'poissons',
  crop: 'potager',
  seed: 'potager',
  food: 'cuisine',
  supply: 'provisions',
  material: 'provisions',
  bag: 'provisions',
  treasure: 'provisions',
  furniture: 'meubles',
};
const family = new Map([['lettre', 'provisions']]);
for (const f of fs.readdirSync(path.join(data, 'objets')).filter((n) => n.endsWith('.json'))) {
  const o = JSON.parse(fs.readFileSync(path.join(data, 'objets', f), 'utf8'));
  family.set(o.id, GROUP[o.family] ?? 'provisions');
}
for (const f of fs.readdirSync(path.join(data, 'meubles')).filter((n) => n.endsWith('.json'))) {
  const m = JSON.parse(fs.readFileSync(path.join(data, 'meubles', f), 'utf8'));
  if (m.placeable === true) family.set(m.id, 'meubles');
}

const drawn = new Set(
  fs
    .readdirSync(dirV)
    .filter((f) => f.endsWith('.svg'))
    .map((f) => f.slice(0, -4)),
);
const groups =
  what === undefined
    ? [...new Set(family.values())]
    : what.includes(',') || drawn.has(what)
      ? ['essai']
      : [what];
const uri = (id) =>
  `data:image/svg+xml;base64,${fs.readFileSync(path.join(dirV, `${id}.svg`)).toString('base64')}`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1380, height: 400 } });
  for (const g of groups) {
    const ids =
      g === 'essai'
        ? what.split(',')
        : [...family].filter(([, fam]) => fam === g).map(([id]) => id);
    ids.sort();
    const cells = ids
      .map((id) => {
        if (!drawn.has(id))
          return `<figure><div class="pair"><span class="slot miss">?</span></div><figcaption>${id}</figcaption></figure>`;
        return `<figure><div class="pair">
          ${grand ? `<span class="slot g"><img src="${uri(id)}" width="192" height="192"></span>` : ''}
          <span class="slot"><img src="${uri(id)}" width="96" height="96"></span>
          <span class="slot s"><img src="${uri(id)}" width="48" height="48"></span>
        </div><figcaption>${id}</figcaption></figure>`;
      })
      .join('');
    const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:20px;background:#1f1b1a;color:#efe3c8;font:600 14px system-ui,sans-serif;width:1340px}
h2{font-size:16px;margin:0 0 12px}
.grid{display:flex;flex-wrap:wrap;gap:16px 18px}
figure{margin:0;display:grid;gap:4px;justify-items:center}
.pair{display:flex;gap:8px;align-items:end}
.slot{display:grid;place-items:center;width:108px;height:108px;background:#2a2523;outline:1.5px solid #8a7a62}
.slot.g{width:204px;height:204px}
.slot.s{width:56px;height:56px}
.miss{color:#c5443d;font-size:40px}
figcaption{font-size:12px;color:#c9b99a}
</style><h2>Vignettes, série ${g} (${String(ids.length)}): 96 et 48 px sur case sombre</h2><div class="grid">${cells}</div>`;
    await page.setContent(html);
    await page.waitForTimeout(150);
    const out = path.join(outDir, `ui-encre-vignettes-serie-${g}.png`);
    await page.screenshot({ path: out, fullPage: true });
    process.stdout.write(`${out}\n`);
  }
  await browser.close();
})();
