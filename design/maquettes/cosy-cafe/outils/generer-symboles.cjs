'use strict';
/*
  Génère support/symboles.js depuis les profils Duo (design/identite/b/joueurs.json):
  couleurs, noms et chemins des six symboles, pour que les maquettes n'en recopient aucun à la main.
  Usage, depuis la racine du dépôt: node design/maquettes/cosy-cafe/outils/generer-symboles.cjs
*/
const fs = require('fs');
const path = require('path');

const ICI = path.join(__dirname, '..');
const SOURCE = path.join(ICI, '..', '..', 'identite', 'b', 'joueurs.json');
const SORTIE = path.join(ICI, 'support', 'symboles.js');

const profils = JSON.parse(fs.readFileSync(SOURCE, 'utf8')).players;
const donnees = {};
for (const p of profils) {
  donnees[p.id] = { couleur: p.color, sur: p.on, nom: p.label, chemin: p.path };
}

const contenu = `'use strict';
// Fichier généré par outils/generer-symboles.cjs depuis design/identite/b/joueurs.json: ne pas modifier à la main.
window.SYMBOLES_JOUEURS = ${JSON.stringify(donnees, null, 2)};
`;
fs.mkdirSync(path.dirname(SORTIE), { recursive: true });
fs.writeFileSync(SORTIE, contenu, 'utf8');
process.stdout.write(`${Object.keys(donnees).length} profils écrits dans ${path.relative(process.cwd(), SORTIE)}\n`);
