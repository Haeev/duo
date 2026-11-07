'use strict';
// Assemble les planches de la bible artistique de Cosy Café en SVG (docs/jeux/cosy-cafe/bible/)
// et écrit source/planches.json, que lit rendre.cjs pour les passer en PNG avec leurs contrôles.
// Usage: node source/planches.cjs (depuis docs/jeux/cosy-cafe/bible)
const fs = require('fs');
const path = require('path');
const P = require('./palette.cjs');
const AD = require('./adresses.cjs');
const F = require('./figures.cjs');
const M = require('./mobilier.cjs');
const { Camera, Scene, mixHex, shadeHex, r1 } = require('./scene3d.cjs');
const col = require('../../../../../design/identite/b/outils/couleur.cjs');
const players = require('../../../../../design/identite/b/joueurs.json').players;

const ROOT = path.join(__dirname, '..');
const J = "'Jost Variable', Jost, sans-serif";
const D = "'DM Sans Variable', 'DM Sans', sans-serif";
const K = "'Caveat Variable', Caveat, cursive";
const KA = 'Kalam, cursive';
const PH = "'Patrick Hand', cursive";
const BG = '#F3EBDD';
const INK = '#2B211C';
const MUTED = '#6B5A4C';
const LINE = '#D8CBB5';
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const Ls = (hex) => Math.round(col.lightness(hex));
const all = [...P.common, ...P.ui, ...P.house, ...P.topsLight, ...P.topsDark, ...P.staffShirts, ...Object.values(P.addresses).flatMap((a) => [...a.interior, ...a.exterior]), ...Object.values(P.styles).flatMap((s) => s.colors), ...Object.values(P.profiles).flatMap((p) => p.colors)];
const byId = (id) => {
  const e = all.find((x) => x.id === id);
  if (!e) throw new Error(`couleur inconnue: ${id}`);
  return e;
};

function text(x, y, t, o = {}) {
  return `<text x="${r1(x)}" y="${r1(y)}" font-family="${o.f || D}" font-size="${o.s || 18}" font-weight="${o.w || 400}" fill="${o.c || INK}"${o.a ? ` text-anchor="${o.a}"` : ''}${o.ls ? ` letter-spacing="${o.ls}"` : ''}>${esc(t)}</text>`;
}
// paragraphe coupé au nombre de caractères (approximation de la largeur moyenne de DM Sans)
function para(x, y, t, width, o = {}) {
  const size = o.s || 17;
  const max = Math.max(10, Math.floor(width / (size * (o.cw || 0.5))));
  const lines = [];
  let cur = '';
  for (const w of t.split(' ')) {
    if ((cur + ' ' + w).trim().length > max && cur) {
      lines.push(cur.trim());
      cur = w;
    } else cur += ' ' + w;
  }
  if (cur.trim()) lines.push(cur.trim());
  const lh = o.lh || Math.round(size * 1.38);
  return { svg: lines.map((l, i) => text(x, y + i * lh, l, o)).join(''), h: lines.length * lh };
}
function swatch(x, y, hex, name, o = {}) {
  const w = o.w || 34;
  return `<rect x="${x}" y="${y}" width="${w}" height="${w}" rx="6" fill="${hex}" stroke="${LINE}" stroke-width="1"/>` + text(x + w + 12, y + 15, name, { s: o.s || 16, w: 600 }) + text(x + w + 12, y + 33, `${hex}  (L* ${Ls(hex)})${o.note ? '  ' + o.note : ''}`, { s: 14, c: MUTED });
}
function title(x, y, t, o = {}) {
  return text(x, y, t, { f: J, s: o.s || 26, w: 500, c: o.c || INK });
}
function header(w, t, sub) {
  return text(40, 64, t, { f: J, s: 44, w: 500 }) + text(40, 98, sub, { s: 18, c: MUTED }) + `<path d="M40 116 H${w - 40}" stroke="${LINE}" stroke-width="2"/>`;
}
function svgDoc(w, h, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${BG}"/>${body}</svg>\n`;
}
function embed(inner, x, y, w, h, vw = 1366, vh = 768) {
  return `<svg x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}" viewBox="0 0 ${vw} ${vh}">${inner}</svg><rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}" fill="none" stroke="${INK}" stroke-width="2" rx="4"/>`;
}
// petite tasse dessinée à plat (pour les pastilles des surfaces)
function cupIcon(cx, cy, k = 1, rim = null) {
  const s = (v) => r1(v * k);
  return `<g transform="translate(${r1(cx)} ${r1(cy)})"><ellipse cx="0" cy="${s(14)}" rx="${s(30)}" ry="${s(8)}" fill="#F5F0E6" stroke="#2B2622" stroke-width="${s(1)}"/><path d="M${s(-20)} ${s(-12)} L${s(20)} ${s(-12)} L${s(15)} ${s(12)} Q0 ${s(17)} ${s(-15)} ${s(12)} Z" fill="#F5F0E6" stroke="#2B2622" stroke-width="${s(1)}"/><path d="M${s(20)} ${s(-6)} q${s(11)} ${s(2)} ${s(2)} ${s(12)}" stroke="#F5F0E6" stroke-width="${s(4)}" fill="none"/>${rim ? `<path d="M${s(-19.4)} ${s(-8)} L${s(19.4)} ${s(-8)}" stroke="${rim}" stroke-width="${s(3)}"/>` : ''}<ellipse cx="0" cy="${s(-12)}" rx="${s(20)}" ry="${s(5)}" fill="#3B2318"/><ellipse cx="0" cy="${s(-12)}" rx="${s(10)}" ry="${s(2.5)}" fill="#B57844"/></g>`;
}
function hourglass(cx, cy, k = 1, c = '#5A3A10') {
  return `<path transform="translate(${cx} ${cy}) scale(${k})" d="M-6 -9 H6 L0 0 L6 9 H-6 L0 0 Z" fill="${c}"/>`;
}
function token(id, cx, cy, size) {
  const p = F.PLAYER[id];
  return `<circle cx="${cx}" cy="${cy}" r="${size / 2}" fill="${p.color}" stroke="#1C1A26" stroke-width="2"/>` + F.symbol(id, cx, cy, size * 0.62);
}

const manifest = [];
const write = (rel, svg, entry) => {
  fs.mkdirSync(path.dirname(path.join(ROOT, rel)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, rel), svg);
  manifest.push({ svg: rel, png: rel.replace(/\.svg$/, '.png'), ...entry });
};

// ------------------------------------------------------------------------------------------------
// 1. Palette et rôles
function plancheP() {
  const W = 1920;
  const H = 1830;
  const b = [header(W, 'Cosy Café: palette et rôles', 'Source unique: source/palette.cjs. L* CIELAB entre parenthèses. Règles mesurées par source/mesurer.cjs (controles/mesures.json); contrôles visuels: controles/palette-controles.png.')];
  let y = 160;
  b.push(title(40, y, '1. Objets de jeu: ce qui se prend, se sert, se lit'));
  y += 22;
  const play = ['porcelain', 'paper', 'milk', 'ink', 'espresso', 'crema', 'chocolate', 'tea', 'crust', 'crumb', 'kraft', 'berry', 'citrus', 'glass'];
  play.forEach((id, i) => b.push(swatch(40 + (i % 3) * 300, y + Math.floor(i / 3) * 50, byId(id).hex, byId(id).fr)));
  y += 5 * 50 + 20;
  b.push(title(40, y, '2. Surfaces de travail: là où l\'on pose (porcelaine L* 95 dessus)'));
  y += 20;
  ['walnut', 'oak_dark', 'slate', 'zinc', 'marble_dark', 'tray'].forEach((id, i) => {
    const e = byId(id);
    const x = 40 + (i % 3) * 300;
    const yy = y + Math.floor(i / 3) * 132;
    b.push(`<rect x="${x}" y="${yy}" width="120" height="96" rx="8" fill="${e.hex}"/>` + cupIcon(x + 60, yy + 48, 1.1, '#2F4F3E'));
    b.push(text(x + 134, yy + 30, e.fr, { s: 16, w: 600 }) + text(x + 134, yy + 50, `${e.hex}  (L* ${Ls(e.hex)})`, { s: 14, c: MUTED }) + text(x + 134, yy + 72, `écart: ΔL* ${Math.round(col.lightness('#F5F0E6') - col.lightness(e.hex))}`, { s: 14, c: MUTED }));
  });
  y += 2 * 132 + 14;
  b.push(title(40, y, '3. Matières communes du décor (L* 82 au plus, C* 45 au plus)'));
  y += 22;
  ['oak_honey', 'plaster', 'linen', 'leaf', 'leaf_light', 'pot', 'copper', 'brass', 'steel', 'steel_dark', 'shadow_contact'].forEach((id, i) => b.push(swatch(40 + (i % 3) * 300, y + Math.floor(i / 3) * 50, byId(id).hex, byId(id).fr)));
  y += 4 * 50 + 16;
  b.push(title(40, y, '4. Lumière (couleurs de lumière, pas des matières)'));
  y += 22;
  ['lamp_warm', 'lamp_shade', 'sun_patch'].forEach((id, i) => b.push(swatch(40 + i * 300, y, byId(id).hex, byId(id).fr)));
  y += 74;
  b.push(title(40, y, '5. Alerte douce: toujours avec son pictogramme'));
  y += 20;
  b.push(`<rect x="40" y="${y}" width="200" height="120" rx="6" fill="#FBF6EA" stroke="${LINE}"/><rect x="40" y="${y}" width="200" height="34" rx="6" fill="#E0A030"/>` + hourglass(64, y + 17, 1) + text(84, y + 23, 'attend depuis 4 min', { s: 15, w: 600, c: '#3A2408' }) + `<path d="M58 ${y + 60} H190 M58 ${y + 82} H160 M58 ${y + 104} H175" stroke="#2B2622" stroke-width="3"/>`);
  b.push(para(262, y + 20, 'Ambre #E0A030 (L* 70) et ambre foncé #5A3A10 pour le pictogramme (4,5:1). Un ticket qui attend, un lait trop chaud, un stock bas. Jamais seule: en deutéranopie, l\'ambre approche le corail d\'un joueur; c\'est le sablier, le thermomètre ou le carton vide qui disent l\'alerte. Pas de rouge vif: rien n\'est grave dans ce jeu.', 640, { s: 15 }).svg);

  // colonne de droite
  let y2 = 160;
  const X2 = 1000;
  b.push(title(X2, y2, '6. Joueurs: couleur et symbole de Duo, haut clair ou sombre'));
  y2 += 26;
  players.forEach((p, i) => {
    const x = X2 + (i % 3) * 300;
    const yy = y2 + Math.floor(i / 3) * 66;
    b.push(token(p.id, x + 24, yy + 24, 48) + text(x + 58, yy + 20, p.label, { s: 16, w: 600 }) + text(x + 58, yy + 40, `${p.color}  (L* ${Ls(p.color)})`, { s: 14, c: MUTED }));
  });
  y2 += 2 * 66 + 10;
  P.topsLight.forEach((e, i) => b.push(swatch(X2 + i * 225, y2, e.hex, `haut ${e.fr}`, { s: 15 })));
  y2 += 50;
  P.topsDark.forEach((e, i) => b.push(swatch(X2 + i * 225, y2, e.hex, `haut ${e.fr}`, { s: 15 })));
  y2 += 50;
  b.push(swatch(X2, y2, P.playerPiping.hex, 'liseré sombre des bretelles, de l\'écusson et du bandeau'));
  y2 += 52;
  b.push(para(X2, y2, 'Règle de la paire: celui des deux dont la couleur de Duo est la plus claire porte un haut sombre, l\'autre un haut clair (écart de L* 68 au moins entre les deux hauts). Les deux se distinguent ainsi de dos par la clarté, la couleur et le symbole, pour les 15 paires possibles.', 880, { s: 15 }).svg);
  y2 += 70;
  // deux avatars de dos
  const av = (pl, top, x) => `<g transform="translate(${x} ${y2 + 200}) scale(1.05)">${F.person({ view: 'back', skin: '#CC9871', hair: '#4A3324', hairStyle: 'short', top, bottom: '#3A3A40', apron: { kind: 'player', color: F.PLAYER[pl].color, player: pl }, headscarf: pl })}</g>`;
  b.push(av('orb', '#2B2F45', X2 + 70) + av('crescent', '#EEE6D6', X2 + 190));
  b.push(para(X2 + 270, y2 + 34, 'Astre aqua (le plus clair des deux): haut sombre, bretelles aqua. Croissant mauve: haut clair, bretelles mauves bordées du liseré sombre, qui dessine le X même sur un haut clair.', 600, { s: 15 }).svg);
  y2 += 228;
  b.push(title(X2, y2, '7. Couleurs de la maison (choisies par le duo)'));
  y2 += 22;
  P.house.forEach((e, i) => {
    const x = X2 + (i % 4) * 225;
    const yy = y2 + Math.floor(i / 4) * 58;
    b.push(`<rect x="${x}" y="${yy}" width="34" height="34" rx="6" fill="${e.hex}"/>` + cupIcon(x + 70, yy + 18, 0.55, e.hex) + text(x + 102, yy + 15, e.fr, { s: 15, w: 600 }) + text(x + 102, yy + 33, `${e.hex} (L* ${Ls(e.hex)})`, { s: 13, c: MUTED }));
  });
  y2 += 2 * 58 + 4;
  b.push(para(X2, y2 + 6, 'Tabliers des employés, store, enseigne, couverture du livre d\'or, liseré des tasses. Toutes sombres et sourdes (L* 25 à 55): la vaisselle reste claire, les joueurs restent les seules couleurs vives.', 880, { s: 15 }).svg);
  y2 += 64;
  b.push(title(X2, y2, '8. Interface: le HUD et les interfaces dans le monde'));
  y2 += 20;
  // capsule du HUD
  b.push(`<rect x="${X2}" y="${y2}" width="410" height="48" rx="24" fill="#2B211C" stroke="#5C4A3E" stroke-width="1"/><rect x="${X2 + 14}" y="${y2 + 10}" width="88" height="28" rx="8" fill="none" stroke="#CDBBA6" stroke-width="2"/>` + text(X2 + 58, y2 + 30, 'clic gauche', { s: 14, w: 600, c: '#CDBBA6', a: 'middle' }) + text(X2 + 116, y2 + 30, 'mousser le lait', { s: 17, w: 600, c: '#F6EEDF' }) + `<circle cx="${X2 + 382}" cy="${y2 + 24}" r="6" fill="#FFC857"/>`);
  b.push(para(X2 + 430, y2 + 18, 'Capsule opaque expresso #2B211C, texte crème #F6EEDF (13,6:1), DM Sans et Jost comme Duo, or de Duo pour l\'action principale.', 450, { s: 14 }).svg);
  y2 += 66;
  // ardoise
  b.push(`<rect x="${X2}" y="${y2}" width="300" height="150" rx="6" fill="#6B4430"/><rect x="${X2 + 8}" y="${y2 + 8}" width="284" height="134" rx="3" fill="#2F3634"/>` + text(X2 + 150, y2 + 42, 'La carte du jour', { f: K, s: 30, w: 600, c: '#E9C98A', a: 'middle' }) + text(X2 + 22, y2 + 80, 'Cappuccino   3,20', { f: K, s: 26, w: 500, c: '#F1EDE3' }) + text(X2 + 22, y2 + 112, 'Tarte aux poires   4,50', { f: K, s: 26, w: 500, c: '#F1EDE3' }));
  // ticket
  const tx = X2 + 330;
  b.push(`<rect x="${tx}" y="${y2 + 12}" width="120" height="138" rx="3" fill="#FBF6EA" stroke="${LINE}"/><rect x="${tx + 40}" y="${y2}" width="40" height="30" rx="5" fill="${F.PLAYER.crescent.color}" stroke="#1C1A26" stroke-width="2"/>` + F.symbol('crescent', tx + 60, y2 + 15, 20) + text(tx + 12, y2 + 56, 'Table 3', { f: PH, s: 21, c: '#2B2622' }) + cupIcon(tx + 32, y2 + 92, 0.55) + text(tx + 58, y2 + 98, 'x 2', { f: PH, s: 22, c: '#2B2622' }) + text(tx + 12, y2 + 134, 'sans sucre', { f: PH, s: 18, c: '#2B2622' }));
  // livre d'or
  const gx = X2 + 480;
  b.push(`<rect x="${gx}" y="${y2}" width="400" height="150" rx="4" fill="#F2E8D2" stroke="${LINE}"/><path d="M${gx + 200} ${y2 + 6} V${y2 + 144}" stroke="#D8CBB5"/>` + text(gx + 16, y2 + 40, 'Le meilleur chocolat', { f: KA, s: 21, c: '#2B2622' }) + text(gx + 16, y2 + 70, 'du canton! Lucette', { f: KA, s: 21, c: '#2B2622' }) + text(gx + 214, y2 + 40, 'Pas trouvé de place', { f: K, s: 25, c: '#2F4F3E' }) + text(gx + 214, y2 + 70, 'pour m\'asseoir...', { f: K, s: 25, c: '#2F4F3E' }) + text(gx + 214, y2 + 112, 'Merci pour le thé', { f: PH, s: 21, c: '#6E2E35' }));
  y2 += 166;
  b.push(para(X2, y2, 'Ardoise: craie #F1EDE3 sur #2F3634 (10,6:1), Caveat. Tickets: Patrick Hand, pince à la couleur et au symbole du joueur. Livre d\'or: une main par client (Caveat, Kalam, Patrick Hand; trois polices OFL qui couvrent tout le français), lu en surimpression 2D.', 880, { s: 15 }).svg);

  // structure des valeurs (bas de page)
  let y3 = 1340;
  b.push(title(40, y3, '9. Structure des valeurs: L* de chaque famille (0 noir, 100 blanc)'));
  y3 += 24;
  const x0 = 260;
  const x1 = 1860;
  const X = (L) => x0 + ((x1 - x0) * L) / 100;
  const g = [];
  for (let L = 0; L <= 100; L += 10) g.push(`<path d="M${r1(X(L))} ${y3} V${y3 + 300}" stroke="${LINE}" stroke-width="1"/>` + text(X(L), y3 + 318, String(L), { s: 13, c: MUTED, a: 'middle' }));
  b.push(g.join(''));
  const rows = [
    ['objets de jeu clairs', ['porcelain', 'paper', 'milk'], [88, 100], '#F5F0E6'],
    ['contenus et encre', ['espresso', 'ink', 'chocolate'], [0, 27], '#3B2318'],
    ['hauts clairs des joueurs', P.topsLight.map((e) => e.id), [87, 100], '#EEE6D6'],
    ['hauts sombres des joueurs', P.topsDark.map((e) => e.id), [0, 26], '#2B2F45'],
    ['tenues des clients', Object.values(P.profiles).flatMap((p) => p.colors.filter((c2) => c2.role !== 'accessoire').map((c2) => c2.id)), [28, 76], '#A6927A'],
    ['décor', ['oak_honey', 'plaster', 'linen', 'leaf', 'pot', 'copper', 'village_lime', 'village_tomette', 'bourg_wall', 'bourg_parquet', 'ville_brick', 'ville_concrete', 'pq_mosaic', 'pm_parquet', 'pm_wall'], [30, 82], '#B3834F'],
    ['surfaces de travail', ['walnut', 'oak_dark', 'slate', 'zinc', 'marble_dark', 'tray'], [20, 58], '#5E4130'],
    ['couleurs de la maison', P.house.map((e) => e.id), [25, 55], '#6E2E35'],
  ];
  rows.forEach(([label, ids, band, c2], i) => {
    const yy = y3 + 10 + i * 36;
    b.push(text(40, yy + 18, label, { s: 15, w: 600 }));
    b.push(`<rect x="${r1(X(band[0]))}" y="${yy + 4}" width="${r1(X(band[1]) - X(band[0]))}" height="20" rx="10" fill="${c2}" fill-opacity="0.22" stroke="${c2}" stroke-opacity="0.6"/>`);
    for (const id of ids) {
      const h = byId(id).hex;
      b.push(`<circle cx="${r1(X(col.lightness(h)))}" cy="${yy + 14}" r="7" fill="${h}" stroke="#2B211C" stroke-width="1"/>`);
    }
  });
  b.push(para(40, y3 + 352, 'Ce qui se prend ou se sert est aux deux bouts de l\'échelle (porcelaine et papier très clairs, café et encre très sombres) et se pose sur une surface moyenne à sombre; le décor occupe le milieu sans jamais monter au clair des objets; les joueurs portent un haut aux extrémités, les clients restent au milieu.', 1820, { s: 16 }).svg);
  write('palette.svg', svgDoc(W, H, b.join('\n')), { width: W, height: H, montage: 'controles/palette-controles.png', montageLabel: 'Palette et rôles: vision normale, niveaux de gris, deutéranopie, protanopie', montageWidth: 1400 });
}

// ------------------------------------------------------------------------------------------------
// 2. Une planche par adresse
const ADDR = {
  village: {
    fn: AD.village,
    title: 'Le village: le café de la place du Tilleul',
    sub: 'Derrière le comptoir, près de la passe (plan village-arrivee), face à la place, en fin d\'après-midi. 1366 x 768, champ vertical de 60 degrés, yeux à 1,65 m.',
    a: 'afternoon',
    b: { view: 'b', moment: 'evening', caption: 'Près du point « entrée » du plan, le soir: l\'ardoise, la file, le comptoir côté clients.' },
    legend: [
      'Cloche à viennoiseries du boulanger, tasses prêtes: objets clairs sur le noyer sombre du comptoir.',
      'Rail à tickets au-dessus de la passe: pince à la couleur et au symbole du joueur qui prépare; bandeau ambre et sablier pour le ticket qui attend.',
      'La file vers la caisse, le long du mur: les clients qui attendent portent un liseré de lumière.',
      'Le partenaire de dos: bandeau noué, bretelles croisées, écusson au symbole. Haut sombre: l\'astre aqua est le plus clair des deux.',
      'Carte fermée posée sur la table, regard vers le comptoir: prêt à commander.',
      'La place par la vitrine: pierre blonde, volets gris-bleu, tilleul, fontaine, église au fond. Des valeurs moyennes qui ne volent pas la vedette.',
    ],
    light: 'Signature: le soleil rasant de fin d\'après-midi sur les tomettes, les lampes émaillées vert sombre au-dessus du comptoir. Plafond bas à solives: une salle qui enveloppe.',
    street: 'Rue: la place du Tilleul (arrêt du car, mairie-école à gauche, église en face, boulangerie à côté), pierre blonde et tuiles, un passant, le banc de la patronne sous la vitrine.',
  },
  bourg: {
    fn: AD.bourg,
    title: 'Le bourg: la boutique de la place de la Halle',
    sub: 'Depuis l\'entrée, face au comptoir (plan bourg-maximum), un matin de marché. Style de salle montré: nordique. 1366 x 768, 60 degrés, yeux à 1,65 m.',
    a: 'morning',
    b: { view: 'b', moment: 'afternoon', caption: 'Derrière le comptoir, face à la halle aux grains et aux étals du jeudi.' },
    legend: [
      'L\'ardoise du jour sur le lambris de l\'arrière-comptoir, face à la porte: lisible depuis la file (lettres de 5 cm et plus).',
      'Vitrine à gâteaux et machine sur le comptoir de frêne à dessus de noyer: la vaisselle claire s\'y détache.',
      'La partenaire de face: bavette à la couleur du joueur, poche au symbole, bandeau. Haut clair: le croissant mauve est le plus sombre des deux.',
      'La file le long du mur: promeneur sac au dos, gourmande; liseré des clients qui attendent.',
      'Porte du laboratoire entrouverte sur la lueur du four (le four est au laboratoire, pas en salle).',
      'Famille attablée, enfant, poussette; plateaux de linoléum vert sapin (jamais de plateau clair sous la vaisselle).',
    ],
    light: 'Signature: matin de marché, lumière fraîche par la devanture, globes de papier allumés, parquet chaud. Plus haut et plus clair que le village.',
    street: 'Rue: la place de la Halle et la halle aux grains en face (charpente, tuiles), étals du jeudi sous leurs toiles, façades ocre et rose, réverbère.',
  },
  ville: {
    fn: AD.ville,
    title: 'La ville: l\'ancien atelier',
    sub: 'Grande salle de l\'atelier (intention, à caler sur le plan du level designer), à midi. Style de salle montré: atelier. 1366 x 768, 60 degrés, yeux à 1,65 m.',
    a: 'noon',
    b: { view: 'a', moment: 'evening', caption: 'La même salle le soir: lampes cages, rue bleue, tramway éclairé.' },
    legend: [
      'Sheds: la lumière du nord tombe du toit, égale et claire.',
      'Ardoise du café de spécialité sur la brique, étagère tubulaire, bocaux de grains.',
      'Connaisseur au comptoir, carnet et sac de toile: il regarde les gestes (liseré: il attend).',
      'La partenaire de dos, haut clair: le liseré sombre dessine le X des bretelles.',
      'La rue de l\'université: tilleuls, tramway à la livrée inventée (bleu pétrole et crème), façades de brique.',
      'Grande table d\'atelier: étudiants au casque, télétravail à l\'ordinateur; coin salon de cuir au premier plan.',
    ],
    light: 'Signature: midi sous les sheds, lumière du nord sans ombres dures; murs de brique, sol de béton ciré, acier noirci.',
    street: 'Rue: tilleuls d\'alignement, tramway inventé, vélos garés, immeubles de brique et d\'enduit clair. Au-delà du trottoir, décor de fond (C18).',
  },
  'paris-quartier': {
    fn: AD.parisQuartier,
    title: 'Paris, le quartier: le café d\'angle',
    sub: 'Salle et vitrines de l\'angle (intention, à caler sur le plan), à l\'heure bleue. Style de salle montré: bistrot. 1366 x 768, 60 degrés, yeux à 1,65 m.',
    a: 'evening',
    b: { view: 'a', moment: 'afternoon', caption: 'La même salle en fin d\'après-midi: la pierre dorée en face, la terrasse au soleil.' },
    legend: [
      'Ardoise du soir au-dessus du miroir peint (aucun reflet calculé, C11).',
      'Comptoir de zinc et rampe de laiton: la vaisselle claire sur le zinc.',
      'Les pressés au comptoir: manteau, sacoche, gobelet (liseré: ils attendent).',
      'Le partenaire sort vers la terrasse avec un plateau.',
      'La terrasse et la rue à l\'heure bleue: chaises tournées vers la rue, réverbères, fenêtres allumées en face.',
      'Banquettes de moleskine sous les vitrines de l\'angle, à la couleur de la maison.',
    ],
    light: 'Signature: l\'heure bleue, le contraste le plus fort du jeu entre le dedans chaud et la rue bleue; globes opalins, laiton, boiseries sombres.',
    street: 'Rue: immeubles de pierre aux balcons filants, toits de zinc, kiosque à journaux inventé, platanes, réverbères. Aucune enseigne ni aucun monument réel.',
  },
  'paris-maison': {
    fn: AD.parisMaison,
    title: 'Paris, la maison: sous la verrière',
    sub: 'Grande halle sous verrière sur une cour (intention, variante « verrière » du cadrage), en hiver. Style de salle montré: jardin. 1366 x 768, 60 degrés, yeux à 1,65 m.',
    a: 'winter',
    b: { view: 'a', moment: 'afternoon', caption: 'La même halle en fin d\'après-midi: la lumière tombe de la verrière.' },
    legend: [
      'La verrière: résille de fer peint vert-de-gris, neige au bas des carreaux, ciel pâle.',
      'La mezzanine et son garde-corps; l\'escalier (marches de 17 x 28 cm) monte vers la façade, palier relié à la mezzanine.',
      'Le torréfacteur, pièce maîtresse: émail vert sombre, façade de cuivre, trémie, bac de refroidissement, conduit jusqu\'au toit.',
      'La partenaire de face, devant le torréfacteur.',
      'La cour pavée sous la neige, fenêtres allumées.',
      'Comptoir de marbre vert-gris sous la mezzanine: vitrine à gâteaux, caisse.',
    ],
    light: 'Signature: la lumière zénithale de la verrière, qui suit le ciel (pluie qui tambourine, neige au bas des vitres); de grands globes pour le soir.',
    street: 'Dehors: la cour pavée et ses deux arbres, les immeubles de pierre qui l\'entourent; à la fin du jeu, la fête des habitués s\'y tient.',
  },
};

function plancheAdresse(id) {
  const A = ADDR[id];
  const W = 1920;
  const H = 1430;
  const addr = P.addresses[id];
  const b = [header(W, A.title, A.sub)];
  const hero = A.fn(A.a, { markers: true });
  b.push(embed(hero, 40, 140, 1366, 768));
  // colonne des matières
  const X = 1440;
  let y = 160;
  b.push(title(X, y, 'Matières et couleurs, dedans', { s: 22 }));
  y += 18;
  for (const e of addr.interior) {
    b.push(swatch(X, y, e.hex, e.fr, { s: 15 }));
    y += 46;
  }
  y += 10;
  b.push(title(X, y, 'Dehors, par les vitrines', { s: 22 }));
  y += 18;
  for (const e of addr.exterior) {
    b.push(swatch(X, y, e.hex, e.fr, { s: 15 }));
    y += 46;
  }
  // légende des repères
  let ly = 950;
  b.push(title(40, ly, 'Ce qu\'il faut voir', { s: 22 }));
  ly += 30;
  A.legend.forEach((t, i) => {
    b.push(`<circle cx="56" cy="${ly - 6}" r="13" fill="#2B211C"/>` + text(56, ly, String(i + 1), { f: J, s: 16, w: 500, c: '#F6EEDF', a: 'middle' }));
    const p = para(80, ly, t, 640, { s: 15 });
    b.push(p.svg);
    ly += Math.max(30, p.h + 8);
  });
  // seconde vue
  const second = A.fn(A.b.moment, { view: A.b.view });
  b.push(embed(second, 760, 950, 683, 384));
  b.push(para(760, 1360, A.b.caption, 683, { s: 15, c: MUTED }).svg);
  const tx = 1470;
  let ty = 960;
  b.push(title(tx, ty, 'Lumière', { s: 22 }));
  const p1 = para(tx, ty + 28, A.light, 420, { s: 15 });
  b.push(p1.svg);
  ty += 40 + p1.h;
  b.push(title(tx, ty, 'La rue', { s: 22 }));
  b.push(para(tx, ty + 28, A.street, 420, { s: 15 }).svg);
  write(`adresse-${id}.svg`, svgDoc(W, H, b.join('\n')), { width: W, height: H, crops: [{ x: 40, y: 140, w: 1366, h: 768, png: `controles/${id}-vue.png`, gray: `controles/${id}-vue-gris.png`, temporary: true, ...(id === 'village' ? { montage: 'controles/village-vue-controles.png', montageLabel: 'Village, derrière le comptoir: vision normale, niveaux de gris, deutéranopie, protanopie' } : {}) }] });
}

// ------------------------------------------------------------------------------------------------
// 3. Les six moments, sur la vue du village
function plancheMoments() {
  const W = 1920;
  const H = 1250;
  const b = [header(W, 'Les moments de la journée et du temps', 'La même vue du village sous six lumières. La coque est cuite en trois états (matin, après-midi, soir) mêlés selon l\'heure; pluie et hiver sont des réglages de teinte, de taches de soleil et de lampes.')];
  const order = ['morning', 'noon', 'afternoon', 'evening', 'rain', 'winter'];
  order.forEach((mid, i) => {
    const m = P.moments[mid];
    const x = 40 + (i % 3) * 620;
    const y = 150 + Math.floor(i / 3) * 540;
    b.push(embed(AD.village(mid, {}), x, y, 600, 337.5));
    b.push(text(x, y + 372, `${m.fr[0].toUpperCase()}${m.fr.slice(1)}`, { f: J, s: 24, w: 500 }) + text(x + 600, y + 372, m.heures, { s: 15, c: MUTED, a: 'end' }));
    b.push(para(x, y + 400, m.mood, 600, { s: 15 }).svg);
    // pastilles: soleil, ciel, part des lampes
    const sy = y + 452;
    b.push(`<rect x="${x}" y="${sy}" width="28" height="28" rx="14" fill="${m.sun || '#3A4466'}" stroke="${LINE}"/>` + text(x + 36, sy + 19, m.sun ? `soleil ${m.sun}, ${m.sunElevation} degrés` : 'pas de soleil direct', { s: 14, c: MUTED }));
    b.push(`<rect x="${x + 300}" y="${sy}" width="28" height="28" rx="6" fill="${m.sky[0]}" stroke="${LINE}"/><rect x="${x + 330}" y="${sy}" width="28" height="28" rx="6" fill="${m.sky[1]}" stroke="${LINE}"/>` + text(x + 366, sy + 19, `ciel ${m.sky[0]}, ${m.sky[1]}`, { s: 14, c: MUTED }));
    b.push(`<rect x="${x}" y="${sy + 38}" width="200" height="10" rx="5" fill="${LINE}"/><rect x="${x}" y="${sy + 38}" width="${200 * m.lamps}" height="10" rx="5" fill="#FFC27A"/>` + text(x + 212, sy + 48, `lampes à ${Math.round(m.lamps * 100)} %`, { s: 14, c: MUTED }));
  });
  write('moments.svg', svgDoc(W, H, b.join('\n')), { width: W, height: H, montage: 'controles/moments-controles.png', montageLabel: 'Les six moments: vision normale, niveaux de gris, deutéranopie, protanopie', montageWidth: 1400 });
}

// ------------------------------------------------------------------------------------------------
// 4. Les six styles de décoration (élévations à l'échelle: 1 cm = 1,3 px)
const STYLE_TEXT = {
  campagne: { mat: 'Chêne miel, lin écru, terre cuite, paille, faïence.', key: 'Vaisselier peint en sauge, table de ferme, chaises paillées, suspension d\'osier.', soul: 'La cuisine d\'une maison de famille.' },
  bistrot: { mat: 'Bois sombre, moleskine bordeaux, laiton, zinc, carreaux noir et crème, marbre vert-gris.', key: 'Banquette capitonnée sous un grand miroir peint, guéridons, chaises cintrées, globes opalins.', soul: 'Le café de quartier d\'autrefois.' },
  nordique: { mat: 'Frêne miel, laine grise, blanc cassé, bleu gris, rose poudré, vert sapin.', key: 'Poêle à bois et son conduit, banc à coussins et plaid, suspension à lamelles, plateaux de linoléum.', soul: 'La chaleur dans la simplicité.' },
  jardin: { mat: 'Rotin, vert feuille, vert d\'eau, terre cuite, fer peint, carreaux de ciment.', key: 'Fauteuils de rotin, grand olivier en pot, treillage, suspensions-cloches de verre.', soul: 'Un jardin d\'hiver.' },
  atelier: { mat: 'Acier, brique, bois brut, béton, cuir, bleu de travail.', key: 'Établi devenu comptoir, étagère tubulaire, lampes cages, horloge d\'atelier.', soul: 'Le lieu où l\'on fabrique.' },
  retro: { mat: 'Teck, formica moutarde, orange brûlé, brun chocolat, crème, olive, bleu pétrole.', key: 'Enfilade de teck et tourne-disque, chaises coques, tables de formica orange cerclées de chrome, lampes champignons.', soul: 'Le salon des années soixante-dix.' },
};
function styleDrawing(id) {
  const c = (cid) => P.styles[id].colors.find((e) => e.id === `${id}_${cid}`).hex;
  const dk = (h, k = 0.8) => shadeHex(h, k);
  const g = [];
  const cupTop = (x, y) => cupIcon(x, y - 10, 0.45);
  // sol, plinthe
  g.push(`<path d="M0 0 H560" stroke="${INK}" stroke-width="2"/>`);
  if (id === 'campagne') {
    const oak = c('oak');
    // vaisselier
    g.push(`<rect x="12" y="-230" width="150" height="230" rx="6" fill="${c('sage')}"/><rect x="18" y="-120" width="138" height="8" fill="${dk(c('sage'))}"/><rect x="22" y="-224" width="130" height="96" fill="${dk(c('sage'), 0.7)}"/>`);
    for (let i = 0; i < 4; i++) g.push(`<circle cx="${40 + i * 32}" cy="-195" r="13" fill="#F5F0E6" stroke="${c('faience')}" stroke-width="3"/>`);
    for (let i = 0; i < 4; i++) g.push(cupIcon(40 + i * 32, -148, 0.32));
    g.push(`<rect x="22" y="-104" width="62" height="96" rx="3" fill="${dk(c('sage'), 0.9)}"/><rect x="90" y="-104" width="62" height="96" rx="3" fill="${dk(c('sage'), 0.9)}"/>`);
    // table de ferme et chaise paillée
    g.push(`<rect x="200" y="-98" width="180" height="10" rx="3" fill="${oak}"/><rect x="210" y="-88" width="12" height="88" fill="${dk(oak)}"/><rect x="358" y="-88" width="12" height="88" fill="${dk(oak)}"/>`);
    g.push(cupTop(250, -98) + cupTop(320, -98));
    g.push(`<rect x="400" y="-60" width="12" height="60" fill="${oak}"/><rect x="452" y="-60" width="12" height="60" fill="${oak}"/><rect x="398" y="-64" width="68" height="8" rx="2" fill="${c('straw')}"/><path d="M402 -62 L462 -58 M404 -58 L460 -62" stroke="${dk(c('straw'))}" stroke-width="2"/><rect x="452" y="-128" width="12" height="70" fill="${oak}"/>`);
    for (const yy of [-120, -104, -88]) g.push(`<rect x="446" y="${yy}" width="20" height="6" rx="2" fill="${oak}"/>`);
    // suspension d'osier
    g.push(`<path d="M300 -330 V-262" stroke="${INK}" stroke-width="2"/><path d="M262 -236 Q300 -290 338 -236 Z" fill="${c('straw')}"/><path d="M270 -246 H330 M278 -258 H322" stroke="${dk(c('straw'))}" stroke-width="2"/><ellipse cx="300" cy="-236" rx="38" ry="6" fill="#FFE0B0"/>`);
    g.push(`<rect x="480" y="-40" width="60" height="40" rx="4" fill="${c('clay')}"/><circle cx="510" cy="-62" r="26" fill="#5D7D47"/><circle cx="500" cy="-74" r="14" fill="#8A9C5E"/>`);
  } else if (id === 'bistrot') {
    const wood = c('wood');
    g.push(`<rect x="10" y="-250" width="200" height="130" rx="4" fill="${c('brass')}"/><rect x="18" y="-242" width="184" height="114" rx="2" fill="#8E9A9C"/><path d="M40 -238 L90 -132 M120 -238 L150 -170" stroke="#FFFFFF" stroke-opacity="0.35" stroke-width="10"/>`);
    g.push(`<rect x="10" y="-110" width="200" height="60" rx="10" fill="${c('moleskine')}"/><rect x="10" y="-52" width="200" height="16" rx="6" fill="${dk(c('moleskine'))}"/><rect x="14" y="-36" width="192" height="36" fill="${wood}"/>`);
    for (let i = 0; i < 4; i++) g.push(`<circle cx="${40 + i * 46}" cy="-80" r="4" fill="${dk(c('moleskine'), 0.6)}"/>`);
    // guéridon de marbre et chaise cintrée
    g.push(`<ellipse cx="320" cy="-92" rx="60" ry="8" fill="${c('marble')}"/><rect x="314" y="-88" width="12" height="80" fill="#2B3230"/><path d="M286 0 Q320 -14 354 0 Z" fill="#2B3230"/>` + cupTop(305, -94) + cupTop(338, -94));
    g.push(`<path d="M420 0 L428 -62 M470 0 L462 -62" stroke="${wood}" stroke-width="7" stroke-linecap="round"/><ellipse cx="445" cy="-64" rx="34" ry="7" fill="${c('brass')}"/><path d="M420 -66 Q414 -140 445 -144 Q476 -140 470 -66" stroke="${wood}" stroke-width="7" fill="none"/><path d="M432 -120 Q445 -130 458 -120" stroke="${wood}" stroke-width="5" fill="none"/>`);
    g.push(`<path d="M320 -330 V-200" stroke="${c('brass')}" stroke-width="3"/><circle cx="320" cy="-182" r="22" fill="#FFE7C2"/><rect x="312" y="-206" width="16" height="8" fill="${c('brass')}"/>`);
    // carrelage en damier au sol
    for (let i = 0; i < 14; i++) g.push(`<rect x="${i * 40}" y="2" width="40" height="10" fill="${i % 2 ? c('tile_dark') : c('tile_light')}"/>`);
  } else if (id === 'nordique') {
    const ash = c('ash');
    // poêle et conduit jusqu'au plafond
    g.push(`<path d="M80 -330 V-170" stroke="#2E2E33" stroke-width="16"/><rect x="40" y="-172" width="80" height="140" rx="16" fill="#2E2E33"/><rect x="56" y="-130" width="48" height="40" rx="6" fill="#FF9A4A"/><rect x="48" y="-32" width="10" height="32" fill="#2E2E33"/><rect x="102" y="-32" width="10" height="32" fill="#2E2E33"/>`);
    // banc à coussins et plaid
    g.push(`<rect x="150" y="-50" width="150" height="12" rx="4" fill="${ash}"/><rect x="156" y="-38" width="10" height="38" fill="${dk(ash)}"/><rect x="284" y="-38" width="10" height="38" fill="${dk(ash)}"/><rect x="156" y="-74" width="64" height="26" rx="10" fill="${c('wool')}"/><rect x="226" y="-74" width="64" height="26" rx="10" fill="${c('rose')}"/><path d="M262 -50 L270 -10 L286 -12 L280 -50 Z" fill="${c('blue')}"/>`);
    // table au plateau de linoléum et chaise
    g.push(`<rect x="330" y="-98" width="130" height="10" rx="3" fill="${c('fir')}"/><rect x="340" y="-88" width="8" height="88" fill="${ash}"/><rect x="442" y="-88" width="8" height="88" fill="${ash}"/>` + cupTop(370, -98) + cupTop(420, -98));
    g.push(`<rect x="480" y="-60" width="8" height="60" fill="${ash}"/><rect x="526" y="-60" width="8" height="60" fill="${ash}"/><rect x="476" y="-66" width="62" height="10" rx="4" fill="${c('wool')}"/><path d="M530 -66 Q544 -110 532 -126" stroke="${ash}" stroke-width="8" fill="none" stroke-linecap="round"/>`);
    // suspension à lamelles
    g.push(`<path d="M395 -330 V-260" stroke="${INK}" stroke-width="2"/>`);
    for (let i = 0; i < 5; i++) g.push(`<ellipse cx="395" cy="${-256 + i * 9}" rx="${18 + i * 6}" ry="4" fill="${ash}"/>`);
    g.push(`<ellipse cx="395" cy="-212" rx="36" ry="5" fill="#FFE0B0"/>`);
  } else if (id === 'jardin') {
    // treillage et olivier
    g.push(`<path d="M10 -300 L130 -300 L130 0 M10 -300 V0" stroke="${c('iron')}" stroke-width="3" fill="none"/>`);
    for (let i = 1; i < 6; i++) g.push(`<path d="M10 ${-50 * i} L130 ${-50 * i + 50} M10 ${-50 * i + 50} L130 ${-50 * i}" stroke="${c('iron')}" stroke-width="2"/>`);
    g.push(`<path d="M160 0 L170 -60 L230 -60 L240 0 Z" fill="${c('pot')}"/><path d="M200 -60 Q196 -150 206 -200" stroke="#7A6A58" stroke-width="8" fill="none"/>`);
    for (const [x, y, r] of [[200, -220, 40], [170, -190, 28], [232, -186, 30], [204, -258, 26]]) g.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${mixHex(c('leaf'), '#A9B88A', 0.4)}"/>`);
    // fauteuil de rotin
    g.push(`<path d="M270 0 L276 -50 L350 -50 L356 0" stroke="${dk(c('rattan'))}" stroke-width="6" fill="none"/><rect x="266" y="-60" width="94" height="14" rx="6" fill="${c('water')}"/><path d="M268 -58 Q262 -150 313 -154 Q364 -150 358 -58 Z" fill="${c('rattan')}"/><path d="M280 -130 Q313 -146 346 -130 M276 -100 Q313 -116 350 -100" stroke="${dk(c('rattan'))}" stroke-width="2" fill="none"/>`);
    // table de fer peint et cloche de verre
    g.push(`<ellipse cx="450" cy="-92" rx="52" ry="7" fill="${c('iron')}"/><path d="M450 -86 V-10 M450 -10 Q430 -6 422 0 M450 -10 Q470 -6 478 0" stroke="${c('iron')}" stroke-width="6" fill="none"/>` + cupTop(436, -92) + cupTop(466, -92));
    g.push(`<path d="M450 -330 V-250" stroke="${INK}" stroke-width="2"/><path d="M426 -214 Q426 -252 450 -252 Q474 -252 474 -214 Z" fill="#DCE6E4" fill-opacity="0.7" stroke="#9FB3AF"/><circle cx="450" cy="-222" r="8" fill="#FFE0B0"/>`);
    for (let i = 0; i < 14; i++) g.push(`<rect x="${i * 40}" y="2" width="40" height="10" fill="${i % 2 ? c('tile') : mixHex(c('tile'), c('pot'), 0.35)}"/>`);
  } else if (id === 'atelier') {
    // étagère tubulaire
    g.push(`<path d="M20 0 V-280 M150 0 V-280" stroke="${c('steel')}" stroke-width="6"/>`);
    for (const y of [-70, -150, -230]) g.push(`<rect x="14" y="${y}" width="142" height="9" fill="${c('wood')}"/>`);
    for (let i = 0; i < 4; i++) g.push(`<rect x="${30 + i * 30}" y="-178" width="20" height="28" rx="4" fill="#C9D6D3" fill-opacity="0.85"/><rect x="${32 + i * 30}" y="-168" width="16" height="16" fill="#3B2318"/>`);
    for (let i = 0; i < 4; i++) g.push(cupIcon(40 + i * 30, -86, 0.3));
    // horloge d'atelier
    g.push(`<circle cx="85" cy="-300" r="26" fill="#F1EDE3" stroke="${c('steel')}" stroke-width="6"/><path d="M85 -300 V-318 M85 -300 H98" stroke="${INK}" stroke-width="3"/>`);
    // établi devenu comptoir
    g.push(`<rect x="190" y="-110" width="210" height="16" rx="2" fill="${c('wood')}"/><rect x="198" y="-94" width="12" height="94" fill="${c('steel')}"/><rect x="380" y="-94" width="12" height="94" fill="${c('steel')}"/><rect x="214" y="-90" width="80" height="34" fill="${dk(c('wood'))}"/><rect x="298" y="-90" width="78" height="34" fill="${dk(c('wood'))}"/><rect x="246" y="-76" width="16" height="5" fill="${c('steel')}"/><rect x="330" y="-76" width="16" height="5" fill="${c('steel')}"/>` + cupTop(240, -110) + cupTop(350, -110));
    // tabouret et lampe cage
    g.push(`<path d="M432 0 L440 -72 M488 0 L480 -72" stroke="${c('steel')}" stroke-width="6"/><ellipse cx="460" cy="-74" rx="30" ry="7" fill="${c('leather')}"/>`);
    g.push(`<path d="M300 -330 V-232" stroke="${INK}" stroke-width="2"/><path d="M286 -230 H314 L318 -196 H282 Z" fill="none" stroke="${c('steel')}" stroke-width="3"/><circle cx="300" cy="-208" r="9" fill="#FFC874"/>`);
    g.push(`<rect x="0" y="2" width="560" height="10" fill="${c('concrete')}"/>`);
  } else if (id === 'retro') {
    // enfilade de teck et tourne-disque
    g.push(`<rect x="10" y="-96" width="220" height="70" rx="6" fill="${c('teak')}"/><rect x="18" y="-88" width="66" height="54" rx="3" fill="${dk(c('teak'), 0.85)}"/><rect x="88" y="-88" width="66" height="54" rx="3" fill="${dk(c('teak'), 0.85)}"/><rect x="158" y="-88" width="64" height="54" rx="3" fill="${c('orange')}"/><path d="M30 -26 L24 0 M210 -26 L216 0" stroke="${c('brown')}" stroke-width="6"/>`);
    g.push(`<rect x="40" y="-116" width="90" height="20" rx="4" fill="${c('cream')}"/><ellipse cx="80" cy="-118" rx="30" ry="5" fill="#2E2E33"/><circle cx="80" cy="-118" r="4" fill="${c('orange')}"/>`);
    g.push(`<path d="M190 -96 V-150" stroke="${c('brown')}" stroke-width="4"/><path d="M162 -150 Q190 -190 218 -150 Z" fill="${c('mustard')}"/>`);
    // table de formica et chaise coque
    // plateau de formica orange brûlé (L* 50): la moutarde (L* 66) reste aux chaises, aux portes et aux lampes, jamais sous la vaisselle
    g.push(`<rect x="270" y="-100" width="150" height="12" rx="6" fill="${c('orange')}"/><rect x="270" y="-90" width="150" height="3" fill="#C9CDD1"/><path d="M345 -88 V-6 M320 0 H370" stroke="#C9CDD1" stroke-width="7"/>` + cupTop(310, -100) + cupTop(380, -100));
    g.push(`<path d="M452 0 L462 -56 M512 0 L502 -56" stroke="#C9CDD1" stroke-width="5"/><path d="M446 -60 Q446 -130 482 -134 Q520 -130 518 -60 Q482 -50 446 -60 Z" fill="${c('petrol')}"/>`);
    g.push(`<path d="M345 -330 V-236" stroke="${INK}" stroke-width="2"/><path d="M318 -206 Q345 -248 372 -206 Z" fill="${c('mustard')}"/><ellipse cx="345" cy="-206" rx="27" ry="5" fill="#FFE0B0"/>`);
    for (let i = 0; i < 14; i++) g.push(`<circle cx="${20 + i * 40}" cy="7" r="5" fill="${c('olive')}" fill-opacity="0.6"/>`);
  }
  return g.join('');
}
function plancheStyles() {
  const W = 1920;
  const H = 1620;
  const b = [header(W, 'Les six styles de décoration', 'Élévations à l\'échelle (1 cm = 1,3 px), tasses comprises. Chaque style a ses matières, ses couleurs et ses pièces maîtresses; la roue dit ce qui s\'accorde.')];
  const ids = ['campagne', 'bistrot', 'nordique', 'jardin', 'atelier', 'retro'];
  ids.forEach((id, i) => {
    const x = 40 + (i % 3) * 620;
    const y = 150 + Math.floor(i / 3) * 560;
    const st = P.styles[id];
    b.push(`<rect x="${x}" y="${y}" width="600" height="540" rx="14" fill="#FBF6EA" stroke="${LINE}" stroke-width="2"/>`);
    b.push(text(x + 20, y + 42, st.fr[0].toUpperCase() + st.fr.slice(1), { f: J, s: 30, w: 500 }) + text(x + 580, y + 42, `« ${STYLE_TEXT[id].soul} »`, { s: 15, c: MUTED, a: 'end' }));
    b.push(`<g transform="translate(${x + 20} ${y + 400}) scale(1)">${styleDrawing(id)}</g>`);
    st.colors.forEach((e, k) => {
      const sx = x + 20 + k * 82;
      b.push(`<rect x="${sx}" y="${y + 420}" width="70" height="34" rx="6" fill="${e.hex}" stroke="${LINE}"/>` + text(sx, y + 472, e.fr.length > 12 ? e.fr.slice(0, 12) + '.' : e.fr, { s: 12, c: MUTED }) + text(sx, y + 486, `L* ${Ls(e.hex)}`, { s: 12, c: MUTED }));
    });
    b.push(para(x + 20, y + 508, `Pièces maîtresses: ${STYLE_TEXT[id].key}`, 560, { s: 13, lh: 17 }).svg);
  });
  // roue des styles
  const cx = 300;
  const cy = 1430;
  const R = 130;
  const wheel = ['campagne', 'jardin', 'nordique', 'retro', 'bistrot', 'atelier'];
  const pos = wheel.map((_, i) => [cx + R * Math.cos((i / 6) * Math.PI * 2 - Math.PI / 2), cy + R * Math.sin((i / 6) * Math.PI * 2 - Math.PI / 2)]);
  const links = ['osier, terre cuite', 'végétal, lumière', 'bois blond, lignes simples', 'laiton, chrome, nostalgie', 'métal, bois sombre', 'bois brut, objets de métier'];
  b.push(title(40, 1290, 'Roue des styles', { s: 24 }));
  for (let i = 0; i < 3; i++) b.push(`<path d="M${r1(pos[i][0])} ${r1(pos[i][1])} L${r1(pos[i + 3][0])} ${r1(pos[i + 3][1])}" stroke="#B0574D" stroke-width="2.5" stroke-dasharray="8 7"/>`);
  for (let i = 0; i < 6; i++) {
    const j = (i + 1) % 6;
    b.push(`<path d="M${r1(pos[i][0])} ${r1(pos[i][1])} L${r1(pos[j][0])} ${r1(pos[j][1])}" stroke="#2F4F3E" stroke-width="5"/>`);
  }
  wheel.forEach((id, i) => {
    const [x, y] = pos[i];
    const main = P.styles[id].colors[0].hex;
    b.push(`<circle cx="${r1(x)}" cy="${r1(y)}" r="44" fill="${main}" stroke="${INK}" stroke-width="2"/>` + text(x, y + 6, P.styles[id].fr, { f: J, s: 17, w: 500, a: 'middle', c: Ls(main) > 55 ? INK : '#F6EEDF' }));
  });
  const tx = 560;
  b.push(text(tx, 1330, 'Voisins sur la roue: ils s\'accordent (trait plein), par une matière partagée:', { s: 17, w: 600 }));
  links.forEach((l, i) => b.push(text(tx, 1362 + i * 26, `${P.styles[wheel[i]].fr} et ${P.styles[wheel[(i + 1) % 6]].fr}: ${l}`, { s: 16 })));
  b.push(text(tx + 640, 1330, 'En face sur la roue: ils se heurtent (tirets):', { s: 17, w: 600 }));
  [['campagne', 'rétro', 'le rustique contre le formica et le chrome'], ['jardin', 'bistrot', 'l\'air et le végétal contre le sombre et le poli'], ['nordique', 'atelier', 'le doux et clair contre le brut et sombre']].forEach(([a, c2, why], i) => b.push(text(tx + 640, 1362 + i * 26, `${a} et ${c2}: ${why}`, { s: 16 })));
  b.push(para(tx + 640, 1460, 'Les autres paires se côtoient sans s\'aider. Un ensemble cohérent (un style, ou deux voisins) vaut mieux qu\'un entassement; la règle de jeu reste au game designer.', 640, { s: 15 }).svg);
  write('styles.svg', svgDoc(W, H, b.join('\n')), { width: W, height: H, montage: 'controles/styles-controles.png', montageLabel: 'Les six styles: vision normale, niveaux de gris, deutéranopie, protanopie', montageWidth: 1400 });
}

// ------------------------------------------------------------------------------------------------
// 5. Silhouettes: profils, avatars, employés, habitués, humeurs, les 15 paires de dos
const PROFILE_SPECS = [
  ['presses', 'les pressés', 'manteau droit, sacoche, gobelet', { coat: '#3E4A66', coatLength: 60, top: '#3E4A66', bottom: '#4E5258', skin: '#E4B897', hair: '#2B2320', hairStyle: 'short', acc: ['shoulderBag', 'takeaway'], expr: 'impatient' }],
  ['flaneurs', 'les flâneurs', 'écharpe, journal, mains dans les poches', { top: '#7A5A44', bottom: '#4E5258', skin: '#87583A', hair: '#B9B4AE', hairStyle: 'short', acc: ['scarf', 'newspaper'], pose: 'pockets', expr: 'content' }],
  ['familles', 'les familles', 'un adulte, un enfant, une poussette', { top: '#7E9CC0', bottom: '#4D5F7D', skin: '#AD7852', hair: '#2B2320', hairStyle: 'curly', expr: 'ravi' }],
  ['gourmands', 'les gourmands', 'boîte à gâteaux nouée', { top: '#9E4E63', bottom: '#4E5258', skin: '#F2D3BC', hair: '#A3663A', hairStyle: 'bob', acc: ['cakeBox'], expr: 'ravi' }],
  ['promeneurs', 'les promeneurs', 'sac à dos, casquette', { top: '#3F5E4A', bottom: '#8A8463', skin: '#CC9871', hair: '#4A3324', hairStyle: 'short', acc: ['backpack', 'cap'], expr: 'content' }],
  ['etudiants', 'les étudiants', 'casque au cou, sac de toile', { top: '#6E3238', bottom: '#4D5F7D', skin: '#5C3C29', hair: '#2B2320', hairStyle: 'bun', acc: ['headset', 'tote'], expr: 'content' }],
  ['teletravail', 'le télétravail', 'ordinateur sous le bras, gilet ouvert', { top: '#A6B6C8', bottom: '#4E5258', skin: '#E4B897', hair: '#6E4A30', hairStyle: 'long', acc: ['laptop', { kind: 'cardigan', color: '#8E8B86' }], expr: 'neutre' }],
  ['brunch', 'les bruncheurs', 'lunettes de soleil sur la tête', { top: '#CF9A80', bottom: '#5B6E86', skin: '#CC9871', hair: '#CDAA6E', hairStyle: 'long', acc: ['sunglasses'], expr: 'ravi' }],
  ['connaisseurs', 'les connaisseurs', 'carnet, col roulé, sac kraft', { top: '#414449', turtleneck: '#414449', bottom: '#4D5F7D', skin: '#87583A', hair: '#2B2320', hairStyle: 'short', acc: ['notebook', { kind: 'tote', color: '#B48F60' }], expr: 'attend' }],
];
function plancheSilhouettes() {
  const W = 1920;
  const H = 1990;
  const b = [header(W, 'Silhouettes: clients, joueurs, employés, habitués', 'Un profil se reconnaît à ce qu\'il fait et à ce qu\'il porte pour le faire, jamais à son corps, à son âge supposé, à son genre ni à son origine. Échelle: 1,80 m = 300 px.')];
  const k = 300 / 180;
  b.push(title(40, 160, 'Les neuf profils de clients, en couleur puis en silhouette'));
  PROFILE_SPECS.forEach(([id, name, sign, spec], i) => {
    const x = 120 + i * 205;
    const fig = F.person({ view: 'front', ...spec });
    const sil = F.person({ view: 'front', ...spec, silhouette: '#2B211C' });
    let extra = '';
    let extraSil = '';
    if (id === 'familles') {
      extra = `<g transform="translate(46 0)">${F.child({ view: 'front', skin: '#AD7852', hair: '#2B2320', hairStyle: 'curly', top: '#B0574D', bottom: '#97A866', expr: 'ravi' })}</g><g transform="translate(-52 0)">${F.stroller('#3F5E4A')}</g>`;
      extraSil = `<g transform="translate(46 0)">${F.child({ view: 'front', silhouette: '#2B211C' })}</g><g transform="translate(-52 0)">${F.stroller('#2B211C', '#2B211C')}</g>`;
    }
    b.push(`<g transform="translate(${x} 490) scale(${k})">${fig}${extra}</g>`);
    b.push(`<g transform="translate(${x} 900) scale(${k})">${sil}${extraSil}</g>`);
    b.push(text(x, 525, name, { s: 17, w: 600, a: 'middle' }) + para(x - 90, 548, sign, 180, { s: 14, c: MUTED, a: 'middle' }).svg.replace(/x="[\d.]+"/g, `x="${x}"`));
  });
  // avatars, employé, habitués, fournisseuse
  let y = 980;
  b.push(title(40, y, 'Les joueurs, un employé, deux personnages du village'));
  const row = 1300;
  const avA = (view) => F.person({ view, skin: '#CC9871', hair: '#4A3324', hairStyle: 'short', top: '#2B2F45', bottom: '#3A3A40', shoes: '#2B2320', apron: { kind: 'player', color: F.PLAYER.orb.color, player: 'orb' }, headscarf: 'orb', expr: 'content' });
  const avB = (view) => F.person({ view, skin: '#E4B897', hair: '#6E4A30', hairStyle: 'bob', top: '#EEE6D6', bottom: '#3A3A40', shoes: '#2B2320', apron: { kind: 'player', color: F.PLAYER.crescent.color, player: 'crescent' }, headscarf: 'crescent', expr: 'ravi' });
  const staff = (view) => F.person({ view, skin: '#AD7852', hair: '#2B2320', hairStyle: 'curly', top: '#93A3B5', bottom: '#4E5258', apron: { kind: 'staff', color: '#2F4F3E' }, expr: 'content' });
  const items = [
    [avA('front'), 'joueur, astre aqua', 'de face'], [avA('back'), 'haut sombre', 'de dos'],
    [avB('front'), 'joueuse, croissant mauve', 'de face'], [avB('back'), 'haut clair', 'de dos'],
    [staff('front'), 'employé', 'maison vert bouteille'], [staff('back'), 'de dos: aucun X', 'lien et nœud'],
    [F.person({ view: 'front', skin: '#F2D3BC', hair: '#B9B4AE', hairStyle: 'grey_bun_pencil', top: '#6E6A45', bottom: '#4E5258', acc: ['longCardigan', 'glassesChain', 'basket'], expr: 'content' }), 'l\'ancienne patronne', 'gilet prune, chignon'],
    [F.person({ view: 'front', skin: '#87583A', hair: '#2B2320', hairStyle: 'bun', top: '#5E6234', bottom: '#4E5258', acc: [{ kind: 'scarf', color: '#B0574D' }, { kind: 'basket', color: '#C9B794' }], expr: 'ravi' }), 'la laitière', 'foulard, panier'],
  ];
  items.forEach(([svg, l1, l2], i) => {
    const x = 120 + i * 175;
    b.push(`<g transform="translate(${x} ${row}) scale(${k})">${svg}</g>` + text(x, row + 32, l1, { s: 15, w: 600, a: 'middle' }) + text(x, row + 52, l2, { s: 14, c: MUTED, a: 'middle' }));
  });
  // humeurs
  const fx = 1540;
  b.push(title(fx - 40, y, 'Humeurs: le visage et la posture'));
  const moods = [['neutre', 'neutre'], ['content', 'content'], ['ravi', 'ravi'], ['lit', 'lit la carte'], ['attend', 'attend'], ['impatient', 'impatient'], ['decu', 'déçu'], ['fatigue', 'fatigué']];
  moods.forEach(([e, label], i) => {
    const x = fx - 30 + (i % 4) * 92;
    const yy = y + 30 + Math.floor(i / 4) * 150;
    b.push(`<svg x="${x}" y="${yy}" width="84" height="104" viewBox="-21 -192 42 52">${F.person({ view: 'front', skin: '#E4B897', hair: '#4A3324', hairStyle: 'short', top: '#707A86', expr: e })}</svg>` + text(x + 42, yy + 124, label, { s: 14, a: 'middle' }));
  });
  b.push(para(fx - 40, y + 340, 'Jamais de colère: au pire, déçu. Les états de service se lisent aussi à des objets: carte ouverte, carte fermée posée, manteau remis.', 420, { s: 14 }).svg);
  // les 15 paires de dos
  y = 1500;
  b.push(title(40, y, 'Les 15 paires possibles, vues de dos: le plus clair des deux porte le haut sombre'));
  let i = 0;
  for (let a = 0; a < players.length; a++) {
    for (let c2 = a + 1; c2 < players.length; c2++) {
      const pa = players[a];
      const pb = players[c2];
      const la = col.lightness(pa.color);
      const lb = col.lightness(pb.color);
      const dark = la >= lb ? pa : pb;
      const light = dark === pa ? pb : pa;
      const x = 70 + (i % 8) * 232;
      const yy = y + 200 + Math.floor(i / 8) * 230;
      const one = (pl, top, dx) => `<g transform="translate(${x + dx} ${yy}) scale(0.95)">${F.person({ view: 'back', skin: '#CC9871', hair: '#4A3324', hairStyle: 'short', top, bottom: '#3A3A40', apron: { kind: 'player', color: pl.color, player: pl.id }, headscarf: pl.id })}</g>`;
      b.push(one(dark, '#2B2F45', 30) + one(light, '#EEE6D6', 110));
      b.push(text(x + 70, yy + 26, `${dark.symbolName} et ${light.symbolName}`, { s: 14, a: 'middle', c: MUTED }));
      i += 1;
    }
  }
  b.push(text(1880, y, 'Contrôle: controles/silhouettes-controles.png', { s: 14, c: MUTED, a: 'end' }));
  write('silhouettes.svg', svgDoc(W, H, b.join('\n')), { width: W, height: H, montage: 'controles/silhouettes-controles.png', montageLabel: 'Silhouettes et paires de joueurs: vision normale, niveaux de gris, deutéranopie, protanopie', montageWidth: 1400 });
}

// ------------------------------------------------------------------------------------------------
// 6. Caméra et échelle
function plancheCamera() {
  const W = 1920;
  const H = 1180;
  const b = [header(W, 'Caméra subjective et échelle', 'Mannequin de 1,80 m, yeux à 1,65 m (valeur des plans et de la technique), champ vertical de 60 degrés (91,5 degrés en horizontal à 1366 x 768), réglable de 50 à 75.')];
  // élévation: 1 m = 200 px, sol à y = 1100; colonne de gauche seulement (x 40 à 960)
  const S = 200;
  const gx = 90;
  const gy = 1100;
  const Y = (m) => gy - m * S;
  const LX = 600;
  const g = [`<path d="M50 ${gy} H${LX}" stroke="${INK}" stroke-width="3"/>`];
  const level = (m, label, c2 = MUTED, dash = '6 6') => `<path d="M60 ${r1(Y(m))} H${LX}" stroke="${c2}" stroke-width="1.5" stroke-dasharray="${dash}"/>` + text(LX + 8, Y(m) + 5, `${String(m).replace('.', ',')} m  ${label}`, { s: 14, c: c2 });
  g.push(level(2.8, 'plafond du village'), level(2.05, 'rien ne pend plus bas sur un passage', '#B0574D'), level(1.8, 'étagère la plus haute à portée'), level(1.65, 'yeux (caméra)', '#2F4F3E', '2 0'), level(1.1, 'comptoir, côté clients'));
  g.push(text(LX + 8, Y(0.95) + 5, '0,95 m plan du barista; 0,90 m arrière-comptoir', { s: 14, c: MUTED }) + `<path d="M60 ${r1(Y(0.95))} H${LX}" stroke="${MUTED}" stroke-width="1.5" stroke-dasharray="6 6"/>`);
  g.push(level(0.75, 'tables'), level(0.45, 'assises'));
  g.push(`<g transform="translate(${gx + 40} ${gy}) scale(${S / 100})">${F.person({ view: 'front', skin: '#CC9871', hair: '#4A3324', hairStyle: 'short', top: '#2B2F45', bottom: '#3A3A40', apron: { kind: 'player', color: F.PLAYER.orb.color, player: 'orb' }, headscarf: 'orb', expr: 'content' })}</g>`);
  // champ de vision depuis l'œil (de profil): regard droit (60 degrés) et regard baissé de 30 degrés
  const ex = gx + 150;
  const ey = Y(1.65);
  const len = 340;
  const pt = (deg, l) => [ex + l * Math.cos((deg * Math.PI) / 180), ey - l * Math.sin((deg * Math.PI) / 180)];
  const [ax, ay] = pt(30, len);
  const [bx, by] = pt(-30, len);
  g.push(`<path d="M${ex} ${r1(ey)} L${r1(ax)} ${r1(ay)} L${r1(bx)} ${r1(by)} Z" fill="#2F4F3E" fill-opacity="0.08" stroke="#2F4F3E" stroke-width="2"/>`);
  const [cx1, cy1] = pt(-60, 300);
  g.push(`<path d="M${ex} ${r1(ey)} L${r1(cx1)} ${r1(cy1)}" stroke="#B0574D" stroke-width="2"/>`);
  g.push(text(ax - 120, ay - 10, 'regard droit: 60 degrés', { s: 15, c: '#2F4F3E' }));
  // comptoir de service et tasse, à 0,6 m devant les yeux
  const kx = ex + 0.6 * S - 30;
  g.push(`<rect x="${r1(kx)}" y="${r1(Y(1.1))}" width="110" height="${r1(1.1 * S)}" fill="#7E937B"/><rect x="${r1(kx - 4)}" y="${r1(Y(1.1))}" width="118" height="8" fill="#5E4130"/>` + cupIcon(kx + 30, Y(1.1) - 14, 0.7));
  g.push(text(kx + 120, Y(0.62), 'regard baissé de 30 à 45 degrés', { s: 15, c: '#B0574D' }) + text(kx + 120, Y(0.62) + 20, 'pour travailler au comptoir', { s: 15, c: '#B0574D' }));
  b.push(g.join(''));
  // règles de confort (haut de la colonne de gauche)
  b.push(title(40, 170, 'Confort: la caméra ne bouge jamais sans le joueur', { s: 22 }));
  const rules = [
    'Ni roulis, ni balancement de tête, ni secousse, ni flou de mouvement, ni effet de vitesse sur le champ de vision.',
    'Accélération et arrêt en 0,15 s au plus; vitesse de marche douce; regard appliqué à chaque image, sans latence.',
    'Point de visée fixe au centre (4 px, liseré sombre); l\'objet visé s\'éclaircit d\'un ton (aucun contour dessiné).',
    'Aucun cadrage imposé à un poste ni cinématique en vue subjective: un fondu enchaîné pour changer de lieu.',
    'Option « balancement doux » (1 cm, vertical seulement), désactivée par défaut; champ de vision réglable de 50 à 75 degrés.',
  ];
  let ry = 205;
  for (const r of rules) {
    const p2 = para(60, ry, r, 860, { s: 16 });
    b.push(`<circle cx="46" cy="${ry - 5}" r="4" fill="#2F4F3E"/>` + p2.svg);
    ry += p2.h + 8;
  }
  // tailles à l'écran
  const tx = 1000;
  let ty = 170;
  b.push(title(tx, ty, 'Taille à l\'écran (pixels de haut, 1366 x 768, 60 degrés)', { s: 22 }));
  ty += 18;
  const rows = [['tasse d\'expresso, vaisselle à 120 %', 0.07], ['tasse de cappuccino', 0.09], ['assiette, diamètre', 0.24], ['ticket du rail', 0.15], ['écusson au symbole, dans le dos', 0.2], ['tête d\'un personnage', 0.27], ['personnage', 1.8], ['lettre de l\'ardoise', 0.05]];
  const dists = [1, 2, 4, 8];
  const cw = 110;
  b.push(`<rect x="${tx}" y="${ty}" width="${330 + cw * 4}" height="${36 + rows.length * 34}" rx="8" fill="#FBF6EA" stroke="${LINE}"/>`);
  b.push(text(tx + 16, ty + 25, 'objet (taille réelle)', { s: 15, w: 600 }));
  dists.forEach((d, i) => b.push(text(tx + 330 + i * cw + cw / 2, ty + 25, `à ${d} m`, { s: 15, w: 600, a: 'middle' })));
  rows.forEach(([n, size], j) => {
    const yy = ty + 58 + j * 34;
    b.push(text(tx + 16, yy, `${n} (${String(size < 1 ? Math.round(size * 100) + ' cm' : size + ' m').replace('.', ',')})`, { s: 15 }));
    dists.forEach((d, i) => {
      const px = Math.round((665.1 * size) / d);
      const bad = (n.startsWith('lettre') && px < 14) || (!n.startsWith('lettre') && px < 8);
      b.push(text(tx + 330 + i * cw + cw / 2, yy, String(px), { s: 15, a: 'middle', c: bad ? '#B0574D' : INK, w: bad ? 600 : 400 }));
    });
  });
  ty += 36 + rows.length * 34 + 30;
  b.push(para(tx, ty, '665 / d pixels pour un mètre à d mètres (768 / (2 tan 30 degrés)); 935 / d sur un écran 1080. En rouge: sous 14 pixels pour une lettre, sous 8 pour un objet. Lettres du monde: 2 cm à 1 m, 5 cm à 2,5 m (C21 de la technique).', 860, { s: 15 }).svg);
  ty += 90;
  // vue rapprochée avec les mains
  const close = AD.village('morning', { view: 'c' });
  const cam = new Camera({ x: 2.0, z: 1.2, yaw: 3, pitch: -40 });
  const wand = cam.project(cam.view([2.22, 1.08, 1.72]));
  const hands = `<g>
    <path d="M1366 640 L1150 560 Q1080 540 1050 590 L1100 700 L1366 768 Z" fill="#2B2F45"/>
    <path d="M1160 585 L1125 570 L1118 600 L1150 612 Z" fill="${F.PLAYER.orb.color}" stroke="#1C1A26" stroke-width="2"/>
    <path d="M${r1(wand[0] - 70)} ${r1(wand[1] + 40)} L${r1(wand[0] + 60)} ${r1(wand[1] + 40)} L${r1(wand[0] + 50)} ${r1(wand[1] + 200)} Q${r1(wand[0])} ${r1(wand[1] + 214)} ${r1(wand[0] - 60)} ${r1(wand[1] + 200)} Z" fill="#B9BEC2" stroke="#5C6166" stroke-width="2"/>
    <path d="M${r1(wand[0] - 70)} ${r1(wand[1] + 40)} l-26 -12 l10 22 Z" fill="#B9BEC2" stroke="#5C6166" stroke-width="2"/>
    <circle cx="${r1(wand[0] + 10)}" cy="${r1(wand[1] + 120)}" r="22" fill="#F1EDE3" stroke="#5C6166" stroke-width="3"/><path d="M${r1(wand[0] + 10)} ${r1(wand[1] + 120)} l12 -14" stroke="#2B2622" stroke-width="3"/><path d="M${r1(wand[0] - 6)} ${r1(wand[1] + 104)} A22 22 0 0 1 ${r1(wand[0] + 28)} ${r1(wand[1] + 106)}" stroke="#6BD69A" stroke-width="5" fill="none"/><path d="M${r1(wand[0] + 28)} ${r1(wand[1] + 106)} A22 22 0 0 1 ${r1(wand[0] + 32)} ${r1(wand[1] + 124)}" stroke="#E0A030" stroke-width="5" fill="none"/>
    <path d="M1056 600 Q1040 560 1066 548 Q1110 540 1130 572 Q1140 610 1100 640 Q1066 640 1056 600 Z" fill="#CC9871"/>
    <path d="M1062 560 Q1046 548 1056 536 Q1072 532 1082 548" fill="#CC9871"/>
    <path d="M0 700 L180 610 Q230 600 250 640 L210 768 L0 768 Z" fill="#2B2F45"/>
    <path d="M176 616 L208 604 L218 632 L186 646 Z" fill="${F.PLAYER.orb.color}" stroke="#1C1A26" stroke-width="2"/>
    <path d="M206 640 Q214 598 256 600 Q300 610 296 650 Q286 690 246 688 Q210 682 206 640 Z" fill="#CC9871"/>
    <circle cx="683" cy="384" r="4" fill="#F6EEDF" stroke="#2B211C" stroke-width="2"/>
    <rect x="533" y="412" width="300" height="40" rx="20" fill="#2B211C" stroke="#5C4A3E"/><rect x="545" y="420" width="92" height="24" rx="7" fill="none" stroke="#CDBBA6" stroke-width="2"/>
    <text x="591" y="437" font-family="${D}" font-size="14" font-weight="600" fill="#CDBBA6" text-anchor="middle">maintenir</text>
    <text x="648" y="438" font-family="${D}" font-size="16" font-weight="600" fill="#F6EEDF">mousser le lait</text>
  </g>`;
  b.push(embed(close + hands, tx, ty, 683, 384));
  b.push(para(tx + 700, ty + 20, 'Mains stylisées (recommandé): moufles à pouce et index détachés, manche du haut du joueur, poignet à sa couleur. Le pichet porte un thermomètre à cadran (zone verte, puis ambre). Le HUD reste au centre, jamais sur les mains ni sur le plan de travail. Point de visée fixe au centre.', 220, { s: 14 }).svg);
  write('camera-echelle.svg', svgDoc(W, H, b.join('\n')), { width: W, height: H });
}

// ------------------------------------------------------------------------------------------------
// 7. Images de référence de style pour Meshy (un objet par image, fond uni, trois quarts, lumière douce)
let refCount = 0;
function refScene(build, camOpts) {
  const cam = new Camera({ width: 1024, height: 1024, vfov: 24, ...camOpts });
  const s = new Scene(cam, { ambientColor: '#F7F3EC', ambient: 0.86, dayColor: '#FFFFFF', windows: [], lamps: [{ pos: [camOpts.x - 2.2, camOpts.y + 2.5, camOpts.z + 0.4], color: '#FFF1DC', power: 0.6, radius: 4.5 }], exterior: { tint: '#FFFFFF' } });
  build(s);
  refCount += 1;
  return s.toSVG({ clipId: `ref${refCount}` });
}
function look(target, dist, yawDeg, pitchDeg) {
  const ya = (yawDeg * Math.PI) / 180;
  const pa = (pitchDeg * Math.PI) / 180;
  return { x: target[0] - dist * Math.sin(ya) * Math.cos(pa), y: target[1] - dist * Math.sin(pa), z: target[2] - dist * Math.cos(ya) * Math.cos(pa), yaw: yawDeg, pitch: pitchDeg };
}
function referencesMeshy() {
  const refs = [
    ['chaise-paillee-campagne', 'Chaise paillée, style campagne (600 triangles au plus)', (s) => M.chair(s, 0, 0, '-z', { kind: 'paille', wood: P.styles.campagne.colors[0].hex, seat: P.styles.campagne.colors[5].hex }), look([0, 0.5, 0], 3.4, 35, -18)],
    ['gueridon-bistrot', 'Guéridon de bistrot, marbre vert-gris (600 au plus)', (s) => M.roundTable(s, 0, 0, { r: 0.34, top: '#4F5A55', leg: '#2B3230', items: [[0.08, -0.04, 'cappuccino'], [-0.1, 0.07, 'espresso']], rim: '#6E2E35' }), look([0, 0.45, 0], 3.0, 30, -24)],
    ['tasse-cappuccino', 'Tasse de cappuccino sur soucoupe, liseré de la maison (250 au plus)', (s) => M.cup(s, 0, 0, 0, 'cappuccino', { rim: '#2F4F3E' }), look([0, 0.04, 0], 0.62, 25, -28)],
    ['machine-expresso', 'Machine à expresso à deux groupes, cuivre (4 000 au plus)', (s) => M.espressoMachineZ(s, 0, 0, 0, { body: '#A2643D', facing: '-z' }), look([0, 0.28, 0], 2.6, 22, -18)],
    ['suspension-emaillee', 'Suspension émaillée (600 au plus)', (s) => M.pendant(s, 0, 0, 0.9, 0.3, { shade: '#3F5248' }), look([0, 0.45, 0], 2.2, 30, -10)],
    ['plante-en-pot', 'Plante en pot, terre cuite (1 200 au plus)', (s) => M.plant(s, 0, 0, 0, { potH: 0.34, potR: 0.17 }), look([0, 0.45, 0], 2.8, 30, -14)],
  ];
  const out = [];
  for (const [id, label, build, camOpts] of refs) {
    const inner = refScene(build, camOpts);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="#EEE8DE"/>${inner}</svg>\n`;
    write(`references/${id}.svg`, svg, { width: 1024, height: 1024, bg: '#EEE8DE' });
    out.push([id, label]);
  }
  // personnages: face et dos, pour l'image vers 3D à plusieurs vues
  const chars = [
    ['avatar-face', 'Avatar de joueur, de face (5 000 triangles au plus de près)', F.person({ view: 'front', skin: '#CC9871', hair: '#4A3324', hairStyle: 'short', top: '#2B2F45', bottom: '#3A3A40', shoes: '#2B2320', apron: { kind: 'player', color: F.PLAYER.orb.color, player: 'orb' }, headscarf: 'orb', expr: 'content' })],
    ['avatar-dos', 'Avatar de joueur, de dos', F.person({ view: 'back', skin: '#CC9871', hair: '#4A3324', hairStyle: 'short', top: '#2B2F45', bottom: '#3A3A40', shoes: '#2B2320', apron: { kind: 'player', color: F.PLAYER.orb.color, player: 'orb' }, headscarf: 'orb' })],
    ['client-presse-face', 'Client pressé, de face', F.person({ view: 'front', coat: '#3E4A66', coatLength: 60, top: '#3E4A66', bottom: '#4E5258', skin: '#E4B897', hair: '#2B2320', hairStyle: 'short', acc: ['shoulderBag', 'takeaway'], expr: 'content' })],
    ['client-presse-dos', 'Client pressé, de dos', F.person({ view: 'back', coat: '#3E4A66', coatLength: 60, top: '#3E4A66', bottom: '#4E5258', skin: '#E4B897', hair: '#2B2320', hairStyle: 'short', acc: ['shoulderBag'] })],
  ];
  for (const [id, label, fig] of chars) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="#EEE8DE"/><g transform="translate(512 970) scale(4.8)">${fig}</g></svg>\n`;
    write(`references/${id}.svg`, svg, { width: 1024, height: 1024, bg: '#EEE8DE' });
    out.push([id, label]);
  }
  fs.writeFileSync(path.join(ROOT, 'references', 'LISEZ-MOI.txt'), ['Images de référence de style pour Meshy (image vers 3D, retexture guidée par image).', 'Générées par source/planches.cjs; règles d\'usage: bible-artistique.md, section 13.3.', '', ...out.map(([id, l]) => `${id}.png: ${l}`), ''].join('\n'));
}

plancheP();
for (const id of Object.keys(ADDR)) plancheAdresse(id);
plancheMoments();
plancheStyles();
plancheSilhouettes();
plancheCamera();
referencesMeshy();
fs.writeFileSync(path.join(__dirname, 'planches.json'), JSON.stringify({ generated: 'node source/planches.cjs', planches: manifest }, null, 2) + '\n');
console.log(`${manifest.length} planches écrites: ${manifest.map((m) => m.svg).join(', ')}`);
