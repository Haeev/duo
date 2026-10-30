'use strict';
// Icônes d'application de Duo, générées depuis des SVG sources eux-mêmes calculés à partir de la marque
// (logo/marque.json, produite par generer-formes.cjs):
//   icone-app/icone-macos.svg   plaque de nuit sur la grille macOS (824 sur 1024), version détaillée
//   icone-app/icone-windows.svg plaque pleine page, version détaillée
//   icone-app/icone-moyenne.svg anneau et astres sans étoiles, traits renforcés (32 à 64 px)
//   icone-app/icone-petite.svg  disque et croissant seuls, sans anneau (16 à 24 px)
// puis les PNG par taille (rsvg-convert), duo.icns (16 à 1024 px) et duo.ico (16 à 256 px).
// Outils requis: rsvg-convert, ImageMagick (lecture des pixels pour les entrées BMP de l'ICO).
// Usage: node outils/generer-icones-app.cjs  (ou npm run icones-app)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { jetons } = require('../source/jetons.cjs');

const RACINE = path.join(__dirname, '..');
const DOSSIER = path.join(RACINE, 'icone-app');
const PNG = path.join(DOSSIER, 'png');
fs.mkdirSync(PNG, { recursive: true });
const C = jetons.couleur;
const J = jetons.joueur;
const m = JSON.parse(fs.readFileSync(path.join(RACINE, 'logo/marque.json'), 'utf8'));

// Marque placée au centre (x, y), l'anneau mesurant `diametre` unités de diamètre extérieur.
function marque(x, y, diametre) {
  const s = diametre / (2 * m.rayonExterieur);
  const tx = x - m.centre[0] * s;
  const ty = y - m.centre[1] * s;
  return `<g transform="translate(${tx.toFixed(3)} ${ty.toFixed(3)}) scale(${s.toFixed(5)})">
    <path fill="${C.texte}" d="${m.anneau}"/>
    <path fill="${J.astre}" d="${m.astre}"/>
    <path fill="${J.croissant}" d="${m.croissant}"/>
  </g>`;
}

// Plaque de nuit: aplat, lueur radiale statique, liseré intérieur qui la détache d'un fond sombre.
function plaque(x, y, cote, rayon, liseré) {
  const id = `lueur${Math.round(cote)}`;
  return `<defs><radialGradient id="${id}" cx="0.66" cy="0.28" r="0.85"><stop offset="0" stop-color="${C['fond-lueur']}"/><stop offset="0.7" stop-color="${C.fond}"/></radialGradient></defs>
  <rect x="${x}" y="${y}" width="${cote}" height="${cote}" rx="${rayon}" fill="url(#${id})"/>
  <rect x="${x + liseré / 2}" y="${y + liseré / 2}" width="${cote - liseré}" height="${cote - liseré}" rx="${rayon - liseré / 2}" fill="none" stroke="${C.trait}" stroke-width="${liseré}"/>`;
}

// quelques étoiles fixes, en proportion de la plaque
const ETOILES = [[0.2, 0.23, 0.012], [0.79, 0.17, 0.009], [0.86, 0.8, 0.012], [0.15, 0.78, 0.008], [0.62, 0.9, 0.007]];
const etoiles = (x, y, cote) => ETOILES.map(([u, v, r]) => `<circle cx="${(x + u * cote).toFixed(1)}" cy="${(y + v * cote).toFixed(1)}" r="${(r * cote).toFixed(1)}" fill="${C.texte}" fill-opacity="0.85"/>`).join('');

const svg = (taille, corps) => `<svg xmlns="http://www.w3.org/2000/svg" width="${taille}" height="${taille}" viewBox="0 0 ${taille} ${taille}">\n  ${corps}\n</svg>\n`;

// macOS: plaque de 824 sur une toile de 1024 (marges de la grille d'Apple), rayon 185
const macos = svg(1024, plaque(100, 100, 824, 185, 6) + etoiles(100, 100, 824) + marque(512, 512, 470));
// Windows: plaque presque pleine page (marge de 1/32), rayon de 22 %
const windows = svg(256, plaque(4, 4, 248, 56, 2) + etoiles(4, 4, 248) + marque(128, 128, 146));
// moyenne (32 à 64 px): pas d'étoiles, marque agrandie; l'anneau garde l'épaisseur du fût de Jost
const moyenne = svg(64, plaque(1, 1, 62, 14, 1.5) + marque(32, 32, 44));
// petite (16 à 24 px): plaque pleine, disque aqua et croissant mauve agrandis, sans anneau
// dessinée sur 16 unités, alignée sur la grille des pixels à 16 px
const petite = svg(16, `<rect x="0" y="0" width="16" height="16" rx="3.5" fill="${C.fond}"/>
  <rect x="0.5" y="0.5" width="15" height="15" rx="3" fill="none" stroke="${C.trait}" stroke-width="1"/>
  <circle cx="5.25" cy="7" r="3" fill="${J.astre}"/>
  <path fill="${J.croissant}" d="${require('./geometrie.cjs').croissant(10.6, 9.6, 3.6, 2.9, 1.6, -1.6, 3)}"/>`);

const SOURCES = { 'icone-macos': macos, 'icone-windows': windows, 'icone-moyenne': moyenne, 'icone-petite': petite };
for (const [nom, contenu] of Object.entries(SOURCES)) fs.writeFileSync(path.join(DOSSIER, `${nom}.svg`), contenu);

// quelle source pour quelle taille
const sourcePour = (plateforme, taille) => {
  if (taille <= 24) return 'icone-petite';
  if (taille <= 64) return 'icone-moyenne';
  return plateforme === 'macos' ? 'icone-macos' : 'icone-windows';
};
function rendre(plateforme, taille) {
  const src = sourcePour(plateforme, taille);
  const sortie = path.join(PNG, `${plateforme}-${taille}.png`);
  execFileSync('rsvg-convert', ['-w', String(taille), '-h', String(taille), '-o', sortie, path.join(DOSSIER, `${src}.svg`)]);
  return sortie;
}

// ---------- macOS: .icns (entrées PNG, reconnues depuis macOS 10.7) ----------
const ICNS = [['icp4', 16], ['icp5', 32], ['icp6', 64], ['ic07', 128], ['ic08', 256], ['ic09', 512], ['ic10', 1024], ['ic11', 32], ['ic12', 64], ['ic13', 256], ['ic14', 512]];
// les variantes @2x (ic11 à ic14) s'affichent à la moitié de leur taille: même dessin que la taille en points
const pointsPour = { ic11: 16, ic12: 32, ic13: 128, ic14: 256 };
const blocs = [];
for (const [type, taille] of ICNS) {
  const pts = pointsPour[type] || taille;
  const src = sourcePour('macos', pts);
  const sortie = path.join(PNG, `macos-${taille}${pointsPour[type] ? '@2x-de-' + pts : ''}.png`);
  execFileSync('rsvg-convert', ['-w', String(taille), '-h', String(taille), '-o', sortie, path.join(DOSSIER, `${src}.svg`)]);
  const donnees = fs.readFileSync(sortie);
  const tete = Buffer.alloc(8);
  tete.write(type, 0, 'ascii');
  tete.writeUInt32BE(8 + donnees.length, 4);
  blocs.push(tete, donnees);
}
const corps = Buffer.concat(blocs);
const enteteIcns = Buffer.alloc(8);
enteteIcns.write('icns', 0, 'ascii');
enteteIcns.writeUInt32BE(8 + corps.length, 4);
fs.writeFileSync(path.join(DOSSIER, 'duo.icns'), Buffer.concat([enteteIcns, corps]));

// ---------- Windows: .ico (BMP 32 bits sous 256 px, PNG à 256 px) ----------
const ICO = [16, 20, 24, 32, 40, 48, 64, 128, 256];
const images = ICO.map((taille) => {
  const fichier = rendre('windows', taille);
  if (taille === 256) return { taille, donnees: fs.readFileSync(fichier) };
  // pixels RGBA lus par ImageMagick, écrits de bas en haut en BGRA, puis masque ET (tout à 0: l'alpha fait foi)
  const rgba = execFileSync('convert', [fichier, '-depth', '8', 'rgba:-']);
  const ligne = taille * 4;
  const xor = Buffer.alloc(ligne * taille);
  for (let y = 0; y < taille; y++) {
    for (let x = 0; x < taille; x++) {
      const s = y * ligne + x * 4;
      const d = (taille - 1 - y) * ligne + x * 4;
      xor[d] = rgba[s + 2];
      xor[d + 1] = rgba[s + 1];
      xor[d + 2] = rgba[s];
      xor[d + 3] = rgba[s + 3];
    }
  }
  const ligneMasque = Math.ceil(taille / 32) * 4;
  const masque = Buffer.alloc(ligneMasque * taille);
  const bih = Buffer.alloc(40);
  bih.writeUInt32LE(40, 0);
  bih.writeInt32LE(taille, 4);
  bih.writeInt32LE(taille * 2, 8);
  bih.writeUInt16LE(1, 12);
  bih.writeUInt16LE(32, 14);
  bih.writeUInt32LE(0, 16);
  bih.writeUInt32LE(xor.length + masque.length, 20);
  return { taille, donnees: Buffer.concat([bih, xor, masque]) };
});
const repertoire = Buffer.alloc(6 + 16 * images.length);
repertoire.writeUInt16LE(0, 0);
repertoire.writeUInt16LE(1, 2);
repertoire.writeUInt16LE(images.length, 4);
let decalage = repertoire.length;
images.forEach(({ taille, donnees }, i) => {
  const o = 6 + 16 * i;
  repertoire.writeUInt8(taille >= 256 ? 0 : taille, o);
  repertoire.writeUInt8(taille >= 256 ? 0 : taille, o + 1);
  repertoire.writeUInt8(0, o + 2);
  repertoire.writeUInt8(0, o + 3);
  repertoire.writeUInt16LE(1, o + 4);
  repertoire.writeUInt16LE(32, o + 6);
  repertoire.writeUInt32LE(donnees.length, o + 8);
  repertoire.writeUInt32LE(decalage, o + 12);
  decalage += donnees.length;
});
fs.writeFileSync(path.join(DOSSIER, 'duo.ico'), Buffer.concat([repertoire, ...images.map((i) => i.donnees)]));

// PNG de 1024 et 512 pour les outils qui préfèrent une image (electron-builder accepte aussi icns et ico)
for (const t of [512, 1024]) rendre('macos', t);

// ---------- relecture des deux conteneurs ----------
function lireIcns(f) {
  const b = fs.readFileSync(f);
  if (b.toString('ascii', 0, 4) !== 'icns' || b.readUInt32BE(4) !== b.length) throw new Error('en-tête icns invalide');
  const entrees = [];
  for (let o = 8; o < b.length;) {
    const type = b.toString('ascii', o, o + 4);
    const n = b.readUInt32BE(o + 4);
    const png = b.subarray(o + 8, o + n);
    if (png.readUInt32BE(0) !== 0x89504e47) throw new Error(`${type}: pas un PNG`);
    entrees.push(`${type} ${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`);
    o += n;
  }
  return entrees;
}
function lireIco(f) {
  const b = fs.readFileSync(f);
  const n = b.readUInt16LE(4);
  const entrees = [];
  for (let i = 0; i < n; i++) {
    const o = 6 + 16 * i;
    const w = b.readUInt8(o) || 256;
    const taille = b.readUInt32LE(o + 8);
    const debut = b.readUInt32LE(o + 12);
    const estPng = b.readUInt32BE(debut) === 0x89504e47;
    if (!estPng && b.readUInt32LE(debut) !== 40) throw new Error(`entrée ${w}: ni PNG ni BMP`);
    if (debut + taille > b.length) throw new Error(`entrée ${w}: hors du fichier`);
    entrees.push(`${w}x${w} ${estPng ? 'PNG' : 'BMP'}`);
  }
  return entrees;
}
console.log('duo.icns:', lireIcns(path.join(DOSSIER, 'duo.icns')).join(', '));
console.log('duo.ico:', lireIco(path.join(DOSSIER, 'duo.ico')).join(', '));
