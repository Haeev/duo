'use strict';
// Contrôles chiffrés des trois palettes, lues dans le bloc « palette » de chaque planche HTML
// (même source que l'affichage, donc aucun écart possible entre planche et rapport).
// Usage: node controler.cjs  (sortie en Markdown, reprise dans docs/plateforme/identite-visuelle-pistes.md)
const fs = require('fs');
const path = require('path');

const PISTES = {
  a: { nom: 'A · Boîte à jeux', accentEnTexte: true },
  b: { nom: 'B · Étoile double', accentEnTexte: true },
  // En piste C, l'accent (surimpression) ne sert jamais de couleur de texte: aplats seulement.
  c: { nom: 'C · Deux encres', accentEnTexte: false },
};

// Machado, Oliveira et Fernandes (2009), sévérité 1, en RGB linéaire (mêmes matrices que rendre.cjs).
const DEUTERANOPIE = [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]];
const PROTANOPIE = [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]];

function lirePalette(fichier) {
  const html = fs.readFileSync(fichier, 'utf8');
  const bloc = html.match(/\/\* palette:debut[\s\S]*?\/\* palette:fin \*\//);
  if (!bloc) throw new Error(`bloc palette introuvable dans ${fichier}`);
  const palette = {};
  for (const [, nom, hex] of bloc[0].matchAll(/--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})\s*;/g)) palette[nom] = hex.toUpperCase();
  return palette;
}

const versRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const lineaire = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const encode = (c) => {
  const v = Math.min(Math.max(c, 0), 1);
  return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
};
const versHex = (rgb) => '#' + rgb.map((c) => Math.round(encode(c) * 255).toString(16).padStart(2, '0').toUpperCase()).join('');
function luminance(hex) {
  const [r, g, b] = versRgb(hex).map(lineaire);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contraste(a, b) {
  const [h, l] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (h + 0.05) / (l + 0.05);
}
const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
function lab(hex) {
  const [r, g, b] = versRgb(hex).map(lineaire);
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}
const clarte = (hex) => lab(hex)[0];
// Niveau de gris tel que le calcule « convert -colorspace Gray » (luma Rec. 709 sur valeurs encodées), en %.
const grisIm = (hex) => {
  const [r, g, b] = versRgb(hex);
  return 100 * (0.2126 * r + 0.7152 * g + 0.0722 * b);
};
function simuler(hex, m) {
  const v = versRgb(hex).map(lineaire);
  return versHex(m.map((ligne) => ligne[0] * v[0] + ligne[1] * v[1] + ligne[2] * v[2]));
}
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
function ecartE00(hexA, hexB) {
  const [L1, a1, b1] = lab(hexA);
  const [L2, a2, b2] = lab(hexB);
  const Cb = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const h1p = (deg(Math.atan2(b1, a1p)) + 360) % 360;
  const h2p = (deg(Math.atan2(b2, a2p)) + 360) % 360;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(rad(dhp / 2));
  const Lbp = (L1 + L2) / 2;
  const Cbp = (C1p + C2p) / 2;
  let hbp = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) <= 180) hbp = (h1p + h2p) / 2;
    else hbp = h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2;
  }
  const T = 1 - 0.17 * Math.cos(rad(hbp - 30)) + 0.24 * Math.cos(rad(2 * hbp)) + 0.32 * Math.cos(rad(3 * hbp + 6)) - 0.2 * Math.cos(rad(4 * hbp - 63));
  const dTh = 30 * Math.exp(-(((hbp - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2);
  const Sc = 1 + 0.045 * Cbp;
  const Sh = 1 + 0.015 * Cbp * T;
  const Rt = -Math.sin(rad(2 * dTh)) * Rc;
  return Math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh));
}

const fr = (n, d = 1) => n.toFixed(d).replace('.', ',');

function paires(p, accentEnTexte) {
  const liste = [
    ['texte', 'fond', 'texte'], ['texte', 'surface', 'texte'], ['texte', 'surface-2', 'texte'],
    ['texte-2', 'fond', 'texte'], ['texte-2', 'surface', 'texte'], ['texte-2', 'surface-2', 'texte'],
    ['sur-accent', 'accent', 'texte'],
    ['accent', 'fond', accentEnTexte ? 'texte' : 'composant'],
    ['succes', 'fond', 'texte'], ['succes', 'surface', 'texte'],
    ['erreur', 'fond', 'texte'], ['erreur', 'surface', 'texte'],
    ['sur-j1', 'j1', 'texte'], ['sur-j2', 'j2', 'texte'],
    ['j1', 'fond', 'composant'], ['j2', 'fond', 'composant'],
  ];
  return liste.filter(([a, b]) => p[a] && p[b]);
}

let echecs = 0;
for (const [id, { nom, accentEnTexte }] of Object.entries(PISTES)) {
  const p = lirePalette(path.join(__dirname, `piste-${id}.html`));
  console.log(`\n### ${nom}\n`);
  console.log('| Premier plan | Fond | Rapport | Seuil | Résultat |');
  console.log('|---|---|---|---|---|');
  for (const [a, b, type] of paires(p, accentEnTexte)) {
    const r = contraste(p[a], p[b]);
    const seuil = type === 'texte' ? 4.5 : 3;
    const ok = r >= seuil;
    let verdict = ok ? 'AA' : 'insuffisant';
    if (!ok && type === 'composant') verdict = 'sous 3:1, contour sombre obligatoire';
    else if (!ok) echecs += 1;
    console.log(`| ${a} \`${p[a]}\` | ${b} \`${p[b]}\` | ${fr(r, 2)}:1 | ${fr(seuil)}:1 (${type}) | ${verdict} |`);
  }
  const [j1, j2] = [p.j1, p.j2];
  console.log('\n| Joueurs | Joueur 1 | Joueur 2 | Écart de clarté L* | Écart ΔE2000 |');
  console.log('|---|---|---|---|---|');
  console.log(`| vision normale | \`${j1}\` (L* ${fr(clarte(j1))}) | \`${j2}\` (L* ${fr(clarte(j2))}) | ${fr(Math.abs(clarte(j1) - clarte(j2)))} | ${fr(ecartE00(j1, j2))} |`);
  console.log(`| niveaux de gris (ImageMagick) | ${fr(grisIm(j1), 0)} % | ${fr(grisIm(j2), 0)} % | ${fr(Math.abs(grisIm(j1) - grisIm(j2)), 0)} points | sans objet |`);
  for (const [libelle, m] of [['deutéranopie', DEUTERANOPIE], ['protanopie', PROTANOPIE]]) {
    const [s1, s2] = [simuler(j1, m), simuler(j2, m)];
    console.log(`| ${libelle} | \`${s1}\` (L* ${fr(clarte(s1))}) | \`${s2}\` (L* ${fr(clarte(s2))}) | ${fr(Math.abs(clarte(s1) - clarte(s2)))} | ${fr(ecartE00(s1, s2))} |`);
  }
  const voisins = [['succes', 'erreur'], ['accent', 'erreur'], ['accent', 'j1'], ['accent', 'j2'], ['erreur', 'j1'], ['erreur', 'j2']];
  console.log('\n| Couleurs voisines | ΔE2000 normal | ΔE2000 deutéranopie |');
  console.log('|---|---|---|');
  for (const [a, b] of voisins) {
    console.log(`| ${a} / ${b} | ${fr(ecartE00(p[a], p[b]))} | ${fr(ecartE00(simuler(p[a], DEUTERANOPIE), simuler(p[b], DEUTERANOPIE)))} |`);
  }
}
console.log(`\nCouleurs de texte sous le seuil AA: ${echecs}`);
process.exitCode = echecs > 0 ? 1 : 0;
