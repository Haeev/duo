'use strict';
// Génère jetons.css et jetons.json depuis source/jetons.cjs, puis relit les deux fichiers produits
// et vérifie qu'ils portent exactement les mêmes noms et les mêmes valeurs (sortie en erreur sinon).
// Usage: node outils/generer-jetons.cjs  (ou npm run jetons)
const fs = require('fs');
const path = require('path');
const { tokens, variants } = require('../source/jetons.cjs');

const ROOT = path.join(__dirname, '..');
const CSS_FILE = path.join(ROOT, 'jetons.css');
const JSON_FILE = path.join(ROOT, 'jetons.json');
const VERSION = require('../package.json').version;

// objet vers liste [nom de variable, valeur, groupe]
function flatten(object, prefix = []) {
  const out = [];
  for (const [key, value] of Object.entries(object)) {
    const keyPath = [...prefix, String(key)];
    if (value !== null && typeof value === 'object') out.push(...flatten(value, keyPath));
    else {
      if (typeof value !== 'string') throw new Error(`valeur non textuelle pour ${keyPath.join('.')}`);
      if (!/^[a-z0-9-]+$/.test(keyPath.join('-'))) throw new Error(`nom invalide: ${keyPath.join('.')}`);
      out.push([`--${keyPath.join('-')}`, value, prefix.join('.')]);
    }
  }
  return out;
}

function cssBlock(selector, object) {
  const lines = [];
  let group = null;
  for (const [name, value, g] of flatten(object)) {
    if (group !== null && g !== group) lines.push('');
    group = g;
    lines.push(`  ${name}: ${value};`);
  }
  return `${selector} {\n${lines.join('\n')}\n}\n`;
}

const header = [
  '/*',
  ` * Jetons de l'identité visuelle de Duo, piste B « Étoile double », version ${VERSION}.`,
  ' * Fichier généré par design/identite/b/outils/generer-jetons.cjs depuis source/jetons.cjs:',
  ' * ne pas le modifier à la main. Mêmes noms et mêmes valeurs que jetons.json.',
  ' * Rôles et règles d\'usage: docs/plateforme/identite-visuelle.md',
  ' */',
  '',
].join('\n');

let css = header + cssBlock(':root', tokens);
for (const [name, { selector, tokens: t }] of Object.entries(variants)) {
  css += `\n/* variante « ${name} » */\n` + cssBlock(selector, t);
}
fs.writeFileSync(CSS_FILE, css);

const json = {
  meta: {
    name: 'Duo, identité visuelle, piste B « Étoile double »',
    version: VERSION,
    source: 'design/identite/b/source/jetons.cjs',
    rule: 'chaque chemin donne le nom de la variable CSS: color.surface-raised vaut --color-surface-raised',
    rem: '1rem vaut 16 px à la taille d\'interface 100 %',
  },
  tokens,
  variants,
};
fs.writeFileSync(JSON_FILE, JSON.stringify(json, null, 2) + '\n');

// Vérification croisée: relire les deux fichiers produits, sans repasser par la source.
function parseCss(text) {
  const blocks = {};
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const [, selector, body] of clean.matchAll(/([^{}]+?)\s*\{([^}]*)\}/g)) {
    const vars = {};
    for (const [, name, value] of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) vars[name] = value.trim();
    blocks[selector.trim()] = vars;
  }
  return blocks;
}
const reread = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));
const toMap = (o) => Object.fromEntries(flatten(o).map(([n, v]) => [n, v]));
const expected = { ':root': toMap(reread.tokens) };
for (const { selector, tokens: t } of Object.values(reread.variants)) expected[selector] = toMap(t);
const found = parseCss(fs.readFileSync(CSS_FILE, 'utf8'));

let gaps = 0;
for (const sel of new Set([...Object.keys(expected), ...Object.keys(found)])) {
  const a = expected[sel] || {};
  const b = found[sel] || {};
  for (const name of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (a[name] !== b[name]) {
      gaps++;
      console.error(`écart ${sel} ${name}: JSON ${a[name]} / CSS ${b[name]}`);
    }
  }
}
// une variante ne redéfinit que des jetons existants
for (const { selector, tokens: t } of Object.values(reread.variants)) {
  for (const [name] of flatten(t)) {
    if (!(name in expected[':root'])) {
      gaps++;
      console.error(`variante ${selector}: ${name} inconnu`);
    }
  }
}
const total = Object.values(expected).reduce((n, o) => n + Object.keys(o).length, 0);
if (gaps) {
  console.error(`${gaps} écart(s) entre jetons.css et jetons.json`);
  process.exit(1);
}
console.log(`jetons.css et jetons.json identiques: ${total} valeurs comparées dans ${Object.keys(expected).length} blocs, 0 écart`);
