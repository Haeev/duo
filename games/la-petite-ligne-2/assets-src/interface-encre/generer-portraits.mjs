/**
 * Écrit les sources des portraits composés (`portraits/<id>.svg`) depuis leurs fiches
 * (`portraits/fiches.json`): même grille (190 x 230), même trait et même nuancier que les portraits
 * dessinés à la main (Odette, Firmin), cinq calques d'expression. On modifie la fiche ou ce script,
 * jamais les SVG écrits (ils portent la mention « généré »). Ensuite, `generer-images.mjs portraits`
 * les encre comme les autres.
 *
 *   node assets-src/interface-encre/generer-portraits.mjs [id[,id...]]
 *
 * Champs d'une fiche (valeurs: voir les tables ci-dessous; `_gabarit` dans fiches.json):
 * - `note`: âge, métier, ce que montre le portrait et pourquoi (repris en tête du SVG);
 * - `comme`: id d'une autre fiche dont on reprend tout (même personne sous deux ids);
 * - `tete` (rond, carre, long, enfant), `corpulence` (mince, moyenne, ronde, enfant),
 *   `age` (adulte, mur, age), `peau` (0 à 7, indice du catalogue de personnages);
 * - `cheveux`: { `coupe` (court, raie, chignon, chignon-bas, carre, aucun), `couleur` };
 *   `sourcils`: { `couleur`, `epais` }; `iris`; `nez` (rond, pointu, fort);
 * - `haut`: { `type` (pull, col-roule, tee, debardeur, robe), `couleur`, `col` (robe: couleur du
 *   col claudine) }; `gilet`: couleur ou null; `bonnet`: { `couleur`, `bas` (cache les yeux) };
 * - `bouche`: humeur de repos (sourire, coin, plat); `yeux`: ouverts, mi-clos (endormi), caches;
 *   `content`: rire ou clin (clin d'oeil); `pilosite`: moustache, barbe, trois-jours;
 *   `lunettes`: rondes; `joues`: rougeur au repos; `accessoires`: noms de `PROPS` (le métier).
 * Couleurs: noms du nuancier 0.2 (`nuancier-v02.json`), tissus et cheveux du catalogue.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const nuancier = JSON.parse(readFileSync(path.join(here, 'nuancier-v02.json'), 'utf8'));
const fiches = JSON.parse(readFileSync(path.join(here, 'portraits', 'fiches.json'), 'utf8'));
const onlyIds = process.argv[2]?.split(',');

// Couleurs nommées: tissus, cheveux, peaux, iris, fixes (les noms des tissus l'emportent).
const NAMED = new Map();
for (const fam of ['fixes', 'iris', 'peaux', 'cheveux', 'tissus'])
  for (const [n, c] of nuancier[fam]) NAMED.set(`${fam}:${n}`, c);
const col = (fam, name) => {
  const c = NAMED.get(`${fam}:${name}`);
  if (c === undefined) throw new Error(`couleur inconnue: ${fam}:${name}`);
  return c;
};
const INK = '#000';
const WHITE = col('fixes', 'blanc_oeil');
const LIP = col('fixes', 'bouche');
const CHEEK = col('fixes', 'joue');
const BRASS = col('fixes', 'laiton');
const STEEL = col('fixes', 'acier');
const LEATHER = col('fixes', 'cuir');
const LEATHER_DARK = col('fixes', 'cuir_sombre');
/** Lèvres des peaux sombres (bible 0.2, section 2.4). */
const LIP_DARK = '#D9A08F';

/** Peau: base, ombre (le ton suivant de la rampe; l'ébène s'ombre d'acajou foncé). */
const SKINS = nuancier.peaux.map(([, c]) => c);
const skinShadow = (i) => SKINS[i + 1] ?? '#3A3331';
/** Ombre d'un tissu ou d'une chevelure: un ton plus sombre du nuancier, même famille de teinte. */
const SHADE = {
  '#F3EDE0': '#D9CAAE',
  '#D9CAAE': '#B8A17E',
  '#B8A17E': '#96704C',
  '#D4A33E': '#C0803A',
  '#C0803A': '#A85837',
  '#A85837': '#8F3B34',
  '#8F3B34': '#5E4233',
  '#C5443D': '#8F3B34',
  '#CC9C96': '#9A7066',
  '#7E3F55': '#45324F',
  '#A58BB8': '#7E3F55',
  '#A9C7D9': '#587F8E',
  '#587F8E': '#44618A',
  '#44618A': '#2C3B57',
  '#2C3B57': '#26282E',
  '#2F6E73': '#3F6453',
  '#96A98C': '#6B7556',
  '#3F6453': '#25392F',
  '#7A7B45': '#55553E',
  '#96704C': '#5E4233',
  '#5E4233': '#4F3626',
  '#B9B7B0': '#8C8E91',
  '#4A4D52': '#26282E',
  '#26282E': '#141826',
  // Cheveux
  '#2B2523': '#231A17',
  '#4A3327': '#2B2523',
  '#6E4B33': '#4A3327',
  '#8C4A2E': '#6E4B33',
  '#AE5F2E': '#8C4A2E',
  '#C99A55': '#8C6F4E',
  '#E2C582': '#C99A55',
  '#9A948C': '#6A6763',
  '#E9E5DC': '#9A948C',
  '#6A6763': '#2B2523',
};
/** Reflet d'une chevelure: un ton plus clair. */
const SHINE = {
  '#2B2523': '#4A3327',
  '#4A3327': '#6E4B33',
  '#6E4B33': '#8C4A2E',
  '#8C4A2E': '#AE5F2E',
  '#AE5F2E': '#C99A55',
  '#C99A55': '#E2C582',
  '#E2C582': '#F3EDE0',
  '#9A948C': '#B9B7B0',
  '#E9E5DC': '#F3EDE0',
  '#6A6763': '#9A948C',
};
const shade = (c) => {
  const s = SHADE[c];
  if (s === undefined) throw new Error(`pas d'ombre pour ${c}`);
  return s;
};
const tissu = (n) => col('tissus', n);
const poil = (n) => col('cheveux', n);

const C = 95;

/** Géométrie de la tête: contour, oreilles, yeux, bouche. */
const HEADS = {
  rond: {
    d: 'M95 46 Q146 48 148 98 Q146 148 95 152 Q44 148 42 98 Q44 48 95 46 Z',
    shadow: 'M126 46 Q162 104 104 158 L170 158 L170 46 Z',
    L: 42,
    R: 148,
    T: 46,
    chin: 152,
    ears: [42, 148, 104],
    eL: 72,
    eR: 118,
    ey: 100,
    my: 134,
    s: 1,
  },
  carre: {
    d: 'M95 46 Q140 46 146 80 L146 112 Q144 144 114 152 L76 152 Q46 144 44 112 L44 80 Q50 46 95 46 Z',
    shadow: 'M128 46 Q158 96 116 160 L170 160 L170 46 Z',
    L: 44,
    R: 146,
    T: 46,
    chin: 152,
    ears: [44, 146, 104],
    eL: 72,
    eR: 118,
    ey: 100,
    my: 134,
    s: 1,
  },
  long: {
    d: 'M95 42 Q137 44 139 94 Q138 134 116 154 Q95 166 74 154 Q52 134 51 94 Q53 44 95 42 Z',
    shadow: 'M124 44 Q152 110 100 168 L170 168 L170 44 Z',
    L: 51,
    R: 139,
    T: 42,
    chin: 160,
    ears: [51, 139, 104],
    eL: 75,
    eR: 115,
    ey: 100,
    my: 140,
    s: 0.95,
  },
  enfant: {
    d: 'M95 58 Q146 60 148 108 Q146 154 95 158 Q44 154 42 108 Q44 60 95 58 Z',
    shadow: 'M126 58 Q160 112 102 164 L170 164 L170 58 Z',
    L: 42,
    R: 148,
    T: 58,
    chin: 158,
    ears: [43, 147, 114],
    eL: 73,
    eR: 117,
    ey: 112,
    my: 142,
    s: 1.12,
  },
};
/** Épaules (x gauche, x droite), haut du buste, demi-largeur du cou. */
const BUILDS = {
  mince: { x0: 14, x1: 176, ty: 162, nw: 15 },
  moyenne: { x0: 8, x1: 182, ty: 162, nw: 17 },
  ronde: { x0: 2, x1: 188, ty: 160, nw: 19 },
  enfant: { x0: 26, x1: 164, ty: 168, nw: 13 },
};

const n = (v) => String(Math.round(v * 10) / 10);
/** Petit langage de chemin: `P\`M${x} ${y}\`` arrondit au dixième. */
const P = (strings, ...vals) =>
  strings.reduce((acc, s, i) => acc + s + (i < vals.length ? n(vals[i]) : ''), '');

/* ------------------------------------------------------------------------------------------ */
/* Visage: yeux, sourcils, bouches, par expression                                             */
/* ------------------------------------------------------------------------------------------ */

/** Oeil ouvert: blanc, iris (découpé par le blanc), reflet au même endroit pour tous. */
function eye(id, e, ey, s, iris, { rx = 8.5, ry = 7, r = 4.4, dx = 0, dy = 1 } = {}) {
  const inward = e < C ? 1 : -1;
  return [
    `<ellipse id="${id}" cx="${n(e)}" cy="${n(ey)}" rx="${n(rx * s)}" ry="${n(ry * s)}" fill="${WHITE}" data-w="0.5"/>`,
    `<g data-w="0" data-clip="${id}"><circle cx="${n(e + (dx + 0.6 * inward) * s)}" cy="${n(ey + dy * s)}" r="${n(r * s)}" fill="${iris}"/>` +
      `<circle cx="${n(e + (dx + 0.6 * inward - 1.6) * s)}" cy="${n(ey + (dy - 1.8) * s)}" r="${n(1.5 * s)}" fill="${WHITE}"/></g>`,
  ].join('\n    ');
}
/** Oeil fermé de joie: un arc. */
const eyeClosed = (e, ey, s) =>
  P`M${e - 9 * s} ${ey + 3 * s} Q${e} ${ey - 6 * s} ${e + 9 * s} ${ey + 3 * s}`;
/** Oeil mi-clos (endormi): paupière lourde, demi-blanc. */
function eyeSleepy(id, e, ey, s, iris) {
  const w = 9 * s;
  return [
    `<path id="${id}" d="${P`M${e - w} ${ey} Q${e} ${ey - 2.5 * s} ${e + w} ${ey} Q${e + 6 * s} ${ey + 6.5 * s} ${e} ${ey + 6.5 * s} Q${e - 6 * s} ${ey + 6.5 * s} ${e - w} ${ey} Z`}" fill="${WHITE}" data-w="0.5"/>`,
    `<g data-w="0" data-clip="${id}"><circle cx="${n(e)}" cy="${n(ey + 3 * s)}" r="${n(4.2 * s)}" fill="${iris}"/></g>`,
    `<path data-w="0.9" fill="none" stroke="${INK}" d="${P`M${e - w - 1} ${ey + 0.5} Q${e} ${ey - 3.5 * s} ${e + w + 1} ${ey}`}"/>`,
  ].join('\n    ');
}
/** Oeil plissé de colère: paupière haute en biais, plus basse côté nez. */
function eyeAngry(id, e, ey, s, iris) {
  const i = e < C ? 1 : -1;
  const w = 9 * s;
  const a = e - i * w;
  const b = e + i * w;
  return [
    `<path id="${id}" d="${P`M${a} ${ey - 2 * s} L${b} ${ey + 1.5 * s} Q${e + i * 4 * s} ${ey + 7 * s} ${e} ${ey + 6.5 * s} Q${e - i * 6 * s} ${ey + 6.5 * s} ${a} ${ey - 2 * s} Z`}" fill="${WHITE}" data-w="0.5"/>`,
    `<g data-w="0" data-clip="${id}"><circle cx="${n(e + i * 1.2 * s)}" cy="${n(ey + 3 * s)}" r="${n(4.2 * s)}" fill="${iris}"/></g>`,
    `<path data-w="0.9" fill="none" stroke="${INK}" d="${P`M${a - i} ${ey - 2.5 * s} L${b + i} ${ey + 1.5 * s}`}"/>`,
  ].join('\n    ');
}

/**
 * Sourcil en aplat effilé. `lift` hausse le tout, `inner` hausse le bout côté nez (souci: positif;
 * colère: négatif), `arch` bombe le milieu (surprise).
 */
function brow(e, ey, s, color, thick, { lift = 0, inner = 0, arch = 0 } = {}) {
  const i = e < C ? 1 : -1;
  const y = ey - 14 * s - lift;
  const t = (thick ? 6.5 : 4.5) * s;
  const out = { x: e - i * 13 * s, y: y + 3 * s };
  const inn = { x: e + i * 12 * s, y: y + 1 * s - inner };
  const mid = { x: e, y: y - 6 * s - arch };
  return `<path d="${P`M${out.x} ${out.y} Q${mid.x} ${mid.y} ${inn.x} ${inn.y} Q${mid.x} ${mid.y + t + 1} ${out.x + i * 2} ${out.y + t * 0.7} Z`}" fill="${color}" data-w="0.5"/>`;
}

/** Bouches, centrées sur (C, my). Toutes dans un groupe `bouche` (babil). */
const MOUTHS = {
  sourire: (my, lip) =>
    `<path d="${P`M${C - 13} ${my} Q${C} ${my + 6} ${C + 13} ${my - 3} Q${C + 9} ${my + 7} ${C} ${my + 7} Q${C - 9} ${my + 6} ${C - 13} ${my} Z`}" fill="${lip}" data-w="0.55"/>`,
  coin: (my, lip) =>
    `<path d="${P`M${C - 11} ${my + 2} Q${C + 2} ${my + 4} ${C + 13} ${my - 4} Q${C + 10} ${my + 5} ${C} ${my + 6} Q${C - 8} ${my + 6} ${C - 11} ${my + 2} Z`}" fill="${lip}" data-w="0.55"/>`,
  plat: (my, lip) =>
    `<path d="${P`M${C - 11} ${my + 1} Q${C} ${my - 1} ${C + 11} ${my + 1} L${C + 10} ${my + 4} Q${C} ${my + 2.5} ${C - 10} ${my + 4} Z`}" fill="${lip}" data-w="0.5"/>`,
  rire: (my, lip, id) =>
    [
      `<path id="${id}" d="${P`M${C - 18} ${my - 4} Q${C} ${my} ${C + 18} ${my - 5} Q${C + 14} ${my + 15} ${C} ${my + 16} Q${C - 14} ${my + 15} ${C - 18} ${my - 4} Z`}" fill="${LIP}" data-w="0.6"/>`,
      `<path data-clip="${id}" data-w="0" d="${P`M${C - 20} ${my - 6} L${C + 20} ${my - 7} L${C + 18} ${my + 1} Q${C} ${my + 3} ${C - 18} ${my + 1} Z`}" fill="${WHITE}"/>`,
      `<path data-clip="${id}" data-w="0" d="${P`M${C - 10} ${my + 13} Q${C} ${my + 6} ${C + 10} ${my + 13} L${C + 10} ${my + 20} L${C - 10} ${my + 20} Z`}" fill="${CHEEK}"/>`,
    ].join(''),
  pince: (my) =>
    `<path data-w="0.6" fill="none" stroke="${INK}" d="${P`M${C - 10} ${my + 3} Q${C - 5} ${my - 2} ${C} ${my + 2} Q${C + 5} ${my + 6} ${C + 10} ${my}`}"/>`,
  o: (my, lip, id) =>
    [
      `<ellipse id="${id}" cx="${C}" cy="${n(my + 3)}" rx="6.5" ry="8.5" fill="${LIP}" data-w="0.6"/>`,
      `<path data-clip="${id}" data-w="0" d="${P`M${C - 7} ${my + 7} Q${C} ${my + 3} ${C + 7} ${my + 7} L${C + 7} ${my + 13} L${C - 7} ${my + 13} Z`}" fill="${CHEEK}"/>`,
    ].join(''),
  colere: (my, lip, id) =>
    [
      `<path id="${id}" d="${P`M${C - 14} ${my + 5} Q${C - 6} ${my - 3} ${C} ${my - 3} Q${C + 6} ${my - 3} ${C + 14} ${my + 5} Q${C} ${my + 3} ${C - 14} ${my + 5} Z`}" fill="${lip}" data-w="0.6"/>`,
      `<path data-clip="${id}" data-w="0" d="${P`M${C - 14} ${my - 4} L${C + 14} ${my - 4} L${C + 14} ${my} L${C - 14} ${my} Z`}" fill="${WHITE}"/>`,
    ].join(''),
};

/* ------------------------------------------------------------------------------------------ */
/* Accessoires de métier et petits signes                                                      */
/* ------------------------------------------------------------------------------------------ */

/** Chaque accessoire: `back` (derrière la tête), `front` (par-dessus tout), selon la géométrie. */
const PROPS = {
  // Boulanger: farine sur la joue et le nez, baguette sur l'épaule.
  farine: (g) => ({
    face: `<g data-w="0" fill="#F3EDE0" fill-opacity="0.75"><ellipse cx="${n(g.eL - 6)}" cy="${n(g.ey + 22)}" rx="7" ry="4"/><circle cx="${n(C + 4)}" cy="${n(g.ey + 14)}" r="2.6"/></g>`,
  }),
  baguette: () => ({
    front: `<path id="baguette" d="M128 232 L172 168 Q182 158 188 166 Q190 176 150 232 Z" fill="#D7A86A"/>
  <path data-clip="baguette" data-w="0" d="M150 232 L190 172 L190 232 Z" fill="#A87A46"/>
  <path data-w="0.5" fill="none" stroke="${INK}" d="M160 196 L170 192 M150 210 L160 206 M141 224 L151 220"/>`,
  }),
  // Horloger: loupe d'horloger relevée sur le front, à son élastique.
  loupe: (g) => ({
    front: `<path data-w="0.6" fill="none" stroke="${INK}" d="${P`M${g.L + 2} ${g.ey - 30} Q${C} ${g.ey - 44} ${g.R - 2} ${g.ey - 30}`}"/>
  <path d="${P`M${g.eR - 9} ${g.ey - 46} L${g.eR + 9} ${g.ey - 46} L${g.eR + 7} ${g.ey - 28} L${g.eR - 7} ${g.ey - 28} Z`}" fill="#26282E"/>
  <ellipse cx="${n(g.eR)}" cy="${n(g.ey - 28)}" rx="7" ry="3" fill="#A9C7D9" data-w="0.6"/>`,
  }),
  // Chaîne de montre en laiton sur le gilet.
  chaine: (g, b) => ({
    front: `<path data-w="0.55" fill="none" stroke="${INK}" d="${P`M${C - 12} ${b.ty + 34} Q${C - 30} ${b.ty + 48} ${C - 44} ${b.ty + 40}`}"/>
  <path data-w="0" fill="none" d="${P`M${C - 12} ${b.ty + 34} Q${C - 30} ${b.ty + 48} ${C - 44} ${b.ty + 40}`}" data-teinte="${BRASS}"/>
  <circle cx="${n(C - 46)}" cy="${n(b.ty + 42)}" r="4" fill="${BRASS}" data-w="0.5"/>`,
  }),
  // Bûcheron: hache sur l'épaule (manche de frêne, fer d'acier).
  hache: () => ({
    back: `<path d="M138 232 L164 128 L172 130 L148 232 Z" fill="#D7A86A"/>
  <path d="M154 118 L180 110 L178 140 L158 146 Q164 132 154 118 Z" fill="#8C8E91"/>
  <path data-w="0" d="M172 112 L180 110 L178 140 L172 142 Z" fill="#DED3BC"/>`,
  }),
  // Menuisier: crayon plat derrière l'oreille, copeau blond pris dans les cheveux.
  crayon: (g) => ({
    front: `<path d="${P`M${g.ears[1] - 6} ${g.ears[2] - 26} L${g.ears[1] + 14} ${g.ears[2] - 10} L${g.ears[1] + 10} ${g.ears[2] - 4} L${g.ears[1] - 10} ${g.ears[2] - 20} Z`}" fill="#C5443D" data-w="0.6"/>
  <path d="${P`M${g.ears[1] + 14} ${g.ears[2] - 10} L${g.ears[1] + 20} ${g.ears[2] - 2} L${g.ears[1] + 10} ${g.ears[2] - 4} Z`}" fill="#D7A86A" data-w="0.5"/>`,
  }),
  copeau: (g) => ({
    front: `<path d="${P`M${g.L + 18} ${g.T + 6} Q${g.L + 6} ${g.T - 4} ${g.L + 14} ${g.T - 12} Q${g.L + 26} ${g.T - 14} ${g.L + 26} ${g.T - 2} Q${g.L + 18} ${g.T - 8} ${g.L + 18} ${g.T + 6} Z`}" fill="#D7A86A" data-w="0.5"/>`,
  }),
  // Meunière: un épi de blé piqué dans le chignon.
  epi: (g) => ({
    back: `<path data-w="0.6" fill="none" stroke="${INK}" d="${P`M${C + 6} ${g.T - 10} L${C + 40} ${g.T - 40}`}"/>
  <g fill="#D4A33E" data-w="0.45">${[0, 1, 2, 3]
    .map((k) => {
      const x = C + 24 + k * 5;
      const y = g.T - 24 - k * 5;
      return `<path d="${P`M${x - 1} ${y} q-7 -1 -6 -7 q6 1 6 7 Z`}"/><path d="${P`M${x + 1} ${y + 1} q1 7 7 6 q-1 -6 -7 -6 Z`}"/>`;
    })
    .join('')}</g>`,
  }),
  // Cafetière: torchon rayé sur l'épaule.
  torchon: (g, b) => ({
    front: `<path id="torchon" d="${P`M${b.x1 - 58} ${b.ty + 2} Q${b.x1 - 34} ${b.ty - 2} ${b.x1 - 18} ${b.ty + 14} L${b.x1 - 30} 232 L${b.x1 - 52} 232 Q${b.x1 - 48} ${b.ty + 30} ${b.x1 - 58} ${b.ty + 2} Z`}" fill="#F3EDE0"/>
  <g data-clip="torchon" data-w="0" fill="#C5443D"><path d="${P`M${b.x1 - 60} ${b.ty + 34} L${b.x1 - 20} ${b.ty + 30} L${b.x1 - 20} ${b.ty + 36} L${b.x1 - 60} ${b.ty + 40} Z`}"/><path d="${P`M${b.x1 - 60} ${b.ty + 46} L${b.x1 - 20} ${b.ty + 42} L${b.x1 - 20} ${b.ty + 46} L${b.x1 - 60} ${b.ty + 50} Z`}"/></g>`,
  }),
  // Doyenne: camée en laiton au col.
  camee: (g, b) => ({
    front: `<ellipse cx="${C}" cy="${n(b.ty + 16)}" rx="7" ry="9" fill="${BRASS}" data-w="0.55"/>
  <ellipse cx="${C}" cy="${n(b.ty + 16)}" rx="4.4" ry="6" fill="#F3EDE0" data-w="0.4"/>`,
  }),
  // Enfant intrépide: pansement sur la pommette.
  pansement: (g) => ({
    face: `<path d="${P`M${g.eR + 2} ${g.ey + 18} L${g.eR + 18} ${g.ey + 12} L${g.eR + 20} ${g.ey + 18} L${g.eR + 4} ${g.ey + 24} Z`}" fill="#D9CAAE" data-w="0.5"/>
  <g data-w="0" fill="#B8A17E"><circle cx="${n(g.eR + 9)}" cy="${n(g.ey + 17)}" r="1"/><circle cx="${n(g.eR + 13)}" cy="${n(g.ey + 16)}" r="1"/></g>`,
  }),
  rousseur: (g) => ({
    face: `<g data-w="0" fill="#8C4A2E" fill-opacity="0.55">${[
      [-12, 14],
      [-6, 17],
      [-15, 20],
      [-9, 22],
      [-3, 13],
    ]
      .flatMap(([dx, dy]) => [
        `<circle cx="${n(g.eL + dx + 4)}" cy="${n(g.ey + dy)}" r="1.4"/>`,
        `<circle cx="${n(g.eR - dx - 4)}" cy="${n(g.ey + dy)}" r="1.4"/>`,
      ])
      .join('')}</g>`,
  }),
  // Fils de fermier: brin de paille coincé derrière l'oreille.
  paille: (g) => ({
    back: `<path data-w="0.5" d="${P`M${g.ears[1] - 18} ${g.ears[2] - 30} L${g.ears[1] + 22} ${g.ears[2] + 6} L${g.ears[1] + 20} ${g.ears[2] + 9} L${g.ears[1] - 20} ${g.ears[2] - 27} Z`}" fill="#E2C582"/>`,
  }),
  // Factrice et photographe: appareil en bandoulière.
  photo: (g, b) => ({
    front: `<path data-w="0.6" d="${P`M${b.x0 + 34} ${b.ty + 4} L${C + 30} 214 L${C + 30} 220 L${b.x0 + 28} ${b.ty + 10} Z`}" fill="${LEATHER_DARK}"/>
  <path d="${P`M${C + 18} 200 L${C + 66} 200 L${C + 68} 232 L${C + 16} 232 Z`}" fill="#4A4D52"/>
  <path d="${P`M${C + 24} 194 L${C + 38} 194 L${C + 40} 200 L${C + 22} 200 Z`}" fill="#4A4D52" data-w="0.5"/>
  <circle cx="${n(C + 46)}" cy="218" r="12" fill="#26282E"/>
  <circle cx="${n(C + 46)}" cy="218" r="6.5" fill="#587F8E" data-w="0.5"/>
  <circle data-w="0" cx="${n(C + 43)}" cy="215" r="2" fill="${WHITE}"/>`,
  }),
  // Forgeronne: suie sur la joue, lunettes de forge relevées sur les cheveux.
  suie: (g) => ({
    face: `<path data-w="0" d="${P`M${g.eR - 4} ${g.ey + 18} Q${g.eR + 10} ${g.ey + 12} ${g.eR + 18} ${g.ey + 20} Q${g.eR + 6} ${g.ey + 22} ${g.eR - 4} ${g.ey + 18} Z`}" fill="#4A4D52" fill-opacity="0.55"/>`,
  }),
  'lunettes-forge': (g) => ({
    front: `<path d="${P`M${g.L - 2} ${g.T + 22} Q${C} ${g.T + 4} ${g.R + 2} ${g.T + 22} L${g.R + 2} ${g.T + 28} Q${C} ${g.T + 10} ${g.L - 2} ${g.T + 28} Z`}" fill="${LEATHER_DARK}" data-w="0.5"/>
  <circle cx="${n(C - 16)}" cy="${n(g.T + 10)}" r="11" fill="${LEATHER}"/>
  <circle cx="${n(C + 16)}" cy="${n(g.T + 10)}" r="11" fill="${LEATHER}"/>
  <circle cx="${n(C - 16)}" cy="${n(g.T + 10)}" r="7" fill="#3F6453" data-w="0.5"/>
  <circle cx="${n(C + 16)}" cy="${n(g.T + 10)}" r="7" fill="#3F6453" data-w="0.5"/>
  <g data-w="0" fill="#96A98C"><circle cx="${n(C - 19)}" cy="${n(g.T + 7)}" r="2"/><circle cx="${n(C + 13)}" cy="${n(g.T + 7)}" r="2"/></g>`,
  }),
  // Les rubans rouges des piquets de Paulin: Margot en noue un à son chignon.
  ruban: (g) => ({
    front: `<path d="${P`M${g.R - 6} ${g.ey - 12} L${g.R + 14} ${g.ey - 22} L${g.R + 10} ${g.ey - 2} Z`}" fill="#C5443D" data-w="0.55"/>
  <path d="${P`M${g.R - 6} ${g.ey - 12} L${g.R + 4} ${g.ey + 14} L${g.R - 2} ${g.ey + 16} Z`}" fill="#C5443D" data-w="0.55"/>
  <circle cx="${n(g.R - 6)}" cy="${n(g.ey - 12)}" r="3.5" fill="#8F3B34" data-w="0.5"/>`,
  }),
  // Paulin: un ruban rouge qui dépasse de la poche du gilet.
  'ruban-poche': (g, b) => ({
    front: `<path d="${P`M${C - 40} ${b.ty + 36} L${C - 20} ${b.ty + 36} L${C - 21} ${b.ty + 56} L${C - 39} ${b.ty + 56} Z`}" fill="#A9C7D9" data-w="0.5"/>
  <path d="${P`M${C - 34} ${b.ty + 38} Q${C - 38} ${b.ty + 22} ${C - 30} ${b.ty + 12} L${C - 26} ${b.ty + 15} Q${C - 33} ${b.ty + 24} ${C - 29} ${b.ty + 38} Z`}" fill="#C5443D" data-w="0.5"/>
  <path d="${P`M${C - 30} ${b.ty + 38} Q${C - 26} ${b.ty + 26} ${C - 16} ${b.ty + 22} L${C - 15} ${b.ty + 26} Q${C - 23} ${b.ty + 28} ${C - 26} ${b.ty + 38} Z`}" fill="#C5443D" data-w="0.5"/>`,
  }),
  // Sonneuse: la corde de la cloche, en rouleau sur l'épaule.
  corde: (g, b) => ({
    front: `<ellipse cx="${n(b.x1 - 38)}" cy="${n(b.ty + 30)}" rx="22" ry="28" fill="none" stroke="${INK}" data-teinte="#8C6F4E" data-w="1.3"/>
  <ellipse cx="${n(b.x1 - 38)}" cy="${n(b.ty + 30)}" rx="18" ry="24" fill="none" stroke="${INK}" data-w="0.6"/>
  <path d="${P`M${b.x1 - 52} ${b.ty + 2} Q${b.x1 - 30} ${b.ty - 6} ${b.x1 - 18} ${b.ty + 18} Q${b.x1 - 14} ${b.ty + 40} ${b.x1 - 30} ${b.ty + 56} L${b.x1 - 34} ${b.ty + 52} Q${b.x1 - 20} ${b.ty + 38} ${b.x1 - 24} ${b.ty + 20} Q${b.x1 - 34} ${b.ty + 2} ${b.x1 - 52} ${b.ty + 8} Z`}" fill="#B8A17E" data-w="0.55"/>`,
  }),
  // Curé: petite croix d'acier sur le col roulé.
  croix: (g, b) => ({
    front: `<path data-w="0.45" fill="none" stroke="${INK}" d="${P`M${C - 10} ${b.ty + 4} L${C} ${b.ty + 22} L${C + 10} ${b.ty + 4}`}"/>
  <path d="${P`M${C - 2.5} ${b.ty + 20} L${C + 2.5} ${b.ty + 20} L${C + 2.5} ${b.ty + 26} L${C + 8} ${b.ty + 26} L${C + 8} ${b.ty + 31} L${C + 2.5} ${b.ty + 31} L${C + 2.5} ${b.ty + 44} L${C - 2.5} ${b.ty + 44} L${C - 2.5} ${b.ty + 31} L${C - 8} ${b.ty + 31} L${C - 8} ${b.ty + 26} L${C - 2.5} ${b.ty + 26} Z`}" fill="${STEEL}" data-w="0.5"/>`,
  }),
  // Mèche au vent (curé à vélo).
  epi_vent: (g, b, { hair }) => ({
    front: `<path d="${P`M${C + 4} ${g.T - 4} Q${C + 8} ${g.T - 20} ${C + 24} ${g.T - 20} Q${C + 34} ${g.T - 18} ${C + 30} ${g.T - 10} Q${C + 26} ${g.T - 15} ${C + 20} ${g.T - 12} Q${C + 14} ${g.T - 8} ${C + 16} ${g.T + 2} Z`}" fill="${hair}" data-w="0.55"/>`,
  }),
  // Mécanicienne: montre de gousset (elle retarde de trois minutes, exprès).
  gousset: (g, b) => ({
    front: `<path data-w="0.5" fill="none" stroke="${INK}" d="${P`M${C + 16} ${b.ty + 30} Q${C + 30} ${b.ty + 46} ${C + 40} ${b.ty + 44}`}"/>
  <circle cx="${n(C + 44)}" cy="${n(b.ty + 50)}" r="9" fill="${BRASS}" data-w="0.55"/>
  <circle cx="${n(C + 44)}" cy="${n(b.ty + 50)}" r="6" fill="#F3EDE0" data-w="0.35"/>
  <path data-w="0.35" fill="none" stroke="${INK}" d="${P`M${C + 44} ${b.ty + 50} L${C + 44} ${b.ty + 46} M${C + 44} ${b.ty + 50} L${C + 47} ${b.ty + 51}`}"/>`,
  }),
  // Mercière: mètre ruban autour du cou.
  metre: (g, b) => ({
    front: `<path d="${P`M${C - 24} ${b.ty - 4} Q${C - 30} ${b.ty + 30} ${C - 22} 232 L${C - 12} 232 Q${C - 20} ${b.ty + 30} ${C - 14} ${b.ty + 2} Z`}" fill="#D4A33E" data-w="0.5"/>
  <path d="${P`M${C + 24} ${b.ty - 4} Q${C + 32} ${b.ty + 24} ${C + 26} ${b.ty + 56} L${C + 16} ${b.ty + 56} Q${C + 22} ${b.ty + 24} ${C + 14} ${b.ty + 2} Z`}" fill="#D4A33E" data-w="0.5"/>
  <path data-w="0.35" fill="none" stroke="${INK}" d="${[0, 1, 2, 3, 4]
    .map(
      (k) =>
        P`M${C - 27 + k * 0.4} ${b.ty + 10 + k * 12} l5 0 M${C + 26 - k * 0.4} ${b.ty + 6 + k * 10} l-5 0`,
    )
    .join(' ')}"/>`,
  }),
  creoles: (g) => ({
    front: `<circle cx="${n(g.ears[0] - 2)}" cy="${n(g.ears[2] + 34)}" r="7" fill="none" stroke="${INK}" data-teinte="${BRASS}" data-w="1"/>
  <circle cx="${n(g.ears[1] + 2)}" cy="${n(g.ears[2] + 34)}" r="7" fill="none" stroke="${INK}" data-teinte="${BRASS}" data-w="1"/>`,
  }),
  // Contrôleur: plaque de laiton au gilet, pince à poinçonner à la main.
  insigne: (g, b) => ({
    front: `<path d="${P`M${C + 30} ${b.ty + 26} L${C + 48} ${b.ty + 24} L${C + 50} ${b.ty + 34} L${C + 32} ${b.ty + 36} Z`}" fill="${BRASS}" data-w="0.5"/>
  <path data-w="0.35" fill="none" stroke="${INK}" d="${P`M${C + 35} ${b.ty + 30} L${C + 45} ${b.ty + 29}`}"/>`,
  }),
  pince: (g, b, { skin }) => ({
    front: `<path d="${P`M${C - 62} 232 Q${C - 70} 212 ${C - 54} 204 L${C - 30} 204 Q${C - 18} 214 ${C - 28} 232 Z`}" fill="${skin}"/>
  <path d="${P`M${C - 54} 204 L${C - 40} 172 L${C - 32} 174 L${C - 42} 206 Z`}" fill="${STEEL}" data-w="0.6"/>
  <path d="${P`M${C - 40} 206 L${C - 22} 176 L${C - 15} 180 L${C - 30} 208 Z`}" fill="${STEEL}" data-w="0.6"/>
  <circle cx="${n(C - 36)}" cy="172" r="5" fill="#B9B7B0" data-w="0.5"/>
  <path d="${P`M${C - 48} 214 Q${C - 40} 210 ${C - 32} 214 M${C - 50} 222 Q${C - 40} 218 ${C - 30} 222`}" fill="none" stroke="${INK}" data-w="0.5"/>`,
  }),
  // Aiguilleur: petit drapeau rouge roulé sur son bâton.
  drapeau: (g, b) => ({
    front: `<path d="${P`M${b.x1 - 40} 232 L${b.x1 - 10} ${b.ty - 30} L${b.x1 - 4} ${b.ty - 28} L${b.x1 - 32} 232 Z`}" fill="#D7A86A" data-w="0.6"/>
  <path d="${P`M${b.x1 - 12} ${b.ty - 24} L${b.x1 - 30} ${b.ty + 22} Q${b.x1 - 20} ${b.ty + 26} ${b.x1 - 14} ${b.ty + 22} L${b.x1 - 2} ${b.ty - 16} Z`}" fill="#C5443D"/>`,
  }),
  // Jardinière: une carotte fanée dans la main.
  carotte: (g, b) => ({
    front: `<path d="${P`M${b.x1 - 22} ${b.ty + 8} L${b.x1 - 40} ${b.ty - 18} L${b.x1 - 34} ${b.ty - 20} L${b.x1 - 18} ${b.ty + 2} Z`}" fill="#6E9241" data-w="0.5"/>
  <path d="${P`M${b.x1 - 20} ${b.ty + 6} L${b.x1 - 10} ${b.ty - 18} L${b.x1 - 4} ${b.ty - 14} L${b.x1 - 14} ${b.ty + 8} Z`}" fill="#9DBB5B" data-w="0.5"/>
  <path d="${P`M${b.x1 - 30} ${b.ty + 4} Q${b.x1 - 14} ${b.ty - 2} ${b.x1 - 8} ${b.ty + 8} L${b.x1 - 42} 228 Q${b.x1 - 46} 226 ${b.x1 - 30} ${b.ty + 4} Z`}" fill="#C0803A"/>
  <path data-w="0.4" fill="none" stroke="${INK}" d="${P`M${b.x1 - 30} ${b.ty + 30} l8 2 M${b.x1 - 34} ${b.ty + 46} l7 2`}"/>`,
  }),
};

/* ------------------------------------------------------------------------------------------ */
/* Cheveux et coiffes                                                                          */
/* ------------------------------------------------------------------------------------------ */

function hair(g, h) {
  const { L, R, T } = g;
  const c = h.couleur;
  const sh = shade(c);
  const hi = SHINE[c] ?? c;
  const clipShadow = (id) =>
    `<path data-clip="${id}" data-w="0" d="${P`M${C + 18} ${T - 20} Q${R + 6} ${T + 10} ${R + 2} ${T + 60} L${R + 30} ${T + 60} L${R + 30} ${T - 20} Z`}" fill="${sh}"/>`;
  const shine = (id) =>
    `<path data-clip="${id}" data-w="0" d="${P`M${L + 16} ${T + 18} Q${L + 28} ${T + 2} ${C - 4} ${T + 2} Q${L + 30} ${T + 10} ${L + 22} ${T + 24} Z`}" fill="${hi}"/>`;
  const back = [];
  const front = [];
  switch (h.coupe) {
    case 'court':
      front.push(
        `<path id="cheveux" d="${P`M${L} ${T + 50} Q${L - 5} ${T - 4} ${C} ${T - 7} Q${R + 5} ${T - 4} ${R} ${T + 50} Q${R - 4} ${T + 26} ${R - 20} ${T + 18} Q${C + 12} ${T + 24} ${C + 2} ${T + 15} Q${C - 12} ${T + 25} ${L + 20} ${T + 19} Q${L + 4} ${T + 28} ${L} ${T + 50} Z`}" fill="${c}"/>`,
        clipShadow('cheveux'),
        shine('cheveux'),
        `<path data-w="0.4" fill="none" stroke="${INK}" d="${P`M${L + 14} ${T + 10} Q${L + 22} ${T + 4} ${L + 32} ${T + 4} M${C + 20} ${T + 2} Q${C + 30} ${T + 4} ${C + 36} ${T + 12}`}"/>`,
      );
      break;
    case 'raie':
      front.push(
        `<path id="cheveux" d="${P`M${L} ${T + 54} Q${L - 7} ${T - 6} ${C - 6} ${T - 9} Q${R + 8} ${T - 6} ${R} ${T + 52} Q${R - 3} ${T + 26} ${R - 28} ${T + 17} Q${C - 2} ${T + 12} ${L + 28} ${T + 30} Q${L + 8} ${T + 36} ${L} ${T + 54} Z`}" fill="${c}"/>`,
        clipShadow('cheveux'),
        shine('cheveux'),
        `<path data-w="0.5" fill="none" stroke="${INK}" d="${P`M${C - 22} ${T - 6} Q${C - 18} ${T + 6} ${C - 6} ${T + 14}`}"/>`,
      );
      break;
    case 'chignon':
    case 'chignon-bas': {
      if (h.coupe === 'chignon')
        back.push(
          `<circle id="chignon" cx="${C}" cy="${n(T - 14)}" r="22" fill="${c}"/>`,
          `<path data-clip="chignon" data-w="0" d="${P`M${C + 6} ${T - 40} Q${C + 28} ${T - 14} ${C + 6} ${T + 10} L${C + 30} ${T + 10} L${C + 30} ${T - 40} Z`}" fill="${sh}"/>`,
          `<path data-w="0.4" fill="none" stroke="${INK}" d="${P`M${C - 16} ${T - 20} Q${C - 2} ${T - 30} ${C + 12} ${T - 22} M${C - 14} ${T - 8} Q${C + 2} ${T - 16} ${C + 16} ${T - 8}`}"/>`,
        );
      else
        back.push(
          `<ellipse id="chignon" cx="${n(R + 4)}" cy="${n(T + 70)}" rx="17" ry="19" fill="${c}"/>`,
          `<path data-clip="chignon" data-w="0" d="${P`M${R + 6} ${T + 50} Q${R + 24} ${T + 70} ${R + 6} ${T + 92} L${R + 30} ${T + 92} L${R + 30} ${T + 50} Z`}" fill="${sh}"/>`,
        );
      front.push(
        `<path id="cheveux" d="${P`M${L} ${T + 48} Q${L - 4} ${T - 4} ${C} ${T - 6} Q${R + 4} ${T - 4} ${R} ${T + 48} Q${R - 8} ${T + 20} ${C + 17} ${T + 16} Q${C + 6} ${T + 26} ${C - 19} ${T + 22} Q${L + 12} ${T + 26} ${L} ${T + 48} Z`}" fill="${c}"/>`,
        clipShadow('cheveux'),
        shine('cheveux'),
        `<path data-w="0.45" fill="none" stroke="${INK}" d="${P`M${L + 6} ${T + 40} Q${L + 2} ${T + 52} ${L + 8} ${T + 58} M${R - 6} ${T + 40} Q${R} ${T + 50} ${R - 8} ${T + 58}`}"/>`,
      );
      break;
    }
    case 'carre':
      back.push(
        `<path id="carre" d="${P`M${L - 9} ${T + 94} Q${L - 16} ${T - 8} ${C} ${T - 12} Q${R + 16} ${T - 8} ${R + 9} ${T + 94} Q${R} ${T + 100} ${R - 10} ${T + 92} L${L + 10} ${T + 92} Q${L} ${T + 100} ${L - 9} ${T + 94} Z`}" fill="${c}"/>`,
        `<path data-clip="carre" data-w="0" d="${P`M${R - 4} ${T} Q${R + 16} ${T + 40} ${R + 6} ${T + 100} L${R + 30} ${T + 100} L${R + 30} ${T} Z`}" fill="${sh}"/>`,
      );
      front.push(
        `<path id="cheveux" d="${P`M${L} ${T + 58} Q${L - 4} ${T - 3} ${C} ${T - 7} Q${R + 4} ${T - 3} ${R} ${T + 58} L${R - 6} ${T + 38} L${R - 15} ${T + 44} L${R - 22} ${T + 33} L${C + 13} ${T + 41} L${C + 2} ${T + 31} L${C - 10} ${T + 41} L${L + 24} ${T + 33} L${L + 16} ${T + 44} L${L + 6} ${T + 38} Z`}" fill="${c}"/>`,
        clipShadow('cheveux'),
        shine('cheveux'),
        `<path d="${P`M${L} ${T + 50} Q${L - 2} ${T + 80} ${L + 3} ${T + 96} L${L + 11} ${T + 88} Q${L + 6} ${T + 70} ${L + 8} ${T + 52} Z`}" fill="${c}" data-w="0.55"/>`,
        `<path d="${P`M${R} ${T + 50} Q${R + 2} ${T + 80} ${R - 3} ${T + 96} L${R - 11} ${T + 88} Q${R - 6} ${T + 70} ${R - 8} ${T + 52} Z`}" fill="${sh}" data-w="0.55"/>`,
      );
      break;
    case 'aucun':
      break;
    default:
      throw new Error(`coupe inconnue: ${h.coupe}`);
  }
  return { back, front };
}

function beanie(g, b, hairColor) {
  const { L, R, T } = g;
  const c = tissu(b.couleur);
  const sh = shade(c);
  const low = b.bas ? 16 : 0;
  const band = T + 36 + low;
  const out = [];
  if (hairColor !== null)
    out.push(
      `<path d="${P`M${L - 1} ${band + 6} Q${L - 3} ${band + 20} ${L + 4} ${band + 26} L${L + 10} ${band + 10} Z`}" fill="${hairColor}" data-w="0.5"/>`,
      `<path d="${P`M${R + 1} ${band + 6} Q${R + 3} ${band + 20} ${R - 4} ${band + 26} L${R - 10} ${band + 10} Z`}" fill="${shade(hairColor)}" data-w="0.5"/>`,
    );
  out.push(
    `<circle id="pompon" cx="${C}" cy="${n(T - 22)}" r="12" fill="${SHINE_FABRIC(c)}"/>`,
    `<path id="bonnet" d="${P`M${L - 4} ${band} Q${L - 8} ${T - 14} ${C} ${T - 16} Q${R + 8} ${T - 14} ${R + 4} ${band} Z`}" fill="${c}"/>`,
    `<path data-clip="bonnet" data-w="0" d="${P`M${C + 22} ${T - 20} Q${R + 10} ${T + 6} ${R + 4} ${band} L${R + 30} ${band} L${R + 30} ${T - 20} Z`}" fill="${sh}"/>`,
    `<path data-w="0.4" fill="none" stroke="${INK}" d="${P`M${C - 22} ${T - 6} Q${C - 26} ${T + 14} ${C - 24} ${band - 6} M${C + 4} ${T - 12} L${C + 4} ${band - 8} M${C + 30} ${T - 4} Q${C + 34} ${T + 14} ${C + 32} ${band - 6}`}"/>`,
    `<path id="revers" d="${P`M${L - 8} ${band + 14} Q${C} ${band + 4} ${R + 8} ${band + 14} L${R + 6} ${band - 6} Q${C} ${band - 16} ${L - 6} ${band - 6} Z`}" fill="${c}"/>`,
    `<path data-clip="revers" data-w="0" d="${P`M${C + 30} ${band - 20} L${R + 20} ${band - 20} L${R + 20} ${band + 20} L${C + 40} ${band + 20} Z`}" fill="${sh}"/>`,
    `<path data-w="0.4" fill="none" stroke="${INK}" d="${[...Array(9).keys()]
      .map((k) => {
        const x = L + 2 + k * ((R - L - 4) / 8);
        return P`M${x} ${band - 8 - (1 - Math.abs(x - C) / 60) * 6} l0 14`;
      })
      .join(' ')}"/>`,
  );
  return out;
}
/** Pompon d'un ton plus clair que le bonnet (ou du même s'il n'y en a pas). */
function SHINE_FABRIC(c) {
  const up = Object.entries(SHADE).find(([, v]) => v === c);
  return up === undefined ? c : up[0];
}

/* ------------------------------------------------------------------------------------------ */
/* Buste                                                                                       */
/* ------------------------------------------------------------------------------------------ */

function bust(f, g, b, skin, skinSh) {
  const { x0, x1, ty, nw } = b;
  const top = f.haut;
  const c = tissu(top.couleur);
  const sh = shade(c);
  const out = [];
  const shoulders = P`M${x0} 232 Q${x0 + 4} ${ty + 20} ${x0 + 46} ${ty + 4} L${x1 - 46} ${ty + 4} Q${x1 - 4} ${ty + 20} ${x1} 232 Z`;
  const shadowRight = P`M${x1 - 50} ${ty - 6} Q${x1 + 8} ${ty + 22} ${x1 - 26} 232 L190 232 L190 ${ty - 6} Z`;
  const neck = () => [
    `<path id="cou" d="${P`M${C - nw} ${ty - 26} L${C + nw} ${ty - 26} L${C + nw} ${ty + 8} Q${C} ${ty + 16} ${C - nw} ${ty + 8} Z`}" fill="${skin}"/>`,
    `<path data-clip="cou" data-w="0" d="${P`M${C - nw - 6} ${ty - 30} L${C + nw + 6} ${ty - 30} L${C + nw + 6} ${ty - 8} Q${C} ${ty - 2} ${C - nw - 6} ${ty - 10} Z`}" fill="${skinSh}"/>`,
  ];
  if (top.type === 'debardeur') {
    out.push(
      `<path id="epaules" d="${shoulders}" fill="${skin}"/>`,
      `<path data-clip="epaules" data-w="0" d="${shadowRight}" fill="${skinSh}"/>`,
      `<path data-w="0.45" fill="none" stroke="${INK}" d="${P`M${x0 + 30} ${ty + 30} Q${x0 + 38} ${ty + 46} ${x0 + 34} ${ty + 62} M${x1 - 30} ${ty + 30} Q${x1 - 38} ${ty + 46} ${x1 - 34} ${ty + 62}`}"/>`,
      ...neck(),
      `<path id="haut" d="${P`M${x0 + 36} 232 L${x0 + 40} ${ty + 36} L${C - 34} ${ty + 4} L${C - 25} ${ty + 4} Q${C} ${ty + 34} ${C + 25} ${ty + 4} L${C + 34} ${ty + 4} L${x1 - 40} ${ty + 36} L${x1 - 36} 232 Z`}" fill="${c}"/>`,
      `<path data-clip="haut" data-w="0" d="${P`M${C + 30} ${ty} L${x1 - 30} ${ty + 30} L${x1 - 36} 232 L${C + 40} 232 Q${C + 52} ${ty + 40} ${C + 30} ${ty} Z`}" fill="${sh}"/>`,
    );
  } else {
    out.push(
      `<path id="haut" d="${shoulders}" fill="${c}"/>`,
      `<path data-clip="haut" data-w="0" d="${shadowRight}" fill="${sh}"/>`,
    );
    if (top.type === 'tee' || top.type === 'robe')
      out.push(
        `<path data-w="0" d="${P`M${C - 24} ${ty + 3} Q${C} ${ty + 30} ${C + 24} ${ty + 3} Z`}" fill="${skin}"/>`,
      );
    if (f.gilet !== null) {
      const v = tissu(f.gilet);
      const vs = shade(v);
      out.push(
        `<path d="${P`M${x0 + 16} 232 Q${x0 + 20} ${ty + 22} ${x0 + 50} ${ty + 6} L${C - 22} ${ty + 4} Q${C - 18} ${ty + 40} ${C - 10} 232 Z`}" fill="${v}"/>`,
        `<path id="gilet-d" d="${P`M${x1 - 16} 232 Q${x1 - 20} ${ty + 22} ${x1 - 50} ${ty + 6} L${C + 22} ${ty + 4} Q${C + 18} ${ty + 40} ${C + 10} 232 Z`}" fill="${v}"/>`,
        `<path data-clip="gilet-d" data-w="0" d="${P`M${x1 - 46} ${ty} Q${x1 + 4} ${ty + 30} ${x1 - 30} 232 L190 232 L190 ${ty} Z`}" fill="${vs}"/>`,
        `<g data-w="0.45" fill="${BRASS}">${[0, 1, 2]
          .map((k) => `<circle cx="${n(C - 16 + k * 1.2)}" cy="${n(ty + 30 + k * 18)}" r="2.8"/>`)
          .join('')}</g>`,
      );
    }
    out.push(...neck());
    if (top.type === 'pull')
      out.push(
        `<path d="${P`M${C - nw - 7} ${ty + 2} Q${C} ${ty + 20} ${C + nw + 7} ${ty + 2} L${C + nw + 11} ${ty + 8} Q${C} ${ty + 30} ${C - nw - 11} ${ty + 8} Z`}" fill="${c}" data-w="0.55"/>`,
      );
    if (top.type === 'tee')
      out.push(
        `<path d="${P`M${C - 24} ${ty + 3} Q${C} ${ty + 30} ${C + 24} ${ty + 3} L${C + 28} ${ty + 6} Q${C} ${ty + 38} ${C - 28} ${ty + 6} Z`}" fill="${c}" data-w="0.5"/>`,
      );
    if (top.type === 'col-roule')
      out.push(
        `<path id="col" d="${P`M${C - nw - 4} ${ty - 18} Q${C} ${ty - 10} ${C + nw + 4} ${ty - 18} L${C + nw + 9} ${ty + 10} Q${C} ${ty + 20} ${C - nw - 9} ${ty + 10} Z`}" fill="${c}"/>`,
        `<path data-clip="col" data-w="0" d="${P`M${C + 6} ${ty - 20} L${C + 40} ${ty - 20} L${C + 40} ${ty + 30} L${C + 12} ${ty + 30} Z`}" fill="${sh}"/>`,
        `<path data-w="0.4" fill="none" stroke="${INK}" d="${P`M${C - nw - 6} ${ty - 4} Q${C} ${ty + 4} ${C + nw + 6} ${ty - 4}`}"/>`,
      );
    if (top.type === 'robe') {
      const k = tissu(top.col ?? 'craie');
      out.push(
        `<path d="${P`M${C} ${ty + 10} Q${C - 15} ${ty - 2} ${C - 37} ${ty + 4} Q${C - 39} ${ty + 24} ${C - 19} ${ty + 26} Q${C - 5} ${ty + 24} ${C} ${ty + 10} Z`}" fill="${k}"/>`,
        `<path d="${P`M${C} ${ty + 10} Q${C + 15} ${ty - 2} ${C + 37} ${ty + 4} Q${C + 39} ${ty + 24} ${C + 19} ${ty + 26} Q${C + 5} ${ty + 24} ${C} ${ty + 10} Z`}" fill="${shade(k)}"/>`,
      );
    }
  }
  return out;
}

/* ------------------------------------------------------------------------------------------ */
/* Assemblage                                                                                  */
/* ------------------------------------------------------------------------------------------ */

function compose(id, f) {
  const g = HEADS[f.tete];
  const b = BUILDS[f.corpulence];
  if (g === undefined || b === undefined) throw new Error(`${id}: tête ou corpulence inconnue`);
  const skin = SKINS[f.peau];
  const skinSh = skinShadow(f.peau);
  const dark = f.peau >= 5;
  const lip = dark ? LIP_DARK : LIP;
  const iris = col('iris', f.iris);
  const browC = poil(f.sourcils.couleur);
  const thick = f.sourcils.epais === true;
  const h = { ...f.cheveux, couleur: f.cheveux.couleur === null ? null : poil(f.cheveux.couleur) };
  const props = (f.accessoires ?? []).map((name) => {
    const p = PROPS[name];
    if (p === undefined) throw new Error(`${id}: accessoire inconnu ${name}`);
    return p(g, b, { skin, hair: h.couleur });
  });
  const { back, front } = h.couleur === null ? { back: [], front: [] } : hair(g, h);
  const s = g.s;
  const { eL, eR, ey, my } = g;
  const [earL, earR, earY] = g.ears;

  const base = [];
  base.push(...props.map((p) => p.back ?? '').filter(Boolean));
  base.push(...back);
  base.push(...bust(f, g, b, skin, skinSh));
  if (h.coupe !== 'carre')
    base.push(
      `<ellipse cx="${earL}" cy="${earY}" rx="10" ry="13" fill="${skin}"/>`,
      `<ellipse cx="${earR}" cy="${earY}" rx="10" ry="13" fill="${skinSh}"/>`,
    );
  base.push(
    `<path id="tete" d="${g.d}" fill="${skin}"/>`,
    `<path data-clip="tete" data-w="0" d="${g.shadow}" fill="${skinSh}"/>`,
  );
  // Rides: pattes d'oie et sillons (âgés), sillons seuls (âge mûr).
  if (f.age === 'age')
    base.push(
      `<path data-w="0.4" fill="none" stroke="${INK}" d="${P`M${eL - 13} ${ey + 2} l-6 -3 M${eL - 13} ${ey + 6} l-6 2 M${eR + 13} ${ey + 2} l6 -3 M${eR + 13} ${ey + 6} l6 2 M${C - 16} ${ey + 20} Q${C - 24} ${my - 4} ${C - 20} ${my + 6} M${C + 16} ${ey + 20} Q${C + 24} ${my - 4} ${C + 20} ${my + 6} M${eL - 4} ${ey + 12} Q${eL + 2} ${ey + 15} ${eL + 8} ${ey + 12} M${eR - 8} ${ey + 12} Q${eR - 2} ${ey + 15} ${eR + 4} ${ey + 12}`}"/>`,
    );
  else if (f.age === 'mur')
    base.push(
      `<path data-w="0.35" fill="none" stroke="${INK}" d="${P`M${C - 16} ${ey + 22} Q${C - 22} ${my - 4} ${C - 19} ${my + 4} M${C + 16} ${ey + 22} Q${C + 22} ${my - 4} ${C + 19} ${my + 4}`}"/>`,
    );
  if (f.joues === true)
    base.push(
      `<g data-w="0"><ellipse cx="${n(eL - 10)}" cy="${n(ey + 22)}" rx="10" ry="6" fill="${CHEEK}"/><ellipse cx="${n(eR + 10)}" cy="${n(ey + 22)}" rx="10" ry="6" fill="${CHEEK}"/></g>`,
    );
  if (f.pilosite === 'trois-jours')
    base.push(
      `<path data-w="0" d="${P`M${g.L + 4} ${ey + 14} Q${g.L + 8} ${g.chin - 6} ${C} ${g.chin} Q${g.R - 8} ${g.chin - 6} ${g.R - 4} ${ey + 14} Q${g.R - 18} ${my + 4} ${C} ${my + 10} Q${g.L + 18} ${my + 4} ${g.L + 4} ${ey + 14} Z`}" fill="${poil(f.cheveux.couleur ?? 'chatain')}" fill-opacity="0.22"/>`,
    );
  base.push(...props.map((p) => p.face ?? '').filter(Boolean));
  // Nez: un aplat d'ombre et un trait (bible, 2.4).
  const ny = ey + 8;
  const nz = { rond: 1, pointu: 1, fort: 1.3 }[f.nez] ?? 1;
  if (f.nez === 'pointu')
    base.push(
      `<path data-w="0" d="${P`M${C + 1} ${ny - 6} L${C + 9} ${ny + 14} Q${C + 2} ${ny + 18} ${C - 4} ${ny + 15} Z`}" fill="${skinSh}"/>`,
      `<path data-w="0.55" fill="none" stroke="${INK}" d="${P`M${C - 1} ${ny - 8} L${C - 8} ${ny + 14} Q${C - 2} ${ny + 18} ${C + 6} ${ny + 14}`}"/>`,
    );
  else
    base.push(
      `<path data-w="0" d="${P`M${C + 3 * nz} ${ny} Q${C + 13 * nz} ${ny + 6 * nz} ${C + 7 * nz} ${ny + 14 * nz} Q${C + 1} ${ny + 16 * nz} ${C - 3 * nz} ${ny + 12 * nz} Z`}" fill="${skinSh}"/>`,
      `<path data-w="0.55" fill="none" stroke="${INK}" d="${P`M${C - 3 * nz} ${ny - 4} Q${C - 9 * nz} ${ny + 10 * nz} ${C - 1} ${ny + 14 * nz} Q${C + 5 * nz} ${ny + 16 * nz} ${C + 9 * nz} ${ny + 11 * nz}`}"/>`,
    );
  if (f.pilosite === 'barbe') {
    const bc = h.couleur ?? poil('chatain');
    base.push(
      `<path id="barbe" d="${P`M${g.L + 1} ${ey + 4} Q${g.L + 2} ${g.chin - 4} ${C} ${g.chin + 16} Q${g.R - 2} ${g.chin - 4} ${g.R - 1} ${ey + 4} Q${g.R - 12} ${ey + 30} ${C + 22} ${my - 8} Q${C} ${my - 14} ${C - 22} ${my - 8} Q${g.L + 12} ${ey + 30} ${g.L + 1} ${ey + 4} Z`}" fill="${bc}"/>`,
      `<path data-clip="barbe" data-w="0" d="${P`M${C + 20} ${ey} Q${g.R + 4} ${ey + 40} ${C + 8} ${g.chin + 20} L${g.R + 20} ${g.chin + 20} L${g.R + 20} ${ey} Z`}" fill="${shade(bc)}"/>`,
    );
  }
  if (f.pilosite === 'barbe' || f.pilosite === 'moustache') {
    const mc = h.couleur ?? poil('chatain');
    base.push(
      `<path d="${P`M${C} ${my - 12} Q${C + 16} ${my - 17} ${C + 26} ${my - 4} Q${C + 12} ${my - 8} ${C} ${my - 5} Q${C - 12} ${my - 8} ${C - 26} ${my - 4} Q${C - 16} ${my - 17} ${C} ${my - 12} Z`}" fill="${mc}" data-w="0.6"/>`,
    );
  }
  base.push(...front);
  if (f.bonnet !== null && f.bonnet !== undefined)
    base.push(
      ...beanie(g, f.bonnet, h.couleur === null ? poil(f.sous_bonnet ?? 'noir') : h.couleur),
    );
  if (f.lunettes === 'rondes')
    base.push(
      `<g data-w="0.5" fill="none" stroke="${INK}"><circle cx="${eL}" cy="${n(ey + 1)}" r="13"/><circle cx="${eR}" cy="${n(ey + 1)}" r="13"/><path d="${P`M${eL + 13} ${ey - 1} Q${C} ${ey - 6} ${eR - 13} ${ey - 1} M${eL - 13} ${ey - 2} L${g.L + 1} ${ey - 6} M${eR + 13} ${ey - 2} L${g.R - 1} ${ey - 6}`}"/></g>`,
    );
  base.push(...props.map((p) => p.front ?? '').filter(Boolean));

  // Calques d'expression.
  const hidden = f.yeux === 'caches';
  const rest = MOUTHS[f.bouche] ?? MOUTHS.sourire;
  const cheeks = `<g data-w="0"><ellipse cx="${n(eL - 10)}" cy="${n(ey + 22)}" rx="9" ry="5.5" fill="${CHEEK}"/><ellipse cx="${n(eR + 10)}" cy="${n(ey + 22)}" rx="9" ry="5.5" fill="${CHEEK}"/></g>`;
  const B = (e, o) => brow(e, ey, s, browC, thick, o);
  const pair = (fn) => [fn(eL, 'g'), fn(eR, 'd')].join('\n    ');
  const layers = {
    neutre: [
      hidden
        ? ''
        : f.yeux === 'mi-clos'
          ? pair((e, k) => eyeSleepy(`n-oeil-${k}`, e, ey, s, iris))
          : pair((e, k) => eye(`n-oeil-${k}`, e, ey, s, iris)),
      hidden ? '' : pair((e) => B(e, f.yeux === 'mi-clos' ? { lift: -2 } : {})),
      `<g class="bouche">${rest(my, lip, 'n-bouche')}</g>`,
    ],
    content: [
      hidden
        ? ''
        : f.content === 'clin'
          ? `<path data-w="0.8" fill="none" stroke="${INK}" d="${eyeClosed(eL, ey, s)}"/>\n    ${eye('c-oeil-d', eR, ey, s, iris, { ry: 7.5 })}`
          : `<path data-w="0.8" fill="none" stroke="${INK}" d="${eyeClosed(eL, ey, s)} ${eyeClosed(eR, ey, s)}"/>`,
      hidden ? '' : pair((e) => B(e, { lift: 4, arch: 1 })),
      f.joues === true ? '' : cheeks,
      `<g class="bouche">${MOUTHS.rire(my, lip, 'c-rire')}</g>`,
    ],
    soucieux: [
      hidden
        ? ''
        : pair((e, k) => eye(`s-oeil-${k}`, e, ey, s, iris, { ry: 7.5, r: 4, dx: 2.5, dy: 2.5 })),
      hidden ? '' : pair((e) => B(e, { lift: 1, inner: 9 })),
      `<g class="bouche">${MOUTHS.pince(my)}</g>`,
      `<path d="${P`M${g.R - 8} ${ey - 10} Q${g.R - 2} ${ey} ${g.R - 6} ${ey + 4} Q${g.R - 12} ${ey + 2} ${g.R - 8} ${ey - 10} Z`}" fill="#A9C7D9" data-w="0.5"/>`,
    ],
    surpris: [
      hidden
        ? ''
        : pair((e, k) => eye(`u-oeil-${k}`, e, ey, s, iris, { rx: 9, ry: 9.5, r: 3.4, dy: 0 })),
      hidden ? '' : pair((e) => B(e, { lift: 7, arch: 4 })),
      `<g class="bouche">${MOUTHS.o(my, lip, 'u-bouche')}</g>`,
    ],
    fache: [
      hidden ? '' : pair((e, k) => eyeAngry(`f-oeil-${k}`, e, ey, s, iris)),
      hidden ? '' : pair((e) => B(e, { lift: -3, inner: -7 })),
      `<path data-w="0.45" fill="none" stroke="${INK}" d="${P`M${C - 4} ${ey - 8} L${C - 2} ${ey - 2} M${C + 4} ${ey - 8} L${C + 2} ${ey - 2}`}"/>`,
      `<g class="bouche">${MOUTHS.colere(my, lip, 'f-bouche')}</g>`,
    ],
  };
  const exprMarkup = Object.entries(layers)
    .map(
      ([name, parts]) =>
        `  <g data-expr="${name}">\n    ${parts.filter(Boolean).join('\n    ')}\n  </g>`,
    )
    .join('\n');
  const note = (f.note ?? '').replace(/--/g, '-');
  return `<!--
  Généré par generer-portraits.mjs depuis portraits/fiches.json: ne pas retoucher ce fichier.
  ${note}
  Calques d'expression: neutre, content, soucieux, surpris, fache.
-->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 190 230" data-trait="6" data-pas="1.1" data-tremble="0.45" data-halo="4">
  ${base.join('\n  ')}
${exprMarkup}
</svg>
`;
}

let count = 0;
for (const [id, raw] of Object.entries(fiches)) {
  if (id.startsWith('_')) continue;
  if (onlyIds !== undefined && !onlyIds.includes(id)) continue;
  const f = raw.comme === undefined ? raw : { ...fiches[raw.comme], ...raw, comme: undefined };
  writeFileSync(path.join(here, 'portraits', `${id}.svg`), compose(id, f));
  count += 1;
}
process.stdout.write(`portraits composés: ${String(count)}\n`);
