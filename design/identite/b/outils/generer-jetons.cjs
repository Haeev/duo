'use strict';
// Génère jetons.css et jetons.json depuis source/jetons.cjs, puis relit les deux fichiers produits
// et vérifie qu'ils portent exactement les mêmes noms et les mêmes valeurs (sortie en erreur sinon).
// Usage: node outils/generer-jetons.cjs  (ou npm run jetons)
const fs = require('fs');
const path = require('path');
const { jetons, variantes } = require('../source/jetons.cjs');

const RACINE = path.join(__dirname, '..');
const CSS = path.join(RACINE, 'jetons.css');
const JSON_ = path.join(RACINE, 'jetons.json');
const VERSION = require('../package.json').version;

// chemin d'objet vers liste [nom de variable, valeur]
function aplatir(objet, prefixe = []) {
  const sortie = [];
  for (const [cle, valeur] of Object.entries(objet)) {
    const chemin = [...prefixe, String(cle)];
    if (valeur !== null && typeof valeur === 'object') sortie.push(...aplatir(valeur, chemin));
    else {
      if (typeof valeur !== 'string') throw new Error(`valeur non textuelle pour ${chemin.join('.')}`);
      if (!/^[a-z0-9-]+$/.test(chemin.join('-'))) throw new Error(`nom invalide: ${chemin.join('.')}`);
      sortie.push([`--${chemin.join('-')}`, valeur, prefixe.join('.')]);
    }
  }
  return sortie;
}

function blocCss(selecteur, objet) {
  const lignes = [];
  let groupe = null;
  for (const [nom, valeur, famille] of aplatir(objet)) {
    if (groupe !== null && famille !== groupe) lignes.push('');
    groupe = famille;
    lignes.push(`  ${nom}: ${valeur};`);
  }
  return `${selecteur} {\n${lignes.join('\n')}\n}\n`;
}

const entete = [
  '/*',
  ` * Jetons de l'identité visuelle de Duo, piste B « Étoile double », version ${VERSION}.`,
  ' * Fichier généré par design/identite/b/outils/generer-jetons.cjs depuis source/jetons.cjs:',
  ' * ne pas le modifier à la main. Mêmes noms et mêmes valeurs que jetons.json.',
  ' * Règles d\'usage: docs/plateforme/identite-visuelle.md',
  ' */',
  '',
].join('\n');

let css = entete + blocCss(':root', jetons);
for (const [nom, { selecteur, jetons: j }] of Object.entries(variantes)) {
  css += `\n/* variante « ${nom} » */\n` + blocCss(selecteur, j);
}
fs.writeFileSync(CSS, css);

const json = {
  meta: {
    nom: 'Duo, identité visuelle, piste B « Étoile double »',
    version: VERSION,
    source: 'design/identite/b/source/jetons.cjs',
    regle: 'chaque chemin donne le nom de la variable CSS: couleur.surface-haute vaut --couleur-surface-haute',
  },
  jetons,
  variantes,
};
fs.writeFileSync(JSON_, JSON.stringify(json, null, 2) + '\n');

// Vérification croisée: relire les deux fichiers produits, sans repasser par la source.
function lireCss(texte) {
  const blocs = {};
  for (const [, selecteur, corps] of texte.matchAll(/([^{}\n][^{}]*?)\s*\{([^}]*)\}/g)) {
    const sel = selecteur.replace(/\/\*[\s\S]*?\*\//g, '').trim();
    const vars = {};
    for (const [, nom, valeur] of corps.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) vars[nom] = valeur.trim();
    blocs[sel] = vars;
  }
  return blocs;
}
const relu = JSON.parse(fs.readFileSync(JSON_, 'utf8'));
const attendu = { ':root': Object.fromEntries(aplatir(relu.jetons).map(([n, v]) => [n, v])) };
for (const { selecteur, jetons: j } of Object.values(relu.variantes)) attendu[selecteur] = Object.fromEntries(aplatir(j).map(([n, v]) => [n, v]));
const lu = lireCss(fs.readFileSync(CSS, 'utf8'));

let ecarts = 0;
const selecteurs = new Set([...Object.keys(attendu), ...Object.keys(lu)]);
for (const sel of selecteurs) {
  const a = attendu[sel] || {};
  const b = lu[sel] || {};
  for (const nom of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (a[nom] !== b[nom]) {
      ecarts++;
      console.error(`écart ${sel} ${nom}: JSON ${a[nom]} / CSS ${b[nom]}`);
    }
  }
}
// une variante ne redéfinit que des jetons qui existent
for (const { selecteur, jetons: j } of Object.values(relu.variantes)) {
  for (const [nom] of aplatir(j)) if (!(nom in attendu[':root'])) { ecarts++; console.error(`variante ${selecteur}: ${nom} inconnu`); }
}
const total = Object.values(attendu).reduce((n, o) => n + Object.keys(o).length, 0);
if (ecarts) {
  console.error(`${ecarts} écart(s) entre jetons.css et jetons.json`);
  process.exit(1);
}
console.log(`jetons.css et jetons.json identiques: ${total} jetons comparés (${Object.keys(attendu).length} blocs), 0 écart`);
