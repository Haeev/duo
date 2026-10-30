// Génère le sprite des icônes (icones.svg) et son injecteur pour les maquettes
// (support/icones.js), à partir de outils/icones-source.svg et des symboles des
// joueurs de l'identité Duo (design/identite/b/joueurs.json).
// Usage, depuis la racine du dépôt: node games/la-petite-ligne/ui-maquettes/outils/generer-icones.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ici = path.dirname(fileURLToPath(import.meta.url));
const racineMaquettes = path.join(ici, '..');
const racineDepot = path.join(racineMaquettes, '..', '..', '..');

const source = readFileSync(path.join(ici, 'icones-source.svg'), 'utf8');
const joueurs = JSON.parse(
  readFileSync(path.join(racineDepot, 'design', 'identite', 'b', 'joueurs.json'), 'utf8'),
);

const symbolesJoueurs = joueurs.players
  .map(
    (joueur) =>
      `  <symbol id="player-${joueur.id}" viewBox="${joueur.viewBox}"><path d="${joueur.path}" fill="currentColor"/></symbol>`,
  )
  .join('\n');

const sprite = source
  .replace(/<!--[\s\S]*?-->\n?/, '<!-- Fichier généré par outils/generer-icones.mjs: modifier outils/icones-source.svg. -->\n')
  .replace('</svg>', `  <!-- Symboles des profils Duo -->\n${symbolesJoueurs}\n</svg>`);

writeFileSync(path.join(racineMaquettes, 'icones.svg'), sprite, 'utf8');

const injecteur = `// Fichier généré par outils/generer-icones.mjs: ne pas modifier.
// Maquettes seulement: insère le sprite des icônes dans la page (un <use href="icones.svg#id">
// externe est refusé par Chromium en file://). Le jeu importe icones.svg avec ?raw.
(function () {
  const conteneur = document.createElement('div');
  conteneur.hidden = true;
  conteneur.setAttribute('aria-hidden', 'true');
  conteneur.innerHTML = ${JSON.stringify(sprite.replace(/<svg /, '<svg width="0" height="0" '))};
  document.body.prepend(conteneur);
})();
`;
writeFileSync(path.join(racineMaquettes, 'support', 'icones.js'), injecteur, 'utf8');

const nombre = (sprite.match(/<symbol /g) ?? []).length;
process.stdout.write(`icones.svg et support/icones.js écrits (${nombre} symboles)\n`);
