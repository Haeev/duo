'use strict';
// Contrôles de la palette de Cosy Café (bible artistique, sections 2, 3 et 7).
// Mesure chaque couleur (L* CIELAB, chroma, niveau de gris d'ImageMagick, écart CIEDE2000 aux six couleurs de joueur),
// vérifie les règles de la bible et écrit ../controles/mesures.json. Sort en erreur si une règle n'est pas tenue.
// Usage: node source/mesurer.cjs (depuis docs/jeux/cosy-cafe/bible)
const fs = require('fs');
const path = require('path');
const col = require('../../../../../design/identite/b/outils/couleur.cjs');
const players = require('../../../../../design/identite/b/joueurs.json').players;
const pal = require('./palette.cjs');

const VISIONS = ['normale', 'deuteranopie', 'protanopie', 'tritanopie'];
const round = (x, d = 1) => Math.round(x * 10 ** d) / 10 ** d;
const lch = (hex) => {
  const [L, a, b] = col.lab(hex);
  return { L: round(L), C: round(Math.hypot(a, b)), h: Math.round(((Math.atan2(b, a) * 180) / Math.PI + 360) % 360) };
};
const nearestPlayer = (hex, vision = 'normale') => {
  let best = { d: Infinity, id: '' };
  for (const p of players) {
    const d = col.deltaE00(col.simulate(hex, vision), col.simulate(p.color, vision));
    if (d < best.d) best = { d: round(d), id: p.id };
  }
  return best;
};

const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
};

// 1. toutes les couleurs à plat, avec leur famille
const all = [];
const push = (family, entry) => all.push({ family, ...entry });
pal.common.forEach((e) => push('commune', e));
pal.ui.forEach((e) => push('interface', e));
pal.topsLight.forEach((e) => push('joueurs', e));
pal.topsDark.forEach((e) => push('joueurs', e));
pal.house.forEach((e) => push('maison', e));
pal.staffShirts.forEach((e) => push('employés', e));
for (const [id, p] of Object.entries(pal.profiles)) p.colors.forEach((e) => push(`profil ${id}`, e));
for (const [id, a] of Object.entries(pal.addresses)) [...a.interior, ...a.exterior].forEach((e) => push(`adresse ${id}`, e));
for (const [id, s] of Object.entries(pal.styles)) s.colors.forEach((e) => push(`style ${id}`, e));

const porcelainL = lch('#F5F0E6').L;
const rows = all.map((e) => {
  const m = lch(e.hex);
  const near = nearestPlayer(e.hex);
  const sims = Object.fromEntries(VISIONS.slice(1).map((v) => [v, nearestPlayer(e.hex, v)]));
  return { ...e, ...m, gray: round(col.grayIm(e.hex)), nearestPlayer: near, nearestPlayerSimulated: sims };
});

// 2. règles par bande (bible, section 3)
const LIGHT_PLAY = ['porcelain', 'paper', 'milk'];
for (const r of rows) {
  const tag = `${r.family} ${r.id} ${r.hex}`;
  if (LIGHT_PLAY.includes(r.id)) check(r.L >= 88, `${tag}: objet de jeu clair sous L* 88 (${r.L})`);
  if (r.bande === 'travail') {
    check(r.L >= 20 && r.L <= 58, `${tag}: surface de travail hors de L* 20 à 58 (${r.L})`);
    check(porcelainL - r.L >= 35, `${tag}: écart de clarté avec la porcelaine sous 35 (${round(porcelainL - r.L)})`);
  }
  if (r.bande === 'decor') {
    check(r.L <= 82, `${tag}: décor au-dessus de L* 82 (${r.L})`);
    check(r.C <= 45, `${tag}: décor trop saturé, C* ${r.C} au-dessus de 45`);
  }
  if (r.bande === 'haut') check(r.L <= 90, `${tag}: décor haut au-dessus de L* 90 (${r.L})`);
  if (r.bande === 'tenue' && r.role !== 'accessoire') {
    check(r.L >= 28 && r.L <= 76, `${tag}: tenue hors de L* 28 à 76 (${r.L})`);
    check(r.C <= 45, `${tag}: tenue trop saturée, C* ${r.C}`);
  }
  if (r.bande === 'clair') check(r.L >= 87, `${tag}: haut clair sous L* 87 (${r.L})`);
  if (r.bande === 'sombre') check(r.L <= 26, `${tag}: haut sombre au-dessus de L* 26 (${r.L})`);
  if (r.bande === 'maison') check(r.L >= 25 && r.L <= 55, `${tag}: couleur de la maison hors de L* 25 à 55 (${r.L})`);
  // aucune couleur du monde ne doit se confondre avec une couleur de joueur en vision normale
  if (!['ui', 'lumiere', 'jeu'].includes(r.bande)) check(r.nearestPlayer.d >= 15, `${tag}: à ${r.nearestPlayer.d} de la couleur de joueur ${r.nearestPlayer.id} (seuil 15)`);
}

// 3. paires de joueurs: le plus clair des deux porte le haut sombre (bible, section 7.1)
const topLight = pal.topsLight[0].hex;
const topDark = pal.topsDark[0].hex;
const pairs = [];
for (let i = 0; i < players.length; i++) {
  for (let j = i + 1; j < players.length; j++) {
    const [a, b] = [players[i], players[j]];
    const [la, lb] = [lch(a.color).L, lch(b.color).L];
    const dark = la >= lb ? a : b;
    const light = dark === a ? b : a;
    const strapOnDark = round(lch(dark.color).L - lch(topDark).L);
    const strapOnLight = round(lch(topLight).L - lch(light.color).L);
    pairs.push({
      pair: `${a.id}/${b.id}`,
      darkTop: dark.id,
      lightTop: light.id,
      topGap: round(lch(topLight).L - lch(topDark).L),
      strapOnDarkTop: strapOnDark,
      strapOnLightTop: strapOnLight,
    });
    check(strapOnDark >= 25, `paire ${a.id}/${b.id}: bretelle ${dark.id} sur haut sombre, écart de clarté ${strapOnDark} sous 25`);
  }
}
// tous les hauts clairs contre tous les hauts sombres
let minTopGap = Infinity;
for (const l of pal.topsLight) for (const d of pal.topsDark) minTopGap = Math.min(minTopGap, lch(l.hex).L - lch(d.hex).L);
check(minTopGap >= 60, `écart de clarté entre haut clair et haut sombre sous 60 (${round(minTopGap)})`);

// 4. contrastes de l'interface et des interfaces dans le monde (WCAG 2.x)
const contrasts = [
  ['hud_text sur hud_bg', '#F6EEDF', '#2B211C', 7],
  ['hud_text_muted sur hud_bg', '#CDBBA6', '#2B211C', 4.5],
  ['hud_accent sur hud_bg', '#FFC857', '#2B211C', 4.5],
  ['hud_success sur hud_bg', '#6BD69A', '#2B211C', 4.5],
  ['hud_error sur hud_bg', '#FF6B81', '#2B211C', 4.5],
  ['hud_line sur hud_bg (décor)', '#5C4A3E', '#2B211C', 1.5],
  ['craie sur ardoise', '#F1EDE3', '#2F3634', 7],
  ['craie jaune sur ardoise', '#E9C98A', '#2F3634', 4.5],
  ['encre sur papier', '#2B2622', '#FBF6EA', 7],
  ['encre sur page du livre d\'or', '#2B2622', '#F2E8D2', 7],
  ['ambre foncé sur ambre', '#5A3A10', '#E0A030', 4.5],
  ['symbole --player-on sur mauve (pire couleur)', '#0E1126', '#8D6CFF', 4.5],
  ['liseré sombre sur haut clair', '#1C1A26', '#EEE6D6', 7],
];
const contrastRows = contrasts.map(([name, fg, bg, min]) => {
  const ratio = round(col.contrast(fg, bg), 2);
  check(ratio >= min, `${name}: ${ratio}:1 sous ${min}:1`);
  return { name, fg, bg, ratio, min };
});

// 5. objets de jeu sur leurs surfaces: écart de clarté (porcelaine sur chaque surface de travail)
const surfaces = rows.filter((r) => r.bande === 'travail').map((r) => ({ surface: `${r.id} ${r.hex}`, L: r.L, gapWithPorcelain: round(porcelainL - r.L) }));

const out = {
  generated: 'node source/mesurer.cjs',
  thresholds: { decorMaxL: 82, decorMaxC: 45, workSurfaceL: [20, 58], porcelainGap: 35, clothesL: [28, 76], lightTopMinL: 87, darkTopMaxL: 26, houseL: [25, 55], playerDeltaE: 15 },
  porcelainL,
  colors: rows.map((r) => ({ family: r.family, id: r.id, hex: r.hex, fr: r.fr, bande: r.bande, L: r.L, C: r.C, h: r.h, gray: r.gray, nearestPlayer: r.nearestPlayer, nearestPlayerSimulated: r.nearestPlayerSimulated })),
  pairs,
  minTopGap: round(minTopGap),
  contrasts: contrastRows,
  surfaces,
  failures,
};
fs.writeFileSync(path.join(__dirname, '..', 'controles', 'mesures.json'), JSON.stringify(out, null, 2) + '\n');

// résumé lisible
const worst = rows.filter((r) => !['ui', 'lumiere', 'jeu'].includes(r.bande)).sort((a, b) => a.nearestPlayer.d - b.nearestPlayer.d).slice(0, 6);
console.log(`${rows.length} couleurs mesurées; porcelaine L* ${porcelainL}`);
console.log('couleurs du monde les plus proches d\'une couleur de joueur (vision normale):');
for (const r of worst) console.log(`  ${r.id} ${r.hex}: ${r.nearestPlayer.d} (${r.nearestPlayer.id})`);
console.log(`écart de clarté minimal entre hauts clairs et sombres: ${round(minTopGap)}`);
console.log(`bretelles sur haut sombre, écart minimal: ${Math.min(...pairs.map((p) => p.strapOnDarkTop))}; sur haut clair, écart minimal: ${Math.min(...pairs.map((p) => p.strapOnLightTop))} (le liseré sombre prend le relais)`);
for (const c of contrastRows) console.log(`  ${c.name}: ${c.ratio}:1 (seuil ${c.min})`);
if (failures.length) {
  console.log(`\n${failures.length} RÈGLE(S) NON TENUE(S):`);
  for (const f of failures) console.log('  - ' + f);
  process.exit(1);
}
console.log('toutes les règles sont tenues');
