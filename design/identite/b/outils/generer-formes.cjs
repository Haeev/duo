'use strict';
// Génère les formes vectorielles de l'identité B depuis les sources du dossier source/:
//   symboles/<id>.svg, symboles/symboles.svg (planche de <symbol>), joueurs.json (profils et chemins),
//   icones/<id>.svg, icones/icones.svg,
//   logo/logo.svg, logo/logo-mono.svg, logo/marque.svg et logo/marque.json: lettres de Jost Light
//   converties en tracés, aucune police requise pour les afficher,
//   ciel.svg (ciel étoilé tiré à graine fixe).
// Usage: node outils/generer-formes.cjs  (ou npm run formes)
const fs = require('fs');
const path = require('path');
const fontkit = require('fontkit');
const g = require('./geometrie.cjs');
const { SYMBOLS } = require('../source/formes.cjs');
const { ICONS } = require('../source/icones.cjs');
const { tokens, players } = require('../source/jetons.cjs');

const ROOT = path.join(__dirname, '..');
const write = (rel, content) => {
  const f = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, content);
};
const C = tokens.color;
const P = tokens.player;

// ---------- symboles des joueurs ----------
const sprite = [];
const profiles = [];
players.forEach((p, i) => {
  const d = SYMBOLS[p.id]();
  write(`symboles/${p.id}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="${d}"/></svg>\n`);
  // fill sur le <symbol> lui-même: un <use> n'hérite pas des attributs de la racine du sprite
  sprite.push(`  <symbol id="player-${p.id}" viewBox="0 0 24 24" fill="currentColor"><path d="${d}"/></symbol>`);
  const symbolLabel = p.symbolName.charAt(0).toUpperCase() + p.symbolName.slice(1);
  profiles.push({
    id: p.id,
    order: i + 1,
    color: P[p.id],
    on: P.on,
    token: `--player-${p.id}`,
    colorName: p.colorName,
    symbolName: p.symbolName,
    label: `${symbolLabel} ${p.colorName}`,
    lightness: p.lightness,
    viewBox: '0 0 24 24',
    path: d,
  });
});
write('symboles/symboles.svg', `<svg xmlns="http://www.w3.org/2000/svg" style="display:none">\n${sprite.join('\n')}\n</svg>\n`);
write('joueurs.json', JSON.stringify({
  meta: {
    source: 'design/identite/b/source/jetons.cjs (couleurs, noms) et source/formes.cjs (chemins)',
    usage: 'ordre du choix de couleur; path est un chemin SVG sur une grille de 24, à remplir avec color (ou currentColor), utilisable dans un Path2D',
    halo: 'à partir de 32 px: anneau de rayon 0,47 fois la taille, trait de 3 % de la taille (1,5 px au moins), couleur du joueur à --player-halo-opacity',
  },
  players: profiles,
}, null, 2) + '\n');

// ---------- icônes d'interface ----------
const toSvg = (parts) => parts.join('').replace(/ data-fill/g, ' fill="currentColor" stroke="none"');
const iconSprite = [];
for (const [id, parts] of Object.entries(ICONS)) {
  const inner = toSvg(parts);
  write(`icones/${id}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>\n`);
  // attributs portés par chaque <symbol>: un <use> n'hérite pas de la racine du sprite. L'épaisseur, elle,
  // n'y figure pas: elle vient de l'élément qui affiche l'icône (stroke-width: var(--icon-stroke)).
  iconSprite.push(`  <symbol id="icon-${id}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${inner}</symbol>`);
}
write('icones/icones.svg', `<svg xmlns="http://www.w3.org/2000/svg" style="display:none">\n${iconSprite.join('\n')}\n</svg>\n`);

// ---------- logo ----------
// « du » en Jost Light (instance statique 300, même dessin que la police variable embarquée), puis
// l'orbite qui remplace le « o » et porte les deux astres des joueurs par défaut (aqua et mauve).
// Unités: celles de Jost (1000 par cadratin), y vers le bas.
const jost = fontkit.openSync(path.join(ROOT, 'node_modules/@fontsource/jost/files/jost-latin-300-normal.woff2'));
const run = jost.layout('du');
const glyphO = jost.glyphForCodePoint(0x6f);
const TOP = 780; // sommet du fût du d
let x = 0;
let letters = '';
run.glyphs.forEach((glyph, i) => {
  const p = glyph.path.mapPoints((px, py) => [px + x, TOP - py]);
  letters += p.toSVG().replace(/(\d+\.\d{2})\d+/g, '$1');
  x += run.positions[i].xAdvance;
});
// L'anneau prend l'épaisseur du fût du u (52 unités, mesurée à mi-hauteur d'x) et dépasse un peu
// le o (480 de haut): il porte des astres.
const STEM = 52;
const R_OUT = 262;
const RING_R = R_OUT - STEM / 2;
// bord gauche de l'anneau un peu avant celui du o (approche des lettres rondes)
const cx = x + glyphO.bbox.minX - 13 + R_OUT;
const cy = TOP - 244;
const GAP = 34; // jour entre un astre et l'anneau
const ORB = { angle: 225, r: 72 };
const CRESCENT = { angle: 45, r: 84 };
const polar = (angle, r) => [cx + r * Math.cos((angle * Math.PI) / 180), cy + r * Math.sin((angle * Math.PI) / 180)];
const ring = g.notchedRing(cx, cy, RING_R, STEM, [
  { angleDeg: ORB.angle, radius: ORB.r + GAP },
  { angleDeg: CRESCENT.angle, radius: CRESCENT.r + GAP },
], 1);
const [ax, ay] = polar(ORB.angle, RING_R);
const [bx, by] = polar(CRESCENT.angle, RING_R);
// même croissant que le symbole du joueur (rapports 9,2 / 7,4 / 4,1 de la grille de 24)
const k = CRESCENT.r / 9.2;
const orb = g.circle(ax, ay, ORB.r, 1);
const crescent = g.crescent(bx, by, CRESCENT.r, 7.4 * k, 4.1 * k, -4.1 * k, 1);

const minX = Math.min(run.glyphs[0].bbox.minX, 0);
const maxX = cx + R_OUT;
const maxY = Math.max(cy + R_OUT, by + CRESCENT.r);
const viewBox = `${minX} 0 ${(maxX - minX).toFixed(1)} ${maxY.toFixed(1)}`;
const logo = (ink, c1, c2) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-label="Duo">
  <path fill="${ink}" d="${letters}"/>
  <path fill="${ink}" d="${ring}"/>
  <path fill="${c1}" d="${orb}"/>
  <path fill="${c2}" d="${crescent}"/>
</svg>
`;
write('logo/logo.svg', logo(C.text, P.orb, P.crescent));
// une seule couleur (currentColor): filigrane, gravure, cas où la couleur est imposée
write('logo/logo-mono.svg', logo('currentColor', 'currentColor', 'currentColor'));
const half = R_OUT + 8;
write('logo/marque.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${(cx - half).toFixed(1)} ${(cy - half).toFixed(1)} ${2 * half} ${2 * half}" role="img" aria-label="Duo">
  <path fill="${C.text}" d="${ring}"/>
  <path fill="${P.orb}" d="${orb}"/>
  <path fill="${P.crescent}" d="${crescent}"/>
</svg>
`);
// géométrie de la marque, reprise par l'icône d'application
write('logo/marque.json', JSON.stringify({
  unit: 'unités de Jost (1000 par cadratin), y vers le bas',
  center: [cx, cy],
  outerRadius: R_OUT,
  halfSide: half,
  ring,
  orb,
  crescent,
  colors: { ring: C.text, orb: P.orb, crescent: P.crescent },
}, null, 2) + '\n');

// ---------- ciel étoilé ----------
// Graine fixe: le même ciel à chaque génération. Cinq étoiles marquées « scintille » au plus.
function seeded(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = seeded(20261030);
const stars = [];
for (let attempt = 0; stars.length < 120 && attempt < 20000; attempt++) {
  const s = { x: rand() * 1920, y: rand() * 1080 };
  if (stars.every((o) => Math.hypot(o.x - s.x, o.y - s.y) > 62)) stars.push(s);
}
const TWINKLE = new Set([7, 23, 41, 66, 90]);
const dots = stars.map((s, i) => {
  const r = 0.6 + rand() ** 2 * 1.1;
  const o = (0.22 + rand() * 0.5).toFixed(2);
  return `<circle${TWINKLE.has(i) ? ' class="scintille"' : ''} cx="${s.x.toFixed(1)}" cy="${s.y.toFixed(1)}" r="${r.toFixed(2)}" fill-opacity="${TWINKLE.has(i) ? '0.8' : o}"/>`;
});
write('ciel.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" fill="${C.text}" aria-hidden="true">\n${dots.join('\n')}\n</svg>\n`);

console.log(`formes générées: ${profiles.length} symboles, ${Object.keys(ICONS).length} icônes, logo (viewBox ${viewBox}), ${stars.length} étoiles`);
