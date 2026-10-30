'use strict';
// Génère les formes vectorielles de l'identité B depuis les sources du dossier source/:
//   symboles/<id>.svg, symboles/symboles.svg (planche de <symbol>), joueurs.json (profils et chemins),
//   icones/<id>.svg, icones/icones.svg,
//   logo/logo.svg et logo/marque.svg (lettres de Jost Light converties en tracés: aucune police requise),
//   ciel.svg (ciel étoilé tiré à graine fixe).
// Usage: node outils/generer-formes.cjs  (ou npm run formes)
const fs = require('fs');
const path = require('path');
const fontkit = require('fontkit');
const g = require('./geometrie.cjs');
const { SYMBOLES } = require('../source/formes.cjs');
const { ICONES } = require('../source/icones.cjs');
const { jetons, joueurs } = require('../source/jetons.cjs');

const RACINE = path.join(__dirname, '..');
const ecrire = (rel, contenu) => {
  const f = path.join(RACINE, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, contenu);
};
const C = jetons.couleur;
const J = jetons.joueur;

// ---------- symboles des joueurs ----------
const sprite = [];
const profils = [];
joueurs.forEach((j, i) => {
  const d = SYMBOLES[j.symbole]();
  ecrire(`symboles/${j.symbole}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="${d}"/></svg>\n`);
  sprite.push(`  <symbol id="symbole-${j.symbole}" viewBox="0 0 24 24"><path d="${d}"/></symbol>`);
  const nomMaj = j.nomSymbole.charAt(0).toUpperCase() + j.nomSymbole.slice(1);
  profils.push({
    id: j.id,
    ordre: i + 1,
    couleur: J[j.id],
    sur: J.sur,
    jeton: `--joueur-${j.id}`,
    nomCouleur: j.nomCouleur,
    nomSymbole: j.nomSymbole,
    libelle: `${nomMaj} ${j.nomCouleur}`,
    clarte: j.clarte,
    viewBox: '0 0 24 24',
    chemin: d,
  });
});
ecrire('symboles/symboles.svg', `<svg xmlns="http://www.w3.org/2000/svg" style="display:none" fill="currentColor">\n${sprite.join('\n')}\n</svg>\n`);
ecrire('joueurs.json', JSON.stringify({
  meta: {
    source: 'design/identite/b/source/jetons.cjs et source/formes.cjs',
    usage: 'ordre du choix de couleur; chemin SVG sur une grille de 24, à remplir avec la couleur du joueur (ou currentColor); utilisable dans un Path2D',
    halo: 'au-delà de 32 px: anneau de rayon 0,47 x taille, trait de 3 % de la taille (1,5 px au moins), couleur du joueur à --joueur-halo-opacite',
  },
  joueurs: profils,
}, null, 2) + '\n');

// ---------- icônes d'interface ----------
const enSvg = (morceaux) => morceaux.join('').replace(/ data-plein/g, ' fill="currentColor" stroke="none"');
const spriteIcones = [];
for (const [id, morceaux] of Object.entries(ICONES)) {
  const interieur = enSvg(morceaux);
  ecrire(`icones/${id}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${interieur}</svg>\n`);
  spriteIcones.push(`  <symbol id="icone-${id}" viewBox="0 0 24 24">${interieur}</symbol>`);
}
ecrire('icones/icones.svg', `<svg xmlns="http://www.w3.org/2000/svg" style="display:none" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">\n${spriteIcones.join('\n')}\n</svg>\n`);

// ---------- logo ----------
// « du » en Jost Light (instance statique 300 du même dessin que la police variable embarquée),
// puis l'orbite qui remplace le « o » et porte les deux astres des joueurs par défaut.
const jost = fontkit.openSync(path.join(RACINE, 'node_modules/@fontsource/jost/files/jost-latin-300-normal.woff2'));
const run = jost.layout('du');
const glyphO = jost.glyphForCodePoint(0x6f);
const HAUT = 780; // sommet du fût du d, en unités de la police (1000 par cadratin)
let x = 0;
let lettres = '';
run.glyphs.forEach((gl, i) => {
  const p = gl.path.mapPoints((px, py) => [px + x, HAUT - py]);
  lettres += p.toSVG().replace(/(\d+\.\d{2})\d+/g, '$1');
  x += run.positions[i].xAdvance;
});
// fût du u mesuré à mi-hauteur d'x: l'anneau prend la même épaisseur
const FUT = 52;
const R_EXT = 262; // un peu plus grand que le o (480 de haut): il porte des astres
const ANNEAU = { r: R_EXT - FUT / 2, e: FUT };
// bord gauche de l'anneau un peu avant celui du o (approche des lettres rondes), puisqu'il est plus grand
const cx = x + glyphO.bbox.minX - 13 + R_EXT;
const cy = HAUT - 244;
const JOUR = 34; // espace entre un astre et l'anneau
const ASTRE = { angle: 225, r: 72 };
const CROISSANT = { angle: 45, r: 84 };
const pol = (angle, r) => [cx + r * Math.cos((angle * Math.PI) / 180), cy + r * Math.sin((angle * Math.PI) / 180)];
const anneau = g.anneauEncoche(cx, cy, ANNEAU.r, ANNEAU.e, [
  { angleDeg: ASTRE.angle, rEncoche: ASTRE.r + JOUR },
  { angleDeg: CROISSANT.angle, rEncoche: CROISSANT.r + JOUR },
], 1);
const [ax, ay] = pol(ASTRE.angle, ANNEAU.r);
const [bx, by] = pol(CROISSANT.angle, ANNEAU.r);
// même croissant que le symbole du joueur (rapports 9,2 / 7,4 / 4,1 de la grille de 24)
const k = CROISSANT.r / 9.2;
const astre = g.cercle(ax, ay, ASTRE.r, 1);
const croissant = g.croissant(bx, by, CROISSANT.r, 7.4 * k, 4.1 * k, -4.1 * k, 1);

const minX = Math.min(run.glyphs[0].bbox.minX, 0);
const maxX = cx + R_EXT;
const maxY = Math.max(cy + R_EXT, by + CROISSANT.r);
const vb = `${minX} 0 ${(maxX - minX).toFixed(1)} ${maxY.toFixed(1)}`;
const logo = (texte, a1, a2) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" role="img" aria-label="Duo">
  <path fill="${texte}" d="${lettres}"/>
  <path fill="${texte}" d="${anneau}"/>
  <path fill="${a1}" d="${astre}"/>
  <path fill="${a2}" d="${croissant}"/>
</svg>
`;
ecrire('logo/logo.svg', logo(C.texte, J.astre, J.croissant));
// version d'une seule couleur (currentColor): gravure, filigrane, cas où la couleur est imposée
ecrire('logo/logo-mono.svg', logo('currentColor', 'currentColor', 'currentColor'));
const demi = R_EXT + 8;
const marque = (fondCarre) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${(cx - demi).toFixed(1)} ${(cy - demi).toFixed(1)} ${2 * demi} ${2 * demi}" role="img" aria-label="Duo">${fondCarre || ''}
  <path fill="${C.texte}" d="${anneau}"/>
  <path fill="${J.astre}" d="${astre}"/>
  <path fill="${J.croissant}" d="${croissant}"/>
</svg>
`;
ecrire('logo/marque.svg', marque());
// géométrie de la marque, reprise par l'icône d'application
ecrire('logo/marque.json', JSON.stringify({ unite: 'unités de Jost (1000 par cadratin)', centre: [cx, cy], rayonExterieur: R_EXT, demiCote: demi, anneau, astre, croissant, couleurs: { anneau: C.texte, astre: J.astre, croissant: J.croissant } }, null, 2) + '\n');

// ---------- ciel étoilé ----------
// Graine fixe: le même ciel à chaque génération. Cinq étoiles marquées « scintille » au plus.
function graine(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const alea = graine(20261030);
const etoiles = [];
for (let essai = 0; etoiles.length < 120 && essai < 20000; essai++) {
  const e = { x: alea() * 1920, y: alea() * 1080 };
  if (etoiles.every((o) => Math.hypot(o.x - e.x, o.y - e.y) > 62)) etoiles.push(e);
}
const SCINTILLE = new Set([7, 23, 41, 66, 90]);
const cercles = etoiles.map((e, i) => {
  const r = 0.6 + alea() ** 2 * 1.1;
  const o = (0.22 + alea() * 0.5).toFixed(2);
  return `<circle${SCINTILLE.has(i) ? ' class="scintille"' : ''} cx="${e.x.toFixed(1)}" cy="${e.y.toFixed(1)}" r="${r.toFixed(2)}" fill-opacity="${SCINTILLE.has(i) ? '0.8' : o}"/>`;
});
ecrire('ciel.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" fill="${C.texte}" aria-hidden="true">\n${cercles.join('\n')}\n</svg>\n`);

console.log(`formes générées: ${profils.length} symboles, ${Object.keys(ICONES).length} icônes, logo ${vb}, ${etoiles.length} étoiles`);
