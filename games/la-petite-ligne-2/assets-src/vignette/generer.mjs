// Vignette provisoire de La Petite Ligne (refonte): un décor de maquette de train,
// un ruban « refonte » pour ne pas la confondre avec l'ancien jeu. Remplacée par une
// vraie illustration au jalon des assets définitifs.
//
//   node games/la-petite-ligne-2/assets-src/vignette/generer.mjs
//
// Écrit vignette.svg (à côté de ce script) puis public/vignette.png (1280 x 720, 8 bits)
// avec rsvg-convert (boîte à outils: outils/installer-outils.sh).

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ici = import.meta.dirname;
const svgFile = path.join(ici, 'vignette.svg');
const pngFile = path.join(ici, '..', '..', 'public', 'vignette.png');

// Traverses de la voie, posées à pas régulier le long de la ligne droite du premier plan.
const traverses = Array.from(
  { length: 22 },
  (_, i) =>
    `<rect x="${30 + i * 60}" y="548" width="24" height="64" rx="3" fill="#6b4a33"/>`,
).join('');

// Fenêtres du wagon, quatre par voiture.
const fenetres = (x0) =>
  [0, 1, 2, 3]
    .map((i) => `<rect x="${x0 + 20 + i * 54}" y="424" width="38" height="34" rx="5" fill="#f6e7b8"/>`)
    .join('');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    <linearGradient id="ciel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2f3f63"/>
      <stop offset="0.55" stop-color="#c58f6a"/>
      <stop offset="1" stop-color="#f0c987"/>
    </linearGradient>
  </defs>
  <rect width="1280" height="720" fill="url(#ciel)"/>
  <circle cx="1010" cy="300" r="70" fill="#f8dd9f"/>
  <path d="M0 470 Q220 360 440 440 T880 430 T1280 410 V720 H0 Z" fill="#5a7a56"/>
  <path d="M0 520 Q300 450 620 510 T1280 490 V720 H0 Z" fill="#456a49"/>
  <rect y="530" width="1280" height="100" fill="#3b4a40"/>
  ${traverses}
  <rect y="560" width="1280" height="10" fill="#c9ced3"/>
  <rect y="592" width="1280" height="10" fill="#c9ced3"/>
  <g>
    <rect x="150" y="410" width="260" height="130" rx="12" fill="#a8452f"/>
    <rect x="150" y="522" width="260" height="14" fill="#2b2b33"/>
    ${fenetres(150)}
    <circle cx="205" cy="538" r="22" fill="#2b2b33"/>
    <circle cx="355" cy="538" r="22" fill="#2b2b33"/>
    <rect x="430" y="410" width="260" height="130" rx="12" fill="#d29a3a"/>
    <rect x="430" y="522" width="260" height="14" fill="#2b2b33"/>
    ${fenetres(430)}
    <circle cx="485" cy="538" r="22" fill="#2b2b33"/>
    <circle cx="635" cy="538" r="22" fill="#2b2b33"/>
  </g>
  <rect x="0" y="0" width="1280" height="720" fill="none" stroke="#1d2540" stroke-width="12"/>
  <text x="640" y="190" font-family="serif" font-size="104" text-anchor="middle" fill="#fbf3dc">La Petite Ligne</text>
  <g transform="translate(640 262)">
    <rect x="-130" y="-34" width="260" height="62" rx="31" fill="#fbf3dc"/>
    <text y="12" font-family="sans-serif" font-size="40" letter-spacing="6" text-anchor="middle" fill="#2f3f63">REFONTE</text>
  </g>
</svg>
`;

mkdirSync(path.dirname(pngFile), { recursive: true });
writeFileSync(svgFile, svg);
execFileSync('rsvg-convert', ['-w', '1280', '-h', '720', '-o', pngFile, svgFile]);
process.stdout.write(`vignette: ${pngFile}\n`);
