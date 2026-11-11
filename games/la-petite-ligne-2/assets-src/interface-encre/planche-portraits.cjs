/**
 * Planche des portraits d'habitants: chaque portrait en expression neutre avec son nom (tous les
 * lieux), puis une ligne des cinq expressions pour quelques habitants, et une rangée en petit
 * (64 px, taille de la miniature) pour juger les silhouettes.
 *
 *   NODE_PATH=/opt/node-tools/node_modules node assets-src/interface-encre/planche-portraits.cjs \
 *     <sortie.png> [id,id,id pour les lignes d'expressions]
 */
const { readFileSync, readdirSync, existsSync } = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const pkg = path.join(__dirname, '..', '..');
const out = process.argv[2] ?? '/tmp/portraits-habitants.png';
const rows = (process.argv[3] ?? 'controleur,martial,jeanne').split(',');
const DIR = path.join(pkg, 'assets', 'commun', 'interface', 'portraits');
const EXPRS = ['neutre', 'content', 'soucieux', 'surpris', 'fache'];

// Les habitants de tous les lieux, dans l'ordre des lieux puis des noms.
const people = [];
const lieux = path.join(pkg, 'donnees', 'lieux');
for (const lieu of readdirSync(lieux).sort()) {
  const dir = path.join(lieux, lieu, 'habitants');
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir).sort()) {
    const h = JSON.parse(readFileSync(path.join(dir, f), 'utf8'));
    people.push({ id: h.id, name: h.name, lieu });
  }
}
people.push({ id: 'joueur', name: 'Joueur (essai)', lieu: 'joueurs' });

let serial = 0;
function svgOf(id, expr) {
  const file = path.join(DIR, `${id}.svg`);
  if (!existsSync(file)) return `<div class="manque">${id}: pas de portrait</div>`;
  serial += 1;
  return readFileSync(file, 'utf8')
    .trim()
    .replace(/__P__/g, `p${serial}-`)
    .replace('<svg ', `<svg data-expr="${expr}" `);
}

const css = `
body{margin:0;background:#1d1c25;color:#efe6d2;font:15px/1.2 sans-serif;padding:18px;width:1500px}
h2{font-size:18px;margin:14px 0 8px;color:#e6cf9c}
.grid{display:flex;flex-wrap:wrap;gap:10px}
.cell{width:136px;text-align:center;background:#2b2a36;border-radius:8px;padding:6px 4px}
.cell svg{width:124px;height:150px;display:block;margin:0 auto}
.cell b{display:block;font-size:13px}.cell i{font-size:11px;color:#b6a890}
.big .cell{width:180px}.big .cell svg{width:170px;height:206px}
.small svg{width:64px;height:77px}
.small{display:flex;gap:4px;flex-wrap:wrap;background:#2b2a36;padding:8px;border-radius:8px}
svg .expr{display:none}
${EXPRS.map((e) => `svg[data-expr="${e}"] .expr--${e}{display:inline}`).join('\n')}
.manque{color:#fc663f}
`;
const grid = people
  .map(
    (p) =>
      `<div class="cell">${svgOf(p.id, 'neutre')}<b>${p.name}</b><i>${p.id} (${p.lieu})</i></div>`,
  )
  .join('');
const exprRows = rows
  .map(
    (id) =>
      `<h2>${people.find((p) => p.id === id)?.name ?? id}: les cinq expressions</h2><div class="grid big">${EXPRS.map((e) => `<div class="cell">${svgOf(id, e)}<b>${e}</b></div>`).join('')}</div>`,
  )
  .join('');
const small = `<h2>En petit (64 px, miniature)</h2><div class="small">${people.map((p) => svgOf(p.id, 'neutre')).join('')}</div>`;
const html = `<!doctype html><meta charset="utf-8"><style>${css}</style><h2>Portraits des habitants, expression neutre</h2><div class="grid">${grid}</div>${exprRows}${small}`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1536, height: 800 } });
  await page.setContent(html);
  await page.screenshot({ path: out, fullPage: true });
  await browser.close();
  process.stdout.write(`${out}: ${String(people.length)} habitants\n`);
})();
