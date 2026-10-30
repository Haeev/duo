'use strict';
// Icônes d'application de Duo, générées depuis des SVG sources eux-mêmes calculés à partir de la marque
// (logo/marque.json, produite par generer-formes.cjs):
//   icone-app/icone-macos.svg, icone-windows.svg: version détaillée (128 px et plus); plaque sur la grille
//     d'Apple (824 sur 1024) pour macOS, presque pleine page pour Windows
//   icone-app/icone-<plateforme>-moyenne.svg: anneau et astres sans étoiles (32 à 64 px)
//   icone-app/icone-<plateforme>-petite.svg: disque et croissant seuls, sans anneau (16 à 24 px)
// puis les PNG par taille (rsvg-convert), duo.icns (16 à 1024 px) et duo.ico (16 à 256 px), relus à la fin.
// Outils requis: rsvg-convert, ImageMagick (pixels des entrées BMP de l'ICO).
// Usage: node outils/generer-icones-app.cjs  (ou npm run icones-app)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const g = require('./geometrie.cjs');
const { tokens } = require('../source/jetons.cjs');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'icone-app');
const PNG_DIR = path.join(DIR, 'png');
fs.rmSync(PNG_DIR, { recursive: true, force: true });
fs.mkdirSync(PNG_DIR, { recursive: true });
const C = tokens.color;
const P = tokens.player;
const mark = JSON.parse(fs.readFileSync(path.join(ROOT, 'logo/marque.json'), 'utf8'));

// Marque centrée en (x, y), anneau de `diameter` unités de diamètre extérieur.
function placeMark(x, y, diameter) {
  const s = diameter / (2 * mark.outerRadius);
  const tx = x - mark.center[0] * s;
  const ty = y - mark.center[1] * s;
  return `<g transform="translate(${tx.toFixed(3)} ${ty.toFixed(3)}) scale(${s.toFixed(5)})">
    <path fill="${C.text}" d="${mark.ring}"/>
    <path fill="${P.orb}" d="${mark.orb}"/>
    <path fill="${P.crescent}" d="${mark.crescent}"/>
  </g>`;
}

// Plaque de nuit: aplat, lueur radiale statique, liseré intérieur qui la détache d'un fond sombre.
function plate(x, y, side, radius, edge) {
  const id = `lueur${Math.round(side)}`;
  return `<defs><radialGradient id="${id}" cx="0.66" cy="0.28" r="0.85"><stop offset="0" stop-color="${C['bg-glow']}"/><stop offset="0.7" stop-color="${C.bg}"/></radialGradient></defs>
  <rect x="${x}" y="${y}" width="${side}" height="${side}" rx="${radius}" fill="url(#${id})"/>
  <rect x="${x + edge / 2}" y="${y + edge / 2}" width="${side - edge}" height="${side - edge}" rx="${radius - edge / 2}" fill="none" stroke="${C.line}" stroke-width="${edge}"/>`;
}

// quelques étoiles fixes, en proportion de la plaque
const STARS = [[0.2, 0.23, 0.012], [0.79, 0.17, 0.009], [0.86, 0.8, 0.012], [0.15, 0.78, 0.008], [0.62, 0.9, 0.007]];
const stars = (x, y, side) => STARS.map(([u, v, r]) => `<circle cx="${(x + u * side).toFixed(1)}" cy="${(y + v * side).toFixed(1)}" r="${(r * side).toFixed(1)}" fill="${C.text}" fill-opacity="0.85"/>`).join('');

const svg = (size, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">\n  ${body}\n</svg>\n`;

// Dessin moyen (32 à 64 px): sans étoiles, marque agrandie. Dessin petit (16 à 24 px): disque aqua et
// croissant mauve seuls, sans anneau, calés sur la grille de 16 px.
const medium = plate(1, 1, 62, 14, 1.5) + placeMark(32, 32, 44);
const small = `<rect x="0" y="0" width="16" height="16" rx="3.5" fill="${C.bg}"/>
  <rect x="0.5" y="0.5" width="15" height="15" rx="3" fill="none" stroke="${C.line}" stroke-width="1"/>
  <circle cx="5" cy="5.9" r="2.9" fill="${P.orb}"/>
  <path fill="${P.crescent}" d="${g.crescent(10.8, 10.2, 3.7, 2.95, 1.9, -1.9, 3)}"/>`;
// macOS: la plaque garde sa marge à toutes les tailles (grille d'Apple), réduite au plus petit pour rester lisible
const inset = (size, factor, body) => `<g transform="translate(${size / 2} ${size / 2}) scale(${factor}) translate(${-size / 2} ${-size / 2})">${body}</g>`;

const SOURCES = {
  // macOS: plaque de 824 sur une toile de 1024 (marges de la grille d'Apple), rayon 185
  'icone-macos': svg(1024, plate(100, 100, 824, 185, 6) + stars(100, 100, 824) + placeMark(512, 512, 470)),
  'icone-macos-moyenne': svg(64, inset(64, 52 / 62, medium)),
  'icone-macos-petite': svg(16, inset(16, 14 / 16, small)),
  // Windows: plaque presque pleine page (marge de 1/64), rayon de 22 %
  'icone-windows': svg(256, plate(4, 4, 248, 56, 2) + stars(4, 4, 248) + placeMark(128, 128, 146)),
  'icone-windows-moyenne': svg(64, medium),
  'icone-windows-petite': svg(16, small),
};
for (const [name, content] of Object.entries(SOURCES)) fs.writeFileSync(path.join(DIR, `${name}.svg`), content);

// quelle source pour quelle taille (en points)
const sourceFor = (platform, points) => {
  if (points <= 24) return `icone-${platform}-petite`;
  if (points <= 64) return `icone-${platform}-moyenne`;
  return `icone-${platform}`;
};
function render(source, pixels, file) {
  const out = path.join(PNG_DIR, file);
  execFileSync('rsvg-convert', ['-w', String(pixels), '-h', String(pixels), '-o', out, path.join(DIR, `${source}.svg`)]);
  return out;
}

// ---------- macOS: .icns, entrées PNG (reconnues depuis macOS 10.7) ----------
// Les entrées @2x (ic11 à ic14) s'affichent à la moitié de leur définition: même dessin que leur taille en points.
const ICNS = [['icp4', 16, 16], ['icp5', 32, 32], ['icp6', 64, 64], ['ic07', 128, 128], ['ic08', 256, 256], ['ic09', 512, 512], ['ic10', 1024, 512], ['ic11', 32, 16], ['ic12', 64, 32], ['ic13', 256, 128], ['ic14', 512, 256]];
const chunks = [];
for (const [type, pixels, points] of ICNS) {
  const file = render(sourceFor('macos', points), pixels, pixels === points ? `macos-${pixels}.png` : `macos-${points}@2x.png`);
  const data = fs.readFileSync(file);
  const head = Buffer.alloc(8);
  head.write(type, 0, 'ascii');
  head.writeUInt32BE(8 + data.length, 4);
  chunks.push(head, data);
}
const body = Buffer.concat(chunks);
const icnsHead = Buffer.alloc(8);
icnsHead.write('icns', 0, 'ascii');
icnsHead.writeUInt32BE(8 + body.length, 4);
fs.writeFileSync(path.join(DIR, 'duo.icns'), Buffer.concat([icnsHead, body]));

// ---------- Windows: .ico, BMP 32 bits sous 256 px, PNG à 256 px ----------
const ICO = [16, 20, 24, 32, 40, 48, 64, 128, 256];
const images = ICO.map((size) => {
  const file = render(sourceFor('windows', size), size, `windows-${size}.png`);
  if (size === 256) return { size, data: fs.readFileSync(file) };
  // pixels RGBA lus par ImageMagick, écrits de bas en haut en BGRA, puis masque ET à zéro (l'alpha fait foi)
  const rgba = execFileSync('convert', [file, '-depth', '8', 'rgba:-']);
  const row = size * 4;
  const pixels = Buffer.alloc(row * size);
  for (let y = 0; y < size; y++) {
    for (let xx = 0; xx < size; xx++) {
      const s = y * row + xx * 4;
      const d = (size - 1 - y) * row + xx * 4;
      pixels[d] = rgba[s + 2];
      pixels[d + 1] = rgba[s + 1];
      pixels[d + 2] = rgba[s];
      pixels[d + 3] = rgba[s + 3];
    }
  }
  const mask = Buffer.alloc(Math.ceil(size / 32) * 4 * size);
  const info = Buffer.alloc(40);
  info.writeUInt32LE(40, 0);
  info.writeInt32LE(size, 4);
  info.writeInt32LE(size * 2, 8); // hauteur doublée: image puis masque
  info.writeUInt16LE(1, 12);
  info.writeUInt16LE(32, 14);
  info.writeUInt32LE(0, 16);
  info.writeUInt32LE(pixels.length + mask.length, 20);
  return { size, data: Buffer.concat([info, pixels, mask]) };
});
const dir = Buffer.alloc(6 + 16 * images.length);
dir.writeUInt16LE(0, 0);
dir.writeUInt16LE(1, 2);
dir.writeUInt16LE(images.length, 4);
let offset = dir.length;
images.forEach(({ size, data }, i) => {
  const o = 6 + 16 * i;
  dir.writeUInt8(size >= 256 ? 0 : size, o);
  dir.writeUInt8(size >= 256 ? 0 : size, o + 1);
  dir.writeUInt16LE(1, o + 4);
  dir.writeUInt16LE(32, o + 6);
  dir.writeUInt32LE(data.length, o + 8);
  dir.writeUInt32LE(offset, o + 12);
  offset += data.length;
});
fs.writeFileSync(path.join(DIR, 'duo.ico'), Buffer.concat([dir, ...images.map((im) => im.data)]));

// PNG de 1024 px pour les outils qui préfèrent une image (electron-builder accepte aussi icns et ico)
fs.copyFileSync(path.join(PNG_DIR, 'macos-512@2x.png'), path.join(DIR, 'duo-1024.png'));

// ---------- relecture des deux conteneurs ----------
function readIcns(file) {
  const b = fs.readFileSync(file);
  if (b.toString('ascii', 0, 4) !== 'icns' || b.readUInt32BE(4) !== b.length) throw new Error('en-tête icns invalide');
  const entries = [];
  for (let o = 8; o < b.length;) {
    const type = b.toString('ascii', o, o + 4);
    const n = b.readUInt32BE(o + 4);
    const png = b.subarray(o + 8, o + n);
    if (png.readUInt32BE(0) !== 0x89504e47) throw new Error(`${type}: pas un PNG`);
    entries.push(`${type} ${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`);
    o += n;
  }
  return entries;
}
function readIco(file) {
  const b = fs.readFileSync(file);
  const n = b.readUInt16LE(4);
  const entries = [];
  for (let i = 0; i < n; i++) {
    const o = 6 + 16 * i;
    const w = b.readUInt8(o) || 256;
    const length = b.readUInt32LE(o + 8);
    const start = b.readUInt32LE(o + 12);
    const isPng = b.readUInt32BE(start) === 0x89504e47;
    if (!isPng && b.readUInt32LE(start) !== 40) throw new Error(`entrée ${w}: ni PNG ni BMP`);
    if (start + length > b.length) throw new Error(`entrée ${w}: hors du fichier`);
    entries.push(`${w}x${w} ${isPng ? 'PNG' : 'BMP'}`);
  }
  return entries;
}
console.log('duo.icns:', readIcns(path.join(DIR, 'duo.icns')).join(', '));
console.log('duo.ico:', readIco(path.join(DIR, 'duo.ico')).join(', '));
