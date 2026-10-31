// Génère les fonds de scène des maquettes (support/scene-*.svg): une vue isométrique
// schématique du bourg et de l'intérieur de la maisonnette, aux couleurs de palette.py.
// Ce n'est pas la scène 3D du jeu: seulement un décor pour juger le HUD dessus.
// Usage, depuis la racine du dépôt: node games/la-petite-ligne/ui-maquettes/outils/generer-scenes.mjs
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ici = path.dirname(fileURLToPath(import.meta.url));
const sortie = path.join(ici, '..', 'support');

const C = {
  grass: '#93B45E',
  grassLight: '#AEC874',
  grassDark: '#6F9148',
  soilTilled: '#7C5A3C',
  soilWet: '#4E3A2A',
  path: '#CFB489',
  ballast: '#9D968B',
  rail: '#8C8E91',
  sleeper: '#765130',
  stone: '#C0B4A1',
  stoneLight: '#DAD0BE',
  stoneDark: '#9B907F',
  plasterOchre: '#DEBA80',
  plasterCream: '#EBDCBF',
  plasterShade: '#CDBB9C',
  tile: '#B86B4F',
  tileDark: '#985541',
  lauze: '#737B86',
  lauzeDark: '#5D646F',
  wood: '#A97749',
  woodDark: '#765130',
  woodNew: '#D3A66D',
  woodOld: '#908879',
  leafOak: '#6C9944',
  leafOakLight: '#8DB556',
  leafFir: '#3F6C4D',
  bark: '#6E5743',
  sprout: '#A7D569',
  leafCrop: '#6FAA47',
  water: '#6CAAB9',
  shadow: 'rgba(42,37,34,0.22)',
  straw: '#E2C47C',
  strawDark: '#C5A45F',
  iron: '#44484E',
  ink: '#2A2522',
  glassLamp: '#FFC874',
};

function iso(s, ox, oy) {
  return (x, y, z = 0) => [ox + (x - y) * 0.866 * s, oy + (x + y) * 0.5 * s - z * s * 0.95];
}

function pts(list) {
  return list.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ');
}

function quad(P, x0, y0, x1, y1, z, fill, extra = '') {
  return `<polygon points="${pts([P(x0, y0, z), P(x1, y0, z), P(x1, y1, z), P(x0, y1, z)])}" fill="${fill}" ${extra}/>`;
}

// Boîte isométrique: deux faces visibles (sud et est) et le dessus.
function box(P, x0, y0, x1, y1, z0, z1, top, south, east, extra = '') {
  const s = `<polygon points="${pts([P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)])}" fill="${south}" ${extra}/>`;
  const e = `<polygon points="${pts([P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)])}" fill="${east}" ${extra}/>`;
  return s + e + quad(P, x0, y0, x1, y1, z1, top, extra);
}

// Toit à deux pans, faîtage est-ouest.
function roof(P, x0, y0, x1, y1, z, h, light, dark) {
  const ym = (y0 + y1) / 2;
  const south = `<polygon points="${pts([P(x0, y1 + 0.3, z), P(x1 + 0.3, y1 + 0.3, z), P(x1 + 0.3, ym, z + h), P(x0, ym, z + h)])}" fill="${light}"/>`;
  const gable = `<polygon points="${pts([P(x1 + 0.3, y0 - 0.3, z), P(x1 + 0.3, y1 + 0.3, z), P(x1 + 0.3, ym, z + h)])}" fill="${dark}"/>`;
  return gable + south;
}

function tree(P, x, y, r, h, leaf, leafLight) {
  const [bx, by] = P(x, y, 0);
  const [cx, cy] = P(x, y, h);
  const rr = r * 40;
  return (
    `<ellipse cx="${bx}" cy="${by}" rx="${rr * 0.9}" ry="${rr * 0.45}" fill="${C.shadow}"/>` +
    `<rect x="${bx - 5}" y="${cy}" width="10" height="${by - cy}" fill="${C.bark}"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${rr}" fill="${leaf}"/>` +
    `<circle cx="${cx - rr * 0.3}" cy="${cy - rr * 0.3}" r="${rr * 0.55}" fill="${leafLight}"/>`
  );
}

// Personnage schématique: ombre, jambes, buste à la couleur de la tenue, foulard à la couleur du joueur.
function person(P, x, y, { top, bottom, skin, hair, scarf, scale = 1 }) {
  const [bx, by] = P(x, y, 0);
  const k = scale;
  return (
    `<g transform="translate(${bx.toFixed(1)},${by.toFixed(1)}) scale(${k})">` +
    `<ellipse cx="0" cy="0" rx="20" ry="9" fill="${C.shadow}"/>` +
    `<rect x="-10" y="-34" width="8" height="32" rx="3" fill="${bottom}"/>` +
    `<rect x="2" y="-34" width="8" height="32" rx="3" fill="${bottom}"/>` +
    `<rect x="-14" y="-72" width="28" height="42" rx="9" fill="${top}"/>` +
    `<rect x="-13" y="-74" width="26" height="9" rx="4" fill="${scarf}" stroke="${C.ink}" stroke-width="1.5"/>` +
    `<circle cx="0" cy="-88" r="15" fill="${skin}"/>` +
    `<path d="M-15 -90 a15 15 0 0 1 30 0 q-6 -6 -15 -5 q-9 -1 -15 5z" fill="${hair}"/>` +
    `</g>`
  );
}

function bourg(variante) {
  const W = 1920;
  const H = 1080;
  const P = iso(58, 960 - (14 - 12) * 0.866 * 58, 560 - (14 + 12) * 0.5 * 58);
  const pluie = variante === 'pluie';
  const soir = variante === 'soir';
  const parts = [];
  parts.push(`<rect width="${W}" height="${H}" fill="${C.grassDark}"/>`);
  parts.push(quad(P, -30, -30, 70, 70, 0, pluie ? '#86A657' : C.grass));
  // Taches d'herbe claire.
  for (const [x, y, w, h] of [
    [16, 2, 6, 4],
    [0, 22, 7, 5],
    [24, 16, 8, 6],
    [-6, 8, 5, 6],
    [30, 28, 6, 5],
  ]) {
    parts.push(quad(P, x, y, x + w, y + h, 0, C.grassLight, 'opacity="0.7"'));
  }
  // Voie: ballast, traverses, rails.
  parts.push(quad(P, -30, 0.6, 70, 3.4, 0, C.ballast));
  for (let x = -30; x < 70; x += 0.8) parts.push(quad(P, x, 0.9, x + 0.35, 3.1, 0.02, C.sleeper));
  parts.push(quad(P, -30, 1.45, 70, 1.6, 0.06, C.rail));
  parts.push(quad(P, -30, 2.4, 70, 2.55, 0.06, C.rail));
  // Chemins.
  parts.push(quad(P, 10, 12.5, 28, 14, 0, C.path));
  parts.push(quad(P, 26, 6, 28, 30, 0, C.path));
  parts.push(quad(P, 6.5, 14, 8, 16, 0, C.path));
  // Quai et halte.
  parts.push(box(P, 22, 3.6, 40, 6, 0, 0.35, C.stoneLight, C.stone, C.stoneDark));
  parts.push(box(P, 29, 6, 35, 9.5, 0, 2.6, C.plasterOchre, C.plasterOchre, C.plasterShade));
  parts.push(roof(P, 29, 6, 35, 9.5, 2.6, 1.6, C.tile, C.tileDark));
  // Cloche et banc sur le quai.
  const [cx, cy] = P(26, 4.6, 0.35);
  parts.push(
    `<rect x="${cx - 2}" y="${cy - 80}" width="4" height="80" fill="${C.iron}"/><path d="M${cx - 9} ${cy - 66} q9 -18 18 0z" fill="#C8A150" stroke="${C.ink}" stroke-width="1.5"/>`,
  );
  parts.push(box(P, 28.5, 4.4, 30.2, 4.9, 0.35, 0.75, C.woodNew, C.wood, C.woodDark));
  // Maisonnette (réparée en journée, mêmes volumes partout).
  parts.push(
    `<polygon points="${pts([P(4.6, 7.6), P(11, 7.6), P(11, 13), P(4.6, 13)])}" fill="${C.shadow}"/>`,
  );
  parts.push(box(P, 5, 8, 10.5, 12.5, 0, 2.4, C.stone, C.stone, C.stoneDark));
  parts.push(roof(P, 5, 8, 10.5, 12.5, 2.4, 1.7, soir ? '#68707B' : C.lauze, C.lauzeDark));
  const [dx, dy] = P(8, 12.5, 0);
  parts.push(
    `<polygon points="${pts([P(7.4, 12.5, 0), P(8.4, 12.5, 0), P(8.4, 12.5, 1.6), P(7.4, 12.5, 1.6)])}" fill="${C.woodDark}"/>`,
  );
  parts.push(
    `<polygon points="${pts([P(5.8, 12.5, 1), P(6.8, 12.5, 1), P(6.8, 12.5, 1.7), P(5.8, 12.5, 1.7)])}" fill="${soir ? C.glassLamp : '#5F7D8C'}"/>`,
  );
  parts.push(
    `<polygon points="${pts([P(9.2, 12.5, 1), P(10, 12.5, 1), P(10, 12.5, 1.7), P(9.2, 12.5, 1.7)])}" fill="${soir ? C.glassLamp : '#5F7D8C'}"/>`,
  );
  void dx;
  void dy;
  // Tonneau.
  parts.push(box(P, 10.7, 11.2, 11.5, 12, 0, 0.9, C.water, C.wood, C.woodDark));
  // Potager 4x3.
  for (let i = 0; i < 4; i += 1) {
    for (let j = 0; j < 3; j += 1) {
      const x = 4 + i;
      const y = 16 + j;
      const mouille = pluie || (i + j) % 3 !== 0;
      parts.push(
        quad(P, x + 0.06, y + 0.06, x + 0.94, y + 0.94, 0.03, mouille ? C.soilWet : C.soilTilled),
      );
      if (j < 2) {
        const [px, py] = P(x + 0.5, y + 0.5, 0.05);
        parts.push(
          `<ellipse cx="${px}" cy="${py - 6}" rx="${j === 0 ? 11 : 7}" ry="${j === 0 ? 8 : 5}" fill="${j === 0 ? C.leafCrop : C.sprout}"/>`,
        );
        if (j === 0) parts.push(`<circle cx="${px}" cy="${py - 1}" r="4" fill="#D44B5D"/>`);
      }
    }
  }
  // Poulailler.
  parts.push(box(P, 12.5, 16.5, 14.6, 18.5, 0, 1.1, C.woodOld, C.woodNew, C.wood));
  parts.push(roof(P, 12.5, 16.5, 14.6, 18.5, 1.1, 0.7, C.tile, C.tileDark));
  // Arbres.
  for (const [x, y, r, h, f] of [
    [1, 3.8, 1.1, 2.6, 0],
    [17, 8, 1.4, 3, 0],
    [-2, 12, 1.2, 2.8, 1],
    [20, 19, 1.5, 3.2, 0],
    [0, 21, 1.3, 3, 1],
    [18, 2.2, 0.0, 0, 2],
    [36, 14, 1.6, 3.4, 0],
    [24, 24, 1.3, 2.9, 1],
    [-6, 18, 1.4, 3, 0],
  ]) {
    if (f === 2) continue;
    parts.push(
      f === 1
        ? tree(P, x, y, r, h, C.leafFir, '#52845B')
        : tree(P, x, y, r, h, C.leafOak, C.leafOakLight),
    );
  }
  // Les deux personnages.
  parts.push(
    person(P, 8.6, 16.4, {
      top: '#5C7FA6',
      bottom: '#4A5D78',
      skin: '#E8BE9A',
      hair: '#6B4A33',
      scarf: '#5CE1E6',
    }),
  );
  parts.push(
    person(P, 15.6, 11.2, {
      top: '#B5663F',
      bottom: '#6B5541',
      skin: '#B9825C',
      hair: '#2E2622',
      scarf: '#8D6CFF',
    }),
  );
  // Odette au loin, devant l'épicerie.
  parts.push(
    person(P, 30, 15.5, {
      top: '#9C4F67',
      bottom: '#7E3F55',
      skin: '#F0C7A6',
      hair: '#8D7F78',
      scarf: '#E7B04E',
      scale: 0.9,
    }),
  );
  if (pluie) {
    parts.push(`<rect width="${W}" height="${H}" fill="#5D7488" opacity="0.28"/>`);
    let traits = '';
    for (let i = 0; i < 260; i += 1) {
      const x = (i * 137.5) % W;
      const y = (i * 71.3) % H;
      traits += `M${x.toFixed(0)} ${y.toFixed(0)}l-8 22`;
    }
    parts.push(`<path d="${traits}" stroke="#E6EEF2" stroke-width="2" opacity="0.55"/>`);
  }
  if (soir) parts.push(`<rect width="${W}" height="${H}" fill="#1F2B48" opacity="0.5"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">${parts.join('')}</svg>\n`;
}

function interieur() {
  const W = 1920;
  const H = 1080;
  const P = iso(150, 960 - (2.5 - 2) * 0.866 * 150, 560 - (2.5 + 2) * 0.5 * 150 + 40);
  const parts = [];
  parts.push(`<rect width="${W}" height="${H}" fill="#3A3530"/>`);
  // Murs coupés (nord et ouest), à mi-hauteur.
  parts.push(
    `<polygon points="${pts([P(0, 0, 0), P(5, 0, 0), P(5, 0, 1.2), P(0, 0, 1.2)])}" fill="${C.plasterCream}"/>`,
  );
  parts.push(
    `<polygon points="${pts([P(0, 0, 0), P(0, 4, 0), P(0, 4, 1.2), P(0, 0, 1.2)])}" fill="${C.plasterShade}"/>`,
  );
  parts.push(
    `<polygon points="${pts([P(0, 0, 1.2), P(5, 0, 1.2), P(5, -0.25, 1.2), P(-0.25, -0.25, 1.2), P(-0.25, 4, 1.2), P(0, 4, 1.2)])}" fill="${C.stoneDark}"/>`,
  );
  // Plancher.
  parts.push(quad(P, 0, 0, 5, 4, 0, C.woodNew));
  for (let x = 0.5; x < 5; x += 0.5)
    parts.push(
      `<line x1="${P(x, 0)[0]}" y1="${P(x, 0)[1]}" x2="${P(x, 4)[0]}" y2="${P(x, 4)[1]}" stroke="${C.wood}" stroke-width="2"/>`,
    );
  // Grille d'aménagement (cases de 50 cm).
  let grille = '';
  for (let x = 0; x <= 5; x += 0.5)
    grille += `M${P(x, 0)[0].toFixed(1)} ${P(x, 0)[1].toFixed(1)}L${P(x, 4)[0].toFixed(1)} ${P(x, 4)[1].toFixed(1)}`;
  for (let y = 0; y <= 4; y += 0.5)
    grille += `M${P(0, y)[0].toFixed(1)} ${P(0, y)[1].toFixed(1)}L${P(5, y)[0].toFixed(1)} ${P(5, y)[1].toFixed(1)}`;
  parts.push(
    `<path d="${grille}" stroke="#FBF6E9" stroke-width="2" stroke-dasharray="6 8" opacity="0.75"/>`,
  );
  // Porte (sud, à garder libre) et fenêtre.
  parts.push(quad(P, 2, 3.9, 3, 4.6, 0, 'rgba(164,70,59,0.18)'));
  parts.push(
    `<polygon points="${pts([P(1, 0, 0.6), P(2, 0, 0.6), P(2, 0, 1.2), P(1, 0, 1.2)])}" fill="#5F7D8C"/>`,
  );
  // Meubles posés: deux paillasses, coffre, réchaud, étagère.
  parts.push(box(P, 0.2, 0.3, 1.2, 2.3, 0, 0.18, C.straw, C.strawDark, C.strawDark));
  parts.push(box(P, 0.2, 2.5, 1.2, 3.8, 0, 0.18, C.straw, C.strawDark, C.strawDark));
  parts.push(box(P, 3.9, 0.2, 4.8, 0.8, 0, 0.55, C.woodNew, C.wood, C.woodDark));
  parts.push(box(P, 2.6, 0.15, 3.4, 0.75, 0, 0.8, '#6C7179', C.iron, '#2C2E31'));
  return { W, H, P, parts };
}

function amenagement(etat) {
  const { W, H, P, parts } = interieur();
  const dash = 'stroke-dasharray="10 7"';
  if (etat === 'bloque') {
    // Table fantôme sur le seuil de la porte: hachures rouges.
    parts.push(
      `<defs><pattern id="h" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="14" height="14" fill="rgba(164,70,59,0.28)"/><rect width="5" height="14" fill="rgba(164,70,59,0.6)"/></pattern></defs>`,
    );
    parts.push(
      box(
        P,
        1.9,
        3.1,
        3.4,
        4.1,
        0,
        0.75,
        'url(#h)',
        'url(#h)',
        'url(#h)',
        `stroke="#A4463B" stroke-width="3" ${dash}`,
      ),
    );
  } else {
    parts.push(
      box(
        P,
        2,
        1.6,
        3.5,
        2.6,
        0,
        0.75,
        'rgba(251,246,233,0.6)',
        'rgba(251,246,233,0.45)',
        'rgba(251,246,233,0.35)',
        `stroke="#2A2522" stroke-width="3" ${dash}`,
      ),
    );
    // Flèche de rotation autour du fantôme.
    const [ax, ay] = P(3.9, 2.2, 0);
    parts.push(
      `<path d="M${ax - 20} ${ay - 30} a34 34 0 1 1 -6 40" fill="none" stroke="#2A2522" stroke-width="5" stroke-linecap="round"/><path d="M${ax - 36} ${ay + 6} l10 16 l12 -14z" fill="#2A2522"/>`,
    );
  }
  // Chaise fantôme de Sacha, contour à sa couleur.
  parts.push(
    box(
      P,
      4,
      2.9,
      4.5,
      3.4,
      0,
      0.5,
      'rgba(141,108,255,0.25)',
      'rgba(141,108,255,0.2)',
      'rgba(141,108,255,0.15)',
      `stroke="#8D6CFF" stroke-width="4" ${dash}`,
    ),
  );
  const [camX, camY] = etat === 'bloque' ? [1.5, 2.4] : [1.7, 2.9];
  parts.push(
    person(P, camX, camY, {
      top: '#5C7FA6',
      bottom: '#4A5D78',
      skin: '#E8BE9A',
      hair: '#6B4A33',
      scarf: '#5CE1E6',
      scale: 2.2,
    }),
  );
  parts.push(
    person(P, 4.6, 3.9, {
      top: '#B5663F',
      bottom: '#6B5541',
      skin: '#B9825C',
      hair: '#2E2622',
      scarf: '#8D6CFF',
      scale: 2.2,
    }),
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">${parts.join('')}</svg>\n`;
}

function veillee() {
  const { W, H, P, parts } = interieur();
  parts.push(box(P, 2, 1.6, 3.5, 2.6, 0, 0.75, C.woodNew, C.wood, C.woodDark));
  parts.push(
    person(P, 1.7, 2.9, {
      top: '#5C7FA6',
      bottom: '#4A5D78',
      skin: '#E8BE9A',
      hair: '#6B4A33',
      scarf: '#5CE1E6',
      scale: 2.2,
    }),
  );
  parts.push(
    person(P, 3.9, 2.4, {
      top: '#B5663F',
      bottom: '#6B5541',
      skin: '#B9825C',
      hair: '#2E2622',
      scarf: '#8D6CFF',
      scale: 2.2,
    }),
  );
  parts.push(`<rect width="${W}" height="${H}" fill="#1F2B48" opacity="0.32"/>`);
  const [lx, ly] = P(2.75, 2.1, 0.75);
  parts.push(`<circle cx="${lx}" cy="${ly - 30}" r="16" fill="${C.glassLamp}"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">${parts.join('')}</svg>\n`;
}

const fichiers = {
  'scene-jour.svg': bourg('jour'),
  'scene-pluie.svg': bourg('pluie'),
  'scene-soir.svg': bourg('soir'),
  'scene-amenagement.svg': amenagement('ok'),
  'scene-amenagement-bloque.svg': amenagement('bloque'),
  'scene-veillee.svg': veillee(),
};
for (const [nom, contenu] of Object.entries(fichiers))
  writeFileSync(path.join(sortie, nom), contenu, 'utf8');
process.stdout.write(`${Object.keys(fichiers).length} scènes écrites dans support/\n`);
